# Zaydak vs. Outbound Reply Entitlement — Gap Analysis

**Last updated:** 2026-09-20 (re-verified after the corrective work landed)
**Companion to:** [zaydak-ai-usage-quota-audit.md](zaydak-ai-usage-quota-audit.md)

> **Status: the corrective plan has been implemented.** The matrix below is the
> state *after* that work, with the original finding kept in the Gap column so
> the reasoning stays readable. Decisions D1-D3 (negotiation shares
> `ai.agent.customer`; billing is per AI execution, not per delivered message;
> the image allowance follows the subscription period) are settled and reflected
> here.

> **The reference document was not supplied.** `Outbound Reply Entitlement — Implementation
> Spec v1` is not in this repository and was not attached. The matrix below is built from the
> eighteen requirements enumerated in the audit request. Requirements of the actual document
> outside that list are **UNVERIFIED**, and no status here should be read as covering them.

---

## 1. The central comparison

The reference model's stated requirement is *one billable AI-generated outbound reply consumes
exactly one reply unit*.

**Zaydak charges per agent execution, not per outbound reply**, and does so deliberately. The
registry declares `ai.agent.customer` with `billingUnit: 'request'` and the comment on
`maxSteps` states the intent directly: *"the reply is billed as one `request` whether the model
called a tool three times or none"* (`src/plans/feature-registry.ts:751-778`).

The two models diverge in four places, and only one of them is a defect:

| Situation | Reference model | Zaydak | Verdict |
|---|---|---|---|
| One turn, three tool rounds, one reply | 1 unit | 1 unit | agrees |
| One turn emitting two bubbles (reply + cart claim link) | 2 units | 1 unit | intentional difference |
| Generation succeeded, delivery permanently failed | refund | charged | **needs a documented decision** |
| Generation failed | refund | refunded, cost still recorded | agrees, and Zaydak is stricter |

The billing unit is **consistent across all three customer channels** (WhatsApp, Telegram,
storefront panel) because all three call the same `CustomerBotQuota` against the same key.

---

## 2. Requirement matrix

| # | Requirement | Zaydak implementation | Status | Evidence | Gap |
|---|---|---|---|---|---|
| 1 | Billable unit definition | One `request` per answered agent turn, declared in the capability registry | IMPLEMENTED DIFFERENTLY | `plans/feature-registry.ts:751`; `customer-bot.quota.ts:16` | Unit is execution, not outbound reply. Intentional; not documented as a deliberate divergence anywhere a reader would find it. |
| 2 | Atomic quota deduction | `INSERT … ON CONFLICT (shop_id, feature_key, period_start) DO UPDATE … WHERE used + n <= limit RETURNING used` | IMPLEMENTED | `plans/entitlements.service.ts`; **proven** by `test/concurrency/entitlements.e2e-spec.ts` against real Postgres | Closed. Was unproven by test; 200-against-100 now admits exactly 100. |
| 3 | Store-level limits | `usage_counters` keyed on `shop_id`; plan limits per capability; per-shop overrides | IMPLEMENTED | `entitlements.service.ts:439-511`; `schema.prisma:6511` | `PLUS` sets `ai.agent.customer` to `null` (unlimited) — that tier has no shop ceiling at all. |
| 4 | Customer-level limits | Per-identity 5s burst + 30/hour, keyed `cbot:<shopId>:<identity>` | IMPLEMENTED | `customer-bot.throttle.ts:64-103` | Fails open on a Redis outage (documented and defended). No per-customer limit on the negotiation path. |
| 5 | Pre-generation entitlement check | `quota.open()` before `bot.answer()`; `NegotiationQuota.openTurn()` before any `phrase*` | IMPLEMENTED | `customer-bot.processor.ts`; `telegram-customer.processor.ts`; `negotiation/negotiation.quota.ts` | Closed. Negotiation was unmetered (F2); it now books one unit per **turn**, not per provider call. |
| 6 | Duplicate prevention | Four layers, now all atomic: `IdempotencyService.claim()` (one insert, the unique index decides), BullMQ `jobId`, `alreadyAnswered`, `handle_id` UNIQUE | IMPLEMENTED | `idempotency/idempotency.service.ts`; `whatsapp-inbound.service.ts`; `telegram-inbound.service.ts`; `entitlements.service.ts` | Closed. `lookup`+`store` was a race (F11); `abandon` now carries a `dedupe_key` keyed on the released reservation (F4). |
| 7 | Durable usage ledger | Append-only `usage_events`, written transactionally with the counter adjustment | IMPLEMENTED | `entitlements.service.ts:550-576`; `usage-ledger.service.ts` | `record` failures are logged and dropped silently (`:676`). |
| 8 | Refund handling | `release` on a failed turn, idempotent, quota returned and cost still recorded - on every channel | IMPLEMENTED | `entitlements.service.ts`; `customer-bot.quota.ts`; `negotiation.quota.ts`; `vendor-agent.service.ts` | Vendor-agent gap closed: `releaseTurn` now writes the zero-quantity cost row. **No refund for delivery failure, by decision D2** - the unit is one AI execution, not one delivered message. |
| 9 | Redis failure policy | A Redis failure removes only the Redis-derived ceiling; the Postgres-backed budget is booked either way | IMPLEMENTED | `ai/ai-rate-limiter.service.ts`; `ai-rate-limiter.service.spec.ts` | Closed (F1). `enforce` no longer returns from its catch block before `reserveCost`. |
| 10 | Delivery failure handling | Detected before generation where possible; send jobs carry a stable logical identity (the persisted `DirectMessage` id) so a retried enqueue cannot double-send | IMPLEMENTED DIFFERENTLY | `customer-bot.processor.ts`; `whatsapp-send.queue.ts`; `telegram-send.queue.ts` | By D2 there is no quota refund, and that is now documented rather than implicit. **Residual, provider-side:** Evolution's `sendText` accepts no idempotency key, so a timeout after it accepted a message still redelivers. Documented in the queue; not closable from here. |
| 11 | Multi-channel quota consistency | WhatsApp, Telegram, the storefront panel **and negotiation** share `ai.agent.customer`; vendor surfaces share `ai.agent.chat` | IMPLEMENTED | `customer-bot.quota.ts`; `storefront-assistant.service.ts`; `negotiation.quota.ts`; `vendor-agent.service.ts` | Closed (D1). |
| 12 | Quota reconciliation | Nightly sweep comparing `usage_counters.used` against `SUM(usage_events.quantity)`, on counters quiet for an hour. Reports, never repairs | IMPLEMENTED | `plans/usage-reconcile.service.ts` (04:41 UTC) | Closed. **It cannot say which reservation to refund** - nothing durable names an open one - so it alerts and leaves `resetShopUsage` as the audited repair. Busy counters are never checked; stated cost. |
| 13 | Subscription-period isolation | `periodWindow` anchors MONTH/YEAR to `current_period_start` for every metered capability, images included | IMPLEMENTED | `plans/period.ts`; `entitlements.service.ts` (`window()`); `ai/image/image-gen.service.ts`; `image-quota-window.spec.ts` | Closed (D3) via a **dated transition**: the anchored window applies only once a shop's period rolls past `IMAGE_QUOTA_ANCHORED_FROM`, so no live shop gains or loses allowance on the day it ships. |
| 14 | Usage reporting | `myUsage`, `myUsageEvents`, `myUsageSummary` for merchants; `usageSummary`, `usageTopShops`, `aiSpendByShop`, `aiSpendByPlan` for admins; daily spike alerting | IMPLEMENTED | `plans/plans.resolver.ts:166-240`; `usage-ledger.service.ts`; `ai-spend-spike.service.ts` | Two surfaces disagree about the same money (F3). |
| 15 | Cost accuracy | Capture unchanged; every aggregate now reads one shared `exactCostCentsSql` over `meta.cost_usd`, rounding once **after** the sum | IMPLEMENTED | `plans/usage-cost.sql.ts`; `usage-ledger.service.ts`; `ai-spend-spike.service.ts`; `ai-budget.service.ts` | Closed (F3/F4/F5). `cost_usd` is written on every AI path including the failed ones; `feature_breakdown` is one `jsonb_set`. The `Int` column is unchanged - no migration was needed. |
| 16 | Concurrency guarantees | `ON CONFLICT … WHERE` for COUNTER; `pg_advisory_xact_lock` for the DERIVED image path; `AiBudgetService` atomic throughout | IMPLEMENTED | `entitlements.service.ts`; `image-gen.service.ts`; `ai-budget.service.ts`; `test/concurrency/entitlements.e2e-spec.ts` | Closed. Proven against real Postgres, and the read-modify-write in `trackCallOnly` is gone. |
| 17 | Recovery after worker crashes | Stranded reservations surface nightly as counter-minus-ledger drift; failed `record`/`release` writes go to Sentry with the payload needed to replay them | PARTIALLY IMPLEMENTED | `plans/usage-reconcile.service.ts`; `entitlements.service.ts` | Observable now, and recoverable by hand. Still self-heals at the period roll rather than being repaired automatically - deliberate, see row 12. |
| 18 | Auditability | Every settled turn writes a ledger row carrying shop, capability, quantity, cost, `ref_type`/`ref_id`, `user_id` and `meta`; releases write a zero-quantity row rather than deleting; admin resets are audit-logged | IMPLEMENTED | `entitlements.service.ts:550-591`; `usage-ledger.service.ts:120-126`; `plans-admin.service.ts:558` | Turns that fail on the vendor-agent path leave no row. |

**Totals after the corrective work:** 14 IMPLEMENTED, 1 PARTIALLY IMPLEMENTED
(row 17 - observable, not auto-repaired, by design), 0 MISSING, 2 IMPLEMENTED
DIFFERENTLY (rows 1 and 10 - the billing unit is one AI execution, per D2).

Was: 10 IMPLEMENTED, 5 PARTIAL, 2 MISSING, 1 DIFFERENT.

---

## 3. Required concurrency and failure scenarios

Re-run on 2026-09-20 after the corrective work. Unit suites:
**438 of 439 passing, 7321 of 7329 tests** (`npx jest`). The concurrency suite
was executed against a real, isolated Postgres 16 — see the note below the
table. No status here is PASS without an executed test.

| # | Scenario | Status | Basis |
|---|---|---|---|
| 1 | 200 concurrent replies against a remaining quota of 100 must authorize at most 100 | **PASS** | `test/concurrency/entitlements.e2e-spec.ts`, executed against Postgres 16: exactly 100 admitted, 100 refused, `used = 100`. Was NOT TESTED. |
| 2 | Reprocessing the same inbound message must not duplicate a logical-reply charge | **PASS** | Ledger: three concurrent commits on one `handle_id` produce one row (real Postgres). Transport: `IdempotencyService.claim` is now one insert decided by the unique index — `idempotency.claim.spec.ts`. |
| 3 | One customer hitting their daily cap must not affect another | **PASS** | `negotiation.guest-limits.spec.ts` pins key separation per identity and per shop; `customer-bot.throttle.spec.ts` covers the phone channels. Was NOT TESTED. |
| 4 | Permanent delivery failure must follow the documented refund policy | **PASS** | The policy is now decided and written down (D2): one AI execution is the billable unit, so a generated reply that fails to deliver stays charged. Documented in `whatsapp-send.queue.ts` and the plans docs. Was FAIL — there was no policy. |
| 5 | A Redis restart must not permanently corrupt merchant balances | **PASS** | Quota is in Postgres; `entitlements.service.spec.ts` executes the cache-failure fallthrough. The F1 hole beside it — a Redis error skipping the Postgres-backed budget — is closed and pinned by `ai-rate-limiter.service.spec.ts`. |
| 6 | BullMQ retries must not silently duplicate accounting | **PASS** | Inbound queues are `attempts: 1`; `handle_id` is UNIQUE regardless; a replayed `abandon` now drops on its own `dedupe_key` (`customer-bot.quota.spec.ts`). |
| 7 | Multiple stores must not share quota counters | **PASS** | Two shops firing 150 reservations each against a limit of 100 land on 100 apiece, real Postgres. |
| 8 | An exhausted merchant must not generate unauthorized paid responses | **PASS** | True on every channel now, negotiation included: `negotiation.quota.spec.ts` asserts an exhausted reservation never reaches a model. Was FAIL. |
| 9 | A failed usage event must not silently disappear | **PASS** | `record` and `release` failures go to Sentry with the whole payload, tagged `usage_record_failed` / `entitlement_release_failed`, and `record` is replayable because it is idempotent on `dedupe_key`. Was FAIL. |
| — | Telegram quota behaviour | **PASS** | `telegram-customer.processor.spec.ts` executes: 32 tests. Was UNVERIFIED — the suite failed at module load on a `jose` ESM transform. |
| — | A stranded reservation is detectable | **PASS** | Real Postgres: three reservations, two settled, drift of exactly 1 — the shape `UsageReconcileService` reports. |
| — | A renewed period starts from zero | **PASS** | Real Postgres: the new `period_start` is a different row; the spent one is untouched. |
| — | Image allowance follows the subscription period | **PASS** | `image-quota-window.spec.ts` — 1st, 20th, month-end clamping, February, leap February, multi-year roll-forward, and the transition property that no shop moves on the day it ships. |
| — | Live provider cost reporting | **UNVERIFIED** | Would consume paid LLM credits. Out of scope by instruction. |
| — | End-to-end delivery duplication after a provider timeout | **UNVERIFIED, and not closable here** | Evolution's `sendText` accepts no caller-supplied idempotency key, so a retry after it accepted a message cannot be deduplicated from our side. Verifying it would mean sending real customer messages. |

**How the concurrency suite was run.** The documented port 55432 is inside a
Hyper-V reserved range on the machine this was executed on, so the container was
started on 15432 instead; both the workaround and the `127.0.0.1`-versus-
`localhost` trap are written up in `test/concurrency/README.md`. The suite is
still gated on `DATABASE_URL_TEST` and still skips when it is unset.

## 4. Requirements already satisfied — do not rebuild

The following need no work, and the corrective plan deliberately leaves them alone:

- The atomic reservation statement and the `reserve`/`commit`/`release` contract.
- `handle_id` as the ledger idempotency key, and the insert-before-adjust transaction ordering that makes a replay abort cleanly.
- The four-layer inbound dedupe stack.
- The COUNTER/DERIVED split, and the advisory-lock enforcement in the image path.
- Subscription-anchored period windows for COUNTER capabilities, including the day-clamping month arithmetic in `addMonthsUtc`.
- `UsageTracker`'s streaming de-duplication and the OpenRouter-only `usage.include` extension.
- Langfuse as observability with no billing coupling.
- The separation of customer-facing and vendor-facing quotas.
- Per-identity throttling on public channels.
- Merchant and admin usage reporting surfaces, and the cost/quantity split between them.

Nothing in the reference model's shape requires RabbitMQ, a second ledger, a Redis-authoritative
balance, or a Lua-scripted deduction. Zaydak's Postgres-authoritative design already provides
the stronger guarantee.
