# Bank transfers

The store controls cash on delivery, card payment and bank transfer from its payment settings. Checkout and footer read `shopPaymentOptions`; an unavailable method cannot be selected. A failed settings request blocks order placement and offers retry.

Bank transfer requires a signed-in buyer, an active Saudi bank account and SAR. Checkout reads `shopBankAccounts`, shows the account holder, IBAN and optional account number, SWIFT and notes. IBAN is grouped for reading with `dir="ltr"`; copy uses the original unspaced value. `createOrder` receives `bank_account_id`.

The order confirmation asks the buyer to transfer and upload a receipt. The order page uses the frozen `payment_instructions` account, so a later account edit or deactivation does not change existing payment instructions. It shows the payment deadline where available.

`POST /bank-transfers/orders/:orderId/receipt` receives a single multipart request, with file field `file`, the frozen account id, sender name, optional sender bank, reference, transfer date, optional claimed amount and note. XHR reports upload progress. On 401 it refreshes the shop session once and retries once; another 401 signs out that shop. A duplicate/conflict response is never retried automatically.

Receipts accept JPG, PNG, WebP and PDF up to 5 MB. Browser validation checks file type/size, positive claimed amount with at most two decimals, a transfer date within six months and no future date. The server repeats these checks and inspects the actual bytes. A claimed amount mismatch is shown explicitly.

`orderBankTransfers` uses `no-cache`. Pending and approved claims hide cancellation and submission controls; the API independently enforces these rules. Rejection shows the store's reason and allows a corrected receipt. No automatic refund is implied.

Receipt downloads use the actual buyer's bearer token and X-SHOP in `fetch`, then save a temporary Blob. Only the API's exact relative receipt path is accepted, redirects are rejected and responses bypass the browser cache. Receipt paths carry no signed credentials; sharing a path grants no access.

Important files:

- `src/features/bank-transfers/api.ts` — GraphQL contracts.
- `src/features/bank-transfers/components/` — account instructions, receipt form and history.
- `src/features/bank-transfers/lib/receipt-client.ts` — authenticated upload/download.
- `src/features/bank-transfers/lib/receipt-schema.ts` — browser validation.
- `src/features/bank-transfers/use-payment-options.ts` — store payment availability.

Tests cover session rotation, multipart field names, conflict behavior, download origin restrictions, file/date/amount validation and Arabic/English key parity.
