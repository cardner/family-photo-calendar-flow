// Unified Cloudflare Worker proxy for the Family Calendar app.
//
// Routes (all share the CORS allowlist below):
//   /notion/*         -> reverse proxy to https://api.notion.com/v1/* (token forwarded by client)
//   /ical?url=        -> fetch a remote .ics feed (host allowlisted, validated, cached ~10m)
//   /photos?url=      -> fetch a public Google Photos share page HTML (host allowlisted, cached ~6h)
//   /notion-page?url= -> fetch a public Notion page HTML (host allowlisted, cached ~10m)
//
// Cross-cutting: per-IP rate limiting (KV) and response caching (Cache API).

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

interface Env {
  // Bound in wrangler.toml; optional so the Worker still runs without it.
  RATE_LIMIT?: KVNamespace;
  // Optional comma-separated extra hostnames allowed for the /ical route.
  ALLOWED_ICAL_HOSTS?: string;
}

const ALLOWED_ORIGINS = new Set([
  'https://calendar.willineau.org',
  'http://localhost:8080',
  'http://localhost:5173',
]);

const ALLOWED_HEADERS = [
  'Authorization',
  'Content-Type',
  'Notion-Version',
];

const ALLOWED_METHODS = 'GET,POST,PATCH,DELETE,OPTIONS';

// Host allowlists (suffix matched: an entry "google.com" also allows "calendar.google.com").
const ICAL_HOSTS = [
  'calendar.google.com',
  'www.google.com',
  'google.com',
  'outlook.live.com',
  'outlook.office365.com',
  'office365.com',
  'outlook.com',
  'live.com',
  'graph.microsoft.com',
  'icloud.com',
];

const PHOTOS_HOSTS = [
  'photos.google.com',
  'photos.app.goo.gl',
  'googleusercontent.com',
];

const NOTION_PAGE_HOSTS = [
  'notion.so',
  'notion.site',
];

// Per-IP rate limits: max requests per fixed window (seconds), per route.
const RATE_LIMITS: Record<string, { limit: number; windowSec: number }> = {
  ical: { limit: 30, windowSec: 60 },
  photos: { limit: 30, windowSec: 60 },
  'notion-page': { limit: 30, windowSec: 60 },
  notion: { limit: 120, windowSec: 60 },
};

// A browser-like UA so Google Photos / Notion return the full HTML share page.
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function getCorsHeaders(origin: string | null): Headers {
  const headers = new Headers();
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
  }
  headers.set('Access-Control-Allow-Methods', ALLOWED_METHODS);
  headers.set('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Vary', 'Origin');
  return headers;
}

function jsonError(message: string, status: number, corsHeaders: Headers): Response {
  const headers = new Headers(corsHeaders);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify({ error: message }), { status, headers });
}

function hostMatches(hostname: string, allow: string[]): boolean {
  const lower = hostname.toLowerCase();
  return allow.some((h) => lower === h || lower.endsWith('.' + h));
}

function parseHttpsUrl(raw: string | null): URL | null {
  if (!raw) return null;
  try {
    // Normalize webcal:// (common for iCal feeds) to https://
    const normalized = raw.replace(/^webcal:\/\//i, 'https://');
    const u = new URL(normalized);
    if (u.protocol !== 'https:') return null;
    return u;
  } catch {
    return null;
  }
}

function clientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For') ||
    'anon'
  );
}

// Fixed-window per-IP rate limiter backed by KV. Fails open if KV is unbound.
async function rateLimit(
  env: Env,
  ip: string,
  route: string,
): Promise<{ ok: boolean; retryAfter: number }> {
  const cfg = RATE_LIMITS[route];
  if (!env.RATE_LIMIT || !cfg) return { ok: true, retryAfter: 0 };

  const nowSec = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(nowSec / cfg.windowSec) * cfg.windowSec;
  const key = `rl:${route}:${ip}:${windowStart}`;

  const current = parseInt((await env.RATE_LIMIT.get(key)) || '0', 10) || 0;
  if (current >= cfg.limit) {
    return { ok: false, retryAfter: Math.max(windowStart + cfg.windowSec - nowSec, 1) };
  }
  await env.RATE_LIMIT.put(key, String(current + 1), {
    expirationTtl: cfg.windowSec + 5,
  });
  return { ok: true, retryAfter: 0 };
}

// Fetch the upstream URL with edge caching (Cache API), keyed on the resolved URL.
// Only successful (2xx) responses are cached. CORS headers are NOT stored here;
// they are added per-request by the caller so the cache stays origin-agnostic.
async function fetchCached(
  targetUrl: string,
  init: RequestInit,
  ttlSec: number,
  ctx: ExecutionContext,
): Promise<Response> {
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(targetUrl, { method: 'GET' });

  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const upstream = await fetch(targetUrl, init);
  if (!upstream.ok) return upstream;

  const body = await upstream.arrayBuffer();
  const headers = new Headers(upstream.headers);
  headers.delete('Set-Cookie');
  headers.set('Cache-Control', `public, max-age=${ttlSec}`);
  const stored = new Response(body, { status: upstream.status, headers });
  ctx.waitUntil(cache.put(cacheKey, stored.clone()));
  return stored;
}

async function handleGenericProxy(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  corsHeaders: Headers,
  opts: {
    route: string;
    allow: string[];
    ttlSec: number;
    contentType?: string;
    validate?: (body: string) => boolean;
  },
): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonError('Method not allowed', 405, corsHeaders);
  }

  const target = parseHttpsUrl(new URL(request.url).searchParams.get('url'));
  if (!target) {
    return jsonError('Missing or invalid https url parameter', 400, corsHeaders);
  }
  if (!hostMatches(target.hostname, opts.allow)) {
    return jsonError(`Host not allowed: ${target.hostname}`, 403, corsHeaders);
  }

  const rl = await rateLimit(env, clientIp(request), opts.route);
  if (!rl.ok) {
    const headers = new Headers(corsHeaders);
    headers.set('Retry-After', String(rl.retryAfter));
    return jsonError('Rate limit exceeded', 429, headers);
  }

  let upstream: Response;
  try {
    upstream = await fetchCached(
      target.toString(),
      {
        method: 'GET',
        redirect: 'follow',
        headers: {
          Accept: opts.contentType?.includes('calendar')
            ? 'text/calendar, text/plain, */*'
            : 'text/html, */*',
          'User-Agent': opts.contentType?.includes('calendar')
            ? 'FamilyCalendarICSProxy/1.0'
            : BROWSER_UA,
        },
      },
      opts.ttlSec,
      ctx,
    );
  } catch (e) {
    return jsonError(
      'Upstream fetch failed: ' + (e instanceof Error ? e.message : 'unknown'),
      502,
      corsHeaders,
    );
  }

  if (!upstream.ok) {
    return jsonError(`Upstream responded ${upstream.status}`, 502, corsHeaders);
  }

  const text = await upstream.text();
  if (opts.validate && !opts.validate(text)) {
    return jsonError('Upstream response failed validation', 422, corsHeaders);
  }

  const headers = new Headers(corsHeaders);
  const upstreamType = upstream.headers.get('content-type');
  headers.set('Content-Type', opts.contentType || upstreamType || 'text/plain; charset=utf-8');
  headers.set('Cache-Control', `public, max-age=${opts.ttlSec}`);
  return new Response(text, { status: 200, headers });
}

async function handleNotion(request: Request, env: Env, corsHeaders: Headers): Promise<Response> {
  const rl = await rateLimit(env, clientIp(request), 'notion');
  if (!rl.ok) {
    const headers = new Headers(corsHeaders);
    headers.set('Retry-After', String(rl.retryAfter));
    return jsonError('Rate limit exceeded', 429, headers);
  }

  const url = new URL(request.url);
  const notionPath = url.pathname.replace('/notion', '');
  const notionUrl = `https://api.notion.com/v1${notionPath}${url.search}`;

  const headers = new Headers(request.headers);
  headers.delete('Origin');
  headers.set('Host', 'api.notion.com');

  const init: RequestInit = {
    method: request.method,
    headers,
    body:
      request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : await request.text(),
  };

  const response = await fetch(notionUrl, init);
  const proxyHeaders = new Headers(response.headers);
  corsHeaders.forEach((value, key) => proxyHeaders.set(key, value));

  return new Response(response.body, {
    status: response.status,
    headers: proxyHeaders,
  });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const { pathname } = url;

    if (pathname.startsWith('/notion/')) {
      return handleNotion(request, env, corsHeaders);
    }

    if (pathname === '/ical') {
      return handleGenericProxy(request, env, ctx, corsHeaders, {
        route: 'ical',
        allow: [
          ...ICAL_HOSTS,
          ...(env.ALLOWED_ICAL_HOSTS || '')
            .split(',')
            .map((h) => h.trim())
            .filter(Boolean),
        ],
        ttlSec: 600,
        contentType: 'text/calendar; charset=utf-8',
        validate: (body) => /BEGIN:VCALENDAR/i.test(body),
      });
    }

    if (pathname === '/photos') {
      return handleGenericProxy(request, env, ctx, corsHeaders, {
        route: 'photos',
        allow: PHOTOS_HOSTS,
        ttlSec: 21600,
        contentType: 'text/html; charset=utf-8',
      });
    }

    if (pathname === '/notion-page') {
      return handleGenericProxy(request, env, ctx, corsHeaders, {
        route: 'notion-page',
        allow: NOTION_PAGE_HOSTS,
        ttlSec: 600,
        contentType: 'text/html; charset=utf-8',
      });
    }

    return new Response('Not found', { status: 404, headers: corsHeaders });
  },
};
