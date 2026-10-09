// Top-bar filters (brief 6.2), kept in the URL so a reload or the back
// button from a game keeps them. Absent params mean the defaults.
import { useSearchParams } from "react-router-dom";

function setOrDelete(params, key, value) {
  if (value == null) params.delete(key);
  else params.set(key, value);
}

export function useFilters() {
  const [params, setParams] = useSearchParams();
  const filters = {
    mode: params.get("mode"), // null: the server picks the most played
    completedOnly: params.get("completedOnly") === "1",
    hintsOff: params.get("hintsOff") !== "0",
    dropBreaks: params.get("dropBreaks") === "1",
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
        return p;
      },
      { replace: true },
    );
  }
  return [filters, setFilters];
}
