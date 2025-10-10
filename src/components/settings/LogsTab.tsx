import { useMemo, useState, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { create } from 'zustand';

type LogItem = {
    id: string;
    level: 'info' | 'warn' | 'error';
    timestamp: string;
    message: string;
    // Added fields to identify the call and show summarized details
    label?: string;       // e.g., "[calendar] GET /events"
    status?: number;      // HTTP status code
    // Add source meta for display
    sourceName?: string;
    sourceColor?: string;
    // Add stored response snippet for accordion content
    response?: string;
    // Add back optional count to match usage in logging
    count?: number;
};

type LogState = {
    entries: LogItem[];
    addEntry: (entry: LogItem) => void;
    clear: () => void;
};

// Persistence config
const LOGS_STORAGE_KEY = 'fp.logs.v1';
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
// New caps to reduce memory/DOM pressure
const MAX_ENTRIES = 300;     // cap in-memory/persisted entries
const MAX_RENDER = 200;      // cap rendered entries in UI
const MAX_PERSISTED_RESPONSE = 512; // trim response when persisting

type TieredSettingsStore = {
  getItem?(key: string): string | null;
  setItem?(key: string, value: string): void;
  removeItem?(key: string): void;
  get?(key: string): string | null;
  set?(key: string, value: string): void;
  remove?(key: string): void;
};

type TieredSettingsWindow = Window & {
  __fpTieredSettings?: TieredSettingsStore | null;
  __tieredSettings?: TieredSettingsStore | null;
  __settingsStorage?: TieredSettingsStore | null;
};

const getTieredStore = (): TieredSettingsStore | null => {
  if (typeof window === 'undefined') return null;
  const tieredWindow = window as TieredSettingsWindow;
  return (
    tieredWindow.__fpTieredSettings ??
    tieredWindow.__tieredSettings ??
    tieredWindow.__settingsStorage ??
    null
  );
};

// Prefer existing tiered settings storage if available, fallback to localStorage
function tieredGetItem(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const store = getTieredStore();
    if (store?.getItem) return store.getItem(key);
    if (store?.get) return store.get(key);
  } catch (err) {
    console.warn('[tieredGetItem] Failed to read from tiered storage:', err);
  }
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    console.warn('[tieredGetItem] Failed to read from localStorage:', err);
    return null;
  }
}
function tieredSetItem(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    const store = getTieredStore();
    if (store?.setItem) {
      store.setItem(key, value);
      return;
    }
    if (store?.set) {
      store.set(key, value);
      return;
    }
  } catch (err) {
    console.warn('[tieredSetItem] Failed to write to tiered storage:', err);
  }
  try {
    window.localStorage.setItem(key, value);
  } catch (err) {
    console.warn('[tieredSetItem] Failed to write to localStorage:', err);
  }
}
function tieredRemoveItem(key: string) {
  if (typeof window === 'undefined') return;
  try {
    const store = getTieredStore();
    if (store?.removeItem) {
      store.removeItem(key);
      return;
    }
    if (store?.remove) {
      store.remove(key);
      return;
    }
  } catch (err) {
    console.warn('[tieredRemoveItem] Failed to remove from tiered storage:', err);
  }
  try {
    window.localStorage.removeItem(key);
  } catch (err) {
    console.warn('[tieredRemoveItem] Failed to remove from localStorage:', err);
  }
}

function pruneOld(entries: LogItem[]): LogItem[] {
  const now = Date.now();
  return entries.filter((e) => {
    const t = new Date(e.timestamp).getTime();
    return Number.isFinite(t) && now - t <= MAX_AGE_MS;
  });
}
function loadPersistedEntries(): LogItem[] {
  try {
    const raw = tieredGetItem(LOGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LogItem[];
    return pruneOld(parsed).slice(-MAX_ENTRIES);
  } catch (err) {
    console.error('[loadPersistedEntries] Failed to load logs:', err);
    return [];
  }
}
function persistEntries(entries: LogItem[]) {
  try {
    const pruned = pruneOld(entries)
      .slice(-MAX_ENTRIES)
      // trim response bodies before writing to storage to avoid large sync writes
      .map((e) => ({
        ...e,
        response:
          typeof e.response === 'string'
            ? e.response.length > MAX_PERSISTED_RESPONSE
              ? e.response.slice(0, MAX_PERSISTED_RESPONSE) + '…'
              : e.response
            : e.response,
      }));
    tieredSetItem(LOGS_STORAGE_KEY, JSON.stringify(pruned));
  } catch (err) {
    console.error('[persistEntries] Failed to persist logs:', err);
  }
}

// Throttled persistence to avoid frequent large writes
let __persistTimer: number | null = null;
let __pendingEntries: LogItem[] | null = null;
function schedulePersist(entries: LogItem[]): void {
  __pendingEntries = entries;
  if (typeof window === 'undefined') return;
  if (__persistTimer != null) return;
  const flush = (): void => {
    const toWrite = __pendingEntries;
    __pendingEntries = null;
    __persistTimer = null;
    if (toWrite) persistEntries(toWrite);
  };
  if (window.requestIdleCallback) {
    __persistTimer = window.requestIdleCallback(flush, { timeout: 2500 });
  } else {
    __persistTimer = window.setTimeout(flush, 2500);
  }
}

const useLogStore = create<LogState>((set) => ({
    entries: typeof window === 'undefined' ? [] : loadPersistedEntries(),
    addEntry: (entry) =>
        set((state) => {
            const next = pruneOld([...state.entries, entry]).slice(-MAX_ENTRIES);
            // throttle persistence
            schedulePersist(next);
            return { entries: next };
        }),
    clear: () => {
        // clear persisted store and in-memory
        queueMicrotask(() => tieredRemoveItem(LOGS_STORAGE_KEY));
        set({ entries: [] });
    },
}));

// Keep in-memory store in sync if another tab updates storage (guard against duplicates)
declare global {
  interface Window {
    __fp_networkLogPatched?: boolean;
    __fp_logStorageListener?: boolean;
    __fp_scheduleDiagnostics?: {
      getTimes: () => number[];
      getIntervals: () => number[];
      getExpectedMinutes: () => number;
      setExpectedMinutes: (m: number) => void;
    };
    __fp_scheduleTest?: {
      waitForFetchSamples: (count: number, timeoutMs?: number) => Promise<number[]>;
      assertFrequency: (expectedMinutes: number, options?: { toleranceMinutes?: number; samples?: number; timeoutMs?: number }) => Promise<{ ok: true; avgMinutes: number; intervalsMs: number[] }>;
    };
  }
}
if (typeof window !== 'undefined' && !window.__fp_logStorageListener) {
  window.__fp_logStorageListener = true;
  window.addEventListener('storage', (e) => {
    if (e.key === LOGS_STORAGE_KEY) {
      const next = loadPersistedEntries();
      useLogStore.setState({ entries: next });
    }
  });
}

// Patch global fetch once to log all requests/responses
type LogLevel = 'info' | 'warn' | 'error';

function categorize(url: string): 'calendar' | 'notion' | 'other' {
  const u = url.toLowerCase();
  if (u.includes('api.notion.com') || u.includes('notion.so') || u.includes('/api/notion')) return 'notion';
  if (
    u.includes('/api/calendar') ||
    u.includes('googleapis.com/calendar') ||
    u.includes('calendar') ||
    u.includes('.ics') ||
    u.includes('ical')
  ) return 'calendar';
  return 'other';
}

// Cache for resolving source name/color to avoid repeated storage reads
type MetaCache = { exp: number; calendars?: unknown[]; notion?: unknown[] };
let __metaCache: MetaCache = { exp: 0 };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const pickString = (source: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const candidate = source[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }
  return undefined;
};

function getMetaSnapshot(): MetaCache {
  const now = Date.now();
  if (now < __metaCache.exp && (__metaCache.calendars || __metaCache.notion)) return __metaCache;

  const tryKeys = (keys: string[]): unknown => {
    for (const k of keys) {
      try {
        const v = tieredGetItem(k);
        if (v) return JSON.parse(v);
      } catch (err) {
        console.warn(`[tryKeys] Failed to parse key "${k}":`, err);
      }
    }
    return undefined;
  };

  // calendars
  let calendars: unknown[] | undefined;
  try {
    const cal = tryKeys(['fp.calendars', 'settings.calendars', 'calendar.feeds', 'calendars', 'fp.settings.calendars']) || [];
    if (Array.isArray(cal)) {
      calendars = cal;
    } else if (isRecord(cal) && Array.isArray(cal.feeds)) {
      calendars = cal.feeds as unknown[];
    }
  } catch (err) {
    console.warn('[getMetaSnapshot] Failed to load calendars:', err);
  }
  // notion
  let notion: unknown[] | undefined;
  try {
    const nd = tryKeys(['fp.notion.databases', 'settings.notion.databases', 'notion.databases', 'notionDatabases', 'fp.settings.notion']) || [];
    if (Array.isArray(nd)) {
      notion = nd;
    } else if (isRecord(nd)) {
      if (Array.isArray(nd.databases)) {
        notion = nd.databases as unknown[];
      } else if (Array.isArray(nd.items)) {
        notion = nd.items as unknown[];
      }
    }
  } catch (err) {
    console.warn('[getMetaSnapshot] Failed to load notion databases:', err);
  }

  __metaCache = { exp: now + 60_000, calendars, notion }; // cache for 60s
  return __metaCache;
}

// Helper to resolve user-defined name/color for calendar or notion sources
function resolveSourceMeta(url: string, tag: 'calendar' | 'notion' | 'other', init?: RequestInit): { name?: string; color?: string } {
  const snap = getMetaSnapshot();

  if (tag === 'calendar') {
    const list = snap.calendars || [];
    const match = Array.isArray(list)
      ? list.find((candidate) => isRecord(candidate) && typeof candidate.url === 'string' && url.includes(candidate.url))
      : undefined;
    if (match && isRecord(match)) {
      return {
        name: pickString(match, ['name', 'title', 'label']),
        color: pickString(match, ['color', 'colour', 'tint']) ?? '#0ea5e9',
      };
    }
    return { color: '#0ea5e9' };
  }

  if (tag === 'notion') {
    let dbId: string | undefined;
    try {
      const m = /\/v1\/databases\/([a-f0-9-]+)\/query/i.exec(url);
      if (m) dbId = m[1];
    } catch (err) {
      console.warn('[resolveSourceMeta] Failed to parse database ID from URL:', err);
    }
    if (!dbId && init?.body && typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body);
          if (isRecord(body) && typeof body.database_id === 'string') dbId = body.database_id;
      } catch (err) {
        console.warn('[resolveSourceMeta] Failed to parse database ID from body:', err);
      }
    }
    const list = snap.notion || [];
    if (Array.isArray(list) && dbId) {
      const canon = (s: string): string => s.replace(/-/g, '').toLowerCase();
      const match = list.find(
        (candidate) =>
          isRecord(candidate) &&
          ((typeof candidate.id === 'string' && canon(candidate.id) === canon(dbId)) ||
            (typeof candidate.databaseId === 'string' && canon(candidate.databaseId) === canon(dbId)))
      );
      if (match && isRecord(match)) {
        return {
          name: pickString(match, ['name', 'title', 'label']),
          color: pickString(match, ['color', 'colour', 'tint']) ?? '#8b5cf6',
        };
      }
    }
    return { color: '#8b5cf6' };
  }

  return { color: '#9ca3af' };
}

// Helper to add a log with label/status/response and source meta
function safeAddLog(
  level: LogLevel,
  label: string,
  opts?: { message?: string; status?: number; count?: number; response?: string; sourceName?: string; sourceColor?: string }
) {
  try {
    const addEntry = useLogStore.getState().addEntry;
    addEntry({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      level,
      timestamp: new Date().toISOString(),
      message: opts?.message ?? '',
      label,
      status: opts?.status,
      count: opts?.count,
      response: opts?.response,
      sourceName: opts?.sourceName,
      sourceColor: opts?.sourceColor,
    });
  } catch (err) {
    console.error('[safeAddLog] Failed to add log entry:', err);
  }
}

// ---- Calendar schedule diagnostics ----
declare global {
  interface Window {
    __fp_networkLogPatched?: boolean;
    __fp_logStorageListener?: boolean;
    __fp_scheduleDiagnostics?: {
      getTimes: () => number[];
      getIntervals: () => number[];
      getExpectedMinutes: () => number;
      setExpectedMinutes: (m: number) => void;
    };
    // Jest helper API for cadence tests
    __fp_scheduleTest?: {
      waitForFetchSamples: (count: number, timeoutMs?: number) => Promise<number[]>;
      assertFrequency: (expectedMinutes: number, options?: { toleranceMinutes?: number; samples?: number; timeoutMs?: number }) => Promise<{ ok: true; avgMinutes: number; intervalsMs: number[] }>;
    };
  }
}

// Keep recent calendar fetch timestamps in-memory for cadence checks (last 100)
const __calendarFetchTimes: number[] = [];

function getExpectedRefreshMinutes(): number {
  // Allow an explicit override for testing
  const override = tieredGetItem('fp.calendar.refresh.minutes.override');
  if (override) {
    const v = parseFloat(override);
    if (Number.isFinite(v) && v > 0) return v;
  }
  // Attempt to read likely keys from existing settings storage
  const candidates = [
    'calendar.refreshIntervalMinutes',
    'calendar.refreshMinutes',
    'fp.calendar.refresh.minutes',
    'fp.settings.calendar.refreshMinutes',
  ];
  for (const key of candidates) {
    try {
      const raw = tieredGetItem(key);
      if (!raw) continue;
      const n = Number.isNaN(+raw) ? (JSON.parse(raw)?.minutes ?? JSON.parse(raw)) : +raw;
      if (Number.isFinite(n) && n > 0) return Number(n);
    } catch (err) {
      console.warn(`[getExpectedRefreshMinutes] Failed to parse key "${key}":`, err);
    }
  }
  return 15; // default expected cadence (minutes)
}

function computeIntervals(times: number[]): number[] {
  const arr = [...times].slice(-10); // only last 10 samples
  const res: number[] = [];
  for (let i = 1; i < arr.length; i++) {
    const delta = arr[i] - arr[i - 1];
    if (delta > 0) res.push(delta);
  }
  return res;
}

function recordCalendarFetch(ts: number, labelForWarn?: string): void {
  __calendarFetchTimes.push(ts);
  if (__calendarFetchTimes.length > 100) __calendarFetchTimes.splice(0, __calendarFetchTimes.length - 100);

  // Emit an event tests can listen to
  try {
    window.dispatchEvent(new CustomEvent<number>('fp:calendar-fetch', { detail: ts }));
  } catch (err) {
    console.warn('[recordCalendarFetch] Failed to dispatch event:', err);
  }

  // Late cadence detection: warn if last interval > 2x expected
  const expectedMs = getExpectedRefreshMinutes() * 60_000;
  const lastTwo = __calendarFetchTimes.slice(-2);
  if (lastTwo.length === 2) {
    const delta = lastTwo[1] - lastTwo[0];
    if (delta > expectedMs * 2) {
      safeAddLog('warn', labelForWarn || '[calendar] schedule', {
        status: undefined,
        message: `calendar fetch cadence late by ${Math.round((delta - expectedMs) / 1000)}s (expected ~${Math.round(
          expectedMs / 1000
        )}s, got ${Math.round(delta / 1000)}s)`,
      });
    }
  }
}

// Expose diagnostics for tests
(function initScheduleDiagnostics() {
  if (typeof window !== 'undefined' && !window.__fp_scheduleDiagnostics) {
    window.__fp_scheduleDiagnostics = {
      getTimes: () => __calendarFetchTimes.slice(),
      getIntervals: () => computeIntervals(__calendarFetchTimes),
      getExpectedMinutes: () => getExpectedRefreshMinutes(),
      setExpectedMinutes: (m: number) => {
        if (Number.isFinite(m) && m > 0) tieredSetItem('fp.calendar.refresh.minutes.override', String(m));
      },
    };
  }
})();

// Expose lightweight Jest helpers to verify scheduled cadence without importing React
(function initScheduleTest() {
  if (typeof window !== 'undefined' && !window.__fp_scheduleTest) {
    const waitForFetchSamplesLocal = (count: number, timeoutMs = 30000): Promise<number[]> =>
      new Promise<number[]>((resolve, reject) => {
        const startLen = __calendarFetchTimes.length;
        if (startLen >= count) return resolve(__calendarFetchTimes.slice(0, count));
        let done = false;
        const onTick = (): void => {
          const len = __calendarFetchTimes.length;
          if (len >= count && !done) {
            done = true;
            cleanup();
            resolve(__calendarFetchTimes.slice());
          }
        };
        const onEvent = (): void => onTick();
        const timer = window.setTimeout(() => {
          if (!done) {
            done = true;
            cleanup();
            reject(new Error(`Timeout waiting for ${count} calendar fetch samples; got ${__calendarFetchTimes.length}`));
          }
        }, timeoutMs);
        const cleanup = (): void => {
          window.removeEventListener('fp:calendar-fetch', onEvent);
          window.clearTimeout(timer);
        };
        window.addEventListener('fp:calendar-fetch', onEvent);
        onTick();
      });

    window.__fp_scheduleTest = {
      waitForFetchSamples: waitForFetchSamplesLocal,
      assertFrequency: async (expectedMinutes: number, options?: { toleranceMinutes?: number; samples?: number; timeoutMs?: number }): Promise<{ ok: true; avgMinutes: number; intervalsMs: number[] }> => {
        const tol = options?.toleranceMinutes ?? Math.max(0.25, expectedMinutes * 0.25);
        const samples = Math.max(2, options?.samples ?? 3);
        const timeoutMs = options?.timeoutMs ?? Math.max(15000, expectedMinutes * 60000 * 3);
        await waitForFetchSamplesLocal(samples, timeoutMs);
        const intervals = computeIntervals(__calendarFetchTimes).slice(-Math.max(1, samples - 1));
        if (!intervals.length) throw new Error('No intervals to assert on.');
        const avgMs = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
        const avgMin = avgMs / 60000;
        const delta = Math.abs(avgMin - expectedMinutes);
        if (delta > tol) {
          throw new Error(`Expected ~${expectedMinutes}m ±${tol}m cadence, got ${avgMin.toFixed(2)}m (intervals: ${intervals.map(i => Math.round(i/1000)).join('s, ')}s)`);
        }
        return { ok: true as const, avgMinutes: +avgMin.toFixed(3), intervalsMs: intervals };
      },
    };
  }
})();

if (typeof window !== 'undefined' && !window.__fp_networkLogPatched) {
  window.__fp_networkLogPatched = true;
  const originalFetch = window.fetch.bind(window);

  // Reduce snippet size to lower memory/serialization overhead
  const truncate = (str: string, max = 2048): string => (str.length > max ? str.slice(0, max) + '…' : str);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
        ? input.toString()
        : (input as Request).url;

    const method =
      init?.method ||
      (typeof input !== 'string' && !(input instanceof URL) ? (input as Request).method : 'GET');

    const tag = categorize(url);

    // Only log calendar and notion calls to avoid noise and heavy processing
    if (tag === 'other') {
      return originalFetch(input, init);
    }

    const start = performance.now();

    // Build a concise label indicating which call this is
    let label = `[${tag}] ${method}`;
    try {
      const parsed = new URL(url, window.location.origin);
      label += ` ${parsed.pathname}`;
    } catch (err) {
      console.warn('[fetch] Failed to parse URL:', err);
      label += ` ${url}`;
    }

    // Resolve source meta (name/color) from settings
    const meta = resolveSourceMeta(url, tag, init);

    try {
      const res = await originalFetch(input, init);
      const duration = Math.round(performance.now() - start);

      // Only safely read small JSON bodies; skip text/ICS and large payloads to prevent freezes.
      let count: number | undefined;
      let responseSnippet: string | undefined;
      try {
        const ctype = res.headers.get('content-type') || '';
        const clenHeader = res.headers.get('content-length');
        const clen = clenHeader ? parseInt(clenHeader, 10) : undefined;
        const MAX_JSON_BYTES = 262144; // 256KB

        if (ctype.includes('application/json') && clen !== undefined && clen <= MAX_JSON_BYTES) {
          const clone = res.clone();
          const json = (await clone.json()) as unknown;
          if (Array.isArray(json)) count = json.length;
          else if (isRecord(json)) {
            if (Array.isArray(json.results)) count = json.results.length;
            else if (Array.isArray(json.items)) count = json.items.length;
            else if (Array.isArray(json.data)) count = json.data.length;
          }
          responseSnippet = truncate(JSON.stringify(json, null, 2));
        } else if (ctype.includes('application/json') && clen === undefined) {
          // Unknown size: avoid full read to be safe
          responseSnippet = '(json body omitted due to unknown size)';
        } else {
          // Skip non-JSON bodies entirely (e.g., ICS or binary) to avoid large reads
          responseSnippet = undefined;
        }
      } catch (err) {
        console.warn('[fetch] Failed to parse response body:', err);
      }

      const level: LogLevel = res.ok ? 'info' : 'warn';
      safeAddLog(level, label, {
        status: res.status,
        // count kept internally only when safely computed
        count,
        message: `completed in ${duration}ms`,
        response: responseSnippet,
        sourceName: meta.name,
        sourceColor: meta.color,
      });

      // Record cadence for calendar only
      if (tag === 'calendar') {
        recordCalendarFetch(Date.now(), label);
      }

      return res;
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      const error = err as Error;
      safeAddLog('error', label, {
        message: `error in ${duration}ms: ${error?.message || String(err)}`,
        response: String((error as Error & { stack?: string })?.stack || error?.message || err),
        sourceName: meta.name,
        sourceColor: meta.color,
      });
      // Still record a cadence tick so missed intervals are visible in tests/UI
      if (tag === 'calendar') {
        recordCalendarFetch(Date.now(), label);
      }
      throw err;
    }
  };
}

// Format: hh:mm AM/PM dd-mm-yyyy in local timezone
function formatLocalTs(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const hours24 = d.getHours();
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  const hh = pad(hours12);
  const mm = pad(d.getMinutes());
  const dd = pad(d.getDate());
  const mon = pad(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  return `${hh}:${mm} ${ampm} ${dd}-${mon}-${yyyy}`;
}

const LogsTab = (): JSX.Element => {
  const logs = useLogStore((state: LogState) => state.entries);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Diagnostics summary for calendar cadence
  const cadenceSummary = useMemo(() => {
    const expectedMin = getExpectedRefreshMinutes();
    // Compute from in-memory times first; if empty, derive from logs for [calendar]
    let times = __calendarFetchTimes.slice();
    if (times.length < 2) {
      // Pull from recent log timestamps where label includes [calendar]
      const calLogs = (logs as LogItem[])
        .filter((l) => l.label?.includes('[calendar]'))
        .slice(-12)
        .map((l) => new Date(l.timestamp).getTime())
        .filter((t) => Number.isFinite(t)) as number[];
      times = calLogs;
    }
    const intervals = computeIntervals(times);
    const n = intervals.length;
    const avgMs = n ? Math.round(intervals.reduce((a, b) => a + b, 0) / n) : 0;
    const avgMin = n ? +(avgMs / 60000).toFixed(2) : 0;
    const status =
      n === 0
        ? 'insufficient data'
        : avgMs <= expectedMin * 60000 * 1.5
        ? 'ok'
        : 'behind';
    return { expectedMin, avgMin, samples: n, status };
  }, [logs]);

  const renderedLogs = useMemo(
    () => {
      if (!logs.length) return null;
      // Sort newest first and limit rendered entries to reduce DOM pressure
      const ordered = [...logs]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, MAX_RENDER);

      return ordered.map((entry: LogItem) => {
        const isOpen = openIds.has(entry.id);
        const color =
          entry.sourceColor ||
          (entry.label?.includes('[calendar]')
            ? '#0ea5e9'
            : entry.label?.includes('[notion]')
            ? '#8b5cf6'
            : '#9ca3af');
        const name = entry.sourceName || entry.label || 'request';

        return (
          <div
            key={entry.id}
            className="rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50/70 dark:bg-gray-800/50"
          >
            <button
              type="button"
              onClick={() => toggle(entry.id)}
              className="w-full px-3 py-2 text-left text-sm text-gray-800 dark:text-gray-200 flex items-center justify-between"
              aria-expanded={isOpen}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                    {name}
                  </span>
                  <time dateTime={entry.timestamp}>{formatLocalTs(entry.timestamp)}</time>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>Status: {entry.status ?? '-'}</span>
                  {/* removed count from UI */}
                </div>
              </div>
              <span className="ml-3 text-gray-400">{isOpen ? '▾' : '▸'}</span>
            </button>

            {isOpen && (
              <div className="px-3 pb-3">
                <pre className="mt-1 max-h-48 overflow-auto rounded bg-gray-900 text-gray-100 text-xs p-2">
                  <code>
                    {entry.response || entry.message || '(no response body)'}
                  </code>
                </pre>
              </div>
            )}
          </div>
        );
      });
    },
    [logs, openIds, toggle]
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Logs</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Live capture of API activity for calendar and Notion feeds.
        </p>
        {/* Cadence diagnostics summary */}
        <div className="mt-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/40 px-3 py-2">
          <p className="text-xs text-gray-600 dark:text-gray-300">
            Calendar cadence: avg {cadenceSummary.avgMin || 0} min over {cadenceSummary.samples} samples • expected {cadenceSummary.expectedMin} min • status: {cadenceSummary.status}
          </p>
        </div>
      </div>

      <ScrollArea className="h-[360px] rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="space-y-3 p-4">
          {renderedLogs ?? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No log entries recorded yet.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default LogsTab;