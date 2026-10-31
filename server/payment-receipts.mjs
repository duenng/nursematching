import Busboy from "busboy";
import { createHash, randomUUID } from "node:crypto";

const MAX_FILE = 5 * 1024 * 1024;
export function receiptStore(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS payment_receipts (
    id TEXT PRIMARY KEY, case_id TEXT NOT NULL, media_type TEXT NOT NULL,
    content BLOB NOT NULL, sha256 TEXT NOT NULL, created_at TEXT NOT NULL);`);
}
export function validateReceipt(content) {
  if (!Buffer.isBuffer(content) || !content.length || content.length > MAX_FILE)
    throw new Error("付款截圖不可為空或超過 5 MB");
  if (
    content
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (content[0] === 255 && content[1] === 216 && content[2] === 255)
    return "image/jpeg";
  throw new Error("付款截圖只接受 PNG 或 JPEG 圖片");
}
export function readReceiptUpload(req) {
  return new Promise((resolve, reject) => {
    let parser;
    try {
      parser = Busboy({
        headers: req.headers,
        // Busboy signals partsLimit when it reaches the boundary of the limit.
        // files/fields still restrict the form to exactly one file.
        limits: { fileSize: MAX_FILE, files: 1, fields: 0, parts: 2 },
      });
    } catch {
      req.resume();
      reject(new Error("請使用上載表格提交付款截圖"));
      return;
    }
    let content,
      invalid = false;
    parser.on("file", (name, stream) => {
      if (name !== "screenshot") invalid = true;
      const chunks = [];
      stream.on("data", (chunk) => chunks.push(chunk));
      stream.on("limit", () => {
        invalid = true;
      });
      stream.on("error", reject);
      stream.on("end", () => {
        content = Buffer.concat(chunks);
      });
    });
    for (const event of ["filesLimit", "fieldsLimit", "partsLimit"])
      parser.on(event, () => {
        invalid = true;
      });
    parser.on("error", reject);
    req.on("aborted", () => reject(new Error("付款截圖上載中斷")));
    parser.on("close", () => {
      try {
        if (invalid) throw new Error("只可上載一張不超過 5 MB 的付款截圖");
        validateReceipt(content);
        resolve(content);
      } catch (error) {
        reject(error);
      }
    });
    req.pipe(parser);
  });
}
export function storeReceipt(workflow, token, content) {
  const { t, c } = workflow.inspect(token);
  if (
    t.action !== "report_fps" ||
    !["bank_transfer", "payme"].includes(workflow.paymentMode)
  )
    throw new Error("請使用有效付款截圖連結");
  if (workflow.now() >= Date.parse(c.payment_deadline))
    throw new Error("提交付款截圖期限已過，請聯絡同事核對");
  const media_type = validateReceipt(content);
  const screenshot = {
    id: randomUUID(),
    media_type,
    size: content.length,
    sha256: createHash("sha256").update(content).digest("hex"),
    uploaded_at: workflow.stamp(),
  };
  workflow.db.exec("BEGIN IMMEDIATE");
  try {
    const result = workflow.transaction(() => {
      workflow.db
        .prepare("INSERT INTO payment_receipts VALUES (?,?,?,?,?,?)")
        .run(
          screenshot.id,
          c.id,
          media_type,
          content,
          screenshot.sha256,
          screenshot.uploaded_at,
        );
      return workflow.recordPaymentReport(c, t, { screenshot });
    });
    workflow.db.exec("COMMIT");
    return result;
  } catch (error) {
    workflow.db.exec("ROLLBACK");
    throw error;
  }
}
