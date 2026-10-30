import { eligibleNurse } from "./staff-workspace.mjs";
import { randomBytes, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  extendWorkflow,
  SERVICE_CATALOG,
  hasRedFlag,
} from "./extended-workflow.mjs";

export const HOLIDAYS = [
  "2026-01-01",
  "2026-02-17",
  "2026-02-18",
  "2026-02-19",
  "2026-04-03",
  "2026-04-04",
  "2026-04-06",
  "2026-04-07",
  "2026-05-01",
  "2026-05-25",
  "2026-06-19",
  "2026-07-01",
  "2026-09-26",
  "2026-10-01",
  "2026-10-19",
  "2026-12-25",
  "2026-12-26",
  "2027-01-01",
  "2027-02-06",
  "2027-02-08",
  "2027-02-09",
  "2027-03-26",
  "2027-03-27",
  "2027-03-29",
  "2027-04-05",
  "2027-05-01",
  "2027-05-13",
  "2027-06-09",
  "2027-07-01",
  "2027-09-16",
  "2027-10-01",
  "2027-10-08",
  "2027-12-25",
  "2027-12-27",
];
// Dates are transcribed from the supplied draft; official source URLs travel with the data.
const FOOTER = "\n\n此為 CUHK TSSSU 申請之模擬測試，所有資料均為虛構。";
const transitions = {
  SUBMITTED: ["QUOTED", "MANUAL", "NO_DR_ORDER", "NO_FIRST_INSERT"],
  MANUAL: ["QUOTED", "CANCELLED"],
  QUOTED: ["PENDING_PAY", "MANUAL", "CANCELLED"],
  PENDING_PAY: ["PAID", "PAY_TIMEOUT", "CANCELLED"],
  PAID: ["POSTED"],
  POSTED: ["MATCHED", "MANUAL"],
  MATCHED: ["READY", "MANUAL"],
  READY: ["MANUAL"],
};
export const defaults = {
  time_scale: 1,
  day_rate: 305,
  day_min_hours: 4,
  night_rate: 325,
  holiday_surcharge_per_hour: 30,
  payment_window_hours: 24,
  min_lead_hours: 48,
  nurse_day_rate: null,
  nurse_night_rate: null,
  holiday_min_mode: "MANUAL",
  night_special_mode: "MANUAL",
  package_offer_rule: "MANUAL",
  dispatch_preview: true,
};
export const special = (date) =>
  new Date(`${date}T12:00:00+08:00`).getUTCDay() === 0 ||
  HOLIDAYS.includes(date);
const min = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const nextDate = (date) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + 86400000)
    .toISOString()
    .slice(0, 10);
export function price(c, s = defaults) {
  if (!["2026", "2027"].includes(c.date.slice(0, 4)))
    return { manual: "假期表未涵蓋該年份" };
  const hours =
    c.shift === "DAY"
      ? Math.max((min(c.end) - min(c.start)) / 60, s.day_min_hours)
      : c.shift === "NIGHT10"
        ? 10
        : 12;
  if (c.shift !== "DAY" && (special(c.date) || special(nextDate(c.date))))
    return { manual: "夜更涉及星期日／公眾假期，待確認" };
  if (
    c.shift === "DAY" &&
    special(c.date) &&
    (min(c.end) - min(c.start)) / 60 < s.day_min_hours
  )
    return { manual: "假日不足四小時，待確認" };
  const base = hours * (c.shift === "DAY" ? s.day_rate : s.night_rate);
  const surcharge =
    c.shift === "DAY" && special(c.date)
      ? hours * s.holiday_surcharge_per_hour
      : 0;
  return Number.isInteger(base + surcharge)
    ? { hours, base, surcharge, total: base + surcharge }
    : { manual: "半元取整規則待確認" };
}
class BaseWorkflow {
  constructor(
    path,
    {
      now = () => Date.now(),
      baseUrl = "http://localhost:5173",
      paymentMode = "mock",
      seedNurses = true,
    } = {},
  ) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.now = now;
    this.baseUrl = baseUrl;
    this.paymentMode = paymentMode;
    this.db.exec(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS workspace (id INTEGER PRIMARY KEY CHECK (id=1), value TEXT NOT NULL)",
    );
    const row = this.db.prepare("SELECT value FROM workspace WHERE id=1").get();
    this.state = row
      ? JSON.parse(row.value)
      : {
          settings: { ...defaults },
          cases: [],
          tokens: [],
          timers: [],
          emails: [],
          events: [],
          nurses: Array.from({ length: seedNurses ? 5 : 0 }, (_, i) => ({
            id: `N0${i + 1}`,
            status: i < 4 ? "VERIFIED" : "APPLIED",
            email: `n0${i + 1}@example.test`,
          })),
          holidays: HOLIDAYS.map((date) => ({
            date,
            source_url: `https://www.gov.hk/tc/about/abouthk/holiday/${date.slice(0, 4)}.htm`,
            imported_from: "v3-email draft",
            fetched_at: null,
          })),
        };
    this.save();
  }
  save() {
    this.db
      .prepare(
        "INSERT INTO workspace VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
      )
      .run(JSON.stringify(this.state));
  }
  quote(c) {
    return price(c, this.state.settings);
  }
  stamp() {
    return new Date(this.now()).toISOString();
  }
  event(event, c, detail = {}) {
    this.state.events.push({
      id: randomUUID(),
      at: this.stamp(),
      case_id: c?.id,
      event,
      time_scale: this.state.settings.time_scale,
      ...detail,
    });
  }
  transition(c, to) {
    if (!transitions[c.status]?.includes(to)) {
      this.event("transition.rejected", c, { from: c.status, to });
      throw new Error(`不容許 ${c.status} → ${to}`);
    }
    const from = c.status;
    c.status = to;
    this.event("case.transitioned", c, { from, to });
  }
  email(c, template_id, to, subject, body, links = []) {
    this.state.emails.push({
      id: randomUUID(),
      case_id: c.id,
      template_id,
      template_version: "v3-email-draft",
      to,
      subject: c.intake_mode === "LIVE" ? subject : `【測試】${subject}`,
      body:
        body +
        (c.intake_mode === "LIVE" || this.paymentMode === "bank_transfer"
          ? "\n\n通知透過電郵發出。轉帳資料須由同事核對銀行入帳；如有疑問請聯絡同事，請勿重複轉帳。"
          : FOOTER),
      links,
      created_at: this.stamp(),
      status: "queued",
      attempts: 0,
    });
    this.event("email.queued", c, { template_id });
  }
  token(c, actor, action, ref) {
    const serviceStart = Date.parse(`${c.date}T${c.start}:00+08:00`);
    const genericExpiry = Math.max(
      this.now() + 7 * 86400000,
      Date.parse(`${c.date}T23:59:00+08:00`) + 7 * 86400000,
    );
    const t = {
      token: randomBytes(24).toString("hex"),
      case_id: c.id,
      actor,
      action,
      ref,
      quote_version: c.quote_version,
      created_at: this.stamp(),
      expires_at: new Date(
        action === "take_case" && Number.isFinite(serviceStart)
          ? serviceStart
          : genericExpiry,
      ).toISOString(),
    };
    this.state.tokens.push(t);
    return { label: action, url: `${this.baseUrl}/a?t=${t.token}` };
  }
  timer(c, type, hours, ref) {
    this.state.timers.push({
      id: randomUUID(),
      case_id: c.id,
      type,
      ref,
      due_at: new Date(
        this.now() + (hours * 3600000) / this.state.settings.time_scale,
      ).toISOString(),
    });
  }
  cancelTimers(c, types) {
    for (const t of this.state.timers)
      if (
        t.case_id === c.id &&
        types.includes(t.type) &&
        !t.fired_at &&
        !t.cancelled_at
      )
        t.cancelled_at = this.stamp();
  }
  voidTokens(c, actions) {
    for (const t of this.state.tokens)
      if (t.case_id === c.id && actions.includes(t.action) && !t.used_at)
        t.void_at = this.stamp();
  }
  manual(c, reason) {
    this.transition(c, "MANUAL");
    c.manual_reason = reason;
    this.event("manual.routed", c, { reason });
    this.email(
      c,
      "X03",
      c.email,
      `同事核實中 – Case ${c.id}`,
      `你好，Case ${c.id} 嘅資料需要同事核實，我哋會盡快跟進。`,
    );
    this.email(
      c,
      "T14m",
      this.state.admin_email || "admin@example.test",
      `⚠️ Case ${c.id}：交人手`,
      `交人手處理：${reason}。`,
    );
  }
  create(input) {
    const email = String(input.email || "").trim();
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !input.surname?.trim() ||
      !input.building?.trim() ||
      !input.district?.trim() ||
      (input.intake_mode === "LIVE"
        ? input.consent !== true
        : input.fictional !== true)
    )
      throw new Error(
        input.intake_mode === "LIVE"
          ? "請填妥電郵、姓名、地區、大廈，並同意保存及跟進查詢"
          : "請填妥電郵、姓氏、地區、大廈，並確認全部為虛構資料",
      );
    if (
      input.surname.length > 80 ||
      input.building.length > 200 ||
      input.district.length > 80
    )
      throw new Error("欄位長度超出限制");
    if (input.phone && !/^\d{8}$/.test(input.phone))
      throw new Error("電話須為八位數字");
    if (
      !/^202[67]-\d{2}-\d{2}$/.test(input.date) ||
      new Date(`${input.date}T00:00:00Z`).toISOString().slice(0, 10) !==
        input.date
    )
      throw new Error("日期須在 2026–2027 年內");
    if (!["DAY", "NIGHT10", "NIGHT12"].includes(input.shift))
      throw new Error("時段無效");
    const time = /^([01]\d|2[0-3]):(00|30)$/;
    if (
      input.shift === "DAY" &&
      (!time.test(input.start) ||
        !time.test(input.end) ||
        input.start < "07:00" ||
        input.end > "22:00" ||
        input.start >= input.end)
    )
      throw new Error("日間服務須在 07:00–22:00 內；時間每半小時一格");
    if (!Array.isArray(input.services) || !input.services.length)
      throw new Error("請選擇護理項目");
    const serviceLabels = Object.fromEntries(
      SERVICE_CATALOG.map((s) => [s.id, s.label]),
    );
    const allowed = Object.keys(serviceLabels);
    if (input.services.some((x) => !allowed.includes(x.id)))
      throw new Error("未支援的護理項目，請交人手");
    if (
      input.intake_mode === "LIVE" &&
      Date.parse(
        `${input.date}T${input.shift === "DAY" ? input.start : "22:00"}:00+08:00`,
      ) <= this.now()
    )
      throw new Error("服務時間必須在將來");
    const c = {
      id: `C${input.date.slice(0, 4)}-${String(this.state.cases.length + 1).padStart(4, "0")}`,
      test_ref: input.test_ref,
      surname: input.surname.trim(),
      email,
      phone: input.phone || "",
      district: input.district.trim(),
      building: input.building.trim(),
      date: input.date,
      shift: input.shift,
      start: input.shift === "DAY" ? input.start : "22:00",
      end:
        input.shift === "DAY"
          ? input.end
          : input.shift === "NIGHT10"
            ? "08:00"
            : "10:00",
      services: input.services.map((x) => ({
        id: x.id,
        label: serviceLabels[x.id],
        times: Array.isArray(x.times) ? x.times : [],
        prn: !!x.prn,
        ...SERVICE_CATALOG.find((s) => s.id === x.id),
        existing_tube: input.existing_tubes?.[x.id] || input.existing_tube,
      })),
      status: "SUBMITTED",
      created_at: this.stamp(),
      quote_version: 1,
      address_status: "NOT_ASKED",
      schedule_status: "PENDING_REVIEW",
      doctor_order: input.doctor_order || "NA",
      ...this.intakeFields?.(input),
    };
    for (const x of c.services)
      for (const t of x.times) {
        if (
          !/^([01]\d|2[0-3]):[0-5]\d$/.test(t) ||
          (c.shift === "DAY"
            ? t < c.start || t > c.end
            : !(t >= c.start || t <= c.end))
        )
          throw new Error("偏好時間必須在服務時段內");
      }
    this.state.cases.push(c);
    this.event("case.submitted", c);
    const b = c.services.some((x) => x.doctor_order_required);
    if (
      c.services.some(
        (x) => x.replace_only && x.existing_tube === "NO_FIRST_INSERT",
      )
    ) {
      this.transition(c, "NO_FIRST_INSERT");
      this.email(
        c,
        "T27",
        c.email,
        "不提供首次插喉",
        "你好，我哋只更換現有喉管，唔提供首次插入服務。",
      );
    } else if (
      b &&
      input.doctor_order === "NO" &&
      c.services.every((x) => x.category === "B")
    ) {
      this.transition(c, "NO_DR_ORDER");
      this.email(
        c,
        "T18",
        c.email,
        "需要醫生指示",
        "你好，所選服務需要醫生指示，暫時唔可以安排。",
      );
    } else {
      const quote = price(c, this.state.settings);
      const risk = hasRedFlag(input);
      c.red_flag = risk;
      const lead = Date.parse(`${c.date}T${c.start}:00+08:00`) - this.now();
      const reason =
        b &&
        input.doctor_order === "NO" &&
        c.services.some((x) => x.category !== "B")
          ? "A＋B 混合單缺少醫生指示，規則待確認"
          : risk
            ? "紅旗／臨床判斷請求"
            : input.other
              ? "其他需要待人手核實"
              : b &&
                  (input.doctor_order !== "YES" ||
                    c.services.some(
                      (x) => x.replace_only && x.existing_tube !== "YES",
                    ))
                ? "醫生指示／現有喉管未確認"
                : lead < this.state.settings.min_lead_hours * 3600000
                  ? "少於 48 小時，交人手"
                  : c.services.some(
                        (x) =>
                          x.id === "tube-feeding" && !x.prn && !x.times.length,
                      )
                    ? "定時餵食缺少時間"
                    : this.routingReason?.(c, input) || quote.manual;
      if (reason) this.manual(c, reason);
      else {
        c.quote = quote;
        this.transition(c, "QUOTED");
        const links = ["accept_single", "modify", "decline"].map((a) =>
          this.token(c, "family", a),
        );
        this.email(
          c,
          "T1",
          email,
          `上門護理報價 – Case ${c.id}`,
          `你好，${c.surname}先生／女士。多謝你查詢上門護理服務（Case ${c.id}）。\n服務：${c.date} ${c.start}–${c.end}\n服務內容：${c.services.map((x) => x.label).join("、")}\n收費明細：基本費 HK$${quote.base}｜公眾假期及星期日附加費 HK$${quote.surcharge}\n總額：HK$${quote.total}\n備註：所需工具及物料需由你自備。\n付款：確認後會收到付款連結，請喺 24 小時內付清，否則預約會自動取消。\n取消／改期：服務開始前 24 小時或以上通知免費；少於 24 小時：由同事跟進。`,
          links,
        );
      }
    }
    this.save();
    return c;
  }
  inspect(token) {
    const t = this.state.tokens.find((t) => t.token === token);
    const c = this.state.cases.find((c) => c.id === t?.case_id);
    if (!t || !c) throw new Error("連結已失效");
    this.event("link.opened", c, {
      action: t.action,
      actor: t.actor === "family" ? "family" : "nurse",
      actor_code: t.actor,
    });
    this.save();
    this.valid(t, c);
    return { t, c };
  }
  valid(t, c) {
    if (t.used_at || t.void_at || Date.parse(t.expires_at) <= this.now())
      throw new Error("連結已失效");
    const allowed = {
      accept_single: ["QUOTED"],
      modify: ["QUOTED"],
      decline: ["QUOTED"],
      cancel: ["PENDING_PAY"],
      take_case: ["POSTED", "MATCHED", "READY"],
      provide_unit: ["MATCHED"],
      confirm_reminder: ["READY"],
    };
    if (!allowed[t.action]?.includes(c.status))
      throw new Error(`連結已失效；目前狀態 ${c.status}`);
    if (t.action === "accept_single" && t.quote_version !== c.quote_version)
      throw new Error("報價版本已失效");
  }
  act(token, input = {}) {
    const t = this.state.tokens.find((t) => t.token === token);
    const c = this.state.cases.find((c) => c.id === t?.case_id);
    if (!t || !c) throw new Error("連結已失效");
    this.valid(t, c);
    if (t.action === "accept_single") {
      this.transition(c, "PENDING_PAY");
      c.payment_deadline = new Date(
        this.now() +
          (this.state.settings.payment_window_hours * 3600000) /
            this.state.settings.time_scale,
      ).toISOString();
      this.voidTokens(c, ["accept_single", "modify", "decline"]);
      this.timer(c, "PAY_REMIND", 12);
      this.timer(c, "PAY_EXPIRE", 24);
      this.event("quote.accepted_single", c);
      if (this.paymentMode === "mock") this.paymentEmail(c);
      else if (["fps_test", "bank_transfer"].includes(this.paymentMode))
        this.paymentEmail(c);
      else c.checkout_pending = true;
    } else if (t.action === "decline" || t.action === "cancel") {
      this.transition(c, "CANCELLED");
      this.cancelTimers(c, ["PAY_REMIND", "PAY_EXPIRE"]);
      this.voidTokens(c, ["accept_single", "modify", "decline", "cancel"]);
      c.checkout_expire_pending = !!c.stripe_session;
      this.email(
        c,
        "X05",
        c.email,
        "預約已取消",
        `你好，Case ${c.id} 嘅預約已取消，今次唔收任何費用。如仍需要服務，歡迎重新查詢。`,
      );
    } else if (t.action === "modify") this.manual(c, "客人要求修改報價");
    else if (t.action === "take_case") {
      const n = this.state.nurses.find((n) => n.id === t.actor);
      if (!n || !eligibleNurse(n, this.live)) {
        this.event("lock.lost", c, { nurse: t.actor, reason: "NOT_ELIGIBLE" });
        this.email(
          c,
          "T4b",
          n?.email || "unknown@example.test",
          "暫時未可以接單",
          "你好，你暫時未可以報名接單。如有疑問請聯絡管理員。",
        );
        t.used_at = this.stamp();
        this.save();
        return "你暫時未可以報名接單";
      }
      if (c.assigned_nurse) {
        this.event("lock.lost", c, {
          nurse: t.actor,
          reason: "ALREADY_ASSIGNED",
        });
        t.used_at = this.stamp();
        this.save();
        return `Case ${c.id} 已有護士接咗，多謝你報名。`;
      }
      this.transition(c, "MATCHED");
      c.assigned_nurse = n.id;
      c.address_status = "ASKED";
      this.cancelTimers(c, ["NO_TAKER"]);
      this.event("lock.won", c, { nurse: n.id });
      this.email(
        c,
        "T4c",
        n.email,
        `你已接 Case ${c.id}`,
        `恭喜，Case ${c.id} 由你負責。地址及 Care Schedule 確認後會以另一封電郵發俾你。如之後唔可以做，請即時通知我哋。`,
      );
      this.email(
        c,
        "T17",
        c.email,
        `已配對護士 – Case ${c.id}`,
        `你好，Case ${c.id} 已搵到護士負責 ${c.date} 嘅服務。`,
      );
      this.email(
        c,
        "T16",
        c.email,
        `請提供單位號碼 – Case ${c.id}`,
        `你好，Case ${c.id} 已配對護士。為咗護士準時上門，請撳以下掣填寫服務地址嘅樓層及單位（例如：12 樓 B 室；如大廈有多座或村屋，請一併寫座數／門牌）。資料只會交俾負責護士。`,
        [this.token(c, "family", "provide_unit")],
      );
    } else if (t.action === "provide_unit") {
      if (!input.unit?.trim() || input.unit.length > 200)
        throw new Error("請填寫樓層及單位（最多 200 字）");
      c.unit = input.unit.trim();
      c.address_status = "PROVIDED";
      this.event("address.provided", c);
      this.ready(c);
    } else if (t.action === "confirm_reminder") {
      const r = c.reminders?.find((r) => r.id === t.ref);
      if (!r) throw new Error("提醒已失效");
      r.confirmed_at = this.stamp();
      this.event("reminder.confirmed", c, { ref: r.id });
    }
    t.used_at = this.stamp();
    this.save();
    return "已確認，謝謝。";
  }
  paymentEmail(c) {
    this.email(
      c,
      "T8",
      c.email,
      `付款連結 – Case ${c.id}`,
      `你好，Case ${c.id} 報價已確認，請喺 ${new Date(c.payment_deadline).toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong" })} HKT 前（24 小時內）按以下連結付清 HK$${c.quote.total}。\n付款後我哋會即刻為你安排護士。逾時未付，預約會自動取消。${this.paymentMode === "mock" ? "\n本機模擬付款：請在驗證台按「模擬付款成功」，此連結並非 Stripe。" : ""}`,
      [
        ...(c.checkout_url
          ? [{ label: "Stripe test Checkout", url: c.checkout_url }]
          : []),
        this.token(c, "family", "cancel"),
      ],
    );
  }
  paid(c) {
    if (
      c.status !== "PENDING_PAY" ||
      Date.parse(c.payment_deadline) <= this.now()
    )
      throw new Error("付款時限已過或狀態不符");
    this.transition(c, "PAID");
    c.paid_at = this.stamp();
    this.cancelTimers(c, ["PAY_REMIND", "PAY_EXPIRE"]);
    this.voidTokens(c, ["cancel"]);
    this.event("payment.received", c, { provider: this.paymentMode });
    this.email(
      c,
      "T9",
      c.email,
      `已收到付款 – Case ${c.id}`,
      `已收到你嘅付款 HK$${c.quote.total}（Case ${c.id}），多謝。我哋而家幫你搵護士，配對後會通知你。`,
    );
    this.save();
  }
  dispatch(c) {
    if (c.status !== "PAID") throw new Error("必須先接受報價及付款");
    if (
      this.state.settings.nurse_day_rate === null ||
      this.state.settings.nurse_night_rate === null
    )
      throw new Error("請先由管理員確認測試護士薪酬設定");
    this.transition(c, "POSTED");
    for (const n of this.state.nurses.filter((n) =>
      eligibleNurse(n, this.live),
    ))
      this.email(
        c,
        "T3",
        n.email,
        `新 Case ${c.id}`,
        `📋 Case ${c.id}\n日期時間：${c.date} ${c.start}–${c.end}\n薪酬：HK$${c.shift === "DAY" ? this.state.settings.nurse_day_rate : this.state.settings.nurse_night_rate}／小時\n地區／大廈：${c.district} ${c.building}\n照顧重點：${c.services.map((x) => `${x.label} ${x.prn ? "（按需要）" : x.times.join("、")}`).join("；")}\n先到先得，有興趣請撳以下掣：`,
        [this.token(c, n.id, "take_case")],
      );
    this.timer(c, "NO_TAKER", 24);
    this.event("dispatch.posted", c);
    this.save();
  }
  review(c, step) {
    if (!["PAID", "POSTED", "MATCHED"].includes(c.status))
      throw new Error("請先完成付款");
    if (step === "draft") {
      if (c.schedule_status !== "PENDING_REVIEW" || c.schedule)
        throw new Error("草稿已建立");
      c.schedule = c.services.flatMap((x) =>
        (x.prn ? ["PRN"] : x.times.length ? x.times : ["待補時間"]).map(
          (time) => ({ time, item: x.label }),
        ),
      );
      this.event("schedule.drafted", c, {
        generator: "deterministic; no live AI",
      });
    } else if (step === "nurse") {
      if (
        !c.schedule ||
        c.schedule_status !== "PENDING_REVIEW" ||
        c.schedule.some((x) => x.time === "待補時間")
      )
        throw new Error("請先建立完整草稿");
      c.schedule_status = "NURSE_REVIEWED";
      c.reviewed_by = "senior_nurse";
      if (c.doctor_order === "YES") c.doctor_order = "VERIFIED";
      this.event("schedule.nurse_reviewed", c);
    } else if (step === "admin") {
      if (c.schedule_status !== "NURSE_REVIEWED")
        throw new Error("必須先經資深護士覆核");
      c.schedule_status = "CONFIRMED";
      c.confirmed_by = "admin";
      this.event("schedule.confirmed", c);
      this.ready(c);
    }
    this.save();
  }
  ready(c) {
    if (
      c.status !== "MATCHED" ||
      c.schedule_status !== "CONFIRMED" ||
      c.address_status !== "PROVIDED"
    )
      return;
    this.transition(c, "READY");
    const n = this.state.nurses.find((n) => n.id === c.assigned_nurse);
    this.email(
      c,
      "T11",
      n.email,
      `Case ${c.id} 詳情及 Care Schedule`,
      `Case ${c.id} 已確認，詳情如下：\n地址：${c.district} ${c.building} ${c.unit}｜聯絡：${c.surname}先生／女士 ${c.phone || "（經平台電郵）"}\nCare Schedule：${c.schedule.map((x) => `${x.time} ${x.item}`).join("\n")}\n工具物料由客人提供。`,
    );
    c.reminders = [];
    for (const row of c.schedule.filter((x) => x.time !== "PRN")) {
      const id = randomUUID();
      let date = c.date;
      if (c.shift !== "DAY" && row.time < c.start) date = nextDate(date);
      const due = Date.parse(`${date}T${row.time}:00+08:00`) - 600000;
      c.reminders.push({ id, ...row, due_at: new Date(due).toISOString() });
    }
    this.event("case.ready", c);
  }
  tick() {
    for (const t of this.state.timers) {
      if (
        (this.live &&
          !this.state.cases.some(
            (c) => c.id === t.case_id && c.intake_mode === "LIVE",
          )) ||
        t.fired_at ||
        t.cancelled_at ||
        Date.parse(t.due_at) > this.now()
      )
        continue;
      const c = this.state.cases.find((c) => c.id === t.case_id);
      t.fired_at = this.stamp();
      if (t.type === "PAY_EXPIRE" && c.status === "PENDING_PAY") {
        this.transition(c, "PAY_TIMEOUT");
        c.checkout_expire_pending = !!c.stripe_session;
        this.voidTokens(c, ["cancel"]);
        this.email(
          c,
          "T10b",
          c.email,
          `預約已自動取消 – Case ${c.id}`,
          `你好，由於 Case ${c.id} 未有喺 ${c.payment_deadline} 前完成付款資料提交，預約已自動取消。如已轉帳，請勿重複轉帳，請聯絡同事核對及跟進。如仍需要服務，歡迎聯絡我們。`,
        );
      } else if (t.type === "PAY_REMIND" && c.status === "PENDING_PAY")
        this.email(
          c,
          "T10",
          c.email,
          "付款提醒",
          ["bank_transfer", "fps_test"].includes(this.paymentMode)
            ? `提提你 Case ${c.id} 尚未確認收款。請於 ${c.payment_deadline} 前轉帳及提交資料；如已轉帳或提交，請勿重複轉帳，等候同事核對銀行入帳。如未提交資料，請聯絡同事跟進。`
            : `提提你 Case ${c.id} 仲未付款，請喺 ${c.payment_deadline} 前完成，否則預約會自動取消。`,
        );
      else if (t.type === "NO_TAKER" && c.status === "POSTED") {
        this.email(
          c,
          "T7",
          c.email,
          `搵緊護士接單中 – Case ${c.id}`,
          `你好，Case ${c.id} 搵緊護士接單中，請耐心等候。有消息我哋會即時通知你。`,
        );
        this.email(
          c,
          "T14b",
          this.state.admin_email || "admin@example.test",
          `⚠️ Case ${c.id}：未有護士`,
          `Case ${c.id} 已過 24 小時仍未有護士接單。`,
        );
        c.no_taker_flag = true;
      }
      this.event("timer.fired", c, { type: t.type });
    }
    for (const c of this.state.cases.filter(
      (c) =>
        ["READY", "IN_SERVICE"].includes(c.status) &&
        (!this.live || c.intake_mode === "LIVE"),
    ))
      for (const r of c.reminders || []) {
        if (!r.sent_at && Date.parse(r.due_at) <= this.now()) {
          r.sent_at = this.stamp();
          r.link = this.token(c, c.assigned_nurse, "confirm_reminder", r.id);
          this.email(
            c,
            "T12",
            this.state.nurses.find((n) => n.id === c.assigned_nurse).email,
            `提醒：${r.time} ${r.item} – Case ${c.id}`,
            `⏰ 提醒：${r.time} ${r.item}（Case ${c.id}）。收到請撳「確認」。`,
            [r.link],
          );
          this.event("reminder.sent", c, { ref: r.id });
        } else if (
          r.sent_at &&
          !r.confirmed_at &&
          !r.chased_at &&
          this.now() - Date.parse(r.sent_at) >=
            3600000 / this.state.settings.time_scale
        ) {
          r.chased_at = this.stamp();
          this.email(
            c,
            "T13",
            this.state.nurses.find((n) => n.id === c.assigned_nurse).email,
            `再提提你：${r.time} ${r.item} – Case ${c.id}`,
            `再提提你：${r.time} ${r.item}（Case ${c.id}）仲未確認，請撳「確認」。`,
            [r.link],
          );
          this.event("reminder.chased", c, { ref: r.id });
        }
      }
    this.save();
  }
}

export const Workflow = extendWorkflow(BaseWorkflow);
