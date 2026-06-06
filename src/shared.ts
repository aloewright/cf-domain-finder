export interface Env {
  BRAVE_API_KEY?: string;
  AI: any;
  // AI Gateway token (cf-aig-authorization) used by ai-gateway-provider for dynamic routes.
  CF_AIG_TOKEN?: string;
  // Cloudflare Registrar API (beta) auth — Global API Key (account owner's choice).
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_EMAIL?: string;
  CLOUDFLARE_API_KEY?: string;
  // HMAC secret for signing session cookies (synced from Doppler).
  AUTH_SECRET?: string;
  // D1 database: users + bookmarks.
  DB: D1Database;
}

export function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers ?? {})
    }
  });
}
