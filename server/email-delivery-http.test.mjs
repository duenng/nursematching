import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Workflow } from "./workflow.mjs";
import { saveNurse } from "./staff-workspace.mjs";

// All SMTP traffic stays on loopback. No external mail or deployment records are used.
async function fixture(t, mode, allowlist) {
  const deliveries = [];
  const sockets = new Set();
  const smtp = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.setEncoding("utf8");
    socket.write("220 localhost test SMTP\r\n");
    let buffer = "";
    let data = null;
    let recipient;
    socket.on("data", (chunk) => {
      buffer += chunk;
      while (buffer.includes("\r\n")) {
        const end = buffer.indexOf("\r\n");
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (data) {
          if (line === ".") {
            deliveries.push({ recipient, body: data.join("\r\n") });
            data = null;
            socket.write("250 Accepted\r\n");
          } else data.push(line);
        } else if (/^(EHLO|HELO)/i.test(line))
          socket.write("250 localhost\r\n");
        else if (/^RCPT TO:/i.test(line)) {
          recipient = line.match(/<([^>]+)>/)[1];
          socket.write("250 OK\r\n");
        } else if (line === "DATA") {
          data = [];
          socket.write("354 End with dot\r\n");
        } else if (line === "QUIT") socket.end("221 Bye\r\n");
        else socket.write("250 OK\r\n");
      }
    });
  });
  smtp.listen(0, "127.0.0.1");
  await once(smtp, "listening");
  const reserve = createServer();
  reserve.listen(0, "127.0.0.1");
  await once(reserve, "listening");
  const port = reserve.address().port;
  await new Promise((resolve) => reserve.close(resolve));
  const base = `http://localhost:${port}`;
  const dir = mkdtempSync(join(tmpdir(), "careknock-mail-http-"));
  const path = join(dir, "test.sqlite");
  const w = new Workflow(path, { seedNurses: false, baseUrl: base });
  w.live = mode === "live";
  const nurse = w.asOperator({ id: "TEST-ADMIN" }, () =>
    saveNurse(w, {
      name: "Test Nurse",
      email: "nurse@careknock.invalid",
      category: "RN",
      status: "VERIFIED",
      registration: "TEST-RN",
      verification_note: "Test fixture credentials verified",
      credentials_verified: true,
    }),
  );
  const c = {
    id: "C-DELIVERY",
    intake_mode: mode === "live" ? "LIVE" : "TEST",
    status: "PAID",
    surname: "Test",
    email: "family@careknock.invalid",
    date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    start: "10:00",
    end: "14:00",
    shift: "DAY",
    district: "屯門",
    building: "Test Building",
    services: [],
    quote: { hours: 4, total: 1220 },
    address_status: "PENDING",
    schedule_status: "PENDING_REVIEW",
  };
  w.state.cases.push(c);
  w.state.admin_email = "admin@careknock.invalid";
  w.state.settings.nurse_day_rate = 245;
  w.state.settings.nurse_night_rate = 270;
  w.email(c, "T9", c.email, "Payment received", "Test receipt");
  w.email(
    c,
    "T3",
    nurse.email,
    "Previously blocked invitation",
    "Test invitation",
  );
  const blockedId = w.state.emails.at(-1).id;
  Object.assign(w.state.emails.at(-1), {
    status: "blocked",
    error: "Recipient is not in TEST_EMAIL_ALLOWLIST",
  });
  w.save();
  w.db.close();
  const child = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      PORT: String(port),
      API_PORT: "",
      BASE_URL: base,
      WORKFLOW_DB: path,
      WORKSPACE_MODE: mode,
      AUTH_MODE: "local",
      WORKFLOW_ADMIN_KEY: "mail-test-key",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      PAYMENT_MODE: mode === "live" ? "bank_transfer" : "mock",
      STRIPE_SECRET_KEY: "",
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: String(smtp.address().port),
      SMTP_USER: "",
      SMTP_PASS: "",
      SMTP_FROM: "sender@careknock.invalid",
      TEST_EMAIL_ALLOWLIST: allowlist,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    if (child.exitCode === null) {
      const done = once(child, "exit");
      child.kill("SIGTERM");
      await done;
    }
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => smtp.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Server startup timed out")),
      10000,
    );
    child.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("listening")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited ${code}`));
    });
  });
  async function request(route, body, expected = 200) {
    const response = await fetch(base + route, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: "Bearer mail-test-key",
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    assert.equal(response.status, expected, JSON.stringify(result));
    return result;
  }
  async function settled() {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const state = await request("/api/workflow");
      if (!state.emails.some((m) => ["queued", "sending"].includes(m.status)))
        return state;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("Email processing timed out");
  }
  await settled();
  return { request, settled, deliveries, blockedId, nurse, c };
}

test("live SMTP dispatch and retry ignore a stale test allowlist", async (t) => {
  const { request, settled, deliveries, blockedId, nurse, c } = await fixture(
    t,
    "live",
    "unrelated@careknock.invalid",
  );
  assert.equal((await request("/api/health")).email_restricted, false);
  await request("/api/case-action", { id: c.id, action: "dispatch" });
  let state = await settled();
  assert.equal(state.capabilities.email_restricted, false);
  assert.equal(state.cases[0].status, "POSTED");
  const invitation = state.emails.find(
    (m) => m.template_id === "T3" && m.id !== blockedId,
  );
  assert.equal(invitation.to, nurse.email);
  assert.equal(invitation.status, "sent");
  assert.ok(invitation.links.some((l) => l.label === "take_case"));
  assert.equal(
    state.emails.find((m) => m.template_id === "T14").status,
    "sent",
  );
  assert.equal(state.emails.find((m) => m.id === blockedId).status, "blocked");
  const before = deliveries.length;
  await request("/api/email-retry", { id: blockedId });
  state = await settled();
  assert.equal(state.emails.find((m) => m.id === blockedId).status, "sent");
  assert.equal(deliveries.length, before + 1);
  assert.equal(deliveries.at(-1).recipient, nurse.email);
  assert.equal(
    (await fetch(invitation.links[0].url, { method: "POST" })).status,
    200,
  );
  state = await settled();
  assert.equal(state.cases[0].status, "MATCHED");
  assert.equal(state.cases[0].assigned_nurse, nurse.id);
  const addressRequest = state.emails.find((m) => m.template_id === "T16");
  assert.equal(addressRequest.to, c.email);
  assert.equal(addressRequest.status, "sent");
  assert.ok(!state.emails.some((m) => m.template_id === "T11"));
  for (const action of ["draft", "nurse", "admin"])
    await request("/api/case-action", { id: c.id, action });
  state = await settled();
  assert.equal(state.cases[0].schedule_status, "CONFIRMED");
  assert.equal(state.cases[0].status, "MATCHED");
  assert.ok(!state.emails.some((m) => m.template_id === "T11"));
  assert.equal(
    (
      await fetch(addressRequest.links[0].url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unit: "Test floor 12 unit B" }),
      })
    ).status,
    200,
  );
  state = await settled();
  assert.equal(state.cases[0].status, "READY");
  const details = state.emails.filter((m) => m.template_id === "T11");
  assert.equal(details.length, 1);
  assert.equal(details[0].to, nurse.email);
  assert.equal(details[0].status, "sent");
  assert.match(details[0].body, /Test floor 12 unit B/);
  assert.ok(!invitation.body.includes("Test floor 12 unit B"));
});

for (const allowlist of ["admin@careknock.invalid", ""]) {
  test(`test SMTP restricts dispatch and retry with ${allowlist ? "an explicit" : "an empty"} allowlist`, async (t) => {
    const { request, settled, deliveries, blockedId, c } = await fixture(
      t,
      "test",
      allowlist,
    );
    assert.equal((await request("/api/health")).email_restricted, true);
    await request("/api/case-action", { id: c.id, action: "dispatch" });
    const state = await settled();
    assert.equal(state.capabilities.email_restricted, true);
    assert.equal(
      state.emails.find((m) => m.template_id === "T3" && m.id !== blockedId)
        .status,
      "blocked",
    );
    await request("/api/email-retry", { id: blockedId }, 400);
    assert.ok(
      deliveries.every((m) => m.recipient === "admin@careknock.invalid"),
    );
    assert.equal(deliveries.length, allowlist ? 1 : 0);
  });
}
