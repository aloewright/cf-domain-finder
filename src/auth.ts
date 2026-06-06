import { Env, json } from "./shared";

// ---------- low-level crypto helpers ----------

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64url(bytes: Uint8Array): string {
  return bytesToB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Constant-time string comparison.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const PBKDF2_ITERATIONS = 100000;

async function deriveHash(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256
  );
  return bytesToB64(new Uint8Array(bits));
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveHash(password, salt);
  return { hash, salt: bytesToB64(salt) };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const candidate = await deriveHash(password, b64ToBytes(salt));
  return timingSafeEqual(candidate, hash);
}

// ---------- signed session cookie ----------

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

async function hmac(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64url(new Uint8Array(sig));
}

async function createSessionToken(userId: string, secret: string): Promise<string> {
  const exp = Date.now() + SESSION_TTL_MS;
  const payload = `${userId}.${exp}`;
  return `${payload}.${await hmac(payload, secret)}`;
}

async function verifySessionToken(token: string, secret: string): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const expected = await hmac(`${userId}.${expStr}`, secret);
  if (!timingSafeEqual(sig, expected)) return null;
  if (!Number(expStr) || Date.now() > Number(expStr)) return null;
  return userId;
}

function sessionCookie(token: string): string {
  return `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}`;
}

function clearedCookie(): string {
  return `session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

// Returns the authenticated user id, or null.
export async function requireUser(request: Request, env: Env): Promise<string | null> {
  if (!env.AUTH_SECRET) return null;
  const token = readCookie(request, "session");
  if (!token) return null;
  return verifySessionToken(token, env.AUTH_SECRET);
}

// ---------- request handlers ----------

type SignupBody = { name?: string; email?: string; password?: string };

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export async function handleSignup(request: Request, env: Env) {
  if (!env.AUTH_SECRET) return json({ error: "Auth not configured" }, { status: 500 });
  const body = (await request.json().catch(() => ({}))) as SignupBody;
  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  if (!name) return json({ error: "Name is required" }, { status: 400 });
  if (!validEmail(email)) return json({ error: "Enter a valid email" }, { status: 400 });
  if (password.length < 8) return json({ error: "Password must be at least 8 characters" }, { status: 400 });

  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return json({ error: "An account with that email already exists" }, { status: 409 });

  const { hash, salt } = await hashPassword(password);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO users (id, email, name, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(id, email, name, hash, salt, Date.now())
    .run();

  const token = await createSessionToken(id, env.AUTH_SECRET);
  return json({ user: { id, name, email } }, { headers: { "set-cookie": sessionCookie(token) } });
}

export async function handleLogin(request: Request, env: Env) {
  if (!env.AUTH_SECRET) return json({ error: "Auth not configured" }, { status: 500 });
  const body = (await request.json().catch(() => ({}))) as SignupBody;
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  const user = (await env.DB.prepare(
    "SELECT id, name, email, password_hash, password_salt FROM users WHERE email = ?"
  )
    .bind(email)
    .first()) as
    | { id: string; name: string; email: string; password_hash: string; password_salt: string }
    | null;

  // Generic message — do not reveal whether the email exists.
  const bad = () => json({ error: "Incorrect email or password" }, { status: 401 });
  if (!user) {
    // Spend a hash anyway to blunt timing-based user enumeration.
    await deriveHash(password, new Uint8Array(16));
    return bad();
  }
  if (!(await verifyPassword(password, user.password_hash, user.password_salt))) return bad();

  const token = await createSessionToken(user.id, env.AUTH_SECRET);
  return json(
    { user: { id: user.id, name: user.name, email: user.email } },
    { headers: { "set-cookie": sessionCookie(token) } }
  );
}

export async function handleLogout() {
  return json({ ok: true }, { headers: { "set-cookie": clearedCookie() } });
}

export async function handleMe(request: Request, env: Env) {
  const userId = await requireUser(request, env);
  if (!userId) return json({ error: "Not authenticated" }, { status: 401 });
  const user = (await env.DB.prepare("SELECT id, name, email FROM users WHERE id = ?")
    .bind(userId)
    .first()) as { id: string; name: string; email: string } | null;
  if (!user) return json({ error: "Not authenticated" }, { status: 401 });
  return json({ user });
}
