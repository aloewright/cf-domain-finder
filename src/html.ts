export const INDEX_HTML = `<!doctype html>
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
    .muted { color: var(--muted); }

    .app-container { max-width: 1320px; margin: 0 auto; padding: 40px 24px 80px; min-height: 100vh; display: flex; flex-direction: column; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 48px; gap: 16px; }
    .logo-group h1 {
      margin: 0; font-size: 30px; font-weight: 900; letter-spacing: -0.02em;
      background: linear-gradient(to right, #fff, var(--muted));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    #header-actions { display: flex; align-items: center; gap: 12px; }
    .saved-btn {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 9px 16px; border-radius: var(--r-pill);
      border: 1px solid var(--line); background: rgba(255,255,255,0.04);
      color: var(--text); font-weight: 800; font-size: 14px; cursor: pointer;
    }
    .saved-btn:hover { background: rgba(255,255,255,0.08); }
    .saved-btn i { width: 16px; height: 16px; }
    .saved-btn span { background: var(--accent-soft); color: var(--accent); border-radius: var(--r-pill); padding: 1px 8px; font-size: 12px; }
    .user-pill { color: var(--muted); font-weight: 700; font-size: 14px; }
    .ghost-btn { background: none; border: none; color: var(--muted); font-weight: 700; font-size: 14px; cursor: pointer; padding: 9px 8px; }
    .ghost-btn:hover { color: var(--text); }

    .wizard-step { display: none; max-width: 760px; margin: 0 auto; width: 100%; animation: fadeIn 0.4s ease-out; }
    .wizard-step.active { display: block; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .progress-bar { display: flex; gap: 8px; margin-bottom: 40px; justify-content: center; }
    .progress-dot { width: 40px; height: 5px; background: var(--line); border-radius: var(--r-pill); transition: all 0.3s ease; }
    .progress-dot.active { background: var(--accent); }
    .step-title { font-size: 46px; font-weight: 900; letter-spacing: -0.03em; margin-bottom: 12px; text-align: center; }
    .step-subtitle { color: var(--muted); font-size: 18px; text-align: center; margin-bottom: 44px; }

    .input-card { background: var(--panel); backdrop-filter: blur(14px); border: 1px solid var(--glass-border); border-radius: var(--r-lg); padding: 32px; box-shadow: var(--glass-shadow); }
    .form-group { margin-bottom: 24px; }
    label { display: block; color: var(--muted); font-size: 14px; font-weight: 700; margin-bottom: 12px; }
    textarea, input[type=text], input[type=email], input[type=password] {
      width: 100%; background: rgba(0, 0, 0, 0.22); border: 1px solid var(--line); border-radius: var(--r-md);
      padding: 16px; color: var(--text); font-size: 16px; font-weight: 500; transition: border-color 0.2s ease;
    }
    textarea { min-height: 120px; resize: vertical; line-height: 1.5; }
    textarea:focus, input:focus { outline: none; border-color: rgba(139, 232, 238, 0.5); }
    textarea::placeholder, input::placeholder { color: rgba(244, 241, 236, 0.32); }

    .chip-container { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; align-items: center; }
    .chip { background: rgba(255, 255, 255, 0.05); border: 1px solid var(--line); border-radius: var(--r-pill); padding: 8px 16px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s ease; }
    .chip:hover { background: rgba(255, 255, 255, 0.1); }
    .chip.ai { background: var(--accent-soft); border-color: rgba(139,232,238,0.4); color: var(--accent); }
    .suggest-label { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); margin-right: 4px; display: inline-flex; align-items: center; gap: 5px; }
    .suggest-label i { width: 13px; height: 13px; }

    .nav-actions { display: flex; justify-content: space-between; margin-top: 36px; align-items: center; }
    button.primary, button.secondary { padding: 13px 28px; border-radius: var(--r-pill); font-weight: 800; font-size: 16px; cursor: pointer; transition: transform 0.18s ease, background 0.18s ease; display: inline-flex; align-items: center; gap: 8px; border: none; }
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

    .dashboard { display: none; grid-template-columns: 280px 1fr; gap: 32px; align-items: start; animation: fadeIn 0.4s ease-out; }
    .dashboard.active { display: grid; }
    .sidebar { position: sticky; top: 32px; height: fit-content; }
    .results-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 20px; }

    .filter-card { background: var(--panel); border: 1px solid var(--glass-border); border-radius: var(--r-lg); padding: 24px; box-shadow: var(--glass-shadow); }
    .filter-card h3 { margin: 0 0 4px; font-size: 18px; font-weight: 800; }
    .filter-block { margin-top: 24px; }
    .filter-block > .filter-label { display: block; color: var(--muted); font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 14px; }

    input[type=range] { -webkit-appearance: none; appearance: none; width: 100%; height: 10px; background: rgba(255,255,255,0.08); border-radius: var(--r-pill); outline: none; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 22px; height: 22px; border-radius: var(--r-pill); background: var(--accent); cursor: pointer; border: 3px solid #0d0e10; box-shadow: 0 0 0 1px var(--accent); }
    input[type=range]::-moz-range-thumb { width: 22px; height: 22px; border-radius: var(--r-pill); background: var(--accent); cursor: pointer; border: 3px solid #0d0e10; }
    .range-labels { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: var(--muted); margin-top: 10px; }

    .tld-grid { display: flex; flex-wrap: wrap; gap: 8px; max-height: 168px; overflow-y: auto; }
    .tld-toggle { display: inline-flex; align-items: center; gap: 6px; padding: 7px 13px; border-radius: var(--r-pill); border: 1px solid var(--line); background: rgba(255,255,255,0.04); font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.18s ease; user-select: none; }
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

    .result-card { background: var(--panel); backdrop-filter: blur(14px); border: 1px solid var(--glass-border); border-radius: var(--r-lg); padding: 24px; transition: transform 0.25s cubic-bezier(0.4,0,0.2,1), background 0.25s ease; display: flex; flex-direction: column; gap: 16px; }
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
    .dom-row { display: flex; align-items: center; gap: 9px; padding: 10px 12px; border-radius: var(--r-md); background: rgba(0,0,0,0.2); font-size: 14px; }
    .dom-name { font-weight: 700; }
    .dom-spacer { flex: 1; }
    .dom-status { color: var(--muted); font-weight: 700; }
    .dom-row.dom-taken .dom-name { color: var(--muted); }
    .dom-row.dom-taken .dom-status { color: var(--bad); }
    .dom-row.dom-avail { background: rgba(142, 240, 180, 0.08); }
    .dom-price { color: var(--good); font-weight: 800; }
    .dom-buy { display: inline-flex; align-items: center; gap: 4px; background: var(--good); color: #07210f; padding: 6px 12px; border-radius: var(--r-pill); font-size: 12px; font-weight: 900; text-decoration: none; transition: transform 0.15s ease; }
    .dom-buy:hover { transform: translateY(-1px); }
    .dom-buy i { width: 13px; height: 13px; }
    .bm { background: none; border: none; cursor: pointer; color: var(--muted); padding: 2px; display: inline-flex; align-items: center; transition: color 0.15s ease, transform 0.15s ease; flex: 0 0 auto; }
    .bm:hover { color: var(--text); transform: scale(1.1); }
    .bm i { width: 17px; height: 17px; }
    .bm.on { color: var(--accent); }
    .bm.on i { fill: var(--accent); }

    .card-foot { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); border-top: 1px solid var(--line); padding-top: 14px; margin-top: 2px; }
    .card-foot i { width: 15px; height: 15px; }
    .card-foot b { color: var(--text); font-weight: 800; }

    .scroll-status { text-align: center; color: var(--muted); padding: 32px 0 8px; font-weight: 600; grid-column: 1 / -1; }
    .spinner { width: 22px; height: 22px; border: 3px solid var(--line); border-top-color: var(--accent); border-radius: var(--r-pill); display: inline-block; animation: spin 0.8s linear infinite; vertical-align: middle; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Overlays: auth + saved */
    .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.78); backdrop-filter: blur(8px); z-index: 1000; display: none; place-items: center; padding: 24px; }
    .overlay.active { display: grid; }
    .auth-card { background: var(--bg); border: 1px solid var(--glass-border); border-radius: var(--r-lg); width: 100%; max-width: 420px; padding: 36px; box-shadow: var(--glass-shadow); }
    .auth-card h2 { margin: 0 0 6px; font-size: 28px; font-weight: 900; letter-spacing: -0.02em; }
    .auth-sub { color: var(--muted); margin: 0 0 24px; }
    .auth-error { color: var(--bad); font-weight: 700; font-size: 14px; margin-bottom: 16px; min-height: 0; }
    .auth-error:empty { display: none; }
    .auth-toggle { text-align: center; color: var(--muted); margin: 20px 0 0; font-size: 14px; }
    .auth-toggle a { color: var(--accent); font-weight: 800; text-decoration: none; margin-left: 6px; }
    .saved-card { background: var(--bg); border: 1px solid var(--glass-border); border-radius: var(--r-lg); width: 100%; max-width: 560px; max-height: 80vh; overflow-y: auto; padding: 32px; box-shadow: var(--glass-shadow); }
    .saved-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .saved-head h2 { margin: 0; font-size: 24px; font-weight: 900; }
    .close-x { cursor: pointer; color: var(--muted); }
    .close-x:hover { color: var(--text); }
    .saved-row { display: flex; align-items: center; gap: 12px; padding: 14px 0; border-bottom: 1px solid var(--line); }
    .saved-row:last-child { border-bottom: none; }
    .saved-name { font-weight: 800; }
    .saved-meta { font-size: 12px; color: var(--muted); }

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
      <div class="logo-group"><h1>Nomenclature</h1></div>
      <div id="header-actions"></div>
    </header>

    <!-- Step 1 -->
    <div id="step-1" class="wizard-step active">
      <div class="progress-bar"><div class="progress-dot active"></div><div class="progress-dot"></div><div class="progress-dot"></div><div class="progress-dot"></div></div>
      <h2 class="step-title">Start with your vision.</h2>
      <p class="step-subtitle">Describe what you're building in a few sentences.</p>
      <div class="input-card">
        <div class="form-group">
          <label for="brief">Positioning Brief</label>
          <textarea id="brief" placeholder="Private AI operator for chat, memory, files, MCP connections, and local-first workflows. Naming direction: ports, routing, harbors, trusted connections, glass UI..."></textarea>
        </div>
        <div class="nav-actions"><div></div><button class="primary" onclick="nextStep(2)">Continue <i data-lucide="arrow-right"></i></button></div>
      </div>
    </div>

    <!-- Step 2 -->
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
          <input type="text" id="seeds" placeholder="port, harbor, dock, quay, channel, relay, link, connect, flow" oninput="onSeedInput()" />
          <div class="chip-container" id="seed-suggest"></div>
        </div>
        <div class="nav-actions"><button class="secondary" onclick="nextStep(1)">Back</button><button class="primary" onclick="nextStep(3)">Continue <i data-lucide="arrow-right"></i></button></div>
      </div>
    </div>

    <!-- Step 3 -->
    <div id="step-3" class="wizard-step">
      <div class="progress-bar"><div class="progress-dot active"></div><div class="progress-dot active"></div><div class="progress-dot active"></div><div class="progress-dot"></div></div>
      <h2 class="step-title">What should be avoided?</h2>
      <p class="step-subtitle">Concepts or themes that should be absolutely avoided.</p>
      <div class="input-card">
        <div class="form-group">
          <label for="avoid">Negative Constraints</label>
          <textarea id="avoid" placeholder="crypto, dating, bird, plane, logistics..."></textarea>
        </div>
        <div class="nav-actions"><button class="secondary" onclick="nextStep(2)">Back</button><button class="primary" onclick="nextStep(4)">Next Step <i data-lucide="arrow-right"></i></button></div>
      </div>
    </div>

    <!-- Step 4 -->
    <div id="step-4" class="wizard-step">
      <div class="progress-bar"><div class="progress-dot active"></div><div class="progress-dot active"></div><div class="progress-dot active"></div><div class="progress-dot active"></div></div>
      <h2 class="step-title">Review configuration</h2>
      <p class="step-subtitle">A quick look before generation.</p>
      <div class="input-card">
        <div class="review-item"><div class="review-content"><h4>Positioning Brief</h4><p id="review-brief"></p></div><button class="secondary" style="padding: 7px 14px; font-size: 13px;" onclick="nextStep(1)"><i data-lucide="edit-2"></i> Edit</button></div>
        <div class="review-item"><div class="review-content"><h4>Keywords / Industry</h4><p id="review-industry"></p></div><button class="secondary" style="padding: 7px 14px; font-size: 13px;" onclick="nextStep(2)"><i data-lucide="edit-2"></i> Edit</button></div>
        <div class="review-item"><div class="review-content"><h4>Negative Constraints</h4><p id="review-avoid"></p></div><button class="secondary" style="padding: 7px 14px; font-size: 13px;" onclick="nextStep(3)"><i data-lucide="edit-2"></i> Edit</button></div>
        <div class="nav-actions"><button class="secondary" onclick="nextStep(3)">Previous</button><button class="primary" id="generate-btn" onclick="generateNames()">Generate Names <i data-lucide="sparkles"></i></button></div>
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
              <span class="switch on" id="hide-taken-switch"></span>
            </div>
          </div>
          <div class="filter-block"><button class="primary" style="width: 100%; justify-content: center;" onclick="generateNames()">Regenerate</button></div>
        </div>
      </aside>
      <main>
        <div class="results-head"><h2>Results</h2><p id="results-sub">Available names for your brief — scroll for more.</p></div>
        <div id="results-grid" class="results-grid"></div>
        <div id="scroll-status" class="scroll-status"></div>
        <div id="scroll-sentinel" style="height: 1px;"></div>
      </main>
    </div>
  </div>

  <!-- Auth overlay -->
  <div id="auth-overlay" class="overlay">
    <div class="auth-card">
      <h2 id="auth-title">Create your account</h2>
      <p class="auth-sub" id="auth-sub">Sign up to generate names and save the ones you like.</p>
      <div class="auth-error" id="auth-error"></div>
      <div class="form-group" id="auth-name-group">
        <label for="auth-name">Name</label>
        <input type="text" id="auth-name" placeholder="Ada Lovelace" />
      </div>
      <div class="form-group">
        <label for="auth-email">Email</label>
        <input type="email" id="auth-email" placeholder="you@example.com" autocomplete="email" />
      </div>
      <div class="form-group">
        <label for="auth-password">Password</label>
        <input type="password" id="auth-password" placeholder="At least 8 characters" />
      </div>
      <button class="primary" id="auth-submit" style="width: 100%; justify-content: center;" onclick="submitAuth()">Sign up</button>
      <p class="auth-toggle"><span id="auth-toggle-text">Already have an account?</span><a href="#" id="auth-toggle-link" onclick="toggleAuthMode(event)">Log in</a></p>
    </div>
  </div>

  <!-- Saved overlay -->
  <div id="saved-overlay" class="overlay">
    <div class="saved-card">
      <div class="saved-head"><h2>Saved domains</h2><div class="close-x" onclick="hideSaved()"><i data-lucide="x"></i></div></div>
      <div id="saved-list"></div>
    </div>
  </div>

  <script>
    var PURCHASE_URL = 'https://dash.cloudflare.com/?to=/:account/domains/registrations';
    var TLDS = ['com','ai','io','dev','app','co','net','org','xyz','me','tech','store','online','site','pro','info','biz','design','studio','cloud','sh','gg','live','link'];
    var selectedTlds = { com: true };
    var allResults = [];
    var state = { offset: 0, count: 12, hasMore: true, loading: false, active: false, params: null, maxLen: 99 };
    var currentUser = null;
    var bookmarkedDomains = new Set();
    var savedItems = [];
    var authMode = 'signup';
    var pendingAfterAuth = null;

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[c]; }); }

    // ---------- auth ----------
    async function checkMe() {
      try {
        var res = await fetch('/api/me');
        if (res.ok) { var d = await res.json(); currentUser = d.user; await loadBookmarks(); }
        else currentUser = null;
      } catch (e) { currentUser = null; }
      renderHeader();
    }
    function renderHeader() {
      var el = document.getElementById('header-actions');
      if (currentUser) {
        el.innerHTML = '<button class="saved-btn" onclick="showSaved()"><i data-lucide="bookmark"></i> Saved <span id="saved-count">0</span></button>' +
          '<span class="user-pill">' + esc(currentUser.name) + '</span>' +
          '<button class="ghost-btn" onclick="logout()">Log out</button>';
        updateSavedCount();
      } else { el.innerHTML = ''; }
      lucide.createIcons();
    }
    function showAuth(after) {
      pendingAfterAuth = after || null;
      authMode = 'signup';
      applyAuthMode();
      document.getElementById('auth-error').textContent = '';
      document.getElementById('auth-name').value = '';
      document.getElementById('auth-email').value = '';
      document.getElementById('auth-password').value = '';
      document.getElementById('auth-overlay').classList.add('active');
    }
    function hideAuth() { document.getElementById('auth-overlay').classList.remove('active'); }
    function applyAuthMode() {
      var signup = authMode === 'signup';
      document.getElementById('auth-title').textContent = signup ? 'Create your account' : 'Welcome back';
      document.getElementById('auth-sub').textContent = signup ? 'Sign up to generate names and save the ones you like.' : 'Log in to continue.';
      document.getElementById('auth-name-group').style.display = signup ? 'block' : 'none';
      document.getElementById('auth-submit').textContent = signup ? 'Sign up' : 'Log in';
      document.getElementById('auth-toggle-text').textContent = signup ? 'Already have an account?' : 'New here?';
      document.getElementById('auth-toggle-link').textContent = signup ? 'Log in' : 'Create one';
    }
    function toggleAuthMode(e) {
      if (e) e.preventDefault();
      authMode = authMode === 'signup' ? 'login' : 'signup';
      document.getElementById('auth-error').textContent = '';
      applyAuthMode();
    }
    async function submitAuth() {
      var err = document.getElementById('auth-error');
      err.textContent = '';
      var email = document.getElementById('auth-email').value.trim();
      var password = document.getElementById('auth-password').value;
      var name = document.getElementById('auth-name').value.trim();
      var btn = document.getElementById('auth-submit');
      var body = authMode === 'signup' ? { name: name, email: email, password: password } : { email: email, password: password };
      btn.disabled = true;
      try {
        var res = await fetch(authMode === 'signup' ? '/api/signup' : '/api/login', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
        });
        var data = await res.json();
        if (!res.ok) { err.textContent = data.error || 'Something went wrong.'; btn.disabled = false; return; }
        currentUser = data.user;
        await loadBookmarks();
        renderHeader();
        hideAuth();
        btn.disabled = false;
        var cb = pendingAfterAuth; pendingAfterAuth = null;
        if (cb) cb();
      } catch (e) { err.textContent = 'Network error. Try again.'; btn.disabled = false; }
    }
    async function logout() {
      try { await fetch('/api/logout', { method: 'POST' }); } catch (e) {}
      currentUser = null; bookmarkedDomains = new Set(); savedItems = [];
      renderHeader();
      document.getElementById('dashboard').classList.remove('active');
      state.active = false;
      nextStep(1);
    }

    // ---------- bookmarks ----------
    async function loadBookmarks() {
      try {
        var res = await fetch('/api/bookmarks');
        if (!res.ok) return;
        var data = await res.json();
        savedItems = data.bookmarks || [];
        bookmarkedDomains = new Set(savedItems.map(function(b){ return b.domain; }));
        updateSavedCount();
      } catch (e) {}
    }
    function updateSavedCount() { var el = document.getElementById('saved-count'); if (el) el.textContent = bookmarkedDomains.size; }
    async function toggleBookmark(btn) {
      var d = btn.dataset;
      var on = bookmarkedDomains.has(d.domain);
      try {
        if (on) {
          await fetch('/api/bookmarks', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ domain: d.domain }) });
          bookmarkedDomains.delete(d.domain);
          savedItems = savedItems.filter(function(x){ return x.domain !== d.domain; });
        } else {
          await fetch('/api/bookmarks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: d.name, domain: d.domain, price: d.price, currency: d.currency }) });
          bookmarkedDomains.add(d.domain);
          savedItems.unshift({ name: d.name, domain: d.domain, price: d.price, currency: d.currency });
        }
        btn.classList.toggle('on');
        updateSavedCount();
      } catch (e) {}
    }
    function showSaved() { renderSaved(); document.getElementById('saved-overlay').classList.add('active'); }
    function hideSaved() { document.getElementById('saved-overlay').classList.remove('active'); }
    function renderSaved() {
      var list = document.getElementById('saved-list');
      if (!savedItems.length) { list.innerHTML = '<p class="muted">No saved domains yet. Tap the bookmark on any available domain to save it.</p>'; return; }
      list.innerHTML = savedItems.map(function(b){
        var price = b.price ? '$' + esc(b.price) + '/yr' : '';
        return '<div class="saved-row"><div><div class="saved-name">' + esc(b.domain) + '</div><div class="saved-meta">' + esc(b.name) + '</div></div>' +
          '<span class="dom-spacer"></span>' +
          (price ? '<span class="dom-price">' + price + '</span>' : '') +
          '<a class="dom-buy" href="' + PURCHASE_URL + '" target="_blank" rel="noreferrer">Buy <i data-lucide="arrow-up-right"></i></a>' +
          '<button class="bm on" data-domain="' + esc(b.domain) + '" data-name="' + esc(b.name) + '" data-price="' + esc(b.price || '') + '" data-currency="' + esc(b.currency || '') + '" onclick="removeSaved(this)"><i data-lucide="trash-2"></i></button>' +
          '</div>';
      }).join('');
      lucide.createIcons();
    }
    function removeSaved(btn) { toggleBookmark(btn).then(function(){ renderSaved(); reRender(); }); }

    // ---------- seed suggestions ----------
    var seedTimer = null, seedAbort = null;
    function onSeedInput() { clearTimeout(seedTimer); seedTimer = setTimeout(fetchAssociations, 400); }
    async function fetchAssociations() {
      var seeds = document.getElementById('seeds').value.trim();
      var box = document.getElementById('seed-suggest');
      if (seeds.length < 2) { box.innerHTML = ''; return; }
      if (seedAbort) seedAbort.abort();
      seedAbort = new AbortController();
      try {
        var res = await fetch('/api/associate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seeds: seeds }), signal: seedAbort.signal });
        var data = await res.json();
        var words = data.words || [];
        box.innerHTML = words.length
          ? ('<span class="suggest-label"><i data-lucide="sparkles"></i> Suggested</span>' + words.map(function(w){ return '<span class="chip ai" onclick="addChip(\\'seeds\\', \\'' + w + '\\')">' + w + '</span>'; }).join(''))
          : '';
        lucide.createIcons();
      } catch (e) { /* aborted or error */ }
    }

    // ---------- wizard ----------
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
      if (!val.split(/[,\\s]+/).includes(text)) input.value = val ? val + ', ' + text : text;
    }

    // ---------- tld + filters ----------
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
    function getSelectedTlds() { var out = TLDS.filter(function(t){ return selectedTlds[t]; }); return out.length ? out : ['com']; }
    function toggleHideTaken() { document.getElementById('hide-taken-switch').classList.toggle('on'); reRender(); }
    function hideTakenOn() { return document.getElementById('hide-taken-switch').classList.contains('on'); }
    function onLengthChange() { var v = parseInt(document.getElementById('length-range').value, 10); state.maxLen = v === 1 ? 8 : v === 2 ? 12 : 99; reRender(); }

    // ---------- results rendering ----------
    function renderProgressCircle(score, size) {
      size = size || 50;
      var radius = (size / 2) - 4;
      var circ = 2 * Math.PI * radius;
      var offset = circ - (score / 100) * circ;
      return '<svg width="' + size + '" height="' + size + '"><circle class="progress-bg" cx="' + (size/2) + '" cy="' + (size/2) + '" r="' + radius + '"></circle>' +
        '<circle class="progress-value" cx="' + (size/2) + '" cy="' + (size/2) + '" r="' + radius + '" stroke-dasharray="' + circ + '" stroke-dashoffset="' + offset + '"></circle></svg>' +
        '<span class="score-text">' + score + '</span>';
    }
    function domainRow(name, d) {
      var label = esc(d.domain);
      if (d.available === true) {
        var price = d.registrationCost ? '$' + esc(d.registrationCost) + (d.currency && d.currency !== 'USD' ? ' ' + esc(d.currency) : '') + '/yr' : 'Available';
        var on = bookmarkedDomains.has(d.domain) ? ' on' : '';
        return '<div class="dom-row dom-avail">' +
          '<button class="bm' + on + '" data-name="' + esc(name) + '" data-domain="' + label + '" data-price="' + esc(d.registrationCost || '') + '" data-currency="' + esc(d.currency || '') + '" onclick="toggleBookmark(this)"><i data-lucide="bookmark"></i></button>' +
          '<span class="dom-name">' + label + '</span><span class="dom-spacer"></span>' +
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
      return '<div class="result-card"><div class="card-header"><div><h3 class="card-title">' + esc(item.name) + '</h3></div>' +
        '<div class="circular-progress">' + renderProgressCircle(item.score) + '</div></div>' +
        '<div class="card-meta">' + esc(item.displayName) + '</div>' +
        '<div class="domain-list">' + (item.domains || []).map(function(d){ return domainRow(item.name, d); }).join('') + '</div>' +
        '<div class="card-foot"><i data-lucide="smartphone"></i> App Store: <b>' + (item.appStoreCount || 0) + '</b> results</div></div>';
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
      return { brief: document.getElementById('brief').value, industry: document.getElementById('industry').value, avoid: document.getElementById('avoid').value, seeds: document.getElementById('seeds').value, tlds: getSelectedTlds() };
    }

    async function generateNames() {
      if (!currentUser) { showAuth(function(){ generateNames(); }); return; }
      var btn = document.getElementById('generate-btn');
      if (btn) { btn.disabled = true; btn.innerHTML = 'Generating... <i data-lucide="loader-2"></i>'; lucide.createIcons(); }
      document.querySelectorAll('.wizard-step').forEach(function(s){ s.classList.remove('active'); });
      document.getElementById('dashboard').classList.add('active');
      allResults = [];
      document.getElementById('results-grid').innerHTML = '';
      state.offset = 0; state.hasMore = true; state.loading = false; state.active = true; state.params = getParams();
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
        var res = await fetch('/api/suggest', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ brief: p.brief, industry: p.industry, avoid: p.avoid, seeds: p.seeds, tlds: p.tlds, count: state.count, offset: state.offset }) });
        if (res.status === 401) { state.active = false; status.textContent = ''; showAuth(function(){ generateNames(); }); return; }
        var data = await res.json();
        var fresh = data.results || [];
        allResults = allResults.concat(fresh);
        var grid = document.getElementById('results-grid');
        grid.insertAdjacentHTML('beforeend', fresh.filter(isVisible).map(cardHtml).join(''));
        lucide.createIcons();
        state.offset = data.nextOffset;
        state.hasMore = !!data.hasMore;
        status.textContent = state.hasMore ? '' : 'That\\'s every candidate for this brief.';
      } catch (e) {
        status.textContent = 'Could not load more names.';
      } finally {
        state.loading = false;
        if (state.active && state.hasMore && isSentinelVisible()) setTimeout(loadMore, 60);
      }
    }
    function isSentinelVisible() { var s = document.getElementById('scroll-sentinel'); if (!s) return false; var r = s.getBoundingClientRect(); return r.top < (window.innerHeight + 600); }

    var observer = new IntersectionObserver(function(entries){ if (entries[0].isIntersecting) loadMore(); }, { rootMargin: '600px' });
    observer.observe(document.getElementById('scroll-sentinel'));

    renderTldGrid();
    checkMe();
    lucide.createIcons();
  </script>
</body>
</html>`;
