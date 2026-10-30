import { dispatchBody, quoteBody } from "./workflow-content.mjs";
import { EVENT_ALIASES, TIMER_CODES, auditDetail } from "./audit.mjs";
import { HOLIDAY_CATALOG } from "./catalog/holidays.mjs";
import { eligibleNurse } from "./staff-workspace.mjs";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { canonical, TEMPLATE_VERSION, TEMPLATE_CATALOG } from "./templates.mjs";
export const SERVICE_CATALOG = JSON.parse(
  readFileSync(new URL("./catalog/services.json", import.meta.url), "utf8"),
);
export const DISTRICTS = [
  "中西區",
  "灣仔",
  "東區",
  "南區",
  "油尖旺",
  "深水埗",
  "九龍城",
  "黃大仙",
  "觀塘",
  "葵青",
  "荃灣",
  "屯門",
  "元朗",
  "北區",
  "大埔",
  "沙田",
  "西貢",
  "離島",
];
export const EXPERIMENT_POLICIES = {
  package_offer_rule: "MANUAL",
  quote_expiry: false,
  repost: false,
  repeat_no_taker: false,
  unit_chase: false,
  pre_service_alerts: false,
  reminder_escalation: false,
  allow_arrival_completion: false,
  package_release: false,
  notify_others: false,
  notify_data_deletion: false,
};
const operators = new AsyncLocalStorage();
const hour = 3600000;
const terminal = [
  "DONE",
  "CANCELLED",
  "PAY_TIMEOUT",
  "EXPIRED",
  "NO_DR_ORDER",
  "NO_FIRST_INSERT",
];
const decisionActions = [
  "accept_single",
  "accept_package",
  "accept_existing_package",
  "modify",
  "decline",
];
const extraTransitions = {
  MANUAL: ["FULL_REFUND"],
  QUOTED: ["EXPIRED", "PAID"],
  POSTED: ["POSTED", "FULL_REFUND"],
  MATCHED: ["REMATCH", "FULL_REFUND"],
  READY: ["REMATCH", "IN_SERVICE", "FULL_REFUND"],
  REMATCH: ["MATCHED", "FULL_REFUND", "MANUAL"],
  IN_SERVICE: ["DONE", "MANUAL"],
  FULL_REFUND: ["CANCELLED"],
};
const policyDefaults = {
  ...EXPERIMENT_POLICIES,
  package_hours: 30,
  package_price: 8650,
  package_discount: 500,
  package_list_price: 9150,
  package_low_balance_hours: 4,
  nurse_travel_allowance: 150,
  max_drop_strikes: 3,
  sender_name: "CareKnock",
};
const available = (p) => p.hours_total - p.hours_used - p.hours_reserved;
export const hasRedFlag = (input) =>
  /胸口痛|胸痛|氣促|呼吸困難|昏迷|叫唔醒|抽筋|中風|大量出血|流血唔止|高燒|自殺|跌親撞頭|流膿|流緊膿|胰島素|劑量|幾多單位|加藥|減藥|發炎|簡單定複雜|唔收附加費|chest pain|shortness of breath|unconscious|seizure|stroke|bleeding|insulin|dosage|dose|diagnos|pus|waive/i.test(
    `${input.remarks || ""} ${input.other || input.other_need_text || ""} ${input.medical_history || ""}`,
  );
export const extendWorkflow = (Base) =>
  class extends Base {
    constructor(...args) {
      super(...args);
      this.fpsRecipient = args[1]?.fpsRecipient || "";
      this.fpsAccountName = args[1]?.fpsAccountName || "";
      this.bankName = args[1]?.bankName?.trim() || "";
      this.bankAccountName = args[1]?.bankAccountName?.trim() || "";
      this.bankAccountNumber = args[1]?.bankAccountNumber?.trim() || "";
      this.state.settings = { ...policyDefaults, ...this.state.settings };
      if (this.state.settings.sender_name === "上門護理配對（測試）")
        this.state.settings.sender_name = "CareKnock";
      for (const c of this.state.cases) if (hasRedFlag(c)) c.red_flag = true;
      for (const key of [
        "packages",
        "ledger_entries",
        "payouts",
        "clients",
        "evidence",
        "remote_list",
      ])
        this.state[key] ??= [];
      this.state.template_catalog = TEMPLATE_CATALOG;
      this.state.service_catalog = SERVICE_CATALOG;
      this.state.districts = DISTRICTS;
      this.state.schema_version = 4;
      this.state.holidays = this.state.holidays.map((h) => ({
        ...h,
        ...HOLIDAY_CATALOG.find((r) => r.date === h.date),
      }));
      for (const t of this.state.tokens) t.id ??= randomUUID();
      this.state.payment_submissions ??= [];
      this.state.payment_reconciliations ??= [];
      this.state.evidence_requirements ??= [
        "C01–C20 計價與人工分流",
        "F01–F17 流程測試",
        "SMTP 寄件及受控收件確認",
        "真實時間 24h 付款逾時",
        "真實時間 24h 無人接單",
        "客人轉帳聲明與管理員對數分離、退款轉帳紀錄",
        "實驗範圍及人工覆核簽署",
      ];
      this.save();
    }
    asOperator(user, fn) {
      return operators.run(user, fn);
    }
    operatorId(fallback) {
      return operators.getStore()?.id || fallback;
    }
    review(c, step, input = {}) {
      return this.transaction(() => {
        if (
          step === "admin" &&
          operators.getStore()?.method === "google" &&
          (c.reviewed_by === operators.getStore().id ||
            c.review_auth_method !== "google")
        )
          throw new Error(
            "須先由獨立 Google 登入嘅資深護士覆核，再由管理員批核",
          );
        if (
          step === "nurse" &&
          operators.getStore()?.method === "google" &&
          c.services.some((s) => s.doctor_order_required)
        ) {
          if (
            !c.doctor_document ||
            input.document_id !== c.doctor_document.id ||
            input.document_verified !== true ||
            !input.reason?.trim()
          )
            throw new Error(
              "請檢閱已上載醫生指示文件，確認文件版本並填覆核說明",
            );
          c.doctor_order_review = {
            document_id: c.doctor_document.id,
            sha256: c.doctor_document.sha256,
            reviewed_by: this.operatorId("senior_nurse"),
            reviewed_at: this.stamp(),
            note: input.reason,
          };
        }
        super.review(c, step);
        if (step === "nurse") {
          c.reviewed_by = this.operatorId("senior_nurse");
          c.review_auth_method = operators.getStore()?.method || "engine_test";
        }
        if (step === "admin") c.confirmed_by = this.operatorId("admin");
        if (step === "nurse") {
          c.doctor_order_status = c.services.some(
            (s) => s.doctor_order_required,
          )
            ? "VERIFIED"
            : "NA";
          c.schedule_version ??= 1;
        }
      });
    }
    timer(c, type, hours, ref) {
      super.timer(c, type, hours, ref);
      Object.assign(this.state.timers.at(-1), {
        start_at: this.stamp(),
        timer_code: TIMER_CODES[type] || type,
        time_scale: this.state.settings.time_scale,
      });
    }
    save() {
      if (!this.transactionDepth) super.save();
    }
    transaction(fn) {
      const previousDepth = this.transactionDepth || 0;
      this.transactionDepth = previousDepth + 1;
      const before = structuredClone(this.state);
      try {
        const result = fn();
        this.transactionDepth = previousDepth;
        this.save();
        return result;
      } catch (error) {
        const rejected = this.state.events
          .slice(before.events.length)
          .filter((e) => e.event === "transition.rejected");
        for (const name of Object.keys(before)) {
          if (Array.isArray(before[name]) && Array.isArray(this.state[name])) {
            const old = this.state[name];
            this.state[name] = before[name].map((saved) => {
              const existing = old.find((x) => x.id && x.id === saved.id);
              if (existing) {
                for (const k of Object.keys(existing)) delete existing[k];
                Object.assign(existing, saved);
                return existing;
              }
              return saved;
            });
          } else this.state[name] = before[name];
        }
        this.state.events.push(...rejected);
        this.transactionDepth = previousDepth;
        this.save();
        throw error;
      }
    }
    transition(c, to) {
      if (extraTransitions[c.status]?.includes(to)) {
        const from = c.status;
        c.status = to;
        this.event("case.transitioned", c, { from, to });
      } else super.transition(c, to);
      c.updated_at = this.stamp();
    }
    manual(c, reason) {
      const previous = c.status;
      super.manual(c, reason);
      c.manual_from = previous;
      this.cancelAll(c);
    }
    event(event, c, detail = {}) {
      c = this.state.cases.find((item) => item.id === c?.id) || c;
      detail = auditDetail(detail, c);
      const actors = {
        "case.submitted": "family",
        "quote.accepted_single": "family",
        "address.provided": "family",
        "schedule.drafted": "system",
        "schedule.nurse_reviewed": "senior_nurse",
        "schedule.confirmed": "admin",
        "dispatch.posted": "admin",
        "reminder.confirmed": "nurse",
        "nurse.dropped": "nurse",
      };
      const actor =
        detail.actor || (detail.nurse ? "nurse" : actors[event]) || "system";
      super.event(event, c, {
        env:
          (c?.intake_mode ||
            this.state.cases.find((item) => item.id === c?.id)?.intake_mode) ===
          "LIVE"
            ? "LIVE"
            : "TEST",
        actor,
        actor_code:
          detail.nurse ||
          (actor === "nurse" ? c?.assigned_nurse : null) ||
          (actor === "family" && c ? `CLIENT-${c.id}` : actor),
        from_status: detail.from ?? c?.status ?? null,
        to_status: detail.to ?? c?.status ?? null,
        template_id: detail.template_id ?? null,
        template_version:
          detail.template_version ??
          (detail.template_id ? TEMPLATE_VERSION : null),
        token_id: detail.token_id ?? this.actionToken?.id ?? null,
        detail_json: JSON.stringify(detail),
        ...detail,
        ...(operators.getStore()
          ? {
              actor:
                operators.getStore().role === "SENIOR_NURSE"
                  ? "senior_nurse"
                  : "admin",
              actor_code: operators.getStore().id,
              auth_method: operators.getStore().method,
            }
          : {}),
      });
      const record = this.state.events.at(-1);
      record.event_id = record.id;
      record.ts = record.at;
      record.timer_code =
        TIMER_CODES[detail.timer_code] ||
        detail.timer_code ||
        TIMER_CODES[detail.type] ||
        null;
      if (EVENT_ALIASES[event]) {
        const id = randomUUID();
        this.state.events.push({
          ...record,
          id,
          event_id: id,
          event: EVENT_ALIASES[event],
          legacy_event_id: record.id,
        });
      }
    }
    intakeFields(i) {
      return {
        intake_version: i.intake_version || "legacy-test",
        intake_mode: i.intake_mode === "LIVE" ? "LIVE" : "TEST",
        fictional: i.intake_mode !== "LIVE",
        consent_version:
          i.intake_mode === "LIVE" ? "care-enquiry-v1" : "test-v1",
        patient_ref: i.patient_ref || i.surname,
        gender: i.gender,
        age: i.age,
        weight_kg: i.weight_kg,
        height_cm: i.height_cm,
        mobility: i.mobility,
        recent_3m: i.recent_3m || [],
        medical_history: i.medical_history || "",
        companion: i.companion,
        remarks: i.remarks || "",
        other_need_text: i.other || "",
        consent: i.consent === true || i.fictional === true,
        consent_at: this.stamp(),
        existing_tubes: i.existing_tubes || {},
        doctor_order_file: i.doctor_order_file || "",
        doctor_order_status: i.doctor_order === "YES" ? "PENDING_CHECK" : "NA",
        remote_tier: "C",
        nurse_travel_allowance: 0,
        applicants: [],
        nurse_history: [],
        visits: i.visits?.length
          ? i.visits.map((v, index) => ({
              ...v,
              id: `V${index + 1}`,
              status: "PLANNED",
            }))
          : [
              {
                id: "V1",
                date: i.date,
                start: i.shift === "DAY" ? i.start : "22:00",
                end:
                  i.shift === "DAY"
                    ? i.end
                    : i.shift === "NIGHT10"
                      ? "08:00"
                      : "10:00",
                status: "PLANNED",
              },
            ],
      };
    }
    routingReason(c, i) {
      if (c.services.some((s) => s.pending)) return "胃造口喉分類待確認";
      if (
        /胸口痛|胸痛|氣促|呼吸困難|昏迷|叫唔醒|抽筋|中風|大量出血|流血唔止|高燒|自殺|跌親撞頭|胰島素|劑量|幾多單位|加藥|減藥|流緊?膿|chest pain|shortness of breath|unconscious|seizure|stroke|bleeding|insulin|dose/i.test(
          c.medical_history,
        )
      )
        return "病史含紅旗／用藥請求";
      if (i.visits?.length > 1) return "多次上門計價規則待確認，交人手";
      const matches =
        this.state.remote_list?.filter((r) =>
          `${c.district} ${c.building}`.includes(r.place),
        ) || [];
      if (matches.length > 1) return "偏遠名單配對有歧義";
      if (matches.length) {
        const r = matches[0];
        c.remote_tier = r.tier;
        c.remote_list_version = r.list_version;
        c.nurse_travel_allowance = ["A", "B"].includes(r.tier)
          ? this.state.settings.nurse_travel_allowance
          : 0;
        if (["ADMIN", "NOT_SERVED", "UNMATCHED"].includes(r.tier))
          return "偏遠地區需要人工核對";
        if (r.tier === "B") {
          c.remote_review_required = true;
          return "B 級偏遠交通津貼需覆核";
        }
      } else if (/長洲|cheung chau/i.test(c.building)) {
        c.remote_tier = "A";
        c.nurse_travel_allowance = this.state.settings.nurse_travel_allowance;
        c.remote_list_version = "spec-C12-fixture";
      } else if (i.intake_version === "v3" && !i.remote_confirmed) {
        c.remote_tier = "UNMATCHED";
        return "完整偏遠名單未匯入；由管理員核對服務地點";
      }
      return null;
    }
    create(i) {
      return this.transaction(() => {
        if (
          i.visits !== undefined &&
          (!Array.isArray(i.visits) ||
            !i.visits.length ||
            i.visits.length > 30 ||
            i.visits.some(
              (v) =>
                !/^202[67]-\d{2}-\d{2}$/.test(v.date || "") ||
                !Number.isFinite(Date.parse(`${v.date}T00:00:00Z`)) ||
                new Date(`${v.date}T00:00:00Z`).toISOString().slice(0, 10) !==
                  v.date ||
                !/^([01]\d|2[0-3]):(00|30)$/.test(v.start || "") ||
                !/^([01]\d|2[0-3]):(00|30)$/.test(v.end || "") ||
                !["DAY", "NIGHT10", "NIGHT12"].includes(v.shift) ||
                (v.shift === "DAY"
                  ? v.start < "07:00" || v.end > "22:00" || v.start >= v.end
                  : v.start !== "22:00" ||
                    v.end !== (v.shift === "NIGHT10" ? "08:00" : "10:00")),
            ))
        )
          throw new Error("每次上門須填有效日期、時段及半小時時間");
        if (
          i.visits?.length &&
          (i.visits[0].date !== i.date ||
            i.visits[0].shift !== i.shift ||
            i.visits[0].start !== (i.shift === "DAY" ? i.start : "22:00") ||
            i.visits[0].end !==
              (i.shift === "DAY"
                ? i.end
                : i.shift === "NIGHT10"
                  ? "08:00"
                  : "10:00"))
        )
          throw new Error("首段上門資料須與主要服務時段相同");
        if (i.intake_version === "v3") {
          if (!i.patient_ref?.trim() || i.patient_ref.length > 100)
            throw new Error("請提供同一病人的固定代號");
          if (
            !["M", "F"].includes(i.gender) ||
            !Number.isInteger(Number(i.age)) ||
            Number(i.age) < 0 ||
            Number(i.age) > 120 ||
            !(Number(i.weight_kg) > 0) ||
            !(Number(i.height_cm) > 0) ||
            !i.mobility ||
            !i.companion ||
            !DISTRICTS.includes(i.district)
          )
            throw new Error(
              "請填妥性別、年齡、身高體重、十八區、行動能力及陪伴情況",
            );
          const b = i.services?.some(
            (s) =>
              SERVICE_CATALOG.find((x) => x.id === s.id)?.doctor_order_required,
          );
          if (b && !["YES", "NO", "UNSURE"].includes(i.doctor_order))
            throw new Error("B 類服務必須提供醫生指示狀態");
          for (const s of i.services || [])
            if (
              SERVICE_CATALOG.find((x) => x.id === s.id)?.replace_only &&
              !["YES", "NO_FIRST_INSERT", "UNSURE"].includes(
                i.existing_tubes?.[s.id] || i.existing_tube,
              )
            )
              throw new Error("每條喉管必須回答現有／首次插入／不確定");
        }
        const c = super.create({
          ...i,
          email: String(i.email || "").toLowerCase(),
        });
        let client = this.state.clients.find((x) => x.email === c.email);
        if (!client) {
          client = {
            id: `CLIENT-${this.state.clients.length + 1}`,
            email: c.email,
            created_at: this.stamp(),
          };
          this.state.clients.push(client);
        }
        c.client_id = client.id;
        this.email(c, "X01", c.email, "已收到查詢", "");
        return c;
      });
    }
    email(c, id, to, subject, body, links = []) {
      if (["T3", "T21"].includes(id))
        body = dispatchBody(c, this.state.settings);
      if (id === "T14m" && c.remote_review_required) id = "T14g";
      if (["T1", "T1b"].includes(id) && c.quote) {
        const active = this.state.packages?.find(
          (p) =>
            p.client_email === c.email &&
            p.patient_ref === (c.patient_ref || c.surname) &&
            p.status === "PKG_ACTIVE",
        );
        c.available_package_id = active?.id;
        c.package_offer_visible =
          !active &&
          this.state.settings.package_offer_rule === "WEEKDAY_DAY_LE30" &&
          c.shift === "DAY" &&
          !c.quote.surcharge &&
          c.quote.hours <= this.state.settings.package_hours;
        if (active) {
          id = "T1b";
          subject = `上門護理報價（套餐） – Case ${c.id}`;
          links = [
            this.token(c, "family", "accept_existing_package"),
            ...links.filter((l) => l.label !== "accept_single"),
          ];
          body = `你好，${c.surname}先生／女士。多謝你再次預約（Case ${c.id}）。\n服務：${c.date} ${c.start}–${c.end}\n服務內容：${c.services.map((s) => s.label).join("、")}\n套餐扣時：今次會由你嘅 30 小時套餐（${active.id}）扣 ${c.quote.hours} 小時（完成服務後先扣），而家可用 ${available(active)} 小時。\n如時數不足、夜間或假期規則未確認，將交人手核實，不會自動扣款。`;
        } else if (c.package_offer_visible) {
          links = [...links, this.token(c, "family", "accept_package")];
          body += `\n\n💡 ${this.state.settings.package_hours} 小時套餐優惠：一次過買 ${this.state.settings.package_hours} 小時日間服務，原價 HK$${this.state.settings.package_list_price.toLocaleString("en-HK")}，套餐價 HK$${this.state.settings.package_price}（慳 HK$${this.state.settings.package_discount}，平均約 HK$${(this.state.settings.package_price / this.state.settings.package_hours).toFixed(1)}／小時）。今次服務會由套餐扣 ${c.quote.hours} 小時，餘下 ${this.state.settings.package_hours - c.quote.hours} 小時可以下次預約用。`;
        }
        if (this.state.settings.quote_expiry)
          this.timer(
            c,
            "QUOTE_REMIND",
            this.state.settings.quote_reminder_hours,
          );
      }
      if (
        ["T9", "T9b"].includes(id) &&
        c.services.some((s) => s.doctor_order_required)
      ) {
        links = [...links, this.token(c, "family", "upload_doctor")];
        body +=
          c.intake_mode === "LIVE"
            ? "\n請透過以下連結上載醫生指示文件（PDF／PNG／JPEG，不超過 2 MB），供資深護士獨立核對。"
            : "\n請透過以下連結上載虛構醫生指示樣本（PDF／PNG／JPEG，不超過 2 MB），供資深護士獨立核對。";
      }
      if (id === "T4c")
        links = [...links, this.token(c, c.assigned_nurse, "drop")];
      if (id === "T17") links = [...links, this.token(c, "family", "cancel")];
      if (id === "T11" && this.state.settings.allow_arrival_completion)
        links = [
          ...links,
          ...["arrived", "visit_done", "drop"].map((a) =>
            this.token(c, c.assigned_nurse, a),
          ),
        ];
      if (id === "T11" && !links.some((l) => l.label === "drop"))
        links = [...links, this.token(c, c.assigned_nurse, "drop")];
      if (
        id === "T16" &&
        this.state.settings.unit_chase &&
        !c.unit_chase_scheduled
      ) {
        c.unit_chase_scheduled = true;
        this.timer(c, "UNIT_CHASE", this.state.settings.unit_chase_hours);
      }
      if (id === "T10") {
        const original = this.state.emails.findLast(
          (m) => m.case_id === c.id && ["T8", "T8b"].includes(m.template_id),
        );
        links = original?.links || [];
      }
      body = canonical(id, c, body);
      if (id === "T24" && this.state.settings.notify_data_deletion)
        body +=
          "\n請刪除先前收到的客人聯絡、地址及護理資料，並勿再使用相關資料。";
      super.email(c, id, to, subject, body, links);
      const mail = this.state.emails.at(-1);
      mail.template_version = TEMPLATE_VERSION;
      if (["T8", "T8b"].includes(id))
        this.event("payment.link_created", c, {
          amount: c.payment_amount ?? c.quote.total,
        });
      if (id === "T10b") this.event("payment.timeout", c);
      if (id.startsWith("T14"))
        this.event("admin.alert", c, { template_id: id });
      if (["T9", "T9b"].includes(id) && this.state.settings.dispatch_preview) {
        this.email(
          c,
          "T14",
          this.state.admin_email || "admin@example.test",
          `派單預覽 – Case ${c.id}`,
          `${dispatchBody(c, this.state.settings)}\n\n請登入工作台核對內容及薪酬後按「確認預覽並派單」。本信不會自動派單。`,
          [{ label: "開職員工作台", url: `${this.baseUrl}/#staff` }],
        );
      }
    }
    valid(t, c) {
      if (
        ["cancel", "report_fps"].includes(t.action) &&
        c.status === "PENDING_PAY" &&
        Date.parse(c.payment_deadline) <= this.now() &&
        c.payment_review_status !== "PENDING_REVIEW"
      )
        throw new Error("連結已失效；付款時限已過");
      if (t.action === "take_case" && this.startAt(c) <= this.now())
        throw new Error("連結已失效");
      const own = {
        report_fps: ["PENDING_PAY"],
        upload_doctor: ["PAID", "POSTED", "MATCHED"],
        accept_package: ["QUOTED"],
        accept_existing_package: ["QUOTED"],
        drop: ["MATCHED", "READY"],
        arrived: ["READY"],
        visit_done: ["IN_SERVICE"],
        cancel: [
          "PENDING_PAY",
          "PAID",
          "POSTED",
          "MATCHED",
          "READY",
          "IN_SERVICE",
        ],
        take_case: ["POSTED", "REMATCH", "MATCHED", "READY"],
        confirm_reminder: ["READY", "IN_SERVICE"],
      };
      if (own[t.action]) {
        if (
          t.used_at ||
          t.void_at ||
          Date.parse(t.expires_at) <= this.now() ||
          !own[t.action].includes(c.status)
        )
          throw new Error("連結已失效");
      } else super.valid(t, c);
      if (
        decisionActions.includes(t.action) &&
        t.quote_version !== c.quote_version
      )
        throw new Error("報價版本已失效");
      if (
        ["drop", "arrived", "visit_done", "confirm_reminder"].includes(
          t.action,
        ) &&
        t.actor !== c.assigned_nurse
      )
        throw new Error("此連結不屬於目前得標護士");
    }
    act(token, input = {}) {
      const previousToken = this.actionToken;
      this.actionToken = this.state.tokens.find((t) => t.token === token);
      try {
        return this.transaction(() => {
          const t = this.state.tokens.find((t) => t.token === token);
          const c = this.state.cases.find((c) => c.id === t?.case_id);
          if (!t || !c) throw new Error("連結已失效");
          this.valid(t, c);
          if (t.action === "take_case")
            this.event("nurse.click", c, {
              actor: "nurse",
              nurse: t.actor,
              click_ms: this.now(),
            });
          if (t.action === "modify")
            this.event("quote.modify_requested", c, { actor: "family" });
          if (t.action === "decline")
            this.event("quote.declined", c, { actor: "family" });
          if (t.action === "cancel")
            this.event("cancel.requested", c, {
              actor: "family",
              notice_hours: (this.startAt(c) - this.now()) / hour,
            });
          if (
            this.paymentMode === "bank_transfer" &&
            ["accept_single", "accept_package"].includes(t.action) &&
            !this.bankTransferConfigured()
          )
            throw new Error(
              "收款銀行資料未設定，請聯絡同事；暫時未能接受付款預約",
            );
          if (t.action === "upload_doctor")
            throw new Error("請使用文件上載表格");
          if (t.action === "report_fps") {
            if (this.now() > Date.parse(c.payment_deadline))
              throw new Error("提交轉帳資料期限已過，請聯絡管理員核對");
            if (!this.isManualTransfer())
              throw new Error("此個案不是 人手轉帳對數模式");
            const ref = String(input.reference || "").trim();
            const amount = Number(input.amount);
            const at = Date.parse(`${input.transferred_at}+08:00`);
            if (
              !ref ||
              ref.length > 100 ||
              !Number.isInteger(amount) ||
              amount <= 0 ||
              !Number.isFinite(at) ||
              at > this.now() + 60000 ||
              at < Math.floor(Date.parse(c.created_at) / 60000) * 60000
            )
              throw new Error(
                "請填有效參考編號、正整數金額及個案建立後的轉帳時間",
              );
            const submission = {
              id: randomUUID(),
              case_id: c.id,
              reference: ref,
              amount,
              transferred_at: new Date(at).toISOString(),
              submitted_at: this.stamp(),
              status: "PENDING_REVIEW",
              test_only: this.paymentMode === "fps_test",
            };
            this.state.payment_submissions.push(submission);
            c.payment_review_status = "PENDING_REVIEW";
            this.event("payment.fps_reported", c, {
              actor: "family",
              submission_id: submission.id,
              amount,
            });
            this.email(
              c,
              "T14",
              this.state.admin_email || "admin@example.test",
              `轉帳待對數 – Case ${c.id}`,
              `Case ${c.id} 客人已提交 轉帳資料。此為客人聲明；須由管理員核對銀行入帳後才可確認收款。`,
            );
            t.used_at = this.stamp();
            return "已收到轉帳資料，等候管理員對數。尚未確認收款，未派單。";
          }
          if (
            ["accept_package", "accept_existing_package"].includes(t.action)
          ) {
            this.event(
              `quote.accepted_${t.action === "accept_package" ? "package" : "existing_package"}`,
              c,
              { actor: "family", quote_version: c.quote_version },
            );
            this.acceptPackage(c, t.action);
            t.used_at = this.stamp();
            this.voidTokens(c, decisionActions);
            this.cancelTimers(c, ["QUOTE_REMIND", "QUOTE_EXPIRE"]);
            return "套餐預約已確認。";
          }
          if (t.action === "cancel" && !["PENDING_PAY"].includes(c.status)) {
            this.cancel(c);
            t.used_at = this.stamp();
            return "取消要求已記錄；請查看測試電郵及退款狀態。";
          }
          if (t.action === "drop") {
            if (!input.reason?.trim()) throw new Error("請填寫放飛原因");
            this.drop(c, input.reason);
            t.used_at = this.stamp();
            return "已記錄並安排重新配對。";
          }
          if (["arrived", "visit_done"].includes(t.action)) {
            if (!this.state.settings.allow_arrival_completion)
              throw new Error("尚未啟用到達／完成確認");
            if (t.action === "arrived") {
              if (this.now() < this.startAt(c))
                throw new Error("尚未到服務開始時間");
              this.transition(c, "IN_SERVICE");
              c.arrived_at = this.stamp();
              this.event("visit.arrived", c, {
                actor: "nurse",
                nurse: t.actor,
              });
            } else this.complete(c);
            t.used_at = this.stamp();
            return "已確認，謝謝。";
          }
          if (t.action === "take_case") {
            const n = this.state.nurses.find((n) => n.id === t.actor);
            if (n && eligibleNurse(n, this.live) && !c.assigned_nurse) {
              if (c.dropped_nurses?.includes(n.id))
                throw new Error("原放飛護士不能重新接同一個案");
              const clash = this.state.cases.some(
                (o) =>
                  o.id !== c.id &&
                  o.assigned_nurse === n.id &&
                  ["MATCHED", "READY", "IN_SERVICE"].includes(o.status) &&
                  this.startAt(o) < this.endAt(c) &&
                  this.endAt(o) > this.startAt(c),
              );
              if (clash) {
                this.event("lock.lost", c, { nurse: n.id, reason: "CLASH" });
                t.used_at = this.stamp();
                return "服務時段與現有個案重疊，未能接單。";
              }
            }
          }
          const hadUnit = c.address_status === "PROVIDED";
          const result = super.act(token, input);
          if (
            t.action === "take_case" &&
            hadUnit &&
            c.assigned_nurse === t.actor
          )
            c.address_status = "PROVIDED";
          if (t.action === "accept_single") {
            c.order_type = "SINGLE";
            c.payment_amount = c.quote.total;
            this.voidTokens(c, decisionActions);
            this.cancelTimers(c, ["QUOTE_REMIND", "QUOTE_EXPIRE"]);
          }
          if (
            t.action === "decline" ||
            (t.action === "cancel" && c.status === "CANCELLED")
          ) {
            c.cancel_type = "CLIENT_BEFORE_PAY";
            this.release(c);
            this.cancelAll(c);
          }
          if (t.action === "modify") {
            this.voidTokens(c, decisionActions);
            this.cancelTimers(c, ["QUOTE_REMIND", "QUOTE_EXPIRE"]);
            this.email(c, "X04", c.email, "收到修改要求", "");
          }
          if (t.action === "take_case") {
            c.applicants ??= [];
            c.applicants.push({
              nurse_id: t.actor,
              at: this.stamp(),
              result: c.assigned_nurse === t.actor ? "WON" : "LOST",
            });
            if (c.assigned_nurse === t.actor) {
              c.matched_at = this.stamp();
              c.nurse_history ??= [];
              c.nurse_history.push({
                nurse_id: t.actor,
                matched_at: this.stamp(),
              });
              this.cancelTimers(c, [
                "REMATCH_EXPIRE",
                "NO_TAKER",
                "NO_TAKER_REPEAT",
              ]);
              if (this.state.settings.notify_others)
                for (const n of this.state.nurses.filter(
                  (n) => n.status === "VERIFIED" && n.id !== t.actor,
                ))
                  this.email(c, "T5", n.email, `Case ${c.id} 已俾人做`, "");
              this.ready(c);
            }
          }
          if (t.action === "provide_unit")
            this.cancelTimers(c, ["UNIT_CHASE", "UNIT_ALERT"]);
          return result;
        });
      } finally {
        this.actionToken = previousToken;
      }
    }
    startAt(c) {
      return Date.parse(`${c.date}T${c.start}:00+08:00`);
    }
    endAt(c) {
      return (
        this.startAt(c) +
        (c.shift === "DAY"
          ? (Number(c.end.slice(0, 2)) * 60 +
              Number(c.end.slice(3)) -
              Number(c.start.slice(0, 2)) * 60 -
              Number(c.start.slice(3))) *
            60000
          : this.state.settings.night_options[c.shift].hours * hour)
      );
    }
    ledger(p, c, type, hours, reason = "") {
      this.state.ledger_entries.push({
        id: randomUUID(),
        package_id: p.id,
        case_id: c?.id,
        at: this.stamp(),
        actor: "system",
        type,
        hours,
        balance_after: p.hours_total - p.hours_used,
        available_after: available(p),
        reason,
      });
      this.event("package." + type.toLowerCase(), c, {
        package_id: p.id,
        hours,
      });
    }
    reserve(p, c) {
      if (available(p) < c.quote.hours)
        throw new Error("套餐可用時數不足，請交人手");
      p.hours_reserved += c.quote.hours;
      c.package_id = p.id;
      c.package_hours = c.quote.hours;
      c.reservation_status = "RESERVED";
      this.ledger(p, c, "RESERVE", c.quote.hours);
    }
    release(c) {
      const p = this.state.packages.find((p) => p.id === c.package_id);
      if (!p || c.reservation_status !== "RESERVED") return;
      p.hours_reserved -= c.package_hours;
      c.reservation_status = "RELEASED";
      if (p.status === "PKG_PENDING_PAY") p.status = "PKG_PAY_TIMEOUT";
      this.ledger(p, c, "RELEASE", c.package_hours);
    }
    acceptPackage(c, action) {
      if (action === "accept_package") {
        if (!c.package_offer_visible) throw new Error("此報價不適用套餐");
        const p = {
          id: `P2026-${String(this.state.packages.length + 1).padStart(4, "0")}`,
          client_email: c.email,
          patient_ref: c.patient_ref || c.surname,
          purchase_case_id: c.id,
          hours_total: this.state.settings.package_hours,
          hours_used: 0,
          hours_reserved: 0,
          price: this.state.settings.package_price,
          status: "PKG_PENDING_PAY",
          created_at: this.stamp(),
        };
        this.state.packages.push(p);
        this.reserve(p, c);
        c.order_type = "PACKAGE_NEW";
        c.payment_amount = p.price;
        this.beginPayment(c);
      } else {
        const p = this.state.packages.find(
          (p) => p.id === c.available_package_id,
        );
        if (
          !p ||
          p.status !== "PKG_ACTIVE" ||
          p.client_email !== c.email ||
          p.patient_ref !== (c.patient_ref || c.surname)
        )
          throw new Error("找不到相同病人的有效套餐");
        if (
          c.shift !== "DAY" ||
          c.quote.surcharge ||
          available(p) < c.quote.hours
        ) {
          this.manual(c, "套餐夜間／假期／不足時數規則待確認");
          return;
        }
        this.reserve(p, c);
        c.order_type = "PACKAGE_EXISTING";
        c.payment_amount = 0;
        this.transition(c, "PAID");
        c.paid_at = this.stamp();
        this.event("payment.package_covered", c);
        if (c.services.some((s) => s.doctor_order_required))
          this.email(
            c,
            "T9b",
            c.email,
            "套餐預留及醫生指示樣本",
            `Case ${c.id} 已預留套餐時數，請上載虛構醫生指示樣本。`,
            [],
          );
      }
    }
    isManualTransfer() {
      return ["bank_transfer", "fps_test"].includes(this.paymentMode);
    }
    bankTransferConfigured() {
      return !!(
        this.bankName &&
        this.bankAccountName &&
        this.bankAccountNumber
      );
    }
    beginPayment(c) {
      if (
        this.paymentMode === "bank_transfer" &&
        !this.bankTransferConfigured()
      )
        throw new Error("收款銀行資料未設定，請聯絡同事；暫時未能接受付款預約");
      this.transition(c, "PENDING_PAY");
      c.payment_deadline = new Date(
        this.now() +
          (this.state.settings.payment_window_hours * hour) /
            this.state.settings.time_scale,
      ).toISOString();
      this.timer(c, "PAY_REMIND", this.state.settings.payment_reminder_hours);
      this.timer(c, "PAY_EXPIRE", this.state.settings.payment_window_hours);
      if (this.paymentMode === "mock") this.paymentEmail(c);
      else if (this.isManualTransfer()) this.paymentEmail(c);
      else c.checkout_pending = true;
    }
    paymentEmail(c) {
      if (this.isManualTransfer()) {
        if (
          this.paymentMode === "bank_transfer" &&
          !this.bankTransferConfigured()
        )
          throw new Error("收款銀行資料未設定，不能發出付款指示");
        const instructions =
          this.paymentMode === "bank_transfer"
            ? `銀行：${this.bankName}\n收款戶名：${this.bankAccountName}\n銀行戶口號碼：${this.bankAccountNumber}\n請人手轉帳，並提交轉帳參考編號、金額及時間。`
            : `FPS 測試收款識別：${this.fpsRecipient || "未設定；請先聯絡管理員"}\n測試戶名：${this.fpsAccountName || "未設定"}\n【TRL 3 模擬測試，請勿實際轉帳】使用虛構轉帳參考編號。`;
        const amount = c.payment_amount ?? c.quote.total;
        this.email(
          c,
          c.order_type === "PACKAGE_NEW" ? "T8b" : "T8",
          c.email,
          `人手轉帳及對數 – Case ${c.id}`,
          `你好，Case ${c.id} 報價已確認${c.order_type === "PACKAGE_NEW" ? "，你揀咗 30 小時套餐" : ""}。
應付 HK$${amount}。請於 ${new Date(c.payment_deadline).toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong" })} HKT 前提交轉帳資料。
${instructions}
提交後會由同事人手核對入帳；只有確認收款後才會安排派單。
逾時未有提交，預約會自動取消。期限前已提交而仍待對數會交人工核對，不會當已付款。`,
          [
            this.token(c, "family", "report_fps"),
            this.token(c, "family", "cancel"),
          ],
        );
        return;
      }
      const amount = c.payment_amount ?? c.quote.total;
      this.email(
        c,
        c.order_type === "PACKAGE_NEW" ? "T8b" : "T8",
        c.email,
        `付款連結 – Case ${c.id}`,
        `你好，Case ${c.id} 報價已確認，${c.order_type === "PACKAGE_NEW" ? "你揀咗 30 小時套餐。" : ""}請喺 ${new Date(c.payment_deadline).toLocaleString("zh-HK", { timeZone: "Asia/Hong_Kong" })} HKT 前（24 小時內）按以下連結付清 HK$${amount}：${c.checkout_url || "本機模擬付款（非 Stripe）"}\n付款後我哋會即刻為你安排護士。逾時未付，預約會自動取消。`,
        [
          ...(c.checkout_url
            ? [{ label: "Stripe test Checkout", url: c.checkout_url }]
            : []),
          this.token(c, "family", "cancel"),
        ],
      );
    }
    paid(c) {
      return this.transaction(() => {
        if (this.isManualTransfer() && !c.fps_reconciliation_authorized)
          throw new Error("人手轉帳必須經管理員對數，不可直接標記付款");
        if (
          c.status !== "PENDING_PAY" ||
          (Date.parse(c.payment_deadline) <= this.now() &&
            !c.fps_reconciliation_authorized)
        )
          throw new Error("付款時限已過或狀態不符");
        this.transition(c, "PAID");
        c.paid_at = this.stamp();
        c.amount_paid = c.payment_amount ?? c.quote.total;
        this.cancelTimers(c, ["PAY_REMIND", "PAY_EXPIRE"]);
        this.voidTokens(c, ["cancel"]);
        const p = this.state.packages.find((p) => p.id === c.package_id);
        if (p && c.order_type === "PACKAGE_NEW") {
          p.status = "PKG_ACTIVE";
          p.paid_at = this.stamp();
          this.ledger(p, c, "PURCHASE", p.hours_total);
        }
        this.event("payment.received", c, { provider: this.paymentMode });
        this.email(
          c,
          p ? "T9b" : "T9",
          c.email,
          `已收到付款 – Case ${c.id}`,
          p
            ? `已收到你嘅付款 HK$${c.amount_paid}，多謝。你嘅 30 小時套餐（${p.id}）已生效，購買日期：${p.paid_at}。今次 Case ${c.id} 已預留 ${c.package_hours} 小時，完成服務後先扣。我哋而家幫你搵護士，配對後會通知你。`
            : `已收到你嘅付款 HK$${c.amount_paid}（Case ${c.id}），多謝。我哋而家幫你搵護士，配對後會通知你。`,
          [this.token(c, "family", "cancel")],
        );
      });
    }
    dispatch(c) {
      return this.transaction(() => {
        if (c.remote_review_required && !c.remote_reviewed_by)
          throw new Error("請先覆核 B 級交通津貼");
        if (this.live && !this.state.nurses.some((n) => eligibleNurse(n, true)))
          throw new Error("尚未有已核實資格的護理員，不能派單");
        super.dispatch(c);
        c.posted_at = this.stamp();
        c.repost_count = 0;
        const rate =
          c.shift === "DAY"
            ? this.state.settings.nurse_day_rate
            : this.state.settings.nurse_night_rate;
        c.nurse_pay_total =
          rate * c.quote.hours + (c.nurse_travel_allowance || 0);
        if (this.state.settings.pre_service_alerts) {
          this.absoluteTimer(c, "NO_NURSE_START", this.startAt(c));
          this.absoluteTimer(
            c,
            "PRE_SERVICE",
            this.startAt(c) -
              this.state.settings.pre_service_alert_hours * hour,
          );
          this.absoluteTimer(
            c,
            "UNIT_ALERT",
            this.startAt(c) - this.state.settings.unit_alert_hours * hour,
          );
        }
      });
    }
    absoluteTimer(c, type, at) {
      this.state.timers.push({
        id: randomUUID(),
        case_id: c.id,
        type,
        start_at: this.stamp(),
        timer_code: TIMER_CODES[type] || type,
        time_scale: this.state.settings.time_scale,
        due_at: new Date(
          this.now() +
            Math.max(0, at - this.now()) / this.state.settings.time_scale,
        ).toISOString(),
      });
    }
    cancelAll(c) {
      this.cancelTimers(c, [
        ...new Set(
          this.state.timers
            .filter((t) => t.case_id === c.id)
            .map((t) => t.type),
        ),
      ]);
      for (const t of this.state.tokens)
        if (t.case_id === c.id && !t.used_at) t.void_at = this.stamp();
    }
    requestRefund(c, reason) {
      if (c.package_id && !this.state.settings.package_release) {
        this.manual(c, "套餐取消預留時數釋放政策待確認");
        return;
      }
      this.transition(c, "FULL_REFUND");
      this.cancelAll(c);
      c.cancel_type = reason;
      c.refund_amount =
        c.order_type === "PACKAGE_EXISTING"
          ? 0
          : (c.amount_paid ?? c.payment_amount ?? c.quote.total);
      c.refund_status = "PENDING";
      if (c.package_id) c.refund_amount = 0;
      this.event("refund.requested", c, { amount: c.refund_amount, reason });
    }
    cancel(c) {
      const notice = (this.startAt(c) - this.now()) / hour;
      c.cancel_requested_at = this.stamp();
      c.notice_hours = notice;
      if (
        ["MATCHED", "READY"].includes(c.status) &&
        notice >= this.state.settings.cancellation_free_hours
      ) {
        const n = this.state.nurses.find((n) => n.id === c.assigned_nurse);
        this.requestRefund(c, "CLIENT_GE24H");
        if (c.status === "FULL_REFUND") {
          this.email(
            c,
            "T15",
            c.email,
            "取消／改期確認",
            `你好，Case ${c.id} ${c.date} 嘅服務已取消。\n今次唔收任何費用。\n${c.package_id ? "預留套餐時數將於管理員批核後放回。" : `退款 HK$${c.refund_amount} 待管理員批核；到帳日數由支付服務確定。`}`,
          );
          this.email(c, "T24", n.email, "客人已取消", "");
        }
      } else
        this.manual(
          c,
          c.status === "POSTED" || c.status === "PAID"
            ? "未配對取消規則待確認"
            : notice < this.state.settings.cancellation_free_hours
              ? "少於 24 小時取消費未確認"
              : "服務開始後取消，交人手",
        );
    }
    rejectFPS(c, i) {
      return this.transaction(() => {
        if (
          !this.isManualTransfer() ||
          c.status !== "PENDING_PAY" ||
          !i.reason?.trim()
        )
          throw new Error("請填寫 轉帳核對不符原因");
        const sub = this.state.payment_submissions.find(
          (s) =>
            s.id === i.submission_id &&
            s.case_id === c.id &&
            s.status === "PENDING_REVIEW",
        );
        if (!sub) throw new Error("找不到待核對轉帳聲明");
        sub.status = "REJECTED";
        sub.reviewed_at = this.stamp();
        sub.reviewed_by = this.operatorId("admin");
        c.payment_review_status = this.state.payment_submissions.some(
          (s) => s.case_id === c.id && s.status === "PENDING_REVIEW",
        )
          ? "PENDING_REVIEW"
          : "REJECTED";
        this.event("payment.fps_rejected", c, {
          actor: "admin",
          submission_id: sub.id,
        });
        this.email(
          c,
          "T14",
          this.state.admin_email || "admin@example.test",
          "轉帳對數不符，交人手",
          `Case ${c.id} 轉帳資料與銀行入帳不符，需要人手聯絡客人。未確認前不得派單。`,
        );
        if (c.payment_review_status === "REJECTED") {
          if (this.now() >= Date.parse(c.payment_deadline)) {
            this.transition(c, "PAY_TIMEOUT");
            this.release(c);
            this.cancelAll(c);
            this.email(
              c,
              "T10b",
              c.email,
              "預約已自動取消",
              `你好，由於 Case ${c.id} 未有喺 ${c.payment_deadline} 前確認有效付款，預約已取消。如已轉帳請聯絡同事核對，避免重複轉帳。`,
            );
          } else {
            this.paymentEmail(c);
          }
        }
      });
    }
    reconcileFPS(c, i) {
      return this.transaction(() => {
        if (!this.isManualTransfer() || c.status !== "PENDING_PAY")
          throw new Error("只可對數待付款轉帳個案");
        const submission = this.state.payment_submissions.find(
          (s) =>
            s.id === i.submission_id &&
            s.case_id === c.id &&
            s.status === "PENDING_REVIEW",
        );
        if (!submission || i.verified !== true || !i.reason?.trim())
          throw new Error("請選擇轉帳聲明，勾選已核對銀行入帳並填寫對數說明");
        const bankRef = String(i.bank_reference || "").trim();
        const amount = Number(i.amount);
        const at = Date.parse(i.received_at);
        if (
          !bankRef ||
          bankRef.length > 100 ||
          amount !== (c.payment_amount ?? c.quote.total) ||
          !Number.isFinite(at) ||
          at > this.now() + 60000 ||
          at < Math.floor(Date.parse(c.created_at) / 60000) * 60000
        )
          throw new Error(
            "入帳參考、時間或金額不符，請交人工處理；不可當作全數付款",
          );
        if (
          this.state.payment_reconciliations.some(
            (r) => r.bank_reference.toLowerCase() === bankRef.toLowerCase(),
          )
        )
          throw new Error("此銀行入帳參考已用於其他對數，請勿重複使用");
        if (at > Date.parse(c.payment_deadline))
          throw new Error("入帳時間超過付款期限，請交人工處理");
        const r = {
          id: randomUUID(),
          case_id: c.id,
          submission_id: submission.id,
          bank_reference: bankRef,
          amount,
          received_at: new Date(at).toISOString(),
          verified_at: this.stamp(),
          verified_by: this.operatorId("admin"),
          note: i.reason,
          test_only: this.paymentMode === "fps_test",
        };
        this.state.payment_reconciliations.push(r);
        submission.status = "VERIFIED";
        c.fps_reconciliation_id = r.id;
        c.fps_reconciliation_authorized = true;
        this.paid(c);
        delete c.fps_reconciliation_authorized;
        c.payment_review_status = "VERIFIED";
        this.voidTokens(c, ["report_fps"]);
        this.event("payment.fps_reconciled", c, {
          actor: "admin",
          reconciliation_id: r.id,
          amount,
        });
      });
    }
    recordFPSRefund(c, i) {
      return this.transaction(() => {
        if (
          !this.isManualTransfer() ||
          c.status !== "FULL_REFUND" ||
          c.refund_status !== "APPROVED"
        )
          throw new Error("請先批核轉帳退款");
        const ref = String(i.bank_reference || "").trim();
        const amount = Number(i.amount);
        const at = Date.parse(i.received_at);
        if (
          i.verified !== true ||
          !ref ||
          ref.length > 100 ||
          amount !== c.refund_amount ||
          !Number.isFinite(at) ||
          at > this.now() + 60000 ||
          at < Math.floor(Date.parse(c.refund_approved_at) / 60000) * 60000 ||
          !i.reason?.trim()
        )
          throw new Error("請核實實際退款轉帳金額、參考、時間及說明");
        if (
          this.state.cases.some(
            (o) =>
              o.id !== c.id &&
              o.fps_refund_reference?.toLowerCase() === ref.toLowerCase(),
          )
        )
          throw new Error("退款參考編號已使用");
        c.fps_refund_reference = ref;
        c.fps_refund_at = new Date(at).toISOString();
        c.fps_refund_recorded_by = this.operatorId("admin");
        this.finishRefund(
          c,
          this.paymentMode === "bank_transfer" ? "bank_transfer" : "fps_manual",
          ref,
        );
        this.event("refund.fps_recorded", c, { actor: "admin", amount });
      });
    }
    approveRefund(c) {
      return this.transaction(() => {
        if (c.status !== "FULL_REFUND" || c.refund_status !== "PENDING")
          throw new Error("沒有待批核退款");
        c.refund_approved_by = this.operatorId("admin");
        c.refund_status = "APPROVED";
        c.refund_approved_at = this.stamp();
        this.event("refund.approved", c, { actor: "admin" });
        if (c.refund_amount === 0) this.finishRefund(c, "package_release");
        else if (this.paymentMode === "mock") this.finishRefund(c, "mock");
        else if (this.paymentMode === "stripe_test") c.refund_pending = true;
      });
    }
    finishRefund(c, provider, ref) {
      if (c.refund_status !== "APPROVED" || c.status !== "FULL_REFUND")
        throw new Error("退款狀態不符");
      this.release(c);
      c.refund_status = "DONE";
      c.refunded_at = this.stamp();
      c.refund_provider = provider;
      if (provider === "stripe_test") c.stripe_refund_id = ref;
      this.transition(c, "CANCELLED");
      this.event("refund.completed", c, { provider, amount: c.refund_amount });
    }
    drop(c, reason) {
      const n = this.state.nurses.find((n) => n.id === c.assigned_nurse);
      if (this.startAt(c) <= this.now())
        throw new Error("服務已開始，請聯絡管理員");
      n.drop_count = (n.drop_count || 0) + 1;
      n.drop_log ??= [];
      n.drop_log.push({
        case_id: c.id,
        at: this.stamp(),
        hours_before_start: (this.startAt(c) - this.now()) / hour,
        reason,
      });
      c.dropped_nurses ??= [];
      c.dropped_nurses.push(n.id);
      this.voidTokens(c, [
        "take_case",
        "drop",
        "arrived",
        "visit_done",
        "confirm_reminder",
      ]);
      if (this.state.settings.notify_data_deletion)
        this.email(
          c,
          "T22",
          n.email,
          "請刪除客人資料",
          "你已不再負責此個案。請刪除先前收到的客人聯絡、地址及護理資料，並勿再使用相關資料。",
        );
      c.assigned_nurse = null;
      this.event("nurse.dropped", c, { nurse: n.id, drop_count: n.drop_count });
      if (n.drop_count >= this.state.settings.max_drop_strikes) {
        n.status = "SUSPENDED";
        this.event("nurse.suspended", c, {
          nurse: n.id,
          drop_count: n.drop_count,
        });
        this.email(
          c,
          "T14f",
          this.state.admin_email || "admin@example.test",
          "護士三次放飛",
          `護士 ${n.id} 放飛累計 3 次，已暫停，請確認列入黑名單。`,
        );
        this.email(
          c,
          "T23",
          n.email,
          "接單資格暫停",
          "你好，由於累計放飛 3 次，你嘅接單資格已暫停。如有疑問請聯絡管理員。",
        );
      } else
        this.email(
          c,
          "T22",
          n.email,
          "放飛記錄",
          `你好，已記錄你放飛 Case ${c.id}，累計 ${n.drop_count}／3 次。累計 3 次將無法再接單。`,
        );
      if (
        (this.startAt(c) - this.now()) / hour <
        this.state.settings.rematch_window_hours
      ) {
        this.manual(c, "護士於服務前不足 24 小時放飛，期限待確認");
        return;
      }
      this.transition(c, "REMATCH");
      this.timer(c, "REMATCH_EXPIRE", this.state.settings.rematch_window_hours);
      c.rematch_deadline = this.state.timers.at(-1).due_at;
      this.repost(c, true);
      this.email(
        c,
        "T19",
        c.email,
        "護士有變，重新配對中",
        `你好，Case ${c.id} 原定護士因事未能上門，我哋已即時重新安排護士，有消息會即時通知你。如 ${c.rematch_deadline} 前未能安排，會全數退款俾你。`,
      );
      this.email(
        c,
        "T14e",
        this.state.admin_email || "admin@example.test",
        "護士放飛",
        `護士 ${n.id} 放飛，已重新發大群（第 ${n.drop_count} 次）。`,
      );
    }
    repost(c, rematch = false) {
      if (!["POSTED", "REMATCH"].includes(c.status))
        throw new Error("個案不在招募中");
      c.repost_count = (c.repost_count || 0) + 1;
      for (const n of this.state.nurses.filter(
        (n) => eligibleNurse(n, this.live) && !c.dropped_nurses?.includes(n.id),
      ))
        this.email(
          c,
          rematch ? "T21" : "T3",
          n.email,
          `新 Case ${c.id}（${rematch ? "重新" : "再次"}招募）`,
          `📋 Case ${c.id}\n日期時間：${c.date} ${c.start}–${c.end}\n薪酬：HK$${c.shift === "DAY" ? this.state.settings.nurse_day_rate : this.state.settings.nurse_night_rate}／小時\n地區／大廈：${c.district} ${c.building}\n照顧重點：${c.services.map((s) => `${s.label} ${s.prn ? "按需要" : s.times.join("、")}`).join("；")}\n先到先得，有興趣請撳以下掣：`,
          [this.token(c, n.id, "take_case")],
        );
      this.event("dispatch.reposted", c, { rematch });
    }
    complete(c) {
      if (this.now() < this.endAt(c)) throw new Error("尚未到服務結束時間");
      this.transition(c, "DONE");
      c.completed_at = this.stamp();
      for (const v of c.visits || []) v.status = "DONE";
      this.cancelAll(c);
      const p = this.state.packages.find((p) => p.id === c.package_id);
      if (p && c.reservation_status === "RESERVED") {
        p.hours_reserved -= c.package_hours;
        p.hours_used += c.package_hours;
        c.reservation_status = "DEDUCTED";
        this.ledger(p, c, "DEDUCT", c.package_hours);
        const remaining = p.hours_total - p.hours_used;
        this.email(
          c,
          "T28",
          c.email,
          "套餐扣時",
          `你好，Case ${c.id} ${c.date} 嘅服務已完成，套餐（${p.id}）扣咗 ${c.package_hours} 小時，餘額 ${remaining} 小時。`,
        );
        if (
          remaining > 0 &&
          remaining <= this.state.settings.package_low_balance_hours &&
          !p.low_balance_notified_at
        ) {
          p.low_balance_notified_at = this.stamp();
          this.event("package.low_balance", c, { package_id: p.id, remaining });
          this.email(
            c,
            "T29",
            c.email,
            "套餐餘額不足",
            `你好，提提你，你嘅 30 小時套餐（${p.id}）只剩 ${remaining} 小時。之後預約如果時數唔夠，不足部分會按單次價計。如想再買套餐，下次報價時撳「30 小時套餐」掣就得。`,
          );
        }
        if (remaining === 0) {
          p.status = "PKG_USED_UP";
          p.used_up_notified_at = this.stamp();
          this.event("package.used_up", c, { package_id: p.id, remaining });
          this.email(
            c,
            "T30",
            c.email,
            "套餐已用完",
            `你好，你嘅 30 小時套餐（${p.id}）已經用完，多謝支持。之後預約會按單次價報價，報價時亦可以揀再買一個新套餐。`,
          );
        }
      }
      const rate =
        c.shift === "DAY"
          ? this.state.settings.nurse_day_rate
          : this.state.settings.nurse_night_rate;
      this.state.payouts.push({
        id: randomUUID(),
        case_id: c.id,
        nurse_id: c.assigned_nurse,
        base_pay: rate * c.quote.hours,
        travel_allowance: c.nurse_travel_allowance || 0,
        total: rate * c.quote.hours + (c.nurse_travel_allowance || 0),
        status: "PENDING",
        no_transfer: true,
      });
      this.event("visit.completed", c, {
        actor: "nurse",
        nurse: c.assigned_nurse,
      });
    }
    adminCase(c, action, i = {}) {
      return this.transaction(() => {
        if (action === "doctor_upload_link") {
          if (
            !["PAID", "POSTED", "MATCHED"].includes(c.status) ||
            c.schedule_status !== "PENDING_REVIEW" ||
            !c.services.some((s) => s.doctor_order_required)
          )
            throw new Error("只可為待覆核個案重發文件上載連結");
          this.voidTokens(c, ["upload_doctor"]);
          this.email(c, "X03", c.email, "請上載醫生指示樣本", "", [
            this.token(c, "family", "upload_doctor"),
          ]);
          return;
        }
        if (action === "refund") return this.approveRefund(c);
        if (action === "manual_refund") {
          if (
            c.status !== "MANUAL" ||
            !i.reason?.trim() ||
            !(c.amount_paid > 0 || c.order_type === "PACKAGE_EXISTING")
          )
            throw new Error("只可為已付款人工個案提出退款，並須填決定原因");
          this.requestRefund(c, "ADMIN_MANUAL_DECISION");
          this.event("refund.manual_decision", c, { actor: "admin" });
          if (c.status === "FULL_REFUND") {
            this.email(
              c,
              "T15",
              c.email,
              "人工取消及退款待批核",
              `Case ${c.id} 已由管理員決定取消。${c.package_id ? "預留套餐時數待批核後放回。" : `退款 HK$${c.refund_amount} 待批核及人手轉帳，尚未完成退款。`}`,
            );
            const nurse = this.state.nurses.find(
              (n) => n.id === c.assigned_nurse,
            );
            if (nurse) this.email(c, "T24", nurse.email, "服務已取消", "");
          }
          return;
        }
        if (action === "repost") return this.repost(c, c.status === "REMATCH");
        if (action === "remote") {
          if (!["MANUAL", "QUOTED", "PAID"].includes(c.status))
            throw new Error("只能在派單前覆核交通津貼");
          if (!["A", "B", "C"].includes(i.tier) || !i.reason?.trim())
            throw new Error("請選擇地區分類並填覆核原因");
          c.remote_tier = i.tier;
          c.nurse_travel_allowance =
            i.tier === "C" ? 0 : this.state.settings.nurse_travel_allowance;
          c.remote_reviewed_by = this.operatorId("admin");
          c.remote_review_required = false;
          this.event("remote.reviewed", c, { actor: "admin", tier: i.tier });
          return;
        }
        if (action === "correct_intake") {
          if (c.intake_channel === "conversation")
            throw new Error("文字查詢須另建完整服務安排");
          if (
            c.status !== "MANUAL" ||
            c.amount_paid ||
            c.package_id ||
            !i.reason?.trim()
          )
            throw new Error("只可更正未收款人工個案，並須填更正原因");
          if (!["YES", "NO", "UNSURE", "NA"].includes(i.doctor_order))
            throw new Error("醫生指示狀態無效");
          if (
            c.services.some((s) => s.doctor_order_required) &&
            i.doctor_order === "NA"
          )
            throw new Error("B 類服務必須回答醫生指示狀態");
          const replacements = c.services.filter((s) => s.replace_only);
          if (
            replacements.some(
              (s) =>
                !["YES", "NO_FIRST_INSERT", "UNSURE"].includes(
                  i.existing_tubes?.[s.id],
                ),
            )
          )
            throw new Error("每條喉管必須回答現有／首次插入／不確定");
          c.intake_corrections ??= [];
          c.intake_corrections.push({
            at: this.stamp(),
            by: this.operatorId("admin"),
            reason: i.reason,
            before: {
              doctor_order: c.doctor_order,
              existing_tubes: c.existing_tubes,
            },
          });
          c.doctor_order = i.doctor_order;
          c.doctor_order_status =
            i.doctor_order === "YES" ? "PENDING_CHECK" : "NA";
          c.existing_tubes = Object.fromEntries(
            replacements.map((s) => [s.id, i.existing_tubes[s.id]]),
          );
          for (const service of replacements)
            service.existing_tube = c.existing_tubes[service.id];
          this.voidTokens(c, decisionActions);
          this.event("case.intake_corrected", c, {
            actor: "admin",
            fields: ["doctor_order", "existing_tubes"],
          });
          return;
        }
        if (action === "issue_quote") {
          if (c.intake_channel === "conversation")
            throw new Error(
              "文字查詢須先由同事核實資料，並另建完整服務安排後才可報價",
            );
          if (c.amount_paid || c.package_id)
            throw new Error(
              "已付款／套餐個案不可重新發付款報價；請先處理人工服務或退款",
            );
          if (c.status !== "MANUAL" || !i.reason?.trim())
            throw new Error("請填寫人工處理原因");
          if (c.red_flag || hasRedFlag(c)) {
            c.red_flag = true;
            if (
              i.red_flag_resolved !== true ||
              typeof i.red_flag_resolution !== "string" ||
              i.red_flag_resolution.trim().length < 10
            )
              throw new Error(
                "紅旗個案必須先記錄至少 10 字嘅臨床處置／轉介結果，並明確確認已解除報價阻擋",
              );
            c.red_flag_resolution = i.red_flag_resolution.trim();
            c.red_flag_resolved_at = this.stamp();
            c.red_flag_resolved_by = this.operatorId("admin");
            this.event("clinical.red_flag_resolved", c, {
              actor: "admin",
              reason: c.red_flag_resolution,
            });
          }
          if (
            c.services.some((s) => s.pending) ||
            (c.services.some((s) => s.doctor_order_required) &&
              c.doctor_order !== "YES" &&
              c.doctor_order !== "VERIFIED") ||
            c.services.some((s) => s.replace_only && s.existing_tube !== "YES")
          )
            throw new Error(
              "未解決服務分類／醫生指示／現有喉管問題，不可強行報價",
            );
          if (c.remote_tier === "UNMATCHED")
            throw new Error("請先覆核偏遠地區");
          if (c.visits?.length > 1)
            throw new Error(
              "多次上門／日夜組合規則待確認，須分開建立完整服務安排",
            );
          const calculated = this.quote(c);
          if (calculated.manual) throw new Error(calculated.manual);
          c.quote = calculated;
          this.event("quote.calculated", c, {
            quote_total: calculated.total,
            lines: calculated,
          });
          this.voidTokens(c, decisionActions);
          c.quote_version++;
          this.transition(c, "QUOTED");
          this.email(
            c,
            "T1",
            c.email,
            "上門護理報價",
            quoteBody(c, this.state.settings),
            decisionActions
              .filter(
                (a) =>
                  a !== "accept_package" && a !== "accept_existing_package",
              )
              .map((a) => this.token(c, "family", a)),
          );
          this.event("manual.resolved", c, { actor: "admin" });
          return;
        }
        if (action === "doctor_failed") {
          if (!["PAID", "POSTED", "MATCHED", "READY"].includes(c.status))
            throw new Error("只可在服務前覆核階段記錄醫生指示失敗");
          c.doctor_order_status = "FAILED";
          this.manual(c, "醫生指示核對失敗");
          return;
        }
        if (action === "schedule_edit") {
          if (
            !["PAID", "POSTED", "MATCHED"].includes(c.status) ||
            !Array.isArray(i.schedule) ||
            !i.reason?.trim()
          )
            throw new Error("請於覆核前提供時間表及修改原因");
          const names = c.services.map((s) => s.label);
          if (
            i.schedule.some(
              (r) =>
                !names.includes(r.item) ||
                !/^([01]\d|2[0-3]):[0-5]\d$|^PRN$/.test(r.time) ||
                (r.time !== "PRN" &&
                  (c.shift === "DAY"
                    ? r.time < c.start || r.time > c.end
                    : !(r.time >= c.start || r.time <= c.end))),
            ) ||
            names.some((n) => !i.schedule.some((r) => r.item === n))
          )
            throw new Error("不可增加或刪除護理項目；時間格式無效");
          c.schedule_edits ??= [];
          c.schedule_edits.push({
            at: this.stamp(),
            actor: this.operatorId("senior_nurse"),
            before: c.schedule,
            reason: i.reason,
          });
          c.schedule = i.schedule.map((row) => ({
            ...row,
            note:
              c.services.find((s) => s.label === row.item)?.note ||
              c.remarks ||
              "",
          }));
          c.schedule_status = "PENDING_REVIEW";
          delete c.reviewed_by;
          delete c.confirmed_by;
          delete c.review_auth_method;
          c.schedule_version = (c.schedule_version || 1) + 1;
          this.event("schedule.edited", c, { actor: "senior_nurse" });
          return;
        }
        if (action === "manual_cancel") {
          if (
            c.status !== "MANUAL" ||
            !i.reason?.trim() ||
            c.amount_paid ||
            c.package_id
          )
            throw new Error("只可結束未收款人工個案，退款請走審批");
          this.transition(c, "CANCELLED");
          this.cancelAll(c);
          return;
        }
        if (action === "reschedule") {
          this.manual(c, "改期 credit 流程留待公司註冊後；交人手");
          return;
        }
        throw new Error("未支援操作");
      });
    }
    tick() {
      return this.asOperator(null, () =>
        this.transaction(() => this.tickInternal()),
      );
    }
    tickInternal() {
      if (this.isManualTransfer())
        for (const c of this.state.cases.filter(
          (c) =>
            (!this.live || c.intake_mode === "LIVE") &&
            c.status === "PENDING_PAY" &&
            c.payment_review_status === "PENDING_REVIEW" &&
            Date.parse(c.payment_deadline) <= this.now() &&
            !c.fps_deadline_review_at,
        )) {
          c.fps_deadline_review_at = this.stamp();
          this.cancelTimers(c, ["PAY_EXPIRE"]);
          this.email(
            c,
            "T14",
            this.state.admin_email || "admin@example.test",
            "轉帳期限到仍待對數",
            `Case ${c.id} 已提交轉帳聲明但尚未核對。請核對銀行入帳，未確認前不得派單。`,
          );
          this.event("payment.fps_deadline_review", c, {
            reason: "SUBMITTED_NOT_VERIFIED",
          });
        }
      const prior = this.state.timers.filter(
        (t) =>
          (!this.live ||
            this.state.cases.some(
              (c) => c.id === t.case_id && c.intake_mode === "LIVE",
            )) &&
          !t.fired_at &&
          !t.cancelled_at &&
          Date.parse(t.due_at) <= this.now(),
      );
      super.tick();
      for (const t of prior) {
        const c = this.state.cases.find((c) => c.id === t.case_id);
        if (!c) continue;
        if (t.type === "PAY_EXPIRE" && c.status === "PAY_TIMEOUT") {
          this.release(c);
          this.cancelAll(c);
        }
        if (t.type === "NO_TAKER" && c.status === "POSTED") {
          if (this.state.settings.repost) this.repost(c);
          if (this.state.settings.repeat_no_taker)
            this.timer(
              c,
              "NO_TAKER_REPEAT",
              this.state.settings.no_taker_hours,
            );
        }
        if (t.type === "QUOTE_REMIND" && c.status === "QUOTED") {
          const original = this.state.emails.find(
            (m) => m.case_id === c.id && ["T1", "T1b"].includes(m.template_id),
          );
          this.email(
            c,
            "T2",
            c.email,
            "報價提醒",
            `你好，提提你 Case ${c.id} 嘅報價仲未確認。如需安排護士，請撳以下其中一個掣：`,
            original?.links || [],
          );
          this.timer(
            c,
            "QUOTE_EXPIRE",
            this.state.settings.quote_expiry_after_reminder_hours,
          );
        }
        if (t.type === "QUOTE_EXPIRE" && c.status === "QUOTED") {
          this.transition(c, "EXPIRED");
          this.voidTokens(c, decisionActions);
          this.email(c, "X02", c.email, "報價已失效", "");
        }
        if (t.type === "REMATCH_EXPIRE" && c.status === "REMATCH") {
          this.requestRefund(c, "DROPPED_NO_TAKER");
          if (c.status === "FULL_REFUND")
            this.email(
              c,
              "T20",
              c.email,
              "預約取消及退款",
              `你好，好抱歉，Case ${c.id} ${c.date} 嘅服務未能安排護士，預約已取消。${c.package_id ? "預留套餐時數將於管理員批核後放回。" : `已付金額 HK$${c.refund_amount} 將全數退回原付款方式；待管理員批核。`}`,
            );
        }
        if (t.type === "NO_TAKER_REPEAT" && c.status === "POSTED") {
          this.email(
            c,
            "T14b",
            this.state.admin_email || "admin@example.test",
            "仍未有護士",
            `Case ${c.id} 仍未有護士接單。`,
          );
          this.timer(c, "NO_TAKER_REPEAT", this.state.settings.no_taker_hours);
        }
        if (
          t.type === "UNIT_CHASE" &&
          c.address_status === "ASKED" &&
          ["MATCHED"].includes(c.status)
        ) {
          const old = this.state.emails.find(
            (m) => m.case_id === c.id && m.template_id === "T16",
          );
          this.email(c, "T16", c.email, "請提供單位號碼", "", old?.links || []);
        }
        if (
          t.type === "UNIT_ALERT" &&
          c.address_status !== "PROVIDED" &&
          ["MATCHED"].includes(c.status)
        )
          this.email(
            c,
            "T14c",
            this.state.admin_email || "admin@example.test",
            "仍未提供單位",
            `Case ${c.id} 服務將近，客人仍未提供單位號碼。`,
          );
        if (
          t.type === "PRE_SERVICE" &&
          c.status !== "READY" &&
          !terminal.includes(c.status)
        )
          this.email(
            c,
            "T14",
            this.state.admin_email || "admin@example.test",
            "服務前資料未齊",
            `Case ${c.id} 配對、地址或 Care Schedule 未齊。`,
          );
        if (t.type === "NO_NURSE_START" && c.status === "POSTED")
          this.manual(c, "服務開始仍未有護士，退款方式待人手決定");
      }
      // Base reminder delivery supports READY; continue the same reminders while IN_SERVICE.
      for (const c of this.state.cases.filter(
        (c) =>
          ["READY", "IN_SERVICE"].includes(c.status) &&
          (!this.live || c.intake_mode === "LIVE"),
      ))
        for (const r of c.reminders || []) {
          if (
            this.state.settings.reminder_escalation &&
            r.chased_at &&
            !r.confirmed_at &&
            !r.alerted_at &&
            this.now() - Date.parse(r.chased_at) >=
              (this.state.settings.reminder_escalation_minutes * 60000) /
                this.state.settings.time_scale
          ) {
            r.alerted_at = this.stamp();
            this.email(
              c,
              "T14",
              this.state.admin_email || "admin@example.test",
              "提醒仍未確認",
              `Case ${c.id} 護理提醒於追問後仍未確認。`,
            );
          }
        }
      this.save();
    }
  };
