# PRIORITIES — ranked backlog

Every open item in [TODO.md](TODO.md), ordered most important first, with the feature or area that owns it.

`TODO.md` stays the source of truth and keeps the full reasoning per item. This file is the **order of work** and the **owner map** — it adds no new tasks and removes none.

**Last updated:** 2026-08-12

---

## How to read this / كيف تقرأ الملف

- الترتيب من الأعلى للأسفل: **T0 هو الأهم**، و **T5 هو الأقل أهمية**.
- عمود **Owner** يحدد الفيتشر أو المجلد اللي البند تابع له.
- عمود **Why** يشرح بجملة واحدة ليش البند بهاي المرتبة.
- في نهاية الملف: قسم **قرارات مطلوبة منك**، قسم **بنود قديمة تحتاج إغلاق**، وفهرس **كل المهام مرتّبة حسب الفيتشر**.

| Tier | Meaning | بالعربي |
|---|---|---|
| **T0** | Launch blockers — leaked secrets, or production cannot run / cannot be signed up for | يمنع الإطلاق |
| **T1** | Security and money correctness in code | أمان ومال |
| **T2** | Reliability, data integrity, and trust in CI | استقرار وسلامة بيانات |
| **T3** | Missing pillars — the product is usable but incomplete | فجوات منتج أساسية |
| **T4** | Feature follow-ups and UX polish | تحسينات |
| **T5** | Tests, docs, cleanup, perf-later | تنظيف وتوثيق |

### Owner tags

| Tag | Area |
|---|---|
| `SEC` | Secret hygiene (crosses repo + provider dashboards) |
| `INFRA` | Render / Vercel / Neon / Bunny / Resend / Twilio / Stripe consoles |
| `CI` | Repo tooling, turbo tasks, test/lint gates |
| `BE · <module>` | `back-end/src/<module>` |
| `VEN` | `apps/vendor` |
| `ADM` | `apps/admin` |
| `UI` | `packages/ui` |
| `DOCS` | `back-end/docs` / `apps/vendor/docs` / `docs` |

### Hard ordering constraints — احذر من هذا الترتيب

These four dependencies are not preferences; getting them backwards breaks something.

1. **Set `SECRETS_ENCRYPTION_KEY` in Render BEFORE rotating `APP_SECRET`** (T0-2 before T0-1). The integrations console falls back to `APP_SECRET`, so rotating it first orphans every stored provider credential. **Softened 2026-08-12 by the key-rotation path (T2-18):** the mistake is now recoverable — put the old `APP_SECRET` in `SECRETS_ENCRYPTION_KEY_PREVIOUS` and boot re-encrypts everything — but doing it in the right order is still one step instead of three.
2. ~~**Do not set `REPLICATE_WEBHOOK_URL` until T2-1/2/3 land.**~~ **Satisfied 2026-08-12** — all three were verified fixed in the code, so setting it is now safe.
3. **Do not enable `AI_IMAGE_ON_MODEL_ENABLED` until the eval is run AND output-image moderation is enabled.** Half satisfied 2026-08-12: the moderation now exists (T2-5) but ships env-gated **off** — turn on `AI_IMAGE_OUTPUT_MODERATION_ENABLED` first. The catalogue eval (15–20 images, ~70% keep threshold) has still never been run.
4. **Run the production seed (T0-9) before trusting any entitlement.** A missing entitlement row denies, so every metered capability is silently off until `seed:plans` runs.

---

## T0 — Launch blockers · يمنع الإطلاق

Nothing below T0 matters commercially until these clear: secrets are exposed, the API's database has no rows, and no new vendor can receive a signup code.

> **Status 2026-08-11 — the repo half is done, the console half is not.** Every real credential in the three tracked `.env.example` files is now a shaped placeholder (a pattern scan over tracked files comes back clean), and `SECRETS_ENCRYPTION_KEY` is documented with its ordering constraint. What remains is provider-console work: **[docs/go-live-checklist.md](docs/go-live-checklist.md)** has it in dependency order with exact commands. Two credentials were found during that pass that are **not** in `TODO.md`'s rotation list — `GEMINI_API_KEY` and a Sentry `sntrys_…` auth token — and the repo is **private** (checked via the GitHub API), so exposure is limited to anyone with repo access rather than the public.

| # | Task | Owner | Why it ranks here |
|---|---|---|---|
| T0-1 | **Rotate every secret pasted into chat on 2026-08-09** — Neon password, `JWT_SECRET`, `APP_SECRET`, Upstash Redis password, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `REPLICATE_API_TOKEN`, `AI_SERVICE_KEY`, `STRIPE_WEBHOOK_SECRET`, Mailtrap | `SEC` | Ten live credentials are disclosed. Every other task is theoretical while an attacker holds the database password and the JWT signing key. **Do T0-2 first.** |
| T0-2 | **Set a dedicated `SECRETS_ENCRYPTION_KEY` in Render** | `INFRA` · `BE · integrations` | It currently falls back to `APP_SECRET`. Rotating `APP_SECRET` (T0-1) without this first bricks every stored integration credential. |
| T0-3 | **Rotate the Neon `neondb_owner` password committed in `back-end/.env.example`** (lines 3 and 12) | `SEC` · `INFRA` | It is in git history — deleting the line fixes nothing. Same credential class as T0-1, separate exposure path. |
| T0-4 | **Rotate the live BunnyCDN storage key committed in `back-end/.env.example`** and replace with a placeholder | `SEC` · `INFRA` | Write access to the CDN origin serving every product image. |
| ~~T0-5~~ | ~~**Scrub the Stripe `sk_test_…` out of the tracked env templates**~~ — **done 2026-08-11** | `SEC` | `.env copy` never existed as a tracked file. The scrub covered all 13 credentials in `back-end/.env.example` plus the Sentry token in `apps/vendor/.env.example`, not just Stripe. Rotation (T0-1…T0-4) is still open. |
| T0-6 | **Fix the Resend sender — verify a domain, set the From address in Admin → Integrations → Email** | `INFRA` · `ADM · integrations` | `onboarding@resend.dev` 550s every recipient but the account owner, and `assertEmailDeliverable` now *refuses* `startVendorSignup` while it is configured. **Vendor signup is hard-blocked.** Also resolves the stored `osama.jawanh@gmail.com` sender, which Resend rejects at send time. |
| T0-7 | **Unset `ALLOW_SANDBOX_EMAIL_SENDER` before launch** | `INFRA` | With it set, nothing warns that customers are not receiving mail — the 550 dies in a queue worker. Removing it re-arms both guards. Do it *after* T0-6, not before. |
| T0-8 | **Configure a real SMS provider (Twilio)** — the enabled provider is `console`, which writes to the server log | `INFRA` · `BE · otp` | There is no fallback channel while email is blocked. Switching OTP channel to SMS today moves the code to Render's logs; it does not deliver it. |
| T0-9 | **Run the one-time production seed** — `npm run seed`, `seed:taxonomy`, `seed:plans` against the prod `DATABASE_URL`; verify with `check:drift` | `INFRA` · `BE · prisma` | `db push` creates tables, not rows. `role_permissions` is empty and every plan entitlement is missing — and a missing entitlement **denies**, so every metered capability is silently off for every shop. |
| T0-10 | **Apply `2026-08-09-integration-configs.sql`** — then have admins **log out and back in** | `INFRA` · `BE · prisma` | **Smaller than it reads.** Verified 2026-08-11: `otps.verified_at` + its `created_at` index are in `schema.prisma`, so the Render build's `db push` creates them; the `MONITORING` enum label is additive and also handled; and `sync:permissions` already runs in the build command. The only object `db push` cannot produce is the partial unique index `integration_configs_one_enabled_per_type` — Prisma has no syntax for it. Databases **not** deployed through Render still need all three files. |
| T0-11 | **Reconcile which Neon project is production** — `.env.example` documents `ep-super-butterfly-aqksxtdy` (us-east-1), Render points at `ep-broad-heart-ay62yk2t` (us-east-2) | `INFRA` | Two candidate production databases, and the seed in T0-9 has to land in the right one. `render.yaml`'s `region: virginia` comment no longer matches the instance in use. |
| T0-12 | **Vercel: change the project Root Directory from `vendor` to `apps/vendor`** | `INFRA` | Left over from the Turborepo migration. Nothing deploys correctly until this is done. |

---

## T1 — Security and money correctness · أمان ومال

Real code defects with a named attacker or a named financial loss.

> **Status 2026-08-12 — T1 is done except T1-13 (an infra check).** Full back-end suite green: **223 suites / 3664 tests**, `nest build`, `check:di` and `schema:check` all clean; `apps/vendor` typecheck clean. The SDL did not move — guards are not part of it.
>
> **Four items were already fixed and are marked stale below** (T1-2, T1-5, T1-10, T1-12) — verified in the code, not assumed. **T2-6 is stale too**: the "9 red prompt-registry specs" are green.
>
> **The sweep (T1-3) found more than the audit listed.** Beyond the five named modules, four more had no ownership check at all: `vendor-agent` (14 ops — the worst of them, since driving the agent against a victim shop creates products, sets inventory and spends their AI quota), `notifications`, `staff-notifications` and `store-notices`. All closed. **~24 resolvers with public storefront reads still need per-operation triage** — see the new backlog item in [TODO.md](TODO.md); they were deliberately not swept in bulk, because adding the guard to a genuine storefront read breaks the shop.
>
> Also found and closed while working, not in the original list: **`suggestAttachmentAlt` was an SSRF primitive** (a client-supplied `url` reaching a bare `fetch()`), and the whole `attachments` resolver had **no `PermissionsGuard` at all**, so any signed-in account could browse any shop's media library.

| # | Task | Owner | Why it ranks here |
|---|---|---|---|
| ~~T1-1~~ | **DONE 2026-08-12.** ~~Close the remaining Tier-3 cross-tenant IDOR~~ — `coupons` create/update/delete + performance/stats, `inventory-transfers` (15 ops), `digital-files` create/delete, `attachments` list/usage/suggestAlt, `flash-sales.createFlashSale` | `BE · coupons` `BE · inventory` `BE · attachments` | Tiers 1 and 2 are fixed; these are the resolvers still admitting any vendor into any shop via a forged `X-SHOP`. Scoping by `shop_id` is **not** a mitigation — the guard derives it from the attacker's own header. |
| ~~T1-2~~ | **STALE — already fixed.** ~~Add `ShopOwnershipGuard` to the `ai/image` resolvers~~ | `BE · ai/image` | Vendor A with `X-SHOP: victim-slug` reads the victim's prompts, params, cost and result URLs, cancels their paid generations, spends their monthly quota, and injects attacker-prompted images into their media library. |
| ~~T1-3~~ | **DONE 2026-08-12 — see the status note above.** ~~Sweep the rest of the repo for the same IDOR~~ — `coupons`/`collections`/`inventory` have zero `owner_id` references and no ownership guard | `BE · platform` | 62 resolvers use `ShopHeaderGuard`, only 9 use `ShopOwnershipGuard`. Do the sweep before fixing case-by-case: a platform-wide result turns six decorators into one shared pattern. |
| ~~T1-4~~ | **DONE 2026-08-12** — shared walker in `src/common/testing/guard-chain.ts`, 8 module specs (193 tests), plus a spec for the walker itself so it cannot pass vacuously. ~~Add the guard-chain prototype-walk spec~~ (`image-gen.resolver.spec.ts` is the template) | `BE · platform` + tests | The only durable fix — a missing guard is invisible in review, and the walk fails on the commit that adds an unguarded operation rather than in the next audit. |
| ~~T1-5~~ | **STALE — already fixed** by `trueUpCost`/`reservedCostFor`; only the misleading comment remained, now corrected. ~~Budget ledger double-books every image success~~ — flat 4c reservation, then the full model cost added on top with `increment` | `BE · ai/budget` | `ai_usage` is one global row shared by chat/content/embed, so image over-booking makes **every AI feature platform-wide** throw `AI_BUDGET_EXCEEDED` at ~60% of real spend and fires critical alerts. |
| ~~T1-6~~ | **DONE 2026-08-12** — new `vision` feature key on the limiter + budget, enforced before the fetch; the SSRF hole found alongside it is closed by reusing the hardened fetcher. ~~`alt-text.service.ts` has no rate limit~~ — guarded by `JwtAuthGuard` alone | `BE · ai` · `BE · attachments` | Any logged-in account can burn OpenRouter credit by repetition. Fix alongside the vision metering in the LLM art-director Stage 4. |
| ~~T1-7~~ | **DONE 2026-08-12** — the SDK's `validateWebhook` was verified at source to do neither; replaced with `verifyReplicateSignature` (±5 min window, `timingSafeEqual`, no early break). 26 tests. Dedup stays with T2-1. ~~Replicate webhook~~ | `BE · ai/image` | A captured header triple + body stays valid forever (Svix enforces ±5 min). There is no test that a valid signature passes or that a tampered body fails. |
| ~~T1-8~~ | **DONE 2026-08-12** — the regex layer is escalate-only now and can never return a "safe" verdict. ~~Moderation is short-circuited by 11 repeated characters~~ — `quickCheck()` returns on any flag, and a low-only flag yields `is_safe: true` without ever invoking the LLM | `BE · ai/moderation` | A trivially-craftable string bypasses moderation entirely. Fix: make `quickCheck` escalate-only. |
| ~~T1-9~~ | **DONE 2026-08-12** — `isEnabled()` + boot warning, ERROR-level logs, and a `degraded` flag; a configured-but-silent moderator now fails **closed**. ~~Moderation fails open~~ — with only a WARN | `BE · ai/moderation` | The degradation is invisible: no `isEnabled()`, no alert, no boot warning. A 429 silently disables safety. |
| ~~T1-10~~ | **STALE — already fixed**; both community models carry a pinned version hash. ~~Community model runs unpinned~~ — `851-labs/background-remover` ships no `version` | `BE · ai/image` | Every `BACKGROUND_REMOVE` call resolves whatever a third-party account pushed most recently: an unreviewed supply-chain input on a paid path. |
| ~~T1-11~~ | **DONE 2026-08-12** — server-side `assertDevOnly()` via a route `layout.tsx`, applied to `/simple` and `/sentry-example-page` too. ~~Gate or delete `/pixel-demo`~~ in `apps/vendor` — deliberately outside `proxy.ts`'s matcher | `VEN` | An unauthenticated route shipping to production. One line (`NODE_ENV !== "production"`) or one delete. |
| ~~T1-12~~ | **STALE — already fixed**: `AbortSignal.timeout`, a `Content-Length` pre-check before allocating, per-hop address vetting and magic-byte sniffing are all present. ~~`fetchRemoteImage`~~ — re-verify against HEAD, the SSRF half was fixed 2026-07-26 by `remote-image.guard.ts` | `BE · attachments` | The SSRF primitive is closed; the resource-exhaustion half (buffer-then-check, no `AbortSignal`) may still stand. Confirm before scheduling. |
| T1-13 | **Verify SMS actually delivers on the target market's numbers, end to end** | `INFRA` · `BE · otp` | The gateway config is untested for signup traffic. The wizard is unusable if the code never arrives — and SMS is the fallback for T0-6. |

---

## T2 — Reliability, data integrity and CI trust · استقرار وسلامة البيانات

Nothing here has an attacker, but each one silently loses money, loses data, or makes a green build a lie.

> **Status 2026-08-12 — 11 of 24 closed, 5 are INFRA-only, 4 remain.** Back-end **224 suites / 3686 tests** green, `nest build`, `check:di` and `schema:check` clean; `apps/vendor` typecheck clean with 424 tests.
>
> **T2-1, T2-2 and T2-3 were already fixed** (verified in the code) — which **unblocks T2-4**: `REPLICATE_WEBHOOK_URL` can now be set in production. The `@@unique` backstop T2-1 proposed was deliberately skipped: `ingestBytes` mints a fresh UUID per call, so it could never fire on the race it was meant to catch.
>
> **Done this pass:** T2-7 (heap raised in both apps' `typecheck`, and CI runs typecheck/test/build as separate steps), T2-8 (`scripts/smoke-routes.mjs` + a CI matrix that boots each built app and asserts no 5xx on every authed route), T2-9 (new `.github/workflows/ci.yml` — the repo had **no CI at all** — with `check:di`, `schema:check`, and `check:drift` against a scratch Postgres), T2-11, T2-13, T2-15, T2-17, T2-19.
>
> **T2-17 flushed out a real wiring bug that only `check:di` catches:** `JwtAuthGuard` is provided by both `AuthModule` and `RolePermissionsModule`, so giving it a dependency broke the graph while `nest build` and every unit test stayed green. Fixed with a leaf `TokenRevocationModule`.
>
> **Still open:** T2-5 (output-image moderation), T2-16 (a decision blocked on delivery working), T2-18 (integration key rotation), T2-20/T2-21 (OTP delivery reporting). **INFRA-only:** T2-4, T2-14, T2-22, T2-23, T2-24.


| # | Task | Owner | Why it ranks here |
|---|---|---|---|
| ~~T2-1~~ | ~~**`applyPrediction` idempotency is a read-then-write across a multi-second ingest**~~ — **STALE, already fixed** | `BE · ai/image` | Verified 2026-08-12: the terminal transition is claimed inside a transaction (`updateMany` on a non-terminal status) and the loser discards its orphan ingests. The proposed `@@unique([generation_id, attachment_id])` backstop was deliberately skipped — `ingestBytes` mints a fresh UUID per call, so it could never fire on this race. |
| ~~T2-2~~ | ~~**Persist the prediction id unconditionally before the status flip**~~ — **STALE, already fixed** | `BE · ai/image` | Verified 2026-08-12: the processor calls `claimForRun` *before* the provider, and `attachPrediction` is gated on "not terminal" rather than QUEUED. |
| ~~T2-3~~ | ~~**A transient storage failure permanently marks a paid success FAILED**~~ — **STALE, already fixed** | `BE · ai/image` | Verified 2026-08-12: zero successful ingests now **throws** rather than writing FAILED, so the webhook returns non-2xx and Replicate re-delivers; the reconcile sweep is the backstop. |
| T2-4 | **Set `REPLICATE_WEBHOOK_URL` to the public API base in prod** — **UNBLOCKED 2026-08-12** | `INFRA` | The three fixes above are all in place, so the poll fallback is no longer hiding anything. This is now a plain INFRA action. |
| ~~T2-5~~ | ~~**Output-image moderation**~~ — **BUILT 2026-08-12, env-gated off** | `BE · ai/image` | `ImageModerationService` + `applyPrediction` wiring; all-refused ends `MODERATED_OUT` terminally, degraded classifier keeps product photos but drops `on_model` outputs. Enable via `AI_IMAGE_OUTPUT_MODERATION_ENABLED`. The on_model flag still ALSO needs its catalogue eval. |
| ~~T2-6~~ | ~~**`ai/image` prompt-registry specs are red at HEAD**~~ — **STALE, verified green 2026-08-12** | `BE · ai/image` | All 339 `src/ai` tests pass; the `custom` style and the specs that enumerate it agree. |
| ~~T2-7~~ | ~~**`apps/vendor` typecheck OOMs, and Vitest silently drops a test file**~~ — **DONE 2026-08-12** | `CI` · `VEN` | Both apps' `typecheck` scripts now run tsc under `--max-old-space-size=12288`, and CI keeps typecheck, test and build as **separate steps** so heap pressure from one cannot kill a worker in the next and report a smaller green suite. |
| ~~T2-8~~ | ~~**Nothing in CI renders a dynamic route**~~ — **DONE 2026-08-12** | `CI` | New `scripts/smoke-routes.mjs` boots each built app and requests every authed route with a stub cookie, failing on any 5xx. A 200 and a 307-to-login both pass — it tests rendering, not auth. Runs as a CI matrix over vendor and admin. |
| ~~T2-9~~ | ~~**Add `check:drift` and `check:di` to CI**~~ — **DONE 2026-08-12** | `CI` · `BE` | The repo had **no CI at all**. New `.github/workflows/ci.yml`: `check:di` and `schema:check` first (no database), then the unit suite, then `db push` + all three seeds + `check:drift` against a scratch Postgres service. |
| T2-10 | **Adopt a real `prisma migrate` history** — baseline, `migrate resolve --applied` per database, switch the build to `migrate deploy` | `BE · prisma` | The root fragility behind T0-9 and T0-10: no migration history at all, only `db push` plus 60+ hand-written patches with no record of which landed where. |
| ~~T2-11~~ | ~~**Add a real migration for the entitlements billing columns**~~ — **DONE 2026-08-12** | `BE · plans` | `prisma/migrations/manual/2026-08-12-entitlements-billing-columns.sql` — all four columns plus the `pending_plan_id` FK and index, idempotent and safe to run after `db push`. |
| T2-12 | **Attachment URLs are stored absolute** — `.env.development`'s `STORAGE_DRIVER="local"` wins over `.env`'s `bunnycdn`, so locally-uploaded rows are dead images on the live server | `BE · attachments` · `INFRA` | **Code half done 2026-08-13 — no longer silent.** `StorageFactory` logs an `error` at boot when local storage meets a remote `DATABASE_URL`, and when `bunnycdn` has an empty pull zone (`https:///…`, no host). Repair script: `npm run rebase:urls -- --from <base> --to <base>`, dry-run by default, one transaction over the `attachments` rows and all 27 reference columns; moves no bytes. **Still open (INFRA):** decide whether dev writes to Bunny, and run the rebase per database. Read-time resolution is deliberately *not* the fix — the URL is copied into ~27 columns, so that is T3-7. |
| ~~T2-13~~ | ~~**`images.remotePatterns` allows only `placehold.co`**~~ — **DONE 2026-08-12** | `VEN` | `*.b-cdn.net` added, wildcarded because the zone name differs per environment. |
| T2-14 | **Enable CORS on the Bunny staging pull zone (`artam-staging.b-cdn.net`)** | `INFRA` | No `Access-Control-Allow-Origin`, so the image editor's `fetch(…, {mode:"cors"})` fails and pixel edits cannot be exported. |
| ~~T2-15~~ | ~~**The public `shops` listing filters on `is_approved` but not `is_active`**~~ — **DONE 2026-08-12** | `BE · shops` | Decided in favour of requiring both, and applied to `shop(slug)` as well — hiding a suspended shop from the directory while still serving it by direct link is the half-fix. Owner and admin reads unchanged, so a vendor can still preview. 2 new tests. |
| T2-16 | **`revealOtpCode` is a support tool, not a permanent one** — decide to keep, env-gate, or drop once delivery works | `BE · otp` | A `super_admin` can recompute any live code. Justified only while T0-6 blocks delivery. Review the `audit_logs` `entity: 'otp'` / `action: ACCESS` list before deciding. |
| ~~T2-17~~ | ~~**A suspension does not close an open tab for up to an hour**~~ — **DONE 2026-08-12** | `BE · auth` · `BE · users` | New `TokenRevocationService`: one Redis watermark per user, written by the same seam that revokes refresh tokens, checked by `JwtAuthGuard` against the token's `iat`. Fails **open** on a Redis outage by design. 20 tests. |
| ~~T2-18~~ | ~~**No key rotation path for integration secrets**~~ — **DONE 2026-08-12** | `BE · integrations` | `SECRETS_ENCRYPTION_KEY_PREVIOUS` + decrypt fallback + a boot-time `SecretRotationService` that re-encrypts every row and says when the window can close. Also softens ordering constraint #1: rotating `APP_SECRET` first is now recoverable. |
| ~~T2-19~~ | ~~**X-SHOP-aware Apollo cache keying**~~ — **DONE 2026-08-12** | `VEN` | New `ShopCacheBoundary` clears the Apollo cache when the active shop changes. Chosen over per-field `keyArgs`: that needs every shop-scoped root field enumerated forever, and forgetting one fails silently and looks exactly like the bug. |
| ~~T2-20~~ | ~~**The signup OTP send is fire-and-forget**~~ — **DONE 2026-08-12** | `BE · vendor-signup` | Decision made: the send stays async (its rationale holds), the OUTCOME is written to the `otps` row from the email worker / SMS caller. The truth lives in the admin log, where a complaint gets chased. |
| ~~T2-21~~ | ~~**The OTP log shows what was *issued*, not what was *delivered***~~ — **DONE 2026-08-12** | `BE · otp` · `ADM` | `delivered_at`/`delivery_error` on the row, surfaced on `otpLogs` and as a Delivery column in the admin screen (en/ar). Migration `2026-08-12-otp-delivery-outcome.sql`. |
| T2-22 | **Live end-to-end check of the trial-ending path on a fresh trial** | `BE · plans` · `INFRA` | Stripe's side is proven and the service is unit-tested, but the two have never run together on a real trialing subscription. Money path. |
| T2-23 | **Existing files stored as `.bin` keep the wrong `Content-Type`** on the CDN | `INFRA` · `BE · attachments` | The upload fix applies to new uploads only. Historical files need a re-upload or a one-off migration to render or edit. |
| T2-24 | **Decide whether `plan: free` is right for the API** — port 25 stays blocked even on paid instances, and free spins down when idle | `INFRA` | The blocked-port class of failure that already cost one debugging cycle. |

---

## T3 — Missing pillars · فجوات منتج أساسية

The product works; these are the places where it is visibly incomplete for a real merchant.

| # | Task | Owner | Why it ranks here |
|---|---|---|---|
| ~~T3-1~~ | ~~`npm run lint` is red~~ — **DONE 2026-08-14. 0 errors, and it gates CI.** | `CI` · `VEN` · `UI` · `ADM` | The real count was 88, not 57 (80 `apps/vendor`, 8 `packages/ui`; `apps/admin` was already clean). Fixed, not silenced: `set-state-in-effect` → adjust-state-during-render, `refs` → the value moved into state, `purity` → `Date.now()` anchored (on `usage-page` it was an Apollo variable changing identity every render, so the cache could never serve the window). Two boundaries are declared exemptions with written reasons — the upstream Tiptap scaffold (path list in `apps/vendor/eslint.config.mjs`) and `any` in test doubles. `Lint` is now a step in the frontend CI job. |
| T3-2 | **Surface the back-end domains with no vendor UI** — disputes, withdrawals/balance/payouts, shipping-zones + tax-classes editors, flash sales, CMS (`/content` 404), staff accounts, reviews/Q&A moderation — and remove or build the 4 dead nav links | `VEN` | The single biggest parity lever in the audit: built and paid-for back-end capability a merchant cannot reach. |
| T3-3 | **Server-side pagination/search on orders and customers** — both cap at 50 rows and filter client-side | `VEN` · `BE · orders` | The list stops being correct at the 51st row. Affects the two screens a merchant lives in. |
| T3-4 | **Per-shop currency** — hardcoded `SAR` in `shared/lib/format.ts:23` | `VEN` · `BE · shops` | Every money figure in the dashboard is wrong for any shop not in SAR. |
| T3-5 | **Finish Arabic i18n** — vendor at ~7%, the Files browse surface (12 components) still English, and back-end AI-image errors are hardcoded English template literals | `VEN` · `BE · ai/image` | Arabic-first market. An Arabic vendor currently gets English rejections with the numbers that matter (`used/cap`) embedded in them. |
| T3-6 | **Front-end tests — ~1% coverage** — RTL for the contextual save bar, data-table, order/product forms, bulk editor; then a coverage gate | `VEN` | The save bar is mandatory on every edit screen and has no test. Nothing else on this list is safe to refactor without it. |
| T3-7 | **Reference media by `attachment_id`, not URL** — resolve `original`/`thumbnail` from the `attachments` row at read time | `BE · attachments` · `BE · platform` | The real fix behind the replace-sweep workaround and T2-12. Cross-cutting (~20 modules + storefront) — **do it before the catalogue gets large**, the cost only grows. |
| T3-8 | **Order editing pipeline** — stage line changes, recompute totals/tax in cents, capture/refund the delta | `BE · orders` · `VEN` | Named pillar, Orders scored 58. A merchant cannot correct an order today. |
| T3-9 | **Vendor Returns/Refunds UI** — queue, approve/reject with per-line restock, refund breakdown, policy editor | `VEN` · `BE · returns` | Returns scored 54. The back-end exists; the merchant has no screen. |
| T3-10 | **Staff accounts — `ShopMembership`** + invite/accept/revoke, permissions per membership, central `ShopAccessGuard`, 2FA/TOTP, `permissions_version` claim | `BE · auth` · `BE · shops` | Auth scored 61, and it is the hard blocker on the entitlements `staff.accounts` capability. Also the correct home for the T1-1…T1-4 ownership pattern. |
| T3-11 | **Customer record — promote email/first_name/last_name/language/address to first-class columns** off the opaque JSON; expose `total_spent`/`orders_count`/`last_order_at` + order timeline | `BE · customers` · `VEN` | Customers scored 58. Every customer-facing feature downstream is limited by the JSON blob. |
| T3-12 | **Stripe Connect, phases 1–4** — provider abstraction, onboarding, destination charges + `application_fee`, payouts/refunds/disputes | `BE · payments` | Payments scored 58 and today the platform is the merchant of record for every shop. ⚠ **Validate Stripe Connect SAR availability in KSA before phase 2.** |
| T3-13 | **Storefront ownership decision** — own it (Theme/Section/Template + draft/publish/preview) or formally retire the orphaned NestJS content path | `BE · content` · `DOCS` | Content scored 31, and this one decision gates URL redirects, page scheduling, and all SEO work below it. Decide before building any of them. |
| T3-14 | **Money-boundary unification, part 2** — analytics aggregates then product prices to integer cents | `BE · analytics` · `BE · products` | The last `Float` money surfaces. Analytics is read-only and low-risk — do it first; product prices are coupled to the live Laravel storefront and need a coordinated change. |
| T3-15 | **Disputes have no admin action at all** — read-only queries, no mutation resolves or rules on one | `BE · disputes` · `ADM` | A disputes screen is a dead-end viewer until a mutation exists. Money path with a deadline. |
| ~~T3-16~~ | ~~**`cost_cents` is only ever written by the image path**~~ — **DONE 2026-08-12** (needs one live-key verification) | `BE · vendor-agent` | Per-turn `UsageTracker` on every LLM call incl. the summarizer; `settleTurn` commits `cost_cents` + token counts. OpenRouter's `usage.cost` is untested live from this codebase — if absent, rows read 0 with tokens as evidence, never a guess. |
| T3-17 | **Arabic text on a social post needs a composited overlay (`sharp`), not the diffusion model** | `BE · ai/image` | FLUX emits disconnected pseudo-glyphs for cursive RTL — a hard model limit. For an Arabic-first vendor base this is the real gap, and it pairs with the deterministic-canvas work. |
| ~~T3-18~~ | ~~**Sidekick has no output-side moderation**~~ — **DONE 2026-08-12, env-gated off** | `BE · vendor-agent` | `moderateReply` on both persist sites behind `AGENT_OUTPUT_MODERATION_ENABLED`. Uses the new `skipQuickScan` (the regex layer calls every URL spam, and links are half the agent's job) and keeps the reply on a degraded verdict. Protects the persisted transcript — streaming has already shown the text. |
| ~~T3-19~~ | ~~**`AiImagePanel` polls forever / abandoned enhance runs never canceled**~~ — **DONE 2026-08-12** | `VEN` | The panel now caps at the same `MAX_POLLS = 60`. The cancel half was **stale**: `use-enhance-file` already cancels on timeout, and not-cancelling on unmount is a documented decision (a landing run must not be destroyed by navigation). |
| T3-20 | **Walk the newly-shipped entry screens in a browser** — OTP panes, RTL, reduced motion, admin tables' RTL and hover row menus | `VEN` · `ADM` · `UI` | Four consecutive UI ships were verified by `typecheck` and build only. RTL is unverified on every one of them, and this platform is bilingual. |
| ~~T3-21~~ | ~~**`api/ai-image.md` documents five error codes that never appear in `extensions.error_code`**~~ — **DONE 2026-08-12** | `DOCS` | Channel column (top-level `error_code` vs `validation_errors[].code`), a wire-format example of a quota refusal, and the branch-on-code rule up front. |
| T3-22 | **Analytics phase 2 remainder** — `SalesDailyRollup` + 1-min refresher, and the Live View order/revenue half | `BE · analytics` | The dashboards stay slow at scale without the rollup; everything else in phase 2 has shipped. |
| ~~T3-23~~ | ~~**a role change silently drops hand-granted permissions**~~ — **the silence fixed 2026-08-12**; per-user permission *editing* remains open | `BE · users` · `ADM` | The audit entry now names `permissions_dropped_by_role_change`, so the loss is visible and recoverable. The replacement itself is deliberate — a demotion must demote. |

---

## T4 — Feature follow-ups and polish · تحسينات

| # | Task | Owner |
|---|---|---|
| T4-1 | Shop-timezone day boundaries for the analytics date filter (presets and custom range snap to browser-local midnight, back-end buckets in shop tz) | `VEN` · `BE · analytics` |
| T4-2 | `attachmentUsage` under-reports — scans only `products.image`/`gallery`, capped at 1000 rows; rebuild on `ATTACHMENT_URL_REFERENCES` | `BE · attachments` |
| T4-3 | No `adminUpdateShop` — the shop console has no Edit action; decide between a new admin input or reusing `updateShop` | `BE · shops` · `ADM` |
| T4-4 | `deleteShop` is slug-keyed and singular while `setShopsActive`/`restoreShops` are id-keyed and bulk — align before more callers appear | `BE · shops` |
| ~~T4-5~~ | ~~Bulk row selection for shops and users~~ — **DONE.** Multi-row selection bar with batch mutations | `ADM` |
| ~~T4-6~~ | ~~No "send password reset" action for an operator~~ — **DONE.** Password reset trigger on behalf of locked-out accounts | `ADM` · `BE · users` |
| ~~T4-7~~ | ~~`otps` rows are never pruned~~ — **DONE 2026-08-13, and the premise was inverted.** They were pruned hourly *at expiry*, with a 5-minute TTL — so the admin log held ~1h of history and the delivery columns from T2-21 were hollow. Now two windows: hash shredded at expiry (`code_hash` nullable), row deleted at 14 days | `BE · otp` |
| ~~T4-8~~ | ~~`usage_events` has no retention policy~~ — **DONE 2026-08-13.** A window, not a rollup: `prune-old-usage-events` nightly at 04:35, 180 days, `ctid` batches. `usage_counters` holds the settled totals a bill is computed from and is untouched | `BE · plans` |
| ~~T4-9~~ | ~~No platform-wide usage screen~~ — **DONE.** Platform analytics dashboard with resource consumption and provider costs | `ADM` |
| ~~T4-10~~ | ~~Admin surface with no screen~~ — **DONE.** Moderation and governance screens for abusive reports, seller onboarding (`becameSellerRequests`), and security audit anomalies (`auditAnomalies`) | `ADM` |
| T4-11 | Live availability check on the store link before submit — a taken slug is silently resolved to `my-store-1` after the fact | `VEN` |
| T4-12 | Notifications: `MESSAGE` and `SYSTEM` have no producer — nothing fires for contact messages or platform notices | `BE · notify-logs` |
| T4-13 | Notifications event catalog — revisit `back_in_stock` migration and the account templates if auth moves to link-based flows | `BE · notifications` |
| T4-14 | Staff notifications P3 remainder — order summary digest (daily/weekly), fulfillment request template, per-event checkboxes, merchant-editable staff template | `BE · staff-notifications` · `VEN` |
| T4-15 | Sidekick: no mid-tool progress channel — slow tools show a spinner with no progress; needs a per-tool progress contract in the card | `BE · vendor-agent` · `VEN` |
| T4-16 | Multi-source studio runs — `referenceAttachmentIds[]` (flux-2-pro accepts up to 8 `input_images`); unblocks product/character consistency | `BE · ai/image` · `VEN` |
| T4-17 | Text-to-image tab in AI Studio — needs its own prompt vocabulary and a `requestId` for idempotency | `VEN` · `BE · ai/image` |
| T4-18 | Deterministic square canvas for product images — background-remove → trim to alpha bbox → pad to square, server-side with `sharp` | `BE · ai/image` |
| ~~T4-19~~ | ~~`negativePrompt` is dead weight~~ — **STALE, already dropped** on 2026-07-27; the DTO carries a comment recording why the column is retained for historic rows | `BE · ai/image` |
| T4-20 | Evaluate an identity-preserving edit model (`nano-banana`, `qwen-image-edit`) — price it first, changing the `EDIT` default moves per-image cost | `BE · ai/image` |
| T4-21 | Model view (`on_model`) — **run the eval** on 15–20 catalog images before touching the flag; below ~70% keep, delete the shot | `BE · ai/image` |
| T4-22 | Persist the terminal disposition the vendor already gives (Replace / Keep both / Discard) — outcome telemetry cannot be backfilled | `BE · ai/image` · `VEN` |
| T4-23 | Review-oriented regexes hard-block legitimate prompts containing a URL, email, or 10+ digit run — the verdict says `flag_for_review`, the caller reads only `is_safe` | `BE · ai/moderation` |
| ~~T4-24~~ | ~~Negative `limit` bypasses the 60-row cap~~ — **STALE, already fixed**: the call site clamps both ends (`Math.min(Math.max(trunc(take) || 30, 1), 60)`); the api doc wording was the only stale part and is corrected | `BE · ai/image` |
| T4-25 | "Replace original" round-trips a multi-MB image through the browser, and passes the original's filename so a WebP/PNG lands at a `.jpg` path | `VEN` · `BE · attachments` |
| T4-26 | `super_admin` without `X-SHOP` null-dereferences on `shop.id` in the ai/image ops — fails closed, so error quality, not a leak | `BE · ai/image` |
| T4-27 | Entitlements phase 4 remainder — `catalog.bulk_operations` (needs a contract decision), `staff.accounts` (blocked on T3-10), `ai.text.*`/`ai.catalog.*`/`ai.vision.*` (blocked, services not built) | `BE · plans` |
| T4-28 | Multi-location at checkout/fulfillment — make per-location `InventoryLevel.available` the storefront source of truth; + reorder-point/safety-stock and a low-stock view | `BE · inventory` |
| T4-29 | Merchant-defined namespaced metafields, parallel to category attributes | `BE · products` |
| T4-30 | URL Redirects engine — `UrlRedirect` + storefront lookup + bulk CSV + auto-create on handle change *(gated on T3-13)* | `BE · content` |
| T4-31 | Page draft/published + scheduling + `template_suffix` + SEO meta; filter unpublished from public reads *(gated on T3-13)* | `BE · content` |
| T4-32 | sitemap.xml + editable robots.txt + canonical URLs + JSON-LD, per shop *(gated on T3-13)* | `BE · content` |
| T4-33 | Campaign/broadcast engine — `Campaign` over the BullMQ EMAIL queue, honoring consent | `BE · marketing` |
| T4-34 | Collections — product ordering/sort modes, draft/published state, rule-engine unit tests (zero coverage today) | `BE · collections` |
| T4-35 | Cart — express/wallet checkout (Apple/Google Pay, off-session saved-card charging); implement the documented abandoned-cart cadence | `BE · cart` |
| T4-36 | AI spend ledger — route the vendor agent and the Tiptap editor through one cents-accurate `AiBudgetService`; expose SEO/marketing copy generators in the product form | `BE · ai` |
| T4-37 | Named comparison presets (Previous year / match day of week) + real multi-currency conversion — the dropdown currently maps to a boolean and the currency chip is display-only | `BE · analytics` |
| T4-38 | Shaders have never been compiled on a GPU in CI — one Playwright smoke test asserting a non-blank canvas covers the trackball, the pixel canvas and press-depth at once | `UI` · `CI` |
| T4-39 | `apps/admin` has no component or route tests — auth screens, `proxy.ts`, and the tables are covered only through pure-logic units | `ADM` |
| ~~T4-40~~ | ~~`AuthService › login (edge cases)` flakes under full-suite load~~ — **DONE 2026-08-12**: both tests carry a 30 s timeout with a comment naming the cause; the production cost-12 hash is untouched, which was the point | `BE · auth` |
| T4-41 | Apply the Sentry `MONITORING` enum migration on any hand-patched database (`db push` covers Render) | `INFRA` · `BE · integrations` |
| T4-42 | `STORAGE` and `PAYMENT` integration types have no provider specs — Bunny/S3 is the obvious next; PAYMENT should wait for the per-shop payment work | `BE · integrations` |
| T4-43 | Archive or delete the redundant `osama-gawanah/vendor` GitHub repo so the two copies cannot drift | `INFRA` |
| ~~T4-44~~ | ~~Document local Stripe setup in the runbook~~ — **DONE 2026-08-12**, with the trap that costs the most time: the `whsec_…` from `stripe listen` is a DIFFERENT secret from the dashboard endpoint's, and using the wrong one fails signature verification silently | `DOCS` |
| T4-45 | Reveal refuses codes longer than 6 digits, so OTP code length 7–8 silently disables the button — surface it on the settings screen or cap the setting | `ADM` · `BE · otp` |
| T4-46 | Decide the style catalogue: add **formats** (Minimal, Social Ad, maybe Outdoor), skip category-named styles; `Flat Lay` needs a documented exemption from `IDENTITY_BLOCK` first | `BE · ai/image` |

---

## T5 — Tests, docs, cleanup, perf-later · تنظيف وتوثيق

| # | Task | Owner |
|---|---|---|
| ~~T5-1~~ | ~~Fix the 3 `apps/admin` lint errors~~ — **DONE 2026-08-12; `apps/admin` is now 0 errors.** One was a real bug, not style: `shop-usage` computed its `from` window with `Date.now()` during render, so the Apollo variables changed identity every render and the window could never be served from cache | `ADM` |
| T5-2 | `react-hooks/immutability` still flags `OrbitDriver` (3 errors) — the `useFrame` pattern; revisit if the rule grows an escape hatch | `UI` |
| T5-3 | `role="application"` carries `aria-valuetext`, which the role does not support — decide between a `slider` role pair and a live region | `UI` |
| T5-4 | Ring hover re-reads the bounding box at most every 250 ms — a scroll without a pointer event leaves the hit test stale | `UI` |
| T5-5 | Press-depth has no test coverage — window-level pointer tracking (drag off/back, `pointercancel`, tab hidden) and the `enabled: false` path | `UI` |
| T5-6 | `buttonVariants` string consumers press via `:active`, not the hook — `calendar`'s nav buttons stay latched if dragged off | `UI` |
| T5-7 | `linear()` easing has no fallback (Chrome 113+/Safari 17.2+/Firefox 112+) | `UI` |
| ~~T5-8~~ | ~~`FloatingPaths` is no longer rendered by anything~~ — **DELETED 2026-08-12.** Zero consumers, and not in the package's exports map either, so it was unreachable rather than merely unused | `UI` |
| T5-9 | `PixelField`'s `glyph` prop lost its last consumer — **KEPT, deliberately (2026-08-12).** Unlike `FloatingPaths` it is *reachable*: a documented, tested optional flag (~25 lines, inert by default) on a live component. That is an unused feature, not rot, and whether the auth wall wants a brand mark is a design call rather than a cleanup one | `UI` |
| T5-10 | The pixel wall repaints ~4k cells at 30fps — raise `pixelSize`/`FRAME_MS` or pause on `document.hidden` if a low-end report lands | `UI` |
| T5-11 | Arabic woff2 (1.2 MB, 15 faces) duplicated in both apps' `public/fonts` — move to a shared assets package if a third app appears | `VEN` · `ADM` |
| T5-12 | The vendor settings overlay and the admin integrations screen share a layout with no shared code — lift the rail shell into `@repo/ui` when a third appears | `UI` |
| T5-13 | Admin toolbar extras have no equivalent yet — column visibility, faceted filters, sortable headers (each needs a query variable, not a client row model) | `ADM` |
| T5-14 | No date-range filter and no CSV export on `/otp-logs` | `ADM` |
| T5-15 | `use-notifications-stream.ts` is untested — ticket handshake, `EventSource` lifecycle, cleanup | `VEN` |
| ~~T5-16~~ | ~~`notification-center.tool.ts` emoji map casing~~ — **DONE 2026-08-12**, plus the four missing enum members | `BE · chat` |
| T5-17 | Push/web-push notification channel (email channel is done) | `BE · notify-logs` |
| T5-18 | Missing `image-gen.controller.spec.ts`; `applyPrediction` has no partial-ingest case and no `budget.trackCall` assertion | `BE · ai/image` |
| ~~T5-19~~ | ~~`cancel()` treats only SUCCEEDED/FAILED as terminal~~ — **STALE, already fixed**: it claims the row with an `updateMany` guarded on `QUEUED`/`RUNNING` *before* calling the provider, which closes the re-stamp and the read-then-write race together | `BE · ai/image` |
| T5-20 | Move the attachment replace sweep to a background job if it gets slow — 27 sequential scans in a 30 s transaction, no index on any URL column | `BE · attachments` |
| T5-21 | The non-image file detail sheet is local state, not a route — give it `?file=<id>` if it needs to be shared | `VEN` |
| T5-22 | `products_count`/`orders_count` are per-row `_count` aggregates — first thing to look at if the shop list gets slow | `BE · shops` |
| T5-23 | Compaction runs on the full agent model — a smaller model would serve; one-line wiring change behind the factory | `BE · vendor-agent` |
| T5-24 | Approval gating is a flat list, not blast-radius-aware — revisit with usage data; the risk is approval fatigue | `BE · vendor-agent` |
| T5-25 | Abandoning an approval costs an LLM turn — a cheaper settle path would skip the model | `BE · vendor-agent` |
| T5-26 | Canvas open items — no node-position persistence, no minimap, no re-run from the canvas | `VEN` |
| T5-27 | `thumbnail` on `EnhanceStyleEntry` — style cards are text-only. Do **not** add `category` | `BE · ai/image` |
| T5-28 | Prefill the prompt textarea client-side from form state as an editable suggestion | `VEN` |
| T5-29 | Advisory (never blocking) drift score — one vision call, nullable score, surfaced as "check the logo carefully" | `BE · ai/image` |
| T5-30 | Enhance Studio: Standard / Pro-HD quality tier (pair with T4-20), batch enhance from multi-select | `BE · ai/image` · `VEN` |
| T5-31 | `sentry.helper.ts` builds the envelope by hand rather than through a second `NodeClient` — revisit if anything else sends to a non-installed DSN | `BE · integrations` |
| T5-32 | Consider whether a future browser-side Sentry in the vendor app should read the same integration row | `VEN` · `BE · integrations` |
| T5-33 | Integration save-time verification is a live third-party call inside a mutation (10 s ceiling) — verify asynchronously if a provider outage ever makes saving slow | `BE · integrations` |
| T5-34 | Backfill `plans.stripe_product_id` — harmless (the next call fills it), but a seed pass would make the column true everywhere | `BE · plans` |
| T5-35 | Backfill `shops.trial_used_at` — no longer blocks anything (eligibility is derived from `trial_ends_at`); worth one pass only if the column is wanted as a record | `BE · plans` |
| T5-36 | Consider paginating `myInvoices` — one Stripe page, no cursor | `BE · plans` |
| ~~T5-37~~ | ~~Clean up the unused client-side `register` path~~ — **DONE 2026-08-12.** Mutation, schema, inferred type and response interface removed; codegen regenerated so the operation is gone from the generated documents too. The back-end `register` operation is untouched | `VEN` |
| T5-38 | Per-bucket `NET_PROFIT` pacing line; `Target.filter_json` scoping (needs line-level measures); `anchor`/past-period targets in the FE | `BE · analytics` · `VEN` |
| T5-39 | Enable Turborepo Remote Caching (`turbo login && turbo link`) | `CI` |
| T5-40 | Consider a shared `packages/api-client` once admin and vendor operations overlap | `VEN` · `ADM` |
| T5-41 | **Docs:** `back-end/docs/features/ai-image.md` is 422 lines against a ~110-line limit — split the decision log out, do not delete it | `DOCS` |
| T5-42 | **Docs:** `ai-image.md:150-152` claims the ledger "trues-up" cost; it adds on top of the reservation | `DOCS` |
| ~~T5-43~~ | ~~**Docs:** `limit` documented as "≤ 60"~~ — **DONE 2026-08-12**: now reads "clamped to 1–60 at BOTH ends", which is what the code does | `DOCS` |
| ~~T5-44~~ | ~~**Docs:** four stale comments~~ — **DONE 2026-08-12**: `ai-budget.service.ts` (2026-08-12, earlier pass), `image-gen.controller.ts` (the poll fallback does NOT cover a dropped webhook — the reconcile sweep does) and `schema.prisma` (the unique column is the correlation key; the conditional status claim is what makes a replay a no-op, unlike Stripe's claim-before-side-effects) | `DOCS` |
| T5-45 | **Docs:** mark `docs/future-features/extra-shots.md` Status — it still reads "Not yet implemented (plan only)" after phase 1 shipped | `DOCS` |
| T5-46 | **Docs:** update analytics / report-builder / targets overviews + `api/*` and bump Last updated | `DOCS` |
| T5-47 | Marketing automation / Flow engine; loyalty earn-redeem; referral program | `BE · marketing` |
| T5-48 | App/extension platform — `OAuthApp` + `AppInstallation` + `AccessScope`, bulk-operations API, cursor pagination, versioned Admin API | `BE · platform` |

---

## Blocked or deferred — قرارات مطلوبة منك

These are not ranked because they wait on a decision or on external work, not on capacity.

| Item | Owner | Waiting on |
|---|---|---|
| **Overage billing** — `overage_allowed` / `overage_price_cents` on `PlanEntitlement` | `BE · plans` | Deferred by you. Needs Stripe metered pricing alongside the flat subscription. |
| **Stripe Connect phase 6** — MyFatoorah / Moyasar / Tap / HyperPay / Tabby / Tamara | `BE · payments` | T3-12 phases 1–4 first. |
| **Stripe Connect SAR availability in KSA** | `INFRA` | A factual check with Stripe. **Blocks T3-12 phase 2.** |
| **AE-P2 attribution — multi-touch, `TouchPoint`, connector imports** | `BE · analytics` | The Session/Visit event pipeline (analytics phase 3). `conversion_rate_bps` stays null until then. |
| **Analytics phase 3 — storefront event pipeline** | `BE · analytics` | Instrumenting the separate storefront. ~half of Shopify's overview is out of reach until it lands. |
| **Arabic text on the image, model choice** | `BE · ai/image` | Deferred by you (item #10 of the AI Studio plan). T3-17 is the same gap from the build side. |
| **B2B — Company / PriceList / PaymentTerms** | `BE · customers` | A scope decision: build it, or formally mark it out-of-scope so it stops counting against parity. |
| **Social sign-up (Google/Apple/GitHub buttons)** | `VEN` · `ADM` · `UI` | No OAuth back-end. Add the buttons with the provider work, not before. |
| **Explanatory insight detectors** — `refund_spike` / `margin_erosion` / `conversion_drop` / `attribution_win`, `explanation`/`see_why` deep links, `dedup_hash` | `BE · analytics` | Deferred within the insights work. |

---

## Stale — verify and close · بنود قديمة

Checked against the tree on 2026-08-11. These read as open in `TODO.md` but appear already done — confirm and check them off rather than scheduling them.

| Item in TODO.md | Finding |
|---|---|
| **"Vercel + the AI-panel prod-build blocker"** — `ai-chat-panel.tsx` imports `MESH_HALO_COLORS`/`MESH_HALO_MASK` and renders an unimported `<MeshGradient>` | No match for `MESH_HALO_COLORS`, `MESH_HALO_MASK` or `MeshGradient` anywhere in `apps/vendor/src`; `composer-halo.ts` exports only `COMPOSER_GRADIENT_COLORS`. The named cause is gone — re-run the production build to confirm, then close. |
| **"`/users` has no pagination at all — hardcoded `page: 1, limit: 25`"** | [api.ts](apps/admin/src/features/users/api.ts) selects `meta { page limit total_pages }` and [users-table.tsx:365](apps/admin/src/features/users/components/users-table.tsx#L365) renders `DataTablePagination` with `setPage`. Already built. |
| **"Users: admins cannot act on an account"** (2026-07-10 audit) | Superseded by the 2026-08-10 ship — `createUser`, `adminUpdateUser`, `setUsersActive`, `restoreUsers` all exist with the three privilege guards. |
| **"Activate the proactive AI insight engine — built but never runs"** (Road to 90+) | The analytics roadmap records "AI Insights resolver DONE 2026-07-07 (surface + tz-gated schedule + currency fix)". One of the two entries is wrong; reconcile them. |
| **"Deployment — database schema never applied"** section header | The 2026-08-10 note records 155 public tables on the Neon instance and `OtpPurpose` carrying `SIGNUP`. The *schema* half is stale for that instance; the **seed** (T0-9) and the **migration history** (T2-10) are still genuinely open. |
| **"Draft-order builder has no vendor UI"** | Already noted in TODO.md as wrong — the routes and components exist. Listed here so it is not re-added. |
| **"`otps` rows are never pruned — the log grows forever"** (T4-7) | **Inverted, and the real defect was the opposite one.** `cleanup-expired-otps` ran hourly and deleted every row past `expires_at`; the code TTL is five minutes. So the table was not growing — the admin log was being emptied, which silently hollowed out the `delivered_at`/`delivery_error` columns shipped the day before for exactly the complaint that arrives hours later. Fixed 2026-08-13 rather than closed: hash shredded at expiry, row kept 14 days. Worth reading as a warning about audit items whose premise nobody re-checked against the scheduler. |

---

## Rejected — do not build

Kept so they are not proposed again. Full reasoning is in `TODO.md`.

- **Vendor-editable or DB-stored enhance presets** — `enhance()` skips moderation *solely because* the prompt is a compile-time constant, and the worst-case composed prompt is already 1940 of 2000 chars.
- **A server-side product analyzer feeding product DB fields into the prompt** — `productId` is never ownership-validated, which turns a mislabel into a disclosure oracle. (An analyzer reading *the uploaded image itself* is a different thing and is not rejected.)
- **Making `productId` required per mode** — the media library has no product context.
- **A `regenerate(variation)` mutation** — regenerate already ships on both surfaces and the fixed composition order has no slot for a variation clause.
- **`rateAiImageResult`** — `selected` is still write-only; add the read path before adding a second signal.
- **Real-time SSE progress for AI image (#18)** — rejected by your own call; the 60-tick cap bounds the damage.
- **Adding `category` to `EnhanceStyleEntry`** — categorising four styles is premature.

---

## Appendix — index by owner · فهرس حسب الفيتشر

Every open item above, grouped by what owns it. The tier tag is the priority.

### `SEC` · Secret hygiene
T0-1 rotate chat-pasted secrets · T0-3 Neon password · T0-4 Bunny key · T0-5 Stripe key

### `INFRA` · Render / Vercel / Neon / Bunny / Resend / Twilio / Stripe
T0-2 `SECRETS_ENCRYPTION_KEY` · T0-6 Resend sender · T0-7 sandbox-sender flag · T0-8 Twilio · T0-9 production seed · T0-10 pending migrations · T0-11 which Neon is prod · T0-12 Vercel root dir · T1-13 SMS delivery check · T2-4 `REPLICATE_WEBHOOK_URL` · T2-12 storage driver · T2-14 Bunny CORS · T2-23 `.bin` Content-Type · T2-24 Render plan · T4-41 Sentry enum migration · T4-43 archive old repo

### `CI` · repo tooling
T2-7 heap / silent test drop · T2-8 dynamic-route smoke · T2-9 `check:drift` + `check:di` · T3-1 lint red · T4-38 GPU shader smoke · T5-39 remote caching

### `BE · ai/image`
T1-2 ownership guard · T1-7 webhook replay · T1-10 unpinned model · T2-1 idempotency · T2-2 prediction id · T2-3 FAILED on transient error · T2-5 output moderation · T2-6 red specs · T3-17 Arabic overlay · T3-19 polling + cancel · T4-16 multi-source · T4-17 text-to-image · T4-18 square canvas · T4-19 `negativePrompt` · T4-20 edit model · T4-21 on_model eval · T4-22 disposition telemetry · T4-24 negative limit · T4-26 super_admin null-deref · T4-46 style catalogue · T5-18 missing specs · T5-19 `cancel()` terminal states · T5-27 thumbnail · T5-29 drift score · T5-30 quality tier + batch

### `BE · ai` / `ai/budget` / `ai/moderation`
T1-5 double-booked budget · T1-6 `alt-text` ungated · T1-8 quickCheck short-circuit · T1-9 fails open · T4-23 review regexes · T4-36 unified spend ledger

### `BE · attachments`
T1-12 fetch timeout / size cap · T2-12 absolute URLs · T2-23 `.bin` types · T3-7 reference by id · T4-2 `attachmentUsage` · T4-25 replace round-trip · T5-20 sweep to background

### `BE · platform` (cross-cutting)
T1-3 IDOR sweep · T1-4 guard-chain spec · T3-7 attachment ids · T5-48 app/extension platform

### `BE · auth` / `users` / `shops` / `otp` / `vendor-signup`
T2-15 public listing `is_active` · T2-16 `revealOtpCode` · T2-17 token denylist · T2-20 fire-and-forget OTP · T2-21 issued vs delivered · T3-10 staff accounts · T3-23 per-user permissions · T4-3 `adminUpdateShop` · T4-4 `deleteShop` shape · T4-6 password reset action · ~~T4-7 otp retention~~ · T4-40 auth spec flake · T4-45 reveal code length · T5-22 shop counts

### `BE · plans` / `payments` / `orders` / `returns` / `disputes` / `inventory` / `products` / `collections` / `cart` / `content` / `marketing` / `customers`
T1-1 IDOR (coupons, transfers, digital-files, flash-sales) · T2-11 billing columns migration · T2-22 trial-end check · T3-8 order editing · T3-9 returns UI · T3-11 customer record · T3-12 Stripe Connect · T3-13 storefront decision · T3-15 disputes actions · ~~T4-8 usage retention~~ · T4-27 entitlements phase 4 · T4-28 multi-location · T4-29 metafields · T4-30…32 redirects/pages/SEO · T4-33 campaigns · T4-34 collections · T4-35 cart · T5-34…36 plans backfills/pagination · T5-47 automation/loyalty/referral

### `BE · analytics`
T3-14 money boundary · T3-22 rollup + Live View · T4-1 shop timezone · T4-37 comparison presets + FX · T5-38 targets follow-ups

### `BE · vendor-agent` / `notifications` / `notify-logs` / `staff-notifications` / `integrations` / `chat`
T2-18 key rotation path · T3-16 `cost_cents` from the agent · T3-18 output moderation · T4-12 MESSAGE/SYSTEM producers · T4-13 event catalog remainder · T4-14 staff P3 remainder · T4-15 mid-tool progress · T4-42 STORAGE/PAYMENT specs · T5-16 emoji map casing · T5-17 push channel · T5-23…25 compaction / gating / settle path · T5-31 sentry helper · T5-33 async verification

### `VEN` · apps/vendor
T1-11 `/pixel-demo` · T2-13 `remotePatterns` · T2-19 Apollo cache keying · T3-2 surfacing gap · T3-3 pagination · T3-4 currency · T3-5 i18n · T3-6 tests · T3-19 polling · T3-20 browser walk · T3-21 error-code table · T4-11 slug check · T5-15 stream tests · T5-21 file sheet route · T5-26 canvas polish · T5-28 prompt prefill · T5-32 browser Sentry · T5-37 dead register path

### `ADM` · apps/admin
T3-15 disputes screen · ~~T3-23 permissions editor~~ · ~~T4-5 bulk selection~~ · ~~T4-9 platform usage screen~~ · ~~T4-10 unbuilt admin screens~~ · T4-39 no tests · T5-1 lint errors · T5-13 toolbar extras · ~~T5-14 otp-log filters/export~~

### `UI` · packages/ui
T3-20 RTL walk · T4-38 shader CI · T5-2…T5-10 trackball / press-depth / pixel-field residue · T5-12 rail shell seam

### `DOCS`
T3-21 error-code table · T5-41…T5-46 ai-image split, stale claims, extra-shots status, analytics docs
