import { useLocale } from "./i18n";

export const DAY_TIMES = Array.from({ length: 31 }, (_, index) => {
  const minutes = 7 * 60 + index * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

export function DayTimeSelect({
  value,
  onChange,
  after,
  end = false,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  after?: string;
  end?: boolean;
  disabled?: boolean;
}) {
  const { language } = useLocale();
  return (
    <select
      required
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">
        {language === "zh-HK" ? "請選擇時間" : "Select time"}
      </option>
      {DAY_TIMES.filter((time) => (end ? time > "07:00" : time < "22:00")).map(
        (time) => (
          <option key={time} value={time} disabled={!!after && time <= after}>
            {time}
          </option>
        ),
      )}
    </select>
  );
}

export function PreferredTimeFields({
  label,
  times,
  disabled,
  onChange,
}: {
  label: string;
  times: string[];
  disabled: boolean;
  onChange: (times: string[]) => void;
}) {
  const { language } = useLocale();
  const text = (zh: string, en: string) => (language === "zh-HK" ? zh : en);
  return (
    <fieldset className="ev-preferred-times" disabled={disabled}>
      <legend>
        {label} ·{" "}
        {text(
          "偏好時間（香港時間，24 小時制）",
          "Preferred times (Hong Kong, 24-hour clock)",
        )}
      </legend>
      {times.map((time, index) => {
        const [hour = "", minute = ""] = time.split(":");
        const name = `${label} · ${text("時間", "Time")} ${index + 1}`;
        return (
          <div className="ev-time-row" key={index}>
            <label>
              {text("時", "Hour")}
              <select
                required
                aria-label={`${name} · ${text("時", "Hour")}`}
                value={hour}
                onChange={(event) =>
                  onChange(
                    times.map((value, n) =>
                      n === index ? `${event.target.value}:${minute}` : value,
                    ),
                  )
                }
              >
                <option value="">{text("選擇時", "Select hour")}</option>
                {Array.from({ length: 24 }, (_, hour) =>
                  String(hour).padStart(2, "0"),
                ).map((hour) => (
                  <option key={hour}>{hour}</option>
                ))}
              </select>
            </label>
            <label>
              {text("分", "Minute")}
              <select
                required
                aria-label={`${name} · ${text("分", "Minute")}`}
                value={minute}
                onChange={(event) =>
                  onChange(
                    times.map((value, n) =>
                      n === index ? `${hour}:${event.target.value}` : value,
                    ),
                  )
                }
              >
                <option value="">{text("選擇分", "Select minute")}</option>
                {Array.from({ length: 60 }, (_, minute) =>
                  String(minute).padStart(2, "0"),
                ).map((minute) => (
                  <option key={minute}>{minute}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="button secondary"
              aria-label={`${text("移除", "Remove")} ${name}`}
              onClick={() => onChange(times.filter((_, n) => n !== index))}
            >
              {text("移除", "Remove")}
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className="button secondary"
        onClick={() => onChange([...times, ""])}
      >
        {text("加入偏好時間", "Add preferred time")}
      </button>
    </fieldset>
  );
}
