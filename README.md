# SeoScrub

A web app that crawls a website, checks its links for breakage, and reports the results —
with optional on-page SEO analysis. Built with Next.js (App Router) and deployed as a
self-contained Docker image on Coolify. Live at [seoscrub.in](https://seoscrub.in).

## Features

- **Smart analysis** — inspects a site's homepage, categorizes discovered URLs (pages,
  params, pagination, media, admin, etc.), and detects JavaScript-heavy/SPA sites, falling
  back to `sitemap.xml` when the HTML has no crawlable links.
- **Multiple crawl modes** — check pre-discovered links directly, or visit content pages
  and extract + check every link on them, or a traditional depth-first crawl.
- **Optional SEO checks** — title/meta, heading structure, image alt coverage, HTTPS, and a
  per-page score/grade alongside the link results.
- **Results UI** — filterable, sortable table of working/broken links with source pages,
  status codes, and error classification; CSV export.
- **Built-in safety** — SSRF URL validation, per-endpoint rate limiting, security-event
  logging, robots.txt awareness, and HTTP Basic Auth to keep the deployment private.

## Tech stack

- **Next.js 15** (App Router, React 19), `output: 'standalone'` for a small Docker image
- **PostgreSQL** for job/results storage — _migration from Supabase to self-hosted Postgres
  (`DATABASE_URL`) is in progress; see [`.env.example`](.env.example) for the current env_
- **Zod** for request validation, **axios** + **cheerio** for crawling/parsing
- **Tailwind CSS v4**

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in real values
npm run dev                  # http://localhost:3000
```

`npm run build` produces the standalone server; `npm start` runs it.

## Configuration

All configuration is via environment variables. [`.env.example`](.env.example) is the
source of truth and documents each one. The essentials:

| Variable | Purpose |
|----------|---------|
| Database connection | Postgres access (see `.env.example` for the current variable during the migration) |
| `ENABLE_BASIC_AUTH`, `BASIC_AUTH_USER`, `BASIC_AUTH_PASSWORD` | Gate the app behind HTTP Basic Auth (keep it private) |
| `ALLOWED_ORIGIN` | Public origin, used for CORS in production |
| `CSRF_SECRET`, `CLEANUP_SECRET_TOKEN` | Security tokens — generate with `openssl rand -hex 32` |
| `CRAWLER_*` | Crawler identity (User-Agent, contact) and politeness (delay, concurrency, robots) |
| `RATE_LIMIT_*`, `MAX_CRAWL_*`, `REQUEST_TIMEOUT` | Abuse limits and crawl ceilings |

Generate strong values for every secret before deploying — do not ship the `change-me`
defaults.

## Deployment

The repo ships a multi-stage [`Dockerfile`](Dockerfile) producing a standalone Next.js
server, intended for Coolify. Set the environment variables in Coolify's env panel (mark
the build-time ones as *Build Variables*), point "Ports Exposes" at `PORT`, and set
`ALLOWED_ORIGIN` to your domain.

## Project structure

```
src/
  app/
    api/            # route handlers: analyze, crawl (start/large/chunk/status/stop),
                    #   results, seo, health, security, admin, csrf, basicauth
    components/     # UI (forms, results table, header/footer, docs pages)
    <pages>/        # home, analyze, results/[jobId], documentation, changelog
  lib/
    crawler, linkExtractor, httpChecker, seoDetector   # crawl engine
    security, validation, rateLimit, securityLogger    # safety
    supabase (→ pg db module), utils, version          # infra
middleware.ts       # HTTP Basic Auth gate
docs/handoff/       # hardening & improvement specs (see below)
```

## Security & roadmap

An audit and prioritized implementation plan live in [`docs/handoff/`](docs/handoff/):

1. [Abuse, Bot & DDoS Protection](docs/handoff/01-abuse-and-ddos-protection.md)
2. [Access Control / Basic Auth](docs/handoff/02-basic-auth.md)
3. [Architecture Review](docs/handoff/03-architecture-review.md)
4. [Features & Improvements](docs/handoff/04-features-and-improvements.md)

If you deploy this publicly, read docs 01 and 02 first — they cover making the API
surface private and hardening the crawler against SSRF and abuse.
