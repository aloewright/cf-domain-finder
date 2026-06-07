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
    .ghost-btn { background: none; border: none; color: var(--muted); font-weight: 700; font-size: 14px; cursor: pointer; padding: 9px 8px; display: inline-flex; align-items: center; }
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
    .bm i, .bm svg { width: 17px; height: 17px; }
    .bm.on { color: var(--accent); }
    .bm.on i, .bm.on svg { fill: var(--accent); }

    .card-foot { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); border-top: 1px solid var(--line); padding-top: 14px; margin-top: 2px; }
    .card-foot i { width: 15px; height: 15px; }
    .card-foot b { color: var(--text); font-weight: 800; }

    .scroll-status { text-align: center; color: var(--muted); padding: 32px 0 8px; font-weight: 600; grid-column: 1 / -1; }
    .spinner { width: 22px; height: 22px; border: 3px solid var(--line); border-top-color: var(--accent); border-radius: var(--r-pill); display: inline-block; animation: spin 0.8s linear infinite; vertical-align: middle; }
    .spinner-sm { width: 13px; height: 13px; border: 2px solid var(--line); border-top-color: var(--accent); border-radius: 50%; display: inline-block; animation: spin 0.8s linear infinite; vertical-align: middle; }
    .hack-grid-toggles { display: flex; flex-wrap: wrap; gap: 8px; }
    .hack-toggle { display: inline-flex; align-items: center; gap: 6px; padding: 7px 13px; border-radius: var(--r-pill); border: 1px solid var(--line); background: rgba(255,255,255,0.04); font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.18s ease; user-select: none; }
    .hack-toggle:hover { background: rgba(255,255,255,0.08); }
    .hack-toggle.on { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
    .hacks-head { margin: 4px 0 16px; }
    .hacks-head h3 { margin: 0; font-size: 20px; font-weight: 900; letter-spacing: -0.01em; }
    .hacks-head p { margin: 4px 0 0; color: var(--muted); font-size: 14px; }
    #hacks-grid { margin-bottom: 28px; }
    .result-card.hack-card { border-color: rgba(139,232,238,0.3); }
    .hack-badge { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--accent); background: var(--accent-soft); padding: 3px 9px; border-radius: var(--r-pill); align-self: flex-start; white-space: nowrap; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .site-footer { margin-top: auto; padding-top: 56px; text-align: center; color: var(--muted); font-size: 13px; font-weight: 600; }
    .site-footer a { color: var(--muted); text-decoration: none; }
    .site-footer a:hover { color: var(--accent); }

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

    /* Domain agent chat widget */
    #chat-widget { position: fixed; bottom: 24px; right: 24px; z-index: 900; display: flex; flex-direction: column; align-items: flex-end; gap: 14px; }
    #chat-toggle { width: 52px; height: 52px; border-radius: var(--r-pill); background: var(--accent); border: none; cursor: pointer; color: #0d0e10; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(139,232,238,0.32), 0 0 0 4px rgba(139,232,238,0.08); transition: transform 0.2s ease, box-shadow 0.2s ease; }
    #chat-toggle:hover { transform: scale(1.1); box-shadow: 0 6px 28px rgba(139,232,238,0.48), 0 0 0 6px rgba(139,232,238,0.12); }
    #chat-toggle i, #chat-toggle svg { width: 22px; height: 22px; }
    #chat-panel { width: 360px; background: var(--bg); border: 1px solid var(--glass-border); border-radius: var(--r-lg); display: none; flex-direction: column; max-height: 480px; box-shadow: 0 20px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(139,232,238,0.05); overflow: hidden; }
    #chat-panel.open { display: flex; }
    #chat-head { padding: 13px 16px; border-bottom: 1px solid var(--line); background: rgba(31,32,35,0.95); display: flex; align-items: center; justify-content: space-between; flex: 0 0 auto; }
    .ch-meta { display: flex; align-items: center; gap: 9px; }
    .ch-dot { width: 8px; height: 8px; border-radius: var(--r-pill); background: var(--good); box-shadow: 0 0 6px var(--good); flex: 0 0 auto; }
    .ch-title { font-weight: 800; font-size: 14px; }
    .ch-sub { font-size: 11px; color: var(--muted); margin-top: 1px; }
    .ch-close { background: none; border: none; cursor: pointer; color: var(--muted); padding: 4px; display: inline-flex; border-radius: 6px; }
    .ch-close:hover { color: var(--text); }
    .ch-close i, .ch-close svg { width: 15px; height: 15px; }
    #chat-msgs { flex: 1; overflow-y: auto; padding: 14px 14px 6px; display: flex; flex-direction: column; gap: 10px; }
    .chat-b { max-width: 90%; font-size: 14px; line-height: 1.55; padding: 9px 13px; border-radius: 16px; word-break: break-word; }
    .chat-b.user { align-self: flex-end; background: var(--accent-soft); border: 1px solid rgba(139,232,238,0.22); border-bottom-right-radius: 4px; }
    .chat-b.assistant { align-self: flex-start; background: rgba(31,32,35,0.95); border: 1px solid var(--line); border-bottom-left-radius: 4px; }
    .chat-b.typing { color: var(--muted); font-style: italic; align-self: flex-start; background: rgba(31,32,35,0.6); border: 1px solid var(--line); border-bottom-left-radius: 4px; }
    .chat-b.assistant strong { font-weight: 700; color: var(--text); }
    .chat-b.assistant em { font-style: italic; }
    .chat-b.assistant code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; background: var(--accent-soft); padding: 1px 5px; border-radius: 5px; }
    .chat-b.assistant a { color: var(--accent); text-decoration: underline; }
    .chat-b.assistant table.chat-table { border-collapse: collapse; width: 100%; margin: 7px 0; font-size: 12px; }
    .chat-b.assistant table.chat-table th, .chat-b.assistant table.chat-table td { border: 1px solid var(--line); padding: 4px 8px; text-align: left; vertical-align: top; }
    .chat-b.assistant table.chat-table th { background: var(--accent-soft); font-weight: 700; color: var(--text); }
    .chat-b.assistant table.chat-table tr:nth-child(even) td { background: rgba(255,255,255,0.03); }
    .chat-typing { display: inline-flex; gap: 5px; align-items: center; height: 8px; }
    .chat-typing span { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); opacity: 0.4; animation: chatDot 1.2s infinite ease-in-out; }
    .chat-typing span:nth-child(2) { animation-delay: 0.18s; }
    .chat-typing span:nth-child(3) { animation-delay: 0.36s; }
    @keyframes chatDot { 0%, 70%, 100% { transform: translateY(0); opacity: 0.3; } 35% { transform: translateY(-5px); opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .chat-typing span { animation: none; opacity: 0.6; } }
    #chat-foot { padding: 10px 12px; border-top: 1px solid var(--line); background: rgba(13,14,16,0.7); display: flex; gap: 8px; align-items: center; flex: 0 0 auto; }
    #chat-input { flex: 1; background: rgba(255,255,255,0.05); border: 1px solid var(--line); border-radius: var(--r-pill); padding: 9px 15px; color: var(--text); font-size: 14px; font-weight: 500; min-width: 0; }
    #chat-input:focus { outline: none; border-color: rgba(139,232,238,0.4); }
    #chat-input::placeholder { color: rgba(244,241,236,0.28); }
    #chat-send { width: 36px; height: 36px; border-radius: var(--r-pill); background: var(--accent); border: none; cursor: pointer; color: #0d0e10; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; transition: transform 0.15s ease; }
    #chat-send:hover { transform: scale(1.1); }
    #chat-send:disabled { opacity: 0.5; cursor: default; transform: none; }
    #chat-send i, #chat-send svg { width: 16px; height: 16px; }
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
          <div class="filter-block">
            <span class="filter-label">Domain hacks</span>
            <div class="hack-grid-toggles">
              <span class="hack-toggle" id="hack-prefix" onclick="toggleHack('prefix')">Prefixes</span>
              <span class="hack-toggle" id="hack-suffix" onclick="toggleHack('suffix')">Suffixes</span>
              <span class="hack-toggle" id="hack-plural" onclick="toggleHack('plural')">Pluralize</span>
              <span class="hack-toggle" id="hack-tldhack" onclick="toggleHack('tldhack')">TLD hacks</span>
            </div>
            <div class="switch-row" id="hide-premium-row" onclick="toggleHidePremium()" style="margin-top: 16px;">
              <span class="switch-label">Hide premium names</span>
              <span class="switch" id="hide-premium-switch"></span>
            </div>
          </div>
          <div class="filter-block"><button class="primary" style="width: 100%; justify-content: center;" onclick="generateNames()">Regenerate</button></div>
          <div class="filter-block"><button class="secondary" style="width: 100%; justify-content: center;" onclick="nextStep(1)">Start over <i data-lucide="rotate-ccw"></i></button></div>
        </div>
      </aside>
      <main>
        <div class="results-head"><h2>Results</h2><p id="results-sub">Available names for your brief — scroll for more.</p></div>
        <div id="hacks-section" style="display: none;">
          <div class="hacks-head"><h3>Domain hacks</h3><p>Variations of your names, checked live.</p></div>
          <div id="hacks-grid" class="results-grid"></div>
        </div>
        <div id="results-grid" class="results-grid"></div>
        <div id="scroll-status" class="scroll-status"></div>
        <div id="scroll-sentinel" style="height: 1px;"></div>
      </main>
    </div>
    <footer class="site-footer">&copy; 2026 <a href="https://pdx.software" target="_blank" rel="noreferrer">Harborline</a></footer>
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

  <!-- Domain Agent -->
  <div id="chat-widget">
    <div id="chat-panel">
      <div id="chat-head">
        <div class="ch-meta"><span class="ch-dot"></span><div><div class="ch-title">Domain Agent</div><div class="ch-sub">Cloudflare Registrar · live data</div></div></div>
        <button class="ch-close" onclick="toggleChat()"><i data-lucide="x"></i></button>
      </div>
      <div id="chat-msgs"></div>
      <div id="chat-foot">
        <input id="chat-input" type="text" placeholder="Is mynext.link available?" onkeydown="if(event.key==='Enter')sendChat()" />
        <button id="chat-send" onclick="sendChat()"><i data-lucide="send"></i></button>
      </div>
    </div>
    <button id="chat-toggle" onclick="toggleChat()"><i data-lucide="message-circle"></i></button>
  </div>

  <script>
    var PURCHASE_URL = 'https://dash.cloudflare.com/?to=/:account/domains/registrations';
    var TLDS = ['com','ai','io','dev','app','co','net','org','xyz','me','tech','store','online','site','pro','info','biz','design','studio','cloud','sh','gg','live','link'];
    var selectedTlds = { com: true };
    var allResults = [];
    var state = { count: 12, poolCount: 30, hasMore: true, loading: false, active: false, params: null, maxLen: 99 };
    var hacks = { prefix: false, suffix: false, plural: false, tldhack: false };
    var hackResults = [];
    var HACK_PREFIXES = ['get','try','go','my','the','new'];
    var HACK_SUFFIXES = ['ly','hq','app','labs','hub','io'];
    var namePool = [];
    var poolExhausted = false;
    var refilling = false;
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
          '<button class="ghost-btn" onclick="logout()" title="Log out" aria-label="Log out"><i data-lucide="log-out"></i></button>';
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
      box.innerHTML = '<span class="suggest-label"><span class="spinner" style="width:13px;height:13px;border-width:2px;"></span> Finding associations…</span>';
      try {
        var res = await fetch('/api/associate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ seeds: seeds }), signal: seedAbort.signal });
        var data = await res.json();
        var words = data.words || [];
        box.innerHTML = words.length
          ? ('<span class="suggest-label"><i data-lucide="sparkles"></i> Suggested</span>' + words.map(function(w){ return '<span class="chip ai" onclick="addChip(\\'seeds\\', \\'' + w + '\\')">' + w + '</span>'; }).join(''))
          : '';
        lucide.createIcons();
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        box.innerHTML = '';
      }
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
    function isPremium(d) { return !!(d && d.reason && /premium/i.test(d.reason)); }
    function hidePremiumOn() { var s = document.getElementById('hide-premium-switch'); return !!(s && s.classList.contains('on')); }
    // Domain rows for a card, with the hide-premium filter applied.
    function rowsFor(item) {
      var rows = item.domains || [];
      if (hidePremiumOn()) rows = rows.filter(function(d){ return !isPremium(d); });
      return rows;
    }
    function domainRow(name, d) {
      var label = esc(d.domain);
      if (d.pending && d.available === null) {
        return '<div class="dom-row"><span class="dom-name">' + label + '</span><span class="dom-spacer"></span><span class="dom-status"><span class="spinner-sm"></span></span></div>';
      }
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
      if (!item._hack && item.name.length > state.maxLen) return false;
      var rows = rowsFor(item);
      if (rows.length === 0) return false;
      // While variants are still being checked, keep the card so it can resolve.
      var anyPending = rows.some(function(d){ return d.pending; });
      if (hideTakenOn() && !anyPending && !rows.some(function(d){ return d.available === true; })) return false;
      return true;
    }
    function cardHtml(item) {
      var rows = rowsFor(item).map(function(d){ return domainRow(item.name, d); }).join('');
      if (item._hack) {
        return '<div class="result-card hack-card" data-hidx="' + item._idx + '">' +
          '<div class="card-header"><div><h3 class="card-title">' + esc(item.name) + '</h3></div>' +
          '<span class="hack-badge">' + esc(item.hack) + '</span></div>' +
          '<div class="domain-list">' + rows + '</div></div>';
      }
      return '<div class="result-card"><div class="card-header"><div><h3 class="card-title">' + esc(item.name) + '</h3></div>' +
        '<div class="circular-progress">' + renderProgressCircle(item.score) + '</div></div>' +
        '<div class="card-meta">' + esc(item.displayName) + '</div>' +
        '<div class="domain-list">' + rows + '</div>' +
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

    // ---------- domain hacks ----------
    function pluralizeName(n) { return /(s|x|z|ch|sh)$/.test(n) ? n + 'es' : n + 's'; }
    function toggleHack(type) {
      hacks[type] = !hacks[type];
      var chip = document.getElementById('hack-' + type);
      if (chip) chip.classList.toggle('on', hacks[type]);
      rebuildHacks();
    }
    function toggleHidePremium() {
      document.getElementById('hide-premium-switch').classList.toggle('on');
      reRender();
      renderHacks();
    }
    function resetHacks() {
      hacks = { prefix: false, suffix: false, plural: false, tldhack: false };
      hackResults = [];
      ['prefix','suffix','plural','tldhack'].forEach(function(t){ var c = document.getElementById('hack-' + t); if (c) c.classList.remove('on'); });
      var sec = document.getElementById('hacks-section'); if (sec) sec.style.display = 'none';
      var g = document.getElementById('hacks-grid'); if (g) g.innerHTML = '';
    }
    // Generate variant names from the current results and queue them for a live check.
    function rebuildHacks() {
      var anyOn = hacks.prefix || hacks.suffix || hacks.plural || hacks.tldhack;
      var sec = document.getElementById('hacks-section');
      if (!anyOn) { hackResults = []; if (sec) sec.style.display = 'none'; document.getElementById('hacks-grid').innerHTML = ''; return; }
      var tlds = getSelectedTlds();
      var seen = {};
      allResults.forEach(function(r){ seen[r.name.toLowerCase()] = 1; });
      var bases = allResults.slice(0, 10).map(function(r){ return r.name.toLowerCase().replace(/[^a-z0-9]/g, ''); }).filter(function(b){ return b.length >= 2; });
      var items = [];
      function addVariant(vname, label) {
        vname = String(vname).toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (vname.length < 2 || seen[vname]) return;
        seen[vname] = 1;
        items.push({ _hack: true, hack: label, name: vname, domains: tlds.map(function(t){ return { domain: vname + '.' + t, tld: t, available: null, pending: true }; }) });
      }
      bases.forEach(function(bn){
        if (hacks.prefix) HACK_PREFIXES.forEach(function(p){ addVariant(p + bn, 'prefix'); });
        if (hacks.suffix) HACK_SUFFIXES.forEach(function(s){ addVariant(bn + s, 'suffix'); });
        if (hacks.plural) addVariant(pluralizeName(bn), 'plural');
        if (hacks.tldhack) TLDS.forEach(function(t){
          if (bn.length > t.length + 1 && bn.slice(-t.length) === t) {
            var dom = bn.slice(0, bn.length - t.length) + '.' + t;
            if (!seen[dom]) { seen[dom] = 1; items.push({ _hack: true, hack: 'hack', name: dom, domains: [{ domain: dom, tld: t, available: null, pending: true }] }); }
          }
        });
      });
      hackResults = items.slice(0, 40);
      if (sec) sec.style.display = '';
      renderHacks();
    }
    function renderHacks() {
      var grid = document.getElementById('hacks-grid');
      if (!grid) return;
      var visible = [];
      hackResults.forEach(function(it, i){ it._idx = i; if (isVisible(it)) visible.push(it); });
      grid.innerHTML = visible.map(cardHtml).join('');
      lucide.createIcons();
      observeHackCards();
    }
    var hackQueue = [], hackTimer = null;
    var hackObserver = new IntersectionObserver(function(entries){
      var idxs = [];
      entries.forEach(function(e){ if (e.isIntersecting) { hackObserver.unobserve(e.target); var i = parseInt(e.target.getAttribute('data-hidx'), 10); if (!isNaN(i)) idxs.push(i); } });
      if (idxs.length) checkHackIdxs(idxs);
    }, { rootMargin: '300px' });
    function observeHackCards() {
      document.querySelectorAll('#hacks-grid .hack-card').forEach(function(el){
        var i = parseInt(el.getAttribute('data-hidx'), 10);
        var it = hackResults[i];
        if (it && it.domains.some(function(d){ return d.pending && !d.checking; })) hackObserver.observe(el);
      });
    }
    function checkHackIdxs(idxs) {
      idxs.forEach(function(idx){
        var it = hackResults[idx];
        if (!it) return;
        it.domains.forEach(function(d){ if (d.pending && !d.checking) { d.checking = true; hackQueue.push(d.domain); } });
      });
      clearTimeout(hackTimer);
      hackTimer = setTimeout(flushHackCheck, 140);
    }
    async function flushHackCheck() {
      var domains = hackQueue.splice(0, 80);
      if (!domains.length) return;
      try {
        var res = await fetch('/api/hacks/check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ domains: domains }) });
        if (res.status === 401) { showAuth(); return; }
        var data = await res.json();
        var byDom = {};
        (data.results || []).forEach(function(info){ byDom[info.domain] = info; });
        hackResults.forEach(function(it){ it.domains.forEach(function(d){
          var info = byDom[d.domain];
          if (info) { d.available = info.available; d.registrationCost = info.registrationCost; d.renewalCost = info.renewalCost; d.currency = info.currency; d.reason = info.reason; d.purchaseUrl = info.purchaseUrl || PURCHASE_URL; d.pending = false; d.checking = false; }
        }); });
      } catch (e) {
        var set = {}; domains.forEach(function(x){ set[x] = 1; });
        hackResults.forEach(function(it){ it.domains.forEach(function(d){ if (set[d.domain]) { d.pending = false; d.checking = false; } }); });
      }
      // Refresh every hack card in place from current state (robust if a batch was split).
      document.querySelectorAll('#hacks-grid .hack-card').forEach(function(card){
        var i = parseInt(card.getAttribute('data-hidx'), 10);
        var it = hackResults[i];
        if (!it) return;
        if (!isVisible(it)) { card.style.display = 'none'; return; }
        card.style.display = '';
        var list = card.querySelector('.domain-list');
        if (list) list.innerHTML = rowsFor(it).map(function(d){ return domainRow(it.name, d); }).join('');
      });
      lucide.createIcons();
      if (hackQueue.length) { clearTimeout(hackTimer); hackTimer = setTimeout(flushHackCheck, 140); }
    }

    function getParams() {
      return { brief: document.getElementById('brief').value, industry: document.getElementById('industry').value, avoid: document.getElementById('avoid').value, seeds: document.getElementById('seeds').value, tlds: getSelectedTlds() };
    }

    // One slow AI call fills a pool of names the client paginates through.
    async function refillPool() {
      if (refilling || poolExhausted) return;
      refilling = true;
      try {
        var p = state.params || getParams();
        var seen = {};
        allResults.forEach(function(r){ seen[r.name.toLowerCase()] = 1; });
        namePool.forEach(function(n){ seen[n.toLowerCase()] = 1; });
        var exclude = allResults.map(function(r){ return r.name; }).concat(namePool).slice(-150);
        var res = await fetch('/api/names', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ brief: p.brief, industry: p.industry, avoid: p.avoid, seeds: p.seeds, exclude: exclude, count: state.poolCount }) });
        if (res.status === 401) { state.active = false; poolExhausted = true; showAuth(function(){ generateNames(); }); return; }
        var data = await res.json();
        var fresh = (data.names || []).filter(function(n){ return !seen[String(n).toLowerCase()]; });
        namePool = namePool.concat(fresh);
        if (fresh.length === 0) poolExhausted = true;
      } catch (e) {
        poolExhausted = true;
      } finally {
        refilling = false;
      }
    }

    async function generateNames() {
      if (!currentUser) { showAuth(function(){ generateNames(); }); return; }
      var btn = document.getElementById('generate-btn');
      if (btn) { btn.disabled = true; btn.innerHTML = 'Generating... <i data-lucide="loader-2"></i>'; lucide.createIcons(); }
      document.querySelectorAll('.wizard-step').forEach(function(s){ s.classList.remove('active'); });
      document.getElementById('dashboard').classList.add('active');
      allResults = []; namePool = []; poolExhausted = false; refilling = false;
      resetHacks();
      document.getElementById('results-grid').innerHTML = '';
      state.hasMore = true; state.loading = false; state.active = true; state.params = getParams();
      onLengthChange();
      document.getElementById('scroll-status').innerHTML = '<span class="spinner"></span> Generating names…';
      await refillPool();
      await loadMore();
      if (btn) { btn.disabled = false; btn.innerHTML = 'Generate Names <i data-lucide="sparkles"></i>'; lucide.createIcons(); }
    }

    // Each page only does the fast domain + App Store checks on names already in the pool.
    async function loadMore() {
      if (!state.active || state.loading || !state.hasMore) return;
      state.loading = true;
      var status = document.getElementById('scroll-status');
      if (!(status.textContent || '').trim()) status.innerHTML = '<span class="spinner"></span>';
      try {
        if (namePool.length < state.count && !poolExhausted) await refillPool();
        var batch = namePool.splice(0, state.count);
        if (batch.length === 0) {
          state.hasMore = false;
          status.textContent = "That's all for this brief — try Regenerate or new seeds.";
          return;
        }
        var p = state.params || getParams();
        var res = await fetch('/api/enrich', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ names: batch, tlds: p.tlds, brief: p.brief, avoid: p.avoid }) });
        if (res.status === 401) { state.active = false; status.textContent = ''; showAuth(function(){ generateNames(); }); return; }
        var data = await res.json();
        var enriched = data.results || [];
        allResults = allResults.concat(enriched);
        document.getElementById('results-grid').insertAdjacentHTML('beforeend', enriched.filter(isVisible).map(cardHtml).join(''));
        lucide.createIcons();
        state.hasMore = !(poolExhausted && namePool.length === 0);
        status.textContent = state.hasMore ? '' : "That's all for this brief — try Regenerate or new seeds.";
        // Prefetch the next pool in the background so scrolling stays instant.
        if (!poolExhausted && namePool.length < state.count) refillPool();
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

    // ---------- domain agent ----------
    var chatOpen = false;
    var chatSid = null;
    var chatInited = false;
    try { chatSid = localStorage.getItem('blab_chat'); } catch(e) {}

    function toggleChat() {
      chatOpen = !chatOpen;
      document.getElementById('chat-panel').classList.toggle('open', chatOpen);
      if (chatOpen && !chatInited) {
        chatInited = true;
        addChatBubble('assistant', 'Hi! Ask me if any domain is available — e.g. "Is mynext.link available?" or "Check harborquay.com"');
      }
      var btn = document.getElementById('chat-toggle');
      btn.innerHTML = chatOpen ? '<i data-lucide="x"></i>' : '<i data-lucide="message-circle"></i>';
      lucide.createIcons();
      if (chatOpen) setTimeout(function(){ document.getElementById('chat-input').focus(); }, 40);
    }

    function escMd(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
    // Minimal, XSS-safe markdown: HTML is escaped first, then a small set of formats become
    // tags — inline (code, bold, italic, http(s) links) plus block-level GFM tables and line
    // breaks. Escaping up front means only these controlled transforms can produce markup.
    function mdInline(s){
      s = s.replace(/\`([^\`]+)\`/g,'<code>$1</code>');
      s = s.replace(/\\*\\*([^*]+)\\*\\*/g,'<strong>$1</strong>');
      s = s.replace(/__([^_]+)__/g,'<strong>$1</strong>');
      s = s.replace(/(^|[^*])\\*([^*]+)\\*/g,'$1<em>$2</em>');
      s = s.replace(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^\\s)]+)\\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      return s;
    }
    function mdCells(row){ return row.trim().replace(/^\\||\\|$/g,'').split('|').map(function(c){ return c.trim(); }); }
    var MD_SEP = /^\\s*\\|?(\\s*:?-+:?\\s*\\|)+\\s*:?-+:?\\s*\\|?\\s*$/;
    function renderMd(md){
      var lines = escMd(md).split('\\n');
      var html = '', i = 0, n = lines.length;
      while (i < n){
        // GFM table: a row with a pipe immediately followed by a |---|---| separator line.
        if (lines[i].indexOf('|') !== -1 && i+1 < n && MD_SEP.test(lines[i+1])){
          var head = mdCells(lines[i]);
          var aligns = mdCells(lines[i+1]).map(function(c){ var L=c.charAt(0)===':', R=c.charAt(c.length-1)===':'; return (L&&R)?'center':R?'right':L?'left':''; });
          i += 2;
          var body = [];
          while (i < n && lines[i].indexOf('|') !== -1 && lines[i].trim() !== ''){ body.push(mdCells(lines[i])); i++; }
          var t = '<table class="chat-table"><thead><tr>';
          head.forEach(function(c,x){ t += '<th'+(aligns[x]?' style="text-align:'+aligns[x]+'"':'')+'>'+mdInline(c)+'</th>'; });
          t += '</tr></thead><tbody>';
          body.forEach(function(r){ t += '<tr>'; head.forEach(function(u,x){ t += '<td'+(aligns[x]?' style="text-align:'+aligns[x]+'"':'')+'>'+mdInline(r[x]!=null?r[x]:'')+'</td>'; }); t += '</tr>'; });
          t += '</tbody></table>';
          html += t;
        } else {
          html += mdInline(lines[i]);
          // join text lines with <br>, but not the line right before a table block
          if (i+1 < n && !(lines[i+1].indexOf('|')!==-1 && i+2 < n && MD_SEP.test(lines[i+2]))) html += '<br>';
          i++;
        }
      }
      return html;
    }

    function addChatBubble(role, text) {
      var msgs = document.getElementById('chat-msgs');
      var div = document.createElement('div');
      div.className = 'chat-b ' + role;
      if (role === 'typing') {
        // Animated three-dot loading indicator while the agent checks the registrar.
        div.setAttribute('aria-label', 'Assistant is typing');
        div.innerHTML = '<span class="chat-typing"><span></span><span></span><span></span></span>';
      } else if (role === 'assistant') {
        div.innerHTML = renderMd(text);
      } else {
        div.textContent = text;
      }
      msgs.appendChild(div);
      msgs.scrollTop = msgs.scrollHeight;
    }

    function removeChatTyping() {
      document.querySelectorAll('.chat-b.typing').forEach(function(el){ el.remove(); });
    }

    async function sendChat() {
      var input = document.getElementById('chat-input');
      var msg = (input.value || '').trim();
      if (!msg) return;
      input.value = '';
      addChatBubble('user', msg);
      var sendBtn = document.getElementById('chat-send');
      sendBtn.disabled = true;
      addChatBubble('typing', 'Checking…');

      // Live assistant bubble, created on first streamed token so the typing
      // indicator stays visible during the tool-calling round-trip.
      var msgs = document.getElementById('chat-msgs');
      var bubble = null;
      var bubbleRaw = '';
      function appendDelta(t) {
        if (!bubble) {
          removeChatTyping();
          bubble = document.createElement('div');
          bubble.className = 'chat-b assistant';
          msgs.appendChild(bubble);
        }
        // Accumulate raw markdown and re-render the whole bubble so multi-token
        // spans (e.g. **bold**) resolve once their closing marker streams in.
        bubbleRaw += t;
        bubble.innerHTML = renderMd(bubbleRaw);
        msgs.scrollTop = msgs.scrollHeight;
      }

      try {
        var res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message: msg, sessionId: chatSid })
        });

        // Server hands back the session id as a header so memory persists across turns.
        var sid = res.headers.get('x-chat-session');
        if (sid) {
          chatSid = sid;
          try { localStorage.setItem('blab_chat', chatSid); } catch(e) {}
        }

        // Non-stream error responses (e.g. 400) come back as JSON, not SSE.
        if (!res.ok || !res.body) {
          var errText = 'Something went wrong. Try again.';
          try { var ej = await res.json(); if (ej && ej.error) errText = ej.error; } catch(e) {}
          removeChatTyping();
          addChatBubble('assistant', errText);
          return;
        }

        // Parse the AG-UI SSE stream: events are "data: {json}\\n\\n"; we surface the
        // text deltas from TEXT_MESSAGE_CONTENT and flag RUN_ERROR.
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buffer = '';
        var errored = false;
        while (true) {
          var r = await reader.read();
          if (r.done) break;
          buffer += decoder.decode(r.value, { stream: true });
          var sep;
          while ((sep = buffer.indexOf('\\n\\n')) !== -1) {
            var raw = buffer.slice(0, sep).trim();
            buffer = buffer.slice(sep + 2);
            if (!raw || raw.indexOf('data:') !== 0) continue;
            var payload = raw.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            var evt;
            try { evt = JSON.parse(payload); } catch(e) { continue; }
            if (evt.type === 'TEXT_MESSAGE_CONTENT' && evt.delta) appendDelta(evt.delta);
            else if (evt.type === 'RUN_ERROR') errored = true;
          }
        }

        removeChatTyping();
        if (!bubble) {
          addChatBubble('assistant', errored
            ? 'Sorry — something went wrong. Please try again.'
            : 'Sorry — I could not generate a response. Try again.');
        }
      } catch(e) {
        removeChatTyping();
        if (!bubble) addChatBubble('assistant', 'Network error. Please try again.');
      } finally {
        sendBtn.disabled = false;
        document.getElementById('chat-input').focus();
      }
    }
  </script>
</body>
</html>`;
