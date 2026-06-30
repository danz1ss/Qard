import { isRateLimited, markUsed, KVLike } from './ratelimit';

const PROXYAPI_BASE = 'https://api.proxyapi.ru/openai/v1';
const ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'https://qard-7rn.pages.dev',
];

interface Env {
  PROXYAPI_KEY: string;
  RL: KVLike;
  MAX_BODY_BYTES?: string;
  MAX_TOKENS?: string;
}

function corsHeaders(origin: string | null): HeadersInit {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[1];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders(origin) });
    }

    const body = await request.text();
    const maxBytes = Number(env.MAX_BODY_BYTES ?? '16384');
    if (body.length > maxBytes) {
      return json({ error: 'too_large' }, 413, origin);
    }

    const userAuth = request.headers.get('Authorization');
    const now = new Date();
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

    // Бесплатный режим (без своего ключа): проверяем дневной лимит.
    if (!userAuth) {
      if (await isRateLimited(env.RL, ip, now)) {
        return json({ error: 'daily_limit' }, 429, origin);
      }
    }

    // Подставляем ключ + потолок max_tokens.
    let payload: any;
    try {
      payload = JSON.parse(body);
    } catch {
      return json({ error: 'bad_json' }, 400, origin);
    }
    const maxTokens = Number(env.MAX_TOKENS ?? '8000');
    if (typeof payload.max_tokens !== 'number' || payload.max_tokens > maxTokens) {
      payload.max_tokens = maxTokens;
    }

    const auth = userAuth || `Bearer ${env.PROXYAPI_KEY}`;
    const upstream = await fetch(`${PROXYAPI_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: auth },
      body: JSON.stringify(payload),
    });
    const text = await upstream.text();

    // Списываем дневную попытку только при успехе бесплатного запроса.
    if (!userAuth && upstream.ok) {
      await markUsed(env.RL, ip, now);
    }

    return new Response(text, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  },
};
