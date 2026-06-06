# Accounts, Bookmarks, Live Seed Suggestions, Expanded TLDs — Design

Date: 2026-06-05
Status: Approved (pending spec review)

## Summary

Three features on top of the existing Nomenclature Worker:

1. **Account gate + bookmarks** — users must sign up / log in (name, email, password) before
   seeing results; once authenticated they can bookmark specific available domains.
2. **Live seed suggestions** — as the user types seed words, short (<5 char) associated words
   are suggested via an AI call to the `dynamic/fast` gateway route, shown as clickable chips.
3. **Expanded TLDs** — the results-page TLD selector grows to a curated set of popular
   Cloudflare-supported, API-priced TLDs.

Plus an approved tweak: **"Hide taken domains" defaults to ON.**

## Storage — Cloudflare D1

New D1 database `nomenclature-db`, bound as `env.DB`. Provisioned with `wrangler d1 create`,
binding added to `wrangler.jsonc`, schema applied via `wrangler d1 execute --remote`.

```sql
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,        -- uuid (crypto.randomUUID)
  email         TEXT UNIQUE NOT NULL,    -- stored lowercased
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,           -- base64 PBKDF2 derived key
  password_salt TEXT NOT NULL,           -- base64 per-user salt
  created_at    INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS bookmarks (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL,              -- brand name, e.g. "Portcontext"
  domain     TEXT NOT NULL,              -- e.g. "portcontext.com"
  price      TEXT,                       -- registration_cost at save time
  currency   TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS bookmarks_user_domain ON bookmarks(user_id, domain);
```

## Sessions

Stateless **signed cookie**, no sessions table.

- Cookie `session = base64url(userId) + "." + expiryMs + "." + hmac`
  where `hmac = HMAC-SHA256(AUTH_SECRET, userId + "." + expiryMs)` (hex/base64url).
- Attributes: `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000` (30 days).
- Verified on every authed request: split, recompute HMAC (constant-time compare), check expiry.
- `AUTH_SECRET` synced from Doppler to a Worker secret.

## Password hashing

WebCrypto PBKDF2:
- 16-byte random salt per user, SHA-256, **100,000 iterations**, 32-byte derived key.
- Store base64(salt) and base64(key). Verify by re-deriving and timing-safe comparison.
- Never store or log plaintext.

## 1 — Auth + bookmarks

### Endpoints
- `POST /api/signup` `{name, email, password}` → validate (email regex, password ≥ 8, name
  non-empty), reject duplicate email (409), create user, set session cookie, return `{user:{id,name,email}}`.
- `POST /api/login` `{email, password}` → verify hash, set cookie, return `{user}`; generic 401 on
  bad creds (no user-enumeration distinction).
- `POST /api/logout` → clear cookie.
- `GET /api/me` → `{user}` from cookie, or 401.
- `GET /api/bookmarks` → list current user's bookmarks (auth required, else 401).
- `POST /api/bookmarks` `{name, domain, price, currency}` → upsert (idempotent on user+domain).
- `DELETE /api/bookmarks` `{domain}` → remove.

`/api/suggest` becomes **auth-required** (401 if no valid session) — this is the gate.

### Frontend flow
- On load, call `GET /api/me` to learn auth state; if logged in show a header "Saved (N)" control.
- Clicking **Generate Names** while logged out shows an **auth card** (overlay): Sign-up form
  (name/email/password) by default, with a "Log in" toggle (email/password). On success, the
  card closes and generation proceeds automatically. Logged-in users skip straight to results.
- Each **available** domain row gets a **bookmark icon**; toggling it calls POST/DELETE
  `/api/bookmarks`. Bookmarked state is reflected on the icon. A header **"Saved (N)"** button
  opens a panel listing saved domains (name, domain, price, Buy link, remove).

## 2 — Live seed suggestions

- `POST /api/associate` `{seeds}` (auth not required — runs inside the wizard before the gate)
  → builds a prompt for `dynamic/fast` via the existing `ai-gateway-provider` path → expects a
  JSON array of short words → server filters to lowercase alphabetic, length 2–4, dedupes,
  caps at ~8.
- Frontend: debounce 400ms on the Seed Words input; abort the in-flight request on each
  keystroke (AbortController); render results as clickable chips beneath the input (replacing
  the static suggestion chips); clicking a chip appends it to the seeds input.

## 3 — Expanded TLDs + hide-taken default

- Curated TLD list (~24): `com ai io dev app co net org xyz me tech store online site pro info
  biz design studio cloud sh gg live link`.
- Sidebar selector renders all; `.com` checked by default. Selected TLDs are checked per name
  (batched ≤20/request). TLDs the API can't price degrade to "—" gracefully.
- **`Hide taken domains` switch defaults to ON.**

## Provisioning steps

1. `wrangler d1 create nomenclature-db` → capture `database_id`, add `d1_databases` binding to
   `wrangler.jsonc`.
2. Apply `schema.sql` to the remote DB.
3. Sync `AUTH_SECRET` (Doppler → Worker secret).

## Code structure (refactor as we add)

`src/index.ts` is large; split as we extend:
- `src/html.ts` — the `INDEX_HTML` template (moved out of index.ts).
- `src/auth.ts` — password hashing, session cookie helpers, signup/login/logout/me handlers.
- `src/bookmarks.ts` — bookmark handlers.
- `src/db.ts` — D1 schema bootstrap + typed query helpers.
- `src/index.ts` — Env, router, domain/suggest/associate/font logic.
- `src/nunito.ts` — existing font module.

## Security notes

- PBKDF2 + HttpOnly/Secure/SameSite signed cookies — appropriate for a lead-gate, not enterprise SSO.
- Always serve over HTTPS (Cloudflare). Email lowercased + uniqueness enforced.

## Out of scope (YAGNI)

Password reset, email verification, OAuth, and login rate-limiting are out of scope for v1.
**Follow-up:** add basic login rate-limiting (per-IP/email attempt counter) before meaningful traffic.
