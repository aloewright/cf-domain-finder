import { Env, json } from "./shared";
import { requireUser } from "./auth";

type BookmarkBody = { name?: string; domain?: string; price?: string; currency?: string };

const DOMAIN_RE = /^[a-z0-9-]+\.[a-z0-9.]+$/;

export async function handleListBookmarks(request: Request, env: Env) {
  const userId = await requireUser(request, env);
  if (!userId) return json({ error: "Not authenticated" }, { status: 401 });
  const result = await env.DB.prepare(
    "SELECT name, domain, price, currency, created_at FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC"
  )
    .bind(userId)
    .all();
  return json({ bookmarks: result.results ?? [] });
}

export async function handleAddBookmark(request: Request, env: Env) {
  const userId = await requireUser(request, env);
  if (!userId) return json({ error: "Not authenticated" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as BookmarkBody;
  const name = (body.name ?? "").trim().slice(0, 64);
  const domain = (body.domain ?? "").trim().toLowerCase().slice(0, 253);
  if (!name || !DOMAIN_RE.test(domain)) return json({ error: "Invalid bookmark" }, { status: 400 });

  const price = body.price ? String(body.price).slice(0, 16) : null;
  const currency = body.currency ? String(body.currency).slice(0, 8) : null;

  await env.DB.prepare(
    "INSERT OR IGNORE INTO bookmarks (id, user_id, name, domain, price, currency, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(crypto.randomUUID(), userId, name, domain, price, currency, Date.now())
    .run();

  return json({ ok: true, domain });
}

export async function handleDeleteBookmark(request: Request, env: Env) {
  const userId = await requireUser(request, env);
  if (!userId) return json({ error: "Not authenticated" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as BookmarkBody;
  const domain = (body.domain ?? "").trim().toLowerCase();
  if (!domain) return json({ error: "Missing domain" }, { status: 400 });

  await env.DB.prepare("DELETE FROM bookmarks WHERE user_id = ? AND domain = ?")
    .bind(userId, domain)
    .run();

  return json({ ok: true, domain });
}
