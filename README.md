# Nomenclature

Small Cloudflare Worker app for generating and checking product names.

- Uses Apple Search API to find exact and close App Store software collisions.
- Uses Brave Search when `BRAVE_API_KEY` is present in the Worker environment.
- Scores candidates for industry fit, target audience fit, important keywords, avoid terms, name length, App Store availability, and web collision risk.
- Deployed at `https://blabout.com`.

## Commands

```bash
npm ci
npm run check
npm run deploy
```
