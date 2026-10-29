import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Workflow } from "./workflow.mjs";
import {
  documentStore,
  validateSample,
  storeSample,
} from "./doctor-documents.mjs";

test("paid clinical case uploads a one-use sample; Google nurse verifies exact file before independent final approval", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "nurse-doc-test-"));
  const w = new Workflow(join(dir, "test.sqlite"), {
    now: () => Date.parse("2026-10-29T12:00:00+08:00"),
  });
  t.after(() => {
    w.db.close();
    rmSync(dir, { recursive: true, force: true });
  });
  documentStore(w.db);
  const c = w.create({
    surname: "陳",
    email: "family@example.test",
    patient_ref: "DOC-TEST",
    district: "屯門",
    building: "虛構大廈",
    date: "2026-11-10",
    shift: "DAY",
    start: "10:00",
    end: "14:00",
    fictional: true,
    services: [{ id: "ng-change", times: ["12:00"] }],
    doctor_order: "YES",
    existing_tube: "YES",
  });
  const link = (action) =>
    w.state.tokens
      .filter(
        (t) =>
          t.case_id === c.id && t.action === action && !t.used_at && !t.void_at,
      )
      .at(-1)?.token;
  w.act(link("accept_single"));
  w.paid(c);
  const upload = link("upload_doctor");
  assert.ok(upload);
  w.inspect(upload);
  assert.equal(
    w.db.prepare("SELECT count(*) AS count FROM doctor_documents").get().count,
    0,
  );
  assert.throws(() => w.act(upload), /上載表格/);
  const content = Buffer.from("%PDF-1.4\nFictional doctor order fixture only");
  const doc = storeSample(w, upload, { content });
  assert.equal(c.doctor_order_status, "PENDING_CHECK");
  assert.equal(doc.size, content.length);
  assert.equal(
    Buffer.from(
      w.db.prepare("SELECT content FROM doctor_documents").get().content,
    ).toString(),
    content.toString(),
  );
  assert.throws(() => storeSample(w, upload, { content }), /失效/);
  w.review(c, "draft");
  const nurse = { id: "STAFF-SENIOR", role: "SENIOR_NURSE", method: "google" };
  assert.throws(() => w.asOperator(nurse, () => w.review(c, "nurse")), /文件/);
  assert.throws(
    () =>
      w.asOperator(nurse, () =>
        w.review(c, "nurse", {
          document_id: "old-version",
          document_verified: true,
          reason: "checked",
        }),
      ),
    /文件/,
  );
  w.asOperator(nurse, () =>
    w.review(c, "nurse", {
      document_id: doc.id,
      document_verified: true,
      reason: "檢閱虛構樣本及現有喉管指示",
    }),
  );
  assert.equal(c.doctor_order_review.sha256, doc.sha256);
  assert.equal(c.doctor_order_status, "VERIFIED");
  assert.throws(() => w.asOperator(nurse, () => w.review(c, "admin")), /獨立/);
  w.asOperator({ id: "STAFF-ADMIN", role: "ADMIN", method: "google" }, () =>
    w.review(c, "admin"),
  );
  assert.equal(c.confirmed_by, "STAFF-ADMIN");
  assert.throws(
    () =>
      storeSample(w, w.token(c, "family", "upload_doctor").url.split("t=")[1], {
        content,
      }),
    /覆核/,
  );
});

test("sample validation rejects executable/HTML and oversized content", () => {
  for (const buffer of [
    Buffer.from("<html>not a document</html>"),
    Buffer.alloc(0),
    Buffer.alloc(2 * 1024 * 1024 + 1),
  ])
    assert.throws(() => validateSample(buffer));
  assert.equal(
    validateSample(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0])),
    "image/png",
  );
});
