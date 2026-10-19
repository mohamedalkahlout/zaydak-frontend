# admin — the platform console

Next.js 16 (App Router) + React 19 + Apollo Client 4 + Zustand + zod, sharing `@repo/ui` with the vendor dashboard. `admin` and `super_admin` sign into the **same** app.

An npm workspace named `admin`, so any Turborepo task takes `--filter=admin`.

## Getting started

Install from the **repo root** — this app has no lockfile of its own:

```bash
cd ../..
npm install
```

Copy `.env.example` to `.env.local` (`NEXT_PUBLIC_GRAPHQL_URL` must point at the back-end), then:

```bash
npm run dev     # http://localhost:3002
```

Sign in with a seeded `admin` / `super_admin` account — see `back-end/prisma/seed.ts` for the addresses and `back-end/.env` for the passwords.

## Screens

| Route | What it does |
|-------|--------------|
| `(auth)/login` | Password sign-in. Applies the role gate. |
| `(auth)/verify-otp` | Two-step OTP sign-in. Same role gate. Draws as many boxes as `sendOtpCode` says the code has (`data.code_length`, 4 to 8; 6 when absent); completing the last one verifies immediately, and Verify remains as a fallback. |
| `(auth)/forgot-password` | Sends a reset code (`AdminRequestResetCode`) and carries its `code_length` to the next screen in the URL. `features/auth/lib/legacy-code-length.ts` is transitional: an API older than `code_length` refuses the selection at validation, so the send is retried once without it and 6 boxes are drawn. |
| `(auth)/reset-password` | Consumes the code (`?code_length=` boxes), sets a new password, clears the session. |
| `/analytics` | Platform reporting across every shop: the vendor dashboard's own analytics operations called with no `X-SHOP`, plus the provider-cost tables (`manage_plans`). Includes **Sales by channel** (2026-09-29): `salesByChannel` over a 7/30/90-day window, drawn in CSS (a share ribbon and one row per channel; this console ships no chart library), with channel names and colours mirrored from the vendor app in `features/analytics/lib/sales-channels.ts`. It is its own query, and an API that does not know the field leaves the panel out (`lib/schema-mismatch.ts`) rather than the page. |
| `/users` | Every account on the platform. Needs the `manage_users` permission. |
| `/withdrawals` | Payout requests across every shop, filterable by status. Approve, reject, hold, or delete. Needs `manage_all_orders`. |
| `/commissions` | Commission tiers, keyed by shop balance. Full CRUD. Needs `manage_all_shops`. |
| `/payment-fees` | The platform's processor-fee schedule (2026-10-04): what each payment method costs the platform per order, as a percentage, a fixed part and an optional cap, one row per method and currency. Add a fee, edit one, or switch one off; there is no delete, and a per-shop fee cannot be entered. **A saved fee applies to every shop**: it moves the negotiation margin floor from the next session, and outcome margins and profit figures are priced on read, so past figures move too. The page says so above the table and the form repeats it beside Save. The payment methods on offer come from the server (`paymentGatewayFees.gateways`), and a row whose method no order can use is shown without an edit action. Carrier cash-on-delivery charges are not modelled. Needs `manage_all_shops`. See `back-end/docs/features/payment-gateway-fees.md`. |

Every authed route must also be listed in `proxy.ts`'s `matcher`. A route missing from it is never seen by the guard and renders for a logged-out visitor.

### Withdrawals move money

`updateWithdrawalStatus` is not a status flip. Approving a request debits the shop's `current_balance` into `withdrawn_amount` and appends a `payout` row to the ledger; moving it back out of Approved reverses both. The console therefore confirms every status change and names the effect, rather than letting an admin move money with a menu click. See `src/features/withdrawals/status.ts`.

Deleting an **approved** withdrawal is disabled in the UI. `WithdrawalsService.delete` only stamps `deleted_at` — it never returns the money — so a deleted approved payout would strand the amount. This is a UX guard, not a security boundary; the mutation still accepts the call. Tracked in the root `TODO.md`.

## GraphQL and codegen

Operations live in `src/features/<feature>/api.ts` and are written with the **generated** `gql` tag from `@/shared/api/generated`, so every document is a `TypedDocumentNode` — `useQuery`/`useMutation` infer their data and variables with no generic argument.

```bash
npm run codegen        # regenerate from ../../back-end/src/schema.gql
npm run codegen:watch
```

Run it after changing an operation or after the back-end schema changes. Codegen validates documents against the SDL and refuses to emit on a mismatch, so a field that no longer exists fails the command instead of failing at runtime. The generated output is committed.

Units cross the GraphQL boundary in **major units**, not the integer storage: `WithdrawalEntry.amount` is `fromCents(amount_cents)` and `CommissionEntry.commission` is `commission_bps / 100`. The back-end converts back on write with `toCents` / `bpsOf`, both of which round to the nearest integer — which is why the commission form rejects a third decimal place instead of silently rounding it.

## How auth works

It mirrors the vendor dashboard deliberately rather than sharing code:

- `refresh_token` lives in an **httpOnly** cookie; the `access_token` is mirrored in a short-lived readable cookie so Apollo can attach `Authorization` after a reload.
- `/api/auth/session` writes and clears the jar; `/api/auth/refresh` rotates the pair server-side. Concurrent refreshes share one in-flight request, so the rotating refresh token can't trip the back-end's reuse detection.
- On `TOKEN_EXPIRED` the Apollo error link refreshes once and replays the operation; any other auth error forces a logout.

It differs from vendor in two ways: **no `X-SHOP` link** (this console is platform-scoped) and **no `active-shop` store**.

### The role gate is not the security boundary

`isAdminRole()` (`src/shared/auth/roles.ts`) runs on the login screen **before** the session cookie is written, so a `vendor` or `customer` never receives a token the route guard would accept. `proxy.ts` only checks that a cookie exists — it never decodes the JWT. **Every real authorization decision is made by the back-end, per operation.**

## Layout

- `src/app/(auth)/` — the two-column sign-in layout with the hero panel.
- `src/app/{users,withdrawals,commissions,payment-fees}/` — the console routes, each wrapped in `DashboardShell`.
- `src/features/<name>/` — `api.ts` (operations), pure logic beside it, `components/` for the screen.
- `src/shared/components/` — thin wrappers that feed this app's data into `@repo/ui`'s shell.
- `src/shared/i18n/` — English/Arabic, resolved from the `locale` cookie (no `/[locale]` segments). Catalogs in `src/shared/messages/`.

The vendor dashboard's mandatory contextual save bar is scoped to `apps/vendor` — it is driven by the `unsaved-bar` store, which this app does not have. Admin edit screens use a modal with an explicit Save.

## Observability

`@sentry/nextjs` is wired like vendor: `instrumentation.ts` / `instrumentation-client.ts`, server+edge configs, `shared/sentry/scrub.ts`, `error.tsx` / `global-error.tsx`, and `tunnelRoute: "/monitoring"`. Capture is a no-op until `NEXT_PUBLIC_SENTRY_DSN` (and optionally `SENTRY_DSN` / `SENTRY_AUTH_TOKEN`) is set on the deployment. Live event proof remains an ops task (P04-T02).

## Tests

```bash
npm test
```

Vitest with jsdom. Suites sit in a `__tests__/` directory beside the code they cover, and target pure logic: the role gate, the zod schemas, the back-end error mapper, the withdrawal status rules, the display formatters, and en/ar catalog parity. There are no component or route tests yet.

## Deployment

`vercel.json` targets the Next.js framework preset. Set the Vercel project's **Root Directory** to `apps/admin`.
