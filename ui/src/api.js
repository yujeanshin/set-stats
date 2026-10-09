// Talk to the JSON API served by bin/ui.js. The app only formats and draws
// what comes back; no metric math happens in the browser.
import { useEffect, useState } from "react";

/** /api<path>?params. Booleans become 1/0; null/empty params are dropped. */
function apiUrl(path, params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "") continue;
    qs.set(k, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
  }
  return `/api${path}${qs.size ? `?${qs}` : ""}`;
}

// Responses by url, kept until the page reloads: the data only changes when
// sync runs, and a reload picks that up. Keeping the promise also lets
// callers that ask at the same time share one request. Errors are not kept.
const requests = new Map(); // url -> Promise of the body
const bodies = new Map(); // url -> body, once it has arrived

async function fetchJson(url) {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `${res.status} ${res.statusText}`);
  return body;
}

/** GET /api<path>?params, from the cache when it was fetched before. */
export function getJson(path, params = {}) {
  const url = apiUrl(path, params);
  if (!requests.has(url))
    requests.set(
      url,
      fetchJson(url).then(
        (body) => {
          bodies.set(url, body);
          return body;
        },
        (error) => {
          requests.delete(url);
          throw error;
        },
      ),
    );
  return requests.get(url);
}

/**
 * Fetch on mount and whenever path or params change.
 * Returns { data, error, loading }. Pass path = null to fetch nothing.
 */
export function useApi(path, params = {}) {
  const key = JSON.stringify([path, params]);
  const cached = path == null ? null : bodies.get(apiUrl(path, params));
  const [state, setState] = useState({
    data: cached ?? null,
    error: null,
    loading: path != null && !cached,
  });
  useEffect(() => {
    if (path == null) {
      setState({ data: null, error: null, loading: false });
      return undefined;
    }
    if (cached) {
      setState({ data: cached, error: null, loading: false });
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
