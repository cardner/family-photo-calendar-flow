// Helpers for routing external fetches through the unified Cloudflare Worker proxy.
//
// The Worker origin is configured at build time via `VITE_WORKER_BASE`
// (e.g. "https://calendar-proxy.<account>.workers.dev"). When unset, route
// URLs are returned relative (e.g. "/ical?url=..."), which works in dev when a
// Vite proxy or same-origin Worker route is available.

interface WorkerEnvLike {
  VITE_WORKER_BASE?: string;
  DEV?: boolean;
}

const env: WorkerEnvLike =
  typeof import.meta !== 'undefined'
    ? ((import.meta as unknown as { env: WorkerEnvLike }).env ?? {})
    : {};

/** Returns the configured Worker origin without a trailing slash (may be empty). */
export const getWorkerBase = (): string => (env.VITE_WORKER_BASE || '').replace(/\/$/, '');

/** Builds a Worker route URL of the form `<base>/<route>?url=<encoded target>`. */
export const buildWorkerProxyUrl = (route: string, targetUrl: string): string => {
  const base = getWorkerBase();
  return `${base}/${route}?url=${encodeURIComponent(targetUrl)}`;
};

/** True when a Worker base is configured (required in production builds). */
export const hasWorkerBase = (): boolean => getWorkerBase().length > 0;
