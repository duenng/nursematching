import Busboy from "busboy";
import { createHash, randomUUID } from "node:crypto";

const MAX_FILE = 2 * 1024 * 1024;
export function documentStore(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS doctor_documents (
    id TEXT PRIMARY KEY, case_id TEXT NOT NULL, media_type TEXT NOT NULL,
    content BLOB NOT NULL, sha256 TEXT NOT NULL, created_at TEXT NOT NULL);`);
}
export function validateSample(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_FILE)
    throw new Error("測試文件不可超過 2 MB");
  if (
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)
    return "image/jpeg";
  if (buffer.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  throw new Error("只接受 PDF、PNG 或 JPEG 虛構樣本文件");
}
export function readSampleUpload(req) {
  return new Promise((resolve, reject) => {
    let parser;
    try {
      parser = Busboy({
        headers: req.headers,
        limits: {
          fileSize: MAX_FILE,
          files: 1,
          fields: 2,
          parts: 3,
          fieldSize: 100,
        },
      });
    } catch {
      reject(new Error("請使用上載表格提交文件"));
      return;
    }
    let file,
      fictional = false,
      invalid = false;
    parser.on("field", (name, value) => {
      if (name === "fictional" && value === "yes") fictional = true;
      else invalid = true;
    });
    parser.on("file", (name, stream) => {
      if (name !== "sample") invalid = true;
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("limit", () => {
        invalid = true;
      });
      stream.on("end", () => {
        file = Buffer.concat(chunks);
      });
    });
    for (const event of ["filesLimit", "fieldsLimit", "partsLimit"])
      parser.on(event, () => {
        invalid = true;
      });
    parser.on("error", reject);
    req.on("aborted", () => reject(new Error("文件上載中斷")));
    parser.on("close", () => {
      if (invalid || !fictional || !file)
        return reject(
          new Error("請確認虛構樣本；只可上載一個不超過 2 MB 的文件"),
        );
      try {
        resolve({ content: file, media_type: validateSample(file) });
      } catch (error) {
        reject(error);
      }
    });
    req.pipe(parser);
  });
}
export function storeSample(workflow, token, file) {
  const t = workflow.state.tokens.find((t) => t.token === token);
  const c = workflow.state.cases.find((c) => c.id === t?.case_id);
  if (!c || t.action !== "upload_doctor") throw new Error("連結已失效");
  workflow.valid(t, c);
  if (
    c.schedule_status !== "PENDING_REVIEW" ||
    !c.services.some((s) => s.doctor_order_required)
  )
    throw new Error("醫生指示已覆核或此個案不需要上載；請聯絡管理員");
  const media = validateSample(file.content);
  const id = randomUUID();
  const sha256 = createHash("sha256").update(file.content).digest("hex");
  workflow.db.exec("BEGIN IMMEDIATE");
  try {
    workflow.transaction(() => {
      workflow.db
        .prepare("INSERT INTO doctor_documents VALUES (?,?,?,?,?,?)")
        .run(id, c.id, media, file.content, sha256, workflow.stamp());
      c.doctor_document = {
        id,
        sha256,
        media_type: media,
        size: file.content.length,
        uploaded_at: workflow.stamp(),
      };
      c.doctor_order_status = "PENDING_CHECK";
      t.used_at = workflow.stamp();
      workflow.event("doctor_document.uploaded", c, {
        actor: "family",
        document_id: id,
        sha256,
      });
    });
    workflow.db.exec("COMMIT");
    return c.doctor_document;
  } catch (error) {
    workflow.db.exec("ROLLBACK");
    throw error;
  }
}
