import { createAiGateway } from "ai-gateway-provider";
import { createUnified } from "ai-gateway-provider/providers/unified";
import { generateText } from "ai";
import { NUNITO_WOFF2_BASE64 } from "./nunito";
import { INDEX_HTML } from "./html";
import { Env, json } from "./shared";
import {
  requireUser,
  handleSignup,
  handleLogin,
  handleLogout,
  handleMe
} from "./auth";
import { handleListBookmarks, handleAddBookmark, handleDeleteBookmark } from "./bookmarks";

type AppHit = { name: string; seller: string; url: string };
type WebHit = { title: string; url: string; description: string };

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
  available: boolean | null;
  registrationCost: string | null;
  renewalCost: string | null;
  currency: string | null;
  reason?: string;
  purchaseUrl: string;
};

type CandidateResult = {
  appStore: { exact: AppHit[]; close: AppHit[]; resultCount: number };
  web: { checked: boolean; hits: WebHit[] };
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
  "port", "harbor", "dock", "quay", "channel", "relay", "link", "gate",
  "line", "light", "glass", "signal", "private", "context", "memory", "operator"
];
const PREFIXES = ["port", "harbor", "dock", "quay", "channel", "relay", "signal", "key", "north", "clear"];
const SUFFIXES = [
  "light", "line", "lane", "link", "glass", "gate", "well", "way",
  "field", "smith", "mind", "beam", "bridge", "craft", "path"
];
const DEFAULT_TLDS = ["com"];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function titleCase(value: string) {
  return value.replace(/[-_]+/g, " ").trim().split(/\s+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
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
    text.split(/[\n,;]+/).flatMap((part) => part.split(/\s+/))
      .map((word) => word.toLowerCase().replace(/[^a-z0-9]/g, ""))
      .filter((word) => word.length >= 3 && word.length <= 18)
  );
}
function parseSeedWords(input: unknown) {
  return unique([...DEFAULT_SEEDS, ...parseWords(input)]);
}
function parseTlds(input: unknown): string[] {
  if (!Array.isArray(input)) return DEFAULT_TLDS;
  const cleaned = unique(
    input.map((tld) => String(tld).toLowerCase().replace(/[^a-z0-9]/g, ""))
      .filter((tld) => tld.length >= 2 && tld.length <= 10)
  ).slice(0, 12);
  return cleaned.length ? cleaned : DEFAULT_TLDS;
}

function suggestedKeywords(context: Omit<NamingContext, "aiKeywords">) {
  const text = normalize([context.brief, context.industry, context.audience, context.keywords.join(" ")].join(" "));
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
    if (pattern.test(text)) words.forEach((word) => suggestions.add(word));
  }
  return [...suggestions];
}

function buildContext(body: {
  brief?: string; industry?: string; audience?: string;
  keywords?: string; aiKeywords?: string; avoid?: string;
}): NamingContext {
  const partial = {
    brief: body.brief ?? "",
    industry: body.industry ?? "",
    audience: body.audience ?? "",
    keywords: parseWords(body.keywords),
    avoid: parseWords(body.avoid)
  };
  return { ...partial, aiKeywords: unique([...parseWords(body.aiKeywords), ...suggestedKeywords(partial)]) };
}

function contextWords(context: NamingContext) {
  return unique([
    ...parseWords(context.brief), ...parseWords(context.industry), ...parseWords(context.audience),
    ...context.keywords, ...context.aiKeywords
  ]);
}

// Full, stable, deterministic candidate list. Paginated by handleSuggest for infinite scroll.
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
    "portlight", "portlane", "portline", "portwell", "portfield", "portbeam", "portbridge",
    "harborlight", "harborlane", "harborway", "quayline", "docklight", "relayport",
    "portmind", "portcraft", "clearport"
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
    const response = await fetch(url, {
      headers: { "user-agent": "PortlightNamefinder/0.1" },
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) return empty;
    const payload = (await response.json()) as {
      resultCount?: number;
      results?: Array<{ trackName?: string; sellerName?: string; trackViewUrl?: string }>;
    };
    const results = payload.results ?? [];
    const exact = results
      .filter((r) => normalize(r.trackName ?? "") === normalize(name))
      .map((r) => ({ name: r.trackName ?? "", seller: r.sellerName ?? "", url: r.trackViewUrl ?? "" }));
    const close = results
      .filter((r) => normalize(r.trackName ?? "") !== normalize(name))
      .slice(0, 6)
      .map((r) => ({ name: r.trackName ?? "", seller: r.sellerName ?? "", url: r.trackViewUrl ?? "" }));
    return { exact, close, resultCount: payload.resultCount ?? results.length };
  } catch {
    return empty;
  }
}

async function checkWeb(name: string, env: Env): Promise<CandidateResult["web"]> {
  if (!env.BRAVE_API_KEY) return { checked: false, hits: [] };
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", `"${name}" app OR software OR AI`);
  url.searchParams.set("count", "6");
  url.searchParams.set("safesearch", "moderate");
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "x-subscription-token": env.BRAVE_API_KEY },
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) return { checked: false, hits: [] };
    const payload = (await response.json()) as {
      web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
    };
    return {
      checked: true,
      hits: (payload.web?.results ?? []).slice(0, 6).map((r) => ({
        title: r.title ?? "", url: r.url ?? "", description: r.description ?? ""
      }))
    };
  } catch {
    return { checked: false, hits: [] };
  }
}

// A meaningful 2-100 composite weighted on App Store crowdedness + real domain availability.
function cardScore(name: string, appStoreCount: number, domains: DomainInfo[], context: NamingContext) {
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
  if (context.avoid.map(normalize).some((t) => t && normName.includes(t))) score -= 50;
  return Math.max(2, Math.min(100, Math.round(score)));
}

// Shared dynamic/fast call via ai-gateway-provider (the path that resolves dynamic routes
// from a Worker; env.AI.gateway().run() returns an empty body). Auth is CF_AIG_TOKEN.
async function dynamicFastText(env: Env, system: string, prompt: string, timeoutMs = 10000): Promise<string> {
  const aigateway = createAiGateway({
    accountId: env.CLOUDFLARE_ACCOUNT_ID ?? "",
    gateway: "x",
    apiKey: env.CF_AIG_TOKEN ?? ""
  });
  const unified = createUnified();
  const { text } = await generateText({
    model: aigateway(unified("dynamic/fast")),
    system,
    prompt,
    abortSignal: AbortSignal.timeout(timeoutMs)
  });
  return text;
}

async function groundName(name: string, web: CandidateResult["web"], context: NamingContext, env: Env): Promise<GroundingData> {
  if (!web.checked || web.hits.length === 0) {
    return {
      summary: "No web data available for grounding.",
      associations: [], linguisticScore: 70, marketFitScore: 60, relatedMeanings: ["General", "Unclaimed"]
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
    const text = await dynamicFastText(env, "You are a naming expert. Return only JSON.", prompt);
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
  } catch {
    return { summary: "Grounding analysis unavailable.", associations: [], linguisticScore: 70, marketFitScore: 60, relatedMeanings: [] };
  }
}

// Cloudflare dashboard registration page — deep-link rather than auto-register (registration
// charges the account's card and is non-refundable, so purchase stays an explicit user action).
const PURCHASE_URL = "https://dash.cloudflare.com/?to=/:account/domains/registrations";

function unknownDomain(domain: string, tld: string): DomainInfo {
  return { domain, tld, available: null, registrationCost: null, renewalCost: null, currency: null, purchaseUrl: PURCHASE_URL };
}

// Confirm availability + price for name x TLD via the Cloudflare Registrar API (beta) Check
// endpoint (≤20 domains/request). Bounded + graceful: missing creds/error/timeout → unknown.
async function checkDomains(names: string[], tlds: string[], env: Env): Promise<Map<string, DomainInfo[]>> {
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
  if (!accountId || !email || !apiKey || allDomains.length === 0) return byName;

  await Promise.all(
    chunk(allDomains, 20).map(async (batch) => {
      try {
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/registrar/domain-check`,
          {
            method: "POST",
            headers: { "x-auth-email": email, "x-auth-key": apiKey, "content-type": "application/json" },
            body: JSON.stringify({ domains: batch }),
            signal: AbortSignal.timeout(8000)
          }
        );
        if (!response.ok) return;
        const payload = (await response.json()) as {
          result?: {
            domains?: Array<{
              name: string; registrable?: boolean; reason?: string;
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
        // Leave this batch "unknown".
      }
    })
  );
  return byName;
}

function html() {
  return new Response(INDEX_HTML, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
  });
}

// Self-hosted Nunito (variable woff2), packaged in the Worker.
let FONT_BYTES: ArrayBuffer | null = null;
function fontResponse() {
  if (!FONT_BYTES) {
    const bin = atob(NUNITO_WOFF2_BASE64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    FONT_BYTES = bytes.buffer as ArrayBuffer;
  }
  return new Response(FONT_BYTES, {
    headers: { "content-type": "font/woff2", "cache-control": "public, max-age=31536000, immutable" }
  });
}

// Gate: results require an authenticated user.
async function handleSuggest(request: Request, env: Env) {
  const userId = await requireUser(request, env);
  if (!userId) return json({ error: "Authentication required" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    brief?: string; industry?: string; audience?: string; keywords?: string;
    aiKeywords?: string; avoid?: string; seeds?: string; count?: number; offset?: number; tlds?: unknown;
  };

  const context = buildContext(body);
  const candidates = generateCandidates(context, body.seeds);
  const count = clampInt(body.count, 4, 24, 12);
  const offset = clampInt(body.offset, 0, 100000, 0);
  const tlds = parseTlds(body.tlds);
  const page = candidates.slice(offset, offset + count);

  const [appStores, domainMap] = await Promise.all([
    Promise.all(page.map((name) => checkAppStore(name))),
    checkDomains(page, tlds, env)
  ]);

  const results = page.map((name, index) => {
    const appStoreCount = appStores[index].resultCount;
    const domains = domainMap.get(name.toLowerCase()) ?? [];
    return { name, displayName: `${name} — Private AI`, score: cardScore(name, appStoreCount, domains, context), appStoreCount, domains };
  });

  return json({
    results, offset, nextOffset: offset + count,
    hasMore: offset + count < candidates.length, total: candidates.length, tlds, aiKeywords: context.aiKeywords
  });
}

// Live seed-word suggestions — short (<5 char) associated words via dynamic/fast.
// Not auth-gated: runs in the wizard before the results gate.
async function handleAssociate(request: Request, env: Env) {
  const body = (await request.json().catch(() => ({}))) as { seeds?: string };
  const seeds = (body.seeds ?? "").trim().slice(0, 200);
  if (!seeds) return json({ words: [] });
  try {
    const text = await dynamicFastText(
      env,
      "You suggest short, brandable seed words for product naming. Return ONLY a JSON array of strings.",
      `Seed words so far: ${seeds}\nSuggest 12 short single words (2 to 4 letters, lowercase, no spaces or punctuation) that are thematically associated with these seeds and would work in a brandable tech product name. Return ONLY a JSON array, e.g. ["port","dock","arc"].`,
      9000
    );
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    const arr = JSON.parse(start >= 0 && end >= start ? text.slice(start, end + 1) : "[]");
    const existing = new Set(parseWords(seeds));
    const words = unique(
      (Array.isArray(arr) ? arr : [])
        .map((w: unknown) => String(w).toLowerCase().replace(/[^a-z]/g, ""))
        .filter((w: string) => w.length >= 2 && w.length <= 4)
        .filter((w: string) => !existing.has(w))
    ).slice(0, 8);
    return json({ words });
  } catch {
    return json({ words: [] });
  }
}

async function handleCheck(request: Request, env: Env) {
  const url = new URL(request.url);
  const name = titleCase(url.searchParams.get("name") ?? "");
  if (!name) return json({ error: "Missing name" }, { status: 400 });
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
    name?: string; brief?: string; industry?: string; audience?: string;
    keywords?: string; aiKeywords?: string; avoid?: string;
  };
  const name = titleCase(body.name ?? "");
  if (!name) return json({ error: "Missing name" }, { status: 400 });
  const context = buildContext(body);
  const web = await checkWeb(name, env);
  return json(await groundName(name, web, context, env));
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

export default {
  async fetch(request: Request, env: Env) {
    const { pathname } = new URL(request.url);
    const m = request.method;
    if (m === "GET" && pathname === "/") return html();
    if (m === "GET" && pathname === "/fonts/nunito.woff2") return fontResponse();
    if (m === "POST" && pathname === "/api/signup") return handleSignup(request, env);
    if (m === "POST" && pathname === "/api/login") return handleLogin(request, env);
    if (m === "POST" && pathname === "/api/logout") return handleLogout();
    if (m === "GET" && pathname === "/api/me") return handleMe(request, env);
    if (m === "GET" && pathname === "/api/bookmarks") return handleListBookmarks(request, env);
    if (m === "POST" && pathname === "/api/bookmarks") return handleAddBookmark(request, env);
    if (m === "DELETE" && pathname === "/api/bookmarks") return handleDeleteBookmark(request, env);
    if (m === "POST" && pathname === "/api/associate") return handleAssociate(request, env);
    if (m === "POST" && pathname === "/api/suggest") return handleSuggest(request, env);
    if (m === "POST" && pathname === "/api/ground") return handleGround(request, env);
    if (m === "GET" && pathname === "/api/check") return handleCheck(request, env);
    return json({ error: "Not found" }, { status: 404 });
  }
};
