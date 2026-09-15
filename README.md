# tools-hub

Personal collection of small web tools served from `sebas.moe` on Cloudflare Workers.

## Production architecture

`tools-hub` owns the `sebas.moe` custom domain.

- Static tools are served from `public/` through Cloudflare Static Assets.
- `src/index.js` runs only for `/class-scheduler*` requests.
- Those requests are forwarded internally to the `class-scheduler` Worker through the `CLASS_SCHEDULER` Service Binding.
- Cloudflare Access protects `sebas.moe/class-scheduler*` before the request reaches the scheduler.

Do not add a separate `sebas.moe/class-scheduler*` Worker Route to `class-scheduler`; that conflicts with this front-door routing setup.

## Layout

- `public/index.html` — Tools Hub home page
- `public/accounting-quizzer/index.html` — Accounting Account Trainer
- `src/index.js` — path router for the Class Scheduler service binding
- `wrangler.jsonc` — Worker, assets, and service-binding configuration

## Deploy

This repository is deployed through Cloudflare's Git integration. The `sebas.moe` custom domain is attached to the `tools-hub` Worker in Cloudflare.

For a manual deployment:

```bash
npx wrangler deploy
```

## Adding another static tool

Create a folder under `public/`, then add its relative URL to the `TOOLS` array in `public/index.html`.

## Safety notes

Do not commit `.dev.vars`, `.env*`, tokens, Wrangler state, or logs. These paths are covered by `.gitignore`.
