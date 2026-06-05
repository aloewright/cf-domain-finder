interface Env {
  BRAVE_API_KEY?: string;
  AI: any;
  // Cloudflare Registrar API (beta): account id + a token with Registrar permissions.
  // Used to confirm .com availability and current pricing. Optional — when unset, the
  // app degrades gracefully (availability shown as "unknown", generic purchase link).
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
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
  domain?: DomainInfo | null;
};

type NamingContext = {
// ... existing NamingContext type ...
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

function generateCandidates(context: NamingContext, seedsInput: unknown, requested: unknown) {
  const count =
    typeof requested === "number" && Number.isFinite(requested)
      ? Math.min(Math.max(Math.floor(requested), 8), 60)
      : 30;
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
    .filter((name) => !avoidTerms.some((term) => term && normalize(name).includes(term)))
    .slice(0, count * 3);
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

function scoreCandidate(
  name: string,
  appStore: CandidateResult["appStore"],
  web: CandidateResult["web"],
  context: NamingContext
) {
  let score = 100;
  const reasons: string[] = [];
  const normName = normalize(name);
  const terms = contextWords(context);
  const avoidTerms = context.avoid.map(normalize);

  if (appStore.exact.length > 0) {
    score -= 70;
    reasons.push("Exact App Store software name collision.");
  } else {
    reasons.push("No exact US App Store software match found.");
  }

  if (appStore.resultCount > 18) {
    score -= 16;
    reasons.push("Crowded App Store search results.");
  } else if (appStore.resultCount > 8) {
    score -= 8;
    reasons.push("Some related App Store noise.");
  } else {
    score += 6;
    reasons.push("Low App Store result noise.");
  }

  if (appStore.close.some((hit) => normalize(hit.name).includes(normName))) {
    score -= 12;
    reasons.push("Close App Store match includes the candidate string.");
  }

  if (web.checked) {
    const directWeb = web.hits.filter((hit) => normalize(`${hit.title} ${hit.url}`).includes(normName));
    score -= Math.min(22, directWeb.length * 6);
    if (directWeb.length > 0) {
      reasons.push("Public web search has same-string results.");
    } else {
      reasons.push("No obvious same-string web collision in top results.");
    }
  } else {
    reasons.push("Web collision check skipped; Brave key not configured.");
  }

  if (name.length <= 12) {
    score += 8;
    reasons.push("Short enough for app icon, menu bar, and App Store recall.");
  } else if (name.length > 15) {
    score -= 6;
    reasons.push("Longer brand name.");
  }

  if (/(port|harbor|dock|quay|channel|relay|link|gate|line|light|glass)/i.test(name)) {
    score += 7;
    reasons.push("Fits the port/routing/connection naming system.");
  }

  const matchingTerms = terms.filter((word) => word.length > 3 && normName.includes(word));
  if (matchingTerms.length > 0) {
    score += Math.min(12, matchingTerms.length * 4);
    reasons.push(`Echoes target terms: ${visibleList(matchingTerms)}.`);
  }

  const matchingAvoids = avoidTerms.filter((word) => word.length > 2 && normName.includes(word));
  if (matchingAvoids.length > 0) {
    score -= 60;
    reasons.push(`Contains avoid term: ${visibleList(matchingAvoids)}.`);
  }

  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const verdict: CandidateResult["verdict"] =
    clamped >= 82 ? "strong" : clamped >= 68 ? "usable" : clamped >= 45 ? "crowded" : "avoid";
  return { score: clamped, verdict, reasons };
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
    // Route through the AI Gateway dynamic route "dynamic/fast". Per Cloudflare's
    // Dynamic Routing docs, a dynamic route is invoked from a Worker via the gateway
    // binding's compat provider (env.AI.run("dynamic/...") does NOT resolve dynamic
    // routes — it treats the slug as a literal model id). The compat/chat-completions
    // response is OpenAI-shaped (choices[].message.content).
    // https://developers.cloudflare.com/ai-gateway/features/dynamic-routing/usage/
    const aiCall = env.AI.gateway("x").run({
      provider: "compat",
      endpoint: "chat/completions",
      headers: {},
      query: {
        model: "dynamic/fast",
        messages: [
          { role: "system", content: "You are a naming expert. Return only JSON." },
          { role: "user", content: prompt }
        ],
        max_tokens: 800
      }
    }) as Promise<{ response?: string; choices?: Array<{ message?: { content?: string } }> }>;

    // Hard timeout so a slow or hung gateway call can never stall the request.
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("AI grounding timed out")), 8000)
    );
    const result = await Promise.race([aiCall, timeout]);

    const text = result.response ?? result.choices?.[0]?.message?.content ?? "";
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

async function scoreName(name: string, context: NamingContext, env: Env): Promise<CandidateResult> {
  // Grounding (an AI call) is intentionally NOT done here. Doing it per candidate turned
  // /api/suggest into 24-72 blocking AI calls and hung the "Generate Names" button.
  // Grounding now happens lazily, one name at a time, via /api/ground when the deep-dive
  // modal opens — so generation stays fast.
  const [appStore, web] = await Promise.all([checkAppStore(name), checkWeb(name, env)]);
  const scored = scoreCandidate(name, appStore, web, context);

  return {
    name,
    displayName: `${name} - Private AI`,
    subtitle: "Chat, memory, actions",
    score: scored.score,
    verdict: scored.verdict,
    reasons: scored.reasons,
    appStore,
    web
  };
}

// Cloudflare dashboard registration page. We deep-link here rather than calling the
// Registrar "register" endpoint directly: registration charges the account's default
// payment method and is non-refundable, so the purchase must be an explicit user action.
const PURCHASE_URL = "https://dash.cloudflare.com/?to=/:account/domains/registrations";

function unknownDomain(domain: string): DomainInfo {
  return {
    domain,
    available: null,
    registrationCost: null,
    renewalCost: null,
    currency: null,
    purchaseUrl: PURCHASE_URL
  };
}

// Confirm .com availability + current price via the Cloudflare Registrar API (beta)
// "Check" endpoint. Accepts up to 20 domains per request, so a page of names is at most
// a couple of batched calls. Bounded by a timeout and fully graceful: any missing
// credential, error, or timeout yields `available: null` (unknown) rather than failing
// the request. https://developers.cloudflare.com/registrar/registrar-api/
async function checkDomains(names: string[], env: Env): Promise<Map<string, DomainInfo>> {
  const domains = unique(names.map((name) => `${name.toLowerCase()}.com`));
  const out = new Map<string, DomainInfo>();
  for (const domain of domains) {
    out.set(domain, unknownDomain(domain));
  }

  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN || domains.length === 0) {
    return out;
  }

  await Promise.all(
    chunk(domains, 20).map(async (batch) => {
      try {
        const response = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/registrar/domain-check`,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
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
          out.set(entry.name, {
            domain: entry.name,
            available: entry.registrable ?? null,
            registrationCost: entry.pricing?.registration_cost ?? null,
            renewalCost: entry.pricing?.renewal_cost ?? null,
            currency: entry.pricing?.currency ?? null,
            reason: entry.reason,
            purchaseUrl: PURCHASE_URL
          });
        }
      } catch {
        // Leave this batch as "unknown" (already seeded above).
      }
    })
  );

  return out;
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
  };
  const context = buildContext(body);
  const candidates = generateCandidates(context, body.seeds, body.count);
  const scored: CandidateResult[] = [];

  for (const batch of chunk(candidates, 6)) {
    const results = await Promise.all(batch.map((name) => scoreName(name, context, env)));
    scored.push(...results);
  }

  const count = typeof body.count === "number" ? body.count : 24;
  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const top = scored.slice(0, count);

  // Confirm .com availability + price for just the names we're about to return.
  const domains = await checkDomains(
    top.map((result) => result.name),
    env
  );
  const results = top.map((result) => ({
    ...result,
    domain: domains.get(`${result.name.toLowerCase()}.com`) ?? null
  }));

  return json({
    results,
    generated: candidates.length,
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
  return json(await scoreName(name, context, env));
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0d0e10;
      --panel: rgba(31, 32, 35, 0.6);
      --panel-strong: rgba(39, 40, 44, 0.85);
      --line: rgba(255, 255, 255, 0.08);
      --text: #f4f1ec;
      --muted: rgba(244, 241, 236, 0.6);
      --accent: #8be8ee;
      --accent-glow: rgba(139, 232, 238, 0.3);
      --accent-2: #bda7ff;
      --accent-2-glow: rgba(189, 167, 255, 0.3);
      --button-bg: #3b82f6;
      --button-hover: #2563eb;
      --warn: #ffcf70;
      --bad: #ff8e8e;
      --good: #8ef0b4;
      --glass-border: rgba(255, 255, 255, 0.1);
      --glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
      font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      background: var(--bg);
      background-image: 
        radial-gradient(circle at 10% 20%, rgba(139, 232, 238, 0.15) 0%, transparent 40%),
        radial-gradient(circle at 90% 10%, rgba(189, 167, 255, 0.12) 0%, transparent 40%),
        linear-gradient(135deg, #0d0e10 0%, #1a1b1e 50%, #0d0e10 100%);
      background-attachment: fixed;
      overflow-x: hidden;
    }
    
    /* Layout */
    .app-container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 40px 24px;
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
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.03em;
      background: linear-gradient(to right, #fff, var(--muted));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    
    .lab-tag {
      font-size: 12px;
      color: var(--muted);
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    /* Wizard Components */
    .wizard-step {
      display: none;
      max-width: 800px;
      margin: 0 auto;
      width: 100%;
      animation: fadeIn 0.4s ease-out;
    }
    
    .wizard-step.active { display: block; }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .progress-bar {
      display: flex;
      gap: 8px;
      margin-bottom: 40px;
      justify-content: center;
    }
    
    .progress-dot {
      width: 40px;
      height: 4px;
      background: var(--line);
      border-radius: 2px;
      transition: all 0.3s ease;
    }
    
    .progress-dot.active {
      background: var(--accent);
      box-shadow: 0 0 12px var(--accent-glow);
    }

    .step-title {
      font-size: 48px;
      font-weight: 800;
      letter-spacing: -0.04em;
      margin-bottom: 12px;
      text-align: center;
    }
    
    .step-subtitle {
      color: var(--muted);
      font-size: 18px;
      text-align: center;
      margin-bottom: 48px;
    }

    /* Form Elements */
    .input-card {
      background: var(--panel);
      backdrop-filter: blur(12px);
      border: 1px solid var(--glass-border);
      border-radius: 24px;
      padding: 32px;
      box-shadow: var(--glass-shadow);
    }
    
    .form-group { margin-bottom: 24px; }
    
    label {
      display: block;
      color: var(--muted);
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
    }
    
    textarea, input {
      width: 100%;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 16px;
      color: var(--text);
      font-family: inherit;
      font-size: 16px;
      transition: all 0.2s ease;
    }
    
    textarea:focus, input:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 4px var(--accent-glow);
    }
    
    .chip-container {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 12px;
    }
    
    .chip {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--line);
      border-radius: 99px;
      padding: 8px 16px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .chip:hover { background: rgba(255, 255, 255, 0.1); }
    .chip.selected {
      background: var(--accent-glow);
      border-color: var(--accent);
      color: var(--accent);
    }

    .nav-actions {
      display: flex;
      justify-content: space-between;
      margin-top: 40px;
      align-items: center;
    }
    
    button {
      padding: 12px 28px;
      border-radius: 99px;
      font-weight: 700;
      font-size: 16px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    button.primary {
      background: var(--button-bg);
      color: white;
      border: none;
    }
    
    button.primary:hover {
      background: var(--button-hover);
      transform: translateY(-2px);
    }
    
    button.secondary {
      background: transparent;
      color: var(--muted);
      border: 1px solid var(--line);
    }
    
    button.secondary:hover {
      color: var(--text);
      border-color: var(--muted);
    }

    /* Review Screen Specific */
    .review-item {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 20px;
      border-bottom: 1px solid var(--line);
    }
    
    .review-item:last-child { border-bottom: none; }
    
    .review-content h4 {
      margin: 0 0 4px;
      color: var(--muted);
      font-size: 13px;
      text-transform: uppercase;
    }
    
    .review-content p {
      margin: 0;
      font-size: 16px;
      line-height: 1.5;
    }

    /* Dashboard Layout */
    .dashboard {
      display: none;
      grid-template-columns: 300px 1fr;
      gap: 32px;
      animation: fadeIn 0.4s ease-out;
    }
    
    .dashboard.active { display: grid; }
    
    .sidebar {
      position: sticky;
      top: 40px;
      height: fit-content;
    }
    
    .results-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }

    /* Result Card */
    .result-card {
      background: var(--panel);
      backdrop-filter: blur(12px);
      border: 1px solid var(--glass-border);
      border-radius: 20px;
      padding: 24px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }
    
    .result-card:hover {
      transform: translateY(-4px) scale(1.02);
      border-color: rgba(255, 255, 255, 0.2);
      background: var(--panel-strong);
    }
    
    .result-card.strong { border-left: 4px solid var(--good); }
    .result-card.usable { border-left: 4px solid var(--accent); }
    .result-card.crowded { border-left: 4px solid var(--warn); }
    .result-card.avoid { border-left: 4px solid var(--bad); }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }
    
    .card-title {
      font-size: 24px;
      font-weight: 800;
      margin: 0;
    }
    
    .circular-progress {
      width: 48px;
      height: 48px;
      position: relative;
    }
    
    .circular-progress svg {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }
    
    .circular-progress circle {
      fill: none;
      stroke-width: 4;
      stroke-linecap: round;
    }
    
    .progress-bg { stroke: rgba(255, 255, 255, 0.05); }
    .progress-value {
      stroke: var(--accent);
      transition: stroke-dashoffset 1s ease;
    }
    
    .score-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 14px;
      font-weight: 800;
    }

    .card-meta {
      font-size: 13px;
      color: var(--muted);
      margin-bottom: 16px;
    }
    
    .card-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      font-size: 12px;
    }
    
    .stat-row {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--muted);
    }
    
    .stat-row i { width: 14px; }
    .stat-value { color: var(--text); font-weight: 600; }
    .stat-value.available { color: var(--good); }

    /* Deep Dive View */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.8);
      backdrop-filter: blur(8px);
      z-index: 1000;
      display: none;
      place-items: center;
      padding: 24px;
    }
    
    .modal-overlay.active { display: grid; }
    
    .deep-dive-card {
      background: var(--bg);
      border: 1px solid var(--glass-border);
      border-radius: 32px;
      width: 100%;
      max-width: 1000px;
      max-height: 90vh;
      overflow-y: auto;
      padding: 40px;
      position: relative;
    }
    
    .close-modal {
      position: absolute;
      top: 24px;
      right: 24px;
      cursor: pointer;
      color: var(--muted);
    }

    .deep-dive-grid {
      display: grid;
      grid-template-columns: 1fr 350px;
      gap: 40px;
    }
    
    .preview-section {
      background: linear-gradient(135deg, #1a1b1e, #0d0e10);
      border-radius: 24px;
      padding: 40px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 32px;
    }
    
    .mock-phone {
      width: 200px;
      height: 400px;
      background: #000;
      border: 8px solid #222;
      border-radius: 32px;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    
    .mock-card {
      width: 300px;
      height: 180px;
      background: linear-gradient(135deg, #333, #111);
      border-radius: 12px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    /* Sidebar controls */
    .filter-section {
      background: var(--panel);
      border-radius: 20px;
      padding: 20px;
      margin-bottom: 20px;
    }
    
    .slider-container { margin-top: 16px; }
    input[type=range] {
      -webkit-appearance: none;
      background: var(--line);
      height: 4px;
      border-radius: 2px;
    }
    input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 16px;
      height: 16px;
      background: var(--accent);
      border-radius: 50%;
      cursor: pointer;
    }

    /* Mobile adjustments */
    @media (max-width: 1000px) {
      .dashboard { grid-template-columns: 1fr; }
      .sidebar { position: static; }
      .deep-dive-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="app-container">
    <header>
      <div class="logo-group">
        <span class="lab-tag">Portland Software / fly.pm naming lab</span>
        <h1>Nomenclature</h1>
      </div>
      <div id="header-actions"></div>
    </header>

    <!-- Wizard Step 1: Positioning Brief -->
    <div id="step-1" class="wizard-step active">
      <div class="progress-bar">
        <div class="progress-dot active"></div>
        <div class="progress-dot"></div>
        <div class="progress-dot"></div>
        <div class="progress-dot"></div>
      </div>
      <h2 class="step-title">Start with your vision.</h2>
      <p class="step-subtitle">Describe what you're building in a few sentences.</p>
      
      <div class="input-card">
        <div class="form-group">
          <label for="brief">Positioning Brief</label>
          <textarea id="brief" placeholder="Private AI operator for chat, memory, files, MCP connections, and local-first workflows. Naming direction: ports, routing, harbors, trusted connections, glass UI...">Private AI operator for chat, memory, files, MCP connections, and local-first workflows. Naming direction: ports, routing, harbors, trusted connections, glass UI, Portland Software.</textarea>
        </div>
        <div class="nav-actions">
          <div></div>
          <button class="primary" onclick="nextStep(2)">Continue <i data-lucide="arrow-right"></i></button>
        </div>
      </div>
    </div>

    <!-- Wizard Step 2: Industry & Keywords -->
    <div id="step-2" class="wizard-step">
      <div class="progress-bar">
        <div class="progress-dot active"></div>
        <div class="progress-dot active"></div>
        <div class="progress-dot"></div>
        <div class="progress-dot"></div>
      </div>
      <h2 class="step-title">Define your Industry & Keywords.</h2>
      <p class="step-subtitle">Select or add the primary industry and seed words for your product.</p>
      
      <div class="input-card">
        <div class="form-group">
          <label for="industry">Industry / Category</label>
          <input id="industry" value="AI productivity, personal software, private operations" />
          <div class="chip-container">
            <span class="chip" onclick="addChip('industry', 'SaaS')">SaaS</span>
            <span class="chip" onclick="addChip('industry', 'Enterprise')">Enterprise</span>
            <span class="chip" onclick="addChip('industry', 'Developer Tools')">Developer Tools</span>
          </div>
        </div>
        <div class="form-group">
          <label for="seeds">Seed Words</label>
          <input id="seeds" value="port, harbor, dock, quay, channel, relay, link, link, connect, flow" />
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

    <!-- Wizard Step 3: Negative Constraints -->
    <div id="step-3" class="wizard-step">
      <div class="progress-bar">
        <div class="progress-dot active"></div>
        <div class="progress-dot active"></div>
        <div class="progress-dot active"></div>
        <div class="progress-dot"></div>
      </div>
      <h2 class="step-title">What should be avoided?</h2>
      <p class="step-subtitle">Define concepts or themes that should be absolutely avoided.</p>
      
      <div class="input-card">
        <div class="form-group">
          <label for="avoid">Negative Constraints</label>
          <textarea id="avoid" placeholder="e.g., crypto, dating, bird, plane, logistics...">crypto, dating, bird, plane, logistics</textarea>
        </div>
        <div class="nav-actions">
          <button class="secondary" onclick="nextStep(2)">Back</button>
          <button class="primary" onclick="nextStep(4)">Next Step <i data-lucide="arrow-right"></i></button>
        </div>
      </div>
    </div>

    <!-- Wizard Step 4: Summary Review -->
    <div id="step-4" class="wizard-step">
      <div class="progress-bar">
        <div class="progress-dot active"></div>
        <div class="progress-dot active"></div>
        <div class="progress-dot active"></div>
        <div class="progress-dot active"></div>
      </div>
      <h2 class="step-title">Review Your Configuration</h2>
      <p class="step-subtitle">Summary Review before Generation.</p>
      
      <div class="input-card">
        <div class="review-item">
          <div class="review-content">
            <h4>Positioning Brief</h4>
            <p id="review-brief"></p>
          </div>
          <button class="secondary" style="padding: 6px 12px; font-size: 12px;" onclick="nextStep(1)"><i data-lucide="edit-2"></i> Edit</button>
        </div>
        <div class="review-item">
          <div class="review-content">
            <h4>Keywords / Industry</h4>
            <p id="review-industry"></p>
          </div>
          <button class="secondary" style="padding: 6px 12px; font-size: 12px;" onclick="nextStep(2)"><i data-lucide="edit-2"></i> Edit</button>
        </div>
        <div class="review-item">
          <div class="review-content">
            <h4>Negative Constraints</h4>
            <p id="avoid-summary"></p>
          </div>
          <button class="secondary" style="padding: 6px 12px; font-size: 12px;" onclick="nextStep(3)"><i data-lucide="edit-2"></i> Edit</button>
        </div>
        
        <div class="nav-actions">
          <button class="secondary" onclick="nextStep(3)">Previous</button>
          <button class="primary" id="generate-btn" onclick="generateNames()">Generate Names <i data-lucide="sparkles"></i></button>
        </div>
      </div>
    </div>

    <!-- Results Dashboard -->
    <div id="dashboard" class="dashboard">
      <aside class="sidebar">
        <div class="input-card" style="padding: 20px;">
          <h3 style="margin-top: 0; font-size: 18px;">Refine Results</h3>
          
          <div class="form-group">
            <label>Name Length</label>
            <div class="slider-container">
              <input type="range" min="1" max="3" step="1" value="2" style="width: 100%;">
              <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--muted); margin-top: 8px;">
                <span>Short</span>
                <span>Medium</span>
                <span>Long</span>
              </div>
            </div>
          </div>
          
          <div class="form-group">
            <label>Style</label>
            <select style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--line); color: white; padding: 8px; border-radius: 8px;">
              <option>Abstract</option>
              <option>Compound</option>
              <option>Real Word</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Domain (.com)</label>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <label style="display: flex; align-items: center; gap: 8px; font-weight: 400; margin: 0; cursor: pointer;">
                <input type="checkbox" checked style="width: auto;"> Short
              </label>
              <label style="display: flex; align-items: center; gap: 8px; font-weight: 400; margin: 0; cursor: pointer;">
                <input type="checkbox" style="width: auto;"> Medium
              </label>
            </div>
          </div>
          
          <button class="primary" style="width: 100%; margin-top: 12px;" onclick="generateNames()">Regenerate</button>
        </div>
      </aside>
      
      <main>
        <div style="margin-bottom: 24px;">
          <h2 style="margin: 0; font-size: 28px;">Results Dashboard</h2>
          <p style="color: var(--muted); margin: 4px 0 0;">Analyzing product names for your brief</p>
        </div>
        
        <div id="results-grid" class="results-grid">
          <!-- Cards injected here -->
        </div>
      </main>
    </div>
  </div>

  <!-- Deep Dive Modal -->
  <div id="modal" class="modal-overlay" onclick="closeModal(event)">
    <div class="deep-dive-card" onclick="event.stopPropagation()">
      <div class="close-modal" onclick="closeModal()"><i data-lucide="x"></i></div>
      
      <div class="deep-dive-grid">
        <div>
          <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
            <h2 id="modal-name" style="font-size: 48px; margin: 0;"></h2>
            <div id="modal-main-score" class="circular-progress" style="width: 64px; height: 64px;">
              <!-- Score injected here -->
            </div>
            <i data-lucide="star" style="color: var(--warn); fill: var(--warn);"></i>
          </div>
          
          <div class="input-card" style="margin-bottom: 32px; background: rgba(255,255,255,0.03);">
            <h3 style="margin-top: 0; font-size: 16px; color: var(--muted);">Detailed Score Breakdown</h3>
            <div style="display: flex; justify-content: space-between; gap: 24px; margin-top: 24px;">
              <div style="text-align: center; flex: 1;">
                <div id="modal-score-1" class="circular-progress" style="margin: 0 auto 12px;"></div>
                <div style="font-size: 14px;">Linguistic</div>
              </div>
              <div style="text-align: center; flex: 1;">
                <div id="modal-score-2" class="circular-progress" style="margin: 0 auto 12px;"></div>
                <div style="font-size: 14px;">Trademark Risk</div>
              </div>
              <div style="text-align: center; flex: 1;">
                <div id="modal-score-3" class="circular-progress" style="margin: 0 auto 12px;"></div>
                <div style="font-size: 14px;">Market Fit</div>
              </div>
            </div>
          </div>
          
          <div class="form-group">
            <h3 style="font-size: 16px;">Thesaurus / Related Meanings</h3>
            <ul id="modal-reasons" style="list-style: none; padding: 0; display: grid; gap: 12px;">
              <!-- Reasons injected here -->
            </ul>
          </div>
        </div>
        
        <aside>
          <div class="input-card" style="margin-bottom: 24px; background: rgba(255,255,255,0.03);">
            <h3 style="margin-top: 0; font-size: 16px;">Purchase Domain</h3>
            <div style="text-align: center; padding: 20px 0;">
              <div style="font-size: 14px; color: var(--muted); margin-bottom: 8px;"><span id="modal-domain"></span>.com</div>
              <div id="modal-domain-status" style="font-size: 14px; font-weight: 600; margin-bottom: 8px; color: var(--muted);">Checking availability…</div>
              <div id="modal-domain-price" style="font-size: 32px; font-weight: 800; margin-bottom: 4px;">—</div>
              <div id="modal-domain-renewal" style="font-size: 12px; color: var(--muted); margin-bottom: 20px;"></div>
              <a id="modal-buy-link" href="#" target="_blank" rel="noreferrer" class="primary" style="width: 100%; justify-content: center; background: linear-gradient(to right, #6366f1, #a855f7); text-decoration: none; box-sizing: border-box;">Register on Cloudflare <i data-lucide="external-link"></i></a>
              <div style="font-size: 10px; color: var(--muted); margin-top: 10px;">Availability &amp; price via Cloudflare Registrar</div>
            </div>
          </div>
          
          <div class="preview-section">
            <h3 style="margin: 0; font-size: 16px; color: var(--muted); align-self: flex-start;">Visual Context</h3>
            <div class="mock-phone">
               <div style="font-size: 20px; font-weight: 800;" id="phone-preview-name"></div>
               <div style="font-size: 10px; color: #666;">Mobile App Preview</div>
            </div>
            <div class="mock-card">
               <div style="font-size: 24px; font-weight: 800;" id="card-preview-name"></div>
               <div style="font-size: 10px; color: #aaa;">Business Card</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </div>

  <script>
    let currentStep = 1;
    let resultsData = [];

    function nextStep(n) {
      document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
      document.getElementById('step-' + n).classList.add('active');
      currentStep = n;
      
      if (n === 4) {
        document.getElementById('review-brief').textContent = document.getElementById('brief').value;
        document.getElementById('review-industry').textContent = document.getElementById('industry').value;
        document.getElementById('avoid-summary').textContent = document.getElementById('avoid').value;
      }
      
      lucide.createIcons();
    }

    function addChip(id, text) {
      const input = document.getElementById(id);
      const val = input.value.trim();
      if (!val.includes(text)) {
        input.value = val ? val + ', ' + text : text;
      }
    }

    function renderProgressCircle(score, size = 48) {
      const radius = (size / 2) - 4;
      const circumference = 2 * Math.PI * radius;
      const offset = circumference - (score / 100) * circumference;
      return \`
        <svg width="\${size}" height="\${size}">
          <circle class="progress-bg" cx="\${size/2}" cy="\${size/2}" r="\${radius}"></circle>
          <circle class="progress-value" cx="\${size/2}" cy="\${size/2}" r="\${radius}" 
            stroke-dasharray="\${circumference}" 
            stroke-dashoffset="\${offset}"></circle>
        </svg>
        <span class="score-text">\${score}</span>
      \`;
    }

    async function generateNames() {
      const btn = document.getElementById('generate-btn');
      btn.disabled = true;
      btn.innerHTML = 'Generating... <i data-lucide="loader-2" class="animate-spin"></i>';
      lucide.createIcons();
      
      try {
        const response = await fetch('/api/suggest', {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify({
            brief: document.getElementById('brief').value,
            industry: document.getElementById('industry').value,
            avoid: document.getElementById('avoid').value,
            seeds: document.getElementById('seeds').value,
            count: 24
          })
        });
        
        const data = await response.json();
        resultsData = data.results;
        
        renderDashboard();
      } catch (e) {
        alert('Error generating names: ' + e.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = 'Generate Names <i data-lucide="sparkles"></i>';
        lucide.createIcons();
      }
    }

    function formatDomainStat(d) {
      if (!d || d.available === null || d.available === undefined) {
        return '<span class="stat-value">—</span>';
      }
      if (d.available) {
        const price = d.registrationCost ? '$' + d.registrationCost + '/yr' : 'Available';
        return '<span class="stat-value available">' + price + '</span>';
      }
      return '<span class="stat-value" style="color: var(--bad);">Taken</span>';
    }

    function renderDashboard() {
      document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
      document.getElementById('dashboard').classList.add('active');

      const grid = document.getElementById('results-grid');
      grid.innerHTML = resultsData.map((item, idx) => \`
        <div class="result-card \${item.verdict}" onclick="showDeepDive(\${idx})">
          <div class="card-header">
            <h3 class="card-title">\${item.name}</h3>
            <div class="circular-progress">\${renderProgressCircle(item.score)}</div>
          </div>
          <div class="card-meta">\${item.displayName}</div>
          <div class="card-stats">
            <div class="stat-row"><i data-lucide="globe"></i> .com: \${formatDomainStat(item.domain)}</div>
            <div class="stat-row"><i data-lucide="smartphone"></i> App Store: <span class="stat-value">\${item.appStore.resultCount} results</span></div>
            <div class="stat-row"><i data-lucide="volume-2"></i> Sound: <span class="stat-value">\${item.grounding ? (item.grounding.linguisticScore > 80 ? 'Excellent' : 'Good') : 'N/A'}</span></div>
            <div class="stat-row"><i data-lucide="zap"></i> Fit: <span class="stat-value">\${item.grounding ? (item.grounding.marketFitScore > 80 ? 'High' : 'Medium') : 'N/A'}</span></div>
          </div>
        </div>
      \`).join('');

      lucide.createIcons();
    }

    function renderDomainPanel(item) {
      const d = item.domain || null;
      const statusEl = document.getElementById('modal-domain-status');
      const priceEl = document.getElementById('modal-domain-price');
      const renewalEl = document.getElementById('modal-domain-renewal');
      const buyLink = document.getElementById('modal-buy-link');

      buyLink.href = (d && d.purchaseUrl) || 'https://dash.cloudflare.com/?to=/:account/domains/registrations';

      if (!d || d.available === null || d.available === undefined) {
        statusEl.textContent = 'Availability unknown';
        statusEl.style.color = 'var(--muted)';
        priceEl.textContent = '—';
        renewalEl.textContent = '';
        return;
      }
      if (d.available) {
        statusEl.textContent = 'Available';
        statusEl.style.color = 'var(--good)';
        priceEl.textContent = d.registrationCost ? '$' + d.registrationCost : 'Available';
        renewalEl.textContent = d.renewalCost ? 'Renews at $' + d.renewalCost + '/yr (' + (d.currency || 'USD') + ')' : '';
      } else {
        statusEl.textContent = 'Taken' + (d.reason ? ' (' + d.reason.replace(/_/g, ' ') + ')' : '');
        statusEl.style.color = 'var(--bad)';
        priceEl.textContent = '—';
        renewalEl.textContent = '';
      }
    }

    async function showDeepDive(idx) {
      const item = resultsData[idx];

      document.getElementById('modal-name').textContent = item.name;
      document.getElementById('modal-main-score').innerHTML = renderProgressCircle(item.score, 64);
      document.getElementById('modal-score-2').innerHTML = renderProgressCircle(Math.max(0, 100 - item.appStore.resultCount * 4), 56);
      document.getElementById('modal-domain').textContent = item.name.toLowerCase();
      document.getElementById('phone-preview-name').textContent = item.name;
      document.getElementById('card-preview-name').textContent = item.name;
      document.getElementById('modal').classList.add('active');

      // Domain availability + price already came back with /api/suggest (Cloudflare Registrar).
      renderDomainPanel(item);

      // Grounding is fetched on demand (one name at a time) so generation stays fast.
      if (item.grounding) {
        renderGrounding(item);
        return;
      }

      document.getElementById('modal-score-1').innerHTML = renderProgressCircle(0, 56);
      document.getElementById('modal-score-3').innerHTML = renderProgressCircle(0, 56);
      document.getElementById('modal-reasons').innerHTML = '<p style="color: var(--muted);">Analyzing this name…</p>';
      lucide.createIcons();

      try {
        const res = await fetch('/api/ground', {
          method: 'POST',
          headers: {'content-type': 'application/json'},
          body: JSON.stringify({
            name: item.name,
            brief: document.getElementById('brief').value,
            industry: document.getElementById('industry').value,
            avoid: document.getElementById('avoid').value
          })
        });
        item.grounding = await res.json();
      } catch (e) {
        item.grounding = {
          summary: 'Grounding analysis unavailable.',
          associations: [],
          linguisticScore: 70,
          marketFitScore: 60,
          relatedMeanings: []
        };
      }
      renderGrounding(item);
    }

    function renderGrounding(item) {
      const g = item.grounding || {};

      document.getElementById('modal-score-1').innerHTML = renderProgressCircle(g.linguisticScore || 70, 56);
      document.getElementById('modal-score-3').innerHTML = renderProgressCircle(g.marketFitScore || 60, 56);

      const meanings = g.relatedMeanings || [];
      const associations = g.associations || [];

      document.getElementById('modal-reasons').innerHTML = \`
        <div style="margin-bottom: 20px;">
          <p style="color: var(--text); font-style: italic; margin-bottom: 16px;">"\${g.summary || 'No grounding summary available.'}"</p>
          <div class="chip-container" style="margin-top: 8px;">
            \${associations.map(a => \`<span class="chip" style="font-size: 11px;">\${a}</span>\`).join('')}
          </div>
        </div>
        \${meanings.length ? \`
          <h4 style="font-size: 12px; color: var(--muted); margin-bottom: 8px;">RELATED MEANINGS</h4>
          \${meanings.map(m => \`
            <li style="display: flex; gap: 12px; align-items: center; color: var(--muted); margin-bottom: 4px;">
              <i data-lucide="check-circle" style="color: var(--good); width: 14px;"></i>
              \${m}
            </li>
          \`).join('')}
        \` : ''}
      \`;

      lucide.createIcons();
    }

    function closeModal(e) {
      document.getElementById('modal').classList.remove('active');
    }

    lucide.createIcons();
  </script>
</body>
</html>`;

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") return html();
    if (request.method === "GET" && url.pathname === "/api/check") return handleCheck(request, env);
    if (request.method === "POST" && url.pathname === "/api/suggest") return handleSuggest(request, env);
    if (request.method === "POST" && url.pathname === "/api/ground") return handleGround(request, env);
    return json({ error: "Not found" }, { status: 404 });
  }
};
