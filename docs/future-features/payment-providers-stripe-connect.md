# Future Feature — Per-Shop Payment Provider Abstraction (Stripe Connect first)

**Status:** **Superseded — do not implement.** Replaced by [Deferred — Tap Commerce Platform](tap-commerce-platform.md) (D26, 2026-09-16). Stripe Connect, destination charges, per-shop Stripe onboarding, and asking merchants for gateway API keys are out of direction.
**Created:** 2026-07-15
**Owner:** Osama (historical)
**Scope decisions (locked, historical):** Provider abstraction (Strategy Pattern) · Stripe Connect as first provider · platform commission via `application_fee` on destination charges · full multi-phase architecture, extensible to local gateways (MyFatoorah/Moyasar/Tap/HyperPay/Tabby/Tamara).

---

## Context — why this change

The system today runs a **"marketplace of record"** model:

- All card payments go through **one platform Stripe account** ([stripe.service.ts:12](../../back-end/src/stripe/stripe.service.ts)), using a plain Checkout Session with **no** `transfer_data` / `application_fee_amount` — money lands whole in the platform account and never splits.
- Vendor balance is **fully internal** (`Balance` + `BalanceTransaction` ledger), credited only when an order becomes `COMPLETED` via `updateVendorBalance()` ([orders.service.ts:3427](../../back-end/src/orders/orders.service.ts)); default commission is **0%**.
- Withdrawals are **manual and off-platform**: admin approval only moves ledger numbers; the actual bank transfer happens by hand. No Stripe payout/transfer call exists.
- **No provider abstraction** — Stripe is hardcoded; the only seam is a `gateway` string. No `PaymentProvider` model, no payment-settings UI (the Settings > Payments section is a "coming soon" stub).

**Goal:** a flexible per-shop payment provider layer (`src/payments/`, Strategy Pattern) with **Stripe Connect** as the first concrete provider — per-shop connected accounts, **destination charges + application_fee** for commission — and a clean seam so local gateways are added later as new strategies without touching order/payment logic.

> ⚠️ **Top viability risk to validate before Phase 2:** Stripe Connect connected-account onboarding and SAR payouts in Saudi Arabia / the Gulf are limited. Test creating an Express account with a KSA test account first. The Strategy layer itself is the insurance (a local gateway is the fallback); `PlatformStripeStrategy` stays as the SAR fallback.

---

## Overall architecture

A new `src/payments/` layer sits between `payment-intents`/`orders` and the concrete gateways. Stripe is refactored into two strategies behind one interface: `PlatformStripeStrategy` (current behavior = fallback) and `StripeConnectStrategy` (new). Collection stays central for non-connected shops (INTERNAL) and splits at charge time for connected shops (CONNECT). Both run side by side — a safe transition path.

---

## Backend

### Data model (`back-end/prisma/schema.prisma`)

- **New `PaymentProvider`**: `id`, `shop_id` (relation to `Shop`, cascade), `provider` (enum `PaymentProviderType`: STRIPE/PAYPAL/MYFATOORAH/MOYASAR/TAP/HYPERPAY/TABBY/TAMARA), `status` (enum: PENDING/CONNECTED/RESTRICTED/DISABLED), `connected_account_id` (`acct_…`, null for API-key providers), flags `onboarding_completed`/`charges_enabled`/`payouts_enabled`, `config Json?` (**encrypted envelope only** for API-key secrets; null for Stripe Connect), `capabilities Json?`, `account_meta Json?`, `is_default`. `@@unique([shop_id, provider])` + indexes.
- **Decision:** the Stripe account id lives on `PaymentProvider`, not `Shop` (lets a shop switch/retry providers). `Shop` gets only the relation.
- **Order provenance columns** (all nullable): `payment_provider_type`, `connected_account_id`, `application_fee_cents`, `stripe_charge_id`, `stripe_transfer_id` — so an order remembers how it was charged even if the shop later switches providers (needed for reversals). The old `payment_gateway` column stays for compatibility.
- `Balance.payment_info` stays as-is for non-connected shops; becomes informational for connected ones. No delete/migration.

### Encryption (`back-end/src/common/crypto/`) — new

- `CryptoService` (AES-256-GCM; key from env `PAYMENTS_ENC_KEY`, 32-byte base64; rotation via `PAYMENTS_ENC_KEY_PREVIOUS`). API: `encryptJson()` / `decryptJson<T>()` with a `{v,iv,tag,ct}` envelope.
- Global module. Boot guard throws if the key is missing/short (mirror the `STRIPE_API_KEY` guard). **Secrets are never logged**; `config` is never passed to `AuditLogService`.
- Built in Phase 1 but first exercised in Phase 6 (API-key providers).

### Provider abstraction (`back-end/src/payments/`) — new

```
payment-provider.interface.ts   # PaymentProviderStrategy + DTOs
payment-provider.registry.ts    # Map<type, strategy> via DI
payment-provider.service.ts     # resolveForShop(shopId) -> { strategy, providerRecord }
commission-fee.helper.ts        # computeApplicationFeeCents(basisCents, bps)
strategies/platform-stripe.strategy.ts   # wraps current behavior (fallback)
strategies/stripe-connect.strategy.ts    # new
strategies/{myfatoorah,moyasar,...}.strategy.ts  # Phase 6
```

- **Interface** `PaymentProviderStrategy`: `type`, `capabilities()`, `createOnboardingLink()`, `getAccountStatus()`, `createCheckout()`, `verifyPayment()`, `refund()`, `handleWebhook()`.
- **Registry**: `resolveForShop()` picks the shop's default CONNECTED provider; otherwise returns `PlatformStripeStrategy` (current behavior, zero change).
- **Refactor**: `StripeService.createCheckoutSession` logic moves into the two strategies. `StripeService` stays thin, owning `Stripe` client construction (platform + `accounts`/`accountLinks`) with optional `stripeAccount`/connect-secret params. `PaymentIntentsService.createPaymentLink` replaces `switch(gateway)` with `resolveForShop() + strategy.createCheckout()`.
- **Commission**: keep `Balance.admin_commission_bps` as source of truth (the tiered `commissions` table stays unwired until a later optional phase). `application_fee_amount = basisCents − applyBps(basisCents, 10000 − admin_commission_bps)` via `commission-fee.helper.ts`, which **reuses the same `applyBps`** used in `updateVendorBalance` (so the Stripe cut and the ledger cut never diverge).

### Stripe Connect specifics

- **Onboarding**: **Express + Account Links** (not OAuth). `stripe.accounts.create({type:'express', capabilities:{transfers, card_payments}})` then `stripe.accountLinks.create({type:'account_onboarding', return_url, refresh_url})`. Completion comes from the `account.updated` webhook, not the return redirect.
- **Charge model**: single-shop order (majority) = **destination charge** (`payment_intent_data.transfer_data.destination` + `application_fee_amount`). Multi-shop cart = **separate charges + transfers** (one platform charge, then `stripe.transfers.create` per child order with `transfer_group` + `source_transaction`) because one Checkout Session can't split across accounts. Store `stripe_transfer_id` per child. Stable idempotency key per order/child.
- **Webhooks**: separate endpoint `POST /webhooks/stripe/connect` with secret `STRIPE_CONNECT_WEBHOOK_SECRET`, routed by `event.account`. Handles `account.updated`, `payment_intent.succeeded`, `charge.refunded`, `charge.dispute.*`, `transfer.*`, `payout.*`. Extend `ProcessedWebhookEvent.provider` to distinguish `stripe` vs `stripe_connect`. Normalization lives in `StripeConnectStrategy.handleWebhook`.

### Internal balance/withdrawal change (`settlement_mode`)

- Per-shop `settlement_mode` (`INTERNAL` vs `CONNECT`), derived from the default provider (or a `Balance.settlement_mode` column in Phase 5).
- `updateVendorBalance()` branches: INTERNAL = as today; CONNECT = does **not** increment `current_balance_cents` (money is in Stripe), writes an informational `sale` ledger row only. Manual withdrawal requests are **blocked** for CONNECT shops (Stripe auto-pays).
- **Refunds** (`RefundsService`) and **Disputes** (`DisputesService`) branch: INTERNAL = current path; CONNECT = reverse via Stripe (`reverse_transfer:true` + `refund_application_fee`/`application_fee_refund`; for multi-shop reverse the specific transfer) + informational ledger row. The ledger stays authoritative for INTERNAL, a mirror for CONNECT.

### Critical files (Backend)

- Edit: `schema.prisma`, `payment-intents.service.ts`, `stripe.service.ts`, `stripe-webhook.controller.ts`, `orders.service.ts` (`updateVendorBalance` ~3427), `refunds.service.ts`, `disputes.service.ts`, `withdrawals.service.ts`.
- New: `src/payments/*`, `src/common/crypto/*`, `src/stripe/stripe-connect-webhook.controller.ts`.

---

## Frontend

### Vendor Payment Settings — new feature `apps/vendor/src/features/payments/`

- Fill the disabled `payments` section in the settings overlay — edit `settings-page.tsx` (~206) to add `active === "payments" ? <PaymentsSection/>`. The section already exists in `settings-sections.ts`. Uses plain `gql` + manual types (like the balance feature).
- Components: `payments-section.tsx` (provider list), `provider-row.tsx`, `stripe-connect-card.tsx` (Not connected/Pending/Connected/Restricted + Connect/Manage/Disconnect), `disconnect-provider-dialog.tsx` (confirm — money-adjacent), `api-key-provider-form.tsx` (Phase 4 stub), `lib/providers.ts` (static registry), `lib/status.ts`.
- **GraphQL** (names coordinated with backend): `myPaymentProviders` (query), `createStripeConnectOnboardingLink`, `refreshStripeAccountStatus`, `disconnectPaymentProvider`, `upsertApiKeyProvider` (Phase 4).
- **Connect is an immediate action — never uses the save bar (`useUnsavedBarStore`).** "Connect with Stripe" → mutation returns an Account Link → `window.location.assign(url)` (full redirect, not `router.push`).
- **Return routes** (real routes, not overlay state): `app/dashboard/[shopSlug]/settings/payments/return/page.tsx` and `.../refresh/page.tsx` + `onboarding-return-view.tsx` — on mount call `refreshStripeAccountStatus` (the return URL is not proof of completion), show success/incomplete, then back to `?section=payments`. These routes live under `dashboard/[shopSlug]` so X-SHOP is scoped automatically.

### Balance screen adaptation (Vendor)

- Add `payouts_managed_by` (enum `MANUAL | STRIPE`) to `GET_SHOP_BALANCE` in `balance/api.ts` (avoids a second request).
- In `balance-view.tsx`: on `STRIPE` → hide/disable "Request withdrawal" and show `stripe-payouts-banner.tsx` ("Payouts handled by Stripe" + Stripe dashboard link), withdrawals read-only. On `MANUAL` → current flow unchanged.

### Admin visibility — new feature `apps/admin/src/features/payment-providers/`

- `api.ts` with **codegen-typed gql**: `paymentProviders(page,limit,status,provider)`. Table `payment-providers-table.tsx` (clone of `withdrawals-table.tsx`, read-only) + route `app/payment-providers/page.tsx` + sidebar entry.
- CONNECT-shop withdrawals: either excluded by the backend, or shown read-only with a "Managed by Stripe" badge.
- **Run `npm run codegen` in `apps/admin`** after the schema change.

### Critical files (Frontend)

- Edit: `settings-page.tsx`, `balance-view.tsx` + `balance/api.ts`, `withdrawals-table.tsx`.
- New: `apps/vendor/src/features/payments/*`, the return/refresh routes, `apps/admin/src/features/payment-providers/*` + route, i18n en/ar keys (parity mandatory).

---

## Roadmap (phases)

1. **Foundation (no behavior change):** `PaymentProvider` + enums + `Order` columns (migration); `common/crypto`; `payments` module + interface + registry + `PlatformStripeStrategy` identical to today; route `createPaymentLink` through the registry. Tests: crypto, registry, platform-strategy parity.
2. **Onboarding:** `StripeConnectStrategy.createOnboardingLink`/`getAccountStatus`; connect GraphQL ops; connect webhook for `account.updated`; **Payment Settings UI + return routes (Frontend Phase 1)**. Vendors connect; no charges routed yet.
3. **Destination charges + application_fee:** `createCheckout` for single-shop; fee helper; route single-shop CONNECT shops through Connect; stamp provenance columns; webhook `payment_intent.succeeded`.
4. **Payouts/Refunds/Disputes under Connect:** refund with `reverse_transfer`+`refund_application_fee`; branch `RefundsService`/`DisputesService`; **multi-shop separate charges + transfers** with idempotency.
5. **Reconcile internal ledger:** `settlement_mode`; branch `updateVendorBalance` (CONNECT = mirror only); block manual withdrawals for CONNECT shops; **Balance-screen adaptation + admin visibility (Frontend Phases 2–3)**; Stripe-vs-ledger reconciliation report.
6. **Additional providers:** MyFatoorah/Moyasar/Tap/HyperPay/Tabby/Tamara strategies with encrypted `config` secrets; **API-key form + save bar (Frontend Phase 4)**; optional wiring of the tiered `commissions` table. Zero change to orders/payment-intents (the abstraction's payoff).

---

## Biggest risks

1. **Stripe Connect SAR availability in KSA/Gulf** (highest) — validate with a KSA test account before Phase 2; keep `PlatformStripeStrategy` as fallback.
2. **Multi-shop cart splitting** — one Checkout can't split; the "platform charge + per-shop transfers" solution needs strict idempotency and failure handling (charge succeeded, transfer failed).
3. **Idempotency across two webhook streams + transfers/refunds** — extend `ProcessedWebhookEvent.provider`; stable idempotency keys.
4. **Atomicity / double-counting** — an order must be exactly INTERNAL or CONNECT; branch on the order's stamped provenance, not the shop's current provider.
5. **Refund/fee reversal correctness** — partial refunds reverse the vendor share and `application_fee` proportionally through a single helper.

---

## Verification (when implemented)

- **Backend unit (Jest):** `crypto.service.spec` (round-trip/tamper/rotation); `resolveForShop` (picks CONNECTED, falls back to platform); `StripeConnectStrategy` with a mocked Stripe SDK (correct `transfer_data`+`application_fee_amount`, refund with `reverse_transfer`); `computeApplicationFeeCents` == `total − internalEarnings` across a bps range; webhook controllers (bad signature, duplicate event_id, `account.updated` flips status); `updateVendorBalance`/withdrawals/refunds branches. Run `cd back-end && npm test`.
- **Stripe test-mode Connect integration:** test connected accounts; replay payloads against `/webhooks/stripe/connect`; assert the idempotency table.
- **Frontend:** `npm run codegen` in `apps/admin`; `npm run typecheck` in both apps; manual end-to-end: connect Stripe (redirect → return → CONNECTED), single-shop order splits at charge (verify `application_fee` in Stripe dashboard), CONNECT shop hides the withdrawal button.
- **Docs (mandatory when built):** `back-end/docs/features/payments.md` + `api/payments.md`; update payment-intents/withdrawals/refunds/disputes/balance docs; `apps/vendor/docs/features/payments.md` + README row; add a `TODO.md` entry.
