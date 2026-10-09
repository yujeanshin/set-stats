// Talk to the JSON API served by bin/ui.js. The app only formats and draws
// what comes back; no metric math happens in the browser.
import { useEffect, useState } from "react";

/** GET /api<path>?params. Booleans become 1/0; null/empty params are dropped. */
export async function getJson(path, params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "") continue;
    qs.set(k, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
  }
  const res = await fetch(`/api${path}${qs.size ? `?${qs}` : ""}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  return body;
}

/**
 * Fetch on mount and whenever path or params change.
 * Returns { data, error, loading }. Pass path = null to fetch nothing.
 */
export function useApi(path, params = {}) {
  const key = JSON.stringify([path, params]);
  const [state, setState] = useState({
    data: null,
    error: null,
    loading: path != null,
  });
  useEffect(() => {
    if (path == null) {
      setState({ data: null, error: null, loading: false });
      return undefined;
    }
    let live = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    getJson(path, params).then(
      (data) => live && setState({ data, error: null, loading: false }),
      (error) => live && setState({ data: null, error, loading: false }),
    );
    return () => {
      live = false;
    };
  }, [key]);
  return state;
}
