import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

test("HTTP confirmation safety, 10 concurrent claims, private address and persistence", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "nurse-http-"));
  const port = Number(process.env.HTTP_TEST_PORT || 3199);
  const base = `http://localhost:${port}`;
  const key = "test-admin-key";
  const child = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      WORKSPACE_MODE: "test",
      PORT: String(port),
      API_PORT: "",
      BASE_URL: base,
      WORKFLOW_DB: join(dir, "test.sqlite"),
      WORKFLOW_ADMIN_KEY: key,
      PAYMENT_MODE: "mock",
      SMTP_HOST: "",
      STRIPE_SECRET_KEY: "",
      AUTH_MODE: "local",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    child.kill("SIGTERM");
    await once(child, "exit");
    rmSync(dir, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    child.stdout.on("data", (d) => {
      if (d.toString().includes("listening")) resolve();
    });
    child.once("exit", (code) => reject(new Error(`Server exited ${code}`)));
    child.stderr.on("data", (d) => {
      if (d.toString().includes("Error")) reject(new Error(d.toString()));
    });
  });
  const request = async (path, body) => {
    const r = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const value = await r.json();
    assert.equal(r.status, 200, JSON.stringify(value));
    return value;
  };
  assert.equal((await fetch(base + "/api/workflow")).status, 401);
  assert.equal(
    (
      await fetch(base + "/api/settings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          Origin: "https://attacker.invalid",
          "Content-Type": "application/json",
        },
        body: "{}",
      })
    ).status,
    403,
  );
  let state = await request("/api/workflow");
  await request("/api/settings", {
    time_scale: 1,
    nurse_day_rate: 245,
    nurse_night_rate: 270,
    nurses: state.nurses,
  });
  const c = await request("/api/cases", {
    surname: "陳",
    email: "family@example.test",
    district: "屯門",
    building: "虛構大廈",
    date: "2026-11-20",
    shift: "DAY",
    start: "10:00",
    end: "14:00",
    fictional: true,
    services: [{ id: "vitals", times: ["12:00"] }],
  });
  state = await request("/api/workflow");
  const accept = state.emails.find((m) => m.template_id === "T1").links[0].url;
  for (let i = 0; i < 3; i++) {
    const r = await fetch(accept);
    assert.equal(r.status, 200);
    const page = await r.text();
    assert.match(page, /form method="POST"/);
    assert.match(page, /基本費 HK\$1220/);
    assert.match(page, /總額：HK\$1220/);
  }
  assert.equal((await request("/api/workflow")).cases[0].status, "QUOTED");
  assert.equal((await fetch(accept, { method: "POST" })).status, 200);
  assert.equal((await fetch(accept, { method: "POST" })).status, 400);
  await request("/api/case-action", { id: c.id, action: "mock_paid" });
  await request("/api/case-action", { id: c.id, action: "dispatch" });
  state = await request("/api/workflow");
  const links = state.emails
    .filter((m) => m.template_id === "T3")
    .map((m) => m.links[0].url);
  const nursePage = await (await fetch(links[0])).text();
  assert.match(nursePage, /HK\$245／小時，共 HK\$980/);
  assert.match(nursePage, /屯門 虛構大廈/);
  assert.ok(!nursePage.includes("family@example.test"));
  const responses = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      fetch(links[i % 4], { method: "POST" }),
    ),
  );
  assert.equal(responses.filter((r) => r.status === 200).length, 4);
  state = await request("/api/workflow");
  assert.equal(state.events.filter((e) => e.event === "lock.won").length, 1);
  assert.ok(state.cases[0].assigned_nurse);
  const losingLink = links.find(
    (url) =>
      !state.emails
        .find(
          (m) =>
            m.template_id === "T3" &&
            m.to ===
              state.nurses.find((n) => n.id === state.cases[0].assigned_nurse)
                .email,
        )
        .links.some((l) => l.url === url),
  );
  // A fresh outstanding link is shown as taken by GET; consumed links remain invalid.
  if (losingLink)
    assert.match(
      await (await fetch(losingLink)).text(),
      /連結已失效|已有護士接/,
    );
  for (const action of ["draft", "nurse", "admin"])
    await request("/api/case-action", { id: c.id, action });
  state = await request("/api/workflow");
  assert.equal(state.cases[0].status, "MATCHED");
  const unit = state.emails.find((m) => m.template_id === "T16").links[0].url;
  assert.equal(
    (
      await fetch(unit, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ unit: "28 樓 Z 室" }),
      })
    ).status,
    200,
  );
  state = await request("/api/workflow");
  assert.equal(state.cases[0].status, "READY");
  assert.equal(state.emails.filter((m) => m.template_id === "T11").length, 1);
  assert.ok(
    state.emails
      .filter((m) => m.template_id === "T3")
      .every((m) => !m.body.includes("28 樓 Z 室")),
  );
});
