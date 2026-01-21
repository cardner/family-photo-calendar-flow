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

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (!url.pathname.startsWith('/notion/')) {
      return new Response('Not found', { status: 404, headers: corsHeaders });
    }

    const notionPath = url.pathname.replace('/notion', '');
    const notionUrl = `https://api.notion.com/v1${notionPath}${url.search}`;

    const headers = new Headers(request.headers);
    headers.delete('Origin');
    headers.set('Host', 'api.notion.com');

    const init: RequestInit = {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text(),
    };

    const response = await fetch(notionUrl, init);
    const proxyHeaders = new Headers(response.headers);
    corsHeaders.forEach((value, key) => proxyHeaders.set(key, value));

    return new Response(response.body, {
      status: response.status,
      headers: proxyHeaders,
    });
  },
};
