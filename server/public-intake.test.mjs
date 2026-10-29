import test from "node:test";
import assert from "node:assert/strict";
import { publicIntake, createIntakeLimiter } from "./public-intake.mjs";

test("public intake strips staff-only approval, quote, status and clock fields", () => {
  const input = publicIntake({
    surname: "陳",
    email: "family@example.test",
    services: [],
    intake_version: "legacy-test",
    remote_confirmed: true,
    remote_tier: "C",
    remote_reviewed_by: "admin",
    status: "PAID",
    amount_paid: 1220,
    quote: { total: 1 },
  });
  assert.deepEqual(input, {
    surname: "陳",
    email: "family@example.test",
    services: [],
    intake_version: "v3",
  });
});
test("public intake rate limit bounds attempts and expires on wall time", () => {
  let now = Date.now();
  const allowed = createIntakeLimiter(() => now);
  for (let i = 0; i < 30; i++) assert.equal(allowed("test-IP"), true);
  assert.equal(allowed("test-IP"), false);
  assert.equal(allowed("another-IP"), true);
  now += 600001;
  assert.equal(allowed("test-IP"), true);
});
