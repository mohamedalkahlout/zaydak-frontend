# Zaydak AI Usage — Corrective Plan

**Last updated:** 2026-09-20 (implemented)
**Companion to:** [zaydak-ai-usage-quota-audit.md](zaydak-ai-usage-quota-audit.md) · [zaydak-outbound-entitlement-gap-analysis.md](zaydak-outbound-entitlement-gap-analysis.md)

This is the plan the audit produced, ordered by what is actually at risk. **It has been
implemented**, in the phases below, and three of its own proposals were overruled on review —
each is marked where it appears.

## Outcome

| Item | State | Note |
|---|---|---|
| P1.1 Redis outage bypassed the daily budget | Done | `enforce` no longer returns before `reserveCost`. |
| P1.2 Negotiation unmetered | Done, **differently** | Booked per *turn* rather than per phrasing call, so a turn that grows a second model call still costs one unit. Guest abuse is bounded by four layers, not by requiring `guest_key` — that proposal was rejected as insufficient. |
| P2.1 One cost expression | Done | `plans/usage-cost.sql.ts`; summary, top-shops, AI matrix and the spike sweep all read it. No column migration. |
| P2.2 `abandon` / `releaseTurn` | Done | Keyed on the released reservation; `cost_usd` always written. |
| P2.3 `feature_breakdown` atomic | Done | One `jsonb_set` statement, no read. |
| P3.1 Reconciliation | Done, report-only | `UsageReconcileService`, nightly 04:41 UTC, on counters quiet for an hour. |
| P3.2 Fail-open visibility | Done | `record`/`release` failures go to Sentry with a replayable payload. |
| P3.3 Telegram Jest loading | Done | Recovered **five** suites, not one. |
| P4.1 Real-Postgres concurrency | Done | 200-against-100 admits exactly 100. Executed, not inferred. |
| P4.2 Delivery-failure policy | Decided (D2) | Charged per AI execution; documented rather than refunded. |
| P4.3 Image window | Done | Subscription-anchored behind a dated transition. |
| P4.4 Idempotency edges | Done, **differently** | Outbound identity is the persisted `DirectMessage` id; `hash(body)` was rejected. Inbound is a single conditional insert. |

Three proposals in this document were wrong and are kept below with the correction beside
them: the outbound job key (`hash(body)` refuses legitimate repeat messages), requiring
`guest_key` (a client-controlled value is not a boundary), and treating an aggregate
counter/ledger difference as proof of a stranded reservation (it cannot say which one).

**Constraints this plan holds to.** Reuse NestJS, Prisma, Postgres, Redis and BullMQ as they
already stand. No RabbitMQ, no second ledger, no Redis-authoritative balance. No change to
`usage_events`, `usage_counters` or `plan_entitlements` semantics, and no migration that would
reinterpret existing rows. Postgres stays the source of truth for remaining quota.

---

## Priority 1 — stop unmetered and unbounded spend

### P1.1 Restore the budget reservation on a Redis outage (F1, CRITICAL)

`src/ai/ai-rate-limiter.service.ts:125-134` returns from `enforce` inside the Redis catch
block, skipping `this.budget.reserveCost(...)` at `:153`. Fourteen call sites lose the
platform daily cap whenever Redis is unavailable.

Restructure so the Redis failure only skips the Redis-derived check:

```ts
let limiterAvailable = true;
try { /* hourly + daily INCR */ }
catch (err) { limiterAvailable = false; this.logger.warn(...); }

if (limiterAvailable && (hourly > ... || daily > ...)) throw ...;

// Unconditional. The budget lives in Postgres and has nothing to do with Redis.
await this.budget.reserveCost(feature, undefined, units);
```

Correct the comment at `:127-129` while doing it — it currently asserts the opposite of what
the code does, which is how this survived review.

**Test:** with the Redis mock throwing on `incrby`, assert `budget.reserveCost` was called
exactly once and `enforce` did not throw.

**Effort:** small. **Risk:** none — it restores an intended behaviour.

### P1.2 Meter the negotiation assistant (F2, CRITICAL)

`NegotiationAiService` makes real LLM calls with no entitlement, no budget reservation and no
rate limit, reachable by an unauthenticated storefront visitor.

Three changes, all reusing existing machinery:

1. **Charge it.** Wrap the three call sites (`negotiation.service.ts:328, 512, 688`) in a reservation against `ai.agent.customer` — the key the storefront panel already shares — and settle with the `UsageTracker` snapshot the service already builds but currently discards outside Langfuse. On refusal, fall back to `formulateNegotiationReply`, which exists and already runs when no chat model is configured. The customer gets a plainer answer rather than an error; the merchant is never billed past their plan. If negotiation should not compete with the customer bot's allowance, add a distinct registry key instead — but seed it on every plan in the same change, or `check:drift` will fail the build, and an unseeded key lands in the fail-open state described in F9.
2. **Gate the platform cap.** Call `rateLimiter.enforce(userId ?? (guestKey ? \`sess:${guestKey}\` : null), 'chat')` — the same shape `storefront-assistant.service.ts:401-404` uses, for the same reason: `enforce(null)` files every signed-out visitor on the platform into one `anon` bucket.
3. **Close the cap bypass.** `assertDailyCap` returns early when neither an account nor a guest key is supplied. Refuse instead — **but this is not the fix**, only the cheapest layer of it. A client-controlled identifier is not a boundary, so what actually bounds a rotating caller is a per-origin ceiling keyed on a salted digest of their address (`negotiation.limits.ts`), with the merchant entitlement and the platform budget as the hard limits behind it. The daily cap also became atomic, since a count-then-compare lets concurrent tabs through.

**Tests:** an exhausted shop gets the template fallback and makes no LLM call; a request with
no `guest_key` is refused; a metered negotiation turn writes exactly one `usage_events` row.

**Effort:** medium. **Risk:** a merchant whose plan excludes the capability starts getting
template replies instead of LLM ones — which is the intended behaviour, but it is a visible
product change and should be stated in the release note.

---

## Priority 2 — make the money numbers agree

### P2.1 One cost expression across every report (F3, HIGH)

`usage_events.cost_cents` is `Int`, so `Math.round` turns a $0.000125 turn into `0`. The
precision already survives in `meta.cost_usd`; three reporting surfaces just do not read it.

**Do not migrate the column.** Instead:

1. Make `meta.cost_usd` mandatory on every AI write path. `commit` from `CustomerBotQuota.settle` and `VendorAgentService.settleTurn` already writes it; `CustomerBotQuota.abandon` does not (see P2.2), and the vendor agent's failure path writes no row at all.
2. Extract the `CASE WHEN … meta->>'cost_usd' … ELSE cost_cents` expression that `queryAiSpendGrouped` already uses (`usage-ledger.service.ts:529-558`) into one shared `Prisma.Sql` fragment.
3. Move `UsageLedgerService.summary` (`:139`), `topShops` (`:172`) and `AiSpendSpikeService.sweep` onto it.

After this, the admin AI spend matrix and the usage summary answer the same question the same
way, and the spike detector can see sub-cent traffic.

**Test:** 1,000 events at `cost_usd = 0.0002` must report $0.20 from `summary`, `topShops`,
`aiSpendByShop` and the spike detector alike.

**Effort:** medium. **Risk:** reported historical AI cost will *rise* on the two summary
surfaces once they stop reading zeros. Expected, and worth calling out to whoever reads those
dashboards.

### P2.2 Fix `abandon` (F4, MEDIUM)

`customer-bot.quota.ts:244-257`: add `dedupe_key` (namespaced, e.g.
`cbot-abandon:<conversationId>:<messageId>` — the processor has both) and add `cost_usd` to
`meta`. Two lines, and it is the difference between a failed turn's provider spend being
recorded and being lost.

While there: `VendorAgentService.releaseTurn` (`vendor-agent.service.ts:1524`) trues up the
platform budget but writes no `usage_events` row. Mirror what the customer bot does — a
zero-quantity `record` carrying the cost — so failed vendor turns stop being invisible in
`/analytics`.

**Effort:** small.

### P2.3 Make `feature_breakdown` writes atomic (F5, MEDIUM)

`AiBudgetService.trackCallOnly` (`ai-budget.service.ts:279-306`) reads the JSON, mutates it in
Node, and writes it back. `reserveCost` already has the correct `jsonb_set` expression at
`:139-149`. Reuse it. This matters more than it looks: when `AI_DAILY_BUDGET_USD` is unset the
*entire* reservation path routes through `trackCallOnly` (`:118-121`), so every concurrent AI
call on such a deployment races.

**Test:** twenty concurrent `trackCallOnly` calls must produce `count: 20` in the breakdown.
This one needs the isolated Postgres from `test/docker-compose.test.yml` to be meaningful.

**Effort:** small.

---

## Priority 3 — close the observability and recovery gaps

### P3.1 Counter/ledger reconciliation job (F7 + matrix #12, #17)

Add a daily BullMQ job beside the existing schedulers that, per shop and per open window,
compares `usage_counters.used` against `SUM(usage_events.quantity)` for the same
`(shop_id, feature_key, period_start)` and raises an `AlertService` event above a threshold.

**As implemented this only looks at counters that have been quiet for an hour**, because the
reservation model persists nothing about a reservation in flight: `reserve` increments the
counter and returns an in-memory handle, so a turn two seconds old and one whose worker died
are the same arithmetic. Waiting for silence was preferred over adding a row per reservation
on the hottest write in the enforcement path.

**Report, do not repair.** A stranded reservation is bounded and self-heals at period rollover;
an automatic decrement would race the very reservations it is auditing. `resetShopUsage`
(`plans-admin.service.ts:525`) already exists as the audited manual repair — the missing piece
is knowing when to reach for it.

**Effort:** medium. **Risk:** low; it writes nothing.

### P3.2 Alert on the fail-open states (F9)

`customer-bot.quota.ts:104`, `storefront-assistant.service.ts:346-378` and
`VendorAgentService.reserveTurn` all answer **unmetered** when no entitlement row exists. Keep
that — the reasoning is sound and written out. But an unseeded `plan_entitlements` table is a
realistic production state, and today it looks exactly like a working meter. Add a
`recordSecurityEvent`-style warn, deduped per shop per day, so "this shop is answering
strangers for free" is visible rather than inferred.

**Effort:** small.

### P3.3 Make the Telegram processor tests executable (audit §9)

`customer-bot/telegram-customer.processor.spec.ts` fails at module load —
`jose … Cannot use import statement outside a module`, reached via
`cart-claim.service.ts` → `auth.service.ts` → `social-token.verifier.ts`. Add a
`transformIgnorePatterns` entry for `jose` (and whatever else the fix surfaces) to the Jest
block in `back-end/package.json`. Until then Telegram's quota behaviour has no executing test
and `npm test` carries a red suite that reads as unrelated noise.

**Effort:** small. **Value:** high — it unblocks one of the two customer channels for every
test below.

---

## Priority 4 — prove the guarantee, then align the edges

### P4.1 Entitlement concurrency test on real Postgres (matrix #2, #16; scenario 1)

`test/concurrency/` already has everything needed: an isolated Postgres on port 55432, a
`DATABASE_URL_TEST` gate, a documented setup, and an `npm run test:concurrency` script. It
covers coupons, invoices, refunds and balances — and nothing for `usage_counters`.

Add one spec:

- Seed a shop with `ai.agent.customer` at `limit_value: 100`.
- Fire 200 concurrent `reserve(shopId, 'ai.agent.customer', { quantity: 1 })`.
- Assert exactly 100 resolve, 100 throw `PLAN_QUOTA_EXCEEDED`, and `usage_counters.used === 100`.
- Then `commit` all 100 and assert `usage_events` holds exactly 100 rows.
- Add the multi-tenant case: two shops firing concurrently must not influence each other's counter.

This converts the audit's single most important **NOT TESTED** into evidence.

**Effort:** medium. **Risk:** none.

### P4.2 Decide and document the delivery-failure policy (F6, matrix #10)

Zaydak charges per *execution*. Under that model, charging for a generated reply that failed
to deliver is correct and needs no refund path. The gap is that nothing says so where a reader
would look, and the reference model assumes otherwise.

Two acceptable outcomes, and the choice is a product decision rather than an engineering one:

- **Keep charging.** Write the rule into `back-end/docs/features/plans.md` and the customer-bot feature doc: *the billable unit is one AI agent execution, not one delivered message*. Cheapest, and consistent with how the rest of the system already behaves.
- **Refund permanent delivery failure.** Carry the `handle_id` on the send job, and on terminal failure write a compensating zero-quantity `record` plus a counter decrement. Note this weakens an existing guarantee: the reservation would then be settled by a *different* queue than the one that opened it, and a lost send job would leave the charge standing anyway — which is the state we are in today, only less visible.

The audit's recommendation is the first. The exposure is already bounded: the processor refuses
to generate at all when the session is not `connected` (`customer-bot.processor.ts:153`).

### P4.3 Align the image capability's period window (F8)

`image-gen.service.ts:2035-2038` uses a calendar month while every COUNTER capability uses the
subscription anchor. Pass the anchor through — the module already resolves the entitlement, so
`periodWindow('MONTH', now, anchor)` is available without a new query.

**Risk to check first:** a shop mid-period will see its image allowance window move once. For a
shop anchored late in the month that briefly looks like a reset; for one anchored early it
looks like a loss. Ship it at a period boundary, or accept and announce it.

### P4.4 Harden the remaining idempotency edges (F10, F11)

- ~~Give `WhatsAppSendQueue.enqueueText` a `jobId` derived from `(shopId, to, hash(body))`~~ — **overruled.** Two legitimate messages are often identical, so a content hash refuses real sends while the two bubbles of one turn are different rows anyway. Implemented as the persisted `DirectMessage` id instead.
- Replace `IdempotencyService.lookup` + `store` with a single conditional insert so the guarantee rests on the unique index rather than on BullMQ's `jobId` surviving `removeOnComplete` (`idempotency.service.ts:23-77`).

**Effort:** small each. **Priority:** last — neither is currently reachable in a way that costs money.

---

## Explicitly not recommended

| Tempting | Why not |
|---|---|
| A Redis-based quota counter or Lua deduction script | Postgres `ON CONFLICT … WHERE` already gives a stronger guarantee with no reconciliation surface. Adding Redis would *create* the divergence problem the reference model needs reconciliation to solve. |
| An outbox table for usage events | `commit` writes the ledger row and adjusts the counter in one transaction. There is no gap for an outbox to close. |
| Migrating `cost_cents` to numeric | `meta.cost_usd` already carries full precision and one query expression already reads it. A migration touches every historical row for no additional accuracy. |
| Charging per outbound message | It would change what merchants are billed for, on live subscriptions, to match a specification written for a different product. |
| A separate quota per channel | The current shared ceiling is a deliberate decision, documented at `customer-bot.quota.ts:46-56`: a customer refused on one channel must not get an answer by asking on the other. |

---

## Suggested sequencing

| Step | Items | Rationale |
|---|---|---|
| 1 | P1.1, P1.2 | Unbounded and unmetered spend. Everything else is accounting. |
| 2 | P3.3 | Unblocks Telegram tests, which several later items want. |
| 3 | P2.1, P2.2, P2.3 | Makes the reports agree before anyone makes a pricing decision from them. |
| 4 | P4.1 | Converts the central guarantee from inspected to proven. |
| 5 | P3.1, P3.2 | Makes the silent states visible. |
| 6 | P4.2, P4.3, P4.4 | Policy and edges. |
