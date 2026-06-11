import { chat, toServerSentEventsResponse } from "@tanstack/ai";
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
  // resultCount null = the check failed or was skipped (timeout, throttle, lite mode) —
  // deliberately distinct from a real 0, which is a strong positive signal.
  appStore: { exact: AppHit[]; close: AppHit[]; resultCount: number | null };
  web: { checked: boolean; hits: WebHit[] };
};

type NamingContext = {
  brief: string;
  industry: string;
  audience: string;
  keywords: string[];
  aiKeywords: string[];
  avoid: string[];
  maxLen: number | null;
  styles: string[];
};

// Name-style taxonomy, modeled on how brandable-domain marketplaces (BrandBucket, Atom,
// Brandpa) let users browse by kind of name rather than just keyword.
const STYLE_PROMPTS: Record<string, string> = {
  invented: "invented coined words that sound brandable (like Sonos or Zynga)",
  real: "evocative real dictionary words used metaphorically",
  compound: "two-word blends or compounds",
  playful: "playful, punny, lighthearted coinages",
  professional: "serious, credible, corporate-sounding names"
};
const STYLE_KEYS = Object.keys(STYLE_PROMPTS);

type SearchFeedback = {
  closer: string[];
  further: string[];
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
function parseMaxLen(input: unknown): number | null {
  if (typeof input !== "number" || !Number.isFinite(input)) return null;
  const value = Math.floor(input);
  return value >= 4 && value < 20 ? value : null;
}
function parseTlds(input: unknown): string[] {
  if (!Array.isArray(input)) return DEFAULT_TLDS;
  const cleaned = unique(
    input.map((tld) => String(tld).toLowerCase().replace(/[^a-z0-9]/g, ""))
      .filter((tld) => tld.length >= 2 && tld.length <= 10)
  ).slice(0, 12);
  return cleaned.length ? cleaned : DEFAULT_TLDS;
}
function parseStyles(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return unique(
    input.map((s) => String(s).toLowerCase().trim()).filter((s) => STYLE_KEYS.includes(s))
  );
}
// Maps a model's free-text style label onto the fixed taxonomy (it may say "coined",
// "blend", "punny", "corporate"...). null when nothing matches.
function normalizeStyle(value: string): string | null {
  const text = value.toLowerCase();
  if (/invent|coin|made.?up|abstract/.test(text)) return "invented";
  if (/compound|blend|portmanteau|two.?word/.test(text)) return "compound";
  if (/playful|pun|fun|quirk|whims/.test(text)) return "playful";
  if (/professional|serious|corporate|formal|credib/.test(text)) return "professional";
  if (/real|dictionary|evocative|word/.test(text)) return "real";
  return null;
}

function parseFeedback(input: unknown): SearchFeedback {
  const record = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const list = (value: unknown) => Array.isArray(value)
    ? unique(value.map((item) => brandCase(String(item))).filter(Boolean)).slice(-24)
    : [];
  return {
    closer: list(record.closer),
    further: list(record.further)
  };
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
  keywords?: string; aiKeywords?: string; avoid?: string; maxLen?: unknown; styles?: unknown;
}): NamingContext {
  const partial = {
    brief: body.brief ?? "",
    industry: body.industry ?? "",
    audience: body.audience ?? "",
    keywords: parseWords(body.keywords),
    avoid: parseWords(body.avoid),
    maxLen: parseMaxLen(body.maxLen),
    styles: parseStyles(body.styles)
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
    .filter((name) => name.length >= 4 && name.length <= (context.maxLen ?? 18))
    .filter((name) => !avoidTerms.some((term) => term && normalize(name).includes(term)));
}

async function checkAppStore(name: string): Promise<CandidateResult["appStore"]> {
  const empty: CandidateResult["appStore"] = { exact: [], close: [], resultCount: null };
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
function cardScore(name: string, appStoreCount: number | null, domains: DomainInfo[], context: NamingContext) {
  let score = 58;
  // null = check failed/skipped: no signal, no bonus — a throttled iTunes API must not
  // make every name in the batch look collision-free.
  if (appStoreCount === null) { /* neutral */ }
  else if (appStoreCount === 0) score += 18;
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

  if (context.maxLen != null) {
    const overBy = name.length - context.maxLen;
    if (overBy > 0) score -= 18 + overBy * 8;
    else {
      const idealFloor = Math.max(4, Math.floor(context.maxLen * 0.72));
      if (name.length >= idealFloor) score += 10;
      else score -= Math.min(10, (idealFloor - name.length) * 3);
    }
  }

  // Pronounceability: a name nobody can say is a name nobody can spread.
  if (!/[aeiouy]/i.test(name)) score -= 14;
  if (/[bcdfghjklmnpqrstvwxz]{4,}/i.test(name)) score -= 8;

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

// The namer wants quality over raw speed: gpt-oss-120b (Responses API via the binding —
// instructions/input in, output[] out) at low reasoning effort produces names that actually
// track the brief, where the fast Llama tends toward generic tech filler. Same sanctioned
// gateway pattern as gatewayText; callers fall back to gatewayText when this errors/times out.
async function namerText(env: Env, system: string, prompt: string, timeoutMs: number): Promise<string> {
  const call = (env.AI as { run: (model: string, inputs: unknown, opts?: unknown) => Promise<unknown> }).run(
    "@cf/openai/gpt-oss-120b",
    { instructions: system, input: prompt, reasoning: { effort: "low" } },
    { gateway: { id: "x" } }
  );
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("AI timed out")), timeoutMs)
  );
  const result = (await Promise.race([call, timeout])) as {
    output_text?: string;
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
    response?: string;
  };
  if (typeof result?.output_text === "string" && result.output_text) return result.output_text;
  if (Array.isArray(result?.output)) {
    const parts: string[] = [];
    for (const item of result.output) {
      if (item?.type !== "message" || !Array.isArray(item.content)) continue;
      for (const piece of item.content) {
        if (typeof piece?.text === "string") parts.push(piece.text);
      }
    }
    if (parts.length) return parts.join("\n");
  }
  return typeof result?.response === "string" ? result.response : "";
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
// Check a list of explicit full domains against the registrar, one DomainInfo per unique
// domain (domains the registrar doesn't return stay "unknown"). Shared by checkDomains (the
// results grid) and the /api/hacks/check endpoint (domain-hack variants).
async function checkDomainList(domains: string[], env: Env): Promise<DomainInfo[]> {
  const out = new Map<string, DomainInfo>();
  for (const raw of domains) {
    const d = String(raw).trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
    if (!d.includes(".") || out.has(d)) continue;
    out.set(d, unknownDomain(d, d.slice(d.lastIndexOf(".") + 1)));
  }

  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const email = env.CLOUDFLARE_EMAIL;
  const apiKey = env.CLOUDFLARE_API_KEY;
  const all = [...out.keys()];
  if (!accountId || !email || !apiKey || all.length === 0) return [...out.values()];

  await Promise.all(
    chunk(all, 20).map(async (batch) => {
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
          if (!out.has(entry.name)) continue;
          out.set(entry.name, {
            domain: entry.name,
            tld: entry.name.slice(entry.name.lastIndexOf(".") + 1),
            available: entry.registrable ?? null,
            registrationCost: entry.pricing?.registration_cost ?? null,
            renewalCost: entry.pricing?.renewal_cost ?? null,
            currency: entry.pricing?.currency ?? null,
            reason: entry.reason,
            purchaseUrl: PURCHASE_URL
          });
        }
      } catch {
        // Leave this batch "unknown".
      }
    })
  );
  return [...out.values()];
}

// Build name×tld combinations, check them, and group the results by base name.
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
  for (const info of await checkDomainList(allDomains, env)) {
    const ref = lookup.get(info.domain);
    if (!ref) continue;
    const list = byName.get(ref.name);
    if (!list) continue;
    const merged: DomainInfo = { ...info, tld: ref.tld };
    const idx = list.findIndex((d) => d.domain === info.domain);
    if (idx >= 0) list[idx] = merged;
    else list.push(merged);
  }
  return byName;
}

// POST /api/hacks/check — availability for a batch of explicit domain-hack variants.
async function handleHacksCheck(request: Request, env: Env) {
  const userId = await requireUser(request, env);
  if (!userId) return json({ error: "Authentication required" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { domains?: unknown };
  const domains = Array.isArray(body.domains)
    ? body.domains.map((d) => String(d)).filter(Boolean).slice(0, 100)
    : [];
  if (domains.length === 0) return json({ results: [] });
  return json({ results: await checkDomainList(domains, env) });
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
  "okay", "maybe", "perhaps", "really", "actual", "actually", "around", "about", "above",
  // Self-correction chatter observed leaking from the reasoning model's final message.
  "duplicate", "duplicates", "oops", "need", "needs", "redo", "wait", "replace", "replaced",
  "replacement", "swap", "swapped", "remove", "removed", "drop", "dropped", "recount", "count",
  "counted", "done", "sorry", "note", "notes", "let", "lets", "revised", "revise", "version",
  "attempt", "retry", "again", "missing", "extra", "error", "mistake", "correction", "fixed"
]);

// Bottomless last-resort namer. generateAiNames can fail and generateCandidates can be
// filtered to nothing (tight maxLen, long exclude, aggressive avoid list); this cannot:
// brief-word blends first, then a deterministic walk over a ~400k-deep consonant-vowel
// syllable space (strided so consecutive picks don't rhyme). Guarantees the API never
// returns an empty list.
const SYNTH_ONSETS = ["b", "br", "c", "cl", "d", "dr", "f", "fl", "g", "gl", "h", "j", "k", "l", "m", "n", "p", "pl", "r", "s", "sl", "st", "t", "tr", "v", "w", "z"];
const SYNTH_VOWELS = ["a", "e", "i", "o", "u", "ai", "ea", "io"];
const SYNTH_ENDS = ["", "n", "r", "l", "s", "x", "th", "sh"];

function synthNames(context: NamingContext, exclude: string[], count: number): string[] {
  const maxLen = Math.max(4, context.maxLen ?? 12);
  const seen = new Set(exclude.map((n) => n.toLowerCase()));
  const avoidTerms = context.avoid.map(normalize);
  const out: string[] = [];
  const push = (raw: string) => {
    const name = brandCase(raw);
    if (!name || name.length < 4 || name.length > maxLen) return false;
    const lower = name.toLowerCase();
    if (seen.has(lower)) return false;
    if (avoidTerms.some((term) => term && lower.includes(term))) return false;
    seen.add(lower);
    out.push(name);
    return out.length >= count;
  };

  // Brief-word blends first so even the synthesizer leans toward the request.
  const blendSuffixes = ["ly", "io", "ora", "ix", "ave", "una", "esa"];
  for (const word of contextWords(context).slice(0, 12)) {
    for (const suffix of blendSuffixes) {
      if (push(word + suffix)) return out;
    }
  }

  const sizes = [SYNTH_VOWELS.length, SYNTH_ONSETS.length, SYNTH_VOWELS.length, SYNTH_ENDS.length];
  const total = SYNTH_ONSETS.length * sizes[0] * sizes[1] * sizes[2] * sizes[3];
  const stride = 104729; // prime, coprime with total — visits every combo exactly once
  // 50k combos is far more than any real call consumes; the cap bounds worst-case CPU
  // when nearly the whole space is excluded.
  const maxProbes = Math.min(total, 50000);
  for (let i = 0; i < maxProbes && out.length < count; i++) {
    let k = (i * stride) % total;
    const end = SYNTH_ENDS[k % SYNTH_ENDS.length]; k = Math.floor(k / SYNTH_ENDS.length);
    const v2 = SYNTH_VOWELS[k % SYNTH_VOWELS.length]; k = Math.floor(k / SYNTH_VOWELS.length);
    const o2 = SYNTH_ONSETS[k % SYNTH_ONSETS.length]; k = Math.floor(k / SYNTH_ONSETS.length);
    const v1 = SYNTH_VOWELS[k % SYNTH_VOWELS.length]; k = Math.floor(k / SYNTH_VOWELS.length);
    const o1 = SYNTH_ONSETS[k % SYNTH_ONSETS.length];
    push(o1 + v1 + o2 + v2 + end);
  }
  return out;
}

// Top up below `floor` with synthesized names — but no further, so a healthy AI batch
// isn't diluted with generic filler.
function ensureNames(names: string[], context: NamingContext, exclude: string[], floor: number): string[] {
  if (names.length >= floor) return names;
  return [...names, ...synthNames(context, [...exclude, ...names], floor - names.length)];
}

// Near-duplicate guard: two names are "the same idea" when one contains the other (a stem
// with a suffix bolted on) or they share a long common prefix. Keeps a batch from burning
// five slots on minor twists of one stem.
function tooSimilar(a: string, b: string) {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x === y) return true;
  if ((x.includes(y) || y.includes(x)) && Math.abs(x.length - y.length) <= 3) return true;
  const stem = Math.min(x.length, y.length, 6);
  return stem >= 5 && x.slice(0, stem) === y.slice(0, stem);
}

// AI-generated, diverse, brandable names via dynamic/text_gen. The `exclude` list (names
// already shown) keeps infinite scroll surfacing fresh, varied results instead of repeats.
// Returns [] on failure so the caller can fall back to the deterministic generator.
async function generateAiNames(
  context: NamingContext,
  seedsInput: unknown,
  exclude: string[],
  count: number,
  feedback: SearchFeedback,
  env: Env
): Promise<string[]> {
  const seeds = parseWords(seedsInput);
  const avoid = context.avoid;
  const maxNameLength = context.maxLen ?? 14;
  const lines = [
    `Generate ${count + 8} unique, brandable product names.`,
    context.brief ? `Brief: ${context.brief}` : "",
    context.industry ? `Industry: ${context.industry}` : "",
    context.maxLen != null
      ? `Hard length preference: names must be ${context.maxLen} characters or fewer. Prefer names between ${Math.max(4, Math.floor(context.maxLen * 0.72))} and ${context.maxLen} characters.`
      : "",
    seeds.length
      ? `Thematic inspiration (use as loose themes; do NOT just append fixed suffixes to these words): ${seeds.join(", ")}`
      : "",
    feedback.closer.length
      ? `User marked these as closer to the target; generate names with a similar feel, rhythm, and semantic neighborhood without copying them: ${feedback.closer.join(", ")}`
      : "",
    feedback.further.length
      ? `User marked these as further away; avoid names with a similar feel, rhythm, or semantic neighborhood: ${feedback.further.join(", ")}`
      : "",
    context.styles.length
      ? `Only generate names in these styles: ${context.styles.map((s) => STYLE_PROMPTS[s]).join("; ")}.`
      : "",
    avoid.length ? `Avoid these themes/words entirely: ${avoid.join(", ")}` : "",
    exclude.length ? `Do NOT repeat any of these already-shown names: ${exclude.slice(-120).join(", ")}` : "",
    "",
    "Every name must feel tailor-made for the brief — evoke its meaning, audience, or mood. No generic tech filler.",
    `Each name is ONE token, 4-${maxNameLength} letters, no spaces or punctuation, easy to say, and clearly distinct from the others. ${context.styles.length ? "Stay strictly within the requested styles." : "Vary the styles widely: invented words, blends, evocative real words, playful coinages."} Do not reuse one stem with different endings. Return ONLY the names separated by spaces, nothing else.`
  ].filter(Boolean);

  const system = "You are an expert startup and product namer who produces diverse, memorable, brandable names.";
  try {
    // Quality-first: the stronger reasoning model, then the fast Llama if it errors,
    // times out, or returns nothing usable.
    let text = "";
    try {
      // 10s, not the model's worst case: the Llama fallback below is decent, and the two
      // timeouts stack sequentially — this bounds the tail at ~23s instead of ~29s.
      text = await namerText(env, system, lines.join("\n"), 10000);
    } catch {
      text = "";
    }
    if (!text.trim()) {
      text = await gatewayText(env, system, lines.join("\n"), { timeoutMs: 13000, maxOutputTokens: 400 });
    }
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
    const candidates = unique(text.split(/[^a-zA-Z]+/).map(brandCase).filter(Boolean))
      .filter((n) => n.length >= 4 && n.length <= maxNameLength)
      .filter((n) => !blocked.has(n.toLowerCase()))
      .filter((n) => !avoidTerms.some((t) => t && normalize(n).includes(t)))
      .filter((n) => !seen.has(n.toLowerCase()));
    // Within-batch diversity: drop near-twins outright, and cap each 4-char stem family
    // at two so one seed word can't dominate the batch (observed: five Hush*/Moon* names
    // per call). Not applied against `exclude` — thumbs-up names live there, and "closer"
    // follow-ups may legitimately share their feel.
    const kept: string[] = [];
    const stemCounts = new Map<string, number>();
    for (const name of candidates) {
      if (kept.some((existing) => tooSimilar(existing, name))) continue;
      const stem = name.toLowerCase().slice(0, 4);
      const seenStem = stemCounts.get(stem) ?? 0;
      if (seenStem >= 2) continue;
      stemCounts.set(stem, seenStem + 1);
      kept.push(name);
      if (kept.length >= count) break;
    }
    return kept;
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
    tlds?: unknown; exclude?: unknown; maxLen?: unknown; feedback?: unknown; styles?: unknown;
  };

  const context = buildContext(body);
  const count = clampInt(body.count, 4, 40, 16);
  const offset = clampInt(body.offset, 0, 100000, 0);
  const tlds = parseTlds(body.tlds);
  const feedback = parseFeedback(body.feedback);
  const exclude = Array.isArray(body.exclude)
    ? body.exclude.map((n) => String(n)).filter(Boolean).slice(0, 120)
    : [];

  // Primary: AI-generated diverse names. Fallback: deterministic combos (exclude-aware),
  // then synthesized names — never an empty page.
  let page = await generateAiNames(context, body.seeds, exclude, count, feedback, env);
  if (page.length === 0) {
    const seen = new Set(exclude.map((n) => n.toLowerCase()));
    page = generateCandidates(context, body.seeds)
      .filter((n) => !seen.has(n.toLowerCase()))
      .slice(0, count);
  }
  page = ensureNames(page, context, exclude, Math.min(12, count));

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
    maxLen?: unknown; feedback?: unknown; styles?: unknown;
  };
  const context = buildContext(body);
  const count = clampInt(body.count, 8, 96, 72);
  const feedback = parseFeedback(body.feedback);
  const exclude = Array.isArray(body.exclude)
    ? body.exclude.map((n) => String(n)).filter(Boolean).slice(0, 150)
    : [];

  let names = await generateAiNames(context, body.seeds, exclude, count, feedback, env);
  if (names.length === 0) {
    const seen = new Set(exclude.map((n) => n.toLowerCase()));
    names = generateCandidates(context, body.seeds)
      .filter((n) => !seen.has(n.toLowerCase()))
      .slice(0, count);
  }
  // Floor, not fill: a thin AI batch gets topped up to a usable page, a healthy one
  // is left alone. The synthesizer is bottomless, so this can't come back empty.
  names = ensureNames(names, context, exclude, Math.min(12, count));
  return json({ names });
}

// A short, evocative one-liner per name tying it to the brief (fills the card subtitle),
// plus a 0-100 brief-fit rating that handleEnrich blends into the card score — so the
// score ring reflects relevance to the brief, not just availability mechanics. One batched
// model call; on any failure each card just falls back to no subtitle and the base score.
type NameInsight = { tagline: string; fit: number | null; style: string | null };

async function generateInsights(names: string[], context: NamingContext, env: Env): Promise<Map<string, NameInsight>> {
  const map = new Map<string, NameInsight>();
  if (names.length === 0) return map;
  const focus = context.brief || context.industry || "a modern product";
  const prompt = [
    `Brief: ${focus}`,
    context.keywords.length ? `Keywords: ${context.keywords.join(", ")}` : "",
    "",
    'For each product name below: write a punchy 3-7 word rationale tying it to the brief (its vibe or meaning, not a full sentence), then rate 0-100 how well the name fits the brief — meaning, sound, and audience; be honest, spread the ratings. Then classify the name\'s style as exactly one of: invented, real, compound, playful, professional. Output exactly one line per name in the form "Name | rationale | NN | style", nothing else.',
    "",
    names.join(", ")
  ].filter(Boolean).join("\n");
  const system = "You judge and describe product names crisply and honestly.";
  let text = "";
  try {
    text = await namerText(env, system, prompt, 6000);
  } catch {
    text = "";
  }
  if (!text.trim()) {
    try {
      // 800 tokens, not 420: 24 names × "Name | rationale | NN | style" needs ~550+, and a
      // truncated tail silently drops taglines, styles, and the fit term from those scores.
      text = await gatewayText(env, system, prompt, { timeoutMs: 9000, maxOutputTokens: 800 });
    } catch {
      return map;
    }
  }
  for (const line of text.split("\n")) {
    const parts = line.split("|");
    if (parts.length < 2) continue;
    const nm = parts[0].replace(/^[\s*\d.)-]+/, "").trim().toLowerCase();
    const tag = parts[1].trim().replace(/^["'-]+/, "").replace(/["']+$/, "");
    // Trailing segments are a rating and/or a style label, in whatever order survived.
    let fit: number | null = null;
    let style: string | null = null;
    for (const part of parts.slice(2)) {
      const trimmed = part.trim();
      if (/^\d{1,3}$/.test(trimmed)) {
        const rating = parseInt(trimmed, 10);
        if (rating <= 100) fit = rating;
        continue;
      }
      style = normalizeStyle(trimmed) ?? style;
    }
    if (nm && tag && tag.length <= 80) map.set(nm, { tagline: tag, fit, style });
  }
  return map;
}

// GitHub is the one social platform whose handle availability is checkable without
// credentials: profile URLs 404 when the handle is free. X/Instagram bot-wall anonymous
// checks, so they're deliberately not attempted. null = couldn't determine.
async function checkGithub(name: string): Promise<boolean | null> {
  try {
    const response = await fetch(`https://github.com/${name.toLowerCase()}`, {
      method: "HEAD",
      headers: { "user-agent": "copythe.link handle check" },
      redirect: "manual",
      signal: AbortSignal.timeout(5000)
    });
    if (response.status === 404) return true;
    if (response.status === 200) return false;
    return null;
  } catch {
    return null;
  }
}

async function handleEnrich(request: Request, env: Env) {
  const userId = await requireUser(request, env);
  if (!userId) return json({ error: "Authentication required" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    names?: unknown; tlds?: unknown; brief?: string; industry?: string; avoid?: string; maxLen?: unknown;
    lite?: unknown;
  };
  const names = Array.isArray(body.names)
    ? body.names.map((n) => String(n)).filter(Boolean).slice(0, 24)
    : [];
  if (names.length === 0) return json({ results: [] });

  // Lite mode: the client's auto-deepen can chain several pages in seconds; skipping the
  // per-name iTunes and GitHub fan-out there avoids hammering rate-limited third parties
  // (which would corrupt scores — see cardScore's null handling) while keeping the parts
  // deepening actually needs: domain availability, taglines, fit.
  const lite = body.lite === true;
  const context = buildContext(body);
  const tlds = parseTlds(body.tlds);
  const [appCounts, domainMap, insights, githubs] = await Promise.all([
    lite
      ? Promise.resolve(names.map(() => null as number | null))
      : Promise.all(names.map(async (name) => (await checkAppStore(name)).resultCount)),
    checkDomains(names, tlds, env),
    generateInsights(names, context, env),
    lite
      ? Promise.resolve(names.map(() => null as boolean | null))
      : Promise.all(names.map((name) => checkGithub(name)))
  ]);

  const results = names.map((name, index) => {
    const appStoreCount = appCounts[index];
    const domains = domainMap.get(name.toLowerCase()) ?? [];
    const insight = insights.get(name.toLowerCase());
    const base = cardScore(name, appStoreCount, domains, context);
    // Blend in the model's brief-fit rating so the ring rewards relevance, not just
    // availability mechanics; base score still dominates.
    const score = insight?.fit != null ? Math.round(base * 0.7 + insight.fit * 0.3) : base;
    return {
      name,
      displayName: insight?.tagline ?? "",
      score,
      style: insight?.style ?? null,
      appStoreCount,
      github: githubs[index],
      domains
    };
  });
  // Best-first within the batch so the strongest names lead each page.
  results.sort((a, b) => b.score - a.score);
  return json({ results });
}

// POST /api/audience — simulated target-customer reactions to one name (drill-down).
// One quality-first model call: personas derive from the brief, with a forced skeptic and
// spread-the-scores instructions to counter LLM flattery. The AI Gateway caches on request
// body, so re-testing the same name+brief is free.
async function handleAudience(request: Request, env: Env) {
  const userId = await requireUser(request, env);
  if (!userId) return json({ error: "Authentication required" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    name?: string; brief?: string; industry?: string;
  };
  const name = brandCase(String(body.name ?? "")).slice(0, 30);
  if (!name) return json({ error: "Missing name" }, { status: 400 });
  const brief = String(body.brief ?? "").slice(0, 500);
  const industry = String(body.industry ?? "").slice(0, 200);

  const prompt = [
    `Product brief: ${brief || industry || "a modern software product"}`,
    industry ? `Industry: ${industry}` : "",
    "",
    `Simulate audience testing for the product name "${name}".`,
    "Invent 4 distinct people from this product's target audience. At least one must be a skeptic who is hard to impress.",
    "For each person, react to the name honestly IN THEIR VOICE:",
    '- "persona": who they are, 4-8 words',
    '- "quote": their gut reaction to the name, 8-20 words, first person',
    '- "readsAs": what they would guess the product is from the name alone, 3-8 words',
    '- "trust": 0-100, how much the name makes them trust and want the product. Spread the numbers honestly; a weak or confusing name must score low.',
    "Then add:",
    '- "resonance": 0-100 overall fit of the name to this audience',
    '- "positives": 1-3 short phrases',
    '- "concerns": 1-3 short phrases (always include at least one)',
    "",
    'Return ONLY JSON, nothing else: {"personas":[{"persona":"","quote":"","readsAs":"","trust":0}],"resonance":0,"positives":[],"concerns":[]}'
  ].filter(Boolean).join("\n");

  const system = "You run brutally honest brand-name audience panels. You never flatter a weak name.";
  try {
    let text = "";
    try {
      text = await namerText(env, system, prompt, 20000);
    } catch {
      text = "";
    }
    if (!text.trim()) {
      text = await gatewayText(env, system, prompt, { timeoutMs: 13000, maxOutputTokens: 700 });
    }
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const parsed = JSON.parse(start >= 0 && end > start ? text.slice(start, end + 1) : text) as {
      personas?: Array<{ persona?: unknown; quote?: unknown; readsAs?: unknown; trust?: unknown }>;
      resonance?: unknown; positives?: unknown; concerns?: unknown;
    };
    const personas = (Array.isArray(parsed.personas) ? parsed.personas : [])
      .slice(0, 5)
      .map((p) => ({
        persona: String(p?.persona ?? "").slice(0, 80),
        quote: String(p?.quote ?? "").slice(0, 220),
        readsAs: String(p?.readsAs ?? "").slice(0, 90),
        trust: clampInt(Number(p?.trust), 0, 100, 50)
      }))
      .filter((p) => p.persona && p.quote);
    if (personas.length === 0) return json({ error: "Audience testing unavailable right now" }, { status: 502 });
    const phrases = (value: unknown) =>
      (Array.isArray(value) ? value : []).slice(0, 3).map((s) => String(s).slice(0, 90)).filter(Boolean);
    return json({
      name,
      personas,
      resonance: clampInt(Number(parsed.resonance), 0, 100, 50),
      positives: phrases(parsed.positives),
      concerns: phrases(parsed.concerns)
    });
  } catch {
    return json({ error: "Audience testing unavailable right now" }, { status: 502 });
  }
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
      history = ((rows.results ?? []) as Array<{ role: string; content: string | null }>)
        .filter(r => (r.role === "user" || r.role === "assistant") && r.content != null && r.content !== "")
        .map(r => ({ role: r.role as "user" | "assistant", content: String(r.content) }));
    } catch { /* first session */ }
  }

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
  const adapter = createWorkersAiChat("@cf/openai/gpt-oss-120b", {
    binding: gatewayAi
  });

  // Deterministic tool orchestration instead of model-driven function calling.
  // Workers AI streaming + tools is unreliable: models (including gpt-oss-120b) intermittently
  // emit the tool call as plain text rather than a structured tool_call, which leaks raw JSON
  // to the user and never runs the tool. So we extract any domain(s) from the message and hit
  // the Registrar ourselves, then let the model phrase the result with NO tools in the loop —
  // nothing can leak, and the single model call streams cleanly token-by-token.
  const systemPrompts = [
    "You are a friendly domain availability assistant for copythe.link — a free tool for finding available domain names on Cloudflare at cost. Keep responses concise and friendly, and use light markdown (**bold** for domain names and prices). When Registrar results are provided below, base your answer strictly on them: say whether each domain is available, give the registration price when available, and encourage registering at cost. Never invent availability or prices. If no domain was provided, ask for a full domain like 'mynext.link'."
  ];
  const domains = Array.from(new Set(
    (userMessage.match(/\b[a-z0-9][a-z0-9.-]{0,251}\.[a-z]{2,}\b/gi) || []).map(d => d.toLowerCase())
  )).slice(0, 3);
  if (domains.length) {
    const results = await Promise.all(domains.map(d => executeDomainCheck(d, env)));
    systemPrompts.push("Live Cloudflare Registrar results (JSON): " + JSON.stringify(results) + ". Use ONLY these for availability and price.");
  }

  // No tools are passed, so the model can't leak a tool call as text. reasoning_effort:"low"
  // keeps the reasoning model snappy (its thinking goes to STEP_* events the SSE client ignores).
  const stream = chat({
    adapter,
    modelOptions: { reasoning_effort: "low" },
    systemPrompts,
    messages: [...history, { role: "user" as const, content: userMessage }]
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
    if (m === "POST" && pathname === "/api/audience") return handleAudience(request, env);
    if (m === "POST" && pathname === "/api/names") return handleNames(request, env);
    if (m === "POST" && pathname === "/api/enrich") return handleEnrich(request, env);
    if (m === "POST" && pathname === "/api/hacks/check") return handleHacksCheck(request, env);
    if (m === "POST" && pathname === "/api/suggest") return handleSuggest(request, env);
    if (m === "POST" && pathname === "/api/ground") return handleGround(request, env);
    if (m === "GET" && pathname === "/api/check") return handleCheck(request, env);
    return json({ error: "Not found" }, { status: 404 });
  }
};
