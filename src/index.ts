import { chat, toolDefinition, toServerSentEventsResponse, maxIterations } from "@tanstack/ai";
// Import from the workers-ai subpath, not the package barrel: the barrel re-exports
// every provider adapter (openai/gemini/grok/openrouter) and several have mismatched
// exports that break the Worker bundle. The subpath pulls in only the Workers AI adapter.
import { createWorkersAiChat } from "@cloudflare/tanstack-ai/adapters/workers-ai";
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

// Call the fast, non-reasoning Llama model directly through gateway "x" (for caching +
// observability). Per ~/.claude/CLAUDE.md "Inside a Worker", env.AI.run with a concrete
// @cf/ model id is the working Worker-side invocation. We use it explicitly instead of the
// dynamic/* routes, which load-balanced to slow reasoning models (no streamable content,
// ~6s+ latency). Llama returns clean content in ~1-2s. Model id current per CLAUDE.md.
async function gatewayText(
  env: Env,
  system: string,
  prompt: string,
  opts: { timeoutMs?: number; maxOutputTokens?: number } = {}
): Promise<string> {
  const call = env.AI.run(
    "@cf/meta/llama-3.1-8b-instruct-fp8",
    {
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt }
      ],
      max_tokens: opts.maxOutputTokens ?? 256
    },
    { gateway: { id: "x" } }
  ) as Promise<{ response?: string }>;
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("AI timed out")), opts.timeoutMs ?? 12000)
  );
  const result = await Promise.race([call, timeout]);
  return result.response ?? "";
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
    const text = await gatewayText(env, "You are a naming expert. Return only JSON.", prompt);
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

// Reasoning-prose / naming-task words to drop when the model's output arrives as reasoning
// text (so connectors and instruction words don't get mistaken for candidate names).
const NAMER_STOP = new Set([
  "the", "and", "for", "you", "are", "with", "that", "this", "into", "from", "your", "they", "them",
  "these", "those", "than", "name", "names", "word", "words", "token", "tokens", "letter", "letters",
  "space", "spaces", "each", "one", "only", "none", "give", "list", "output", "return", "separated",
  "nothing", "else", "easy", "say", "distinct", "vary", "varied", "style", "styles", "invented",
  "blend", "blends", "evocative", "real", "coinage", "coinages", "playful", "memorable", "brandable",
  "unique", "product", "products", "brief", "industry", "theme", "themes", "thematic", "inspiration",
  "avoid", "group", "groups", "maybe", "like", "such", "etc", "more", "also", "very", "apps", "idea",
  "ideas", "based", "could", "would", "should", "must", "make", "makes", "good", "great", "here",
  "some", "many", "most", "using", "used", "clearly", "others", "twelve", "first", "second",
  "diverse", "expert", "startup", "namer", "produces", "punctuation", "other", "varying", "widely",
  "descriptor", "syllable", "syllables", "sound", "sounds", "vowel", "consonant", "example",
  "examples", "candidate", "candidates", "option", "options", "final", "answer", "concept",
  "concepts", "evoke", "modern", "sleek", "simple", "strong", "generate", "create", "suggest",
  "following", "request", "restate", "conveys", "convey", "feels", "feel", "memorable",
  "wide", "variety", "format", "formats", "length", "lengths", "suffix", "suffixes", "prefix",
  "prefixes", "vibe", "vibes", "flavor", "tone", "fairly", "rather", "quite", "still", "while",
  "okay", "maybe", "perhaps", "really", "actual", "actually", "around", "about", "above"
]);

// AI-generated, diverse, brandable names via dynamic/text_gen. The `exclude` list (names
// already shown) keeps infinite scroll surfacing fresh, varied results instead of repeats.
// Returns [] on failure so the caller can fall back to the deterministic generator.
async function generateAiNames(
  context: NamingContext,
  seedsInput: unknown,
  exclude: string[],
  count: number,
  env: Env
): Promise<string[]> {
  const seeds = parseWords(seedsInput);
  const avoid = context.avoid;
  const lines = [
    `Generate ${count + 8} unique, brandable product names.`,
    context.brief ? `Brief: ${context.brief}` : "",
    context.industry ? `Industry: ${context.industry}` : "",
    seeds.length
      ? `Thematic inspiration (use as loose themes; do NOT just append fixed suffixes to these words): ${seeds.join(", ")}`
      : "",
    avoid.length ? `Avoid these themes/words entirely: ${avoid.join(", ")}` : "",
    exclude.length ? `Do NOT repeat any of these already-shown names: ${exclude.slice(-120).join(", ")}` : "",
    "",
    "Each name is ONE token, 4-14 letters, no spaces or punctuation, easy to say, and clearly distinct from the others. Vary the styles widely: invented words, blends, evocative real words, playful coinages. Return ONLY the names separated by spaces, nothing else."
  ].filter(Boolean);

  try {
    const text = await gatewayText(
      env,
      "You are an expert startup and product namer who produces diverse, memorable, brandable names.",
      lines.join("\n"),
      { timeoutMs: 13000, maxOutputTokens: 400 }
    );
    const seen = new Set(exclude.map((n) => n.toLowerCase()));
    const avoidTerms = avoid.map(normalize);
    // Words that merely echo the prompt (brief/industry/seeds) or are reasoning prose are
    // not names — the model's output may arrive as its reasoning text.
    const blocked = new Set<string>([
      ...NAMER_STOP,
      // Block every word that appears in the prompt itself (brief, industry, seeds, avoid,
      // exclude, and the instructions) so the model's reasoning echoes don't leak as names.
      ...parseWords(lines.join(" "))
    ]);
    return unique(text.split(/[^a-zA-Z]+/).map(brandCase).filter(Boolean))
      .filter((n) => n.length >= 4 && n.length <= 16)
      .filter((n) => !blocked.has(n.toLowerCase()))
      .filter((n) => !avoidTerms.some((t) => t && normalize(n).includes(t)))
      .filter((n) => !seen.has(n.toLowerCase()))
      .slice(0, count);
  } catch {
    return [];
  }
}

// Gate: results require an authenticated user. Names come from AI (diverse) and are then
// confirmed against the Registrar API; the deterministic generator is the offline fallback.
async function handleSuggest(request: Request, env: Env) {
  const userId = await requireUser(request, env);
  if (!userId) return json({ error: "Authentication required" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    brief?: string; industry?: string; audience?: string; keywords?: string;
    aiKeywords?: string; avoid?: string; seeds?: string; count?: number; offset?: number;
    tlds?: unknown; exclude?: unknown;
  };

  const context = buildContext(body);
  const count = clampInt(body.count, 4, 24, 12);
  const offset = clampInt(body.offset, 0, 100000, 0);
  const tlds = parseTlds(body.tlds);
  const exclude = Array.isArray(body.exclude)
    ? body.exclude.map((n) => String(n)).filter(Boolean).slice(0, 120)
    : [];

  // Primary: AI-generated diverse names. Fallback: deterministic combos (exclude-aware).
  let page = await generateAiNames(context, body.seeds, exclude, count, env);
  if (page.length === 0) {
    const seen = new Set(exclude.map((n) => n.toLowerCase()));
    page = generateCandidates(context, body.seeds)
      .filter((n) => !seen.has(n.toLowerCase()))
      .slice(0, count);
  }

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
    hasMore: results.length > 0,
    tlds,
    aiKeywords: context.aiKeywords
  });
}

// Lazy pipeline. /api/names runs the one slow AI call and returns a large POOL of names the
// client paginates through; /api/enrich confirms domains + App Store for a small batch (fast,
// no AI). Result: infinite scroll does no AI call per page, so it stays snappy.
async function handleNames(request: Request, env: Env) {
  const userId = await requireUser(request, env);
  if (!userId) return json({ error: "Authentication required" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    brief?: string; industry?: string; audience?: string; keywords?: string;
    aiKeywords?: string; avoid?: string; seeds?: string; count?: number; exclude?: unknown;
  };
  const context = buildContext(body);
  const count = clampInt(body.count, 8, 40, 30);
  const exclude = Array.isArray(body.exclude)
    ? body.exclude.map((n) => String(n)).filter(Boolean).slice(0, 150)
    : [];

  let names = await generateAiNames(context, body.seeds, exclude, count, env);
  if (names.length === 0) {
    const seen = new Set(exclude.map((n) => n.toLowerCase()));
    names = generateCandidates(context, body.seeds)
      .filter((n) => !seen.has(n.toLowerCase()))
      .slice(0, count);
  }
  return json({ names });
}

async function handleEnrich(request: Request, env: Env) {
  const userId = await requireUser(request, env);
  if (!userId) return json({ error: "Authentication required" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    names?: unknown; tlds?: unknown; brief?: string; industry?: string; avoid?: string;
  };
  const names = Array.isArray(body.names)
    ? body.names.map((n) => String(n)).filter(Boolean).slice(0, 14)
    : [];
  if (names.length === 0) return json({ results: [] });

  const context = buildContext(body);
  const tlds = parseTlds(body.tlds);
  const [appStores, domainMap] = await Promise.all([
    Promise.all(names.map((name) => checkAppStore(name))),
    checkDomains(names, tlds, env)
  ]);

  const results = names.map((name, index) => {
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
  return json({ results });
}

const ASSOCIATE_STOP = new Set([
  "the", "and", "for", "you", "are", "with", "that", "this", "into", "from", "your", "word",
  "words", "here", "list", "name", "tech", "they", "them", "like", "such", "etc", "some", "more",
  "idea", "best", "good", "also", "each", "very", "just", "only", "can", "will", "new", "use",
  "try", "via", "per", "out", "all", "any", "set", "get", "one", "two"
]);

// Live seed-word suggestions — short (<5 char) associated words via the gateway route.
// Not auth-gated: runs in the wizard before the results gate. Accepts either a JSON array
// or free-form/list text (models vary), tokenizing and filtering to short, fresh words.
async function handleAssociate(request: Request, env: Env) {
  const body = (await request.json().catch(() => ({}))) as { seeds?: string };
  const seeds = (body.seeds ?? "").trim().slice(0, 200);
  if (!seeds) return json({ words: [] });
  try {
    const text = await gatewayText(
      env,
      "You suggest short, brandable seed words for product naming.",
      `Seed words so far: ${seeds}\nReply with ONLY 18 very short words (each 2 to 4 letters, lowercase, single words) related to these seeds for a brandable tech product name, separated by spaces. No numbers, no punctuation, no other text. Example style: bay hub arc ray node sync moor cove.`,
      { timeoutMs: 12000, maxOutputTokens: 160 }
    );

    let candidates: string[] = [];
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start >= 0 && end > start) {
      try {
        const arr = JSON.parse(text.slice(start, end + 1));
        if (Array.isArray(arr)) candidates = arr.map((w) => String(w));
      } catch {
        // fall through to tokenization
      }
    }
    if (candidates.length === 0) candidates = text.split(/[^a-zA-Z]+/);

    const existing = new Set(parseWords(seeds));
    const words = unique(
      candidates
        .map((w) => w.toLowerCase().replace(/[^a-z]/g, ""))
        .filter((w) => w.length >= 2 && w.length <= 4)
        .filter((w) => !ASSOCIATE_STOP.has(w) && !existing.has(w))
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

// ---------- domain agent (TanStack AI + @cloudflare/tanstack-ai) ----------

async function executeDomainCheck(rawDomain: string, env: Env): Promise<unknown> {
  const d = rawDomain.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
  if (!d.includes(".")) return { error: `Provide a full domain like '${d}.com'` };
  const lastDot = d.lastIndexOf(".");
  const baseName = d.slice(0, lastDot);
  const tld = d.slice(lastDot + 1);
  if (!baseName || tld.length < 2) return { error: `Invalid domain: ${d}` };
  const map = await checkDomains([baseName], [tld], env);
  const info = (map.get(baseName) ?? [])[0];
  if (!info) return { domain: d, available: null, error: "Could not reach registrar" };
  return {
    domain: info.domain,
    available: info.available,
    registrationCost: info.registrationCost,
    renewalCost: info.renewalCost,
    currency: info.currency ?? "USD",
    purchaseUrl: info.purchaseUrl,
    reason: info.reason ?? null
  };
}

async function handleChat(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const userId = await requireUser(request, env);
  const body = (await request.json().catch(() => ({}))) as { message?: string; sessionId?: string };
  const userMessage = String(body.message ?? "").trim().slice(0, 600);
  if (!userMessage) return json({ error: "Message required" }, { status: 400 });

  const sessionId = String(body.sessionId ?? "").replace(/[^a-z0-9-]/gi, "").slice(0, 36) || crypto.randomUUID();

  // Load conversation history from D1 for authenticated users (agentic memory)
  let history: Array<{ role: "user" | "assistant"; content: string }> = [];
  if (userId && env.DB) {
    try {
      const rows = await env.DB.prepare(
        "SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC LIMIT 20"
      ).bind(sessionId).all();
      history = ((rows.results ?? []) as Array<{ role: string; content: string }>)
        .filter(r => r.role === "user" || r.role === "assistant")
        .map(r => ({ role: r.role as "user" | "assistant", content: r.content }));
    } catch { /* first session */ }
  }

  // check_domain tool: uses the same Registrar API path as the results grid.
  // toolDefinition() from @tanstack/ai creates a typed, isomorphic tool; .server() adds
  // the execute function that runs in the Worker during the agentic loop.
  const domainTool = toolDefinition({
    name: "check_domain",
    description: "Check if a specific domain name is available on Cloudflare Registrar and get its price. Call this whenever the user asks about domain availability or mentions a domain name.",
    inputSchema: {
      type: "object" as const,
      properties: {
        domain: { type: "string", description: "Full domain including TLD, e.g. 'mynext.link'" }
      },
      required: ["domain"] as const
    }
  }).server(async (args: unknown) =>
    executeDomainCheck(String((args as { domain?: unknown }).domain ?? ""), env)
  );

  // Route the concrete Workers AI model through AI Gateway "x" for caching, observability,
  // and cost analytics (per the project's "always route through the gateway" policy) while
  // still getting a usable stream.
  //
  // Why a proxy and not { binding: env.AI.gateway("x") }: the adapter's gateway modes
  // (createGatewayFetch) return the raw Workers AI response — native shape `{ response: ... }`,
  // no OpenAI `choices` — so the OpenAI SDK parser skips every chunk and emits zero events
  // (observed: 200 OK, empty SSE body, ~89ms). Only the adapter's *direct-binding* fetch wraps
  // the result in transformWorkersAiStream (Workers AI SSE → OpenAI SSE), which the parser needs.
  //
  // This proxy keeps a `gateway()` method so the adapter picks the transform-enabled direct
  // path (isDirectBindingConfig checks `typeof binding.gateway === "function"`), and its run()
  // injects the sanctioned `{ gateway: { id: "x" } }` third arg — i.e. the exact, working
  // Worker-side pattern: env.AI.run("@cf/...", inputs, { gateway: { id: "x" } }).
  const gatewayAi: any = {
    run: (model: string, inputs: unknown, options?: Record<string, unknown>) =>
      env.AI.run(model, inputs, { ...(options ?? {}), gateway: { id: "x" } }),
    gateway: (id: string) => env.AI.gateway(id)
  };
  // gpt-oss-120b (OpenAI-lineage) emits structured tool_calls reliably while streaming;
  // smaller Workers AI models (e.g. llama-3.1-8b-instruct-fp8) leak the call as plain text
  // in streaming mode, so the agent never actually invokes the tool.
  const adapter = createWorkersAiChat("@cf/openai/gpt-oss-120b", {
    binding: gatewayAi
  });

  // chat() from @tanstack/ai handles the full agentic tool-calling loop: LLM → tool call
  // → executeDomainCheck → LLM → final text. maxIterations(3) caps it at 3 rounds.
  // reasoning_effort:"low" keeps the reasoning model snappy (its thinking goes to STEP_*
  // events, which the SSE client ignores — only TEXT_MESSAGE_CONTENT is rendered).
  const stream = chat({
    adapter,
    modelOptions: { reasoning_effort: "low" },
    systemPrompts: ["You are a friendly domain availability assistant for blabout.com — a free tool for finding available domain names on Cloudflare at cost. When a user mentions a domain or asks about availability, always call the check_domain tool. Keep responses concise. When a domain is available, mention the price and encourage registration."],
    messages: [...history, { role: "user" as const, content: userMessage }],
    tools: [domainTool],
    agentLoopStrategy: maxIterations(3)
  });

  // Intercept the stream to collect the full text for D1 persistence, without delaying
  // the streaming response. The promise resolves when the stream is fully consumed.
  let collectedText = "";
  let streamResolved: (() => void) | undefined;
  const streamDone = new Promise<void>(r => { streamResolved = r; });

  async function* interceptAndCollect() {
    try {
      for await (const chunk of stream) {
        if (chunk.type === "TEXT_MESSAGE_CONTENT") {
          const c = chunk as unknown as { delta?: string };
          if (c.delta) collectedText += c.delta;
        }
        yield chunk;
      }
    } finally {
      streamResolved?.();
    }
  }

  // D1 write happens after the response stream completes — no delay for the user.
  if (userId && env.DB) {
    const sid = sessionId, uid = userId, msg = userMessage;
    ctx.waitUntil(
      streamDone.then(async () => {
        if (!collectedText) return;
        const now = Date.now();
        try {
          await env.DB.batch([
            env.DB.prepare("INSERT OR IGNORE INTO chat_sessions VALUES (?, ?, ?)").bind(sid, uid, now),
            env.DB.prepare("INSERT INTO chat_messages VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), sid, "user", msg, now),
            env.DB.prepare("INSERT INTO chat_messages VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), sid, "assistant", collectedText, now + 1)
          ]);
        } catch { /* best-effort */ }
      })
    );
  }

  // Stream SSE to client; send the session ID as a header so the frontend can persist it.
  return toServerSentEventsResponse(interceptAndCollect(), {
    headers: {
      "x-chat-session": sessionId,
      "access-control-expose-headers": "x-chat-session"
    }
  });
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
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
    if (m === "POST" && pathname === "/api/chat") return handleChat(request, env, ctx);
    if (m === "POST" && pathname === "/api/associate") return handleAssociate(request, env);
    if (m === "POST" && pathname === "/api/names") return handleNames(request, env);
    if (m === "POST" && pathname === "/api/enrich") return handleEnrich(request, env);
    if (m === "POST" && pathname === "/api/suggest") return handleSuggest(request, env);
    if (m === "POST" && pathname === "/api/ground") return handleGround(request, env);
    if (m === "GET" && pathname === "/api/check") return handleCheck(request, env);
    return json({ error: "Not found" }, { status: 404 });
  }
};
