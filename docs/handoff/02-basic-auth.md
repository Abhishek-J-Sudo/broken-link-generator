# 02 — Access Control / Basic Auth

**Priority:** P0
**Goal:** The app is supposed to be private. Right now it is only *partly* gated: the
HTML pages prompt for Basic Auth, but **every `/api/*` route is completely open.** Anyone
who knows the URL can drive the crawler, read results, and hit admin/security endpoints
without credentials. This doc makes the whole surface private and hardens the mechanism.

---

## Current state

`middleware.ts` implements HTTP Basic Auth gated on `ENABLE_BASIC_AUTH`, comparing
`BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` from env. On failure it rewrites to
`/api/basicauth` which returns `401` + `WWW-Authenticate: Basic ...` to trigger the
browser prompt.

**The critical bug is the matcher** (`middleware.ts:63`):

```ts
export const config = {
  matcher: ['/', '/((?!api|_next|static|favicon.ico).*)'],
};
```

`(?!api|...)` explicitly **excludes `/api`** from the middleware. So:

- `POST /api/crawl/start`, `/api/analyze`, `/api/crawl/large` — unauthenticated. Anyone can
  spend our CPU/DB and use us as an SSRF/DoS proxy.
- `GET /api/results/[jobId]`, `/api/seo/summary/[jobId]` — anyone with a job ID (UUID, but
  still) reads crawl output.
- `GET /api/security/events` — the security dashboard is exposed.
- `GET /api/health` — leaks environment + DB error detail (see Doc 01 C8).

Other weaknesses:

- Credentials compared with plain `===` (`middleware.ts:50`) — timing side-channel (minor,
  but trivial to fix).
- Password is a single plaintext env value shared by everyone; no per-user accounts, no
  rotation story.
- `console.log` prints the attempted username on every request (`middleware.ts:47`).
- No lockout/backoff on repeated failed auth — brute-forceable (mitigated once behind the
  edge WAF from Doc 01 C7, but should also be handled here).

---

## Decision: what kind of auth?

For a single small trusted group, **Basic Auth over HTTPS covering the entire app
(pages + API)** is the right, simple answer — keep it. Move to a real session/identity
system only if you later need per-user audit, roles, or public signup. This doc assumes
we keep Basic Auth but do it correctly. (A "future: real auth" note is in Doc 04.)

---

## Changes to implement

### C1 — Gate the API too (the actual fix)

Change the matcher so middleware runs on API routes, while still excluding Next internals
and the few endpoints that must stay open.

```ts
export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|ico|webp)$).*)'],
};
```

Then in `middleware.ts`, allow a small explicit **bypass list** *inside* the function so
machine-to-machine endpoints that use their own token don't get double-gated or broken:

```ts
const PUBLIC_PATHS = [
  '/api/basicauth',      // the 401 responder itself
  '/api/health',         // if you keep it open for uptime checks — see note
];
const TOKEN_AUTH_PATHS = [
  '/api/admin/cleanup',  // authenticated by CLEANUP_SECRET_TOKEN, not Basic Auth
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  if (TOKEN_AUTH_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  if (ENABLE_BASIC_AUTH && BASIC_AUTH_USER && BASIC_AUTH_PASSWORD) {
    const failed = checkBasicAuth(request);
    if (failed) return failed;
  }
  return NextResponse.next();
}
```

> Note on `/api/health`: uptime monitors usually can't send Basic Auth. Options: keep it
> public but make it leak nothing (Doc 01 C8), **or** protect it and give the monitor the
> credentials, **or** expose a separate tokenized health path. Pick one and document it.

### C2 — Return `401` directly instead of rewriting

The current flow rewrites to `/api/basicauth`. For API clients this turns an auth failure
into a `200`-rewrite-to-401 dance that's confusing and returns `text/plain`. Simpler and
more correct: return the `401` straight from `checkBasicAuth`:

```ts
function unauthorized() {
  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="SeoScrub", charset="UTF-8"' },
  });
}
```

Return `unauthorized()` on missing/malformed/incorrect credentials. Once this is in place
you can delete `src/app/api/basicauth/route.js` and the `PUBLIC_PATHS` entry for it.

### C3 — Constant-time credential comparison

Replace the `===` checks with `crypto.timingSafeEqual` over hashes so length/among-chars
timing doesn't leak. Edge runtime note: `middleware.ts` runs on the Edge runtime by
default, where the Node `crypto` module may be unavailable. Two options:

- **Force the Node.js runtime** for middleware and use `crypto.timingSafeEqual`:
  compute `sha256(input)` and `sha256(expected)` (equal-length buffers) and compare.
- Or keep Edge and use the Web Crypto `crypto.subtle.digest` to hash both sides, then
  compare the resulting equal-length byte arrays in constant time.

Either is fine; pick based on whether you want middleware on Node or Edge. Document the
choice.

### C4 — Credentials handling

- Keep `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` in env (already in `.env.example`). Ensure
  the deploy sets a **strong** password; the example ships `change-me` — add a startup
  assertion that refuses to boot in production if the password is still `change-me` or
  shorter than N chars.
- If you want more than one user without a DB, support a comma-separated
  `BASIC_AUTH_USERS="alice:hash1,bob:hash2"` of `user:sha256(pass)` pairs and compare
  against hashes. Optional; only if multiple people need distinct logins.
- Never log credentials. Remove `middleware.ts:10` and `:47` debug logs (or guard behind
  `NODE_ENV !== 'production'` and strip the username).

### C5 — Brute-force backoff

Add a lightweight failed-attempt counter keyed by client IP (reuse the shared
rate-limit store from Doc 01 C2). After e.g. 10 failures in 5 minutes, return `429` for a
cooldown. This is defense-in-depth behind the edge WAF.

### C6 — Make `ENABLE_BASIC_AUTH` fail safe

Today if `ENABLE_BASIC_AUTH` is unset or the user/password envs are missing, the app is
**wide open** (the `if` is skipped). For a private app that's the wrong default. In
production, if `ENABLE_BASIC_AUTH !== 'true'` **or** credentials are missing, either refuse
to start or default-deny. Log a loud warning at boot describing which state you're in.

---

## Test / acceptance checklist

- [ ] `curl -s -o /dev/null -w "%{http_code}" https://APP/api/analyze -X POST` → `401`
      (was `200`/`4xx` before because API was open).
- [ ] `GET /api/results/<any-uuid>` without credentials → `401`.
- [ ] `GET /api/security/events` without credentials → `401`.
- [ ] Valid `Authorization: Basic base64(user:pass)` → request proceeds on both a page and
      an API route.
- [ ] `/api/admin/cleanup` still works with its bearer token and is **not** blocked by
      Basic Auth.
- [ ] Wrong password 10× → subsequent attempts get `429` for the cooldown window (C5).
- [ ] With `ENABLE_BASIC_AUTH` unset in production, app default-denies or refuses to boot (C6).
- [ ] No credentials appear in logs.

## Files touched

- `middleware.ts` — matcher, bypass list, direct 401, constant-time compare, backoff, fail-safe.
- `src/app/api/basicauth/route.js` — deletable after C2.
- `.env.example` — clarify `ENABLE_BASIC_AUTH` semantics and the strong-password requirement.
- `src/app/api/health/route.js` — coordinate with Doc 01 C8 on whether it stays public.
