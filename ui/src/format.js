// Number and date formatting for display. Inputs are ms unless noted.

/** Seconds with one decimal: 9391 -> "9.4". */
export const secs = (ms, digits = 1) =>
  ms == null ? "–" : (ms / 1000).toFixed(digits);

/** m:ss.s clock: 192400 -> "3:12.4"; over an hour: "1:02:03.4". */
export function clock(ms, { tenths = true } = {}) {
  if (ms == null) return "–";
  const total = tenths ? Math.round(ms / 100) / 10 : Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const sec = tenths
    ? s.toFixed(1).padStart(4, "0")
    : String(s).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** "Aug 17, 2026, 12:21 PM" in the browser's zone and language. */
export const dateTime = (ms) =>
  new Date(ms).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

/** "Aug 17, 2026". */
export const dateOnly = (ms) =>
  new Date(ms).toLocaleDateString(undefined, { dateStyle: "medium" });

/** "2 hours ago", "3 days ago", for the Last synced label. */
export function relativeTime(ms, now = Date.now()) {
  if (ms == null) return "never";
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const diff = (ms - now) / 1000;
  const units = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(diff) >= size)
      return rtf.format(Math.round(diff / size), unit);
  }
  return "just now";
}

/** Local midnight `days` days before today, in ms. */
export function localMidnightDaysAgo(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.getTime();
}

/** The browser's IANA time zone, for the calendar endpoint. */
export const localTimeZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Local midnight of an <input type="date"> value ("YYYY-MM-DD"), in ms. */
export function localDayStart(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** Last millisecond of that local day, so an inclusive `to` covers the day. */
export function localDayEnd(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d + 1).getTime() - 1;
}
