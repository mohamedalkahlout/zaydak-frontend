# AI / store-import closeout (2026-09-17)

Delta against `docs/DECISIONS-NEEDED-AI-INTEGRATIONS.md`. P0–P6 were already largely in `TODO.md`. This session verified that, closed the remaining gaps, and did not rebuild the pipeline.

**Not committed. Not pushed.**

---

## 1. Already shipped (verified, not rebuilt)

| Phase | Verdict |
|---|---|
| **P1** Shopify chain + identity inside `importFromCsv` tx | Shipped. `onProductWritten` / `beforeCommit` inside the importer transaction. |
| **P1.5** Identity map, missing-from-source report, pruners | Shipped. No delete mutation on the missing list. |
| **P2** Image transfer | Shipped. `TRANSFER_IMPORT_IMAGES` via `uploadFromUrl` / `remote-image.guard`. Publish gate is a non-terminal media row. Merchant platform import UI is live (`import-products-dialog.tsx`); not “Not yet implemented”. Media retry/skip resolvers exist. |
| **P3** ScrapingBee | Connector, admin `SCRAPING` type, cap, and module wiring were already in source. The 2026-09-15 “two kill switches” note in `TODO.md` was **stale**. See §2. |
| **P4** AutoCategorize | Behind `AiRateLimiterService`, free to merchants, fill-blanks-only. |
| **P5** Sidekick `scan_store` / `get_store_import` / `commit_store_import` | Shipped. Commit is gated + dry-runnable. |
| **P6** WooCommerce | Store API + `type=variation` second pass. Salla/Zid not offered. |
| **Q2** Tajawal | UI (`next/font`) and server overlay (`back-end/src/ai/image/typography/`). |
| **Q4/B** | `COMMIT_BATCH_ROWS = 1000`. |
| **Q4/C** | `reserveForJob` reuses an unsettled handle on the job. |
| **Q5** | 5/hour + 20/day per shop, 10/day per `source_host`, all `failClosed`, refusals audited. |
| **Q6** | No confidence score. `scripts/eval-image-moderation.ts` exists. Output moderation stays off by decision. |
| **Q7** | `t.me/<shop_bot>?start=<token>` on order confirmation + account. WhatsApp hourly sweep. `WHATSAPP_SEND` limiter `{ max: 10, duration: 1000 }`. |
| **Q1 remainder** | Honeypot, 2000-char cap, 3/hour IP + 30/hour shop `failClosed`, identical answers. `@Throttle` + `@ThrottleFailClosed` on `subscribeNewsletter` and `unsubscribeStockNotification`. |

Merchant store-import stays open because P2 transfer actually works in code (resolvers + worker + UI). P1-only would have kept it closed.

---

## 2. Changed in this session

- **Q1:** Kept `DirectChannel.CONTACT_FORM`. Did not migrate to `WEB`. Did not add a third channel. Added `@ThrottleFailClosed()` on `unlockSharedVendorAgentConversation`.
- **Q4/A:** Removed the `currency_ack` escape hatch. `assertImportableCurrency` refuses a known mismatch with no ack argument. GraphQL `CommitStoreImportInput` is only `id`. Vendor review disables Import; no checkbox. Scan still produces `READY` so preview can name both currencies. Unknown source currency is not a mismatch. Prisma column `currency_ack` left in place, unused.
- **P3 diagnostic:** Scan report now round-trips `provider_available`. Module wiring was already present (`StoreImportModule` → `IntegrationsModule` + `ScrapingCredentialsService`). Cap already enforced in `isAvailable()` via `getMonthlyCreditsSpent`.
- **Sidekick:** Dry-run of `commit_store_import` now calls `assertJobCurrency`, so the approval card cannot say ok on a job the real commit will refuse. (`previewCommit` writes `report.preview`, so the tool cannot use that for a read-only dry run.)
- **Docs / schema:** `schema.gql` regenerated; vendor codegen dropped `currency_ack` and added `provider_available`. `npm run check:di` → `DI GRAPH OK`.
- **RTL:** New `e2e/specs/rtl-walkthrough.spec.ts`. Session setup timeout raised (first `/store` compile exceeded 60s).

---

## 3. Q1 verdict: keep `CONTACT_FORM`

The user asked to use `DirectChannel.WEB` unless there is a proven technical reason it is unsuitable. It is unsuitable. Mixing anonymous contact into `WEB` would either hide every contact thread or leak signed-in WEB DMs.

| Fact | Where |
|---|---|
| WEB list/open is Participant-scoped | `back-end/src/conversations/conversations.service.ts` 121, 173, 213 (`participants: { some: { user_id } }`) |
| Anonymous senders cannot be participants | `contact-form.service.ts` 35–47, 203–205 (`No participants`) |
| Customer-bot inbox is shop-owned and excludes WEB | `customer-inbox.service.ts` 151, 413 (`channel: { not: DirectChannel.WEB }`) |
| Mixing would make every WEB thread visible to everybody | `prisma/manual/2026-09-14-store-import-decisions.sql` 23–30 |
| Unique partial index is CONTACT_FORM-only | `prisma/manual/2026-09-15-contact-form-thread-unique.sql` |
| Reply composer is disabled for CONTACT_FORM (email is not a WhatsApp send) | `whatsapp-inbox.resolver.ts` 295–321 |
| Spec documents the channel split | `contact-form.service.spec.ts` |

No third enum.

---

## 4. Q4/A: mismatch refuses the whole import

No bypass. No “import the numbers as-is”.

- `assertImportableCurrency` has no `acknowledged` field.
- Commit, worker, GraphQL preview, and Sidekick dry-run all refuse with `STORE_IMPORT_CURRENCY_MISMATCH`.
- Preview still shows `source_currency` on a READY job.
- Unknown / null source currency is allowed (not a mismatch).
- `StoreImportJob.currency_ack` remains in Postgres; comment on the Prisma field says unused.

---

## 5. Tests

| Command | Result |
|---|---|
| `cd back-end && npx jest` (currency, scan-report, scraping credentials, contact-form, commit tool, vendor-agent resolver, keyed-rate-limiter) | 7 suites, **116 passed** |
| `cd back-end && npx jest src/store-import/store-import.service.spec.ts` | **49 passed** |
| `cd apps/vendor && npx vitest run` store-import lib + progress | 2 files, **21 passed** |
| `cd back-end && npm run schema:generate` | Wrote `src/schema.gql` from 110 resolvers. `currency_ack` gone; `storeImportPreview(id: ID!)` only; `provider_available` on the job. |
| `cd apps/vendor && npm run codegen` | `currency_ack` gone from generated types. |
| `cd back-end && node check-di.cjs` | **DI GRAPH OK** (includes `StoreImportModule`) |
| Playwright RTL | See §7 |

`zaydak-api` Docker was already running on `:3000` and was **not rebuilt**. Host `schema.gql` matches this change; the live container may still serve the previous schema until its image is rebuilt.

---

## 6. Adversarial review

**Fixed**

- Sidekick dry-run quoted `ok: true` on a USD job without checking shop currency. Now `assertJobCurrency`.
- Stale comment on vendor `GET_STORE_IMPORT_MEDIA_ISSUES` said media mutations were unpublished. They are published.
- Unlock PIN IP throttle failed open on Redis outage; now `@ThrottleFailClosed`.

**Accepted**

- `currency_ack` column not dropped (production-schema risk).
- `previewCommit` still writes `report.preview` (pre-existing; tool dry-run does not call it).
- Monthly credit cap can race two concurrent scans before either job’s credits are stored. Cap is still enforced at scan open.
- No shops-table column counting disconnected WhatsApp sessions. Sweep logs counts; platform assistant card shows stranded `linked_vendors`; vendor settings show per-shop `disconnected_at`.
- Files RTL sheet not measured: seeded shop’s files were images (editor page, not sheet).
- Docker API process not proven to be this commit’s bits.

P3 is **wired in source**. Do not treat the already-running Docker API as proof that `providerAvailable` is true in production until that process is running this code and `isAvailable()` returns true.

---

## 7. Playwright RTL

Command: `npx playwright test --config e2e/playwright.config.ts -g "RTL"`

Stack: Docker Postgres + Redis + `zaydak-api` `:3000`; vendor `next dev` `:3001`; storefront process listening on `:3003` but not answering HTTP.

Login: real `/login` as `vendor@zaydak.com` (password from `vendorPassword()` / `SEED_VENDOR_PASSWORD`). Shop discovered: `c1ded7ed69c6`. First run timed out because `/store` compiled in 57s; timeout raised; second session **14.8s, passed**.

| Spec | Result | Artifact |
|---|---|---|
| Session sign-in | passed | `e2e/.auth/` |
| AI composer Arabic draft under `dir=rtl` | passed | `e2e/.artifacts/rtl-arabic-draft.png` |
| Vendor products list `html[dir=rtl]`, start-aligned headers | passed | `e2e/.artifacts/rtl-vendor-products.png` |
| Vendor files sheet close on outer edge | passed without measuring the sheet (images only) | `e2e/.artifacts/rtl-vendor-files-no-sheet.png` |
| Vendor sidebar | passed | `e2e/.artifacts/rtl-vendor-sidebar.png` |
| Storefront cart drawer | **failed / hung** | `http://localhost:3003/` and `/c1ded7ed69c6` — `curl` 15s, HTTP 000. Spec now skips a hung goto. Trace: `e2e/.report/artifacts/specs-rtl-walkthrough-RTL--9092e-se-sits-on-the-outer-corner-composer/trace.zip` |
| Admin login RTL | **skipped** | `:3002` not running |

This is a real browser walk of the vendor dashboard under Arabic, not a written scenario. It is not a walk of storefront checkout or the admin console.

---

## 8. ينتظر صاحب المشروع

Local/admin Replicate and ScrapingBee keys are **not** missing. Do not open a ScrapingBee account or mint a Replicate token for local work.

| Item | Why an engineer cannot finish it |
|---|---|
| Salla / Zid OAuth app registration | Platform review under the owner’s account. |
| Production Integrations → `AI_MEDIA`: `webhook_base_url` + `webhook_secret` | Production console. Env is fallback only. |
| Production Integrations → Scraping: paste the key + monthly cap (not env) | Production console. |
| Rotate the ScrapingBee key that was pasted into a chat (2026-09-15) | Disclosed trial key. |
| `npm run eval:image-moderation` on real photos | Needs `OPENROUTER_API_KEY` and licensed images. Output moderation stays off until that run is green, by prior decision. |
| `seed:plans` once on the already-deployed database | Production DB. `catalog.store_import` denies until the capability rows exist. |
| Rebuild / redeploy API so production (and local Docker) run this schema | Live `zaydak-api` was not rebuilt in this session. |

---

## 9. Remaining engineering (`TODO.md` open boxes)

Index after this session: **98 open**, of which **28** production-only. AI & Integrations **17** (was 18). Engineering backlog **70**.

Notable still-open boxes that touch this surface:

- T3-20 `[~]` — vendor RTL walked; storefront hung; admin not up.
- ScrapingBee production console + key rotation `[~]`.
- Salla/Zid OAuth (deferred).
- Eval harness run (owner; script exists).
- Sidekick mobile panel, unread badge, locale-parity test, and other vendor-agent UX boxes unrelated to store-import.

No new enum. No currency bypass. P3 spend stays behind `isAvailable()` and `monthly_credit_cap`.
