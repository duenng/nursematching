import { validAdminEmail } from "./admin-email.mjs";
import { settingsLocked } from "./staff-workspace.mjs";
import { EXPERIMENT_POLICIES } from "./extended-workflow.mjs";

export function saveServiceSettings(workflow, input) {
  return workflow.transaction(() => {
    const { state, live } = workflow;
    const locked = settingsLocked(state, live);
    const update = (name, value, allowInitial = false) => {
      if (
        locked &&
        value !== state.settings[name] &&
        !(allowInitial && state.settings[name] == null)
      )
        throw new Error(
          "有進行中個案，計時、已設定薪酬及流程設定暫時鎖定；仍可儲存管理員電郵及首次設定護士薪酬",
        );
      state.settings[name] = value;
    };
    let adminEmail;
    if ("admin_email" in input) {
      if (live && !validAdminEmail(input.admin_email))
        throw new Error("請提供有效管理員電郵");
      adminEmail = String(
        input.admin_email || (live ? "" : "admin@example.test"),
      )
        .trim()
        .toLowerCase();
    }
    if ("time_scale" in input) {
      const scale = Number(input.time_scale);
      if (
        ![1, 60].includes(scale) ||
        (["bank_transfer", "payme", "stripe_test"].includes(
          workflow.paymentMode,
        ) &&
          scale !== 1)
      )
        throw new Error(
          "人手轉帳及 Stripe 必須使用真實時間；本機模擬可選 1 或 60",
        );
      update("time_scale", scale);
    }
    for (const key of ["nurse_day_rate", "nurse_night_rate"]) {
      if (!(key in input)) continue;
      // An unconfigured rate can stay blank while the notification email is saved.
      if (
        (input[key] === "" || input[key] === null) &&
        state.settings[key] == null
      )
        continue;
      const rate = Number(input[key]);
      if (!Number.isSafeInteger(rate) || rate <= 0)
        throw new Error("請確認正整數護士薪酬");
      update(key, rate, true);
    }
    for (const [name, defaultValue] of Object.entries(EXPERIMENT_POLICIES)) {
      if (!input.policies || !(name in input.policies)) continue;
      const value = input.policies[name];
      if (typeof defaultValue === "boolean" && typeof value !== "boolean")
        throw new Error("Policy value invalid");
      if (
        name === "package_offer_rule" &&
        !["MANUAL", "WEEKDAY_DAY_LE30"].includes(value)
      )
        throw new Error("套餐設定無效");
      update(name, value);
    }
    if (!live && "nurses" in input) {
      for (const n of state.nurses) {
        const email = input.nurses?.find((x) => x.id === n.id)?.email;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || ""))
          throw new Error("護士電郵無效");
        if (locked && email !== n.email)
          throw new Error("有進行中個案，護士電郵暫時鎖定");
        n.email = email;
      }
    }
    if (adminEmail !== undefined) state.admin_email = adminEmail;
    workflow.event("settings.confirmed", null, { actor: "admin" });
    return { ok: true };
  });
}
