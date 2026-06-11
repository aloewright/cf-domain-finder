<a href="https://copythe.link"><img src="assets/banner.svg" alt="copythe.link — find available domains on Cloudflare" width="100%"></a>

<p>
  <a href="https://copythe.link"><img alt="Live demo" src="https://img.shields.io/badge/Live%20demo-copythe.link-00b0c0?style=flat-square&logo=cloudflare&logoColor=white&labelColor=555"></a>
  <a href="https://copythe.link"><img alt="Cloudflare Workers" src="https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white&labelColor=555"></a>
  <a href="https://copythe.link"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white&labelColor=555"></a>
  <img alt="License: ISC" src="https://img.shields.io/badge/License-ISC-blue?style=flat-square&labelColor=555">
</p>

# copythe.link — Cloudflare Domain Finder

A free, open-source naming tool that runs entirely on Cloudflare. Describe what you're building; it generates brandable names with AI, confirms live availability and at-cost pricing through the Cloudflare Registrar API, and helps you pick: thumbs-up/down feedback steers the next batch, name-style filters (invented / real words / compound / playful / professional), simulated audience testing per name, pronunciation, GitHub-handle checks, trademark screening links, domain hacks, and per-account bookmarks.

Live at **[copythe.link](https://copythe.link)**.

## How it works

One Cloudflare Worker serves everything — the UI is an inlined HTML document (no build step, no framework), and the API routes live beside it:

- **Name generation** (`/api/names`): one slow, quality-first AI call fills a pool of ~72 names the client paginates through. Tries `@cf/openai/gpt-oss-120b` (Responses API, low reasoning effort), falls back to Llama 3.1 8B, then to a deterministic generator, then to a bottomless syllable synthesizer — the API never returns an empty list.
- **Enrichment** (`/api/enrich`): for each page of ~24 names, checks domain availability and pricing (Registrar API, batched 20 per call), generates taglines + brief-fit ratings + style tags (one batched AI call), and checks GitHub handle availability. No AI call per scroll — pages stay ~1–2s.
- **Drill-downs**: audience testing (`/api/audience`, simulated personas react to a name), App Store collision counts (`/api/appstore`, user-initiated — one click, one iTunes call), grounding via web search (`/api/ground`, optional Brave key).
- **Accounts**: D1 + PBKDF2 password hashing + HMAC-signed httpOnly session cookies. Bookmarks per user. The hot path verifies sessions with crypto only — no database read per request.
- All model calls route through [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/) for caching (request-body keyed — repeat audience tests are free), observability, and cost analytics.

## Self-hosting on Cloudflare

You need a Cloudflare account (free plan works; the paid Workers plan is recommended for the higher subrequest limits), Node 20+, and `npm`.

### 1. Clone and install

```bash
git clone https://github.com/aloewright/cf-domain-finder.git
cd cf-domain-finder
npm ci
```

### 2. Create the D1 database

```bash
npx wrangler d1 create domain-finder-db
```

Copy the printed `database_id` into `wrangler.jsonc` (replace the existing `d1_databases` entry's `database_id`, and set `database_name` to the name you chose). Then apply the schema:

```bash
npx wrangler d1 execute domain-finder-db --file=schema.sql --remote
```

### 3. Create an AI Gateway

The code routes Workers AI calls through a gateway named `x` (see `gateway: { id: "x" }` in `src/index.ts`). Create one: Cloudflare dashboard → AI → AI Gateway → Create gateway → name it `x` (or pick your own name and update the references in `src/index.ts`). The gateway is free and gives you caching + a request log for every model call.

The Workers AI binding itself (`ai` in `wrangler.jsonc`) needs no setup — it works with any account.

### 4. Set secrets

```bash
# Required: signs session cookies
openssl rand -hex 32 | npx wrangler secret put AUTH_SECRET

# Required for real availability + pricing (otherwise domains show "unknown"):
# the Registrar API (beta) authenticates with your Global API Key
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID   # dashboard → Workers → account ID
npx wrangler secret put CLOUDFLARE_EMAIL        # your account email
npx wrangler secret put CLOUDFLARE_API_KEY      # dashboard → My Profile → API Tokens → Global API Key

# Optional: web-grounding drill-down via Brave Search
npx wrangler secret put BRAVE_API_KEY
```

Note on the Registrar API: the domain-check endpoint is a beta that prices domains at cost. It authenticates with the Global API Key (not a scoped token). If you skip these secrets the app still works — names generate and score, but availability columns show as unchecked.

### 5. Deploy

```bash
npm run deploy
```

Wrangler prints your `*.workers.dev` URL. For a custom domain, add a route or custom domain to the Worker in the dashboard (Workers & Pages → your worker → Settings → Domains & Routes).

### Local development

```bash
npm run dev     # wrangler dev — local Worker with remote AI/D1 bindings
npm run check   # typecheck
```

If you manage secrets with [Doppler](https://doppler.com), `doppler run -- npm run dev` works as expected; secrets set via `wrangler secret put` are the source of truth for the deployed Worker.

### Costs

- Workers AI: pay-per-token (gpt-oss-120b is $0.35/M in, $0.75/M out; one pool generation is a few thousand tokens)
- AI Gateway, D1, and the Worker itself: free tier covers a personal instance comfortably
- Registrar checks, GitHub checks: free API calls

### Known limitation

Apple's iTunes Search API rejects requests from Cloudflare's shared egress IPs, so the App Store collision check usually reports no signal ("—") when self-hosted on Workers. The check is deliberately user-initiated (one click, one call) and scores stay neutral without it. If the signal matters to you, proxy that one endpoint through a host with a dedicated IP.

## Architecture notes

- `src/index.ts` — Worker entry: all API routes, AI calls, scoring, registrar/GitHub checks
- `src/html.ts` — the entire UI as an inlined template string (vanilla JS, no build)
- `src/auth.ts` — PBKDF2 + HMAC session cookies; `src/bookmarks.ts` — bookmark CRUD
- `src/nunito.ts` — the Nunito font, base64-inlined and served with immutable caching (no Google Fonts)
- `schema.sql` — D1 schema: users, bookmarks, chat sessions/messages

A longer write-up of the architecture and performance decisions: [Building a domain finder that runs entirely on Cloudflare](https://howto.makethe.app/posts/building-copythe-link-on-cloudflare).

## License

ISC
