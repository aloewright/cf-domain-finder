import { createAiGateway } from "ai-gateway-provider";
import { createUnified } from "ai-gateway-provider/providers/unified";
import { generateText } from "ai";
import { NUNITO_WOFF2_BASE64 } from "./nunito";

interface Env {
  BRAVE_API_KEY?: string;
  AI: any;
  // AI Gateway token (cf-aig-authorization) used by ai-gateway-provider to call the
  // "dynamic/fast" dynamic route. Synced from Doppler.
  CF_AIG_TOKEN?: string;
  // Cloudflare Registrar API (beta): confirm domain availability + current pricing.
  // Authenticated with the account Global API Key (X-Auth-Email + X-Auth-Key) at the
  // account owner's explicit direction — the scoped API token lacks the Registrar
  // permission, while the Global API Key has account-wide access. All optional: when
  // unset the app degrades gracefully (availability shown as "unknown").
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_EMAIL?: string;
  CLOUDFLARE_API_KEY?: string;
}

type AppHit = {
  name: string;
  seller: string;
  url: string;
};

type WebHit = {
  title: string;
  url: string;
  description: string;
};

type GroundingData = {
  summary: string;
  associations: string[];
  linguisticScore: number;
  marketFitScore: number;
  relatedMeanings: string[];
};

type DomainInfo = {
  domain: string;
  tld: string;
  // null = unknown (no Registrar credentials, error, or timeout); true/false otherwise.
  available: boolean | null;
  registrationCost: string | null;
  renewalCost: string | null;
  currency: string | null;
  reason?: string;
  purchaseUrl: string;
};

type CandidateResult = {
  name: string;
  displayName: string;
  subtitle: string;
  score: number;
  verdict: "strong" | "usable" | "crowded" | "avoid";
  reasons: string[];
  appStore: {
    exact: AppHit[];
    close: AppHit[];
    resultCount: number;
  };
  web: {
    checked: boolean;
    hits: WebHit[];
  };
  grounding?: GroundingData;
};

type NamingContext = {
  brief: string;
  industry: string;
  audience: string;
  keywords: string[];
  aiKeywords: string[];
  avoid: string[];
};

const DEFAULT_SEEDS = [
  "port",
  "harbor",
  "dock",
  "quay",
  "channel",
  "relay",
  "link",
  "gate",
  "line",
  "light",
  "glass",
  "signal",
  "private",
  "context",
  "memory",
  "operator"
];

const PREFIXES = [
  "port",
  "harbor",
  "dock",
  "quay",
  "channel",
  "relay",
  "signal",
  "key",
  "north",
  "clear"
];

const SUFFIXES = [
  "light",
  "line",
  "lane",
  "link",
  "glass",
  "gate",
  "well",
  "way",
  "field",
  "smith",
  "mind",
  "beam",
  "bridge",
  "craft",
  "path"
];

const DEFAULT_TLDS = ["com"];
const ALLOWED_TLDS = ["com", "ai", "io", "dev", "app", "co"];

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function titleCase(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function brandCase(value: string) {
  const clean = value.replace(/[^a-zA-Z0-9]+/g, "");
  if (!clean) return "";
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.floor(value)))
    : fallback;
}

function parseWords(input: unknown) {
  const text = typeof input === "string" ? input : "";
  return unique(
    text
      .split(/[\n,;]+/)
      .flatMap((part) => part.split(/\s+/))
      .map((word) => word.toLowerCase().replace(/[^a-z0-9]/g, ""))
      .filter((word) => word.length >= 3 && word.length <= 18)
  );
}

function parseSeedWords(input: unknown) {
  return unique([...DEFAULT_SEEDS, ...parseWords(input)]);
}

// Sanitize requested TLDs: lowercase, strip dots, validate, dedupe, cap, default to .com.
function parseTlds(input: unknown): string[] {
  if (!Array.isArray(input)) return DEFAULT_TLDS;
  const cleaned = unique(
    input
      .map((tld) => String(tld).toLowerCase().replace(/[^a-z0-9]/g, ""))
      .filter((tld) => tld.length >= 2 && tld.length <= 10)
  ).slice(0, 6);
  return cleaned.length ? cleaned : DEFAULT_TLDS;
}

function suggestedKeywords(context: Omit<NamingContext, "aiKeywords">) {
  const text = normalize(
    [context.brief, context.industry, context.audience, context.keywords.join(" ")].join(" ")
  );
  const suggestions = new Set<string>();
  const conceptMap: Array<[RegExp, string[]]> = [
    [/private|privacy|secure|local|personal/, ["private", "secure", "local", "vault", "clear"]],
    [/ai|assistant|agent|operator|automation|workflow/, ["agent", "operator", "mind", "signal", "relay"]],
    [/memory|knowledge|context|recall|notes?/, ["memory", "context", "note", "archive", "field"]],
    [/file|document|pdf|workspace|project/, ["file", "workspace", "craft", "dock", "folder"]],
    [/mcp|connection|integration|api|tool|server/, ["port", "link", "bridge", "gate", "channel"]],
    [/founder|executive|professional|solo|developer|team/, ["office", "desk", "line", "north", "pilot"]],
    [/design|glass|liquid|visual|interface/, ["glass", "light", "clear", "pane", "lens"]],
    [/finance|legal|medical|health|compliance/, ["trust", "safe", "record", "ledger", "proof"]]
  ];

  for (const [pattern, words] of conceptMap) {
    if (pattern.test(text)) {
      words.forEach((word) => suggestions.add(word));
    }
  }

  return [...suggestions];
}

function buildContext(body: {
  brief?: string;
  industry?: string;
  audience?: string;
  keywords?: string;
  aiKeywords?: string;
  avoid?: string;
}): NamingContext {
  const partial = {
    brief: body.brief ?? "",
    industry: body.industry ?? "",
    audience: body.audience ?? "",
    keywords: parseWords(body.keywords),
    avoid: parseWords(body.avoid)
  };
  return {
    ...partial,
    aiKeywords: unique([...parseWords(body.aiKeywords), ...suggestedKeywords(partial)])
  };
}

function contextWords(context: NamingContext) {
  return unique([
    ...parseWords(context.brief),
    ...parseWords(context.industry),
    ...parseWords(context.audience),
    ...context.keywords,
    ...context.aiKeywords
  ]);
}

function visibleList(value: string[]) {
  return value.slice(0, 4).join(", ");
}

// Full, stable, deterministic candidate list. Paginated by handleSuggest for infinite
// scroll — no fixed cap, so scrolling keeps surfacing fresh names.
function generateCandidates(context: NamingContext, seedsInput: unknown) {
  const seeds = parseSeedWords(seedsInput);
  const words = contextWords(context);
  const avoidTerms = context.avoid.map(normalize);
  const prefixes = unique([...PREFIXES, ...seeds.slice(0, 16), ...words.slice(0, 14)]);
  const suffixes = unique([...SUFFIXES, ...seeds.slice(0, 16), ...words.slice(0, 14)]);
  const raw: string[] = [];

  for (const prefix of prefixes) {
    for (const suffix of suffixes) {
      if (prefix === suffix) continue;
      raw.push(`${prefix}${suffix}`);
    }
  }

  raw.push(
    "portlight",
    "portlane",
    "portline",
    "portwell",
    "portfield",
    "portbeam",
    "portbridge",
    "harborlight",
    "harborlane",
    "harborway",
    "quayline",
    "docklight",
    "relayport",
    "portmind",
    "portcraft",
    "clearport"
  );

  return unique(raw.map(brandCase).filter(Boolean))
    .filter((name) => name.length >= 5 && name.length <= 18)
    .filter((name) => !avoidTerms.some((term) => term && normalize(name).includes(term)));
}

async function checkAppStore(name: string): Promise<CandidateResult["appStore"]> {
  const empty: CandidateResult["appStore"] = { exact: [], close: [], resultCount: 0 };
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", name);
  url.searchParams.set("country", "US");
  url.searchParams.set("entity", "software");
  url.searchParams.set("limit", "25");

  try {
    // Bound the call so one slow/hung iTunes response can't stall a whole batch.
    const response = await fetch(url, {
      headers: { "user-agent": "PortlightNamefinder/0.1" },
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) {
      return empty;
    }

    const payload = (await response.json()) as {
      resultCount?: number;
      results?: Array<{
        trackName?: string;
        sellerName?: string;
        trackViewUrl?: string;
      }>;
    };
    const results = payload.results ?? [];
    const exact = results
      .filter((result) => normalize(result.trackName ?? "") === normalize(name))
      .map((result) => ({
        name: result.trackName ?? "",
        seller: result.sellerName ?? "",
        url: result.trackViewUrl ?? ""
      }));
    const close = results
      .filter((result) => normalize(result.trackName ?? "") !== normalize(name))
      .slice(0, 6)
      .map((result) => ({
        name: result.trackName ?? "",
        seller: result.sellerName ?? "",
        url: result.trackViewUrl ?? ""
      }));
    return { exact, close, resultCount: payload.resultCount ?? results.length };
  } catch {
    return empty;
  }
}

async function checkWeb(name: string, env: Env): Promise<CandidateResult["web"]> {
  if (!env.BRAVE_API_KEY) {
    return { checked: false, hits: [] };
  }

  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", `"${name}" app OR software OR AI`);
  url.searchParams.set("count", "6");
  url.searchParams.set("safesearch", "moderate");

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "x-subscription-token": env.BRAVE_API_KEY
      },
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) {
      return { checked: false, hits: [] };
    }

    const payload = (await response.json()) as {
      web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
    };

    return {
      checked: true,
      hits: (payload.web?.results ?? []).slice(0, 6).map((result) => ({
        title: result.title ?? "",
        url: result.url ?? "",
        description: result.description ?? ""
      }))
    };
  } catch {
    return { checked: false, hits: [] };
  }
}

// A meaningful 2-100 composite that actually varies across names: weighted on App Store
// crowdedness and (now that we have it) real domain availability, plus a length nudge.
function cardScore(
  name: string,
  appStoreCount: number,
  domains: DomainInfo[],
  context: NamingContext
) {
  let score = 58;

  if (appStoreCount === 0) score += 18;
  else if (appStoreCount <= 5) score += 10;
  else if (appStoreCount <= 12) score += 2;
  else if (appStoreCount <= 20) score -= 8;
  else score -= 18;

  const comAvailable = domains.some((d) => d.tld === "com" && d.available === true);
  const anyAvailable = domains.some((d) => d.available === true);
  const anyTaken = domains.some((d) => d.available === false);
  if (comAvailable) score += 22;
  else if (anyAvailable) score += 12;
  else if (anyTaken) score -= 16;

  if (name.length <= 10) score += 6;
  else if (name.length >= 16) score -= 6;

  const normName = normalize(name);
  if (context.avoid.map(normalize).some((term) => term && normName.includes(term))) {
    score -= 50;
  }

  return Math.max(2, Math.min(100, Math.round(score)));
}

async function groundName(
  name: string,
  web: CandidateResult["web"],
  context: NamingContext,
  env: Env
): Promise<GroundingData> {
  if (!web.checked || web.hits.length === 0) {
    return {
      summary: "No web data available for grounding.",
      associations: [],
      linguisticScore: 70,
      marketFitScore: 60,
      relatedMeanings: ["General", "Unclaimed"]
    };
  }

  const snippets = web.hits.map((h) => `${h.title}: ${h.description}`).join("\\n");
  const prompt = `Analyze the product name "${name}" based on these search results and the project brief.

Brief: ${context.brief}
Search Snippets:
${snippets}

Return a JSON object with:
- summary: 1-sentence of what this name is currently associated with.
- associations: 3-5 short keywords/concepts found.
- linguisticScore: 0-100 based on sound and memorability.
- marketFitScore: 0-100 based on alignment with the brief.
- relatedMeanings: 3-5 thesaurus-style words.`;

  try {
    // Call the AI Gateway dynamic route "dynamic/fast" through the ai-gateway-provider
    // unified provider + Vercel AI SDK. This is the invocation that actually resolves a
    // dynamic route from a Worker. Auth is the gateway token CF_AIG_TOKEN.
    const aigateway = createAiGateway({
      accountId: env.CLOUDFLARE_ACCOUNT_ID ?? "",
      gateway: "x",
      apiKey: env.CF_AIG_TOKEN ?? ""
    });
    const unified = createUnified();

    const { text } = await generateText({
      model: aigateway(unified("dynamic/fast")),
      system: "You are a naming expert. Return only JSON.",
      prompt,
      abortSignal: AbortSignal.timeout(10000)
    });

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const parsed = JSON.parse(start >= 0 && end >= start ? text.slice(start, end + 1) : text);
    return {
      summary: parsed.summary || "",
      associations: parsed.associations || [],
      linguisticScore: parsed.linguisticScore || 70,
      marketFitScore: parsed.marketFitScore || 60,
      relatedMeanings: parsed.relatedMeanings || []
    };
  } catch (e) {
    return {
      summary: "Grounding analysis unavailable.",
      associations: [],
      linguisticScore: 70,
      marketFitScore: 60,
      relatedMeanings: []
    };
  }
}

// Cloudflare dashboard registration page. We deep-link here rather than calling the
// Registrar "register" endpoint directly: registration charges the account's default
// payment method and is non-refundable, so the purchase must be an explicit user action.
const PURCHASE_URL = "https://dash.cloudflare.com/?to=/:account/domains/registrations";

function unknownDomain(domain: string, tld: string): DomainInfo {
  return {
    domain,
    tld,
    available: null,
    registrationCost: null,
    renewalCost: null,
    currency: null,
    purchaseUrl: PURCHASE_URL
  };
}

// Confirm availability + current price for name x TLD combinations via the Cloudflare
// Registrar API (beta) "Check" endpoint (up to 20 domains/request). Bounded by a timeout
// and fully graceful: any missing credential, error, or timeout yields `available: null`
// (unknown) rather than failing the request. https://developers.cloudflare.com/registrar/registrar-api/
async function checkDomains(
  names: string[],
  tlds: string[],
  env: Env
): Promise<Map<string, DomainInfo[]>> {
  const byName = new Map<string, DomainInfo[]>();
  const lookup = new Map<string, { name: string; tld: string }>();
  const allDomains: string[] = [];

  for (const name of names) {
    const lower = name.toLowerCase();
    if (!byName.has(lower)) byName.set(lower, []);
    for (const tld of tlds) {
      const domain = `${lower}.${tld}`;
      if (!lookup.has(domain)) {
        lookup.set(domain, { name: lower, tld });
        allDomains.push(domain);
      }
      byName.get(lower)!.push(unknownDomain(domain, tld));
    }
  }

  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const email = env.CLOUDFLARE_EMAIL;
  const apiKey = env.CLOUDFLARE_API_KEY;
  if (!accountId || !email || !apiKey || allDomains.length === 0) {
    return byName;
  }

  await Promise.all(
    chunk(allDomains, 20).map(async (batch) => {
      try {
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/registrar/domain-check`,
          {
            method: "POST",
            headers: {
              "x-auth-email": email,
              "x-auth-key": apiKey,
              "content-type": "application/json"
            },
            body: JSON.stringify({ domains: batch }),
            signal: AbortSignal.timeout(8000)
          }
        );
        if (!response.ok) return;

        const payload = (await response.json()) as {
          result?: {
            domains?: Array<{
              name: string;
              registrable?: boolean;
              reason?: string;
              pricing?: { currency?: string; registration_cost?: string; renewal_cost?: string };
            }>;
          };
        };

        for (const entry of payload.result?.domains ?? []) {
          const ref = lookup.get(entry.name);
          if (!ref) continue;
          const list = byName.get(ref.name);
          if (!list) continue;
          const info: DomainInfo = {
            domain: entry.name,
            tld: ref.tld,
            available: entry.registrable ?? null,
            registrationCost: entry.pricing?.registration_cost ?? null,
            renewalCost: entry.pricing?.renewal_cost ?? null,
            currency: entry.pricing?.currency ?? null,
            reason: entry.reason,
            purchaseUrl: PURCHASE_URL
          };
          const idx = list.findIndex((d) => d.domain === entry.name);
          if (idx >= 0) list[idx] = info;
          else list.push(info);
        }
      } catch {
        // Leave this batch as "unknown" (already seeded above).
      }
    })
  );

  return byName;
}

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers ?? {})
    }
  });
}

function html() {
  return new Response(INDEX_HTML, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

// Self-hosted Nunito (variable woff2), packaged in the Worker — no external font CDN call.
let FONT_BYTES: ArrayBuffer | null = null;
function fontResponse() {
  if (!FONT_BYTES) {
    const bin = atob(NUNITO_WOFF2_BASE64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    FONT_BYTES = bytes.buffer as ArrayBuffer;
  }
  return new Response(FONT_BYTES, {
    headers: {
      "content-type": "font/woff2",
      "cache-control": "public, max-age=31536000, immutable"
    }
  });
}

async function handleSuggest(request: Request, env: Env) {
  const body = (await request.json().catch(() => ({}))) as {
    brief?: string;
    industry?: string;
    audience?: string;
    keywords?: string;
    aiKeywords?: string;
    avoid?: string;
    seeds?: string;
    count?: number;
    offset?: number;
    tlds?: unknown;
  };

  const context = buildContext(body);
  const candidates = generateCandidates(context, body.seeds);
  const count = clampInt(body.count, 4, 24, 12);
  const offset = clampInt(body.offset, 0, 100000, 0);
  const tlds = parseTlds(body.tlds);
  const page = candidates.slice(offset, offset + count);

  // App Store competition stat per name, plus real domain availability for the page.
  const [appStores, domainMap] = await Promise.all([
    Promise.all(page.map((name) => checkAppStore(name))),
    checkDomains(page, tlds, env)
  ]);

  const results = page.map((name, index) => {
    const appStoreCount = appStores[index].resultCount;
    const domains = domainMap.get(name.toLowerCase()) ?? [];
    return {
      name,
      displayName: `${name} — Private AI`,
      score: cardScore(name, appStoreCount, domains, context),
      appStoreCount,
      domains
    };
  });

  return json({
    results,
    offset,
    nextOffset: offset + count,
    hasMore: offset + count < candidates.length,
    total: candidates.length,
    tlds,
    aiKeywords: context.aiKeywords
  });
}

async function handleCheck(request: Request, env: Env) {
  const url = new URL(request.url);
  const name = titleCase(url.searchParams.get("name") ?? "");
  if (!name) {
    return json({ error: "Missing name" }, { status: 400 });
  }
  const context = buildContext({
    brief: url.searchParams.get("brief") ?? "",
    industry: url.searchParams.get("industry") ?? "",
    audience: url.searchParams.get("audience") ?? "",
    keywords: url.searchParams.get("keywords") ?? "",
    aiKeywords: url.searchParams.get("aiKeywords") ?? "",
    avoid: url.searchParams.get("avoid") ?? ""
  });
  const [appStore, web] = await Promise.all([checkAppStore(name), checkWeb(name, env)]);
  return json({ name, appStore, grounding: await groundName(name, web, context, env) });
}

async function handleGround(request: Request, env: Env) {
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    brief?: string;
    industry?: string;
    audience?: string;
    keywords?: string;
    aiKeywords?: string;
    avoid?: string;
  };
  const name = titleCase(body.name ?? "");
  if (!name) {
    return json({ error: "Missing name" }, { status: 400 });
  }
  const context = buildContext(body);
  const web = await checkWeb(name, env);
  const grounding = await groundName(name, web, context, env);
  return json(grounding);
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

const INDEX_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Nomenclature</title>
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    @font-face {
      font-family: 'Nunito';
      src: url('/fonts/nunito.woff2') format('woff2');
      font-weight: 200 1000;
      font-style: normal;
      font-display: swap;
    }
    :root {
      color-scheme: dark;
      --bg: #0d0e10;
      --panel: rgba(31, 32, 35, 0.6);
      --panel-strong: rgba(46, 48, 54, 0.85);
      --line: rgba(255, 255, 255, 0.08);
      --text: #f4f1ec;
      --muted: rgba(244, 241, 236, 0.62);
      --accent: #8be8ee;
      --accent-soft: rgba(139, 232, 238, 0.16);
      --accent-2: #bda7ff;
      --good: #8ef0b4;
      --bad: #ff8e8e;
      --warn: #ffcf70;
      --button-bg: #3b82f6;
      --button-hover: #2563eb;
      --glass-border: rgba(255, 255, 255, 0.08);
      --glass-shadow: 0 10px 40px rgba(0, 0, 0, 0.35);
      --r-xl: 32px;
      --r-lg: 24px;
      --r-md: 16px;
      --r-pill: 999px;
      font-family: 'Nunito', ui-sans-serif, system-ui, -apple-system, sans-serif;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      background: var(--bg);
      background-image:
        radial-gradient(circle at 10% 20%, rgba(139, 232, 238, 0.13) 0%, transparent 42%),
        radial-gradient(circle at 90% 8%, rgba(189, 167, 255, 0.11) 0%, transparent 42%),
        linear-gradient(135deg, #0d0e10 0%, #16171b 52%, #0d0e10 100%);
      background-attachment: fixed;
      overflow-x: hidden;
      font-family: 'Nunito', ui-sans-serif, system-ui, -apple-system, sans-serif;
      font-weight: 500;
      -webkit-font-smoothing: antialiased;
    }
    button, input, textarea, select { font-family: inherit; }

    .app-container {
      max-width: 1320px;
      margin: 0 auto;
      padding: 40px 24px 80px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 48px;
    }
    .logo-group h1 {
      margin: 0;
      font-size: 30px;
      font-weight: 900;
      letter-spacing: -0.02em;
      background: linear-gradient(to right, #fff, var(--muted));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    /* Wizard */
    .wizard-step {
      display: none;
      max-width: 760px;
      margin: 0 auto;
      width: 100%;
      animation: fadeIn 0.4s ease-out;
    }
    .wizard-step.active { display: block; }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .progress-bar { display: flex; gap: 8px; margin-bottom: 40px; justify-content: center; }
    .progress-dot {
      width: 40px; height: 5px;
      background: var(--line);
      border-radius: var(--r-pill);
      transition: all 0.3s ease;
    }
    .progress-dot.active { background: var(--accent); }
    .step-title {
      font-size: 46px; font-weight: 900; letter-spacing: -0.03em;
      margin-bottom: 12px; text-align: center;
    }
    .step-subtitle { color: var(--muted); font-size: 18px; text-align: center; margin-bottom: 44px; }

    .input-card {
      background: var(--panel);
      backdrop-filter: blur(14px);
      border: 1px solid var(--glass-border);
      border-radius: var(--r-lg);
      padding: 32px;
      box-shadow: var(--glass-shadow);
    }
    .form-group { margin-bottom: 24px; }
    label { display: block; color: var(--muted); font-size: 14px; font-weight: 700; margin-bottom: 12px; }
    textarea, input[type=text] {
      width: 100%;
      background: rgba(0, 0, 0, 0.22);
      border: 1px solid var(--line);
      border-radius: var(--r-md);
      padding: 16px;
      color: var(--text);
      font-size: 16px;
      font-weight: 500;
      transition: border-color 0.2s ease;
    }
    textarea { min-height: 120px; resize: vertical; line-height: 1.5; }
    textarea:focus, input[type=text]:focus { outline: none; border-color: rgba(139, 232, 238, 0.5); }
    textarea::placeholder, input::placeholder { color: rgba(244, 241, 236, 0.32); }

    .chip-container { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
    .chip {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--line);
      border-radius: var(--r-pill);
      padding: 8px 16px;
      font-size: 14px; font-weight: 600;
      cursor: pointer;
      transition: background 0.2s ease;
    }
    .chip:hover { background: rgba(255, 255, 255, 0.1); }

    .nav-actions { display: flex; justify-content: space-between; margin-top: 36px; align-items: center; }
    button {
      padding: 13px 28px;
      border-radius: var(--r-pill);
      font-weight: 800;
      font-size: 16px;
      cursor: pointer;
      transition: transform 0.18s ease, background 0.18s ease;
      display: inline-flex; align-items: center; gap: 8px;
      border: none;
    }
    button.primary { background: var(--button-bg); color: #fff; }
    button.primary:hover { background: var(--button-hover); transform: translateY(-2px); }
    button.secondary { background: transparent; color: var(--muted); border: 1px solid var(--line); }
    button.secondary:hover { color: var(--text); border-color: var(--muted); }
    button:disabled { opacity: 0.6; cursor: wait; transform: none; }

    .review-item { display: flex; justify-content: space-between; align-items: flex-start; padding: 18px 4px; border-bottom: 1px solid var(--line); gap: 16px; }
    .review-item:last-of-type { border-bottom: none; }
    .review-content h4 { margin: 0 0 6px; color: var(--muted); font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
    .review-content p { margin: 0; font-size: 16px; line-height: 1.5; }
    .review-content p:empty::before { content: 'Using sensible defaults'; color: rgba(244,241,236,0.32); font-style: italic; }

    /* Dashboard */
    .dashboard { display: none; grid-template-columns: 280px 1fr; gap: 32px; align-items: start; animation: fadeIn 0.4s ease-out; }
    .dashboard.active { display: grid; }
    .sidebar { position: sticky; top: 32px; height: fit-content; }
    .results-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 20px; }

    .filter-card { background: var(--panel); border: 1px solid var(--glass-border); border-radius: var(--r-lg); padding: 24px; box-shadow: var(--glass-shadow); }
    .filter-card h3 { margin: 0 0 4px; font-size: 18px; font-weight: 800; }
    .filter-block { margin-top: 24px; }
    .filter-block > .filter-label { display: block; color: var(--muted); font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 14px; }

    /* Rounded range slider */
    input[type=range] {
      -webkit-appearance: none; appearance: none;
      width: 100%; height: 10px;
      background: rgba(255,255,255,0.08);
      border-radius: var(--r-pill);
      outline: none;
    }
    input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none; appearance: none;
      width: 22px; height: 22px; border-radius: var(--r-pill);
      background: var(--accent);
      cursor: pointer;
      border: 3px solid #0d0e10;
      box-shadow: 0 0 0 1px var(--accent);
    }
    input[type=range]::-moz-range-thumb {
      width: 22px; height: 22px; border-radius: var(--r-pill);
      background: var(--accent); cursor: pointer; border: 3px solid #0d0e10;
    }
    input[type=range]::-moz-range-track { height: 10px; background: rgba(255,255,255,0.08); border-radius: var(--r-pill); }
    .range-labels { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: var(--muted); margin-top: 10px; }

    .tld-grid { display: flex; flex-wrap: wrap; gap: 8px; }
    .tld-toggle {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 14px; border-radius: var(--r-pill);
      border: 1px solid var(--line); background: rgba(255,255,255,0.04);
      font-size: 14px; font-weight: 700; cursor: pointer;
      transition: all 0.18s ease; user-select: none;
    }
    .tld-toggle:hover { background: rgba(255,255,255,0.08); }
    .tld-toggle.on { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }

    .switch-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; cursor: pointer; }
    .switch-row .switch-label { font-size: 15px; font-weight: 700; }
    .switch { position: relative; width: 46px; height: 26px; border-radius: var(--r-pill); background: rgba(255,255,255,0.12); transition: background 0.2s ease; flex: 0 0 auto; }
    .switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: var(--r-pill); background: #fff; transition: transform 0.2s ease; }
    .switch.on { background: var(--accent); }
    .switch.on::after { transform: translateX(20px); }

    .results-head { margin-bottom: 24px; }
    .results-head h2 { margin: 0; font-size: 30px; font-weight: 900; letter-spacing: -0.02em; }
    .results-head p { color: var(--muted); margin: 6px 0 0; font-weight: 500; }

    /* Card (no click, no colored border highlight) */
    .result-card {
      background: var(--panel);
      backdrop-filter: blur(14px);
      border: 1px solid var(--glass-border);
      border-radius: var(--r-lg);
      padding: 24px;
      transition: transform 0.25s cubic-bezier(0.4,0,0.2,1), background 0.25s ease;
      display: flex; flex-direction: column; gap: 16px;
    }
    .result-card:hover { transform: translateY(-3px); background: var(--panel-strong); }
    .card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .card-title { font-size: 23px; font-weight: 900; letter-spacing: -0.01em; margin: 0; word-break: break-word; }
    .card-meta { font-size: 13px; color: var(--muted); margin-top: -8px; }

    .circular-progress { width: 50px; height: 50px; position: relative; flex: 0 0 auto; }
    .circular-progress svg { width: 100%; height: 100%; transform: rotate(-90deg); }
    .circular-progress circle { fill: none; stroke-width: 4; stroke-linecap: round; }
    .progress-bg { stroke: rgba(255,255,255,0.07); }
    .progress-value { stroke: var(--accent); transition: stroke-dashoffset 0.8s ease; }
    .score-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); font-size: 14px; font-weight: 900; }

    .domain-list { display: flex; flex-direction: column; gap: 8px; }
    .dom-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--r-md); background: rgba(0,0,0,0.2); font-size: 14px; }
    .dom-name { font-weight: 700; }
    .dom-spacer { flex: 1; }
    .dom-status { color: var(--muted); font-weight: 700; }
    .dom-row.dom-taken .dom-name { color: var(--muted); }
    .dom-row.dom-taken .dom-status { color: var(--bad); }
    .dom-row.dom-avail { background: rgba(142, 240, 180, 0.08); }
    .dom-price { color: var(--good); font-weight: 800; }
    .dom-buy {
      display: inline-flex; align-items: center; gap: 4px;
      background: var(--good); color: #07210f;
      padding: 6px 12px; border-radius: var(--r-pill);
      font-size: 12px; font-weight: 900; text-decoration: none;
      transition: transform 0.15s ease;
    }
    .dom-buy:hover { transform: translateY(-1px); }
    .dom-buy i { width: 13px; height: 13px; }

    .card-foot { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); border-top: 1px solid var(--line); padding-top: 14px; margin-top: 2px; }
    .card-foot i { width: 15px; height: 15px; }
    .card-foot b { color: var(--text); font-weight: 800; }

    .scroll-status { text-align: center; color: var(--muted); padding: 32px 0 8px; font-weight: 600; grid-column: 1 / -1; }
    .spinner { width: 22px; height: 22px; border: 3px solid var(--line); border-top-color: var(--accent); border-radius: var(--r-pill); display: inline-block; animation: spin 0.8s linear infinite; vertical-align: middle; }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 1000px) {
      .dashboard { grid-template-columns: 1fr; }
      .sidebar { position: static; }
      .step-title { font-size: 38px; }
    }
  </style>
</head>
<body>
  <div class="app-container">
    <header>
      <div class="logo-group">
        <h1>Nomenclature</h1>
      </div>
      <div id="header-actions"></div>
    </header>

    <!-- Step 1: Brief -->
    <div id="step-1" class="wizard-step active">
      <div class="progress-bar"><div class="progress-dot active"></div><div class="progress-dot"></div><div class="progress-dot"></div><div class="progress-dot"></div></div>
      <h2 class="step-title">Start with your vision.</h2>
      <p class="step-subtitle">Describe what you're building in a few sentences.</p>
      <div class="input-card">
        <div class="form-group">
          <label for="brief">Positioning Brief</label>
          <textarea id="brief" placeholder="Private AI operator for chat, memory, files, MCP connections, and local-first workflows. Naming direction: ports, routing, harbors, trusted connections, glass UI..."></textarea>
        </div>
        <div class="nav-actions">
          <div></div>
          <button class="primary" onclick="nextStep(2)">Continue <i data-lucide="arrow-right"></i></button>
        </div>
      </div>
    </div>

    <!-- Step 2: Industry & Seeds -->
    <div id="step-2" class="wizard-step">
      <div class="progress-bar"><div class="progress-dot active"></div><div class="progress-dot active"></div><div class="progress-dot"></div><div class="progress-dot"></div></div>
      <h2 class="step-title">Industry &amp; keywords.</h2>
      <p class="step-subtitle">Add the primary industry and seed words for your product.</p>
      <div class="input-card">
        <div class="form-group">
          <label for="industry">Industry / Category</label>
          <input type="text" id="industry" placeholder="AI productivity, personal software, private operations" />
          <div class="chip-container">
            <span class="chip" onclick="addChip('industry', 'SaaS')">SaaS</span>
            <span class="chip" onclick="addChip('industry', 'Enterprise')">Enterprise</span>
            <span class="chip" onclick="addChip('industry', 'Developer Tools')">Developer Tools</span>
          </div>
        </div>
        <div class="form-group">
          <label for="seeds">Seed Words</label>
          <input type="text" id="seeds" placeholder="port, harbor, dock, quay, channel, relay, link, connect, flow" />
          <div class="chip-container">
            <span class="chip" onclick="addChip('seeds', 'mind')">mind</span>
            <span class="chip" onclick="addChip('seeds', 'signal')">signal</span>
            <span class="chip" onclick="addChip('seeds', 'base')">base</span>
          </div>
        </div>
        <div class="nav-actions">
          <button class="secondary" onclick="nextStep(1)">Back</button>
          <button class="primary" onclick="nextStep(3)">Continue <i data-lucide="arrow-right"></i></button>
        </div>
      </div>
    </div>

    <!-- Step 3: Avoid -->
    <div id="step-3" class="wizard-step">
      <div class="progress-bar"><div class="progress-dot active"></div><div class="progress-dot active"></div><div class="progress-dot active"></div><div class="progress-dot"></div></div>
      <h2 class="step-title">What should be avoided?</h2>
      <p class="step-subtitle">Concepts or themes that should be absolutely avoided.</p>
      <div class="input-card">
        <div class="form-group">
          <label for="avoid">Negative Constraints</label>
          <textarea id="avoid" placeholder="crypto, dating, bird, plane, logistics..."></textarea>
        </div>
        <div class="nav-actions">
          <button class="secondary" onclick="nextStep(2)">Back</button>
          <button class="primary" onclick="nextStep(4)">Next Step <i data-lucide="arrow-right"></i></button>
        </div>
      </div>
    </div>

    <!-- Step 4: Review -->
    <div id="step-4" class="wizard-step">
      <div class="progress-bar"><div class="progress-dot active"></div><div class="progress-dot active"></div><div class="progress-dot active"></div><div class="progress-dot active"></div></div>
      <h2 class="step-title">Review configuration</h2>
      <p class="step-subtitle">A quick look before generation.</p>
      <div class="input-card">
        <div class="review-item">
          <div class="review-content"><h4>Positioning Brief</h4><p id="review-brief"></p></div>
          <button class="secondary" style="padding: 7px 14px; font-size: 13px;" onclick="nextStep(1)"><i data-lucide="edit-2"></i> Edit</button>
        </div>
        <div class="review-item">
          <div class="review-content"><h4>Keywords / Industry</h4><p id="review-industry"></p></div>
          <button class="secondary" style="padding: 7px 14px; font-size: 13px;" onclick="nextStep(2)"><i data-lucide="edit-2"></i> Edit</button>
        </div>
        <div class="review-item">
          <div class="review-content"><h4>Negative Constraints</h4><p id="review-avoid"></p></div>
          <button class="secondary" style="padding: 7px 14px; font-size: 13px;" onclick="nextStep(3)"><i data-lucide="edit-2"></i> Edit</button>
        </div>
        <div class="nav-actions">
          <button class="secondary" onclick="nextStep(3)">Previous</button>
          <button class="primary" id="generate-btn" onclick="generateNames()">Generate Names <i data-lucide="sparkles"></i></button>
        </div>
      </div>
    </div>

    <!-- Dashboard -->
    <div id="dashboard" class="dashboard">
      <aside class="sidebar">
        <div class="filter-card">
          <h3>Refine</h3>
          <div class="filter-block">
            <span class="filter-label">Name length</span>
            <input type="range" id="length-range" min="1" max="3" step="1" value="3" oninput="onLengthChange()" />
            <div class="range-labels"><span>Short</span><span>Medium</span><span>Long</span></div>
          </div>
          <div class="filter-block">
            <span class="filter-label">Top-level domains</span>
            <div class="tld-grid" id="tld-grid"></div>
          </div>
          <div class="filter-block">
            <div class="switch-row" id="hide-taken-row" onclick="toggleHideTaken()">
              <span class="switch-label">Hide taken domains</span>
              <span class="switch" id="hide-taken-switch"></span>
            </div>
          </div>
          <div class="filter-block">
            <button class="primary" style="width: 100%; justify-content: center;" onclick="generateNames()">Regenerate</button>
          </div>
        </div>
      </aside>
      <main>
        <div class="results-head">
          <h2>Results</h2>
          <p id="results-sub">Available names for your brief — scroll for more.</p>
        </div>
        <div id="results-grid" class="results-grid"></div>
        <div id="scroll-status" class="scroll-status"></div>
        <div id="scroll-sentinel" style="height: 1px;"></div>
      </main>
    </div>
  </div>

  <script>
    var TLDS = ['com', 'ai', 'io', 'dev', 'app', 'co'];
    var selectedTlds = { com: true, ai: false, io: false, dev: false, app: false, co: false };
    var allResults = [];
    var state = { offset: 0, count: 12, hasMore: true, loading: false, active: false, params: null, maxLen: 99 };

    function nextStep(n) {
      document.querySelectorAll('.wizard-step').forEach(function(s){ s.classList.remove('active'); });
      document.getElementById('dashboard').classList.remove('active');
      state.active = false;
      document.getElementById('step-' + n).classList.add('active');
      if (n === 4) {
        document.getElementById('review-brief').textContent = document.getElementById('brief').value;
        document.getElementById('review-industry').textContent = document.getElementById('industry').value;
        document.getElementById('review-avoid').textContent = document.getElementById('avoid').value;
      }
      lucide.createIcons();
    }

    function addChip(id, text) {
      var input = document.getElementById(id);
      var val = input.value.trim();
      if (!val.includes(text)) input.value = val ? val + ', ' + text : text;
    }

    function renderTldGrid() {
      var grid = document.getElementById('tld-grid');
      grid.innerHTML = TLDS.map(function(tld){
        return '<span class="tld-toggle ' + (selectedTlds[tld] ? 'on' : '') + '" data-tld="' + tld + '" onclick="toggleTld(\\'' + tld + '\\')">.' + tld + '</span>';
      }).join('');
    }

    function toggleTld(tld) {
      selectedTlds[tld] = !selectedTlds[tld];
      if (!Object.keys(selectedTlds).some(function(k){ return selectedTlds[k]; })) selectedTlds.com = true;
      renderTldGrid();
      if (state.active) generateNames();
    }

    function getSelectedTlds() {
      var out = TLDS.filter(function(t){ return selectedTlds[t]; });
      return out.length ? out : ['com'];
    }

    function toggleHideTaken() {
      var sw = document.getElementById('hide-taken-switch');
      sw.classList.toggle('on');
      reRender();
    }
    function hideTakenOn() { return document.getElementById('hide-taken-switch').classList.contains('on'); }

    function onLengthChange() {
      var v = parseInt(document.getElementById('length-range').value, 10);
      state.maxLen = v === 1 ? 8 : v === 2 ? 12 : 99;
      reRender();
    }

    function renderProgressCircle(score, size) {
      size = size || 50;
      var radius = (size / 2) - 4;
      var circ = 2 * Math.PI * radius;
      var offset = circ - (score / 100) * circ;
      return '<svg width="' + size + '" height="' + size + '">' +
        '<circle class="progress-bg" cx="' + (size/2) + '" cy="' + (size/2) + '" r="' + radius + '"></circle>' +
        '<circle class="progress-value" cx="' + (size/2) + '" cy="' + (size/2) + '" r="' + radius + '" stroke-dasharray="' + circ + '" stroke-dashoffset="' + offset + '"></circle>' +
        '</svg><span class="score-text">' + score + '</span>';
    }

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[c]; }); }

    function domainRow(d) {
      var label = esc(d.domain);
      if (d.available === true) {
        var price = d.registrationCost ? '$' + esc(d.registrationCost) + (d.currency && d.currency !== 'USD' ? ' ' + esc(d.currency) : '') + '/yr' : 'Available';
        return '<div class="dom-row dom-avail"><span class="dom-name">' + label + '</span><span class="dom-spacer"></span>' +
          '<span class="dom-price">' + price + '</span>' +
          '<a class="dom-buy" href="' + esc(d.purchaseUrl) + '" target="_blank" rel="noreferrer">Buy <i data-lucide="arrow-up-right"></i></a></div>';
      }
      if (d.available === false) {
        return '<div class="dom-row dom-taken"><span class="dom-name">' + label + '</span><span class="dom-spacer"></span><span class="dom-status">Taken</span></div>';
      }
      return '<div class="dom-row"><span class="dom-name">' + label + '</span><span class="dom-spacer"></span><span class="dom-status">&mdash;</span></div>';
    }

    function isVisible(item) {
      if (item.name.length > state.maxLen) return false;
      if (hideTakenOn() && !(item.domains || []).some(function(d){ return d.available === true; })) return false;
      return true;
    }

    function cardHtml(item) {
      return '<div class="result-card">' +
        '<div class="card-header"><div><h3 class="card-title">' + esc(item.name) + '</h3></div>' +
        '<div class="circular-progress">' + renderProgressCircle(item.score) + '</div></div>' +
        '<div class="card-meta">' + esc(item.displayName) + '</div>' +
        '<div class="domain-list">' + (item.domains || []).map(domainRow).join('') + '</div>' +
        '<div class="card-foot"><i data-lucide="smartphone"></i> App Store: <b>' + (item.appStoreCount || 0) + '</b> results</div>' +
        '</div>';
    }

    function reRender() {
      var grid = document.getElementById('results-grid');
      var visible = allResults.filter(isVisible);
      grid.innerHTML = visible.map(cardHtml).join('');
      if (state.active && !state.loading && allResults.length > 0 && visible.length === 0 && !state.hasMore) {
        grid.innerHTML = '<div class="scroll-status">No matching names. Try different TLDs or filters.</div>';
      }
      lucide.createIcons();
    }

    function getParams() {
      return {
        brief: document.getElementById('brief').value,
        industry: document.getElementById('industry').value,
        avoid: document.getElementById('avoid').value,
        seeds: document.getElementById('seeds').value,
        tlds: getSelectedTlds()
      };
    }

    async function generateNames() {
      var btn = document.getElementById('generate-btn');
      if (btn) { btn.disabled = true; btn.innerHTML = 'Generating... <i data-lucide="loader-2"></i>'; lucide.createIcons(); }

      document.querySelectorAll('.wizard-step').forEach(function(s){ s.classList.remove('active'); });
      document.getElementById('dashboard').classList.add('active');

      allResults = [];
      document.getElementById('results-grid').innerHTML = '';
      state.offset = 0; state.hasMore = true; state.loading = false; state.active = true;
      state.params = getParams();
      onLengthChange();

      await loadMore();

      if (btn) { btn.disabled = false; btn.innerHTML = 'Generate Names <i data-lucide="sparkles"></i>'; lucide.createIcons(); }
    }

    async function loadMore() {
      if (!state.active || state.loading || !state.hasMore) return;
      state.loading = true;
      var status = document.getElementById('scroll-status');
      status.innerHTML = '<span class="spinner"></span>';

      try {
        var p = state.params || getParams();
        var res = await fetch('/api/suggest', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ brief: p.brief, industry: p.industry, avoid: p.avoid, seeds: p.seeds, tlds: p.tlds, count: state.count, offset: state.offset })
        });
        var data = await res.json();
        var fresh = data.results || [];
        allResults = allResults.concat(fresh);

        var grid = document.getElementById('results-grid');
        var html = fresh.filter(isVisible).map(cardHtml).join('');
        grid.insertAdjacentHTML('beforeend', html);
        lucide.createIcons();

        state.offset = data.nextOffset;
        state.hasMore = !!data.hasMore;
        status.textContent = state.hasMore ? '' : 'That\\'s every candidate for this brief.';
      } catch (e) {
        status.textContent = 'Could not load more names.';
      } finally {
        state.loading = false;
        // If the page didn't fill the viewport, keep loading.
        if (state.active && state.hasMore && isSentinelVisible()) setTimeout(loadMore, 60);
      }
    }

    function isSentinelVisible() {
      var s = document.getElementById('scroll-sentinel');
      if (!s) return false;
      var r = s.getBoundingClientRect();
      return r.top < (window.innerHeight + 600);
    }

    var observer = new IntersectionObserver(function(entries){
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '600px' });
    observer.observe(document.getElementById('scroll-sentinel'));

    renderTldGrid();
    lucide.createIcons();
  </script>
</body>
</html>`;

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") return html();
    if (request.method === "GET" && url.pathname === "/fonts/nunito.woff2") return fontResponse();
    if (request.method === "GET" && url.pathname === "/api/check") return handleCheck(request, env);
    if (request.method === "POST" && url.pathname === "/api/suggest") return handleSuggest(request, env);
    if (request.method === "POST" && url.pathname === "/api/ground") return handleGround(request, env);
    return json({ error: "Not found" }, { status: 404 });
  }
};
