<a href="https://blabout.com"><img src="assets/banner.svg" alt="Cloudflare Domain Finder — live at blabout.com" width="100%"></a>

<p>
  <a href="https://blabout.com"><img alt="Live demo" src="https://img.shields.io/badge/Live%20demo-blabout.com-8be8ee?style=flat-square&logo=cloudflare&logoColor=0d0e10&labelColor=22242a"></a>
  <a href="https://blabout.com"><img alt="Cloudflare Workers" src="https://img.shields.io/badge/Cloudflare-Workers-F38020?style=flat-square&logo=cloudflare&logoColor=white&labelColor=22242a"></a>
  <a href="https://blabout.com"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white&labelColor=22242a"></a>
  <img alt="License: ISC" src="https://img.shields.io/badge/License-ISC-blue?style=flat-square&labelColor=22242a">
</p>

# Cloudflare Domain Finder

## About

Cloudflare Domain Finder is a free, open-source tool I built to help people find available domain names on Cloudflare with no markup. Save your favorites and settle on the best one for your business or blog.

## How it works

- AI generates diverse, brandable name ideas (Workers AI Llama, routed through AI Gateway).
- Live `.com` and multi-TLD availability and pricing come straight from the Cloudflare Registrar API — at Cloudflare's at-cost pricing.
- App Store collision check via the Apple Search API; live seed-word suggestions as you type.
- Create an account to bookmark the domains you like and compare them in one place.
- A Cloudflare Worker, with users and bookmarks in D1. Deployed at `https://blabout.com`.

## Commands

```bash
npm ci
npm run check
npm run deploy
```

## Secrets Management

This project uses [Doppler](https://doppler.com) for secret management.

To set up Doppler for development:

```bash
doppler setup
```

To run with secrets:

```bash
doppler run -- npm run dev
```

To deploy with secrets:

```bash
doppler run -- npm run deploy
```
