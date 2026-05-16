interface Env {
  BRAVE_API_KEY?: string;
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
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", name);
  url.searchParams.set("country", "US");
  url.searchParams.set("entity", "software");
  url.searchParams.set("limit", "25");

  const response = await fetch(url, {
    headers: { "user-agent": "PortlightNamefinder/0.1" }
  });
  if (!response.ok) {
    return { exact: [], close: [], resultCount: 0 };
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
}

async function checkWeb(name: string, env: Env): Promise<CandidateResult["web"]> {
  if (!env.BRAVE_API_KEY) {
    return { checked: false, hits: [] };
  }

  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", `"${name}" app OR software OR AI`);
  url.searchParams.set("count", "6");
  url.searchParams.set("safesearch", "moderate");

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "x-subscription-token": env.BRAVE_API_KEY
    }
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

async function scoreName(name: string, context: NamingContext, env: Env): Promise<CandidateResult> {
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
  return json({
    results: scored.slice(0, count),
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
  <style>
    :root {
      color-scheme: dark;
      --bg: #111214;
      --panel: rgba(31, 32, 35, 0.78);
      --panel-strong: rgba(39, 40, 44, 0.9);
      --line: rgba(255, 255, 255, 0.11);
      --text: #f4f1ec;
      --muted: rgba(244, 241, 236, 0.64);
      --accent: #8be8ee;
      --accent-2: #bda7ff;
      --warn: #ffcf70;
      --bad: #ff8e8e;
      --good: #8ef0b4;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      background:
        radial-gradient(circle at 18% 10%, rgba(139,232,238,.26), transparent 28rem),
        radial-gradient(circle at 82% 0%, rgba(189,167,255,.24), transparent 30rem),
        linear-gradient(135deg, #101114, #1a1a1f 48%, #111214);
    }
    main { width: min(1180px, calc(100vw - 32px)); margin: 0 auto; padding: 44px 0; }
    header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 24px; }
    h1 { margin: 0; font-size: clamp(36px, 6vw, 72px); letter-spacing: -0.04em; line-height: .92; }
    .lede { max-width: 680px; color: var(--muted); font-size: 18px; line-height: 1.5; margin: 18px 0 0; }
    .pill { border: 1px solid var(--line); background: rgba(255,255,255,.06); color: var(--muted); border-radius: 999px; padding: 9px 13px; white-space: nowrap; }
    .grid { display: grid; grid-template-columns: 380px 1fr; gap: 18px; align-items: start; }
    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 28px;
      box-shadow: 0 24px 80px rgba(0,0,0,.3);
      backdrop-filter: blur(24px) saturate(1.2);
    }
    form.card { padding: 18px; position: sticky; top: 18px; }
    label { display: block; color: var(--muted); font-size: 13px; margin: 16px 0 7px; }
    textarea, input {
      width: 100%;
      color: var(--text);
      background: rgba(0,0,0,.24);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 13px 14px;
      font: inherit;
      outline: none;
      transition: border .16s ease, background .16s ease;
    }
    textarea { min-height: 128px; resize: vertical; }
    textarea:focus, input:focus { border-color: rgba(139,232,238,.55); background: rgba(0,0,0,.33); }
    .actions { display: flex; gap: 10px; margin-top: 16px; }
    button {
      border: 0;
      border-radius: 999px;
      background: var(--text);
      color: #151515;
      font: inherit;
      font-weight: 750;
      padding: 12px 16px;
      cursor: pointer;
      transition: transform .16s ease, opacity .16s ease;
    }
    button:hover { transform: translateY(-1px); }
    button.secondary { background: rgba(255,255,255,.08); color: var(--text); border: 1px solid var(--line); }
    button:disabled { opacity: .55; cursor: wait; transform: none; }
    .results { display: grid; gap: 12px; }
    .result { padding: 16px; }
    .result-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
    .brand { font-size: 28px; font-weight: 850; letter-spacing: -0.03em; }
    .meta { color: var(--muted); margin-top: 4px; }
    .score { width: 62px; height: 62px; border-radius: 50%; display: grid; place-items: center; font-weight: 850; background: rgba(255,255,255,.07); border: 1px solid var(--line); }
    .strong .score { color: var(--good); }
    .usable .score { color: var(--accent); }
    .crowded .score { color: var(--warn); }
    .avoid .score { color: var(--bad); }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .chip { font-size: 12px; color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 6px 9px; background: rgba(255,255,255,.04); }
    details { margin-top: 12px; color: var(--muted); }
    summary { cursor: pointer; color: var(--text); }
    a { color: var(--accent); text-decoration: none; }
    ul { margin: 8px 0 0; padding-left: 20px; }
    .empty { padding: 24px; color: var(--muted); }
    @media (max-width: 840px) {
      header, .grid { display: block; }
      form.card { position: static; margin-bottom: 18px; }
      .pill { display: inline-block; margin-top: 18px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Nomenclature</h1>
        <p class="lede">Generate product names, check live US App Store software collisions, and score whether a name is clean enough to pursue.</p>
      </div>
      <div class="pill">Portland Software / fly.pm naming lab</div>
    </header>
    <div class="grid">
      <form class="card" id="form">
        <label for="brief">Positioning brief</label>
        <textarea id="brief">Private AI operator for chat, memory, files, MCP connections, and local-first workflows. Naming direction: ports, routing, harbors, trusted connections, glass UI, Portland Software.</textarea>
        <label for="industry">Industry / category</label>
        <input id="industry" value="AI productivity, personal software, private operator tools" />
        <label for="audience">Target audience</label>
        <input id="audience" value="founders, executives, developers, solo operators, power users" />
        <label for="keywords">Important keywords</label>
        <input id="keywords" value="private, memory, operator, connection, port, context, workflow" />
        <label for="aiKeywords">AI-suggested keywords</label>
        <input id="aiKeywords" placeholder="Auto-filled from brief, or add your own" />
        <label for="avoid">Definite things to avoid</label>
        <input id="avoid" value="bird, plane, crypto, dating, logistics, shipping, generic chat" />
        <label for="seeds">Seed words</label>
        <input id="seeds" value="port, harbor, dock, quay, channel, relay, link, line, light, glass, operator, private, memory" />
        <label for="single">Check one exact name</label>
        <input id="single" placeholder="Portlight" />
        <div class="actions">
          <button type="submit" id="generate">Generate</button>
          <button type="button" class="secondary" id="check">Check exact</button>
        </div>
      </form>
      <section class="results" id="results">
        <div class="card empty">Run a search to score candidate names.</div>
      </section>
    </div>
  </main>
  <script>
    const form = document.querySelector('#form');
    const results = document.querySelector('#results');
    const generateButton = document.querySelector('#generate');
    const checkButton = document.querySelector('#check');

    function esc(value) {
      return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
    }

    function render(items) {
      if (!items.length) {
        results.innerHTML = '<div class="card empty">No results.</div>';
        return;
      }
      results.innerHTML = items.map(item => \`
        <article class="card result \${item.verdict}">
          <div class="result-head">
            <div>
              <div class="brand">\${esc(item.name)}</div>
              <div class="meta">\${esc(item.displayName)} · \${esc(item.subtitle)}</div>
            </div>
            <div class="score">\${item.score}</div>
          </div>
          <div class="chips">
            <span class="chip">\${esc(item.verdict)}</span>
            <span class="chip">\${item.appStore.exact.length ? 'exact App Store collision' : 'no exact App Store match'}</span>
            <span class="chip">\${item.appStore.resultCount} App Store results</span>
            <span class="chip">\${item.web.checked ? item.web.hits.length + ' web hits' : 'web not configured'}</span>
          </div>
          <details>
            <summary>Evidence</summary>
            <ul>\${item.reasons.map(reason => \`<li>\${esc(reason)}</li>\`).join('')}</ul>
            \${item.appStore.exact.length ? '<p><strong>Exact App Store:</strong></p><ul>' + item.appStore.exact.map(hit => \`<li><a href="\${esc(hit.url)}" target="_blank" rel="noreferrer">\${esc(hit.name)}</a> — \${esc(hit.seller)}</li>\`).join('') + '</ul>' : ''}
            \${item.appStore.close.length ? '<p><strong>Close App Store:</strong></p><ul>' + item.appStore.close.slice(0,4).map(hit => \`<li><a href="\${esc(hit.url)}" target="_blank" rel="noreferrer">\${esc(hit.name)}</a></li>\`).join('') + '</ul>' : ''}
            \${item.web.hits.length ? '<p><strong>Web:</strong></p><ul>' + item.web.hits.slice(0,4).map(hit => \`<li><a href="\${esc(hit.url)}" target="_blank" rel="noreferrer">\${esc(hit.title)}</a></li>\`).join('') + '</ul>' : ''}
          </details>
        </article>
      \`).join('');
    }

    async function postJSON(url, body) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    }

    form.addEventListener('submit', async event => {
      event.preventDefault();
      generateButton.disabled = true;
      results.innerHTML = '<div class="card empty">Checking App Store and web collisions...</div>';
      try {
        const payload = await postJSON('/api/suggest', {
          brief: document.querySelector('#brief').value,
          industry: document.querySelector('#industry').value,
          audience: document.querySelector('#audience').value,
          keywords: document.querySelector('#keywords').value,
          aiKeywords: document.querySelector('#aiKeywords').value,
          avoid: document.querySelector('#avoid').value,
          seeds: document.querySelector('#seeds').value,
          count: 24
        });
        if (!document.querySelector('#aiKeywords').value.trim()) {
          document.querySelector('#aiKeywords').value = payload.aiKeywords.join(', ');
        }
        render(payload.results);
      } catch (error) {
        results.innerHTML = '<div class="card empty">' + esc(error.message) + '</div>';
      } finally {
        generateButton.disabled = false;
      }
    });

    checkButton.addEventListener('click', async () => {
      const name = document.querySelector('#single').value.trim();
      if (!name) return;
      checkButton.disabled = true;
      results.innerHTML = '<div class="card empty">Checking ' + esc(name) + '...</div>';
      try {
        const params = new URLSearchParams({
          name,
          brief: document.querySelector('#brief').value,
          industry: document.querySelector('#industry').value,
          audience: document.querySelector('#audience').value,
          keywords: document.querySelector('#keywords').value,
          aiKeywords: document.querySelector('#aiKeywords').value,
          avoid: document.querySelector('#avoid').value
        });
        const response = await fetch('/api/check?' + params.toString());
        if (!response.ok) throw new Error(await response.text());
        render([await response.json()]);
      } catch (error) {
        results.innerHTML = '<div class="card empty">' + esc(error.message) + '</div>';
      } finally {
        checkButton.disabled = false;
      }
    });
  </script>
</body>
</html>`;

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/") return html();
    if (request.method === "GET" && url.pathname === "/api/check") return handleCheck(request, env);
    if (request.method === "POST" && url.pathname === "/api/suggest") return handleSuggest(request, env);
    return json({ error: "Not found" }, { status: 404 });
  }
};
