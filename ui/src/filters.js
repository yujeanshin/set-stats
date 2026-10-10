// Top-bar filters (brief 6.2), kept in the URL so a reload or the back
// button from a game keeps them. Absent params mean the defaults.
import { useLocation, useSearchParams } from "react-router-dom";

function setOrDelete(params, key, value) {
  if (value == null) params.delete(key);
  else params.set(key, value);
}

export function useFilters() {
  const [params, setParams] = useSearchParams();
  // Keep the history state (e.g. where the game page's back link goes)
  // when a filter rewrites the URL.
  const { state } = useLocation();
  const filters = {
    mode: params.get("mode"), // null: the server picks the most played
    completedOnly: params.get("completedOnly") === "1",
    hintsOff: params.get("hintsOff") !== "0",
    dropBreaks: params.get("dropBreaks") === "1",
    skipBadTiming: params.get("skipBadTiming") !== "0",
  };
  function setFilters(patch) {
    const next = { ...filters, ...patch };
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        setOrDelete(p, "mode", next.mode);
        setOrDelete(p, "completedOnly", next.completedOnly ? "1" : null);
        setOrDelete(p, "hintsOff", next.hintsOff ? null : "0");
        setOrDelete(p, "dropBreaks", next.dropBreaks ? "1" : null);
        setOrDelete(p, "skipBadTiming", next.skipBadTiming ? null : "0");
        return p;
      },
      { replace: true, state },
    );
  }
  return [filters, setFilters];
}

/**
 * The calendar day whose games are open under the calendar (brief-v3 item
 * 3), as "YYYY-MM-DD" in the `day` param, or null. In the URL so closing
 * a game dialog, or reloading, comes back to it.
 */
export function useSelectedDay() {
  const [params, setParams] = useSearchParams();
  const { state } = useLocation();
  const day = params.get("day");
  function setDay(next) {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        setOrDelete(p, "day", next);
        return p;
      },
      { replace: true, state },
    );
  }
  return [/^\d{4}-\d{2}-\d{2}$/.test(day ?? "") ? day : null, setDay];
}

/**
 * The Set types page's date range and last N, in the URL like the top-bar
 * filters: range (default "all"), from and to ("YYYY-MM-DD", custom range
 * only) and lastN. In RangeControls' { range, customFrom, customTo, lastN }
 * shape.
 */
export function useTypeRange() {
  const [params, setParams] = useSearchParams();
  const value = {
    range: params.get("range") ?? "all",
    customFrom: params.get("from") ?? "",
    customTo: params.get("to") ?? "",
    lastN: params.get("lastN") ?? "",
  };
  function setValue(patch) {
    const next = { ...value, ...patch };
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        setOrDelete(p, "range", next.range === "all" ? null : next.range);
        const custom = next.range === "custom";
        setOrDelete(
          p,
          "from",
          custom && next.customFrom ? next.customFrom : null,
        );
        setOrDelete(p, "to", custom && next.customTo ? next.customTo : null);
        setOrDelete(p, "lastN", next.lastN || null);
        return p;
      },
      { replace: true },
    );
  }
  return [value, setValue];
}
