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

/**
 * A difference in time for reading as words: "0.4 s" for paces (one
 * decimal), "12 s" or "1:05" for game times (whole seconds).
 */
export function gapText(ms, kind) {
  if (kind === "pace") return `${secs(ms)} s`;
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} s` : clock(s * 1000, { tenths: false });
}

/**
 * A headline tile's change against the 5 games before (brief-v3 item 1), in
 * words because lower is better: "0.2 s faster than the 5 before". A change
 * that rounds to zero is "Same as the 5 before". Null delta: null.
 */
export function deltaText(delta, kind) {
  if (delta == null) return null;
  const size = gapText(Math.abs(delta), kind);
  if (size === gapText(0, kind)) return "Same as the 5 before";
  return `${size} ${delta < 0 ? "faster" : "slower"} than the 5 before`;
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

/**
 * "2:41 PM" for a time today, "Oct 8, 2:41 PM" on another day this year,
 * "Dec 30, 2025, 2:41 PM" in another year. For the header's Data updated.
 */
export function shortWhen(ms, now = Date.now()) {
  const d = new Date(ms);
  const today = new Date(now);
  const time = d.toLocaleTimeString(undefined, { timeStyle: "short" });
  if (d.toDateString() === today.toDateString()) return time;
  const date = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
  return `${date}, ${time}`;
}

/** "Aug 17, 2026, 12:21:05 PM", to the second, for tooltips. */
export const fullDateTime = (ms) =>
  new Date(ms).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "medium",
  });

/** "2 hours ago", "3 days ago", for the header's update times. */
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

/** A Ratio with two decimals: 1.234 -> "1.23"; null -> "–". */
export const ratioText = (r) => (r == null ? "–" : r.toFixed(2));

/** A 95% interval: "0.98–1.40". */
export const intervalText = (low, high) =>
  low == null ? "–" : `${ratioText(low)}–${ratioText(high)}`;

/** A count with thousands separators: 12345 -> "12,345". Decimals: digits. */
export const countText = (n, digits = 0) =>
  n == null
    ? "–"
    : n.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });

/**
 * What a range covers, from the API's gameSpan: "196 games, Jul 12 to
 * Oct 10". Years are shown when either end isn't in the current year.
 */
export function spanText({ games, from, to }, now = Date.now()) {
  if (!games) return "No games in this range";
  const year = new Date(now).getFullYear();
  const thisYear = [from, to].every((t) => new Date(t).getFullYear() === year);
  const day = (ms) =>
    new Date(ms).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: thisYear ? undefined : "numeric",
    });
  const count = `${countText(games)} ${games === 1 ? "game" : "games"}`;
  return day(from) === day(to)
    ? `${count}, ${day(from)}`
    : `${count}, ${day(from)} to ${day(to)}`;
}
