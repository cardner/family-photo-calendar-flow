var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// workers/proxy.ts
var ALLOWED_ORIGINS = /* @__PURE__ */ new Set([
  "https://calendar.willineau.org",
  "http://localhost:8080",
  "http://localhost:5173"
]);
var ALLOWED_HEADERS = [
  "Authorization",
  "Content-Type",
  "Notion-Version"
];
var ALLOWED_METHODS = "GET,POST,PATCH,DELETE,OPTIONS";
var ICAL_HOSTS = [
  "calendar.google.com",
  "www.google.com",
  "google.com",
  "outlook.live.com",
  "outlook.office365.com",
  "office365.com",
  "outlook.com",
  "live.com",
  "graph.microsoft.com",
  "icloud.com"
];
var PHOTOS_HOSTS = [
  "photos.google.com",
  "photos.app.goo.gl",
  "googleusercontent.com"
];
var NOTION_PAGE_HOSTS = [
  "notion.so",
  "notion.site"
];
var RATE_LIMITS = {
  ical: { limit: 30, windowSec: 60 },
  photos: { limit: 30, windowSec: 60 },
  "notion-page": { limit: 30, windowSec: 60 },
  notion: { limit: 120, windowSec: 60 }
};
var BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
function getCorsHeaders(origin) {
  const headers = new Headers();
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
  headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS.join(", "));
  headers.set("Access-Control-Allow-Credentials", "true");
  headers.set("Vary", "Origin");
  return headers;
}
__name(getCorsHeaders, "getCorsHeaders");
function jsonError(message, status, corsHeaders) {
  const headers = new Headers(corsHeaders);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify({ error: message }), { status, headers });
}
__name(jsonError, "jsonError");
function hostMatches(hostname, allow) {
  const lower = hostname.toLowerCase();
  return allow.some((h) => lower === h || lower.endsWith("." + h));
}
__name(hostMatches, "hostMatches");
function parseHttpsUrl(raw) {
  if (!raw) return null;
  try {
    const normalized = raw.replace(/^webcal:\/\//i, "https://");
    const u = new URL(normalized);
    if (u.protocol !== "https:") return null;
    return u;
  } catch {
    return null;
  }
}
__name(parseHttpsUrl, "parseHttpsUrl");
function clientIp(request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "anon";
}
__name(clientIp, "clientIp");
async function rateLimit(env, ip, route) {
  const cfg = RATE_LIMITS[route];
  if (!env.RATE_LIMIT || !cfg) return { ok: true, retryAfter: 0 };
  const nowSec = Math.floor(Date.now() / 1e3);
  const windowStart = Math.floor(nowSec / cfg.windowSec) * cfg.windowSec;
  const key = `rl:${route}:${ip}:${windowStart}`;
  const current = parseInt(await env.RATE_LIMIT.get(key) || "0", 10) || 0;
  if (current >= cfg.limit) {
    return { ok: false, retryAfter: Math.max(windowStart + cfg.windowSec - nowSec, 1) };
  }
  await env.RATE_LIMIT.put(key, String(current + 1), {
    expirationTtl: cfg.windowSec + 5
  });
  return { ok: true, retryAfter: 0 };
}
__name(rateLimit, "rateLimit");
async function fetchCached(targetUrl, init, ttlSec, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(targetUrl, { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;
  const upstream = await fetch(targetUrl, init);
  if (!upstream.ok) return upstream;
  const body = await upstream.arrayBuffer();
  const headers = new Headers(upstream.headers);
  headers.delete("Set-Cookie");
  headers.set("Cache-Control", `public, max-age=${ttlSec}`);
  const stored = new Response(body, { status: upstream.status, headers });
  ctx.waitUntil(cache.put(cacheKey, stored.clone()));
  return stored;
}
__name(fetchCached, "fetchCached");
async function handleGenericProxy(request, env, ctx, corsHeaders, opts) {
  if (request.method !== "GET") {
    return jsonError("Method not allowed", 405, corsHeaders);
  }
  const target = parseHttpsUrl(new URL(request.url).searchParams.get("url"));
  if (!target) {
    return jsonError("Missing or invalid https url parameter", 400, corsHeaders);
  }
  if (!hostMatches(target.hostname, opts.allow)) {
    return jsonError(`Host not allowed: ${target.hostname}`, 403, corsHeaders);
  }
  const rl = await rateLimit(env, clientIp(request), opts.route);
  if (!rl.ok) {
    const headers2 = new Headers(corsHeaders);
    headers2.set("Retry-After", String(rl.retryAfter));
    return jsonError("Rate limit exceeded", 429, headers2);
  }
  let upstream;
  try {
    upstream = await fetchCached(
      target.toString(),
      {
        method: "GET",
        redirect: "follow",
        headers: {
          Accept: opts.contentType?.includes("calendar") ? "text/calendar, text/plain, */*" : "text/html, */*",
          "User-Agent": opts.contentType?.includes("calendar") ? "FamilyCalendarICSProxy/1.0" : BROWSER_UA
        }
      },
      opts.ttlSec,
      ctx
    );
  } catch (e) {
    return jsonError(
      "Upstream fetch failed: " + (e instanceof Error ? e.message : "unknown"),
      502,
      corsHeaders
    );
  }
  if (!upstream.ok) {
    return jsonError(`Upstream responded ${upstream.status}`, 502, corsHeaders);
  }
  const text = await upstream.text();
  if (opts.validate && !opts.validate(text)) {
    return jsonError("Upstream response failed validation", 422, corsHeaders);
  }
  const headers = new Headers(corsHeaders);
  const upstreamType = upstream.headers.get("content-type");
  headers.set("Content-Type", opts.contentType || upstreamType || "text/plain; charset=utf-8");
  headers.set("Cache-Control", `public, max-age=${opts.ttlSec}`);
  return new Response(text, { status: 200, headers });
}
__name(handleGenericProxy, "handleGenericProxy");
async function handleNotion(request, env, corsHeaders) {
  const rl = await rateLimit(env, clientIp(request), "notion");
  if (!rl.ok) {
    const headers2 = new Headers(corsHeaders);
    headers2.set("Retry-After", String(rl.retryAfter));
    return jsonError("Rate limit exceeded", 429, headers2);
  }
  const url = new URL(request.url);
  const notionPath = url.pathname.replace("/notion", "");
  const notionUrl = `https://api.notion.com/v1${notionPath}${url.search}`;
  const headers = new Headers(request.headers);
  headers.delete("Origin");
  headers.set("Host", "api.notion.com");
  const init = {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? void 0 : await request.text()
  };
  const response = await fetch(notionUrl, init);
  const proxyHeaders = new Headers(response.headers);
  corsHeaders.forEach((value, key) => proxyHeaders.set(key, value));
  return new Response(response.body, {
    status: response.status,
    headers: proxyHeaders
  });
}
__name(handleNotion, "handleNotion");
var proxy_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const corsHeaders = getCorsHeaders(origin);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    const { pathname } = url;
    if (pathname.startsWith("/notion/")) {
      return handleNotion(request, env, corsHeaders);
    }
    if (pathname === "/ical") {
      return handleGenericProxy(request, env, ctx, corsHeaders, {
        route: "ical",
        allow: [
          ...ICAL_HOSTS,
          ...(env.ALLOWED_ICAL_HOSTS || "").split(",").map((h) => h.trim()).filter(Boolean)
        ],
        ttlSec: 600,
        contentType: "text/calendar; charset=utf-8",
        validate: /* @__PURE__ */ __name((body) => /BEGIN:VCALENDAR/i.test(body), "validate")
      });
    }
    if (pathname === "/photos") {
      return handleGenericProxy(request, env, ctx, corsHeaders, {
        route: "photos",
        allow: PHOTOS_HOSTS,
        ttlSec: 21600,
        contentType: "text/html; charset=utf-8"
      });
    }
    if (pathname === "/notion-page") {
      return handleGenericProxy(request, env, ctx, corsHeaders, {
        route: "notion-page",
        allow: NOTION_PAGE_HOSTS,
        ttlSec: 600,
        contentType: "text/html; charset=utf-8"
      });
    }
    return new Response("Not found", { status: 404, headers: corsHeaders });
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError2;

// .wrangler/tmp/bundle-uUwl4W/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = proxy_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-uUwl4W/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=proxy.js.map
