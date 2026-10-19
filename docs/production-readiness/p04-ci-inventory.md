# P04 — CI inventory, lint gate, services, ops blockers

**Last updated:** 2026-10-07  
**Scope:** Document what `.github/workflows/ci.yml` runs, measured backend lint debt, Redis/Postgres test env wiring, and what remains blocked on staging / branch-protection accounts.

## What CI runs today

### Job `backend` (`back-end/`)

| Step | Script / command | Notes |
|---|---|---|
| Lint | `npm run lint:check -- --quiet` | **Enabled P04-T05** — errors only; no `--fix`. `NODE_OPTIONS=--max-old-space-size=4096` because the default heap OOMs once Postgres and Redis are up |
| Types | `npm run typecheck:all` | Includes unit specs |
| e2e types | `npm run typecheck:e2e` | Types only — does **not** execute e2e |
| DI graph | `npm run check:di` | No DB/Redis |
| Schema | `npm run schema:check` | Committed `schema.gql` must match decorators |
| Unit tests | `npm test` | |
| Scratch DB | `npm run db:deploy` (`prisma migrate deploy`) | CI Postgres service |
| Seeds | `seed`, `seed:taxonomy`, `seed:plans` | |
| Drift | `npm run check:drift` | |
| Concurrency | `npm run test:concurrency` | **Added P04-T06** — requires `DATABASE_URL_TEST` (set in job env); fails the job if unset |

**Services (P04-T06):** Postgres 16 + **Redis 7**. Job env includes `DATABASE_URL`, `DATABASE_URL_TEST` (same scratch DB), `REDIS_URL`, `STRIPE_WEBHOOK_SECRET_TEST`.

**Still missing from backend job:** live order-lifecycle `test:e2e` execution (env wired; suite needs shop/customer fixtures before enabling — FK on Order create); live P01/P02 suite.

### Job `frontend` (workspaces)

| Step | Notes |
|---|---|
| codegen drift | turbo codegen + `git diff` on generated dirs |
| lint | `npx turbo run lint` (apps + packages) |
| typecheck / test / build | turbo |

### Job `smoke`

Boots vendor + admin production builds and hits listed routes with a cookie. Does **not** cover storefront, real session, createOrder, or payment. API `/ready` smoke against a running Nest process is owned with P03 HealthModule once Docker/platform boot is proven.

## Backend lint measurement

Commands (PowerShell, from `back-end/`):

```powershell
npm run lint:check
# equivalent: npx eslint "{src,apps,libs,test}/**/*.ts"
# CI uses: npm run lint:check -- --quiet
```

| Measurement | Errors (`--quiet`) | Notes |
|---|---|---|
| Baseline (earlier 2026-09-16) | **569** | Of which ~349 prettier auto-fixable |
| After `npm run lint` / `eslint --fix` (2026-09-16 evening) | **220** | ~350 fixed by autofix; remaining were real rule violations |
| After mechanical cleanup (2026-09-16 night) | **0** | Unused vars, require-await (specs off), enum comparisons, small buckets. **CI lint gate ON.** |

`package.json` scripts:

- `lint` — still has `--fix` for local cleanup (do **not** use this in CI).
- `lint:check` — no `--fix`; CI entry. Warnings (~2282 as of gate enablement) stay **non-blocking**.

### Decision (updated)

1. **Gate PRs on `lint:check` (errors only).** Added to `.github/workflows/ci.yml` under the `backend` job.
2. Warnings stay **non-blocking** until a dedicated cleanup.
3. Spec-only: `@typescript-eslint/require-await` is off for `**/*.spec.ts` (mock `async` without `await`). Production code still enforced.
4. `npm audit` highs remain under P01-T10; **no `--force`**.

## Alerts (P04-T04) — blocker without staging channel

| Mechanism | Local / code | Staging proof |
|---|---|---|
| Sentry issue stream | `beforeSend` filter + scrub; `SENTRY_DSN` or Integrations → Monitoring | Needs org project + alert rule → Slack/email owned by ops |
| `AlertService` | Console adapter by default; Slack when `SLACK_WEBHOOK_URL` is set | **Blocked:** no staging Slack webhook / Sentry alert channel configured in this developer session |
| Unit coverage | `alert.service.spec.ts`, worker host specs | Does not prove delivery to a human channel |

**Local test that can be run without staging:** boot API with `SLACK_WEBHOOK_URL` unset → alerts log to console; with a throwaway Incoming Webhook URL in a private channel, fire a terminal job failure and confirm one message (ops). Not claimed done here.

## Branch protection / required checks (P04-T09) — ops

Repo workflow defines jobs `backend`, `frontend`, `smoke`. Turning them into **required** status checks is a GitHub branch-protection (or ruleset) setting on `main`. This session cannot verify or change account settings.

**Ops checklist (do in GitHub UI):**

1. Settings → Branches / Rulesets → protect `main`.
2. Require status checks: `back-end`, `apps + packages`, `authed routes render` (exact names from Actions).
3. Require branches up to date before merge.
4. Do not allow bypass for deploy accounts without a written exception.

## Staging outage drill (P04-T10) — procedure (blocked without staging)

**Blocked:** no staging deployment with shared Sentry/Slack was available to this session.

When staging exists:

1. Note commit SHA and `APP_VERSION` / release.
2. Induce controlled failures: throw once from a guarded admin-only route; stop Redis briefly; fail a BullMQ job past max attempts.
3. Confirm: Sentry event (scrubbed), `/ready` 503 while Redis down, Slack/`AlertService` on terminal job failure.
4. Restore Redis / redeploy; confirm `/ready` 200 and alert quiet.
5. Record times-to-detect and times-to-recover in the P04 execution log. Do **not** mark T10 `[x]` without that evidence.

## Migration gates (P04-T07)

CI uses `prisma migrate deploy` for the scratch DB (`npm run db:deploy`). Existing hosted DBs still need the one-time `db:resolve-*` cutover documented in P03 before their first migrate deploy. Keep `schema:check`, codegen drift, and `check:drift` as the source gates that already exist.

## Evidence files

- This note
- `back-end/package.json` (`lint:check`)
- `back-end/eslint.config.mjs` (`varsIgnorePattern`, require-await off for specs)
- `.github/workflows/ci.yml` (Redis service, `DATABASE_URL_TEST`, concurrency step, **ESLint gate**)
- `back-end/src/common/observability/sentry-scrub.ts` + `sentry-scrub.spec.ts`
- Frontend `shared/sentry/scrub.ts` wired into vendor/storefront Sentry inits
