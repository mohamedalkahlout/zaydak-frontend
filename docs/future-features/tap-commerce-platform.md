# Deferred — Tap Commerce Platform Integration

**Status:** Deferred / outside the current release. **Do not implement.**
**Created:** 2026-09-16
**Decision:** [D26](../production-readiness/decisions.md)
**Owner:** Product + payments architecture (not a V1 engineering task)

This file is the approved future direction for merchant card settlement. It is not a build ticket, not a Prisma change, and not a checkout change. Nothing in this document authorises Tap API calls, Lead/Connect wiring, or a `TapPaymentAccount` migration.

---

## Why this exists

The current money model for **card** payments is a platform-of-record Stripe Checkout: funds land in the platform Stripe account, `OrdersService.updateVendorBalance` credits an internal shop `Balance`, and `createWithdrawal` / `updateWithdrawalStatus` move ledger numbers when an admin “approves” a payout. **No bank transfer is executed by that approval.** That custodial wallet + manual payout loop is **frozen**. It must not be productised further.

The replacement, when Tap confirms Commerce Platform onboarding for this entity in Saudi Arabia, is:

```text
Zaydak (Commerce Platform)
        │
        ├── Shop A → Tap Merchant A
        ├── Shop B → Tap Merchant B
        └── Shop C → Tap Merchant C
```

Zaydak owns the technical integration (platform credentials, webhooks, charge creation). The merchant completes KYC / business / bank details **on Tap**, not by pasting Secret Keys into Zaydak.

---

## Current production (keep — do not change in this task)

These paths are live. Freeze means: no new withdrawal product work, no Tap, no checkout rewrite.

| Path | What it does today | Keep? |
|------|--------------------|--------|
| Storefront checkout + `createOrder` | Prices the cart; does not move card money | **Keep** |
| Stripe Checkout (`stripe/`, `payment-intents/`) | Card charge to the **platform** Stripe account; webhooks update the order | **Keep** |
| COD | Merchant / courier collects cash | **Keep** |
| Bank transfer (`shop-payments/`, `bank-transfers/`) | Customer pays the shop IBAN; `payment_settlement = merchant_direct` | **Keep** |
| Refunds / returns / Stripe disputes | Order money and stock; disputes hold `Balance.held_cents` | **Keep** (behaviour unchanged) |
| `updateVendorBalance` + `Balance` + `BalanceTransaction` | Internal projection of shop earnings / commission / refund / dispute | **Keep as accounting** until a later Tap cutover; do not treat as a payable wallet |
| Customer `Wallet` (loyalty / store credit) | **Not** a merchant wallet | **Keep** |
| Plans billing (vendor subscription Stripe) | Platform charging the merchant for SaaS | **Keep** — unrelated to shop GMV |

---

## Frozen / deprecated (do not extend)

**Deprecated / planned for removal** after Tap (or another confirmed commerce-platform) ships. Live callers stay until a dedicated cutover. Do not add features on top.

| Surface | Kind | Notes |
|---------|------|--------|
| `Withdrawal` model, `src/withdrawals/` | Existing production logic + API | `createWithdrawal`, `updateWithdrawalStatus`, `deleteWithdrawal`, `withdrawals`, `withdrawal`. Approval only moves ledger cents. |
| Vendor `/store/[shopSlug]/balance` and `/withdrawals` | UI on existing API | `features/balance/` — request-payout dialog calls `createWithdrawal`. |
| Admin `/withdrawals` | UI on existing API | Approve / reject / hold. No real bank payout. |
| `Balance.payment_info`, `withdrawn_amount_cents` as payout destination | Database | Payout metadata for the old loop. |
| `NotifyType.PAYMENT` keys `withdrawal.approved` / `withdrawal.rejected` | Notifications | Fired from `withdrawal.status.changed`. |
| Vendor agent `get_shop_balance`; intents `withdrawal_request` / `withdrawal_manager` | AI | Read-only balance today; classifier still talks about payouts. Do not add a request-payout tool. |
| Stripe Connect future plan | Unused plan | [payment-providers-stripe-connect.md](payment-providers-stripe-connect.md) is **superseded**. Do not build Connect, destination charges, or per-shop Stripe keys. |

There is **no** `PaymentProvider` / `TapPaymentAccount` model. Do not add one in this release.

---

## Inventory (for a later cutover)

### Existing production logic

- `back-end/src/orders/orders.service.ts` — `updateVendorBalance` (sale / refund / merchant-direct commission).
- `back-end/src/refunds/refunds.service.ts` — calls `updateVendorBalance` on approve.
- `back-end/src/disputes/disputes.service.ts` — holds / releases `current_balance_cents` + `held_cents`.
- `back-end/src/balance/balance-ledger.service.ts` — append-only `sale`, `refund`, `commission*`, `dispute*`, `payout`, `payout_reversal`.
- `back-end/src/withdrawals/withdrawals.service.ts` — create + admin status + ledger `payout`.
- `back-end/src/stripe/*`, `payment-intents/*`, `checkout/*`, `shop-payments/*`, `bank-transfers/*`.

### UI

- Vendor: `apps/vendor/src/features/balance/*`, routes `balance/page.tsx`, `withdrawals/page.tsx`, sidebar Wallet link.
- Vendor settings payments: **bank accounts for customer bank-transfer**, not Tap — keep.
- Admin: `apps/admin/src/features/withdrawals/*`, `/withdrawals`.
- Admin `/commissions`: writes `Commission` tiers (still largely unwired to the live rate on `Balance.admin_commission_bps`) — commission **policy** stays in P06; it is not a payout system.

### Backend-only / API

- GraphQL: `withdrawals`, `withdrawal`, `createWithdrawal`, `updateWithdrawalStatus`, `deleteWithdrawal`, `balanceTransactions`.
- Permissions: `createWithdrawal` uses `MANAGE_OWN_SHOP` / `MANAGE_ALL_SHOPS` (any vendor). Admin status uses `MANAGE_ALL_ORDERS`. There is **no** dedicated withdrawal permission.
- REST: none for withdrawals.

### Database

- `balances`, `balance_transactions`, `withdrawals`.
- `wallets` = **customer** store credit.
- `shop_bank_accounts` = customer bank-transfer destination.
- `payment_intents`, `payment_methods`, `processed_webhook_events` = Stripe / saved cards.

### Tests

- `withdrawals.service.spec.ts`, `balance-ledger.service.spec.ts`, `orders.service.spec.ts` (`updateVendorBalance`), `disputes.service.spec.ts`, `refunds.service.spec.ts`.
- Vendor `features/balance/__tests__/balance.test.ts` (format helpers).
- Admin withdrawals filter/status tests.

### Accounting / reporting dependencies

- Shop GraphQL `balance { current_balance_cents, total_earnings_cents, withdrawn_amount_cents, admin_commission_bps }`.
- Analytics / reports do not own payouts; they must not grow a “available to withdraw” product on this ledger.

---

## Do not develop further (this release)

- Vendor withdrawal system, payout approval, “close the payout loop”, external payout reference, beneficiary verification for ledger withdrawals.
- Internal merchant wallet as money the platform owes and later sends.
- Manual merchant settlement / platform-controlled payouts.
- Stripe Connect, destination charges, per-merchant Stripe onboarding.
- Tap Lead / Connect / Charge / merchant webhooks / `TapPaymentAccount`.
- Asking merchants for Tap Secret Key, Public Key, webhook URL, or developer credentials.

Integrity work on **existing** money paths (idempotent order credit, commission snapshot, COD/bank-transfer not double-paying platform funds, Stripe webhook signatures) may continue. That is not a withdrawal product.

---

## Phases (documentation only)

Do not start a phase until Tap confirmation unblocks it **and** a later release decision names it in scope.

### Phase 1 — Platform Account

- Obtain Tap Commerce Platform approval for this entity.
- Obtain `commerce_platform_*` ID.
- Obtain platform API credentials (env / integrations console — not merchant-pasted).
- Confirm Saudi Arabia availability, KYC, and settlement product requirements.

### Phase 2 — Merchant Onboarding

- Create Lead API; store `leadId`.
- Connect API; redirect the merchant to Tap-hosted onboarding.
- Track onboarding state; receive/store `merchantId`.
- Vendor UX: Settings → Payments → Tap → Enable (no secret fields).

### Phase 3 — Merchant Payment Account

Concept only. **Do not migrate.**

```text
Shop
 └── TapPaymentAccount
      ├── leadId
      ├── merchantId
      ├── status
      ├── country
      ├── currency
      ├── acceptanceAllowed
      ├── payoutAllowed
      └── activatedAt
```

No generic payment-provider model exists today to hang this on.

### Phase 4 — Checkout

Future charge shape (not implemented):

```text
shop → merchantId → platformId → Tap Charge
```

```json
{
  "merchant": { "id": "<shop merchant id>" },
  "platform": { "id": "<Zaydak commerce platform id>" }
}
```

Current Stripe checkout stays until this phase is explicitly scheduled.

### Phase 5 — Webhooks

Central Zaydak endpoint for payment success/failure, refund status, and merchant/account status **where Tap supports it**. Merchants must not configure webhooks.

### Phase 6 — Refunds

Refunds in the merchant’s Tap account context, not by debiting an internal Zaydak wallet. Current refund APIs stay until then.

### Phase 7 — Settlement

Zaydak must **not** implement merchant withdrawal/payout logic **if** Tap confirms direct merchant settlement. That confirmation is still open (below).

---

## BLOCKED — Requires Tap confirmation

Do not encode answers in code or treat D02/D26 as having settled these:

1. Does settlement go **directly from Tap to each merchant’s bank account**?
2. Is each merchant responsible for **refunds / chargebacks / negative balance** on their Tap account?
3. Can Zaydak create charges with **platform credentials** plus `merchant.id` + `platform.id`, with **no merchant Secret Key**?
4. How does Zaydak take **its commission** in that model?
5. Does platform fee collection need an extra **Payment Technology** setup?
6. Which **webhooks/events** exist for merchant onboarding and KYC?

---

## Related docs

- Current card gateway: [back-end/docs/features/stripe.md](../../back-end/docs/features/stripe.md)
- Frozen withdrawals: [back-end/docs/features/withdrawals.md](../../back-end/docs/features/withdrawals.md)
- Ledger (kept as accounting): [back-end/docs/features/balance.md](../../back-end/docs/features/balance.md)
- Superseded Connect plan: [payment-providers-stripe-connect.md](payment-providers-stripe-connect.md)
