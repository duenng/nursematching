import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Workflow } from "./workflow.mjs";
import { canAccess } from "./auth.mjs";

test("live staff HTTP stores providers, guards payroll reconciliation and rejects email retry without SMTP", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "nurse-live-http-"));
  const path = join(dir, "test.sqlite");
  const base = "http://localhost:3205";
  const w = new Workflow(path, { seedNurses: false });
  w.state.cases.push({
    id: "LIVE-PAYROLL",
    intake_mode: "LIVE",
    status: "DONE",
  });
  w.state.payouts.push({
    id: "PAY-1",
    case_id: "LIVE-PAYROLL",
    status: "PENDING",
    total: 980,
  });
  w.state.emails.push({
    id: "MAIL-1",
    case_id: "LIVE-PAYROLL",
    status: "captured",
    to: "family@careknock.invalid",
  });
  w.save();
  w.db.close();
  const child = spawn(process.execPath, ["server/index.mjs"], {
    env: {
      ...process.env,
      PORT: "3205",
      API_PORT: "",
      BASE_URL: base,
      WORKFLOW_DB: path,
      WORKSPACE_MODE: "live",
      AUTH_MODE: "local",
      WORKFLOW_ADMIN_KEY: "live-test-key",
      PAYMENT_MODE: "bank_transfer",
      SMTP_HOST: "",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      STRIPE_SECRET_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    if (child.exitCode === null) {
      const done = once(child, "exit");
      child.kill("SIGTERM");
      await done;
    }
    rmSync(dir, { recursive: true, force: true });
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Startup timed out")),
      10000,
    );
    child.stdout.on("data", (d) => {
      if (d.toString().includes("listening")) {
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
        Authorization: "Bearer live-test-key",
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const value = await response.json();
    assert.equal(response.status, expected, JSON.stringify(value));
    return value;
  }
  assert.equal((await fetch(base + "/api/workflow")).status, 401);
  assert.equal((await request("/api/workflow")).nurses.length, 0);
  await request(
    "/api/nurses",
    {
      name: "Nurse",
      email: "nurse@careknock.invalid",
      category: "RN",
      status: "VERIFIED",
    },
    400,
  );
  const provider = await request("/api/nurses", {
    name: "Nurse",
    email: "nurse@careknock.invalid",
    category: "RN",
    status: "APPLIED",
  });
  assert.ok(provider.id);
  const payment = {
    id: "PAY-1",
    amount: 980,
    paid_at: new Date(Date.now() - 1000).toISOString(),
    bank_reference: "BANK-TEST-1",
    note: "Independently checked bank transfer",
    verified: true,
  };
  await request("/api/payout", { ...payment, amount: 979 }, 400);
  await request("/api/payout", { ...payment, verified: false }, 400);
  await request("/api/payout", payment);
  await request("/api/payout", payment, 400);
  const state = await request("/api/workflow");
  assert.equal(state.payouts[0].paid_by, "SHARED-ADMIN-KEY");
  assert.equal(state.payouts[0].status, "PAID");
  assert.equal(
    state.events.filter((e) => e.event === "payout.recorded").length,
    1,
  );
  await request("/api/email-retry", { id: "MAIL-1" }, 400);
  const senior = { role: "SENIOR_NURSE", method: "google" };
  for (const route of ["/api/payout", "/api/nurses", "/api/email-retry"])
    assert.equal(canAccess(senior, route, "POST", {}), false);
});
