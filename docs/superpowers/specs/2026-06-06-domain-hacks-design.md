# Domain Hacks — results-page name transformations + premium filter

**Date:** 2026-06-06
**Status:** Approved (design)

## Goal

Help users find more available (and more affordable) domains from the results page by
generating name **variants** — prefixes, suffixes, pluralization, and TLD hacks — and by
**hiding premium** names. Everything is integrated into the existing dashboard: the left
filter sidebar and the right results grid. No new page or flow.

## User-facing behavior

- A new **"Domain hacks"** block in the left filter sidebar with four on/off toggle chips —
  **Prefixes**, **Suffixes**, **Pluralize**, **TLD hacks** — plus a **Hide premium** switch.
- Turning a hack **on** generates variants of the names currently in the results, merges them
  into the grid as cards **badged** by hack type (`prefix` / `suffix` / `plural` / `hack`), and
  checks their availability **lazily** as they scroll into view.
- Turning a hack **off** removes that hack's variant cards.
- **Hide premium** hides any card the registrar flags as premium (suggestions and hacks alike).

## Architecture

- **Client-side generation.** Variants are pure string transforms, generated in the browser for
  instant feedback. TLD hacks use the client's existing `TLDS` list, so every TLD hack targets a
  Cloudflare-registrable extension.
- **Lazy availability checks** through a new `POST /api/hacks/check`, called in batches by an
  `IntersectionObserver` as variant cards enter the viewport — matching the page's existing
  infinite-scroll feel and bounding registrar load.
- **Refactor:** extract the registrar batch-call from `checkDomains` into a reusable
  `checkDomainList(domains: string[], env): Promise<DomainInfo[]>`; both `checkDomains` and the
  new endpoint use it.

Rejected alternative: generate + check everything server-side in one call. Simpler client, but
fires a flood of registrar calls and feels laggy. Lazy client model chosen instead.

## Generation details

Base names = the names already in the results grid (the wizard's suggestions).

- **Prefixes** — curated list (~6: `get, try, go, my, the, new`); prepend by concatenation
  (`get` + `quay` → `getquay`). Applied across the **selected** TLDs.
- **Suffixes** — curated list (~6: `ly, hq, app, labs, hub, io`); append (`quay` + `hq` →
  `quayhq`). Across selected TLDs. The suffix is part of the second-level name, not the TLD.
- **Pluralize** — `name + "s"`, or `name + "es"` when the name ends in `s/x/z/ch/sh`. Across
  selected TLDs.
- **TLD hacks** — for each base name and each `tld` in the client `TLDS` list where
  `name.endsWith(tld)` and the remaining base is ≥ 2 chars, form `base.tld`
  (`signal` → `sign.al` is illustrative; the actual set is bounded by app TLDs such as
  `io, me, co, sh, gg, link, live, app, dev, pro, ai, net, org, …`, e.g. `income` → `inco.me`,
  `portfolio` → `portfol.io`). A TLD hack carries its own TLD and is **not** multiplied across
  the selected TLDs.

Generation also: **dedupes** variants against existing result domains and against each other,
and **caps** the number of pending (unchecked) variants (≈40 at a time; process top-N base
names first) to avoid runaway; any truncation is surfaced in the grid's scroll status.

## Checking

- **Endpoint:** `POST /api/hacks/check` with body `{ domains: string[] }` (validated/capped).
  Parses each into base + tld, calls `checkDomainList`, returns `DomainInfo[]`.
- **`checkDomainList(domains, env)`** is the extracted registrar batch logic from `checkDomains`
  (batched POSTs with `x-auth-email` / `x-auth-key`, 8s timeout, parse `result.domains`).
- **Client:** an `IntersectionObserver` watches unchecked variant cards; when one is visible, its
  domain joins a small debounced batch → `POST /api/hacks/check` → cards update to one of:
  `available` (show price) / `taken` / `premium` / `error`.

## Hide premium

- A client-side filter across **all** cards. Premium = `DomainInfo.reason` matches `/premium/i`.
  (The exact `reason` string returned by the registrar for premium names will be confirmed during
  build against a known premium domain, e.g. `mynext.link`.)
- When on, premium cards are hidden (`display:none`), not discarded. Cards not yet checked stay
  visible until their check resolves, then hide if premium.

## UI

- Sidebar **"Domain hacks"** `filter-block` (same structure as the TLD block): four hack toggle
  chips reusing `.tld-toggle` styling, plus a **Hide premium** toggle.
- Grid: variant cards reuse `.result-card` with a small `.hack-badge` element naming the hack
  type; new CSS for the badge and the per-card "checking…" state.

## Files

- `src/index.ts` — extract `checkDomainList`; add the `POST /api/hacks/check` route + handler.
- `src/html.ts` — sidebar block markup + CSS; JS for hack toggles, variant generation, badges,
  the lazy-check `IntersectionObserver`, and the hide-premium filter.
- No schema changes.

## Edge cases / to verify during build

- Exact registrar `reason` value for premium (match `/premium/i`; confirm against a known name).
- TLD hacks must leave a base of ≥ 2 chars; skip otherwise.
- Never emit a variant identical to an existing suggestion (dedupe).
- Variant explosion across names × TLDs → capping + lazy checking keep it bounded.
- A prefix/suffix/plural that happens to be already registered simply shows as `taken`.
- Hide-premium vs lazy cards: premium is unknown until a card is checked; filter applies on
  resolution.

## Out of scope (v1)

- Per-word prefix/suffix pickers (curated sets only).
- Hyphenated variants.
- TLD-hack dictionary beyond the app's supported TLDs.
- Server-side generation.
