# TODO — Project Backlog

The active, durable backlog for **Zaydak**. Every entry represents a high-signal, actionable item needed for launch readiness, product completeness, reliability, and security.

- Full historical work logs, changelogs, and completed sweeps are archived in **[TODO_ARCHIVE.md](TODO_ARCHIVE.md)**.
- Ranked priority order (T0 launch blockers to T5 cleanup): **[PRIORITIES.md](PRIORITIES.md)**.
- Production execution phases and acceptance evidence: **[docs/production-readiness/README.md](docs/production-readiness/README.md)**.
- Each item is tagged with its owner (`VEN`, `BE`, `ADM`, `INFRA`, `UI`, `SEC`) and priority tier (`T0`–`T4`).
- Akram's back-end backlog, and the suggested launch gaps filed with it, live in their own file: **[TODO-AKRAM.md](TODO-AKRAM.md)**. Its boxes are not counted in the Index below.

---

## Index

Counted from the checkboxes themselves on 2026-09-18, recounted 2026-09-20 (the AI row was four low before the audit entry), and recounted again on 2026-09-23 after the sweep described below. Recounted on 2026-09-28: the Vendor row was two high and the AI row three high before the sixth Telegram test's entry. The 2026-09-20 pass closed nine items in
one pass: store-import stuck PENDING + Drop on the progress screen (two
boxes), stale entitlement/column drift cleanup (one), and six already-shipped
leftovers whose checkboxes were stale (Sidekick mobile panel, unread sparkle
badge, AiFilledMark chips, abandoned-carts named views, cadence step editor,
`check:drift` in CI).

So the two columns are produced differently on purpose, and the difference is
stated rather than assumed:

- **Open is mechanical.** `- [ ]` or `- [~]` outside `## Done`. Never typed by
  hand — and **the leading `^` is a trap**: nested boxes are indented, so an
  anchored pattern silently undercounts. Match optional leading space:

  ```
  grep -cE '^\s*- \[ \]' TODO.md      # untouched
  grep -cE '^\s*- \[~\]' TODO.md      # started, still open
  ```

- **Production-only is a judgement**, and pretending otherwise is what broke it
  last time. It means *acting on this opens a console rather than an editor* —
  so an item with a little code beside the console work still counts, and a
  regex over the tags cannot decide it.

| Area | Open | of which production-only |
|---|:---:|:---:|
| [Vendor dashboard](#vendor-dashboard) | 32 | 0 |
| [Storefront](#storefront) | 15 | 4 |
| [Admin console](#admin-console) | 0 | 0 |
| [Back-end & API](#back-end--api) | 39 | 7 |
| [AI & Integrations](#ai--integrations) | 80 | 33 |
| [Platform & infrastructure](#platform--infrastructure) | 28 | 20 |
| [Design system & UI](#design-system--ui) | 4 | 0 |
| **Total open** | **198** | **64** |

**Akram's backlog is not in this table.** It has 41 open boxes: 31 assigned to
him and 10 suggested launch gaps with no owner yet. They live in
[TODO-AKRAM.md](TODO-AKRAM.md), which keeps its own count.

**2026-10-14 — 199 to 198.** AI & Integrations: Settings → Instagram shows the
account's real posts and 30-day figures (−1); the reply-mode selector shipped,
leaving its box started (`[~]`, still open). Production-only unchanged.

**2026-10-14 sixty-seventh pass — 200 to 199.** Reliability & Auth: A grace period
for refresh races (`BE` + `VEN` + `SF`). Shipped 15-second grace window in
`AuthService.refreshToken` and `CustomerSessionService.rotate` with cached active
session recovery, eliminating multi-tab refresh-race logouts while preserving full
family revocation against replayed stolen tokens. Added cross-tab Web Locks
(`navigator.locks`) coordination in Vendor and Storefront, and updated both
`/api/auth/refresh` routes to preserve session cookies on `TOKEN_ROTATED_RECENTLY`.
Back-end −1; production-only unchanged. Counted mechanically.

**2026-10-14 — 201 to 200.** AI & Integrations: the Zernio migration is applied
to the live DB and the API image rebuilt (production-only −1).

**2026-10-14 sixty-sixth pass — 202 to 201.** Vendor dashboard: Send invoice from
draft (`BE` + `VEN`). Shipped backend `sendDraftInvoice` mutation with customer email
resolution, custom merchant message, bilingual email template rendering, and mail
dispatch with shop reply-to. Added interactive Send Invoice dialog on the Vendor
draft order form. Vendor −1; production-only unchanged. Counted mechanically.

**2026-10-14 — 194 to 202.** Instagram through Zernio (AI & Integrations):
eight follow-ups, four of them production-only (apply the SQL, set up Zernio,
the live test, dropping the Meta-era columns).

**2026-10-10 sixty-fifth pass — 197 to 196.** Split the remaining chat identity
and cart responsibilities: `ChannelIdentityService` owns transport registration
and thread binding, the existing `CustomerIdentityService` resolves customers,
and `CartMergeService` preserves the guest cart's offers and holds on adoption.
All callers and Nest module exports now use these services; storefront login
keeps `CartSyncService`. The security audit also closed a confirmed inbound
gap: linked vendor accounts now recheck active/deleted state and
`manage_own_shop` at message/callback resolution, enrollment and confirmation.
The broad tool-registry audit remains open. No database or production setting
changed. Focused regression tests, full backend typecheck, scoped ESLint,
Nest build and the preview dependency graph passed. Back-end −1;
production-only unchanged. Counted mechanically.

**2026-10-10 sixty-fourth pass — 200 to 197.** Three existing code boxes closed:
reviewed photo drops clear old media on re-import; admins cannot manually cancel
an accepted card payment before refunding it; disputes over unapplied payments
do not debit the shop, and resolutions use the recorded hold. The tenant audit
is in progress: chat confirmations now bind account, shop and channel, and
Stripe/carrier webhook retries claim failed events atomically. Verification:
14 focused suites / 766 tests passed across the final runs; full backend
typecheck and scoped ESLint passed. Reference-scope,
signature and SSRF checks also passed (the real-socket SSRF suite needed an
approved run outside the sandbox). Stale shop/order fixtures found by these
checks were corrected without weakening stock-race assertions. Evidence and
remaining scope: [audit record](docs/production-readiness/p02-todo-audit-2026-10-10.md).
Back-end −1, AI −2; production-only unchanged. Counted mechanically after editing.

**2026-10-07 Country profiles follow-ups — 202 to 200.** Admin `enabled` toggle and storefront PS `city_code` picker closed; enable-SA stays open until Saudi launch. Platform −2 (−1 production-only). Counted mechanically after the edit.

**2026-10-07 Country Capability Profiles — 199 to 202.** Three open boxes (Admin UI, storefront PS city_code picker, enable SA). Five foundation boxes closed in the same entry. Platform +1 production-only (Admin UI). Counted mechanically after the edit.

**2026-10-07 doughn shop facts and review-strip drag — 200 to 199.** One box closed, none production-only. The import review strip reorders a gallery photo by dragging it onto another. A doughn home now uses the shop's name, store address and time zone when they are set; opening hours and the measured basket art stay the sample, so that box stays open. Counted mechanically after the edit.

**2026-10-06 assembled products and rail home — 204 to 200.** Four boxes, none production-only. A rail shop's public home hangs that shop's products. A drip home reads the `drip-gelato` assembly. A part can carry a cut-out URL. A sale, a restock and a cart hold move each tracked part. Counted mechanically after the edit.

**2026-10-06 rail template — 202 to 203.** One box, not production-only. The clothing-rail demo is a fourth storefront template. The public home still uses the default storefront, and the rail does not yet hang the shop's own products. Counted mechanically after the edit.

**2026-10-06 theme customization.** Closed the doughn home-render box. A doughn shop's public home renders that template outside the default header and footer, from saved theme JSON or the bundled sample. The theme library is a showcase: Preview opens the sample, and a custom theme is contact on Settings → WhatsApp. The library does not apply a theme or open a copy, photo and collection form. Recounted after the edit: 202 open (vendor 35).

**2026-10-06 sixty-third pass — 202 to 204.** Three boxes, none production-only. A product can be assembled from other products and the cart prices that selection. Still open: the drip preview reads sample data, a scoop has no cut-out of its own, and a sale does not move the part products' stock. Counted mechanically after the edit.

**2026-10-05 sixty-second pass — 200 to 201.** One box, not production-only. The drip gelato-bar demo is a third storefront template; its Genesis Works art still has to be cleared before a merchant goes live. Counted mechanically after the edit.

**2026-10-05 sixty-first pass — 199 to 200.** One box, not production-only. The hullo coffee-window demo is a second storefront template; its Genesis Works art still has to be cleared before a merchant goes live. Counted mechanically after the edit.

**2026-10-05 sixtieth pass — 200 to 199.** One box, not production-only. The store-import commit lock now has a two-connection Postgres test: a Stop before the lock, a Stop that waits behind it, and a save that waits behind it. Counted mechanically after the edit.

**2026-10-05 fifty-ninth pass — 202 to 200.** Two boxes, neither production-only. A shop can store `storefront_template` from "Use this theme", and the theme editor previews that template in an iframe. The sample art, the shop's own products, and rendering the template on the storefront stayed open. Counted mechanically after the edit.

**2026-10-05 fifty-eighth pass — 203 to 202.** One box, not production-only. The negotiation outcomes page no longer hides its breakdown on a schema mismatch: that branch was already gone, and a rollup error shows in the three cards. Counted mechanically after the edit.

**2026-10-05 fifty-seventh pass — 206 to 203.** Three boxes, none production-only. Abandoned-cart status counts already follow the other chips through `abandonedCartStatusCounts`, and select-all matching already reads `abandonedCartIds` (500 ids, `total` when cut). Coupon and collection create forms already register as live forms, and the already-open guard covers their cards. Counted mechanically after the edit.

**2026-10-05 fifty-sixth pass — 209 to 206.** Three boxes, none production-only. The notifications landing card is titled Reply-to address. A collection Sidekick handoff marks the fields it filled, and the product-form drawer does not inherit the product form's marks. Every tool failure carries a `code`: a thrown error uses the exception's error code or `AGENT_TOOL_FAILED`, and the dispatcher stamps `AGENT_TOOL_UNREGISTERED` and `AGENT_PLAN_GATE`. Counted mechanically after the edit.

**2026-10-05 fifty-fifth pass — 212 to 209.** Three boxes, none production-only. Orders export past 10,000 streams from `GET /api/v1/orders/export.csv`, and both export paths write `AuditAction.EXPORT`. The operations inventory was regenerated from the schema; the claim mutations are gone. `SALE_BOOST` and the second image rendition stayed open: LCP is still unmeasured, and no tile size is named. Counted mechanically after the edit.

**2026-10-05 fifty-fourth pass — 218 to 212.** Six boxes, none production-only. A vendor cannot set `payment-refunded` by hand; an admin still can, and the pay link closes that status even while the order is open. The pay-link answer now carries `closed_reason`, so the storefront skips its second read when the reason is present. A tax-inclusive line refund records VAT and does not add it to the money. The category-fill estimate reads how many content requests are left this hour. A client-side visit to `/login` or `/register` opens the sign-in popup and goes back; a cold load still renders the page. Segment membership already followed the sale definition (2026-09-29). Counted mechanically after the edit.

**2026-10-05 fifty-third pass — 221 to 218.** Three boxes in the card-payment entry, none production-only. `listRefunds` now follows every Stripe page. Two were already closed in code: a `payment-mismatch` timeline step says the shop is checking the payment, and `updateRefundStatus` already refuses a move out of `approved` (`invalid_transition`). Counted mechanically after the edit.

**2026-10-05 fifty-second pass — 225 to 221.** Four boxes, none production-only. The orders list's Date chip now takes a custom calendar range and re-anchors Today at the next local midnight. Three were already closed in code: the sales-by-channel skeletons are captured, `editOrder` writes `total_cents` net of the wallet and refuses an edit below it, and processor fees are priced on `total_cents` alone. Counted mechanically after the edit.

**2026-10-05 fifty-first pass — 235 to 225.** Ten Back-end boxes in the
`X-SHOP` audit, none production-only. Nine were already closed in code and
still open here (returns, saved prompts, coupons, product margins, shop
owner contact, shipping providers, the smaller header-only writes, attachment
uploads, inventory and purchase-order line targets). The tenth, the four
plausible findings, was three refutations and two real holes: a vendor
omitting `X-SHOP` on `createManufacturer` still wrote a platform-global row,
and a guest cart lookup matched on `session_id` alone. Both are fixed.
Counted mechanically after the edit.

**2026-10-04 fiftieth pass — 242 to 230 (still running).** The code boxes of
every area, worked by parallel agents over 2026-10-01 to 2026-10-04, each box
checked against the code before anything was built. Closed so far: 60; 5 more
moved to started, each with what is left written on the box (a migration, a
provider console, or the owner's call). Eight were already done in code and
never ticked, or wrong as written (the older charts' gridlines and dates, the
admin channel card, the `placed_via` constant, the API image rebuild, the
inventory repair re-run, the Stripe mismatch refund path, and
`storefrontUrlConfigured()`, which has two callers). Built: a Stop during a
store import's commit (its batches, its AI pass, its preview write), photo
order in scan review and AI categories for a review page; one copy of the time
buckets and a week bucket; the orders list's channel filter; attribution ROAS
on zero revenue; the storefront assistant's refusal wait, the home marquee's
in-stock and sale preference, and one wording for a refunded late payment
across storefront, bot and pay link; the orphaned Msegat row; Sidekick's
windows on the shop's calendar, `update_product` and `update_collection`
keeping the other locale, the share payload's currency, and the chat-to-form
handoff's edges (clearing a field, the quiet refusal row, Retry, the outlived
draft, the already-open card, the composer chip); the contact-form reply's
sender, labels, display name, double send, delivery state and report line;
negotiation session scope, input caps and after-fee margins; and the money
paths (a merchant's cancel, the `payment-mismatch` flag, `charge.refunded`, a
charge already refunded, the failed-refund bell, goods-refund status races, a
re-approval reading its refund back, and a refund racing a settle on real
Postgres). Two scope bugs came out of it: `orders(filters.shop_id)` could list
another shop's orders (fixed, its own entry), and the sweep that fix asked for
found that `X-SHOP` names a shop without proving ownership: ten confirmed
findings and four plausible ones, filed as the first Back-end entry and being
fixed in this pass. The contact-link audit ran read-only and found nothing.
Checked and left for the owner: `sessionShopIdFor`'s binding (still enforced),
`import_product`'s attestation wording (still a draft), a wrong-amount refund
on an open order (unsafe as the settle stands), the daily digest's window.
Opened: 49 (each change's follow-ups and the audit's findings).
Production-only: Back-end fell by three (the image rebuild, the repair re-run
and the contact-link audit were console work, each verified read-only) and
rose by one (rebuild the API image with this pass's changes); AI rose by one
(set the abuse mailbox for reply emails). Counted mechanically per area after
the edit.

**2026-10-01 forty-ninth pass — 194 to 242.** The AI area's code boxes
worked through in one pass, and what doing them found. Closed in AI &
Integrations: sixteen. Six were already done in code by a4fdad29 and never
ticked (profit at line prices, peak hours, the orders count, the top
products window, the revenue identity, the prompt ceiling), and four of
those gained a follow-up change (the weekly card's title and Analyze dates,
the top products card's window, `yearlySales` counting wallet spend, the
prompt cut to 21,507 with eight contradictions fixed). Built: the store
import cancel race, the negotiation visitor gate, payment fees in the
margin floor, negotiation rollups, the closed-order refund, Msegat's OTP
half, the Sidekick live form channel and the contact-form email reply (the
last three on decisions the owner took that day), and the shared view's
currency closed as stale. Volume negotiation is started: Phase A shipped,
Phase B waits as a patch for the owner. An adversarial review of the money
and sign-in paths found two high and four medium defects in the day's own
work, all fixed before this pass. Opened: 61 in AI (each change's
follow-ups and the review's lower findings), 3 in Back-end (the unset shop
timezone, the wallet sales basis, latent VAT double count; one stale box
closed), 2 in Storefront; Vendor closed one (analytics beyond counters).
Production-only rose by five (apply the volume patch, the Stripe webhook
event, the Stripe CLI walk, the Resend domain, a dashboard walk after the
rebuild). Counted mechanically per area after the edit.

**2026-09-30 forty-eighth pass — 195 to 194.** One AI box closed, and it was production-only: order #20260930484722's address, obsolete now that the order was cancelled on its transfer deadline. Counted mechanically after the edit.

**2026-09-30 forty-seventh pass — 196 to 195.** One AI box closed: Release
5's polish (a chat takes a negotiated price; an inbox thread lists its
orders; the channel analytics and filter were already in the code).
Counted mechanically after the edit.

**2026-09-30 forty-sixth pass — 196 to 195.** Five boxes closed: AI — the
claim-link code, a conversation summary, delivery to somebody else and
the single-product import's dashboard entry; Back-end — retiring the claim
links. Four opened: Back-end — drop `cart_claims`, an uncalled
`storefrontUrlConfigured`, the stale operations inventory; AI — aligning
`import_product`'s attestation. The attestation wording moved to started,
pending the owner. Counted mechanically per area after the edit.

**2026-09-30 forty-fifth pass — 201 to 196.** Five AI boxes closed, none
opened: money in the chat, a claimed chat with no account, the image
quota anchor, the dev model, and a decision on retrying a timed-out
Telegram send. Counted mechanically after the edit.

**2026-09-30 forty-fourth pass — 206 to 201.** Five boxes closed, none
opened (AI: Claude and Gemini turns metered at zero; sub-cent costs, which
the reports already read exactly; a withheld reply as silence; the
cart-claim word in the log; a Telegram receipt download retried). Counted
mechanically after the edit.

**2026-09-30 forty-third pass — 204 to 206.** One box closed (AI: the
Claude cache breakpoints are read from) and three opened (AI: order
#20260930484722 ships to the wrong city, production-only; retry a Telegram
receipt download; sub-cent costs stored as 0). Counted mechanically after
the edit.

**2026-09-30 forty-second pass — 203 to 204.** One box opened (AI: check
that the Claude cache breakpoints are read from, and what they save). Counted
mechanically after the edit.

**2026-09-30 forty-first pass — 202 to 203.** One box closed (AI: the
customer chat model was chosen, production-only) and two opened (AI:
Gemini turns metered at zero cents; a withheld reply is silence).
Counted mechanically after the edit.

**2026-09-29 fortieth pass — 199 to 202.** Three boxes opened, none closed
(AI: choosing the customer chat's `sales_model`, which is production-only;
replaying the egg order on Telegram after the rebuild; logging what the
cart-truth check matched). Counted mechanically after the edit.

**2026-09-29 thirty-ninth pass — 198 to 199.** One box closed (Back-end:
`localDayStart` exact to the millisecond) and two opened (Vendor dashboard:
the older charts' dates in the dashboard language; AI: the weekly card's
change percentages compare a partial day with a full one), none
production-only. Three boxes moved to started: refunds off the gross
figures, negative attribution groups, and `get_profit_breakdown`. Counted
mechanically after the edit.

**2026-09-29 thirty-eighth pass — 178 to 199.** Twenty-one boxes opened, none
closed, by the change that made a sale every placed order except cancelled and
failed, and that added sales by channel: three Vendor dashboard, one Admin
console, nine Back-end (one production-only: rebuild the API container and
apply the migration) and eight AI (one production-only: walk a live Sidekick
turn after the rebuild). Counted mechanically after the edit.

**2026-09-29 thirty-seventh pass — 193 to 178.** Fifteen boxes closed (seven Vendor
dashboard items/decisions including exact draft coupon preview, eight Back-end items/decisions
in chat, import, contact identity, and settlement policy), none production-only,
none opened; counted mechanically after the edit. Palestine unified as «فلسطين»
across all pickers; payout details and cart reminders confirmed in dashboard locale;
Hofuf/Mubarraz accepted under Al Ahsa MOMRAH coding; draft coupon dialog supports
active search, on-behalf customer evaluation, automatic collection-scope resolution
and shipping discounts without rate-limiting; foreign/unowned store slugs render
styled 404 without silent rewrite; draft "Mark as paid" retains CASH off-platform
settlement; sandbox carriers excluded from customer chat checkout menus; imported
stock recomputed after commit; customer payment choice remembered across conversation
turns; long delivery menus condensed to lead cheapest and fastest options; contact
identities restricted to verified phone without loose email links; COD platform
settlement maintained; customer locale aligned with order locale and full Arabic
names preserved without patronymic splitting; non-unique contact email index policy
confirmed for checkout compatibility.

**2026-09-28 thirty-sixth pass — 202 to 193.** Nine Vendor
dashboard boxes closed in code, none production-only, none opened; counted
mechanically after the edit. Dates and money follow the dashboard locale
(server and client agree), the named left/right classes mirror, money inputs
use the shop currency in the dashboard's script, segment insights spend in
that currency, filter descriptions carry Arabic, tags prefer the dashboard
language, a failed editor image upload is a translated toast, Duplicate opens
the create form, and the three unused Sidekick cards are gone.

**2026-09-28 thirty-fifth pass — 190 to 202.** The vendor i18n sweep (every
screen through next-intl, the catalogues split one file per namespace) closed
its own box and opened twelve Vendor dashboard boxes, none production-only:
dates and money that follow the browser, left/right classes that do not mirror,
a hardcoded `SAR`, USD in segment insights, English-only filter descriptions
(`BE`), English tag names, the editor's silent upload errors, a dead Duplicate,
dead tool cards, and three decisions (Palestine's name in the address picker,
the language of payout details and of cart reminders). Counted mechanically
after the edit.

**2026-09-28 thirty-fourth pass — 191 to 190.** Six boxes closed in code,
none production-only, and five opened by the sixth live Telegram test (two
of them production-only); counted mechanically after the edit. Closed: a
caption on the product form's AI images and in the Sidekick's image tool
(its entry moved to Done), the SEO card's English and Arabic rows under
headers of their own, a minimum price of its own per negotiating option
(`setNegotiationOptionFloors`), a real-Postgres draft conversion test, the
chat checkout's `confirm` run end to end on Postgres, and `order.created`
surviving a crash after the commit (`created_event_pending` and a minute
sweep). The two real-database tests found two live bugs, fixed in the same
change: every order carrying a coupon with a per-customer cap had failed
since 2026-04-18 (`pg_advisory_xact_lock(bigint, bigint)` does not exist),
and `createOrder` never checked whose cart `cart_id` was (`cart_not_yours`).

**2026-09-28 thirty-third pass — 205 to 191.** Fourteen boxes closed and
none opened, none production-only; counted mechanically after the edit.
Eleven closed in code: the storefront's REST calls in the customer-session
check (its entry moved to Done), a boot page for an `UNUSABLE` integration,
Storage saying when the server does not use it, a real-Postgres test of
concurrent settles, the dead `ai_request_logs` writer deleted, shot options
checked before the paid vision call, Arabic city and district names for a
National Address (its entry moved to Done), a delivery-options tool for the
chat, the products whose dropped photos did not carry, unwound orders on the
negotiation rows and `redeemed_only`, and the outcomes CSV export with a
product drill-down. Three the code had already closed: the storefront
operations CI check, the AI profile's city, and the abandoned carts'
deleted-customer message.

**2026-09-28 thirty-second pass — 227 to 205.** Twenty-two boxes closed and
none opened, none production-only; counted mechanically after the edit.
Twelve closed in code: a converted cart ordered twice (`CART_ALREADY_ORDERED`),
the P0 unproven phone at registration (`register` refuses one; an admin can
clear a squatted number), `adjust` webhooks sent before other callers commit,
`editOrder`'s isolation, the per-number OTP race (an advisory lock, proven on
Postgres), `@lid` WhatsApp senders, a webhook over 100 KB (a 413 that is
logged, and 5 MB for that route alone), every missing quote detail at once,
"pay again" on the order page, "Create up to N products", the flaky pay-page
test, and `AuthShell`'s test (its entry moved to Done). Ten the code had
already closed: the dead cart-line twin, the variant sale on the parent, the
shop country, AI cost across midnight, the step-2 migration guards, the
override-lock race test, the draft shipping refusal, the stored clear, the
six-digit sign-in screens and `send_login_link`.

**2026-09-27 thirty-first pass — 224 to 227.** Four boxes closed in code:
the bank-transfer self-review rule now sees phone customers, an expired
negotiated offer is never priced at list in silence (the storefront sends
the total it showed), a replayed `createOrder` attempt publishes nothing of
its own, and the storefront codegen box (stale: HEAD passed) closed with
tests excluded from codegen. SMS pumping is started — the per-shop hourly
cap shipped; the country limit waits on the owner. Seven opened, none
production-only: a merchant-paid transfer with no reviewer, a converted
cart ordered twice, `adjust` webhooks sent before other callers commit,
`editOrder`'s isolation, the per-number OTP race, REST calls outside the new
customer-session CI check, and a pay-page test that flakes under load.

**2026-09-27 thirtieth pass — 222 to 224.** A live test sent the owner one
receipt twice and never offered a delivery company: both fixed in code, and
two boxes opened, both production-only — why Telegram is slow from the API
container, and reading how long OTO really takes now that the chat waits
12s and logs it.

**2026-09-27 twenty-ninth pass — 222 to 222.** Transfer orders have a
payment deadline (30 minutes by default, from the environment): its box
closed, and a live walk of it opened (production-only).

**2026-09-27 twenty-eighth pass — 220 to 222.** The transfer receipt on
WhatsApp shipped at both ends (the customer's chat and the owner's assistant
number), closing its box; three opened — syncing the WhatsApp webhooks after
the rebuild and a live walk (both production-only), and the silent 500 on a
webhook over 100 KB.

**2026-09-27 twenty-seventh pass — 219 to 220.** A transfer receipt sent as
a photo in the Telegram chat reaches the owner (dashboard and vendor bot) and
is approved or rejected there: its box closed, and two opened — the same on
WhatsApp, and a live walk (production-only).

**2026-09-27 twenty-sixth pass — 218 to 219.** Tracing a bank transfer
ordered in the chat found it cannot be confirmed from the chat at all: the
receipt-photo box was reworded to say so, and a payment-deadline box opened.

**2026-09-27 twenty-fifth pass — 216 to 218.** The merchant picking which
options of a product negotiate opened two AI & Integrations boxes: walk it
live (production-only) and a floor of its own per option.

**2026-09-27 twenty-fourth pass — 217 to 216.** `negotiate_price` agrees a
price for one option of a product, closing its box.

**2026-09-27 twenty-third pass — 214 to 217.** The chat selling products
with options, and keeping the delivery picked, opened three AI & Integrations
boxes: walk it live (production-only), options in `negotiate_price`, and a
delivery-questions tool.

**2026-09-27 twenty-second pass — 213 to 214.** The fifth live Telegram
test (the last units called out of stock to the cart holding them, two
turns lost to a schema bound) opened one production-only AI & Integrations
box: walk it live.

**2026-09-26 twenty-first pass — 210 to 213.** The fourth live Telegram
test (a cart the chat made up, and a checkout that signed the customer out)
opened three AI & Integrations boxes: walk it live, the reply sent twice
after a Telegram stall, and a CI check that storefront operations admit a
customer. The live walk is production-only.

**2026-09-26 twentieth pass — 210 unchanged.** The chat's pay link forwards
straight to the card page and ends on the order with the checkout's popup;
no box opened.

**2026-09-26 nineteenth pass — 210 unchanged.** The third live Telegram test's
fixes (the address asked by code, payment by any wording, codes carry no
language, a fixed line above the summary) opened no box.

**2026-09-26 eighteenth pass — 209 to 210.** The second live Telegram test's
fixes (the name, the saved address, the read-back, the cart line, the
currency) opened one AI & Integrations box: Arabic names for a National
Address.

**2026-09-26 seventeenth pass — 206 to 209.** The chat takes the whole order
with no link out of it, and a Twilio Verify refusal leaves a code a super admin
can reveal: three AI & Integrations boxes (receipt photos in the chat, removing
the claim-link code, and an SMS provider that delivers — production-only).

**2026-09-26 sixteenth pass — 206 unchanged.** The staff refresh-token
rollback was fixed and its box closed; a box for a refresh-race grace period
took its place.

**2026-09-26 fifteenth pass — 201 to 206.** Step 4 of the phone-first order
shipped (storefront sign-in by phone and a code, as the customer's own
session): it closed that box and "drop the storefront's `SIGN_IN_REQUIRED`
branch", and filed six follow-ups — among them the staff refresh-token
rollback it found — plus one Design system box for an `AuthShell` test that
fails at HEAD. Counted mechanically after the edit.

**2026-09-26 fourteenth pass — 202 to 201.** Step 3 of the phone-first order
shipped (one E.164 key for a customer number) and closed its box.

**2026-09-26 thirteenth pass — 197 to 202.** Step 2 of the phone-first order
shipped (shopper relations on `customers`): it closed "carts, orders,
addresses and chat threads on that customer" and filed six follow-ups — among
them applying the migrations to the local database, a production-only item
(opening a console, not an editor), hence 42 to 43 in the second column.
Counted mechanically after the edit.

**2026-09-25 twelfth pass — 199 to 197.** Step 1 of the phone-first order
shipped (per-shop customers): it closed "a customer identity per shop",
dropped "tell an account when its number moves" (numbers no longer move),
and started "carts, orders, addresses and chat threads on that customer"
(`[~]`, still open). Counted mechanically after the edit.

**2026-09-25 eleventh pass — 197 to 199.** The owner's review put the per-shop
customer first and set the order of the phone-first roadmap; it added two
Back-end & API boxes (carts, orders, addresses and threads on the customer;
splitting `CartClaimService`). Counted mechanically after the edit.

**2026-09-25 tenth pass — 196 to 197.** Phase 1 of the phone-first roadmap
closed "a number sitting on somebody else's unproven account" (the proven
holder wins) and opened two Back-end & API boxes: a customer identity per
shop, and telling an account when its number moves. Counted mechanically
after the edit.

**2026-09-25 ninth pass — 187 to 196.** Release 4.1 of in-chat checkout closed
release 3's "tell the customer when their payment is confirmed" and opened
three AI & Integrations boxes (walk it live on Telegram and on WhatsApp, a
conversation summary); the phone-first identity roadmap opened seven Back-end &
API boxes. Counted mechanically after the edit.

**2026-09-25 eighth pass — 185 to 187.** Release 4 of in-chat checkout (the
Telegram chat) closed its own box in release 1's entry and opened three in its
own (a live walk, a claimed chat whose shared number opens no account, asking
for every missing checkout detail at once). Counted mechanically before
and after: 185 matched the table.

**2026-09-25 seventh pass — 181 to 185.** Fixing what the API logs showed
opened one Storefront box (redeploy the custom-domain `X-SHOP` fix) and three
Back-end boxes (rebuild the API image once the Telegram migration is applied,
localhost URLs on the API serving the public domains, and a negative per-feature
AI cost across UTC midnight). Added by hand from those two entries, not recounted.

**2026-09-25 sixth recount — 177 to 179.** Release 3 of in-chat checkout (card
and bank transfer in the WhatsApp chat) closed its own box and the Back-end box
for `createPaymentLink` accepting an order with no customer, and opened four
under AI & Integrations: telling the customer in the chat when a payment is
confirmed, walking both payment paths end to end, refunding a payment that
lands on a closed order, and a "pay again" on the storefront's order page. None
is console work. Counted, not added up. The engineering backlog is **140**.

**2026-09-25 fifth recount — 175 to 177.** Moving credential forms to POST
(Platform & infrastructure) opened two boxes: rotating the vendor password
that went out in a URL (production console work, hence the +1 there) and
checking that the dash.zaydak.com login hydrates. Counted, not added up. The
engineering backlog is **138**.

**2026-09-25 fourth recount — 171 to 175.** Release 2 of in-chat checkout
(ordering inside the WhatsApp chat, cash on delivery) closed its box and opened
five under AI & Integrations: turning it on for a pilot shop (production
console work, hence the +1 there), the manual checklist, an end-to-end test on
a seeded database, delivering to another recipient, and localized money in the
chat. Counted, not added up. The engineering backlog is **137**.

**2026-09-25 third recount — 155 to 171.** The chat-registration fix (release 1
of in-chat checkout) opened six boxes under AI & Integrations: the four later
releases, the old tool's audit report (production console work, hence the +1
there) and the panel's inert sign-in link. The planning that preceded it opened
ten under Back-end & API — bugs found in `createOrder`, the cart and the
WhatsApp inbound, one of them P0. Nothing closed. Counted, not added up.

**37 of the 171 are production console work** — rotating credentials, running
seeds, turning Upstash eviction off, configuring Twilio and Resend, pointing
`STOREFRONT_APEX_IP` at something real, running the reserved-handle audit,
funding a ScrapingBee account, Bunny custom hostname / URL rebase, and since
2026-09-23 running the contacts email resync and two one-off audits. No amount
of coding moves them; they need someone with the Render, Upstash, Neon and
BunnyCDN consoles open. The engineering backlog is the other **134**.

**2026-09-25 second recount — 159 to 151.** Sixteen boxes that needed no
decision and no console were closed: the shipping card's strings, the quote's
customer check, the status-count real-database test, the contact email reads,
the store-import carry, count, trace, override lock and label check, the
negotiation summary, the moderation order, and the storage status and
pull-zone probe. Eight follow-ups were opened with them. Neither set is console
work, so the production-only column keeps only the inventory entry's +1 from
earlier that day. Two entries whose last boxes closed moved to Done.

**2026-09-25 recount — 162 to 155.** Eleven boxes closed (seven Back-end,
four Vendor dashboard) and four opened with them, all under Vendor dashboard,
two of them the MOMRAH switch's. An earlier pass that day subtracted instead
of counting and put Storefront at 13: its two `SF`-tagged closures live under
Vendor dashboard, so Storefront never moved.

**2026-09-23 recount — 129 to 154 on a day that closed twenty-five.** Every open
box was triaged against the code; every one that needed no product decision, no
console and no human in a browser was built (draft payment terms and coupons,
store-import bulk fill / carry / photo drops / failure diagnostics / SEO rows,
reminder link tracking, abandoned-cart ops export and status counts, negotiation
outcomes, image captions, contact email column, storage credentials in the
console, the customer-bot budget gap, the concurrency spec, the build heap),
and three stale boxes were closed on evidence. Triage and review also found
bugs nobody had filed — shoppers could record an order as paid, no draft with
a customer could convert, a cart-session credential leaked through AI spenders —
and each fix and feature landed with the follow-ups it exposed. Recount; never
subtract. The Back-end production-only figure also absorbed three new one-off
runs (contact email resync, a contact-link audit, old store-import error rows).

This total moves for two reasons and only one of them is work getting done:
branches merge in carrying their own follow-ups. Five open Storefront items
arrived that way on 2026-09-13 alone — four with the Zaydak identity branch
(`090a86ef`) and one with the footer-theme entry above it — so a day that closed
twenty did not move the header by twenty. Recount; never subtract.

**Deferred work outside this release is not in the table.** Tap Commerce
Platform and the frozen merchant-wallet/withdrawal loop live under
[Deferred — outside this release](#deferred--outside-this-release); they must
not be picked up as launch tasks.

**2026-09-15 recount, and it is the clearest worked example of that rule yet.**
AI & Integrations was swept end to end: **all 17 of its open items were
resolved**, and the column reads 14 rather than 0. That is not a discrepancy, it
is the rule doing its job — the sweep shipped store import P1 through P6, the
contact form, the Telegram opt-in link and the Arabic typography overlay, and
each of those landed with follow-ups of its own that did not exist that morning
(a sitemap entry, a composer to disable, a caption control, two publish-gate
refinements, Salla/Zid awaiting an OAuth registration).
Of the original 17, **fifteen are closed, one is part-done and one is open** —
and both survivors are console work, exactly where they were forecast to land.
Part-done is ScrapingBee: the account exists and its key is verified live
against the provider (1000 credits, `Spb-cost: 1` on a real page), but the
production credential still belongs in the admin console rather than an env var,
and this key needs rotating because it was pasted into a chat. Open is the
Replicate row, which is two fields on a screen that already exists.
The third forecast console item closed by a **decision rather than by work**:
output-side image moderation is deliberately staying off, so no OpenRouter key
is being configured and no eval is being run.
Four corrections came out of it and are recorded in place rather than quietly
fixed: P3's admin half had already shipped, the Replicate item was no longer an
environment variable, the image-moderation "threshold" never existed, and the
store-import migration needed no manual step at all.

---

## Vendor dashboard

Focus: Missing merchant-facing capabilities, server-side data tables, and parity with standard commerce tooling.

### Storefront template: drip, a gelato bar (2026-10-05)

The owner asked for the Genesis Works "drip" demo (a Jeddah gelato bar: stack
scoops on a cone, then scroll through how it's made) rebuilt in React beside
doughn and hullo. It lives in
`apps/vendor/src/features/storefront-templates/drip` and opens at
`/theme-preview/drip`. "Use this theme" writes `drip`. A shop whose
`storefront_template` is `drip` renders that template as its public home
and drops the default header and footer on that route. The sample shop is
still the demo's, in English and Arabic, including the cone. See
`apps/vendor/docs/features/storefront-templates.md`.

- [ ] **Clear the art and copy before any merchant uses it (`VEN`).** The
      scoop cut-outs, shop photos and the sample copy are Genesis Works' demo
      assets. Get permission or commission our own.

### Storefront template: hullo, a coffee window (2026-10-05)

The owner asked for the Genesis Works "hullo" demo (a walk-up coffee window:
the sign lands as you scroll, then a menu, a cup builder and a camera roll)
rebuilt in React beside doughn. It lives in
`apps/vendor/src/features/storefront-templates/hullo` and opens at
`/theme-preview/hullo`. "Use this theme" writes `hullo`. The sample shop is
still the demo's, in English. See
`apps/vendor/docs/features/storefront-templates.md`.

- [ ] **Clear the art and copy before any merchant uses it (`VEN`).** The
      storefront photo, interior, drink cut-outs, camera-roll shots and the
      sample copy are Genesis Works' demo assets. Get permission or commission
      our own.

### Storefront template: doughn, previewable from Themes (2026-10-04)

The owner asked for the Genesis Works "doughn" demo (a bakery whose shutter
rolls up as you scroll, the sun rises, the camera walks in and the bread
flies onto a bake board) rebuilt in React as the first storefront template a
merchant could pick. It lives in `apps/vendor/src/features/storefront-templates/doughn`
with its sample shop in English and Arabic, and opens full screen at
`/theme-preview/doughn` from a new Theme library section on Online Store ->
Themes. That route is outside `store/` (a template owns the window scroll)
and behind sign-in through `proxy.ts`. Checked frame by frame against the
original on desktop, mobile and Arabic. See
`apps/vendor/docs/features/storefront-templates.md`.

- [ ] **Clear the art and copy before any merchant uses it (`VEN`).** The
      street plates, interior, door, shutter, bread cut-outs and the sample
      copy are Genesis Works' demo assets. Get permission or commission our
      own; `scene/geometry.ts` must be re-measured for new art.
- [x] **Let a shop choose its template (`BE` + `VEN`).** A field on the shop
      and a "Use this theme" action on the library card; preview only today.
      Done 2026-10-05: `shops.storefront_template` (null is the default
      storefront). An unknown id is refused. As of 2026-10-06 the theme library
      does not write that field: the cards are examples, Preview opens the
      sample, and Contact us goes to Settings → WhatsApp. A shop that already
      has an id still shows In use, and the sample is still what the preview
      draws.
- [~] **Feed the shop's own data into the template (`VEN`).** Name, products,
      prices, address and time zone are on the public home. A saved brand
      still wins over the shop name. The visit line and the map use the store
      address, and the clock uses `shops.timezone` when one is written.
      Still the sample: opening hours (a shop has no hours field) and the
      measured basket cut-outs. The theme library does not edit the JSON.
- [x] **Render the chosen template in `apps/storefront` (`UI`).** Move the
      template to a shared package so both apps use one copy.
      Done 2026-10-06: a doughn shop's home renders that template and drops
      the header and footer. Other routes keep the shell. The storefront
      imports the vendor doughn module, so there is one copy. A directory
      symlink for a workspace package needs elevation on this machine, so
      the import is a TypeScript path.
- [x] **Show it in the theme editor's preview (`VEN`).** An iframe of
      `/theme-preview/[templateId]` in place of the mock canvas.
      Done 2026-10-05: a shop that has chosen a template gets that iframe,
      sized to the device. A shop still on the default theme keeps the section
      canvas, because that template has no section anchors. The frame shows the
      sample. It does not stage copy, photos or a collection.

### Sales by channel on the analytics page (2026-09-29)

The merchant of `entaj` asked Sidekick for this week's sales and got 22.70
SAR, while 15 orders worth about 1,110 SAR had been placed that week, 12 of
them through the shop's Telegram bot. Every sales figure counted completed
orders only, and nothing completes an order on its own. The owner's call: a
sale is every order placed except cancelled and failed, less settled refunds
(the back-end half is under Back-end & API, same date). Every figure on the
analytics page follows it.

New on the page, full width under the KPI row: **Sales by channel**, meaning
where the order was placed: the online store, Telegram, WhatsApp, or a draft
order the merchant built. It has a share ribbon, one tile per channel (icon
and colour, sales, share, change on the previous period, orders, average
order, customers, a sparkline) and a stacked chart per day or month, with a
Sales / Orders switch. Hovering a tile highlights that channel everywhere.
An idle chat channel offers "Connect"; an idle draft channel links to draft
orders. The section has its own query, so an API that does not know
`salesByChannel` leaves the rest of the page alone; the section is then left
out rather than shown as an error whose retry cannot work until the API is
rebuilt. The UTM card became "Sales by traffic source", so two cards are
not both "by channel".

- [x] **Capture the channel skeletons (`VEN`).** Add
      `analytics-sales-channels-headline`, `-tiles` and `-chart` to
      `apps/vendor/boneyard.config.json` and run `npm run bones`. Until then
      the first paint shows reserved blank space.
      Done 2026-10-05: the three names are in `boneyard.config.json`, the
      captured bones are committed under `src/bones/`, and `registry.ts`
      registers them. The section already renders those `Bones` names.
- [x] **Filter the orders list by channel (`BE` + `VEN`).** The same
      derivation as `salesChannelSql` (`placed_via`, or a `draft_orders` row
      pointing at the order), on the list and on its CSV export.
      List done 2026-10-04: the orders list has a Channel filter chip, named
      as the analytics page names channels. The API's existing `channel`
      filter and `OrderEntry.channel` now come from
      `analytics/sales-channels.ts` (`salesChannelWhere`, `salesChannelOf`),
      the same rule as `salesChannelSql`, pinned against its `CASE` in
      `sales-channels.spec.ts`. Before, an order with an unrecognised
      `placed_via` matched no channel, a chat order with a draft row matched
      Draft too, and an unknown channel name returned every order. The CSV
      half is open because the orders list has no export: "Export orders" is a
      menu item with no handler, and the API has no export operation.
      CSV half done 2026-10-04, which closes this. `exportOrdersCsv` returns
      the orders list as one CSV under the list's filters and sort, through
      the same `buildOrdersWhere` as `orders`, so the file is the list
      (channel rule and shop scope included). It follows the products export
      (inline body, a 10,000-row ceiling) and adds `truncated`. Console-only:
      `manage_own_shop` / `manage_all_shops`, `X-SHOP` required, the vendor
      must own the shop, 10 a minute. Money is two-decimal major units beside
      `currency`, and text cells are neutralised against CSV injection.
      "Export orders" in the header downloads it. On the way: sorting the list
      by Total passed `total` to the database as a column name; it now sorts
      `total_cents`.
- [x] **Audit an orders export (`BE`).** The file carries customer names and
      contacts, and `AuditAction` has no export value: an enum migration,
      which needs the owner's sign-off.
      Done 2026-10-05: `AuditAction.EXPORT` (`20261005170000_audit_action_export`).
      Both the inline mutation and the streamed download write one sensitive
      audit row for the shop and the row count, not the customers. Pinned in
      `orders.service.spec.ts`.
- [x] **A streamed export past 10,000 orders (`BE`),** as the customer-segment
      export streams.
      Done 2026-10-05: `GET /api/v1/orders/export.csv` writes the list in
      batches of 500 with no ceiling. The dashboard downloads that route.
      The inline mutation still stops at 10,000 because its body is one
      string. Pinned in `orders.service.spec.ts` and
      `use-orders-export.test.tsx`.
- [x] **A date range on the orders list (`BE` + `VEN`).** `FilterOrdersInput`
      has none, so a channel's list cannot be compared with the analytics
      card's window; the list also includes cancelled and failed orders.
      Done 2026-10-04: the list and its export take `created_from` /
      `created_to`, the half-open window the analytics reports use
      (`INVALID_RANGE` when inverted). The list has a Date chip offering the
      analytics page's presets, cut by the same `rangeForPreset`, so "Last 30
      days" names the same orders on both screens; a window that runs to now
      is left open at its end.
- [x] **A custom range on the orders list (`VEN`),** and re-anchor Today at
      midnight: a Today chip left open past midnight keeps the old start until
      a filter changes.
      Done 2026-10-05: the Date chip's value menu draws a one-month calendar
      (`CreatedRangePicker`) that commits `custom:YYYY-MM-DD:YYYY-MM-DD`
      (inclusive local days). `createdWindow` cuts it with `rangeForCustom`
      and keeps the open-end rule. A Today chip arms a timeout to the next
      local midnight and moves `windowAnchor` when that day has changed.
- [x] **Assert list count equals report count on real Postgres (`BE`)** in
      `test/concurrency/sales-by-channel.e2e-spec.ts`:
      `orders(filters.channel)` total against `salesByChannel` `orders_count`.
      Done 2026-10-04 and run on the scratch test database:
      `sales-by-channel.e2e-spec.ts` asserts that the orders list and its CSV
      export, filtered by channel over the report's window and sale set, hold
      exactly the orders `salesByChannel` counts. The equality is for a
      shop-scoped list; platform-wide, an admin's list also includes
      multi-shop parent orders, which the report leaves out.
- [ ] **The channel filter reads converted-draft order ids into memory
      (`BE`),** platform-wide for an admin with no shop. A relation from
      `Order` to `DraftOrder` would make it one `EXISTS`; that is a schema
      change and needs the owner's sign-off.
- [x] **Theme the older charts' gridlines (`VEN`).** The sales-over-time and
      AOV cards draw fixed `#e2e8f0` gridlines, too bright on the dark card.
      The channel chart's `var(--border)` is the fix.
      Closed 2026-10-04 (the code had already closed it): all three charts
      draw `GRID_COLOR = "var(--border)"` and `TICK_COLOR =
      "var(--muted-foreground)"` (`sales-over-time-card.tsx`,
      `aov-over-time-card.tsx`, `target-pacing-chart.tsx`), pinned by
      `over-time-charts.render.test.tsx`.
- [x] **Name the older charts' dates in the dashboard language (`VEN`).**
      `SalesOverTimeCard`, `AovOverTimeCard` and the targets pacing chart
      call `formatBucketLabel` without a locale, so an Arabic dashboard
      shows "Sep 1" on their axes. The channel chart passes `locale` (the
      helper takes it since 2026-09-29); do the same there.
      Closed 2026-10-04 (the code had already closed it): the three charts
      read `useLocale()` and pass it to `formatBucketLabel`; the same render
      test checks "سبتمبر" on an Arabic dashboard and "Sep 1" on an English
      one.

### Every vendor screen in Arabic, through next-intl (2026-09-28)

The owner asked for the whole dashboard translated: whole screens still
rendered English under an Arabic `<html dir="rtl">` — purchase orders,
suppliers, the four coupon forms, the order edit and refund dialogs, the
product variants table and image editor, segments, webhooks, the balance
screen, the error and 404 pages, every toast the Apollo error link raises, and
the rich-text editor's toolbar. A scan of `apps/vendor/src` found ~1,500
hardcoded strings in ~200 files, plus ~250 hand-rolled `isAr ? "…" : "…"`
ternaries (almost all in the Sidekick folder), which the owner also wanted
moved into the catalogues. The catalogue itself was split: `en.json`/`ar.json`
(5,300 lines each) became one file per namespace under
`src/shared/messages/{en,ar}/`, assembled by an `index.ts`, and the parity
test now also fails on a namespace file its index does not import. zod
schemas take a translator, and zod's own default messages follow the dashboard
(`ZodLocale`); code outside React uses `translatorFor()`. The rules are in
`apps/vendor/AGENTS.md`.

Done the same day: 4,301 → 6,382 messages per language (52 → 61 namespaces)
across ~350 files; a rescan leaves 58 literals, all deliberate (brands, `SAR`,
units, ShopifyQL keywords, example placeholders). Found on the way and fixed:
`/analytics/inventory` rendered raw key paths (its namespace never existed),
selects all over the app printed raw values ("collect", "net_30", "SA") in the
trigger, a carrier status with no message rendered as its key path, Arabic
plurals that read "٥٠ منتجات", and the bundled country table's Arabic calling
Turkey «ديك رومى» (the bird) — patched at display with a dozen other
machine-translation errors. The test helper's static `next-intl` import
deadlocked any test that mocked it; it now reads `use-intl/core`. tsc, lint
(0 errors) and all 2,168 vendor tests pass.

- [x] **Convert every hardcoded string in the vendor app (`VEN`).** Done 2026-09-28.
- [x] **Dates and money follow the browser, not the dashboard (`VEN`).**
      `formatDate` / `formatMoney` in `shared/lib/format.ts` (31+ call sites),
      a local copy in `draft-orders-list.tsx`, and the purchase-order screens'
      `toLocaleString(undefined)` format in the browser's language, so an
      Arabic dashboard on an English browser shows English dates. Needs a
      locale that the server render and the client agree on.
- [x] **Physical left/right classes that do not mirror in RTL (`VEN`).** The
      inventory bulk editor and new-PO picker (`pl-*`, `ml-auto`) and the
      product variants table (`text-left`, the `pr-12`/`right-3` price suffix).
- [x] **A hardcoded `SAR` suffix on money inputs (`VEN`).** Product pricing,
      auction, variants table and the four coupon forms print `SAR` whatever
      the shop's currency, and in Latin script under Arabic (ر.س).
- [x] **Segment insights format spend as USD (`VEN`).** `currency: "USD"`
      rather than the shop's currency; predates the sweep.
- [x] **Segment filter-catalogue descriptions are English only (`BE`).** The
      field descriptions the editor shows come from the back-end, which has no
      Arabic for them.
- [x] **Tags show their English name under Arabic (`VEN`).** `translatable()`
      prefers the English name even when an Arabic one exists.
- [x] **A failed image upload in the rich-text editor is silent (`VEN`).**
      `image-upload-node` hands its errors to `onError`, which `simple-editor`
      sends to `console.error` only; show them, translated.
- [x] **The coupons row menu's Duplicate does nothing (`VEN`).** No click
      handler; predates the sweep.
- [x] **Delete the dead Sidekick tool cards (`VEN`).** `ProductCreatedCard`,
      `ProductUpdatedCard` and `CollectionCreatedCard` are rendered nowhere.
- [x] **Decide: Palestine's name in the address picker (`VEN`).** Closed
      2026-09-29: unified as «فلسطين» / "Palestine" in `AR_NAME_OVERRIDES`
      (`apps/vendor/src/shared/geo/data.ts`) and tested in `geo.test.ts`, matching
      the customer form, coupon, shipping-zone and signup pickers.
- [x] **Decide: the language of a payout request's details (`VEN`).** Decided
      2026-09-29: pre-filled in the merchant's dashboard language
      (`withdrawals.detailsLines`), giving the merchant direct review and edit
      control before submission; finance accepts both Arabic and English text.
- [x] **Decide: the language of an abandoned-cart reminder (`VEN`).** Decided
      2026-09-29: composed in the merchant's dashboard language
      (`abandoned-carts/lib/message.ts`), which the merchant customizes before
      sending across single or multiple carts.

### Saudi addresses on the MOMRAH tables, with districts (2026-09-25)

The bundled Saudi region and city pickers (`apps/vendor/src/shared/geo`) moved
from a 2022 GPL scrape (4,581 cities) to the MOMRAH Unified Municipal Coding
(CC0; 15,513 cities, 21,235 districts), and the store address dialog gained a
district picker, stored as `settings.location.district` (a new `ShopLocation`
field, English name like `city`). `back-end/scripts/generate-geo.cjs` builds
the three files and **pins each id's English name to the committed one**,
because the English name is the stored value and the carrier's origin city:
the dataset's own spellings ("Aldammam", "Tbwk", "Makkah Al Mukarramah")
would have orphaned every shop that had picked a city and handed OTO names it
does not know. The transition kept the old English for every city matched
one-to-one on region and Arabic name — all the major ones — so no stored
value needed a migration. A first cut swapped the names outright, added
`Region`/`District` Prisma models and `City` columns with no migration (city
lookups would have failed on the missing columns once the client was
regenerated), and its `npm install` pruned 16 peer packages from the
back-end lockfile, one of which `@langfuse/otel` loads at boot. Nothing sends
the stored district to a carrier, and nothing needs to: an OTO warehouse takes
its district from the national-address lookup (`ResolvedAddress.district`).

- [x] **Hofuf and Mubarraz have no MOMRAH city (`VEN`).** Decided
      2026-09-29: accepted MOMRAH municipal standard where Hofuf and Mubarraz
      are classified under "Al Ahsa"; existing saved strings remain intact,
      and re-picking stores "Al Ahsa", consistent across all 2,671 legacy cities.
- [ ] **Lazy chunks are ~1MB (cities) and ~1.6MB (districts) (`VEN`).** Both
      load only when the address dialog opens on a Saudi shop. Split by
      region if that open ever measures slow.

### Signing in can open another vendor's shop (found 2026-09-24)

Reported from a screenshot: after signing in as `vendor@zaydak.com` the
dashboard opened `/store/690a062e69d6`, a pending shop owned by a different
account, and every shop-scoped query came back `RESOURCE_NOT_FOUND` from
`ShopHeaderGuard` — a "Resource Not Found" toast over a dashboard that otherwise
rendered normally. The login URL still carried `?redirect=/store/690a062e69d6`
from the previous account's session (the proxy writes it when a signed-out
request hits a protected route), and `completeVendorSignIn` honours any
same-origin `redirect` without asking whether its shop belongs to the account
that just signed in. The store layout cannot rescue it: `shop(slug)` refuses a
pending shop to a non-owner, and `resolveCanonicalSlug` leaves a foreign slug
alone by design.

- [x] **Drop a `?redirect=` that names someone else's shop (`VEN`).** Done
      2026-09-24: `completeVendorSignIn` follows a `/store/<slug>…` or
      `/plan/<slug>…` target only when the slug is one of the handles
      `ensureVendorShop` now returns; if the shop list cannot be read, a
      shop-scoped target goes to `/store`. Which segment is a shop is
      `shopSlugOfPath` (`src/shared/lib/shop-path.ts`), shared with the proxy.
- [x] **`/` trusts the `active_shop_slug` cookie (`VEN`).** Done 2026-09-24:
      `app/page.tsx` redirects to `/store`, which validates against `myShops`.
- [x] **Decide what the store layout does with a slug the vendor does not hold
      (`VEN`).** Settled 2026-09-29: preserving the URL without silent redirection
      avoids confusing merchants editing foreign shop URLs, while invoking
      `notFound()` renders `app/store/not-found.tsx` with a clean prompt to return
      to dashboard home (`/store`). Both `/store/[shopSlug]` and `/plan/[shopSlug]`
      layouts now invoke `notFound()` when the slug does not resolve to any shop
      owned by the vendor, preventing spurious queries and error toasts.

### Shopify-style Create order (draft) screen — 2026-09-19

Reskinned `/orders/drafts/new` (and edit) to match Shopify admin Create order: two-column Products + Payment / Notes + Customer + Markets + Tags, with modals for select products, custom item, note, discount, shipping, and new customer. Wired to existing draft-order + contact APIs; tax estimate from `Shop.tax_bps`; currency from shop (Markets simplified — no multi-market). Shipping modal lists shop delivery channels (`shopShippingSettings`: personal / OTO) and quotes live rates via `verifyCheckout` when products + address exist; selection still persists as `shipping_override_cents` + name.

- [ ] **Custom line items on draft API (`BE` + `VEN`).**
      **Scoped 2026-09-21: split it, and do not attempt the end-to-end version
      in one pass.** The draft half is genuinely cheap and the order half is
      not, and the box reads as one item.
      *Draft-only (small).* `DraftOrderLineItem.product_id` declares **no
      relation to Product** — it is a bare column with no FK and no index — so
      making it nullable is a plain `DROP NOT NULL` with nothing to drop first.
      Add `title` + `unit_price_cents`, and a CHECK that exactly one of
      `product_id` / `title` is set. Note that would be the repo's **first**
      CHECK constraint, and Prisma 7 cannot represent one in `schema.prisma`,
      so the next `migrate dev` shadow diff reads it as drift — decide that
      deliberately rather than discovering it.
      *Order pipeline (large, separate branch).* `createOrder` cannot take a
      product-less line today, and it is not one guard to relax: a null
      `product_id` dies or **silently misprices** in eight places inside one
      Serializable transaction — the `if (!product) throw`, a `productMap.get(...)!`
      feeding a price with no null guard, two `if (!op.shop_id) continue` loops
      (the shipping bucket and the per-line tax loop — that one is a silent VAT
      loss), `lineShips(...)`, two `order.create` writes and
      `decrementStockForLine`, whose signature types `product_id` non-null.
      `OrderProduct.product_id` is also a required FK inside
      `@@unique([order_id, product_id, variation_option_id])`.
      Two things make it less bad than it sounds: `EditOrderLineInput.unit_price_cents`
      already exists and `editOrder` already honours a merchant-declared price,
      so "a line priced by the merchant, not the catalogue" is a solved problem
      for existing products; and the "auto-sku product" alternative sidesteps
      the pipeline entirely at the cost of catalogue litter.
      One vendor trap: `assertCanPersist()` has **two** guards. Removing the
      `hasCustom` one still refuses a draft of nothing but custom lines, via
      `catalogLines.length === 0` / `needProduct`. Both strings become wrong.
      Also `draftToBaseline`'s line-name fallback calls `li.product_id.slice(0, 6)`
      — a null-deref the moment a saved custom line comes back.
- [x] **Draft order tags persistence (`BE` + `VEN`).**
      **The back-end half was never missing**, and this box said it was.
      `DraftOrder.tags` has been a schema column, a field on
      `CreateDraftOrderInput` and `UpdateDraftOrderInput`, a field on
      `DraftOrderEntry`, and read+written by `DraftOrdersService` since the
      module shipped. Only the vendor half was absent, in three places that
      each look harmless alone: `DRAFT_ORDER_FIELDS` never selected `tags`,
      `draftToBaseline` seeded `[]` rather than the loaded draft, and
      `buildInput` did not send them. So a merchant's tags were accepted by
      the input, silently discarded on save, and the card carried a caption —
      `tagsLocalOnly`, "local until draft-order tagging ships on the API" —
      that had stopped being true. All four are fixed, the caption and its two
      message keys are gone, and `draft-order-form.render.test.tsx` pins both
      halves (seeded from the draft, sent on save); the send assertion was
      sabotaged to prove it fails without the fix. The docs were stale the same
      way — neither `back-end/docs/features/draft-orders.md` nor its `api/`
      reference mentioned `tags` at all. Three things came out of finishing it
      that the box did not ask for and that are worth keeping. The back-end had
      **no `tags` coverage whatsoever** — `draft-orders.service.spec.ts` had
      zero hits for the word — so the update patch semantics were unpinned:
      `updateDraft` patches on `!== undefined`, and a spread that lost that
      guard would wipe every tag on any edit that did not re-send them. Five
      specs now pin it, including "omitting the field leaves them untouched"
      and "an empty array genuinely clears". The drafts list **searched
      everything but tags** (`matchDraft` ORed draft number, customer name and
      contact) though the field's own description is "for custom views /
      filtering" and the back-end put a GIN index on it, so one clause was
      added rather than a column — the list is client-side over the loaded page
      either way, since `draftOrders` takes only `page`/`limit`. And
      `CreateDraftOrderInput` in the vendor's `types.ts` had drifted: it never
      carried `tags`, which compiled only because `buildInput()` returns an
      unannotated object literal.
- [x] **Send invoice from draft (`BE` + `VEN`).**
      **Shipped 2026-10-14 as rendered email.** The re-scope held: sending a
      rendered email via the existing notification engine (`renderForShop` →
      `order_invoice` template → `senderFor` Reply-To → `mail.sendRendered`)
      sidestepped PDF dependencies and Arabic font shaping.
      Both structural obstacles are solved cleanly:
      - **Recipient on the wire:** `DraftOrderEntry` now exposes `customer_email`,
        resolved by `DraftOrdersService` from `customer_contact` (if valid email)
        or via `customer_id` → `Customer`/`User`/`Contact` indexed records.
        `SendDraftInvoiceInput` accepts an optional `to` address that the vendor
        dialog pre-fills from `customer_email`, allowing merchants to send to an
        address typed on the spot or verify the resolved one.
      - **Draft invoice identity without an Order:** An unpaid draft does not write
        an `Invoice` row (which requires `order_id`); the email carries the draft's
        own identifier (`#D-XXXXXX`), customer name, itemized line items, subtotal,
        discounts, shipping override, total, and an optional merchant message.
      - **Vendor UI & Dialog:** Replaced the toast stub in `draft-order-form.tsx`
        with `SendInvoiceDialog` (`send-invoice-dialog.tsx`) featuring recipient,
        custom subject, and custom message inputs, localized in Arabic and English.
      - **Specs:** 84 backend unit tests in `draft-orders.service.spec.ts` and 56
        vendor draft tests across 8 test suites passing.
- [x] **Payment due later / terms on convert (`BE` + `VEN`).**
      Shipped 2026-09-22, hardened 2026-09-23. The re-diagnosis held and was
      worse than written: every converted draft was `CASH_ON_DELIVERY`, so a
      net-30 order read `financial_status: paid`, a "Mark as paid" order sent a
      courier to collect money the merchant had already received, and a shop
      with COD switched off could convert **no** draft at all
      (`PAYMENT_METHOD_NOT_AVAILABLE`) — the last two were not in the box.
      Now: `draft_orders.payment_due_later` / `payment_terms` (migration
      `20260922203000_draft_order_payment_terms`); a merchant-only
      `PaymentGateway.INVOICE` whose order and payment start pending, collects
      nothing at the door and writes `Invoice.due_date` = issue date + term days
      (`OrderInvoiceEntry.due_date`); and `convertDraft` derives the gateway when
      none is named — due later gives `INVOICE`, otherwise `CASH`. The vendor
      form seeds and sends both fields and each button names its gateway.
      The box was half wrong about the settle action: the back-end already
      accepted `updateOrder` payment_status writes, only the vendor **Mark as
      paid** was missing. It shipped, and the path behind it was hardened: it is
      offered for `INVOICE` only and `updateOrder` refuses a paid write outside
      COD / CASH / INVOICE (`MANUAL_PAYMENT_NOT_ALLOWED`), so an open Stripe
      Checkout session can no longer collect a second time; `payment_status` is
      validated against `PaymentStatus`; every payment_status write is
      compare-and-set (`ORDER_PAYMENT_STATUS_CHANGED`, 409), so two settles
      cannot both fire `ORDER_PAID`; the winner stamps the invoice `paid` +
      `paid_at`; and `Invoice.customer_id` is the order's customer, not the
      merchant. A review then caught that CASH and INVOICE settled `platform`,
      so completing an unpaid net-30 order credited the vendor's withdrawable
      balance — they now settle `merchant_direct` with bank transfer
      (`MERCHANT_DIRECT_GATEWAYS`, commission debit only). COD's membership in
      `paidStatuses` and its `platform` settlement are unchanged, as scoped.
- [x] **Apply store coupons on draft Payment card (`VEN`).**
      Shipped 2026-09-23 as decided — the coupon's identity on the draft, priced
      by `createOrder`. Two corrections to the box. `CreateOrderInput.coupons`
      takes coupon **ids**, not codes, so the column is
      `draft_orders.coupon_ids TEXT[]` (migration
      `20260923150000_draft_order_coupons`, at most 5; saving refuses an id that
      is not a live coupon of the draft's shop, platform coupons included). And
      the real gap was identity: `createOrder` judged, claimed and recorded
      coupons for the **caller**, which on a conversion is the merchant, so a
      once-per-customer coupon would have worked on one draft per merchant,
      ever. Merchant-placed orders now use the order's customer and their
      account email; the public checkout path is byte-identical and a test pins
      it. A guest on-behalf order refuses per-customer coupons
      (`coupon_requires_customer`) because the usage claim has no subject, and a
      stored coupon that no longer applies refuses the conversion
      (`coupon_not_applicable`) rather than silently repricing. The add-discount
      dialog lists active coupons plus code entry through `VERIFY_COUPON` (its
      first caller) and labels every figure an estimate; audit rows record
      `coupon_ids` old and new. The same pass keyed `createOrder`'s tax-exempt
      lookup on the order's customer — it read the merchant's flag on a
      conversion.
- [x] **Persist chosen shipping method id on draft / convert (`BE` + `VEN`).**
      Shipped 2026-09-21, and it was **about half the size this box implied**:
      the expensive half was already built. `createOrder` already freezes a
      chosen method for both channels (`{source:'rule',…}` /
      `{source:'carrier', delivery_option_id, legs, …}`), already re-quotes the
      fee server-side rather than trusting the client, and already **refuses**
      a pick that no longer resolves; `bookShipment` already books that exact
      `delivery_option_id` or throws. Convert simply never reached any of it,
      because it passed no `shipping_rule_id`. Nor was a second carrier column
      needed: option ids are the composite `carrier:<company>:<deliveryOptionId>`
      and the order path dispatches on that *shape*, so one nullable TEXT column
      holds either a rule cuid or a carrier composite — exactly what
      `CreateOrderInput.shipping_rule_id` already accepts.
      So the migration is two nullable columns (`20260921120000_draft_order_shipping_method`),
      and the real work was one precedence rule: **a frozen pick outranks the
      fee override, and the two are mutually exclusive.** That is not taste. The
      override branch overwrites `shipping_method` with
      `{ source: 'merchant_override' }`, and the shipments service's
      `chosenDeliveryOptionId` returns null for that shape *by documented
      design* — so an order carrying an override books through the shop's
      **default** carrier rather than the option the merchant chose. Sending the
      id and suppressing the override is the only combination that books what
      was picked. Nothing in `orders.service.ts` had to change. The draft's own
      modal already kept the two apart (picking a quoted option clears the
      custom fields and `pickMethod` clears the selection on switch), so the
      exclusivity is enforced where it was already true.
      Found on the way, and fixed with it: **the method's display name was lost
      on every reload.** `shippingName` lived in the save-bar baseline and was
      seeded `""` by `draftToBaseline`, so reopening a saved draft forgot which
      method it carried — a separate defect from the missing id, and invisible
      because the fee survived.
      Verified: all migrations replay clean into a throwaway database with both
      columns landing nullable TEXT; back-end 20/20 (four new specs, and the
      precedence one was sabotaged to prove it fails without the rule);
      vendor 62/62; `tsc` clean both sides. `schema.gql` regenerated — which
      caught a real error, `string | null` has no reflectable design-time type
      so `UpdateDraftOrderInput` needed an explicit `() => String`, the same
      reason `shipping_override_cents` names `() => Int`.
- [x] **A dedicated MANUAL gateway for "Mark as paid"? (`BE` + `VEN` · decision).**
      Settled 2026-09-29: Kept `CASH` for draft "Mark as paid" conversions. Both
      `CASH` and a theoretical `MANUAL` gateway share identical accounting and
      operational behavior — both settle `merchant_direct` with zero platform
      collection obligation (`codObligationCents = 0`) and debit platform
      commission only upon completion. Retaining `CASH` avoids fragmenting order
      gateway filters, analytics, and storefront localized labels (`paymentGatewayLabel`)
      for direct off-platform merchant payments.
- [x] **Exact draft coupon preview (`BE` + `VEN`).** `verifyCoupon` has no
      on-behalf identity, so the dialog's estimate judges customer-targeted and
      per-customer coupons as the merchant, sends no `collection_ids` (a
      collection-scoped coupon previews as "could not be previewed"), ignores
      sequential stacking and shipping, and is throttled at 10/min. A
      merchant-only draft preview running `CouponEngine` for the draft's
      customer would make it exact. The picker also loads only the first 50
      active coupons — switch to `coupons(search:)`.
      Closed 2026-09-29: Added `customer_id` to `VerifyCouponInput` and asserted
      via `assertShopCustomer` when called by merchant/admin, allowing on-behalf
      customer evaluation. Populated missing `collection_ids` from `collectionProduct`
      in `CouponsService.verify` so collection-scoped coupons preview accurately.
      Moved `OptionalJwtGuard` before `GqlThrottlerGuard` and bypassed throttling
      for authenticated merchants/admins. Updated draft orders dialog and form to
      query `coupons(search:)`, pass `customerId` and `shippingCents` to `verifyCoupon`,
      and display previews with full stacking and shipping support. Tests passing
      cleanly across `back-end` (253 tests) and `vendor` (61 tests).
- [x] **Real-database draft convert test (`BE`).** Every draft spec mocks
      `createOrder`, which is how the Contact-id FK failure survived. Convert a
      draft carrying a linked contact's account, an unlinked contact, and a
      coupon against scratch Postgres.
      Closed 2026-09-28: `test/concurrency/draft-convert.e2e-spec.ts` converts
      drafts through the real `createOrder` on a migrated database (real
      coupon, usage, tax, allocation, inventory and ledger services): a shop's
      customer with a once-per-customer coupon, the same coupon refused a
      second time with the draft reopened, a linked and an unlinked legacy
      contact id, and a coupon on a guest order. Its first run found a live
      bug, fixed in the same change: `claimUser` locked with
      `pg_advisory_xact_lock(bigint, bigint)`, which Postgres does not have,
      so every order carrying a coupon with a per-customer cap had failed
      since 2026-04-18.
- [x] **Storefront shows raw `INVOICE` / `CASH` and no due date (`SF`).**
      **Closed 2026-09-24.** Order detail renders `paymentGatewayLabel` for
      `BANK_TRANSFER`, `CASH_ON_DELIVERY`, `STRIPE`, `CASH`, `INVOICE`, and
      `FULL_WALLET_PAYMENT`, and renders the earliest invoice `paymentDue` date
      when pending. Added `BANK_TRANSFER` and `INVOICE` to LookupsService
      `payment_gateway_type` and i18n dictionaries.
- [x] **`verifyCheckout` reads `tax_exempt` for the caller (`BE`).**
      **Closed 2026-09-25.** `VerifyCheckoutInput.customer_id` names the quote's
      customer — exemption, per-customer coupons, no wallet — when the caller
      is the shop's owner (omitted: a guest quote, never the merchant) or a
      platform admin who sends it. A shopper's `customer_id` is ignored, and an
      admin who sends none is quoted as themselves, because `createOrder`
      charges them as themselves. The draft shipping modal sends the draft's.
- [x] **`verifyCheckout` takes any `customer_id` from the owner (`BE`).**
      **Closed 2026-09-25.** A `customer_id` named on a quote by the owner or
      an admin now goes through the draft's own check. That check,
      `assertShopCustomer`, moved to `common/helpers/shop-customer.helper.ts`
      so drafts and the quote share one copy. An id that is not a live
      customer of the shop is refused with `invalid_customer` before
      `tax_exempt` is read. It is refused, not quoted as a guest, because a
      guest quote differs from an exempt one and would leak the same bit. A
      shopper's `customer_id` is still ignored unchecked. Four specs, and
      disabling the guard turns three red.
- [x] **The draft shipping modal swallows a refused quote (`VEN`).** It calls
      `void verify(...)`, so an `invalid_customer` refusal — now also reached
      by a draft still holding a pre-2026-09-22 contact id — drops to the
      custom fields with an unhandled rejection and no message. Catch it and
      say why there are no rates.
      Closed 2026-09-28 (the code had already closed it): the refusal is read
      from the hook's error and shown (`draftQuoteErrorKey`), pinned by
      `shipping-options-dialog.quote-error.render.test.tsx`.

### Google / Apple Sign-In (vendor + storefront) — 2026-09-18

Shipped: `ExternalIdentity` + `signInWithSocial` (Google ID token via
`google-auth-library`, Apple via `jose` + Apple JWKS), env audiences
`GOOGLE_CLIENT_IDS` / `APPLE_CLIENT_IDS`, storefront + vendor login buttons
(hidden until `NEXT_PUBLIC_*_CLIENT_ID` is set). Creates/links `customer`;
OAuth-only accounts have `password: null`. Fixed link-on-existing-email:
Google tokeninfo's string `"true"` for `email_verified` is coerced so a
password account is linked instead of a duplicate-create failure.

- [x] **Back-end: verify Google + Apple ID tokens, create/link user, issue JWT (`BE`).**
- [x] **Vendor login: Google / Apple buttons (`VEN`).**
- [x] **Storefront login: Google / Apple buttons (`SF`).**
- [x] **Link Google onto existing email/password account (`BE`).** Coerce
      `email_verified` string from tokeninfo; clash guard returns
      `EMAIL_ALREADY_TAKEN` when verification is absent.
- [x] **Auto-create first shop after vendor social/password/OTP login (`VEN`).**
      `ensureVendorShop` + `completeVendorSignIn` mint temporary store and open
      `/store/{slug}` when `myShops` is empty.
- [ ] **Configure live Google OAuth client + Apple Services ID (`INFRA`).**
      Add ids to back-end env and both apps' `NEXT_PUBLIC_*`; Apple needs HTTPS
      return URLs in production.
- [x] **Vendor signup wizard social entry (`VEN`).** Wired `<SocialAuthButtons />`
      into EmailStep with divider, supporting Google and Apple one-click signup.
- [ ] **Eyeball Google One Tap + Apple popup on mobile / RTL (`SF` + `VEN`).**

### AI Price Negotiation Engine V1 — 2026-09-18

Shipped: Nest `NegotiationModule` (multi-constraint effective floor = max of min price / max-discount floor / min-margin floor; snapshotted on session; `toLlmSafeView` never leaks floor; concession-based bargaining with HOLD; NegotiatedOffer → cart with non-stackable default), GraphQL vendor + customer ops, plan key `ai.negotiation`, WhatsApp/Telegram/storefront panel via customer-bot `negotiate_price` tool, LLM phrasing via `NegotiationAiService` (template fallback), feature docs. Vendor `NegotiationCard` loads/saves via `negotiationPolicies` + `upsertNegotiationPolicy` on the product save bar; storefront **Ask anything** chat is the negotiation UI (`NegotiateButton` opens it; accept CTA → `addNegotiatedOfferToCart`).

- [x] **Concession-based pricing engine (`BE`).** HOLD on no/tiny/backward move; seller drop = customer concession × strategy ratio; progress-weighted accept band toward hard floor; FINAL lock; `NegotiationReason` on LLM-safe view; no cost language in prompts.
- [x] **Vendor product list column + bulk variant policies (`VEN`).** Status column with quick-toggle (`ProductNegotiationCell`) and bulk enable/floor edit on variants table.
- [x] **Vendor NegotiationCard save-bar polish (`VEN`).** Live floor preview (`previewNegotiationFloor`) on product form with breakdown; strategy, offer TTL, and coupon stacking fields now interactive and saved via save bar.
- [x] **Storefront negotiate via Ask-anything chat (`SF`).** Free-form chat + LLM replies + accept → cart; removed number-only drawer.
- [x] **Storefront negotiated-offer countdown + cart badge i18n (`SF`).** Added `NegotiatedOfferBadge` with remaining time countdown, expired state, and English/Arabic translations; integrated into `CartMiniLine` and `CartLineRow`.
- [ ] **Category override hierarchy (`BE`).** V1 = sellable policy only.
- [ ] **Alternative deals (`BE`).** Free shipping / bundles instead of price.
- [x] **Inventory dynamic floor D (`BE`).** Stock-based scarcity live — `scarcityDiscountAllowance` allows 25/50/75% of the merchant's band at 1/2/3 units against a threshold of 4, 0 units makes negotiation unavailable, untracked/backorder unaffected. Raises the floor only, so no vendor setting is overridden.
- [ ] **Velocity dynamic floor (`BE`).** Sell-through rate / age-on-shelf as a second input to floor D; only stock on hand is read today.
- [x] **Analytics beyond counters (`BE` + `VEN`).** Per-session reporting shipped 2026-09-22 as `negotiationOutcomes` and Analytics → Negotiations (see the outcomes box in the AI section). Still open: per-product and per-strategy rollups (average discount, rounds to close, how often the floor is reached) and a trend chart. Closed 2026-10-01 by `negotiationOutcomeRollups` (see "Rollups and trends" in the AI section).
- [x] **Plan seed sync for `ai.negotiation` (`BE`).** Registry entry + `seed:plans` additive insert; enabled on FREE through PLUS (incl. Basic); seed flushes Redis entitlement maps; vendor `useFeature` uses `cache-and-network` so a grant is not stuck behind a stale Apollo cache.
- [x] **LLM negotiation replies (`BE`).** `NegotiationAiService` phrases from `toLlmSafeView`; free-chat path without inventing prices.
- [x] **First-turn ask-for-offer (`BE` + `SF`).** Seed / intent without a numeric bid must not ACCEPT at list or publish cart CTA; `resolveCustomerOfferCents` + free-chat “أعطيني سعرك”.
- [x] **Stuck FINAL / soft-as-available reopen (`BE`).** Re-open negotiate cancels ACTIVE; first priced offer never FINAL; FINAL restates without raise-ask; CTA skips HOLD; eggs 17→19 bargains.

### Marketing Ads shell (Meta / Google / TikTok / Snapchat) — 2026-09-18

First vertical slice under Marketing → Ads, adapted from Salla-style marketing screens to the vendor light design system. Routes: dashboard, ad management (local drafts), integration tools (demo Connect + Snapchat connected panel with pixel ID save bar), and audience manager placeholder. State is `localStorage` per shop — no GraphQL ads module and no OAuth yet. Sidebar Marketing now opens `/marketing/ads`; abandoned carts and coupons stay as siblings.

- [ ] **Platform OAuth (`BE` + `VEN`).** Real Meta / Google / TikTok / Snapchat connect flows; replace demo `localStorage` connections.
- [ ] **Live metrics (`BE` + `VEN`).** Impressions, CPC, clicks, spend and the performance chart from platform reporting APIs.
- [ ] **Campaign launch editor (`VEN` + `BE`).** Edit draft creatives/budget and launch to a live ad account (Edit is a toast stub today).
- [ ] **Catalog & Merchant Center sync (`BE`).** Product feed push for Google Merchant Center, TikTok catalog, Snapchat catalog, Meta catalog.
- [ ] **Storefront pixel + Events API (`BE` + `SF`).** Install Meta/TikTok/Snap/Google tags and server-side conversion events on the shop.
- [ ] **Audience manager (`VEN` + `BE`).** Sync custom/lookalike audiences from connected platforms into the audiences screen.

### Abandoned carts marketing list vs Salla's article (2026-09-17)

The Marketing → Abandoned carts page now matches the article's usable surface: date-scoped KPIs, customer/product views (`abandonedCartsByProduct`), search by customer or product, Linear-quiet chrome (funnel + FilterBar chips for status / value / created date / hidden), status popover with persisted channel + timeline, column picker in localStorage, current-page CSV, product line-item sheet, customer-name link, page size, current-page select + bulk remind/hide/export, and a reminder sheet whose discount is optional. Settings cadence stays on `/settings/abandoned-carts`. Guests stay out because Cart stores no guest email/phone.

- [ ] **App vs browser source (`VEN`).** Cart has `session_id` but no user-agent, so the article's source icon under the customer name is omitted.
- [x] **True cross-page select (`VEN` + `BE`).** Select-all is the current page. A full-filter id list would need a dedicated query.
      Done 2026-10-05: `abandonedCartIds` returns the list's filter in list order, at most 500 ids, with `total` when the list was cut. The table holds those ids across pages (`useCartSelection`).
- [x] **Ops-log export (`VEN` + `BE`).** Shipped 2026-09-22, and the box was half wrong: the back-end half already existed. `abandonedCartOps` was in the schema with no tests, no docs and no caller; it now has nine service specs and a section in `api/cart.md`, and the view options have **Export activity log** — the log for the KPI date range (cap 2000, with a warning when the cap bites) downloaded as `abandoned-carts-activity.csv`. It ignores chips and view on purpose.
- [x] **Cart-link open pixel (`BE`).** Shipped 2026-09-22 as click tracking, not an email-open pixel, and it needed storefront work too. Both link builders (manual reminder and cadence email) append `?rc=<cartId>.<mac>` to the shop's own cart URL — HMAC-SHA256 over shop + cart under a key derived from `APP_SECRET`, 96 bits, constant-time compare; no `APP_SECRET` means untracked links. The storefront cart page strips `rc` and fires the public `recordCartLinkOpen` once (throttled, shop-scoped, so one shop's link cannot stamp another's cart), which sets `carts.reminder_link_opened_at` (migration `20260922134812_cart_reminder_link_opened_at`) for the first open after the latest send. RETURNED is now activity **or** a link open after the send, which only adds cases; the status popover shows "Opened reminder link". The merchant's own `preview_body` carries the unsigned link, so previewing records nothing.
- [ ] **Group customer rows by reminder status (`VEN`).** Linear groups by workflow; this list is server-paged, so grouping the current page would mis-count. Skip until the API can return grouped pages.
- [x] **Status counts in the add-filter submenu (`VEN` + `BE`).** Shipped 2026-09-22; the premise was stale — `abandonedCartsSummary` already returned `by_status` and the table already ran it. Each status option now shows its count as a trailing muted number (`hint` on `@repo/ui`'s `FilterOption`, plus a `hintNote` footnote saying the counts follow the date range and exclude hidden carts but apply no other chip). A back-end spec now pins the tallies.
- [x] **Exact `by_status` counts past 2000 carts (`BE`).** Shipped 2026-09-25. `groupedStatusCounts` counts in one grouped SQL query instead of tallying at most `LIST_CAP` (2000) rows in memory. Its WHERE restates `marketingWhere` and its CASE restates `marketingReminderStatus`; checked equal to the in-memory tally for every shop and four date windows on the local database (READY, SENT and COMPLETED carts present; FAILED and RETURNED compared by reading). The unit spec mocks `$queryRaw`, so it pins only the mapping and the hidden-cart clause.
- [x] **Real-database test for the grouped status counts (`BE`).** Done 2026-09-25 as `test/concurrency/abandoned-cart-status-counts.e2e-spec.ts`, so CI's concurrency step runs it. It runs the service's own code on both sides, with no copy of either rule: `marketingWhere` through a real Prisma client, tallied with `marketingReminderStatus`, against the grouped SQL. It seeds 21 carts covering all five states, the exclusions and the edge cases, such as a send at the same instant as the last activity. The two sides must agree over all time (exact tally asserted) and in four date windows. Changing the CASE's `>` to `>=`, dropping the reminded branch from the WHERE, or dropping the link-open rule from the TypeScript turns it red. Green on an empty and on a fully migrated scratch database. `test/jest-e2e.json` gained the unit config's `.js` mapper so a spec under `test/` can import a service.
- [x] **Status counts that follow the other chips (`BE` + `VEN`).** Search, value band, created date and show-hidden are not applied to the counts; that needs those arguments on `abandonedCartsSummary` or a dedicated count query.
      Done 2026-10-05: `abandonedCartStatusCounts` takes the list's filter with the status left out, and the funnel reads it. The summary's `by_status` still ignores those chips.
- [ ] **`audit_logs.shop_id` for the ops export (`BE`).** `listOps` loads every cart id the shop ever had into an `IN` list and scans draft-record rows to fill 2000 ops, because audit rows carry no shop; entries for carts the nightly purge hard-deleted drop out. A backfilled column fixes both.
- [x] **Signed-out reminder landing (`SF`).** Shipped 2026-09-25. When `/cart` arrives with `?rc=`, `useReminderLinkOpen` detects the token and, if the visitor is signed out once hydrated, immediately prompts them to sign in (`openAuth("login")`) with the cart as the return path. Empty cart state also presents a persistent Sign In action for signed-out visitors. Unit-tested in `use-reminder-link-open.test.tsx` and full storefront vitest suite.
- [x] **Saved filter views (`VEN`).**
      Named views in `localStorage` (`abandoned-carts-saved-views.tsx`,
      `lib/saved-views.ts`) — save / apply / delete, max 8 per shop.
      Toolbar control temporarily hidden (user feedback); remount when needed.

### Vendor lists share the abandoned-carts table chrome (2026-09-17)

Orders, products, customers, coupons, collections, segments, reviews, files and the inventory lists now use the same **arrangement** as Marketing → Abandoned carts: quiet chrome row (optional view tabs, compact search, funnel, display packed on the end), FilterBar-style chips on a second row, white `bg-card` table, pagination inside the card. `DataTableToolbar` owns that layout. Products still uses `ProductsFilterBar` for chip semantics, in chrome mode. Admin is unchanged. Query semantics and columns are unchanged.

- [x] **Products Comfortable/Dense toggle (`VEN`).**
      `DataTable` compact padding follows `dense ?? variant`. An omitted
      `dense` stays Linear on `plain` lists; products passing `dense={false}`
      is Comfortable (`py-3`) again.
- [x] **Editor/form tables (`VEN`).**
      Segment preview, bulk inventory, transfer form/detail and the
      store-import review groups sit on the white list card
      (`ring-1 ring-foreground/10`) rather than the old bordered wrap.
- [x] **Drafts and returns chrome (`VEN`).**
      Both lists have a Linear chrome row: status view tabs and compact
      search over the loaded page (still capped at 50, no server search).

### The review screen opens as a sheet, and writes with you (2026-09-15)

Two things the merchant asked for, on the store-import review screen.

**It arrives.** The sheet now rises from the bottom over a dimming scrim
instead of appearing. One gesture in four parts, driven by a single label:
the ground dims first (220ms against the rise's 420ms, which is most of why it
reads as deliberate), the sheet rises with its scale resolving slightly ahead
of its travel so the last stretch settles into a slot, and the three structural
rows catch up behind it with the globe badge popping as the first lands. The
sheet itself carries **no overshoot** and that is not timidity: it is `z-40`
over a `z-30` site header, and a bounce past the dock paints its title bar
over a header that is still taking clicks. The badge is 24px and clipped, so it
is the one thing allowed to bounce. The exit is its own gesture rather than the
rise reversed, and it plays *before* the navigation — `use-sheet-gesture` asks
the leave guard first, then slides, then pushes on a **timer** rather than
`onAnimationComplete`, because rAF is suspended in a backgrounded tab and a
merchant who pressed Escape and switched tab would come back to a sheet parked
off-screen. Reduced motion gets a complete, settled screen in every phase,
including the exit. A hard load onto the review URL animates nothing: nothing
was covered, and `initial` would otherwise ship a `translateY(100%)` in the
server markup with nothing to undo it until JS lands.

**It writes.** Six rows grew an AI control — improve / shorten / expand /
simplify on the English title, description and brand, and translate on the two
Arabic rows, seeded from the English that will actually be imported. Money,
stock, SKU and barcode deliberately get none. It reuses `aiEditorTransform`,
which already carries the whole gate chain, rather than adding a second AI
surface with its own gates; what the back-end gained is a `target` argument,
because those seven actions were written for a Tiptap document and IMPROVE on a
product *title* returned a paragraph wrapped in `<p>`. **One call in flight for
the whole screen**, and an answer **never overwrites a merchant's own words**:
an empty cell is staged through `stageField` exactly as if typed, a filled one
gets a proposal with Use this / Keep mine.

And the category cell stopped being a text box a merchant was expected to type
a Google-taxonomy id into — on one of the two fields the needs-attention filter
counts. It is the product form's own picker now (shared, `chrome={false}`),
with **Suggest a category** beside it: `suggestSystemCategories` asks a model
for a taxonomy path and resolves it against the real tree server-side, so an
invented category produces no suggestion rather than a plausible wrong one. A
decisive answer applies on one press; an ambiguous one is offered as chips.

- [ ] Nobody has watched the gesture in a browser. Check the rise at 1280x720
      and on a phone, the scrim against the dark theme, and that the exit plays
      before the leave-guard prompt rather than under it.
- [ ] No AI call has been made against a real provider from this screen. Check
      an improved title comes back as a title, that an Arabic translation reads
      naturally, and that a suggested category is a leaf rather than a root.
- [~] **Bulk fill is not built (`VEN`).** "Translate every product" and
      "suggest categories for this page" are the obvious next press and are
      deliberately absent: each is N billed calls, and the per-user limiter is
      30/hour. It needs a cap, an estimate the merchant sees first, and a Stop.
      `suggestSystemCategories` already takes 25 products per call for this.
      Categories done 2026-10-04: the review toolbar has "Suggest categories",
      which asks `suggestSystemCategories` about every product on the page
      with no category, 25 per request. The dialog states the estimate before
      anything is sent; one run is capped at 4 requests, sent one at a time
      with a Stop between them; only decisive answers are staged, as unsaved
      edits; a refusal part-way keeps what was filled. "Translate every
      product" is not built: translation is one `aiEditorTransform` request
      per cell, so a 50-product page is up to 100 requests against a
      30-an-hour limiter. It needs a batched translate operation first (the
      scan's own pass already translates 20 texts per completion in
      `enrich/translate-batch.ts`).
- [x] **Expose the limiter's remaining count (`BE` + `VEN`),** so the estimate
      can say how many requests are left this hour instead of naming the
      limit.
      Done 2026-10-05: `aiContentHourlyAllowance` reads the content hour
      bucket without spending a call (`remaining` is null when Redis cannot
      be read). The category-fill dialog shows that count while it is open,
      and keeps naming the limit when the read fails.
- [x] The same category suggestion belongs on the ordinary product form, where
      every new product starts uncategorised too. The mutation is generic; only
      the wiring is missing.
- [x] The AI actions are gated on the plan before they are pressed.
      `useStoreImportAi` reads `myEntitlements` once per screen and disables
      an item whose capability (`ai.text.rewrite` / `summarize` / `translate`)
      is off or exhausted, with the same `aiNotInPlan` / `aiQuota` copy the
      mutation would have returned.

### Products list, import dialog and review editor brought to the reference (2026-09-15)

Three screens re-laid against the Shopify screens they were modelled on. The
import dialog is three bands — a title-only header over a hairline, a padded
body whose lead question is body text and names the radio group, and the
footer primitive's grey strip holding Cancel/Back and Next only; the sample CSV
moved out of the footer into the CSV option's helper sentence (and under the
file step's drop zone), because a footer link showed on the store-address step
too. Each radio's helper is a sibling described by `aria-describedby` rather
than a span inside the label, which is what lets it carry a link at all. The
empty products list keeps the list card and its toolbar and renders the empty
state inside it — start-aligned copy, Add product beside an outline Import,
and four muted icon tiles on tokens instead of a hex-painted SVG that floated
on the dark theme; the header hides its action cluster there, and the import
dialog is mounted once by `ProductsTable` so either Import opens the same
one. `AddProductButton` lost a physical `mr-1` on its icon for the Button's
own `data-icon` slot. The review editor dissolved its single slab into one
card per field group with the column names at the top of each, rows became
three hairline-split cells (a muted reference cell, a borderless input that
*is* the editable cell), the rail rows went flush with a start-edge selection
bar, and every input got a real accessible name and description. Later the
same day the review became a **sheet over the dashboard** — the settings
overlay's band, no app sidebar — with its own title bar and toolbar (exit,
product count, a search that unfolds from its icon, Discard/Save), because the
reference puts Save there and driving the site header's bar as well would put
two Saves on one screen. And it grew the column the reference is about: an
**Arabic** card with `name_ar` and `description_ar`, whose server-declared
`reference_key` makes the reference cell show the English that will be
imported rather than their own empty scanned value. `en` + `ar`.

- [ ] Nobody has eyeballed the three screens in a browser yet: check the
      dialog's footer corners against the popup's radius, the flush inputs'
      focus ring and the card edges under `.dark`, and the mirrored rail bar,
      `divide-x` hairlines and numeric `rtl:text-end` cells under Arabic.
- [x] `NeedsAttentionBadge` in `field-diff-row.tsx` has no consumer; mount it
      or remove the export rather than carry it.
      Mounted in `store-import-review-editor.tsx` beside product title when
      `product.incomplete && !excluded`.
- [x] The reference's Meta title / Meta description rows: the SEO quartet
      (`seo_title_en/ar`, `seo_description_en/ar`) is a `seo` group in the
      review field catalogue since 2026-09-22 — all four `neverScanned`, the
      Arabic two referencing the English two, none `blocksSale`. The same pass
      corrected comments claiming the enrichment pass was not wired into the
      scan; it is. `name_ar` / `description_ar` deliberately stay
      `neverScanned` (no connector reads them; enrichment is optional and
      capped).
- [x] The SEO card mixes English and Arabic rows under one "What we read /
      What will be imported" header while the Arabic rows' reference cell
      shows the English. A mixed-card header or per-row labels would read
      better on desktop.
      Closed 2026-09-28: a card's rows are split into runs by kind
      (`rowRuns`), each under its own column names, so the listing card reads
      What we read / What will be imported over its English rows and English /
      Arabic over its Arabic ones.
- [x] **The Arabic columns arrive empty on every scan (`BE`).**
      `StoreImportEnrichModule` wired into `StoreImportModule` and invoked in
      `StoreImportService.scanJob` before `serializeDrafts`. Translates
      `name_ar` / `description_ar` and fills category/tags on scanned products.

### Store import, the merchant half (2026-09-15)

The import dialog's "another platform" radio was a disabled row reading "Not
yet implemented"; it is now the store branch — an address, a platform picker
(AUTO / SHOPIFY / WOOCOMMERCE / GENERIC; Salla and Zid have no connector and
are not offered), and the **required ownership attestation**, which is checked
in the submit handler rather than by grey-ing out a button that would not say
why. Submitting queues the scan and hands over to `/products/import/[jobId]`,
which polls: the status ladder, what the scan found, and the three image
counters kept apart, because "in transfer" is a wait and "failed" is a decision
and one combined figure hides which is happening. READY shows the approval, and
that is the whole shape of the feature — scanning writes nothing, committing is
a second press. A differing source currency blocks the commit until the
merchant accepts the numbers unconverted. The "no longer at the source" list is
information only: no delete, no bulk action, nothing to press, because a scan
that half-failed produces exactly that list. The dialog was 100% hardcoded
English and is now translated end to end, en + ar.

- [x] **The per-image retry has no API (`BE`)**
      Verified already published on `StoreImportMediaResolver`
      (`storeImportMediaIssues`, `retryStoreImportMedia`, `skipStoreImportMedia`)
      and wired in `StoreImportMediaModule`.
- [x] **A quota failure reads as a generic error on the progress screen (`BE`)**
      `failureText` in `store-import.service.ts` now inspects
      `extensions.validation_errors[0].code` first, correctly preserving
      `PLAN_QUOTA_EXCEEDED` instead of swallowing it as `VALIDATION_ERROR`.
- [ ] Nobody has run the progress screen against a real scan. It needs the API,
      a queue and a store worth crawling; check the ladder, the counters and
      the RTL layout in a browser.

### Domains screen rebuilt to the reference design (2026-09-13)

Settings → Domains now matches the reference layout screen for screen. The
list page carries its actions in the shell's header row ("Connect existing"
split button, "Buy new domain"), an info banner, the addresses as a **tree
rooted at the primary** with View / Set as primary / Delete on hover, and the
change-handle card with a CSS-drawn illustration. Each custom domain has its
own page, `/settings/domains/[domainId]`, with a breadcrumb heading (hostname,
status pill, "Managed by … · Added on …"), View / Log in to provider / Domain
settings → Delete, a hero with the assistant bar, the five readiness checks as
numbered steps with the DNS instructions folded under the first (log in, then
remove / add / update tables with before-and-after columns), and "Domain target
and type". The shell gained two portal slots (`SettingsHeaderTitle`,
`SettingsHeaderActions`) and a `detail` reading in `parseSettingsPath` so a page
can own the header content the path cannot derive.

- [ ] Nobody has seen the panel over settings in a browser. Check it in RTL
      and maximized; correctness here is entirely visual and this app cannot be
      run without the API and a database.
- [ ] **Provider marks are monograms, not logos (`UI`)**
      `DomainProviderMark` draws the provider's initial on a brand-tinted
      square. Licensed logos per provider would match the reference exactly.

### Abandoned carts marketing list (2026-09-17)

The sweep, the 24-hour idle rule, coupons, draft orders, email/SMS/WhatsApp
senders and the `abandoned_checkout` cadence already existed. The vendor
screen at `/store/[shopSlug]/marketing/carts` is the list only (page title,
dismissible promo, KPI row, dense table, left-in-RTL reminder drawer) on
Zaydak tokens. The date chip scopes the table and the KPIs together
(default all time, so first visit still lists every open cart). A dated
range uses the cart's activity date (`abandoned_at`, else `last_activity_at`,
else `created_at`). Automatic reminders live under Settings → Abandoned
cart reminders. Send is now-only: BullMQ can delay a job, but there is no
merchant-facing scheduler to hang a date picker on. Guests stay out —
still no email on the cart.

- [ ] **Scheduled reminder send (`VEN` · `BE` · T3)**
      The sheet is send-now. A "send at" control needs a durable job the
      merchant can cancel, not a one-shot `delay` that vanishes if Redis
      restarts the way cadence `jobId`s do not.
- [x] **CSV export and column picker (`VEN` · T4)**
      Shipped with the Linear chrome: current-page CSV (`lib/export-csv.ts`)
      and a column picker in `localStorage` per shop and view. The ops-log
      export shipped separately on 2026-09-22 (Export activity log, in the
      entry above).
- [x] **Product search (`VEN` · T4)**
      Search matches customer name / email / phone or a product `en`/`ar`
      name on a live line.
- [ ] **In-app chat from the row (`VEN`)**
      The bubble is `wa.me` when the cart has a phone. There is no per-customer
      inbox URL to deep-link.
- [x] **Cadence step editor (`VEN` · T4)**
      Settings → Abandoned cart reminders edits `steps` through
      `abandoned-carts-cadence-editor.tsx` + `clampRecoverySteps`; dirty bar
      saves `{ enabled, steps }` via upsert.
- [ ] **Salla cart-status taxonomy (`VEN` · `BE` · T4)**
      Salla filters New / Reminder sent / Failed / Scheduled / Returned /
      Not updated / Completed / Hidden. We have READY, SENT, and a show-hidden
      chip. Failed send, returned-to-store, 15-day stale, and completed rows
      are not modelled.
- [x] **Product-centric abandoned table (`VEN` · T4)**
      Customer / Product is a view switch on this page. Product mode uses
      `abandonedCartsByProduct` (carts left, lost revenue, last abandoned).
- [ ] **Latest cart per customer (`VEN` · T4)**
      Salla shows one row per customer (their latest cart). We list every
      open cart, so a shopper with three idle baskets appears three times.
      Left as-is: collapsing needs a product decision, not a silent DISTINCT.

---

## Storefront

Focus: Conversion funnel completion, shopper policies, and multi-location checkout accuracy.

### Found while gating the negotiation mutations (2026-10-01)

Joining `sendNegotiationMessage` to the visitor gate (see the AI section)
turned up two storefront leftovers.

- [x] **`START_NEGOTIATION` / `SEND_NEGOTIATION_MESSAGE` are dead (`SF`).**
      `apps/storefront/src/features/negotiation/api.ts` exports both and
      nothing imports them; the shop negotiates inside the assistant panel.
      Delete them or wire a panel.
      Done 2026-10-01: nothing imported either document, tests included, so
      both were deleted from `features/negotiation/api.ts` and the storefront
      codegen re-run; `gql.ts` / `graphql.ts` no longer list them.
- [x] **The assistant panel ignores `retry_after_seconds` (`SF`).** An SSE
      `event: error` frame that arrives first is dropped by `parseFrame`
      (`stream.ts`), so `use-assistant.ts` re-runs the turn through the
      mutation, which is refused again, and the shopper sees the generic
      failed bubble instead of "try again in N minutes".
      Done 2026-10-01: the stream's `error` frame now carries the refusal's
      `code` and `retry_after_seconds` (`streamErrorFrame` in
      `storefront-assistant.controller.ts`, the same facts the mutation
      already exposed). `parseFrame` reads it and throws `AssistantTurnError`,
      which the hook does not fall back on, so the turn is not re-run through
      the mutation. A refusal from either transport renders "Try again in
      {wait}" (seconds, minutes, hours or days, en and ar), or "Try again
      later" when no window is named. Pinned by the controller spec,
      `stream.test.ts`, `refusal.test.ts` and `use-assistant.test.tsx`. The
      dead second frame parser (`lib/sse.ts`) went with it on 2026-10-02.
- [x] **The stream route's own throttle doubles the per-IP ceiling (`SF` +
      `BE`).** Its 20/60s throttle answers HTTP 429 before the stream opens,
      with no wait in the body (the HTTP filter drops `detail`), so the panel
      falls back to the mutation, which has a separate bucket. Decide whether
      a 429 on the stream is a refusal, and whether the filter should forward
      the wait.
      Done 2026-10-04: a 429 from the stream route is a refusal.
      `lib/stream.ts` throws `AssistantTurnError('TOO_MANY_REQUESTS', wait)`,
      so the panel no longer falls back to the mutation's separate bucket, and
      the bubble shows the wait. The wait reaches the browser in the body: the
      HTTP exception filter now forwards an `AppException`'s `detail`
      (`retry_after_seconds=<n>`), as GraphQL's `formatError` already did, on
      every REST route. The throttler's `Retry-After` header is set but not
      CORS-exposed, so the client reads it only as a fallback.

### Custom-domain shops lost `X-SHOP` in the browser (2026-09-25)

The API logged `MISSING_SHOP_HEADER` on `cart`, `storefrontProducts`,
`reviews`, `storefrontRecommendations`, `negotiationAvailable` and
`shopPaymentOptions`. On a merchant's own domain the proxy resolves the shop
through `domainRequest` and rewrites to `/{slug}/…`, but the browser's Apollo
link re-derived the shop from `window.location` alone, and `nikestore.com/products/mug`
names none — so every client query went out unscoped and signed-out. The proxy
now stamps `x-storefront-tenant-slug` in host mode (and strips forged copies on
the apex), the root layout writes it as `<html data-host-shop>`, and
`resolveDocumentTenant` reads hostname, then that attribute, then the path. The
404 page's "browse all shops" link uses the same verdict. See
`apps/storefront/docs/features/tenancy.md`.

- [ ] **Redeploy the storefront (`INFRA`, production-only).** The fix reaches
      zaydak.com and merchant domains only after a Vercel deploy.

### Sign-in is a popup over the shop — 2026-09-20

`AuthDialog` is mounted once by `ShopShell` and holds the login, register and
forgot-password panels, swapping between them in place. The header's account
control, the header panel, checkout's bank-transfer block and — through
`useSignInGate` — every Checkout button and Buy now open it instead of
navigating to `/login`. The popup captures the current URL as its redirect, so
`completeSignIn`'s hard navigation reloads the page the shopper was already on.
The routes stay: `proxy.ts` guards `/checkout` and `/account` on the server and
can only answer with a redirect, so a page has to exist at the other end of it.

Nothing scrolls inside the card. `DialogContent` gained `scroll="viewport"`
(`@repo/ui`), which puts the dialog in a full-window scroller instead of
pinning it to the centre: short panels stay centred, and a panel taller than
the window is scrolled by the window's own bar with the whole card moving. The
default is unchanged, so every other dialog in the repo is untouched.

The panels **stack** rather than swap: the store holds `stack: AuthView[]`,
each card renders the next inside its own content (which is how Base UI sees
the nesting), and "create an account" leaves the sign-in card standing one
step back. `goTo` pops instead of pushing when the target is the card
underneath, so the two footer links cannot grow the stack forever.

- [x] **Eyeball the popup on a phone-width viewport and in RTL (`SF`).**
      Measured in Chromium at 1280×800, 1280×560 and 390×844, English and
      Arabic: the panels fit without scrolling at normal heights, the window
      scrolls the whole card on a short one, the OTP slots hold six across at
      390px, and the close button mirrors to the left under `dir="rtl"`.
- [x] **Decide what `/login` and `/register` do for an in-app arrival (`SF`).**
      Decision: a client-side navigation opens the existing sign-in popup and
      returns to the previous page (`(.)login` and `(.)register`); a cold load,
      including the route guard's redirect, still renders the standalone page.
      Signing up is the same phone step, so both routes open that one panel.

### Community orbit under the marketplace sky hero — 2026-09-18

`CommunityOrbit` sits on white paper between `CloudShaderHeroDemo` and the
shop directory search on `/`. Logos and store/product counts come from the
preloaded `PUBLIC_SHOPS` query; copy is `landing.orbit*` (en + ar). Uses the
existing `motion` dependency (not `framer-motion`).

- [ ] Eyeball the orbit on a phone-width viewport and in RTL — scale + tag wrap
      should stay clear of the fixed notch bar and not collide with `#shops`.
- [ ] When the platform has enough shops, decide whether the orbit’s “active
      stores” figure should share a single live source with `heroSocialProof`
      instead of two different marketing numbers on one page.

### Marketplace `/` cloud-shader hero restored to Aceternity composition — 2026-09-18

The directory hero is back on the demo's blue sky (`#3876ba` / `#8cbfe8` /
`#fbf8f2`), white type, dual pill CTAs, glass social-proof strip (logo fan +
white/frosted count pill — not mint Salla chrome), and frosted glass product
frame. `CloudShader` lives in `@repo/ui` (on-screen WebGL mount + CSS sky
fallback). Copy is Zaydak via `landing.*`; both CTAs are `#shops` (no apex
sign-in route).

- [x] Replace the Aceternity CDN glass-frame shot with a real Zaydak marketplace
      or vendor-dashboard screenshot hosted on our CDN, then drop
      `assets.aceternity.com` from `remotePatterns` / `OPTIMIZABLE_HOSTS`.
- [ ] Confirm the “68,000+” social-proof figure against a real platform metric
      (or switch the string to a live `shops.meta.total` once the count is
      large enough to market).

### Product tiles: no sold-out grey, and the original instead of the row thumb (2026-09-15)

Two things made a freshly imported catalogue look broken rather than stocked.
`CardPhotos` desaturated the photo of any unbuyable product — and an import
lands every row `quantity = 0` with `track_quantity` on, so the whole grid went
grey at once and read as failed images. That filter is gone; sold out is said by
the chip and the disabled add button. The tiles also rendered `image.thumbnail`,
which is `ThumbnailService`'s single 368x232 landscape crop built for a
media-library row: `object-cover` took a 232px band out of it and stretched it
over a 3:4 frame ~480 CSS px wide, past 2.5x. Catalogue tiles and the product
page's mosaic tiles now render `image.original` and let `sizes` pick the width;
the 64px strip still uses the derivative, which is the size it was made for.

- [ ] One derivative serves a 44px order line and a half-viewport mosaic tile.
      A second, square, tile-sized rendition (and a backfill for existing
      attachments) would let the grid stop pulling originals on hosts
      `/_next/image` cannot optimise.
- [ ] Imported originals are whatever the source served — 800x800 here, but a
      merchant's own 4000px JPEG elsewhere. Worth a ceiling on the ingest path,
      which today stores bytes untouched by an explicit owner decision.

### The shop home leads with a product marquee — 2026-09-18

`HomeHero` was a full-height cover photograph and is now centred shop identity
over a slow product marquee. Type sits on the page ground, so contrast no longer
depends on a vendor cover's exposure. The band is built from the popular-then-
newest rails (`buildHeroShowcase`): real catalogue frames linked into those
products, padded with the cover / bundled fallback when the shop has too few
photographs. Motion matches `CollectionTicker` (CSS loop, pause on hover/focus,
static under reduced motion). The headline is not entrance-animated — still the
LCP region.

- [ ] Measure LCP now that the opening is type + a strip of product thumbs
      rather than one full-viewport cover (`priority` on the first two frames).
- [x] If a shop has dozens of photographed SKUs, consider preferring in-stock
      or sale items in the marquee over a raw popular+newest concat.
      Done 2026-10-02: `buildHeroShowcase` takes its frames from
      `rankShowcaseCandidates`, a stable re-rank of the popular-then-newest
      list. Buyable products (`isPurchasable`, so a backorder counts) come
      before sold-out ones, and a buyable markdown (`markdownPercent`, now
      shared with the deals row) ranks four places earlier, behind whatever
      already stands there. Order inside each group is the rails' own, so a
      small all-buyable shop sees no change; it is a pure function of its
      input, so SSR and hydration draw the same band; and it reads only fields
      the rails' card fragment already carries, so no preload changed.
      `hero-showcase.test.ts`.
- [ ] `SALE_BOOST = 4` is a first guess (`SF`). Revisit it against a shop with
      many markdowns once the LCP box above is measured.

### The shop home led with a full-height cover — 2026-09-14

`HomeHero` was a split (type on paper, cover beside it) and became a full-height
photograph with manufactured scrim contrast. Superseded by the product marquee
opening above; grade/crop fallback machinery retired with it.

- [x] Replaced by the product-marquee hero (2026-09-18).

### A failing preload no longer erases its own cause (2026-09-13)

A server-side `PreloadQuery` failure reached the browser as one fixed string —
*"Error from event stream. Redacted for security concerns."* — and React
switched the subtree to client rendering. The redaction is
`@apollo/client-react-streaming` behaving correctly: it tees a contentless
`{ type: "error" }` marker into the stream, so the message, the status and the
operation name are all gone by the time anything can report them. What made it
undebuggable was on our side — `rsc.ts` had no error link at all, so the server,
which knew the whole answer, logged nothing. The commonest cause is the API
being down, restarting, or having thrown on schema drift at boot, which from the
browser is indistinguishable from a front-end bug.

`rsc.ts` now composes an `ErrorLink` ahead of its `HttpLink`. It only logs —
`[storefront RSC] <Operation> failed: <message> [<error_code>]`, with the HTTP
status for a `ServerError` and the endpoint for a bare network failure — so the
streaming behaviour is unchanged and the terminal gets the truth. Separating
`CombinedGraphQLErrors` from `ServerError` matters because this back-end answers
with real HTTP statuses (404 `RESOURCE_NOT_FOUND`, 422 `VALIDATION_ERROR`), so
"the API said no" and "the API did not answer" look alike until the status is
printed.

The second half is that six suspense reads could take a whole page down. Three
already set `errorPolicy: "all"` (`ShopProvider`, the catalogue grid,
`ProductDetail`); `ShopHome`'s four, `CatalogFilters` and `ShopList` did not, and
every one of them already wrote `data?.x ?? []`. Because these reads are
preloaded, a throw costs the entire subtree its server rendering rather than
failing one component. All nine now hand the error back, and `ShopList` renders a
new `landing.loadError` rather than `landing.empty` — "no shops match that
search" is a statement about the search, and showing it when the API is
unreachable reads as an empty marketplace.

- [~] **The AI schema has no migration at all (`STORE` · `BE`)**
      **The first sentence of this entry stopped being true on 2026-09-13** and
      the entry was not updated: `prisma/migrations/manual/2026-09-13-ai-search-tables.sql`
      exists and is committed (`deeb2ce7`). It creates all three tables plus the
      two extensions, and its shape is derived from the queries rather than from
      the prose in `AI-SEARCH-DOCS.md`, which lists the table names and nothing
      else. Each extension is attempted in its own exception block so a server
      missing pgvector still gets `user_behavior_events`, which needs no
      extension and is what the trending rail reads.
      What is left is **running it**, and that is the half nobody can do from
      the repo. `apply-manual-migrations.cjs` refuses any host that is not
      loopback and has no override flag, so `npm run migrate:local -- 2026-09-13`
      covers a developer's machine and production is applied deliberately by a
      human. Neither has been confirmed done.
      **Verified against the local database on 2026-09-14, and it behaves as
      designed.** `user_behavior_events` and `user_ai_profiles` both exist;
      `product_embeddings` does not, and `pg_trgm` is installed while `vector`
      is not. That is exactly the documented partial-apply: the two tables that
      need no extension are created unconditionally and the vector half is
      skipped with a NOTICE, so the trending rail works on a stock server.
      The reason it is partial is the image: `docker-compose.yml` runs
      `postgres:16-alpine`, which ships no pgvector (`ls .../extension | grep
      vector` is empty). Completing the local AI stack means running
      `pgvector/pgvector:pg16` instead and re-running the file — the profile
      table gains its `preference_vector` column in place. Not switched here:
      that swaps an Alpine image for a Debian one under an existing data
      directory on somebody's working dev database, which is not a change to
      make on their behalf.
      Production is still unapplied and is still a human step.
      **An adversarial static review of the DDL against every query (5 readers,
      24 findings, 17 refuted) found the table shapes sound** — ON CONFLICT
      arbiters match their constraints, `model_version` nullability agrees with
      every writer and every `IS NULL` predicate, the opclass matches the `<=>`
      the queries order by, both FK targets resolve through `@@map`. Three real
      defects came out of it, all now fixed, and the interesting part is that
      none was in the DDL:
      - **`prisma.config.ts` did not list the three tables in `tables.external`**
        — found independently by all five readers. The migration's own header
        names this as a precondition, but an instruction living in a SQL file is
        not a guard: nothing ties `migrations/manual/**` to that list. Fixed by
        adding them *now*, before the migration is applied anywhere, which is
        the safe order. The symptom is worse than the header implies: Prisma's
        data-loss guard keys on the table being **non-empty**, so a deploy soon
        after applying the SQL drops the tables *silently* and goes green,
        resurfacing later as `relation … does not exist`. And unlike the
        LangGraph `checkpoint*` tables, which `PostgresSaver.setup()` recreates
        at boot, nothing here self-heals.
      - **`preference_vector` was UPDATEd before the profile row was INSERTed**
        (`user-profile.service.ts`), so a first-time user's vector was written
        to zero rows and discarded — and since profiles only recompute past
        their TTL, the retry was an hour away. The two calls are reordered.
      - **A no-pgvector server could never write a profile at all.** The
        `product_embeddings` read at the top of `computePreferenceVector` sat
        outside every try/catch, so on a server where the migration correctly
        skipped that table, the throw propagated and took the *unconditionally
        created* `user_ai_profiles` write with it. Now guarded.
- [x] **`trigramSearch`'s predicate cannot use the trigram index (`BE` · `T3`)**
      **Re-checked 2026-09-14, and half of what this entry used to say was
      wrong in a way that would have cost us.** It offered "drop the index,
      which is currently pure write cost on the busiest table in the schema for
      a path it cannot serve" as one of two options. The index is not unused:
      `gin_trgm_ops` exists precisely to accelerate `LIKE` / `ILIKE` with a
      leading wildcard, and `vector-store.service.ts` has two such predicates on
      exactly the indexed expression — `LOWER(p.name::text) LIKE '%' || … || '%'`
      in the keyword branch, and `LOWER(p.name::text) LIKE $n` in the
      word-by-word branch. Dropping it would have slowed both live search paths
      to a sequential scan on `products`. **That option is withdrawn.**
      What remains true is the narrow half: `similarity(LOWER(p.name::text), $1)
      > 0.15` in `trigramSearch` is a *function* call, and `gin_trgm_ops`
      accelerates the trigram **operators** rather than `similarity()`. The
      planner does not rewrite one into the other, so that one query
      sequentially scans whether the index exists or not.
      So the only decision left is about `trigramSearch` itself, and it is a
      product call because it changes what shoppers find: rewriting the
      predicate as `LOWER(p.name::text) % $1` lets the index serve it, but `%`
      reads its cutoff from `pg_trgm.similarity_threshold`, whose default is
      **0.3** against the 0.15 written here — a stricter match, so fewer
      products come back. Setting the GUC per session is possible but has to
      survive a pooled connection.
      Leaving it alone is defensible: it is one query, and the two `LIKE` paths
      that carry most of the traffic are already indexed.

### Single-currency storefront — SAR only (2026-09-12)

Shopper-facing currency selection is switched off. The platform trades in SAR
alone, so `CurrencySwitcher` no longer renders anywhere (footer record row,
account menu, notch panel) and `CurrencyProvider` pins the display currency to
the shop's base: the stored preference is not read and `setDisplayCurrency` is
inert, so a visitor who picked USD before the control disappeared is not stranded
in a currency with no control left to change it. Every `isConverted` branch
downstream (`ProductPrice`, `CheckoutPage`, `OrderSummary`) goes quiet on its own.

It is one flag — `MULTI_CURRENCY_ENABLED` in `shared/lib/currency/currency-presets.ts`
— rather than a deletion, because expanding to other GCC markets is planned. The
ten presets, the converter and the reference rates stay, and their tests are
`skipIf`-gated so they run again the moment the flag flips.

- [ ] **Live FX rates before re-enabling multi-currency (`STORE` · `BE`)**
      `RATES_PER_SAR` is a hardcoded peg table. Flipping `MULTI_CURRENCY_ENABLED`
      back on needs a real rate source (cached server-side, with a staleness
      bound) and a decision on whether `presentment_currency` on the order
      snapshot is written from it.

### Custom domains — the four silent failures (2026-09-12)

Detection for four ways a domain can have perfect A and CNAME records and still
not work, each invisible to a routing comparison, and each mapped from Shopify's
own troubleshooting documentation.

**CAA blocking issuance.** `CaaPolicyService` judges the RRset a certificate
authority would actually read — which is *not* the apex's: RFC 8659 has the CA
climb from the hostname upward and stop at the first name carrying any CAA
record, so `DnsInspectorService` climbs the same way. An `issue` value that is
empty, `";"` or malformed forbids every authority, and the common case is a
trailing dot, which reads as correct. Authorisations are additive, so one
permissive record beside a restrictive one permits. `issuewild` and `iodef` can
never block a single-name certificate. A blocked zone sets `tls: FAILED` — the
one place a DNS reading outranks the host, which reports `PROVISIONING`
truthfully and forever. `STOREFRONT_CAA_ISSUERS` defaults to `letsencrypt.org`.

**A proxy intercepting.** `detectProxy()` matches the hostname's addresses
against Cloudflare's published CIDR ranges. In-range proves the orange cloud is
on; out-of-range proves nothing, because bring-your-own-IP space is on no public
list — so null means "not proven", never "not proxied". When proven, the diff
emits no routing instructions at all: public DNS shows the proxy's addresses,
not the zone's, so "update the A record" would send a merchant to change a value
that is already correct.

**DNSSEC failing validation.** Over DNS-over-HTTPS, because `node:dns` rejects
`DS` and `DNSKEY` before sending a packet. Bogus is SERVFAIL with checking on
*and* an answer with checking off — requiring both is what separates it from a
dead nameserver, which fails twice — confirmed against a second provider before
it is shown. It clears `dns_propagated`: validating resolvers, about two
visitors in five, will not answer for the domain at all.

**A stray AAAA record.** Valid DNS that still breaks the store — a browser
prefers IPv6, so around half of visitors, consistently the same half, reach
whoever hosted the site before, while the merchant checks on IPv4 and sees it
working. Listed for removal unless `STOREFRONT_APEX_IPV6` makes it a
requirement; empty is correct on Vercel, which has no IPv6 for third-party DNS.

Two things were fixed on the way in. The diff used to read the address a CNAME
resolves to as a surplus A record, so the most common correct configuration —
a subdomain with the right CNAME — was told to delete a record that is not in
its zone. And pressing Verify ran the whole inspection twice, once for the
mutation and once for a `refetch()` whose comment claimed it was avoiding
exactly that; the card now renders the mutation's own answer.

- [ ] **The dev machine cannot resolve AAAA records (`INFRA`)**
      `dns.resolve6` returns ENODATA for every name here, even with explicit
      public resolvers, so the stray-AAAA detection cannot be exercised against
      live DNS locally. It fails safe — no AAAA seen means nothing flagged —
      but confirm the API host in production can before trusting the check.

### Custom domains — DNS inspection and diff (2026-09-12)

The setup screen stopped printing records and started reading them. Three
services behind it: `DnsInspectorService` reads the zone from two public
resolvers **in parallel**, which is what makes `dns_propagated` a real check
rather than a second label for `dns_configured`; `DnsProviderDetectorService`
names who runs the DNS from the nameservers and answers `UNKNOWN` rather than
guessing; `DomainDnsDiffService` turns the two record sets into
add/update/remove/correct.

The diff's whole value is what it refuses to touch — only the exact
`(type, name)` slot a required record needs is ever examined, so MX, SPF, DKIM
and DMARC are never candidates for deletion. CAA is add-only. The five readiness
checks are reported separately so "you have finished and we are issuing a
certificate" is distinguishable from "something failed".

- [ ] **www / apex relationship (`STORE` · `VEN`)**
      A merchant connecting `example.com` almost always wants `www.example.com`
      too, and the two should not both be canonical. Deferred with the redirect
      policy below, because they are the same decision: which address is the
      real one, and what happens to the other.
- [ ] **Cache invalidation is a short TTL, not an invalidation (`STORE`)**
      The storefront's hostname cache is per serverless instance and nothing can
      push into it, so removal is bounded by a 60s TTL rather than cleared. A
      shared cache is the real fix; the TTL is sized as the stopgap it is.

### Custom merchant domains (2026-09-12)

A merchant can point a domain they own at their storefront from
Settings → Domains, alongside the platform subdomain rather than instead of it.
`ShopDomain` stores only what the merchant brought — `<slug>.<root>` stays
derived from `Shop.slug`, so a rename cannot leave a stale row behind — and the
unique index on `hostname` is what makes two shops claiming one address
unwinnable rather than merely checked.

The host API is behind a `DomainProvider` interface. `ManualDomainProvider` is
the default and calls nobody: it prints the platform's DNS records and verifies
them with a lookup, which is a complete flow. `VercelDomainProvider` is opt-in
because it needs a credential with authority over the whole production project,
exercised on a path a merchant triggers by filling in a form. The storefront
resolves a custom host in `proxy.ts`, but only after the pure parse finds no
tenant, so a platform subdomain and the apex never touch the network.

- [ ] **Wire `STOREFRONT_APEX_IP` / `STOREFRONT_CNAME_TARGET` in production (`INFRA`)**
      Until one is set, `custom_domains_enabled` is false and the connect flow
      is hidden. On Vercel these are the documented apex IP and CNAME target;
      check current values before setting them.

### Multi-tenant domains — platform subdomains (2026-09-11)

A storefront now answers at two addresses that render the same route tree:
`zaydak.com/acme/products/mug` and `acme.zaydak.com/products/mug`. `proxy.ts`
resolves the tenant from the `Host` header and, on a shop host, rewrites the
path **internally** to the `/[shopSlug]/…` tree — so `params.shopSlug`,
`storefrontContext(slug)` and the `X-SHOP` header are unchanged and the
back-end needed no tenancy work at all. Turning it on is one optional env var
(`NEXT_PUBLIC_ROOT_DOMAIN`); unset, every request falls through to the
path-based behaviour the app already had, so no existing URL broke.

The load-bearing part is that the first path segment stops being the shop:
on `acme.zaydak.com/checkout` a path-first read resolves a shop named
`checkout`, ships `X-SHOP: checkout`, looks for a cookie nothing ever wrote and
un-gates the checkout page — all silently. Links are therefore written
`` `${base}/cart` `` rather than `` `/${slug}/cart` ``, `routeDecision` is
handed the resolved scope instead of parsing it, and absolute URLs go through
one `shopUrlBase`. Custom merchant domains are deliberately **not** built: a
platform subdomain label *is* a shop handle, so Phase 1 needed no table, no
cache and no Vercel API.

- [~] **Backfill reserved handles already taken (`INFRA` · `SEC`)**
      **The tool is built; the run is not.** `npm run audit:reserved-handles`
      (`scripts/backfill-reserved-handles.ts` over the pure planner in
      `src/shops/lib/reserved-handle-backfill.ts`) reports every shop holding a
      reserved handle with its order and product counts, derives a deterministic
      replacement, and exits non-zero while any collision remains — which is
      what lets "this must come back empty" be a gate rather than a line in a
      runbook. `--apply` renames, and needs `--actor` plus `--i-mean-it` against
      a non-loopback host.
      What is left is running it against production and sending the emails, so
      this is console work now rather than repo work. It still has to come back
      empty **before** wildcard DNS is pointed at the storefront: `www.<root>`
      would otherwise answer with a merchant's storefront and `login.<root>`
      would be a sign-in page on the platform's own certificate.

---

## Admin console

Focus: Platform governance, dispute management, granular permissions, and platform usage analytics.

### Platform figures count every placed order (2026-09-29)

The console's `/analytics` reads the same `AnalyticsService` as the vendor
dashboard, so its total and today's revenue, monthly bars and the rest moved
to the new sale definition (Back-end & API, same date) with no admin code
change. The "Completed orders, all time" hint and the "No completed orders"
empty state now say what is counted.

- [x] **Sales by channel, platform-wide (`ADM`).** `salesByChannel` already
      answers without `X-SHOP`, with every row reading `connected: true`.
      The console has no card for it.
      Closed 2026-10-04 (the code had already closed it):
      `sales-by-channel-card.tsx` is on the admin `/analytics` screen
      (`analytics-page.tsx`), read through `ADMIN_PLATFORM_SALES_BY_CHANNEL`,
      which deliberately does not select `connected`: a CSS ribbon and bars,
      `formatAmountCents`, a 7/30/90-day window. Pinned by
      `sales-by-channel.render.test.tsx` and `sales-channels.test.ts`.

## Back-end & API

### `X-SHOP` names a shop; it does not prove you own it (2026-10-04)

A read-only audit of every resolver, started from the `getOrders` fix in the
entry below, found a class of operations that trusts the header alone.
`ShopHeaderGuard` resolves any approved, active shop named in `X-SHOP` for any
caller and checks no ownership (only `ShopOwnershipGuard` or a service-level
owner check does), `PermissionsGuard` matches with `.some()` so every vendor
holds `manage_own_shop`, and shop slugs are public. Where an operation's chain
stops at `RequireShopGuard`, a vendor naming another shop's header acts on
that shop. All of it predates this pass and is deployed. It was read from the
code and spot-checked (returns, coupons, shipping providers), not exercised
against a running API.

What the audit cleared matters as much as what it found: orders, refunds,
payment intents, bank transfers, shipments, draft orders, disputes, balance,
withdrawals, wallets, contacts, customers, segments, abandoned carts, the
inboxes, analytics and the report builder, domains, plans and every
customer-session operation carry an ownership guard or a scoped lookup. Each
box below closes with its fix in the working tree; none of them serves until
the API image is rebuilt (the first box of the next entry).

- [x] **`returns` lists another shop's return requests (`BE` · `SEC` ·
      `T0`).** `returns.service.ts` sets the own-shops scope for a vendor and
      then overwrites it with the header shop: the same bug as `getOrders`.
      Closed 2026-10-05 (the code had already closed it): a vendor's `X-SHOP`
      only narrows `ownedShopIds`, and a shop outside that list is
      `INSUFFICIENT_PERMISSIONS` before any read. `returns.service.spec.ts`.
- [x] **`savedPrompts(shopId)` reads any shop's saved prompts (`BE` ·
      `SEC`).** The argument widens an `OR`, behind `JwtAuthGuard` alone.
      Closed 2026-10-05 (the code had already closed it): `findAll` calls
      `assertShopScopedMutation` before the shop's prompts join the `OR`, and
      a wrong id is refused rather than read as an empty list.
      `saved-prompts.service.spec.ts`.
- [x] **`coupons` and `coupon(id)` answer with no login (`BE` · `SEC` ·
      `T0`).** Every code, its limits and usage, and on `coupon(id)` the
      customers it is restricted to (name or phone, email). `verifyCoupon`
      also treats any vendor as the merchant, which makes it an eligibility
      oracle on another shop.
      Closed 2026-10-05 (the code had already closed it): both reads, and the
      writes beside them, are `JwtAuthGuard` + `ShopOwnershipGuard`.
      `verifyCoupon` honours `customer_id` only for the shop's owner or
      platform staff. `coupons.resolver.spec.ts`.
- [x] **`products` / `product` return margin fields to anyone (`BE` ·
      `SEC`).** `mapEntry` returns `cost_per_item_cents`, the negotiation
      floors and `ai_keywords` with no viewer check; the public product type
      calls the first a vendor margin secret.
      Closed 2026-10-05 (the code had already closed it): `findAll` and
      `findOne` go through `mapEntryFor`, which strips those fields unless
      the viewer owns the shop or is platform staff. `products.service.spec.ts`.
- [x] **`shops` / `shop(slug)` return the owner's email and phone to anyone
      (`BE` · `SEC` · `T0`).** Only `balance` is gated by `canSeeFinancials`.
      Closed 2026-10-05 (the code had already closed it): `mapShop` applies
      the same owner-or-admin rule to the owner's email and phone and to
      `orders_count`. `shops.service.spec.ts`.
- [x] **Store import has no ownership guard (`BE` · `SEC` · `T0`).** Any
      vendor can read another shop's jobs, scanned catalogue and CSV, edit a
      job its owner left READY and commit it (the commit runs as the job's
      user with `overwriteExisting`).
      Fixed 2026-10-04: both resolver classes carry `ShopOwnershipGuard` after
      `ShopHeaderGuard`, so a non-owner gets `INSUFFICIENT_PERMISSIONS` on all
      13 operations and `admin` / `super_admin` pass as before. The worker,
      the retention sweeps and the vendor agent's tools were checked and take
      no caller-chosen shop. Pinned by `store-import-tenancy.spec.ts`, which
      fails 53 of its 84 cases without the guard.
- [x] **Shipping providers have no ownership guard (`BE` · `SEC` · `T0`).**
      Reads (accounts with their non-secret credential fields in clear,
      locations, carriers) and writes: `upsertShippingProviderAccount`
      replaces another shop's carrier credentials. `shopShippingSettings` has
      no permission at all.
      Closed 2026-10-05 (the code had already closed it): every shop-scoped
      operation on `ShippingProvidersResolver` carries `ShopOwnershipGuard`,
      including the two that take no permission. `lookupNationalAddress`
      stays open to a customer because it reads nothing of the shop's.
      `shipping-providers.resolver.spec.ts`.
- [x] **Smaller operations on the header alone (`BE` · `SEC`).** Shop
      packages, `collectionItems` / `previewCollection` and every collection
      write, refund-policy writes (they feed the return window),
      `createDeliveryTime`, `productOrganizationOptions`.
      Closed 2026-10-05 (the code had already closed it): each of those
      carries `ShopOwnershipGuard`. Public collection and refund-policy reads
      stay on the optional chain. Guard specs for packages, collections,
      delivery times, refund policies and products.
- [x] **REST attachment uploads land in any shop's library (`BE` · `SEC`).**
      `POST /attachments` and `/attachments/from-url` take `JwtAuthGuard` and
      the header only, and count against that shop's storage quota.
      Closed 2026-10-05 (the code had already closed it): both routes add
      `OptionalShopOwnershipGuard`, so a named shop must be the caller's and
      a request with no header still stores the file under no shop.
      `attachments.controller.spec.ts`.
- [x] **Inventory and purchase orders accept another shop's product ids (`BE`
      · `SEC` · `T0`).** The location is checked, the product and variation
      are not, and `syncRollup` then rewrites that product's `quantity` and
      `in_stock`. A purchase order validates neither its destination, its
      supplier nor its lines, and `receive` writes stock there.
      Closed 2026-10-05 (the code had already closed it):
      `assertTargetsInShop` refuses a product or variation that is not the
      shop's before a stock write, and a purchase order re-checks its
      destination, supplier and lines inside the shop, including `receive`.
      `inventory.service.spec.ts`, `purchase-orders.service.spec.ts`.
- [x] **Four plausible findings to confirm or refute (`BE` · `SEC`).** The
      platform `otp` policy row readable through `setting(key)` with no
      header; `createAttribute` / `createAuthor` / `createManufacturer` /
      `createTag` writing a platform-global row when a vendor omits the
      header; `storeNotices` returning reader ids; the guest cart matched on
      `session_id` without `customer_id: null`.
      Closed 2026-10-05. Three were already closed: `setting(key)` returns
      nothing for the OTP policy unless the caller holds `manage_integrations`
      (`settings.service.spec.ts`); attribute, author and tag creates already
      call `assertShopScopedMutation`; `storeNotices` returns only the
      caller's own read receipts (`store-notices.service.spec.ts`). Two were
      real. `createManufacturer` still skipped the check when `X-SHOP` was
      absent and inserted `shop_id` null — it now uses the same assertion,
      and a missing shop is the same refusal as a shop the caller does not
      own. Guest cart lookups in `getOrCreateCart`, `CartSyncService.sync`,
      the customer bot and chat checkout matched on `session_id` alone, so a
      session still sitting on a customer's cart was that guest's cart; they
      now also require `customer_id` null. `adoptGuestCart` already did.
- [~] **What the audit did not cover (`BE` · `SEC`).** The vendor agent's and
      vendor bot's tool layers; secondary ids on ownership-guarded writes
      (inventory and purchase orders failed that check, so coupons'
      `product_ids` / `segment_ids`, image-gen attachment ids and
      carrier-pickup location ids deserve the same read); inbound webhook
      signatures; and the SSRF surface of `from-url` uploads and store import.
      Progress 2026-10-10: coupon/reference-attachment/pickup ownership,
      inbound authentication and guarded URL fetches reviewed. Fixed chat
      confirmations crossing the same account's shop/channel boundary and
      concurrent Stripe/carrier webhook retry claims. The whole tool registry
      still needs review. The continuation fixed linked-handset revocation:
      incoming WhatsApp/Telegram links and confirmation cards recheck the
      active, non-deleted account and its current `manage_own_shop` permission;
      enrollment rechecks it too. Outbound notifications and revocation during
      an already-running tool still need a separate lifecycle review. The
      broad box is not closed. Scope, tests and limitations are in the
      [audit record](docs/production-readiness/p02-todo-audit-2026-10-10.md).

### `orders(filters.shop_id)` read outside the caller's shops (2026-10-04)

Found while adding the channel filter to the orders list.
`OrdersService.getOrders` ran `if (filters.shop_id && !shopId) where.shop_id =
filters.shop_id`. For a vendor calling without `X-SHOP`, that replaced the
own-shops scope (`{ in: <owned shops> }`) with the argument, so
`orders(filters: { shop_id })` listed any shop's orders. It was read from the
code, not exercised against a running API.

The filter now narrows the scope and never replaces it: a vendor's own shop is
returned, any other shop matches nothing, and an admin or a buyer scope
behaves as before. The dashboard always sends `X-SHOP` and the storefront
sends `as_customer`, so neither changes. Pinned by three tests in
`orders.service.spec.ts`. A grep for the same assignment found it nowhere else
on private data: banners, tags and products take a shop filter on public
listings, and commissions is admin-only.

- [ ] **Rebuild the API image (`INFRA`, production-only).** Everything this
      pass changed in `back-end/` waits on `docker compose build api`: the
      scope fix above, and the merchant's cancel. The dashboard's "Mark as
      cancelled" now calls `updateOrder`; against the older image there is no
      server refusal of a paid card order (the dialog blocks it client-side)
      and no `order.cancelled` event.
- [x] **Sweep the other private lists for a caller-supplied scope (`BE` ·
      `SEC`).** The grep covered one spelling of the bug. Read every list that
      takes a `shop_id`, `customer_id` or owner argument and confirm the
      argument narrows the auth filter instead of replacing it.
      Done 2026-10-04, read-only: every resolver was walked and each candidate
      traced into its service. The findings are the entry above, with what was
      cleared.

### A sale is every order placed, not every completed one (2026-09-29)

Every revenue figure counted `order-completed` alone: the sales report,
`analytics`, yearly sales, top products, sell-through, customer analytics,
attribution, inventory ABC, the report builder, targets, the daily rollups,
the admin console and Sidekick. Only a manual `updateOrder` ever completes an
order, so a shop selling through its Telegram bot read almost nothing. The
owner decided: a sale is every order except `order-cancelled` and
`order-failed`. Settled refunds (`approved` / `refunded`) are subtracted,
dated by the refund. `order-refunded` stays in, so its refund is not taken
off twice. A partly cancelled order's `cancelled_*_cents` slices are netted
off. One module, `src/analytics/sale-orders.ts`, holds the rule, and every
surface above reads it. Deliberately out of scope: the balance ledger (still
credited on completion; that is payouts, not sales), coupon performance and
customer-segment metrics. Migration
`20260929120000_sales_definition_placed_orders` clears `sales_rollup_states`
so the rollups rebuild, and indexes `draft_orders.order_id`. The summary
cache key moved to `v2`.

New query `salesByChannel`: the sales report split by where each order was
placed, derived at read time and never written. `placed_via` of
`telegram_assistant` or `whatsapp_assistant` gives the chat channel; else a
`draft_orders` row pointing at the order makes it a merchant-built draft
order (even if the draft was later deleted); else it is the online store.
Storefront orders still write no `placed_via`, because the notifications read
any value there as a chat order and drop the confirmation. The rows sum to
`salesReport` exactly, bucket by bucket too, and a real-Postgres spec pins
it. On entaj's local data the service and hand-written SQL agree: last 30
days 1,201.10 SAR from 15 orders, last 7 days 1,110.30 SAR from 14 (Telegram
1,019.50).

- [x] **Rebuild the API container and apply the migration (`INFRA`).**
      Done 2026-09-29: the owner rebuilt `zaydak-api` at 10:14 UTC, and
      `20260929120000_sales_definition_placed_orders` was applied to the
      local database (the only pending migration) after the owner approved
      the exact change. The rollups rebuilt within a minute; entaj reads
      1,201.10 SAR lifetime, 1,110.30 SAR for the last 7 days, and
      `salesByChannel` matches `salesReport` live. On Render, run
      `DELETE FROM sales_rollup_states` once more after the new code is live
      if the old code refreshed in between.
- [ ] **Nothing completes an order automatically (`BE`).** Only a manual
      `updateOrder` moves an order to `order-completed`, which is also the
      only thing that credits the vendor balance. Decide what should complete
      it: carrier delivery, a timer after out-for-delivery, or COD collection.
- [x] **Orders left pending forever now count as sales (`BE`).** Done 2026-10-14:
      The bank-transfer sweeper's query now sweeps legacy orders with
      `payment_expires_at: null` whose `created_at` has passed the payment
      window and submission grace (`legacyTransferCutoff`), and
      `OrdersService.expireUnpaidTransfer` properly expires them. Stripe orders
      with expired sessions or past the cut-over window are handled by
      `CardPaymentDeadlineService` and `CardPaymentResolver`.
- [x] **Customer segments count statuses that do not exist (`BE`).**
      Decision 2026-09-29, already in the live code: segments follow the sale
      definition (`customer-order-metrics.ts` / `saleOrderWhere`).
      `order-delivered` and `order-paid` are gone from that code. The customer
      bot's `my_orders` lists every order except a failed one. Historical
      `prisma/manual` scripts were left as applied.
- [x] **Take refunds off the figures that are still gross of them (`BE`).**
      Done 2026-09-29 for `total_revenue_cents` and `todays_revenue_cents`
      (both the rollup-served and the live path, so the admin console too),
      `yearlySales` (by refund month) and `getCustomRangeStats`. Still gross
      of returns, and now documented so: top products, sell-through,
      inventory ABC and the report builder. They are line-level, so the
      remaining fix is subtracting settled `refund_line_items` per product
      (and per report-builder dimension), not an order-level aggregate.
      Closed 2026-10-04 (the code had already closed it on 2026-09-29): top
      products, sell-through and inventory ABC subtract settled refund lines
      per product, dated by the refund (`analytics/product-returns.ts`), and
      the report builder unions settled refunds as return rows carrying their
      order's dimension values, so its totals equal `salesReport`. A refund
      with no line items names no product, so it stays gross in the line-level
      figures; no allocation was invented. `product-returns.e2e-spec.ts` pins
      it on real Postgres.
- [x] **`localDayStart` starts up to 999 ms late (`BE`).** Done 2026-09-29:
      `zonedOffsetMs` compares the wall clock with the instant cut to the
      whole second, so every window starts on the exact midnight and an
      order placed in the day's first second is no longer dropped from
      `ordersByStatus(period)`. Sidekick's `localMidnightOf` is now a no-op
      guard.
- [x] **One constant for the `placed_via` strings (`BE`).** Chat checkout's
      `PLACED_VIA` and analytics' `PLACED_VIA_CHANNELS` state them twice.
      Move them to one shared module (e.g. `src/orders/placed-via.ts`).
      Closed 2026-10-04 (the code had already closed it):
      `orders/placed-via.ts` holds the strings (`PLACED_VIA_TELEGRAM`,
      `PLACED_VIA_WHATSAPP`, `CHAT_ACTOR_TO_PLACED_VIA`, `KNOWN_PLACED_VIA`),
      and chat checkout, `analytics/sales-channels.ts` and `orders.service.ts`
      import them. `placed-via.spec.ts`.
- [x] **Attribution groups can go negative (`BE` + `VEN`).** A refund in the
      window for an order placed earlier lands on a group with 0 orders and
      negative revenue. Check the traffic-source card and ROAS. The card is
      done (2026-09-29): its bars are shares of the positive revenue,
      clamped, where a negative width used to draw a full bar. ROAS on the
      attribution page is still to check.
      Done 2026-10-01: ROAS checked. A negative-revenue group reads "—" in the
      API (`roas_bps` null) and on the page. The page was also blanking a
      group with spend and zero revenue, which the API reports as 0;
      `roasMultiple` now returns null only for negative revenue, so that group
      reads 0.00x and "spent and sold nothing" no longer looks like "no
      spend".
- [x] **`getYearlySales` buckets by the server's month (`BE`).** Use the
      shop's timezone, as the sales report does. Closed 2026-10-01 (stale):
      it cuts the year at the shop's local 1 January and buckets orders and
      refunds by local month (2026-09-29), and since 2026-10-01 it sums the
      sales report's per-order total too.
- [x] **No shop has a timezone unless one is written into the database
      (`BE` + `VEN`).** Done 2026-10-14: `timezone` added to `CreateShopInput`,
      `AdminCreateShopInput`, `UpdateShopInput` and validated against native IANA
      timezones. Default assigned based on `home_country` (`Asia/Riyadh` for SA /
      nullish) on shop creation. Vendor dashboard General Settings exposes an
      interactive time zone selector with regional defaults and saves to
      `updateShop`.
- [ ] **Two order-level sales bases remain in `AnalyticsService` (`BE`).**
      The rollup / `analytics` KPIs and customer spend sum `total_cents`,
      which leaves out wallet spend; the sales report, Sidekick and (since
      2026-10-01) `yearlySales` count it. Unifying needs a rollup version
      bump and rebuild (derived rows on the real DB) and changes segment
      membership, so it is the owner's call.
- [x] **Sales would count product VAT twice on a tax-inclusive shop (`BE`,
      latent).** On `prices_include_tax = true`, `amount_cents` is VAT-gross
      and `sales_tax_cents` holds the same embedded VAT, so `saleMoney`'s
      total adds it again. Nothing sets the flag today (no API or UI); fix
      before it is exposed — e.g. an order's sale total as its pre-wallet
      charge (`total_cents` + `wallet_applied_cents`, net of cancelled
      slices), which equals today's figure on every tax-exclusive shop.
      Done 2026-10-04: an order's total sales is read from its charge before
      wallet spend (`total_cents + wallet_applied_cents`, net of the cancelled
      slices; `saleChargeCents` / `saleMoneyTotalSql`) instead of being
      rebuilt from its parts. The sales report and its series,
      `salesByChannel`, `yearlySales`, the period summary, the target series
      and the report builder's `TOTAL_SALES` / `AOV` all read it. On an order
      priced with tax on top it is the same number: unit and real-Postgres
      specs pin the equality, and the local database has no order where the
      two differ. On a tax-inclusive order the product tax is counted once.
      The rollup and `total_revenue_cents` sum `total_cents`, which never held
      the tax twice, and were not touched. `sale-total.e2e-spec.ts`.
- [ ] **Breakdown lines do not add up to the total on a tax-inclusive shop
      (`BE` + `VEN`, latent, owner's call).** `gross_sales` and `net_sales`
      stay VAT-gross while `taxes` names the same VAT. Decide whether gross is
      reported VAT-exclusive before `prices_include_tax` is exposed; profit
      and margin count the VAT as revenue there too.
- [x] **`editOrder` rewrites `total_cents` without the wallet (`BE`).** It
      recomputes the total from amount, tax, delivery and discount and never
      subtracts `wallet_applied_cents`, so an edited order part-paid from the
      wallet reads the wallet spend twice. No wallet orders exist today.
      Done 2026-10-04, ticked 2026-10-05: `editOrder` writes
      `total_cents` = charge − `wallet_applied_cents` and refuses a charge
      below that credit (`below_wallet_applied`). The wallet column is not
      rewritten. Pinned in `orders.service.spec.ts`.
- [x] **Processor fees take the wallet off twice (`BE`, latent).**
      `computeBreakdown` charges fees on `total_cents − wallet_applied_cents`,
      but `total_cents` is already net of the wallet.
      Done 2026-10-04, ticked 2026-10-05: fees are `computeFeeCents` on
      `total_cents` alone. A full-wallet order (`total_cents` 0) has no fee.
      Pinned in `analytics.service.spec.ts`.
- [x] **Line refunds over-refund on a tax-inclusive shop (`BE`, latent).**
      Done 2026-10-05: when `Shop.prices_include_tax` is set, a line refund
      keeps `tax_cents` and does not add it to `total_cents`. The flag is read
      from the shop at refund time. Pinned in `refunds.service.spec.ts`.

### Phone-first identity — the roadmap agreed on 2026-09-25

The owner's decision, made while testing the Telegram checkout: **the phone
number is the customer's identity**, proved by a one-time code or by the chat
it arrives from, and email is optional data (receipts, updates, recovery),
never a sign-in requirement. The chats already work this way (release 4.1 of
in-chat checkout). What remains is the storefront, the other consoles and the
accounts made before it.

**Phase 1, the same day.** No chat asks for a code, an email or a sign-in to
claim an account: an email-code bridge for old accounts was built and removed
on the owner's call. A number on a customer account nobody proved it on
**moves to its proven holder** (a new account; the old one keeps its email,
password and orders; audited); a merchant's or admin's account is **never
opened, bound, proven or stripped** by a customer path, so its number takes no
order in a chat; and a **texted sign-in code goes only to a number its
account proves** (`PHONE_NOT_CONFIRMED`) — `verifyOtpCode` had signed anybody
holding a number typed into an account into it, admins included. Customer and
staff identities still share one account per number (`users.phone` is unique
platform-wide); the owner prefers a customer identity per shop (box below).

**Phase 1 is a safety bridge, not the end of phone-first.** The owner's
review of the change log (2026-09-25): release 4.1 is close to ready; phase 1
stops a phone number reaching an account it should not, with three known
workarounds (a customer can end up with two accounts, a merchant's number
takes no order in a chat, claim links remain); **the per-shop customer is the
architecture change that removes them**, and comes before the storefront's
phone-only sign-in. The order agreed, which the boxes below follow:

1. A customer identity per shop, apart from staff sign-in.
2. Carts, orders, addresses and chat threads on that customer.
3. Match on the normalised E.164 number.
4. Storefront sign-in and signup by phone and a code only.
5. Migrate the email/password accounts.
6. Retire the remaining claim links. Done 2026-09-30.
7. Split what is left of `CartClaimService` into identity services.
8. AI memory per customer and shop (done 2026-09-30) (AI & Integrations, release 4.1's
   "conversation summary" box).

**Step 1 shipped the same day** (`src/customers/`, migration
`20260925190000_shop_customers`, see `back-end/docs/features/customers.md`).
`customers` holds one row per shop and number, found or made by
`CustomerIdentityService` from the channel that proved the number; the chats
and claim links resolve through it and never look up the platform's accounts
by number, so phase 1's rules are gone (no number moves, no "merchant's
number takes no order"). Each customer has a **backing account of its own**
in `users` — no phone, no email, no password — on which carts, orders,
addresses and chat checkouts still hang: per shop by construction, without
retargeting some twenty-five foreign keys and the sign-in pipeline at once.
A chat account made before the change and already holding a thread in the
shop is adopted as that shop's customer, once.

**Step 2 shipped 2026-09-26** (migrations `20260926100000_customer_accounts`
to `…130000_customer_relations`, see `back-end/docs/features/customers.md`).
Everything a shopper does in a shop now references `customers.id`: carts,
orders, chat checkouts, claim links, threads (`claimed_user_id` folded into
`customer_id`), wishlists, reviews, questions, feedback, stock alerts, saved
cards, payment intents, bank-transfer receipts, refunds, wallets, digital
downloads, negotiations, coupon allow-lists and usage, contacts, addresses
(`customer_addresses`) and customer notifications. Storefront sessions are
still accounts until box 4, so `ShopCustomerGuard` maps (session, X-SHOP) to
the customer; a console session is never a customer. Existing data was
carried over per (shop, account) pair; a number only when it had been
proven. Validated on a copy of the local data: every count equal, fifteen
integrity checks at zero, each migration a no-op run twice, drift clean, and
a replay from an empty database. Found on the way: `createOrder` wrote coupon
usage to a column that no longer existed (a `.map()` the compiler does not
check), a coupon-validity batch that could hang a request on a failed query,
and `customerPhoneKey` accepting `+0599…`.

**Step 3 shipped 2026-09-26** (migration `20260926140000_customer_phone_e164`):
one E.164 key for a customer's number, whichever door it came through.

**Step 4 shipped 2026-09-26** (`src/customer-auth/`, migration
`20260926150000_customer_sessions`, see
`back-end/docs/features/customer-auth.md`). A customer signs in to the
storefront with a phone number and a texted code, and in no other way — no
password, no email sign-in, no separate sign-up; a new customer is asked for a
name and, optionally, an email for receipts. The session is the customer's
own (`typ: customer`, subject `customers.id`, bound to the shop, refresh rows
in `customer_sessions`): the JWT guards publish it as `req.customerSession`,
never `req.user`, and `JwtAuthGuard` accepts it only where a shop-customer
guard follows, so no staff operation can be reached by a customer. The code
has its own purpose (`CUSTOMER_SIGN_IN`), which the staff `verifyOtpCode` does
not read, and nothing on the customer side reads `users`. Claim links sign
the customer in the same way; new customers get no backing account; an
account's session is no longer anybody's customer. The 22 operations consoles
and customers share (orders, payment intents, refunds, returns, shipments,
bank transfers, checkout) take `user` as null for a customer, and a customer's
own session reads its own orders by tracking number. Validated from an empty
database (31 migrations), on the copy of the local data (every count and
integrity check identical to step 2's), each migration run twice, and on real
Postgres: 20 concurrent refreshes of one token mint exactly one session. That
test found two bugs before they shipped: a constraint guard that looked the
name up across every schema, and a reuse-detection revocation rolled back by
the error thrown inside its own transaction — which the staff refresh has too
(box below).

- [x] **A customer identity per shop, apart from staff sign-in (`BE` + `SF` +
      `VEN`).** Done 2026-09-25: `Customer(shop_id, phone_e164)`, unique
      together, with `phone_verified_at`/`via`, an optional name, an email for
      notifications only (order emails fall back to it), and
      `direct_conversations.customer_id`. Vendor and admin sign-in stay on
      `users` and never meet it; a merchant's number is an ordinary customer
      in another shop. The storefront code resolves it later (box 4).
- [x] **Carts, orders, addresses and chat threads on that customer (`BE` +
      `SF` + `VEN`).** Done 2026-09-26: every shopper relation references
      `customers`, resolved by `ShopCustomerGuard`; the dashboard picks
      customers through `shopCustomers`. The chats' backing accounts remain
      only as what a claim link signs in to, and retire with box 4.
- [ ] **Apply the phone-first migrations (steps 2 to 4) locally and rebuild
      the API container (`BE`).** Rehearsed 2026-09-26 on a fresh dump of the
      live data (`live-pre-cutover-20260926-1225.dump`, 25 migrations
      applied there): all six apply, 40 counts equal, every integrity check
      zero, and 26 of 26 API smoke tests pass on the new build. The vendor
      dashboard, the storefront and the admin console must deploy at the same
      moment, and Vercel deploys them from `main`, so the cutover waits on the
      owner's go to commit and push. Build the image from the pushed commit,
      not the working tree; the running image is tagged
      `zaydak-api:pre-phone-first` for rollback. Production is unchecked for a wallet holding credit
      on an account with no order — the migration stops rather than drop it.
- [x] **Storefront codegen fails at HEAD (`SF`).** A probe document in
      `src/shared/lib/__tests__/shop-scope.custom-domain.test.ts` (`cart {
      id }`) is not valid against the schema, so `npm run codegen` stops.
      Closed 2026-09-27: the probe had already been made valid (`cart {
      success }`, commit `daf555bd`), so HEAD's codegen passed — but the
      test's `query Cart` still shipped in the production `gql.ts` map.
      Tests are now excluded from the codegen documents in all three apps
      (`!src/**/__tests__/**`, `!src/**/*.{test,spec}.{ts,tsx}`), which is
      the app/test boundary the `src/app/api/**` exclusion already draws.
      Proven from a clean HEAD worktree: codegen passes, its output equals the
      committed files, and with the original invalid probe put back it still
      passes (HEAD's config fails on it: `Cannot query field "id" on type
      "CartResponse"`).
- [ ] **Two customers for one person in a shop (`BE`).** A website account
      whose number was never proven became a customer with no number; the
      same person proving it in a chat is a second customer. Merging them
      belongs with "Migrate email/password customer accounts".
- [x] **Drop the storefront's `SIGN_IN_REQUIRED` branch (`SF`).** Done
      2026-09-26 with box 4: `ClaimCart` has one refusal screen, "sign in
      with your number and come back".
- [ ] **Drop the unread `addresses` table (`BE`).** Kept as Prisma
      `LegacyAddress` and read by nothing since step 2; drop it once the
      migration has run in production.
- [x] **The AI profile's city from the customer's address book (`BE`).**
      `UserProfileService` still reads `user_addresses`; with step 8 it
      should read `customer_addresses`.
      Closed 2026-09-28 (the code had already closed it): `resolveCity` reads
      the `customer_addresses` of every customer the account backs, a default
      first and then the newest.
- [x] **Match on the normalised E.164 number (`BE`).** Done 2026-09-26:
      one key for a customer's number whichever door it came through —
      `e164FromChannel` for a number a channel proved, `e164FromTyped` for one
      somebody typed (read in the shop's country); a CRM contact typed
      locally now links to its customer. Migration
      `20260926140000_customer_phone_e164` normalised stored values and added
      CHECK constraints on every customer phone column. Staff `users.phone`
      is untouched: vendor and admin sign-in do not change in this roadmap.
- [x] **Storefront sign-in and signup by phone and a one-time code only
      (`SF` + `BE`).** Done 2026-09-26: `sendCustomerSignInCode` /
      `verifyCustomerSignInCode`, the customer's own session and
      `customer_sessions`, `myCustomerProfile` / `updateMyCustomerProfile`;
      the storefront's login, sign-up, reset and social screens are one phone
      form, and the account page edits the name and optional email.
- [x] **Staff refresh-token reuse detection is rolled back (`BE`, security).**
      Fixed 2026-09-26 at the owner's request: `AuthService.refreshToken`'s
      transaction returns its outcome and `TOKEN_REUSE_DETECTED` is thrown
      after the commit, so the family revocation holds.
      `test/concurrency/staff-refresh-tokens.e2e-spec.ts` pins it on real
      Postgres (four of its six tests fail against the old code).
- [x] **A grace period for refresh races (`BE` + `VEN` + `SF`).** Closed 2026-10-14:
      Shipped 15-second grace window in `AuthService.refreshToken` and
      `CustomerSessionService.rotate`. When a token rotated within the window is
      presented again by a concurrent tab, the server returns the cached active session
      (or `TOKEN_ROTATED_RECENTLY` without revoking the family), preserving the
      session while still enforcing full family revocation for replay after grace.
      In `VEN` and `SF`, cross-tab Web Locks (`navigator.locks`) coalesce refreshes
      and adopt fresh cookies, and the `/api/auth/refresh` routes preserve cookies on
      `TOKEN_ROTATED_RECENTLY`. Pinned by backend Jest unit tests (101 + 11 passing)
      and Vitest suites in both apps.
- [~] **A guard against SMS pumping on the public sign-in code (`BE`).** Any
      number gets a code (signing up is signing in), bounded only by the
      per-IP throttle and the per-number cooldown and daily cap. Add a per-shop
      hourly cap, and limit numbers to the shop's country and its shipping
      zones' countries. **The per-shop cap shipped 2026-09-27:**
      `shop_hourly_limit` in the OTP settings (admin `/settings/otp`,
      `OTP_SHOP_HOURLY_LIMIT` until saved, 30 by default), counted on
      `KeyedRateLimiterService` fail-closed and only for a send that passed the
      number's cooldown and daily cap (`OtpService.sendBySms`'s `gate`);
      `CUSTOMER_SIGN_IN_RATE_LIMITED` (429) past it, with no row written and
      nothing texted. Pinned by unit tests, a 40-number burst through the real
      limiter, and a real-Redis concurrency test (200 at once admit exactly the
      budget). **The country limit is not built — it needs the owner's
      decision.** Locally (and so on the live sites) 22 of 33 live shops, 12
      of them active, name no country and none lists a country in a shipping
      zone, so the rule as written refuses every number at them — including
      `entaj`, the one shop with customers. And a Palestinian shop's
      customers use `+970` and `+972` numbers alike (both are on `entaj`
      today), so "the shop's country" alone refuses half of them. Decide: what
      a shop with no country and no zone countries allows (refuse all / skip
      the country check / require the merchant to set a country first), and
      whether a country implies its neighbours' numbers (PS also `+972`).
- [x] **The per-number OTP cooldown and daily cap are read, then written
      (`BE`).** `OtpService.issue` counts the rows and inserts after, so two
      requests for one number at the same moment both pass and both send.
      Closed 2026-09-28: the checks and the insert run in one transaction
      under a per-number advisory lock.
      `test/concurrency/otp-issue-lock.e2e-spec.ts` shows twenty requests at
      once issue one code, and a burst issues exactly the daily cap.
- [x] **The bank-transfer self-review rule misses phone customers (`BE`).** It
      sees a merchant only through `customer.user_id`, which a customer made by
      phone does not have, so a merchant buying from their own shop by phone
      can approve their own transfer. Closed 2026-09-27: the customer and the
      reviewer are compared on every key that names a person
      (`transfer-self-review.ts`) — the account a carried-over customer came
      from; the customer's proven number (its own or one its threads proved)
      against the reviewer's account number read in the shop's country and
      every handset paired with the WhatsApp vendor bot; and the customer's
      Telegram threads against the reviewer's linked Telegram accounts.
      Refused with `BANK_TRANSFER_SELF_REVIEW` (403) before and inside the
      transaction, `can_review` false, and the vendor bots answer
      `own_transfer`. It now binds a platform admin too — the docs always
      said "never the customer who paid", and an admin who owns a shop is its
      merchant.
- [ ] **A transfer its merchant paid has nowhere to be reviewed (`BE` +
      `ADM`).** Only a platform admin may review it now, and the admin
      console has no bank-transfer screen, so such an order waits out its
      payment deadline and is cancelled. Decide whether it needs a review path
      at all — it is the merchant paying themselves.
- [ ] **An end-to-end test of the phone sign-in (`SF`).** Needs an SMS
      provider that records the code in tests; no Playwright flow signs in on
      the storefront today.
- [ ] **`sessionShopIdFor` still binds storefront-scoped account logins
      (`BE`).** Such a session is no longer anybody's customer, so the binding
      serves nothing; drop it when staff sign-in is next revisited.
      Checked 2026-10-04, and it is not dead: `JwtAuthGuard` /
      `OptionalJwtGuard` publish an account token's `shop_id` as
      `req.sessionShopId`, `ShopHeaderGuard` answers `SHOP_SESSION_MISMATCH`
      on it, and `MagicLinkService` binds by the same rule. No first-party app
      mints such a session any more, but removing the binding turns a
      storefront-marked or `customer`-role account login into a platform-wide
      session and retires a documented error code. Owner's call: whether such
      a login may be platform-wide, whether the mismatch error is kept for
      tokens already issued (the refresh window is 7 days), and a migration if
      `refresh_tokens.shop_id` goes too.
- [x] **Guard the step-2 migrations' constraints by error (`BE`).** They look a
      constraint up by name, which finds one in another schema of the same
      database and skips this one. Harmless with one schema; steps 3 and 4
      use the `duplicate_object` guard `chat_checkouts` introduced.
      Closed 2026-09-28 (the code had already closed it): the step-1 and
      step-2 migrations add each key under `EXCEPTION WHEN duplicate_object`.
      `migration-guards.spec.ts` checks it, and
      `phone-first-migrations.e2e-spec.ts` proves it on Postgres; its teardown
      now has its own timeout, which had failed the suite after every
      assertion passed.
- [ ] **Migrate email/password customer accounts (`SF` + `BE`).** Since step
      4 the storefront signs in by phone only, so a customer carried over from
      a website account whose number was never proven (`account_migration`, no
      `phone_e164`) has no way in to its history; proving that number makes a
      second customer. Decide how such a history reaches its owner — without
      an email code, per the owner's rule — and merge the two.
- [ ] **Vendors: phone and code, plus step-up for sensitive changes
      (`VEN` + `BE`).** Email strongly recommended and verified (recovery,
      security alerts); re-verification before changing the payout account,
      a domain or an integration. Vendor signup does not record the phone as
      proven, so vendors sign in by email until this lands.
- [ ] **Admins: mandatory strong MFA (`ADM` + `BE`).** A passkey or an
      authenticator on top of the password or code; never a phone code alone.
- [x] **Retire the chat claim links (`BE` + `SF`).** Once the storefront signs
      in by phone, the claim link's only remaining uses (the transfer receipt
      page, "open the website") can sign in by code instead; delete the links.
      Done 2026-09-30 — see the claim-link box under the in-chat checkout entry.
- [x] **Split what is left of `CartClaimService` (`BE`).** It no longer claims
      accounts: it turns a channel identity into a customer and moves a guest
      cart. `CustomerIdentityService` (resolve or create the shop's customer),
      `ChannelIdentityService` (a WhatsApp sender, a Telegram contact, a
      thread) and `CartMergeService` (the guest cart onto the customer).
      Done 2026-10-10: `ChannelIdentityService` replaces `CartClaimService`
      across both chat processors and their tools; `CustomerIdentityService`
      remains the shared customer resolver; `CartMergeService` owns the
      preserving adoption previously mixed into `CartSyncService`. The latter
      retains storefront login replacement only. Existing behavior specs move
      with the services; the old module name stays, and no table is changed.
- [ ] **Drop the `cart_claims` table and the `CartClaim` model (`BE`).**
      Nothing writes or reads them since 2026-09-30. A migration, so it needs
      the owner's sign-off before it touches a real database.
- [x] **`storefrontUrlConfigured()` has no caller (`BE`).** Only its own spec
      calls it since the claim links went (`storefront-url.helper.ts`).
      Closed 2026-10-04 as wrong: it has two production callers,
      `shop-domains.service.ts` (`reservedRootDomain`) and
      `storefront-revalidation.service.ts`. Nothing was removed.
- [x] **Regenerate the live operations inventory (`BE`).**
      `back-end/test/live/graphql-ops.generated.md` and
      `docs/production-readiness/operations-inventory.md` are a 2026-09-16
      snapshot that still lists the two claim mutations
      (`back-end/test/live/classify-ops.cjs`).
      Done 2026-10-05: `node classify-ops.cjs` rewrote both from `schema.gql`
      (263 queries, 402 mutations). `redeemCartClaim` and `claimChatThread`
      are gone; five mutations stay unclassified.
- [x] **A number sitting on somebody else's unproven account (`BE`).** Settled
      2026-09-25, twice the same day: phase 1 moved the number to its proven
      holder; per-shop customers then made the move unnecessary — the number
      is the shop's customer and the platform account is never touched.
- [x] **Tell an account when its number moves to its proven holder (`BE`).**
      Dropped 2026-09-25: numbers no longer move off accounts.

### Fixed from the API logs (2026-09-25)

Four failures that repeated in `docker logs zaydak-api`, none of them visible to
a user as an error. **AI spend settlement** (`AiBudgetService.trueUpCost`) sent
fractional cents to an integer column and Postgres refused every true-up, so
each chat turn stayed booked at its 25c reservation; deltas now round up with
the sub-cent remainder carried per feature. **Four Redis subscribers** (WhatsApp
QR, WhatsApp inbox, notifications, cache invalidation) subscribed on a
`duplicate()` that inherited `enableOfflineQueue: false` before it was ready and
gave up for the life of the process; `src/redis/channel-subscriber.ts` now
subscribes on every `ready`. **WhatsApp webhook secrets** sealed under an older
encryption key failed connect and sync with `DECRYPTION_FAILED` forever;
`whatsapp/instances/webhook-secret.ts` replaces an unreadable one and registers
it with Evolution in the same call. **The search pipeline** now drops only the
vector ranker when the sidecar or pgvector is missing (the `categories` half is
under AI & Integrations).

- [x] **Rebuild the API image (`INFRA`, production-only).** None of the above
      reaches `zaydak-api` until `docker compose build api`. Wait for the
      Telegram chat-checkout migration (`20260925170000_telegram_chat_checkout`)
      to be applied to the local database first — the image runs no migrations,
      and a client generated from the new `schema.prisma` selects columns the
      tables do not have yet.
      Closed 2026-10-04: the image has been rebuilt since (the container was
      recreated on 2026-10-01 22:14 and 2026-10-02 11:25), and
      `20260925170000_telegram_chat_checkout` was applied to the local
      database on 2026-09-25 (`_prisma_migrations`).
- [ ] **Localhost URLs on the API serving the public domains (`INFRA`,
      production-only).** `FRONTEND_URL`, `SHORT_DOMAIN` and `UPLOAD_BASE_URL` in
      `back-end/.env.development` are localhost while dash.zaydak.com,
      admin.zaydak.com and zaydak.com run on this API, so magic links, short
      links and uploaded-file URLs point at the recipient's own machine. Needs
      the API's public origin decided — `api.zaydak.com` serves a Next app.
- [x] **A per-feature AI cost can go negative across UTC midnight (`BE`).** A
      turn reserved before midnight and settled after credits the new day's row;
      `total_cost_cents` is clamped with `GREATEST(0, …)`,
      `feature_breakdown.<feature>.cost_cents` is not.
      Closed 2026-09-28 (the code had already closed it): the settlement is
      booked on the reservation's own day and floored at zero, pinned by
      `test/concurrency/ai-usage-day-settlement.e2e-spec.ts`.

### Found while planning in-chat checkout (2026-09-25)

Reading `createOrder`, the cart, the claim path and the WhatsApp inbound for
the chat-checkout plan turned these up. None is caused by that work; the first
is the root cause of the number-squatting risk the chat registration now
defends against.

- [x] **P0 — Website registration stores a phone without proving it
      (`BE` + `SF`).** Anyone can register a stranger's number; the real holder's
      SMS login then signs them into the squatter's account (and marks the
      number proven). Needs a code sent to the number at signup when one is
      given, and a support path to release a squatted number.
      Closed 2026-09-28. The storefront has signed up by phone and a texted
      code only since step 4, which is the code at signup. The public
      `register` mutation, which nothing calls now, refuses a phone
      (`phone_needs_code`) and requires an email, so no account gets a number
      nobody proved. The support path: an admin blanks the phone in `/users`,
      and `adminUpdateUser` clears it with its proof (`phone_verified_at`,
      `phone_verified_via`, `phone_e164`); a changed number drops the old
      proof too.
- [x] **Re-adding a removed variation to the same cart fails (`BE`).**
      `removeItem` soft-deletes, the `(cart_id, product_id,
      variation_option_id)` unique index covers deleted rows, and `addItem`
      creates rather than revives — a unique violation. Simple products are
      unaffected (NULL variation ids never collide). `adoptGuestCart` clears the
      twin itself; the shopper's own path does not.
      Closed 2026-09-28 (the code had already closed it): every insert of a
      cart line clears its soft-deleted twin first (`clearDeadCartLines`, in
      `addItem` and both merges), pinned by
      `test/concurrency/cart-line-dead-twin.e2e-spec.ts`.
- [x] **An expired negotiated offer silently prices at list in `createOrder`
      (`BE`).** `negotiated-line-pricing.ts` skips it without an error, so a
      shopper shown the negotiated price at verify can be charged list at order.
      The chat checkout is guarded by its in-transaction `expect`; the
      storefront's checkout passes none and is not. Closed 2026-09-27: the
      storefront sends `expected_total_cents` (the total on screen) and
      `createOrder` refuses a higher total inside its transaction
      (`CHECKOUT_EXPECTATION_FAILED`); the checkout then says the price changed
      and quotes again. `loadNegotiatedLines` reports a lapsed offer (expired,
      spent, withdrawn), and `createOrder` refuses such a line
      (`NEGOTIATION_OFFER_EXPIRED`) unless a confirmed total — the storefront's
      or the chat's `expect` — holds it to what the customer saw. Unit tests
      cover both paths and a replayed attempt that finds the offer spent by a
      concurrent order.
- [x] **`createOrder` accepts a converted cart (`BE`).** Two orders from one
      cart (two tabs, a double submit) both go through: the second is priced
      from the catalogue with the cart's lines already deleted. A confirmed
      total now refuses it when the first spent a bargain; a cart with none is
      simply ordered twice.
      Closed 2026-09-28: `markCartConverted` flips the cart only if it is not
      converted already, and refuses with `CART_ALREADY_ORDERED` (409) inside
      the Serializable transaction, so nothing is written. Of two concurrent
      attempts the loser retries and is refused.
- [x] **`createOrder`'s serialization retry repeats side effects (`BE`).**
      Low-stock crossings accumulate across attempts and an audit row is
      written for attempts that rolled back (`orders.service.ts`,
      `lowStockCrossings` and the in-transaction `auditLog.log`). Closed
      2026-09-27: each attempt collects its effects in its own
      `OrderAttemptEffects` — crossings, redeemed coupons, and a
      `PostCommitEffects` queue for the `coupon_applied` audit rows, a coupon
      conflict the order went ahead with, and each SALE row's
      `INVENTORY_ADJUSTED` webhook (`InventoryService.adjust` was sending it
      before the order committed) — and only the committed attempt's are
      published, once. `editOrder` had the same shape and got the same fix.
      Tests abort an attempt after its work and show nothing of it is
      published; four of the five fail against the old code.
- [x] **`InventoryService.adjust` sends `INVENTORY_ADJUSTED` before its
      caller commits (`BE`).** Given an outer `tx` and no `afterCommit`
      queue, the webhook (and restock mail) leaves as soon as the rows are
      written; only `createOrder` passes a queue. Cancellation, refunds,
      inventory transfers, purchase orders, CSV import and product edits
      still send one for a movement a rollback or a retry undoes.
      Closed 2026-09-28: `adjust`, `setAvailable` and `transfer` take a
      caller's `tx` only with a `PostCommitEffects` queue (overloads), and
      every caller passes one and publishes it after its commit: cancellation
      and the failed-payment void per attempt, refund approval, the four
      transfer transitions, purchase-order receiving, CSV import and product
      create/update. `transfer` alone holds both sides until it commits;
      `editStock` lost its unused `tx`.
- [x] **`editOrder` is not Serializable (`BE`).** Its comment says "Run
      within serializable transaction" but the `$transaction` passes no
      isolation level, so it runs Read Committed under a
      `withSerializableRetry` that only a deadlock triggers.
      Closed 2026-09-28: its transaction passes `isolationLevel:
      Serializable`, and the spec asserts it.
- [x] **A variation sale decrements the parent product's quantity
      unconditionally (`BE`).** The variation's own conditional decrement is
      the real guard, but the parent's cached figure can go negative.
      Closed 2026-09-28 (the code had already closed it): a variation sale
      writes only the parent's `sold_quantity`, pinned by
      `orders.stock-counters.spec.ts`. Rows already negative are repaired by
      `prisma/manual/2026-09-27-variable-parent-negative-quantity.sql`, which
      is run by hand per database.
- [x] **`createPaymentLink` accepts an order with no customer (`BE`).** The
      ownership check in `payment-intents.service.ts` lets
      `customer_id = null` through. Closed 2026-09-25 with release 3: the
      caller must be the order's customer, and an order with none opens no
      session (a stranger could otherwise let it expire, which voids it).
- [x] **WhatsApp senders addressed by `@lid` are dropped silently (`BE`).**
      `phoneFromJid` returns null for them; newer Evolution/Baileys may carry
      the number in `key.senderPn` / `remoteJidAlt`.
      Closed 2026-09-28: `parseInboundMessage` reads a lid sender's number
      from `key.remoteJidAlt` or `key.senderPn`, only when it is an
      `@s.whatsapp.net` JID. A lid with neither is still dropped.
- [x] **`order.created` is emitted in-process after the commit (`BE`).** A
      crash between the commit and the emit loses the merchant's new-order
      notification — for every order, not only chat ones.
      Closed 2026-09-28: `createOrder` writes `orders.created_event_pending`
      inside the order's transaction and clears it after the emit
      (`announceCreated`), and `OrderAnnouncementService` (queue
      `order-announcements`, every minute) claims any order still owing it two
      minutes on and emits it once, however many instances sweep; eight racing
      sweeps on Postgres announce exactly once. Migration
      `20260928120000_order_created_event_pending` (additive, default `false`,
      so nothing on file is announced again) must be applied before an API
      built from this runs, since boot refuses a missing column.
- [x] **`ShopLocationInput.country` accepts any string (`BE`).** The vendor
      picker emits ISO-2 and older rows hold names; normalise on write.
      Closed 2026-09-28 (the code had already closed it): both writers of shop
      settings fold the country to ISO-2 (`shops/lib/shop-location.ts`). A
      value it does not recognise is kept as typed, and old rows were not
      backfilled.
- [ ] **One person, two accounts (`BE`).** A website account under a
      locally-formatted phone and a WhatsApp account under the E.164 number are
      two users, and nothing merges them.

### Inventory columns add up again: cart holds out of `committed` (2026-09-25)

Reported from the Inventory page: 21 available + 15 committed + 16
unavailable = 52 against 42 on hand. `StockReservationService` mirrored every
cart hold into `inventory_levels.committed` without taking it out of
`available`, and only its own release path took it back out — the 5-minute
hold-expiry cron (`token-cleanup.processor.ts`) and the abandoned-cart sweep
release holds inline and never did, so every expired hold stayed in
`committed` for good (10 units on that row, 8 of 93 levels affected locally).
The mirror is gone: a hold now lives only in `stock_reservations` +
`reserved_quantity`, which is what the buy guard and the allocation engine
already read, and `committed` is back to the schema's own definition:
unfulfilled orders and ready-to-ship transfers only. The nightly
`reconcile-stock-reservations` job now reports any level where
`on_hand ≠ available + committed + unavailable`. The repair SQL lowered
`committed` on the 8 local rows, and each result was cross-checked against
that row's own SALE − FULFILLMENT ledger.

- [x] **Rebuild `zaydak-api` and re-run the repair (`BE`).** The running
      image still mirrors holds, so a hold that expires before the rebuild
      leaks again. After `docker compose build api`, wait out the 30-minute
      hold TTL and re-run
      `prisma/manual/2026-09-25-inventory-committed-cart-hold-leak.sql`
      (idempotent; its second query lists anything still unbalanced).
      Closed 2026-10-04: the image has been rebuilt several times since, and a
      read-only dry run of the repair's target query on 2026-10-01 would
      change 0 rows: no level is out of balance and no hold is live. Nothing
      to re-run locally.
- [ ] **Run the same repair on every other environment after deploy
      (`INFRA`).** Same timing rule: after the release serves and 30 minutes
      have passed.
- [x] **The two inline hold releases skip `syncInStock` (`BE`).** Done
      2026-09-25: both processors and the service release through
      `src/cart/lib/release-hold.ts`, which recomputes `in_stock` with
      `PRODUCT_IN_STOCK_CASE` and claims the row before returning its units
      (the cron's batch read raced a shopper's own release into a double
      decrement).

### Analytics is on every plan (2026-09-24)

`AnalyticsResolver` carried a class-level `@RequireFeature('analytics.reports')`,
so a `BASIC` shop's analytics screen rendered zeros under a "Feature Not
Available" toast — it read as a shop with no sales. Analytics is no longer a
plan capability: the decorator and `FeatureGuard` are gone from the resolver,
the agent's 22 analytics tools require nothing and the `analytics` group is in
`UNGATED_GROUPS` (`vendor-agent/tools/tool-gate.ts`), and the key is removed
from `feature-registry.ts` so the pricing table stops selling it.
`seed:plans` retires the old `features` row.

- [ ] **Run `npm run seed:plans` on every environment (`BE`).** Until it runs
      the retired `analytics.reports` row is still `is_active` and still listed
      in the admin plan editor, enforcing nothing.
- [ ] **`ai.agent.chat` tool groups in the DB lag the registry (`BE`).** The
      local `plan_entitlements` rows give `grow` no `orders`, and `advanced`/
      `plus` no `orders`/`marketing`/`ai_content`, while `feature-registry.ts`
      grants them — the additive seed never overwrites a row. Decide between
      `seed:plans -- --force` and editing the plans in the admin console.

### Converting a draft with a picked customer always failed (2026-09-22)

Found by the backlog triage, confirmed by two independent readers. The draft
form's customer picker and its New customer drawer put a CRM **contact** id into
`DraftOrder.customer_id`; conversion passed it to `createOrder` as the on-behalf
customer; and `orders.customer_id` is a foreign key to `users`. So every
conversion with a picked customer died with P2003, the draft went back to open,
and the only workaround was removing the customer. Drafts made from an abandoned
cart converted fine, because that action sends the cart's user — which is why
nobody saw it. Every draft spec mocked `createOrder`, so nothing could.

Decision: `DraftOrder.customer_id` is a `users.id`, which is what the foreign
key, the API docs and the abandoned-cart writer already assumed. The picker and
the drawer send the contact's `user_id` (a contact with no account becomes a
guest draft that keeps its name and contact); create, and update when the value
changes, refuse an id that is not a live account already a customer of the shop
(`invalid_customer`) — without that, a merchant could put any platform user on
an order that then shows in that person's account; and `convertDraft` resolves
legacy rows before claiming the draft (a shop contact becomes its account or a
guest; anything else becomes a guest with a warning), so no data migration.

A follow-up closed the obvious bypass the same day: `createContact` /
`updateContact` accepted an explicit `user_id` unchecked, so a merchant could
link any account to a contact and then pass the draft check. An explicit
`user_id` now has to own a cart or order in the shop or match the contact's
email or phone; being linked by another contact does not count.

- [x] **Identity links on a typed email or phone are unverified (`BE` · decision).**
      Settled 2026-09-29: Dropped the contact-based identity resolution from
      `isShopCustomer` (`common/helpers/shop-customer.helper.ts`), asserting
      direct `Customer` row ownership for `shopId` (`prisma.customer.findFirst`).
      `ContactIdentityService` also resolves only through the customer's proven
      `phone_e164` number within the same shop, never unverified emails.
- [x] **Audit contact links written before 2026-09-23 (`BE` · `INFRA`).** Links
      made through the unchecked explicit `user_id` were not re-validated. One
      query: live contacts whose account has no cart or order in the contact's
      shop and matches neither its email nor its phone.
      Done 2026-10-01, read-only, on the local database (the live one).
      Contacts link through `customer_id` since phone-first; 2 live contacts
      are linked, both in their customer's own shop, and neither is without a
      cart, an order, or a matching email or phone. Nothing to unlink.
- [x] **Shop-less `createContact` (`BE`).**
      **Closed 2026-09-24.** Refuse global (`shop_id` null) contact creation
      via `assertShopScopedMutation` for non-admin callers, allowing only
      platform admins.
- [x] **`invalid_customer` is a generic toast (`VEN`).** Done 2026-09-25, as
      "say so". A draft save refused with `invalid_customer` now says the
      customer's account has been deleted, and to remove the customer or
      choose another (`draftCustomerErrorKey`,
      `draftOrders.form.customerErrorDeleted`). It used to say "Validation
      failed". From the picker, that refusal means the account behind a linked
      contact was deleted. Deleting an account does not unlink its contacts,
      so re-picking the same contact fails again, and the message steers away
      from it. The render test checks the real English sentence.
- [ ] **Keep a deleted account's contact on the draft as a guest (`VEN` ·
      decision).** The other half of the box above; the card's Remove clears
      the name and contact too.
- [x] **Abandoned carts' Create order shows `draftFailed` for the same
      refusal (`VEN`).** `abandoned-carts-row-actions.tsx` sends the cart's
      user, and a deleted one gets the generic toast.
      Closed 2026-09-28 (the code had already closed it): the row action reads
      `draftCustomerErrorKey` and says the customer's account was deleted,
      pinned by `abandoned-carts-row-actions.render.test.tsx`.

### Settling an order by hand, and what it credits (2026-09-23)

The draft payment-terms work (Vendor dashboard, box closed) put merchant-recorded
payment into `updateOrder`: Mark as paid on INVOICE orders, compare-and-set on
every payment_status write, an invoice `paid` stamp, and `merchant_direct`
settlement for CASH and INVOICE so completing an unpaid order credits nothing
withdrawable. What it surfaced but did not fix:

- [x] **Stamp the invoice on every paid transition (`BE`).**
      **Closed 2026-09-25.** One helper, `stampInvoicesPaid`
      (`orders/invoice-stamp.ts`), marks the order's invoices and its child
      orders' `paid` with `paid_at`, unstamped and not soft-deleted rows only.
      Called by `updateOrder` and cancellation (in their transactions), the
      Stripe `checkout.session.completed` webhook, `verifyPayment`, offline
      `confirmPayment` (only when its order update landed) and bank-transfer
      approval (in its transaction). `createOrder` writes a paid-at-checkout
      gateway's invoice `paid` directly. A first cut pasted the update into
      five places, three without the soft-delete filter, and one inside
      `fireOrderWebhook`.
- [x] **Stripe `payment-mismatch` has no reconcile path (`BE` · `ADM`).**
      `updateOrder` now refuses a paid write on STRIPE orders (so an open
      Checkout session cannot collect twice); a mismatch needs an admin
      reconcile or refund flow instead.
      Closed 2026-10-04: the refund flow exists since 2026-09-30.
      `refundUnappliedPayment` (`payment-intents.resolver.ts`) gives back a
      card payment the order never took and lifts `payment-mismatch` to
      `payment-refunded`. What it does not cover is tracked where it was
      found, under release 3 of in-chat checkout: orders flagged before
      2026-09-30 with no intent record, and a wrong-amount payment on an open
      order.
- [x] **COD still settles `platform` (`BE` · decision).** Settled 2026-09-29:
      Confirmed COD continues settling `platform` as documented in
      `orders/payment-gateway-policy.ts` (keeping existing vendor ledger credit
      upon order completion). Dedicated courier remittance tracking and delayed
      withdrawable balance gating will be managed under carrier integration
      milestones (P06), avoiding ad-hoc balance freezes for SME merchants.
- [x] **Real-database test for two concurrent settles (`BE`).** The unit spec
      simulates the conditional update; the concurrency suite does not run it.
      Closed 2026-09-28: `test/concurrency/order-settle.e2e-spec.ts` runs
      `updateOrder` on real Postgres: twelve tabs marking an invoice paid at
      once fire ORDER_PAID once and stamp the invoice, and twelve completing a
      sale credit the shop once, the balance moving by exactly the one
      credit's ledger rows.
- [x] **`updateOrder` audits no-op replays (`BE`).**
      **Closed 2026-09-25.** A call that moved nothing — its compare-and-set
      found the row already there, or it re-sent the current statuses and
      wrote no other field — is still logged, with `replay: true` in
      `new_values`, so the trail does not read as a second state change.

### Three leaks and a race, closed after review (2026-09-23)

Found by the agents that built this wave's features and by the adversarial
review of the whole diff, and fixed the same day. (1) A FAILED store-import
job's `error` column could hold up to 500 characters of a raw socket or DNS
message, exposed to the merchant as "the error code" — it now only ever holds a
code, and older rows are filtered on read. (2) `myAiSpenders` labelled a
negotiation guest with four raw characters of their `guest_key` — and its row
**key** carried the whole thing — which for the web channel is the
`shop_cart_session` bearer credential; both are now `visitorSubject` digests.
(3) `sendAbandonedCartReminder` returned the live signed reminder link in
`preview_body`, so a merchant clicking their own preview recorded an open. (4)
Store-import review writes (save, bulk fill, carry) read the job and wrote by
id, so a commit claimed in between left edits stored that the commit never
applied; they now write through a READY-guarded `updateMany` and refuse with
`STORE_IMPORT_INVALID_STATE`. Also: the review screen's Save names a refused
value instead of "Something went wrong", `isIncomplete` treats a cleared
category as missing, a storage row that cannot be decrypted now fails uploads
closed rather than silently using the env zone, and a post-commit attachment
cleanup can no longer throw after its transaction committed.

- [x] **The review row cannot show a stored clear (`VEN`).** A product flagged
      because its scanned category was cleared shows no "Needed to sell" caption
      on that row: `field-diff-row.tsx` computes it from the scanned value, and
      `stageField` has no way to express a clear.
      Closed 2026-09-28 (the code had already closed it): the row works out
      "Needed to sell" from what will be imported, so a stored clear shows.
      Pinned by `store-import-review-editor.cleared.render.test.tsx`.
- [ ] **Optional cleanup of old store-import error rows (`BE` · `INFRA`).** FAILED
      rows written before 2026-09-23 may still hold raw messages in `error`;
      responses filter them, a one-off UPDATE to `STORE_IMPORT_FAILED` would
      remove them.
- [x] **`integrationStatus` shows an unusable STORAGE row as `NONE` (`BE` +
      `ADM`).** Done 2026-09-25. `IntegrationSource` gained `UNUSABLE`, and
      the status entry gained a nullable `unusable_reason` (the error code).
      `resolve()` and `status()` now share one `resolveChain`, which keeps the
      enabled row's failure instead of only logging it. The state is generic,
      because any type's row can fail to decrypt or name a retired provider.
      STORAGE always reports `UNUSABLE`, since it refuses the env. Other types
      report it only when `.env` is empty too; otherwise they stay
      `ENVIRONMENT` with `unusable_reason` set, so the admin sees why the saved
      row is not the one serving. The admin banner gives a translated reason
      per code (en + ar), and for STORAGE says every upload fails until the
      row is saved again.
- [x] **No boot alert for an `UNUSABLE` row (`BE`).** `DevSinkAlertService`
      alerts on a dev sink in production but not on a STORAGE row that fails
      every upload; a remote deployment could start in that state silently.
      Closed 2026-09-28: the same boot check pages
      `UNUSABLE_INTEGRATION_IN_PRODUCTION` for a type whose enabled row cannot
      be used with nothing serving in its place, on a remote database, as an
      alert type of its own. A dead row the environment serves in place of is
      logged, not paged, and one the server does not use at all (below) is
      neither.
### React Email transactional templates (`@repo/emails`) — 2026-09-16

Platform mail (OTP, welcome, email-verification, cart-recovery, back-in-stock,
staff notification) now renders through React Email in `packages/emails`, with
Zaydak ink/teal branding aimed at Gmail. Nest's `EmailProcessor` calls the
package's `render*` helpers and sends HTML + plain text; the old Handlebars
`.hbs` files are gone. Preview with `cd packages/emails && npm run dev`
(localhost:3005). `back-end` depends via `file:../packages/emails` and builds
the package in `prebuild` / `pretest`.

- [x] **Arabic copy for OTP / welcome / email-verification** (cart-recovery is
      already EN+AR). Same bilingual-half pattern: English then Arabic under a
      hairline, bilingual subject. Auth still does not pass the user's language.
- [x] **Drop the unused `handlebars` dependency** from `back-end/package.json`.
      MailerModule no longer registers the Handlebars adapter; nothing imported it.


Focus: Marketplace payments, data model hardening, security guards, and modular domain parity.

### A rule about images could cancel an edit about words (2026-09-15)

A merchant on production opened an imported product, renamed it, set it Active
and saved. The whole save was refused — `PRODUCT_MEDIA_TRANSFER_PENDING`, toast
"Could Not Update Product" — and the rename died with the publish. Their words:
"why does it refuse to save and edit because of an image problem".

The gate was right and the plumbing around it was not. `updateProduct` is ONE
mutation carrying a whole form, so `assertPublishable` throwing took the title,
the price and the description with it. The BULK path had already answered this
correctly for years — `partitionByPublishGate` writes what it can and reports
what it held — and the single path just never borrowed the shape.

It does now. `isHeldByPublishGate` asks the same question without throwing;
`update` drops `status` from the write, saves everything else, and returns
`status_held_reason` (an error code, translated client-side like every other
refusal). The vendor form turns that into a warning — "Saved, but not published
yet" — rather than a green success, because a merchant who asked to publish and
was told nothing would find out from their storefront. Verified end to end: a
rename + publish in one save landed the rename, kept `DRAFT`, and named the
reason; the same publish went straight through once the images were terminal.

What did **not** change is the gate itself. The status stays where it was, and
the product never goes live pointing at the old store's CDN.

  - [x] **The five write paths are four in the docs, and one of them is ungated (`BE · products`)**
        Resolved by architectural decision (2026-09-15): the blocking publish gate
        was retired in `store-import/media/media-status.ts` in favor of
        `RECONCILE_IMPORT_MEDIA` (which guarantees media transfer within minutes)
        and visible foreign URL reporting. Products on foreign URLs are no longer
        locked from publishing.
  - [x] **`blocked` is computed and thrown away (`BE · products` · `VEN`)**
        Resolved by decision: `bulkUpdateStatus` now returns `blocked: []`
        permanently, and `BulkUpdateProductsResponse` needs no `blocked` field
        because products are never held from publishing on image transfers.

### A commit created the image rows and never came back for them (2026-09-15)

Every product from every store import refused to publish with
`PRODUCT_MEDIA_TRANSFER_PENDING` — "imported images are still transferring" —
and the images were never going to finish. `commitJob` wrote the products,
created the PENDING `store_import_media` rows inside its own transaction,
incremented `images_pending`, marked the job DONE, and **never enqueued
`TRANSFER_IMPORT_IMAGES`**. The processor had a `case` for it. The retry-options
helper was exported with a comment saying "the commit path and the merchant's
retry must enqueue the same job". The call was simply never written.

A handler with no caller is invisible to a type checker, to `check:di` and to
every other test in the module, and the counters moving made the screen look
right. On the machine this was found on: 762 media rows across three DONE jobs,
all PENDING, `updated_at` equal to `created_at`, `images_transferred` 0, and no
`transfer-*` key in Redis beside the `scan-*` and `commit-*` ones.

Worse than a stuck gate, it **self-heals wrongly**: after 24 hours
`REAP_STALE_IMPORT_MEDIA` marks the rows FAILED, which lifts the gate by giving
up — so the product becomes publishable with its gallery still pointing at the
old store's CDN, and nothing says so. And `needsAttention` returns FAILED and
SKIPPED only, so the PENDING rows never appeared on the merchant's
needs-attention list either: there was no self-service way out at all.

Fixed, with `store-import-commit-transfer.spec.ts` pinning it — `commitJob` had
no test of any kind, which is why this survived.

**And then fixed properly, because the one line was not enough.** A mapping of
the media lifecycle found at least six more ways to strand a row with the
enqueue in place: a SIGKILL between the DONE write and the `queue.add`; a
resumed commit whose remaining batches carry no images; a worker dying mid-walk,
where BullMQ fails a stall-exhausted job **without ever calling the handler**; a
delivery budget spent on rows the walk never reached. A 1,284-image import is
hours of wall clock in one of four concurrency slots, which no deploy window
survives.

So `RECONCILE_IMPORT_MEDIA` now runs every five minutes and queues a walk for any
import still holding non-terminal rows that have been quiet for five minutes. It
writes nothing, so it is safe to run twice, and it **removes the retained job id
before re-adding** — the queue keeps its last 100 completed jobs and BullMQ
treats any existing hash as a duplicate, so a keyed add would have been swallowed
silently and the sweep would have been a no-op in the common case. `remove`
refuses an ACTIVE job, which is the wanted behaviour: a live walk keeps its id
and nothing races it. Proven on a real database — a row stranded by hand went
PENDING to DONE in 210 seconds with nobody triggering anything.

That also repaired the reaper's meaning rather than its code. It used to fire on
rows that had never had one attempt, lifting the gate on a product whose gallery
still pointed at the old CDN — the gate's stated purpose defeated on a timer.
A row now reaches it after roughly 288 chances to be picked up, so "no progress
in 24 hours" says what it means.

  - [x] **Surface a stuck transfer to the merchant (`BE · store-import` · `VEN`)**
        **Closed 2026-09-18.** `needsAttention` now includes PENDING rows
        quiet past `RECONCILE_IMPORT_MEDIA_QUIET_MINUTES` (same cutoff the
        reconciler uses), so a stranded row surfaces with Retry beside it
        instead of waiting for the 24h reaper. Progress panel mounts the
        issues list whenever `images_failed` or `images_pending` is above
        zero and polls every 15s.
  - [x] **Say which images are still moving on the product itself (`VEN`)**
        **Closed 2026-09-18 on the import progress screen.** Each issue row
        already named `source_url` + position + product; **Drop**
        (`skipStoreImportMedia`) is now wired beside Retry for FAILED and
        stuck PENDING. Help copy no longer claims a publish lock (gate is
        retired). Product-editor badges remain a follow-up if needed.

### Review and edit a scanned catalogue before importing it (2026-09-15)

Store import approved a catalogue the merchant had never seen a row of. The new
`store/[shopSlug]/products/import/[jobId]/review` route is the screen in
between, shaped like Shopify's Translate & Adapt: a rail of scanned products
beside one product's fields, each row *what we read* against *what will be
imported*.

The scope is the operational gaps rather than translation (decision 2026-09-15),
because of what the field audit turned up: **every connector writes
`quantity: 0`** — none of them can see a warehouse — **and none writes a
category**, so until now every migrated catalogue landed unbuyable and
uncategorised. Those two are marked `blocksSale` and are what the
needs-attention filter counts; `cost_per_item_cents` is equally unscannable and
deliberately does not count, or every product sits on that list for ever.

Edits live in a new `store_import_jobs.overrides` JSON column as a sparse patch
keyed by CSV handle, **never written back onto `csv`**. A job with no overrides
hands the stored string straight to `splitCsvIntoBatches`, so the ordinary
import still runs through byte-for-byte the path the golden-rule test pins. It
works at all because of one measured property, now pinned in
`csv-round-trip.spec.ts`: `csv → groupIntoProducts → serializeDrafts → csv` is
the identity function, byte for byte, variant matrix and gallery fill-down
included.

The same spec pins the trap the screen is built around. On a product with
variants, row 1 carries the product's money cells *and* variant 1's, and
`writeVariant` gap-fills rather than overwrites — so a draft-level edit to
`variants[0].price_cents` is **silently dropped**, and a product-level edit
silently moves variant 1. A per-variant price input would have shown a merchant
the number they typed and imported the one they replaced.

`review/field-catalog.ts` is the single list of what is editable and **refuses
to load** if a key is not a canonical column, is one the serializer's row loop
owns, or is one it never writes. `status`, `slug` and `id` are named refusals:
the first outranks the commit's pinned `publishNew: false`, and the other two
are the join to the identity map and the image list.

  - [x] **Bulk fill for the two fields nothing can scan (`VEN`)**
        Shipped 2026-09-22 as `bulkFillStoreImportOverrides`. The screen sends
        its filter, not handles, and the server re-applies it with the same
        predicate the page query uses, so the count the confirm dialog names is
        the set filled. Only `quantity` and `system_category_id` are accepted (an
        explicit list checked at boot — "neverScanned" would now also match the
        Arabic and SEO rows); excluded products are skipped; existing values
        (a merchant edit, a deliberate clear, or a scanned value) are kept unless
        the merchant ticks "Replace values that are already there". The dialog
        says plainly that on a product with variants the stock lands on the
        first variant only. Writes overrides, never products.
  - [x] **Carry edits across a re-scan (`BE · store-import`)**
        Shipped 2026-09-22 as the opt-in `carryStoreImportOverrides` on the new
        job once it is READY. Joined on the source's own product id, never the
        handle; an edit whose id is missing, claimed twice, or absent from the
        new scan stays behind and is reported as unmatched. Both jobs must share
        the shop and the verbatim `source_host`; the new job's own edits win per
        field; a pruned source is `STORE_IMPORT_ARTIFACT_EXPIRED` (a code comments
        mentioned and nothing raised until now). Wrong in the plan: routing the
        carried map back through `mergeOverrides` would have re-parsed stored
        cents as major units and priced every carried product at 100x, so values
        are copied verbatim. A review then found drop-only products counted as
        carried while their drops were not; dropped photos now carry too,
        re-validated against the new scan's image list, and drops the new scan
        no longer lists are reported as `dropped_images_not_carried`.
  - [x] **Show the retention date on the screen (`VEN`)**
        Saving already pushes `artifact_expires_at` forward, so the clock runs
        from the merchant's last touch — but nothing tells them there is a clock.
  - [x] **Images are still not editable (`BE · store-import` · `VEN`)**
        Shipped 2026-09-22 as drop and restore only — adding a URL would make
        the import download something the merchant typed, and was left out on
        purpose. `dropped_images` is validated against that product's own
        scanned list (read through the serializer, so it is exactly the transfer
        list); at commit the dropped URLs leave the CSV (the next gallery photo
        becomes primary, variant references are cleared) **and** the transfer
        list, which for edited products is now taken from the re-serialized
        file. A job with no overrides still commits the stored file byte for
        byte. The vendor strip stages drops in the review draft, and its "Main"
        badge follows the same promotion rule the commit uses.
  - [x] **A dry-run preview of the merged file before approval (`BE · store-import`)**
        The merchant approves a file nobody has rendered. `importFromCsv` has a
        dry run and the commit already builds the merged CSV — the missing piece
        is running one against the other and showing the counts.
  - [x] **Offer the carry without `?from=` (`VEN`).** Done 2026-09-25. With no
        `?from=`, `StoreImportCarry` reads the shop's newest 20 jobs through
        `storeImportJobs`, which already carries `overridden_products`.
        `carryCandidate` then picks, during render, the newest earlier job that
        has the same verbatim `source_host`, a finished scan and edits left.
        Any finished status counts, not only READY and DONE: the server accepts
        them all, and a cancelled scan or a failed commit is exactly where
        edits go unused. `?from=` still wins, and then the list is not queried.
        Expiry is left to the server's `artifactExpired`, because checking it
        here would need the clock during render. A previous scan more than 20
        jobs back gets no offer.
  - [x] **Name the products whose drops did not carry (`VEN`).** The carry card
        shows a count of `dropped_images_not_carried`, not the handles.
        Closed 2026-09-28: the carry result gains
        `dropped_images_not_carried_handles` (this scan's handles, once each,
        sorted, capped at 50), and the carry card lists them as chips under
        the count.
  - [x] **The approval screen's image count is an upper bound (`VEN`).** Closed
        2026-09-25 by making the copy honest instead of computing the figure:
        "Move up to N images", in en and ar. The real count needs every
        product's `images`, `dropped_images` and `excluded`. Only
        `storeImportProducts` has them, at 200 rows a page, so on a
        5,000-product catalogue one line would cost up to 25 full-row requests.
        Even then it would not match the commit's recount. The scan counts
        distinct URLs across the catalogue, while the commit counts one media
        row per product and URL, so a photo two products share counts once
        before and twice after.
  - [x] **"Create N products" counts excluded products (`VEN`).** `willCreate`
        reads `new_products ?? products_found`, which has the same
        upper-bound problem as the image line above.
        Closed 2026-09-28: the create and update lines read "Create up to N" /
        "Update up to N" while `overridden_products` is above zero, since only
        a review edit can exclude a product. With none they stay exact.
  - [x] **Reorder or pick the primary photo (`VEN` + `BE`).** Still drop-only; a
        permutation of `images` validated against the same per-product list.
        Done 2026-10-04: a save takes `image_order`, a permutation of the
        product's scanned gallery checked like a drop; a partial list ranks
        those photos first, which is what "make main" sends. It lives in the
        overrides JSON, with no new column. The commit drops first, then
        orders what is left: the first kept photo becomes the main one, and
        the transfer list follows the rebuilt file. A photo only a variant
        uses cannot be ordered or made main. The order carries to a new scan
        onto the photos it still lists. The strip has make-main, earlier and
        later buttons, staged in the review draft and mirrored under RTL.
        `review/image-order.spec.ts`. Not walked in a browser.
  - [x] **Drag to reorder on the strip (`VEN`).** The buttons are the only way
        today, and a dropped photo has no order controls.
        Done 2026-10-07: a gallery photo that is still being imported can be
        dragged onto another, which places it just before that one and stages
        the same order the earlier and later buttons send. A dropped photo
        and a variant-only photo are not draggable.
  - [x] **A re-import that drops every photo keeps the existing ones (`BE` ·
        decision).** The importer writes `image` / `gallery` only when the file
        carries a value, so dropping everything on a product that already exists
        leaves its current photos in place. Decide whether a drop should clear.
        Done 2026-10-10: saved drops make that source product's imported media
        authoritative. Empty primary/gallery/imported-variant slots clear
        existing photos in the same product transaction; ordinary blank CSV
        cells still mean unchanged, and variants absent from the file are
        untouched. Preview remains read-only. Seven real review-fold/CSV-writer
        regressions plus preview/commit plumbing checks pass.
  - [x] **Two tabs saving review edits at once still lose one (`BE`).** Done
        2026-09-25. Override writes are now serialised on the job row.
        `writeOverrides` takes `SELECT … FOR UPDATE` in a Serializable
        transaction, retried by `withSerializableRetry` (the shape the
        bank-transfer review uses). It re-reads `overrides` under the lock and
        hands that map to the caller's merge. So two tabs saving different
        fields both land, and the same field ends last-writer-wins. The READY
        guard moved into the locked re-read. Save (dropped images included),
        bulk fill and carry all go through it. The fill and the carry re-plan
        from the locked map, and the CSV is parsed before the lock is taken.
        No API or schema change. Pinned at unit level
        (`store-import-override-race.spec.ts`).
  - [x] **Two-connection Postgres test for the override lock (`BE`).** The unit
        harness replays the interleaving; a real race belongs in
        `test/concurrency/`. Four or more simultaneous writers on one job can
        run out of the three retries and surface `P2034`.
        Closed 2026-09-28 (the code had already closed it):
        `test/concurrency/store-import-override-lock.e2e-spec.ts` runs real
        two-connection races, sixteen saves at once included. The write now
        takes a row lock under Read Committed.

### DNS diff compares a name as a set, not as rows (2026-09-14)

Found testing a real GoDaddy apex. Public DNS answered with two parking
addresses against one required address, and the engine paired them off —
"REMOVE 15.197.148.33" plus "UPDATE 3.33.130.190" — two instructions the
merchant could not carry out, because GoDaddy exposes that apex as a single
managed setting with no per-address row. Worse, which address got which verb
came from `unclaimed.shift()`, i.e. from the order a round-robin resolver
happened to answer in, so the same zone could word the instruction two ways on
consecutive checks.

The model was the bug: **a public DNS answer is a set of resolved values and is
not a promise that a registrar shows one editable row per value.** Comparison is
now per `(type, name)` as an RRset — when nothing at a name is correct, one
`UPDATE` carries every current and every required value; `currentValues` /
`requiredValues` are the truth and the old scalars are derived in `entry()` and
deprecated in place. No fifth action and no fifth bucket, so `satisfied` is
untouched and a client that has not learned a new enum member cannot silently
drop the row. No provider gating either: registrars disagree about the procedure
and agree about the end state. A **partial** match deliberately keeps the old
per-value output — a zone already holding a required value proves the merchant
writes to that name a value at a time, and grouping would strike through a live,
traffic-carrying address. Deduping the slot also fixed a spurious REMOVE for an
address answered twice, which had held `satisfied` false on correct zones; and
`aliased` is now applied in the slot loop, so a chain-derived answer at a CNAME'd
name can no longer become a confident whole-set instruction.

- [x] **The vendor's hand-written `DnsDiffEntry` should be the codegen type (`VEN`)**
      Attempted 2026-09-14 and stopped: it is not a one-file cleanup, it is a
      decision about whether `apps/vendor` adopts the codegen tag at all.
      Recorded here so the next attempt starts from what is actually true.
      **Nothing in this app uses the generated tag.** All 57 files that write a
      `gql` template import it from `@apollo/client`; zero import it from
      `@/shared/api/generated`. Codegen still extracts them — `gqlTagName` is
      matched by name, not by import — so `generated/graphql.ts` already holds
      a `ShopDnsDiffEntry` and every operation's result type. Three files under
      `features/coupons` import a generated *type* directly, so the module is
      reachable; every other caller hand-casts `data` instead. Converting
      `api/domains.ts` alone would leave one file on a convention the other 56
      do not follow, which is worse than the uniformity we have. The admin
      console is the app that does use the tag (12 files), and the root
      `CLAUDE.md` correctly claims it there and nowhere else.
      **Fragment masking is on here, and the storefront turns it off.**
      `apps/vendor/codegen.ts` leaves `presetConfig` at `gqlTagName` only, so
      the client preset emits `fragment-masking.ts` and the fragment types
      carry `' $fragmentName'`. Every operation in `api/domains.ts` spreads a
      fragment (`ShopDomainFields`, `ShopDomainConfigurationFields`), so a
      `TypedDocumentNode` hands back a `$fragmentRefs` object rather than the
      fields: `domain-detail-pane.tsx`, `domains-pane.tsx`,
      `platform-domain-pane.tsx` and `connect-domain-dialog.tsx` would each
      need `getFragmentData` before they could read anything. Either they all
      learn unmasking, or the app follows the storefront and sets
      `fragmentMasking: false` — which is a whole-app change, not a domains
      one.
      **Two shapes differ on purpose and would have to be reconciled.**
      `ShopDnsAction` generates as a string `enum`, not a union, so the 24
      `action: "ADD"` literals in `dns-diff-sections.test.tsx` and
      `domain-detail-pane.test.tsx` stop compiling — a TS enum is not
      assignable from its own string value. And `current_values` /
      `required_values` generate as required `Array<string>`, while the
      hand-written type makes them optional: that is deliberate, so the screen
      stays correct against a back-end older than itself and reads them through
      `currentOf`/`requiredOf` with the deprecated scalars as the fallback.
      Taking the generated type means every fixture grows both lists and the
      stale-server path loses its type-level reason to exist.
      **What guards the selection set today** is `api/__tests__/domains.test.ts`
      — it `print`s the configuration query and the verify mutation and asserts
      the four field names appear. That is a string check, not a compiler
      check, and it only covers the fields we thought to name; a field the
      screen reads but the fragment never asked for is still `undefined` at
      runtime behind a green build. Whatever this becomes, that test is the
      thing being replaced, and it should not be deleted until something
      actually stronger is in place.

### Money-path audit — 28 confirmed defects (2026-09-14)

An adversarial audit of withdrawals, balances, commissions, checkout pricing and
the integer-cents boundary: five readers, 34 findings, **6 refuted, 28 survived**,
13 of them high. Two were fixed in the same pass (below); the rest are filed here
because they are concurrency and money-policy changes that want a database in
front of them, and guessing at a row lock is how you find out you needed one.

**D26 (2026-09-16):** do not use this audit to finish a vendor payout product.
Ledger integrity (credit-once index, commission snapshot/tiers, quote vs charge)
may continue. `createWithdrawal` / admin approve-as-payout is frozen. See
[Deferred — Tap Commerce Platform](#deferred--outside-this-release).

**The dominant shape is unlocked read-then-write.** The repo already has the
correct pattern and does not use it in these places: `bank-transfers.service.ts`
wraps its review in `withSerializableRetry`, takes `SELECT … FOR UPDATE`,
re-reads inside the transaction and refuses a status that moved
(`:477`, `:480-481`, `:488`, `:542`). The shared helper is
`src/common/helpers/tx-retry.helper.ts`, and `orders.service.ts` and
`stock-reservation-reconciler.service.ts` use it too. So each fix below is
following a house pattern, not inventing one.

- [x] **The cart and the charge agree on SEQUENTIAL stacking (`T1` · `BE` · D30)**
      **Closed 2026-09-17.** Both paths read `Coupon.stacking_mode`. Golden
      fixtures: `coupon-stacking-parity.fixtures.ts`. PARALLEL = compat only;
      no merchant stacking editor this release.
- [x] **`verifyCheckout` and `createOrder` still diverge on wallet (`T1` · `BE · cart` · `BE · orders`)**
      **Closed 2026-09-19.** Added `use_wallet_points`, `is_full_wallet_payment`
      to `VerifyCheckoutInput`, `wallet_applied_cents` to `CheckoutVerifyEntry`,
      and integrated customer wallet balance simulation into `CheckoutService.verify`.
- [x] **Credit-once is a database guarantee on Docker-as-prod (`T3` · `BE · balance`)**
      **The application half shipped 2026-09-14; the index shipped 2026-09-17.**
      Inspect/remediate tooling (`inspect:money-launch`,
      `remediate:duplicate-credits`; D34). Docker-as-prod `zaydak` inspect
      2026-09-17 was clean (0 duplicate sale/commission credits). Partial
      unique index `balance_transactions_credit_once_order_uq` lives in
      `prisma/migrations/20260917190000_credit_once_unique_index` — one
      `sale`/`commission` row per `(shop_id, source_id)` where
      `source_type = 'order'`. Applied 2026-09-17 on loopback `zaydak` after
      a clean inspect. Hosted Neon still needs `migrate deploy`
      (same blocked console as `gross_sales_cents`).
      `updateVendorBalance` now asks, inside the `balances` row lock it already
      takes, whether this (shop, child order) already holds a `sale` or
      `commission` row, and skips the child if it does. The lock is what makes
      that race-safe rather than merely likely: a vendor completing a child and
      an admin completing the multi-shop parent are two different rows with two
      separate compare-and-sets, so neither CAS excludes the other, and the
      balance lock is the only thing they contend on.
      The review found a second path the guard cannot close, and it is fixed in
      the same change: a parent reaching COMPLETED does **not** cascade to its
      children, though CANCELLED and FAILED both do — so the expansion could
      hand back a child cancelled on its own while the parent sat in PROCESSING.
      That child holds no earlier ledger row, so credit-once sees nothing to
      block, and the shop was paid in full for goods it cancelled. `add` now
      skips a CANCELLED / FAILED / REFUNDED child; a reversal still reaches one,
      which is correct.
      The children read also gained `orderBy: { id: 'asc' }`, because
      `distributeRemainder` gives the odd cent to the LAST weight and the
      clawback only telescopes if successive calls split the same way.
      Zero-delta credits (merchant-direct at 0% commission) still write no
      ledger row and keep using `Order.commission_bps` as the marker.

### The platform charges no commission, and the screen that looks like it sets one does not (2026-09-14)

Found by an adversarial audit of the money paths and then verified by hand. Three
facts, each checkable in one grep:

1. The rate actually charged is resolved by `resolveCommissionBps` and pinned on
   `Order.commission_bps` (D32, 2026-09-17). Custom shops use
   `is_custom_commission` + `admin_commission_bps`. Tiers key on
   `gross_sales_cents`.
2. **Historically** nothing in `src/` wrote `Balance.admin_commission_bps` except
   a one-time backfill — shops sat at `@default(0)`.
3. The admin `/commissions` screen writes `Commission.commission_bps`; the money
   path now reads it when resolving an unpinned order.

- [x] **Parent multi-shop refund rejected (D31)** — `REFUND_PARENT_ORDER`.
- [x] **Multi-shop createOrder rejected (D33)** — `MULTI_SHOP_ORDER_UNSUPPORTED`.
- [~] **Commission tiers, keyed on a new `gross_sales_cents` — decided 2026-09-14; Docker-as-prod shipped 2026-09-17**
      Schema + Prisma migrate `20260917140000_...` + resolver + increment on
      credit + snapshot refunds. Docker `zaydak`: column present, starter/
      growth/scale seeded 150/100/75 bps. Inspect: 18 shops all 0 bps, none
      custom, 0 duplicate credits (D34 clean — no remediation). **Hosted Neon
      Unique credit-once index ships in
      `20260917190000_credit_once_unique_index`; hosted apply is this same
      blocked console step.
- [~] **Apply `gross_sales_cents` migration on every environment (`T0` · `BE`)**
      Docker-as-prod `zaydak` applied 2026-09-17 via `prisma migrate deploy`.
      Neon/hosted still blocked (no console this round). Apply
      `20260917190000_credit_once_unique_index` on the same pass. Local file
      leftover:
      `prisma/manual/2026-09-17-balance-gross-sales-cents.sql` (Prisma migrate
      is the approved path).
- [~] **Upgrade Redis off free tier immediately (`T0` · `INFRA` · B30)**
      Docker-as-prod `zaydak-redis` recreated 2026-09-17: `CONFIG GET`
      `maxmemory-policy=noeviction`, `maxmemory=536870912` (512.00M). This is
      a container ceiling, **not** a paid hosted plan. **Upstash was not
      touched.**
- [x] **Monotonic means refunded volume still counts (`BE · commissions`)**
      **Done 2026-09-19.** Confirmed `updateVendorBalance` increments
      `gross_sales_cents` on credit only; unit test pins deduct omits it.
- [x] **`verifyCheckout` still prices coupons with its own inline math (`T1` · `BE · cart`)**
      **Closed 2026-09-17.** Quote goes through `CouponEngine` SEQUENTIAL;
      storefront sends `coupon_codes`.

### Abandoned carts are found by activity, not by a column nothing wrote (2026-09-12)

The detector selected on `Cart.updated_at`, but adding, updating, removing or
clearing an item only ever wrote `cart_items` — the sole writer of the `carts` row
was the guest-merge soft delete. So `updated_at` never moved after creation and a
shopper still actively filling a cart on day two was told they had abandoned it.
`last_activity_at`, `abandoned_at` and `expires_at` were already in the schema,
already indexed, and read by nobody; they are now written, so this needed no
migration.

A second defect sat behind it: `getOrCreateCart` opened a **fresh empty cart** for
a returning shopper, because the sweep flips only `status`. The recovery link
therefore led to an empty cart, and no cart could ever become "recovered" for a
later step to detect. It now reclaims an abandoned cart that still holds items.

The cadence is three steps (T+1h/T+24h/T+72h, the schema comment's own numbers),
deduped by BullMQ `jobId` rather than a sent-log table, with each send re-reading
the cart and bailing if it is no longer abandoned. Per-shop rules live on the
existing `Settings` table, so still no migration. The clamp — minimum spacing,
maximum count — is what stops a merchant configuring a mail bomb. The template's
CTA was literally `<a href="#">`, so there was no way back to the cart at all.

- [ ] **Capture a guest's email so guest carts can be recovered (`T4` · `BE · cart`)**  
      `Cart` has no email column and `createOrder` is `JwtAuthGuard`, so nothing ever
      captures one. Guests stay excluded deliberately: including them today would only
      flip a returning guest's cart to `abandoned` for zero emails. Needs an `email`
      column or a checkout-draft, i.e. a migration.

### Subscription windows now close themselves (2026-09-12)

A hand-assigned subscription had no end. `PlansAdminService.assignShopPlan` writes
`ACTIVE` with a thirty-day window and no `external_ref`, so no Stripe event was ever
coming for it and nothing else re-read the row — one production shop (`osama-jawanh`)
sat four days past a window that closed on 8 September, still resolving to Grow,
with the plan screen drawing a full bar reading "Last day of this period" beside a
renewal date in the past. It could not buy its way out either: the tier buttons
routed on `!is_fallback && subscription_id`, which an admin-assigned row satisfies,
so every click went to `previewPlanChange` and came back `no_live_subscription` — a
code the vendor app did not translate, so the vendor saw only "please try again".

`myPlan` now carries `is_stripe_billed` (`Boolean(external_ref)`, mirroring the
admin type) and the checkout split routes on that. `BillingService.sweepLapsedSubscriptions`
runs hourly as `sweep-lapsed-subscriptions` on the `billing-sweep` queue, registered
by `BillingSweepScheduler` inside `PlansModule`: an admin-assigned row goes to
`SubscriptionStatus.EXPIRED` — the enum value that had existed and never been
written — with the existing `announceLapse` notification, and a Stripe-backed row
goes to `BillingService.reconcile`, which doubles as the periodic repair for a
renewal webhook that was never delivered.

- [ ] **Grace period before a hand-assigned plan is cut off (`T3` · `BE · plans`)**  
      Expiry is immediate today. Decide the window, and whether the vendor is warned
      before it rather than only at it, then apply it in the sweep and not in
      `resolve`. Pairs with *Trial lifecycle verification* (`T2-22`) below, which
      verifies grace-period handling — this item is what decides what it is.
- [ ] **Remediate shops already lapsed in production (`T2` · `BE · plans` · `INFRA`)**  
      The sweep expires them on its first run. Decide per shop whether that is the
      intent or whether the window should be extended first
      (`renewShopSubscription`), and tell the owners before the first production
      run rather than after it.

- [ ] **Media reference by `attachment_id` (`T3-7` · `BE · attachments` · `BE · platform`)**  
      Transition from raw absolute URLs to `attachment_id` references across entities to eliminate dead image URLs across environments.
      State on 2026-09-14: the model is **mixed**, not absent. `reviews.photos`
      and `ai_generation_outputs.attachment_id` already hold ids; everything
      else holds a raw URL, and `ATTACHMENT_URL_REFERENCES`
      (`src/attachments/attachment-references.ts`) is the workaround — a
      hand-maintained table of (table, column, is-json) that a rewrite walks,
      matching on the URL **value** because several of the columns are
      free-form blobs with no key path. Its own docblock lists the columns
      deliberately excluded. That list is the cost of not having ids: every new
      column holding an image has to be remembered into it.
- [~] **Customer entity first-class schema fields (`T3-11` · `BE · customers`)**  
      Promote essential customer attributes (email, first/last name, phone, locale) out of raw JSON into indexed relational columns.
      State on 2026-09-14: `Contact` has `name` and `phone_number` as real
      columns and **no `email` column at all** — email lives in `meta.email`
      and is looked up as `{ meta: { path: ['email'], equals: … } }`
      (`contacts.service.ts`), an unindexed JSONB path query on a table that
      grows with every customer. `first_order_at` / `last_order_at` and the two
      marketing-consent columns were already promoted and are indexed, so the
      pattern for doing this is established; email and locale are what is left.
      **Email done 2026-09-23.** `contacts.email` is a real column, trimmed and
      lowercased with NULL for no address, indexed non-unique on
      `(shop_id, email)` because duplicate contacts exist (migration
      `20260923120000_contact_email_column`, backfilled from `meta->>'email'`
      where it is a non-empty JSON string, verified on real Postgres). Every
      writer sets the column and `meta.email` together through
      `contacts/contact-email.ts`; the newsletter lookup, `contacts(search)`,
      the `customer_email_domain` segment filter (now case-insensitive), the
      segment export and reconciliation read the column; `ContactEntry.email`
      is exposed. Phone was already a column. Name split and locale stay open
      below as decisions, not work.
  - [ ] Run `prisma/manual/2026-09-23-contact-email-resync.sql` once per
        environment after the release has fully rolled out. Render applies the
        migration during the build while the old release still writes
        `meta.email` only; re-running the backfill would not fix a row the old
        release *changed*, which is why this resync compares every row against
        the normalised `meta.email`. Check its NOTICE for rows left for review
        (non-ASCII addresses).
  - [x] Vendor: read `ContactEntry.email` instead of `meta.email`. Done
        2026-09-25. `ContactFields` selects `email`, and `contactEmail` reads
        it for the customers list, the row menu's Copy email, the edit form's
        defaults and the draft customer picker. The column is what the server
        searches and exports on, so the list now shows the address the search
        matched, lowercased. Writes still go through `meta.email`, which the
        server copies into the column.
  - [x] Add `email` to `SegmentPreviewContact`. Done 2026-09-25: the executor
        selects the column, the resolver maps it, and the vendor's preview
        reads it for each row's secondary line and for the local search
        (`segments/lib/__tests__/helpers.test.ts`). No vendor read of
        `meta.email` is left.
  - [x] Decide where a customer locale comes from (User has no locale column)
        before adding one, and whether and how to split `Contact.name` into
        first/last (Arabic names, existing single-field data).
        Settled 2026-09-29: Customer locale is derived from `Order.locale` (or
        shop default/browser session) without adding an unindexed User column.
        `Contact.name` remains a single unified field to preserve patronymic
        and full Arabic name accuracy (matching Salla/Zid regional standard).
  - [x] Policy: per-shop email uniqueness and merging duplicate contacts; the
        index is deliberately non-unique.
        Settled 2026-09-29: Confirmed non-unique `(shop_id, email)` index policy.
        Preserves support for guest and phone-first checkouts where multiple contacts
        or family members share emails; contact reconciliation links to `Customer`
        via verified `phone_e164` rather than destructive email deduplication.
- [ ] **Staff accounts and shop memberships (`T3-10` · `BE · auth` · `BE · shops`)**  
      Implement `ShopMembership` model, invite/accept/revoke workflow, 2FA enforcement, and central `ShopAccessGuard`.
- [ ] **Campaign and broadcast runner (`T4-33` · `BE · marketing`)**  
      Build BullMQ worker for bulk marketing email campaigns with strict unsubscribe consent validation.
      Confirmed not built (2026-09-14): no marketing module, and no `Campaign`
      or `Broadcast` model in the schema. The consent columns it would have to
      respect do exist on `Contact` (`email_subscription_status`,
      `sms_subscription_status`, Shopify's enum values), and one of them is
      indexed — so the unsubscribe check has somewhere to read from.
- [ ] **Namespaced custom metafields engine (`T4-29` · `BE · products`)**  
      Support merchant-defined schema extensions and metafield values for products and collections.
      Partly there already (2026-09-14): `CategoryAttributeDefinition` /
      `CategoryAttributeOption` / `ProductAttributeValue` exist, with a DB
      CHECK (`pav_exactly_one_value`) keeping a value in exactly one typed
      column. But those are **admin-curated per category** and inherited
      extend-only. What is missing is the merchant-defined half: a shop
      declaring its own namespaced keys, and values on collections as well as
      products. The storage shape to copy is already in the schema.
- [ ] **Headless storefront content strategy (`T3-13` · `BE · content` · `DOCS`)**  
      Finalize decoupled content architecture: page drafts, scheduling, template suffixes, and publishing workflows.
      State on 2026-09-14: `src/pages/` ships CRUD over a `Page` model that is
      `{title, slug, content, image}` per shop with a `@@unique([shop_id,
      slug])` — and **no draft, no scheduling, no publish state and no template
      field**. So none of what this entry asks for exists; the page itself does.
      Publishing is the decision that has to come first, since every other part
      hangs off what a draft means.
- [ ] **URL redirect engine (`T4-30` · `BE · content`)**  
      Support automatic 301 redirect creation on slug/handle change and bulk CSV redirect mapping.
- [ ] **Prisma migration baseline adoption (`T2-10` · `BE · prisma`)**  
      Establish clean migration history baseline (`prisma migrate deploy`) to replace unrecorded manual SQL patches.
      **Cannot be done from the repo alone** (verified 2026-09-12): adoption needs
      `prisma migrate resolve --applied` against every populated database, and the
      baseline the repo can generate is *wrong* — `migrate diff --from-empty
      --to-schema` cannot express the 36 partial indexes, 11 CHECK constraints and 1
      trigger spread across the 148 manual SQL files. A faithful baseline has to be
      diffed from the real database.
- [ ] **Trial lifecycle verification (`T2-22` · `BE · plans` · `INFRA`)**  
      Perform end-to-end verification of trial expiration, grace period handling, and card charging on sandbox accounts.

---

## AI & Integrations

Focus: Production webhooks, image moderation, localized typography, and robust messaging channels.

### Instagram moves to Zernio (2026-10-14)

The Instagram channel no longer talks to Meta's Graph API. A merchant connects
their own Instagram Business or Creator account through Zernio's OAuth app
(Instagram Login, no Facebook Page), so nobody needs a Meta app, an App Review
or a Meta credential, and Zaydak stores ids only: one Zernio profile per shop
(`externalId` = shop id) and the connected account. The connect callback binds
an account only after Zernio's own listing of the shop's profile confirms it,
under a signed state. `POST /webhooks/zernio` verifies an HMAC-SHA256 over the
raw body, routes by our account mapping, claims the event id in
`processed_webhook_events` and queues; DMs and comments are answered by the
shared customer assistant (`channel: 'instagram'`), comments only when they
match the merchant's keywords, publicly, by the once-only private reply, or
both. Sends retry on 429/503/timeouts under an `Idempotency-Key` and never on
500/502. No in-chat checkout: Instagram proves no phone number. The staged
Meta-direct module, its dev-mode signature bypass and its any-active-shop
fallback were replaced. Docs: `back-end/docs/features/instagram.md`.
One Instagram account answers for one shop: binding refuses an Instagram user
another shop holds `connected` (each shop has its own Zernio profile, so the
unique account id alone did not stop it), disconnects the new connection at
Zernio and returns `reason=instagram_in_use`.

- [x] **Apply `prisma/manual/2026-10-14-instagram-zernio.sql` to the live DB, then rebuild the API image** `BE` `T1` — done 2026-10-14 with the owner's go-ahead: applied with `npm run migrate:local`, `check:drift` → Schema OK, image rebuilt (`docker compose up -d --build --no-deps api`), `/health` and `/ready` 200. The entaj account is `needs_reconnect`, the `meta_instagram` row disabled, `/webhooks/instagram` is gone (404) and `/webhooks/zernio` refuses unsigned requests (401).
- [~] **Set up Zernio** `INFRA` `T1` — API key, `ZERNIO_*` env (or the console's Integrations → Instagram row), then `npm run zernio:webhook` against the public URL. Done locally 2026-10-14 (console row saved and verified, webhook delivering 200 through the ngrok domain); still to do: the production API domain in `ZERNIO_WEBHOOK_URL` / `ZERNIO_REDIRECT_URL` and the webhook re-registered there.
- [ ] **Live test with a real Instagram Business account** `BE` `T1` — connect, DM, a Reel comment in each reply mode, reconnect, disconnect.
- [ ] **Drop the Meta-era columns** `BE` `T3` — `2026-10-14-instagram-meta-columns-drop.sql`, once nobody wants the old tokens back.
- [x] **Dashboard controls for reply mode, Instagram instructions and human takeover** `VEN` `T2` — done 2026-10-14: the reply mode selector (comments card), and `instagram-assistant-card.tsx` with the instructions field (1,000-character counter) and the human-takeover switch, staged and saved from the global save bar with a leave guard.
- [ ] **Save bar for the existing Instagram switches** `VEN` `T3` — the assistant switches, reply mode and keywords still save as they change; stage them behind the save bar like the assistant card.
- [x] **Live posts and figures on Settings → Instagram** `VEN` `T3` — done 2026-10-14: `myShopInstagramPosts` (the account's 25 latest posts, live through Zernio, cached a minute, with this shop's product links), `unmapInstagramMedia`, and `myShopInstagramStats` (30 days from the delivery ledger). The grid and the four cards show them; the sample posts, sample catalogue and fixed figures are gone.
- [ ] **Product photos in Instagram DMs** `BE` `T3` — `show_product_photo` is off on Instagram until photos are sent (Zernio `attachmentUrl`).
- [ ] **Reconcile an `UNKNOWN` send** `BE` `T3` — list the conversation's messages before retrying a 500/502, as Zernio advises, instead of leaving it unsent.

### The Telegram bot walks an order through instead of going round (2026-09-29)

A live Telegram order for one tray of eggs never reached a summary: the bot
asked how to pay, then how to deliver, then how to pay again, five times
round, with «(CASH_ON_DELIVERY)» in its replies and "Welcome to Entaj!" as
its opening line. Three causes. A delivery pick passed on a `quote_order`
call that stopped at the payment question was dropped. The model
(`openai/gpt-4o-mini`) read the steps out of the chat history, and each
question looked unanswered from where it sat. The payment keys stayed up
under the address question and were tapped again. The chat checkout now keeps
the pick on its own until a summary carries it, and
`ChatCheckoutService.progress` feeds an `[Order in progress: …]` line to the
newest message every turn. A tapped method is kept in code, and a menu pick
answered without `quote_order` is sent back once. Telegram takes the keys away
when a reply offers none, "/start" carries no language and a chat with none
is answered in Arabic, and the prompt's voice is warmer, varied and allowed to
recommend (temperature 0.5). `AI_CHAT` gained `sales_model`, so the customer
chat can run on a stronger model than the rest of the platform.

A second pass on 2026-09-30, after two chats on Gemini. In Omer's chat it listed
delivery options no tool had returned and wrote its own summary at 82.70 over
the real one. The customer's Confirm then placed nothing. Aisha's order went
through, but three adds missed under reworded product names, and she was asked
to check the name of the eggs she had just been offered.
`customer-bot.reply-truth.ts` now sends back, once, a price no source carries, a
summary in prose, "طلبك في الطريق", an add instruction answered without a cart
tool, and a reply given up after a missed add. The second time, the made-up
ones are withheld. `add_to_cart` resolves a name by its words and offers
`did_you_mean`, the order note names an open summary, and a repeated greeting
is dropped. A third chat, after the rebuild, never called `quote_order`: it read
the saved address from its prompt, then pointed at a summary and at buttons that
did not exist. That reply now goes back too, along with praise the catalogue
never wrote and offers of sold-out products. Each turn's log line names the
tools it called. On a Claude model the system prompt and the newest message
carry Anthropic cache breakpoints, and the log line reports `cachedTokens`. A chat answers "وين طلبي؟" itself (`track_my_orders`, the customer's own orders only), where it used to hand every order question to the shop and pause for three hours. The evening walk on the rebuilt API placed an order to a new Jeddah address and metered cost again (`costCents` 1.84 on a cold turn). It also showed a street kept in the chat memory read back for a code that was never looked up, and a second «صحيح» dropped as a duplicate. The memory now keeps the city alone, a code answered with no lookup goes back once, and so does a reply repeated word for word. Confirmations count as short replies.

- [x] `BE` `T2` After the rebuild on `anthropic/claude-haiku-4.5`, check that `cachedTokens` is above zero from a conversation's second message on. It was: 12,355 on a cold turn (the system prompt with the tools) and about 25,500 on a turn of two rounds, on 2026-09-30.
- [x] `ADM` `T0` Order #20260930484722 (Aisha, 2026-09-30) ships to the saved Riyadh address (RGUC8214), but she confirmed a new Jeddah one (JCWA4083) that the bot never saved. Correct the order's address once the owner confirms with her. (production-only) Closed 2026-09-30, obsolete: the order was cancelled when its transfer window ran out with no receipt (`cancel_reason: payment_expired`), and her next order, #20260930451932, went to the Jeddah address she confirmed.
- [x] `BE` `T2` A Telegram receipt photo failed with "not downloaded: The operation was aborted due to timeout" (2026-09-30 08:36), and `sendChatAction` timed out a moment later. Retry the `getFile` download once before telling the customer to resend. Done 2026-09-30: retried once, and `getFile` now runs on the 10s call clock.
- [x] `BE` `T2` `usage_events.cost_cents` is an integer, so a customer-bot turn (a fraction of a cent) is stored as 0 on every row. Store micro-cents or USD, or `/analytics` never shows this channel's cost. Not a bug: the reports read the exact `meta.cost_usd` (`plans/usage-cost.sql.ts`). It was 0 only because of the metering bug below.
- [x] `ADM` `T1` Pick the customer chat model in `/integrations` → AI chat (`sales_model`). The owner set `google/gemini-2.5-flash` for all three, with `gemini-2.5-flash-lite` suggested for `fast_model`, on 2026-09-29. (production-only)
- [ ] `BE` `T1` Rebuild `zaydak-api` and replay the egg order on Telegram (/start → بيض → طبق → share → name → payment → address → delivery, then "شو خيارات الشحن الاخرى" after the summary) to confirm it reaches a summary that Confirm places. Also: a gift (`set_recipient`, «المستلم» on the summary), a new National Address confirmed and saved before the summary, `costCents` above zero, and — after 30 quiet minutes and one more message — a `customers.chat_summary` row. And ask "وين طلبي؟": `track_my_orders` answers from the order with no hand-over, and a transfer shows its receipt state.
- [x] `BE` `T1` Every customer turn on `google/gemini-2.5-flash` logs `costCents: 0` (from 2026-09-29 20:41). Find where OpenRouter's `usage.cost` goes for Gemini (`UsageTracker.handleLLMEnd`): until then the AI quota and `/analytics` cost are blind to this channel. Fixed 2026-09-30: LangChain drops `usage` without a `system_fingerprint`, so the tracker now reads the raw response (`__includeRawResponse`).
- [x] `BE` `T2` A withheld reply is silence: Aisha's "بيض بدي طبق واحد" got no answer when the model twice claimed an add it never made. Consider one fixed, safe line in the customer's language instead. Done 2026-09-30: `WithheldReplyError` answers with `fallbackLine`, and `alreadyAnswered` answers the repeat.
- [x] `BE` `T3` Log which word `claimsCartChange` matched when it sends a reply back — the 19:13 `unbacked_change` on a delivery pick cannot be diagnosed from the log line alone. Done 2026-09-30: `cartChangeClaim`.

### Sidekick's "this week's sales" covers the week (2026-09-29)

`get_shop_stats` applied its `period` to the status counts alone. Revenue and
the order total were lifetime, new customers a fixed 30 days, and the payload
and card labelled all of it with the period; that is how "this week" read
22.70 SAR. The model was never told today's date, and
`get_custom_range_stats` turned its "inclusive" `end_date` into the midnight
that starts that day. Both tools now return a `version: 2` payload over one
window cut at the shop's local midnight: `resolvePeriodWindow` for a period,
or shop-local dates up to the midnight after `end_date` for a range. Sales,
returns, orders placed and counted, new customers and a `by_channel` split
all come from that window, and `today_sales` / `lifetime_*` are named for
their own. The prompt carries "Today: date, weekday (shop timezone)" and one
line defining a sale (the back-end definition, same date). The digest, peak
hours, forecast and segments tools filter on the sale set; the /ai briefing
and weekly cards use shop-local days; the dashboard's two stats cards render
v1 history and v2 alike. Entaj, last 7 days: 1,110.30 SAR from 14 of the 15
orders placed, 91.8% through Telegram.

- [~] **Walk one live turn after the API rebuild (`BE` + `VEN`).** Ask for
      "this week's sales" and for a date range, in the panel and on the
      Telegram vendor bot, and check the v2 cards and `by_channel` against
      the analytics page. Panel done 2026-09-29 against the rebuilt API:
      "شو مبيعات هالأسبوع؟ وكم منها من تيليجرام؟" called
      `get_shop_stats(weekly)` v2 and answered 1110.3 SAR for 23-29
      September, 1019.5 (91.8%) from Telegram, matching the analytics page.
      Still to walk: a date-range question, and the Telegram vendor bot.
- [x] **`get_profit_breakdown` prices revenue at today's list price
      (`BE`).** It sums `price_cents × quantity` over every status. Read the
      order lines of the sale set instead. The status half is done
      (2026-09-29): it and the other units-sold insight tools (trends, stock
      forecast, return rates, price and bundle suggestions, compare) now
      filter on `saleOrderWhere()`. Closed 2026-10-01, done in code (a4fdad29;
      the box was stale): `profitBreakdown` reads the lines' `subtotal_cents`
      and frozen `cost_at_purchase_cents` on the sale set, net of the settled
      refund lines `productReturnsSql` reads. Pinned by `insights.tools.spec.ts`
      and `test/concurrency/sidekick-insights.e2e-spec.ts`.
- [x] **`get_profit_breakdown` uses a rolling window (`BE`).** `since(days)`
      is now − N × 24 h while peak hours, the forecast and shop stats cut at
      the shop's local midnight. Cut it the same way (`resolvePeriodWindow`
      + `localMidnightDaysBefore`) and add a `window` to the payload.
      Done 2026-10-01: it cuts at the shop's local midnight, the last N local
      days with today included, through `lastLocalDaysWindow`
      (`tools/lib/sales-stats.ts`, the window peak hours uses). Both the order
      lines and the settled refund lines are bounded by it, and the payload
      names the dates in `window`.
- [x] **The weekly card's change percentages compare a partial day with a
      full one (`BE`).** `vendorAgentWeeklyInsights`' last 7 days include
      today so far, the prior 7 are whole days, so the chips read low every
      morning. The briefing's chips were fixed by comparing with yesterday to
      the same time; here that needs a prior total to `now − 7 days`, which
      then no longer equals the sum of the prior 7 bars the card draws beside
      it. Decide how the card should show that.
      Closed 2026-10-01: complete days only. The back-end (a4fdad29) compares
      the last 7 complete shop-local days with the 7 before, today left to the
      briefing, so the chips, the headline, the "Prior" line and the bars are
      one comparison. The card now says so: "Last 7 full days" / «آخر 7 أيام
      كاملة» with its dates, and Analyze names both weeks as dates
      (`lib/weekly-analyze-prompt.ts`), so the assistant answers through
      `get_custom_range_stats` instead of `get_shop_stats(weekly)`, which
      includes today. `schema.gql`'s stale descriptions were regenerated.
- [x] **`get_peak_hours` buckets in UTC (`BE`).** Use the shop's timezone.
      Closed 2026-10-01, done in code (a4fdad29): `localClock(timezone)` over
      the last N local days from `resolvePeriodWindow`; pinned by
      `insights.tools.spec.ts` and `sidekick-insights.e2e-spec.ts`. The
      shop's zone is `shops.timezone`, UTC when unset, and nothing sets it:
      see "No shop has a timezone" under Back-end & API.
- [x] **`get_orders`' count is capped by its limit (`BE`).** `count` is
      `orders.length` (default 10), so "how many orders this week" never
      goes past 10. Return a real count.
      Closed 2026-10-01, done in code (a4fdad29): `prisma.order.count` over
      the same `where` as the list, so `count` is every matching order and
      `shown` the capped list; pinned by `orders.tools.spec.ts`.
- [x] **`get_orders` dates are UTC and its window is 24-hour days (`BE`).**
      `day()` is `toISOString().slice(0, 10)` (also in `get_order`,
      `get_shipments`, `get_refund_requests`, `get_shop_balance`) and
      `since()` is rolling, while the prompt's "Today" is shop-local. Use
      `localDay` and the shop's midnight, as `get_peak_hours` does.
      Done 2026-10-01: the order tools date on the shop's calendar
      (`localDay`) and window on its local days (`lastLocalDaysWindow`);
      `get_orders` and `get_fulfillment_speed` add `window`, and `since()` is
      gone. An order placed at 01:30 in Riyadh no longer reads as the day
      before.
      2026-10-04: the remaining windowed insight tools follow. Counts and
      lists (`get_conversion_funnel`, `get_review_summary`,
      `get_return_rates`, `get_product_performance`, `get_price_suggestions`)
      cover the last N local days with today included; rates and comparisons
      (`get_stock_forecast`, `get_product_trends`) cover the last N whole
      local days, so a partial today does not read as a fall. Each names its
      dates in `window`, and review, cart and question dates are shop-local.
      `get_product_trends` returns `compared_window` in place of
      `compared_against`.
- [ ] **`get_daily_digest` is still a rolling 24 hours (`BE`, owner's call).**
      Decide whether "catch me up" should mean today on the shop's calendar.
      Assessed 2026-10-04, no change. "Catch me up" reads the last 24 hours
      from the moment of asking; shop-local today would cover nine hours at
      09:00 and drop last evening's orders, and would duplicate
      `get_shop_stats(today)`. Recommended: keep rolling, since "what did I
      miss" is about elapsed time, and add the window's local start and end to
      the payload (it is the only insight that does not name its window). The
      choice: rolling with the window named, shop-local today, or both as
      labelled blocks.
- [x] **`get_top_products` has no window (`BE`).** `getTopProducts` takes a
      range; the tool passes none, so it is always lifetime.
      Closed 2026-10-01, done in code (a4fdad29): optional shop-local
      `start_date` / `end_date`, parsed by the range tool's helpers, reach
      `getTopProducts` as `{ gte, lt }`; pinned by
      `get-top-products.tool.spec.ts`. The card now names its window ("All
      time", the dates, "Since …" / "Through …"), and an empty range reads
      "No sales in these days" rather than "No sales yet".
- [x] **Two revenue identities remain in Sidekick (`BE`).** Forecast, peak
      hours and segments use `total_cents` net of cancelled slices with
      refunds kept in; shop stats, the range tool, the digest, the /ai cards
      and (since 2026-09-29) yearly sales subtract settled refunds. Pick one.
      Closed 2026-10-01: one identity, the sales report's (the sale set
      through `saleMoney`, minus settled refunds dated by the refund). The
      forecast and the digest already read `getPeriodSummary` (a4fdad29);
      segments keep the customer-spend rule minus the settled refunds on
      their orders; peak hours reports order value, not sales, and says why.
      The last one off it was `get_yearly_sales`: `getYearlySales` summed
      `total_cents`, which leaves out wallet spend, and now sums
      `saleMoney(order).total_cents`, so a month equals `salesReport` and
      `get_custom_range_stats` for the same dates. That also moves the admin
      console's revenue-by-month card up by any wallet spend.
- [x] **The dashboard prompt is at its ceiling (`BE`).** 25,976 of 26,000
      characters. The next addition must cut something, or the ceiling has to
      be raised on purpose.
      Closed 2026-10-01. Stale: it measured 23,433 after the 2026-09-29 trim.
      The live form block (below, 2026-10-01) then took the worst turn to
      25,782, 218 under the ceiling, so the prompt was cut to 21,507 with the
      26,000 ceiling kept, and eight places where it contradicted the code
      were fixed: an `expected_version` argument `update_product` does not
      take; a category id passed to `update_product` (it has no such field);
      a "yes" for a differing-currency import that is refused outright; an
      inline `@Name [product:ID]` mention shape no composer sends (it is a
      `[Referenced: …]` tail); the Sellora brand; a quoted handoff reply the
      2026-09-16 cleanup missed; an example quantity with no warehouse
      lookup; chat read lines naming writes the turn may not carry. Also cut
      what a tool description or another section already says, the whole
      "Multi-step workflows" section among them. Sizes: base 21,507; typical
      form 22,073; largest snapshot 23,856; chat 6,179. Pinned in
      `vendor-agent.prompt.spec.ts`.
- [ ] **Walk one dashboard turn after the API rebuild (`BE`).** Create a
      product with a category, edit one via an @-mention, a product then a
      coupon in one message, add a product to a collection. The 2026-10-01
      prompt trim changed wording on all four paths and there is no
      automated eval.
- [x] **Shared conversation view shows the default currency (`VEN`).** The
      read-only view has no shop currency; the v2 stats cards use the
      payload's own, but the other tool cards there do not.
      Closed 2026-10-01. Since a4fdad29 the view prices every card in the
      thread's own stats currency (`conversationCurrency`), with SAR only
      when the thread holds no v2 stats result, and the platform has been
      SAR-only since 2026-09-12 (no API path writes `Shop.currency`), so no
      real share renders a wrong currency. Found on the way and fixed: the
      PIN unlock mutation did not select `parts`, so a PIN-protected share
      lost its approval and error rows.
- [x] **Shop currency on the share payload, if a non-SAR shop becomes
      possible (`BE` + `VEN`).** Add `currency` to
      `VendorAgentConversationEntry` (from `Shop.currency`, the only shop fact
      on the public payload) and read it in the shared view, with a legacy
      document for an API without the field.
      Done 2026-10-04: `VendorAgentConversationEntry` carries the shop's
      `currency`, joined by the two share reads with a one-column select and
      pinned by a key-set spec as the only shop fact on the public payload.
      The shared view prices in it, falling back to the thread's own stats
      currency and then SAR. Against an API built before the field, the lookup
      and the PIN unlock are re-sent as legacy documents, so share links work
      between the dashboard deploy and the API rebuild.
- [ ] **Delete the share view's legacy documents (`VEN`)** in
      `features/ai/lib/legacy-share-currency.ts` once the rebuilt API is live
      everywhere.

### The sixth live Telegram test: 20 eggs became 60 (2026-09-28)

A customer asked for 20 eggs. The chat put a tray of 30 in the cart without a
word, then offered "أضيفه للسلة؟" about the same eggs, took "نعم" and added a
second tray. It had listed four products the cart then refused (an imported
catalogue flagged in stock with none left), said "ما عندي صورة" for eggs with
a photo, passed over a typed "0596060606", called the cart's 45.40 the grand
total of an 85.40 order, asked how to pay twice, and asked a customer made a
minute earlier whether they had an address saved. Fixed in
`src/customer-bot/`: `in_stock` by the storefront's rule (`purchasable`) and
`get_shop_info` listing what can be bought with prices apart from
`sold_out_now`; `add_to_cart` adds to a line it already holds only with
`more` (`already_in_cart` otherwise); `show_product_photo`, with one retry
for a photo ask that looked nothing up; a note on a typed number; and the
prompt: packs against pieces, the subtotal before delivery, payment asked
once, no "تم حفظ اسمك".

The first rebuild (18:14) showed the listing working and one more hole: "اه
ضيف 5 عبوات" over a tray the website had put in two hours earlier became 6,
told as "صار عندك 6" with no word about the first one, and "ليش 6؟" was
answered with the total — `more` had listed "ضيف 13" as asking for more.
Now `more` needs "كمان"/"فوقهم"/"more", `already_in_cart` asks "5 in total,
or 5 more?" with a key for each, and the cart note names the lines from
before this conversation (the first message after half an hour's quiet).

- [ ] **Walk it live on Telegram (`BE`).** After the API image is rebuilt:
      ask for 20 eggs; ask for a photo of something in the cart and say yes
      to an offer about it; type a number instead of sharing it; ask for the
      full price; answer how to pay before the name; put something in the
      cart on the website, come back to the chat after half an hour and ask
      for 5 of it. Unit tests only so far.
- [x] **Entaj offers sandbox carriers to customers (`BE`).** Closed
      2026-09-29: `isSandboxCarrierName` in `shipping-menu.ts` filters quotes
      matching `\bpc\s*test\b|\(test\)|\bsandbox\b` from customer shipping menus
      in `ChatCheckoutService.shippingChoices`. If every quote is sandbox, it
      falls back to them so the shop can still deliver. Pinned by unit tests.
- [x] **Imported products flagged in stock with none left (`BE`).** Closed
      2026-09-29: `recomputeImportedStock` runs at the end of `commitTransfer`
      in `StoreImportService`, using `recomputeImportedInStockSql` from
      `inventory-sql.ts` to recompute `in_stock` from tracked quantity and
      variations. Pinned by unit tests.
- [x] **Remember the payment method in code (`BE`).** Closed 2026-09-29:
      `rememberPayment` and `rememberedPayment` in `ChatCheckoutService` store
      the customer's named payment method in Redis keyed by
      `chat-checkout:payment:${conversationId}` with `QUOTE_TTL_MS`. If
      `quote_order` receives an empty payment method, it restores the
      remembered gateway. Pinned by unit tests.
- [x] **Six delivery options read out in full (`BE`).** Closed 2026-09-29:
      `leadDeliveryOptions` in `shipping-menu.ts` sorts and selects the cheapest
      and fastest shipping options (or one line if identical), passing
      `more_count` so the customer is told how many other options are available,
      while preserving original choice numbers indexing the full menu. Pinned by
      unit tests.

### The merchant picks which options negotiate (2026-09-27)

The product form's negotiation card set one policy for the whole product. The
back-end already stored a policy per option, but a disabled option row fell
through to the product's, so no option could be taken out while its product
negotiated — and the product list counted option rows alone, so a product
whose options all negotiated read "Disabled". Now the product's own row is
the master switch and an option's row only narrows it; the card lists the
saved options with a switch each, saved whole by
`setNegotiationExcludedOptions`; the storefront's negotiate button sends the
option selected on the page (`page_variation_option_id`), and
`negotiate_price` offers only the options left open. Also: `negotiationPolicies`
no longer fails on a row whose option was deleted, and a test querying
`CartResponse.id` no longer stops the storefront's codegen.

- [ ] **Walk it live (`VEN` + `SF` + `BE`).** Once the API image is rebuilt
      and the apps ship: switch an option off in the product form and check
      its product page has no negotiate button for it; negotiate another
      option from its page and check the panel does not ask which; check the
      product list reads "N of M variants".
- [x] **A floor of its own per option (`VEN` + `BE`).** Options priced
      differently share one "minimum selling price", which fits none of them
      well. The back-end already honours an enabled option row's own
      settings; the card edits only the product's.
      Closed 2026-09-28: each negotiating option in the product form's card
      takes a minimum selling price of its own, saved whole by the new
      `setNegotiationOptionFloors` after the product's policy. The server
      writes each option's row as a copy of the product's settings with that
      price (floor mode widened to `advanced` so a discount or margin limit
      still binds), checks it against the option's own price, and rewrites the
      copies on every save. A row given only a discount from the variants
      table is left alone.

### The chat sells options, and keeps the delivery it was told (2026-09-27)

A review of the fifth test's fixes found the chat could not sell anything
sold in sizes or colours: `add_to_cart` sent no `variation_option_id` and the
cart refuses a VARIABLE product without one. `search_products` now lists a
product's options and `add_to_cart` takes `variation` — the label, a tapped
key or the customer's words — matched in code (`customer-bot.variations.ts`),
asking "which one?" when nothing, several or none fit. Shipping: the model
was handed fees in cents to divide by 100 while the keys under its reply were
formatted in code, a number was read as a position in a list priced again
(live carrier quotes move), and the pick was forgotten after any cart change.
Each option is now one label for the text and the key, the menu shown is kept
in Redis and the number read against it, and the newest unplaced summary's
option is reused for 30 minutes (`change_shipping` asks again). Also:
`can_still_add` only on a stock refusal, the 50 bound on the line rather
than the call, expired-but-unreaped holds counted as the cart's own, and a
schema refusal tells the model what was wrong.

- [ ] **Walk it live on Telegram (`BE`).** After the API image is rebuilt:
      buy a product with options by tapping one and by typing "احمر L"; in a
      shop with two delivery options pick one, add an item after the summary
      and check delivery is not asked again; with a carrier connected, wait
      past two minutes before picking. Unit tests only so far.
- [x] **`negotiate_price` takes an option id the model never has (`BE`).**
      Its `variation_option_id` argument cannot be filled from a chat, so a
      haggle over a product with options names none. Resolve a `variation`
      text with `pickVariation`, as `add_to_cart` does.
      Shipped 2026-09-27: `variation` in words replaces the id; with none,
      the option of the ACTIVE session on that product is kept, a single
      option is taken, and otherwise the customer is asked which
      (`choose_option`). The deal card names the option. A chat takes the
      deal with `take_negotiated_price` since 2026-09-30.
- [x] **Delivery questions before checkout (`BE`).** "كم التوصيل لجدة وكم
      يوم؟" has no tool but the FAQs. A read-only `get_delivery_options`
      over `selectShippingOptions` and the carrier quotes, with how much
      more reaches a free-shipping threshold (`min_order_cents`).
      Closed 2026-09-28: `get_delivery_options` (bound wherever the chat
      checkout is, registered or not) asks
      `ChatCheckoutService.deliveryOptions`, read-only: the cart's own fees
      through `verify` when it has items, carriers included, else the shop's
      rates for the destination, with the free-shipping threshold and how much
      more reaches it. Each option is one line built in code.

### The fifth live Telegram test: thirteen eggs and two silent turns (2026-09-27)

The reply check fired live and stopped a made-up add, and the rest of the
chat still went wrong. The customer's cart held the last 13 of 13, and
`verifyCheckout` called them out of stock: a hold recomputes `in_stock` as
"left for anybody else", which the cart holding them read too — the chat
said "غير متوفرة" and removed all 13, and the website checkout would have
refused the same cart. `verify` now adds the cart's own holds back before
believing the flag. "ضيف 13 عبوه" then met `add_to_cart`'s `max(10)`,
which LangChain enforces by throwing before the tool runs: no reply, twice.
Neither cart tool bounds its schema now (50 of one product, refused in
words), a stock refusal says how many more fit (`can_still_add`), and any
argument the schema refuses goes back to the model instead of ending the
turn. `update_cart_item` answers with the cart ("empty", never "0 ×"), the
correction note makes the tool call the next step (it had come back to the
customer as "ما قدرت أضيف"), an instruction to add is no longer asked back,
and saved addresses are read out untranslated, as the buttons show them.

- [ ] **Walk it live on Telegram (`BE`).** After the API image is rebuilt:
      fill the cart to the last units in stock and finish the order in the
      chat and on the website; ask for 13 in one message; empty the cart
      from the chat. Unit tests only so far.

### The fourth live Telegram test: a cart the chat made up (2026-09-26)

Right after an order, the cart looked like it had not been emptied: the chat
offered "2 ×" eggs, said 3, then 13 — while the website showed 12. The order
had emptied it; the eggs came from the website, and the chat misread them
twice. "Buy now" put one in the cart and checkout then signed the customer
out, because `lookupNationalAddress` (and, for bank transfer,
`shopBankAccounts`) admitted no customer session — `JwtAuthGuard` answered
"Invalid or expired token" and the storefront signs out on that; both now
carry `OptionalShopCustomerGuard`. The chat read the cart's "2 ×" as the
amount to add; the prompt now says what is there and asks. And "ضيف كمان
واحد" was answered "تم إضافة 1 × … 13 × … 280.50 ر.س" with no tool call:
a reply that claims a cart change no tool made, or a total the cart does not
have, now goes back to the model once with the cart as it stands
(`customer-bot.cart-truth.ts`), and a second false claim is withheld.

- [ ] **Walk it live on Telegram (`BE`).** After the API image is rebuilt:
      add on the website, ask the chat for the same item (it should say how
      many are already there), "ضيف كمان واحد" (the website must show the
      add), and open checkout on the website with a saved National Address
      (no sign-out). Unit tests only so far.
- [x] **A reply sent twice after a Telegram stall (`BE`).** The greeting of
      this test arrived twice: `sendTextWithRetry` retries a send that timed
      out, and Telegram had delivered the first. Documented as a chosen
      trade; decide whether a timeout (the request most likely arrived)
      should still be retried, or only a connection that never opened.
      Decided 2026-09-30: keep retrying a timed-out send. A repeated message
      costs a customer less than a lost one (the same trade as the idempotency
      box under the usage audit), and a stall is rare: about 230ms per call
      the rest of the time. `TelegramApiClient.noteSlow` now logs every call
      over 3s with its method, so a pattern that makes duplicates common is
      visible.
- [x] **Check in CI that storefront operations admit a customer (`BE` `SF`).**
      A `JwtAuthGuard` chain with no customer guard signs a customer out the
      first time the storefront calls it. A one-off sweep of the storefront's
      operations found these two; a test that reads the storefront's
      generated documents and each resolver's guards would keep it at zero.
      Closed 2026-09-28 (the code had already closed it):
      `src/customers/storefront-operations-admit-customers.spec.ts` reads
      every operation from the storefront's codegen output and each resolver's
      guards, and runs in `npm test`.

### The pay link goes straight to the card page, and ends on the order (2026-09-26)

The chat's pay link used to stop on a "Pay by card" button, and after paying
left the customer on a thank-you card. It now forwards on arrival with
`location.replace` (so "back" from Stripe leaves instead of looping; a
customer Stripe sends back unpaid, `?cancelled=1`, still gets the button),
and a paid return (`?paid=1`) shows the ordinary order screen with the
storefront checkout's "order placed" popup — `OrderDetail` in a read-only
pay-link mode, reading the order through the new `payLinkOrder(token)`
query, because the payer has usually never signed in on that browser and
signing in needs a phone code. Both order queries spread one fragment.

### The third live Telegram test: the address asked by code (2026-09-26)

A customer with an address on file was asked "وين نوصلها؟" and never shown
it — the second time a prompt step (and `get_saved_addresses`) was skipped.
`quote_order` now settles the address itself: with saved addresses and none
picked, given or saved in the last 30 minutes (`addressToConfirm`), it
answers `choose_address` with them numbered and as Telegram keys, and the
pick comes back as `address_choice`; the two address tools are gone. The
card was refused after being offered because the model passed the label, so
`quote` reads the method through `paymentMethodOf` (code, label or common
word). "RGUC8214" sent alone was read as English and the address came back
in English; a token with a digit now says no language. A picked item is
added at once, and the model's reply on a summary turn is replaced by a fixed
line — it had said "الطلب جاهز، راح يوصلك" before anything was placed.

### The whole order in the chat, with no link out of it (2026-09-26)

The second live Telegram test had every switch on and still sent a sign-in
link at "yes, let us pay": the model preferred `send_login_link` to the
checkout tools it had, asked no payment method, and never offered the address
on file. The link tool is gone from every channel (on the panel it was never
wired and promised a link that did not come), and so is every claim link a
chat sent — after an add, on request, for a transfer receipt, and when a
confirmation could not finish, which now hands the chat to the shop instead.
The prompt fixes the order: a name if missing, then the address
(`get_saved_addresses` numbers the saved ones, `use_saved_address` makes the
pick the default `quote_order` reads), then the payment method, asked even
when there is one, then the summary. `add_to_cart` shows the whole cart once
it holds more than the new line.

- [x] **Take a transfer receipt as a photo in the chat (`BE`).** A transfer's
      confirmation now carries the account, amount and reference and no link.
      **The shop cannot mark such an order paid** (checked 2026-09-27):
      `updateOrder` refuses any payment status on a `BANK_TRANSFER` order
      (`BANK_TRANSFER_REVIEW_REQUIRED`), and the only way in is a receipt the
      customer submits on the storefront's order page, signed in — which the
      chat never tells them. So a transfer ordered in the chat can never be
      confirmed from it, and the "confirmed" message it promises never comes.
      Both chats drop customer media today (Telegram ignores it, WhatsApp
      reads the caption), so download the photo, store it and submit it as the
      order's receipt (`BankTransfersService.submit`) for the merchant's review.
      Shipped for Telegram 2026-09-27: `parseMedia` →
      `telegram-customer-media` → `submitFromChat`; the owner gets a dashboard
      notification and the receipt on the vendor bot with Approve / Reject
      (`TelegramTransferReviewService`); the chat hears the outcome at once
      (`ChatTransferReviewListener`), and a rejected order takes a new receipt.
- [x] **The same receipt on WhatsApp (`BE`).** Shipped 2026-09-27, both
      ends. A photo or PDF is queued as `customer-bot-media` and, when the
      thread owes a transfer, fetched through `/chat/getBase64FromMediaMessage`
      and submitted (`CustomerBotProcessor.media`); `receiptInChat` and the
      prompt's receipt line are on for both chats. The owner gets it on the
      WhatsApp assistant number too and answers 1 / 2, with the reasons
      numbered (`VendorBotTransferReviewService`): a reply quoting a card
      answers it, a bare number only the newest card and only if sent after
      it. Found on the way: with the webhook's `base64: true` no customer
      photo had ever arrived — the body passed the 100 KB JSON limit — so
      instances now register with `base64: false`.
- [ ] **Sync the WhatsApp webhooks after the rebuild (`ADM`).** An instance
      keeps `base64: true` until its webhook is set again, and until then its
      photos are still refused before the receiver runs. Press "Sync webhooks"
      at `/integrations/whatsapp` once the API image carries this.
- [ ] **Walk the receipt live on WhatsApp (`BE` `VEN`).** Order by transfer
      in a WhatsApp chat, send the receipt photo, approve it with "1" on the
      assistant number; then send a second receipt, reply to its card with
      "2" and a reason, and check the customer reads the reason in the chat.
- [x] **A webhook over 100 KB is refused with a silent 500 (`BE`).** The
      JSON body limit refuses it before `WhatsAppWebhookController` runs, and
      nothing logs it. With `base64: false` a photo fits, but a PDF with a
      large preview may not: log the refusal, then decide on a limit for that
      route alone.
      Closed 2026-09-28: the global filter answers a body the parser refused
      with its own status (413 `PAYLOAD_TOO_LARGE`) and logs method, path,
      size and limit. The WhatsApp webhook alone reads up to 5 MB through
      `routeJsonParser`, whose function name keeps Nest's global JSON parser
      in place.
- [~] **Walk the receipt live on Telegram (`BE` `VEN`).** After the API
      image is rebuilt: order by bank transfer in the chat, send the receipt
      photo, approve it from the vendor bot (the customer gets "✅ تم تأكيد
      تحويلك"), then reject one from the dashboard with a reason and send a
      new receipt.
      Started 2026-09-27: two receipts sent from the chat reached the owner
      and were approved (orders 20260927554567 and 20260927456646) — which is
      how the duplicate notice was found. The reject-and-resend half is left.
- [x] **A payment deadline for transfer orders (`BE`).** Shipped 2026-09-27:
      `payment_expires_at` is set on every transfer order —
      `BANK_TRANSFER_PAYMENT_WINDOW_MINUTES`, 30 by default — and
      `TransferDeadlineService` runs every minute: a chat is reminded once
      with a quarter of it left, and past it the order is cancelled through
      `expireUnpaidTransfer` with its stock back, the chat told and the owner
      notified (`order.payment_expired`). A receipt waiting for the shop
      pauses it; a rejection keeps the original deadline.
- [ ] **Telegram is slow from the API container (`BE`).** Measured
      2026-09-27: a bare request to api.telegram.org took 12.3s, 3.4s, then
      failed at 10.5s; DNS was 4ms and OTO answered in under 1.2s, so it is
      the route to Telegram. It cost a receipt download (a 10s timeout) and
      sent owners the same receipt twice (a timed-out photo re-sent as a
      file — fixed: only a refusal falls back now, and uploads wait 60s).
      Find why — the Docker network's MTU, IPv6, the upstream route.
      2026-09-30: not reproduced — IPv4 only (no AAAA, IPv6 unused), 1.6s cold
      then ~230ms per call from the container, ~300ms from the host. The
      stall on record cut off a receipt body after its headers arrived.
      Every call over 3s is now logged (`Telegram <method> <outcome> after
      Nms`); read those before touching the network.
      2026-10-01: none logged since the 2026-09-30 22:53 rebuild (the image
      carries `noteSlow`); keep reading after the next live chats.
- [ ] **Read how long OTO really takes a chat quote (`BE`).** The chat now
      waits 12s for carriers where the checkout page waits 4s, and keeps a
      late answer for 2 minutes — but 12s is a guess: every quote on
      2026-09-27 timed out at 4s, so the real duration was never seen. After
      the rebuild, quote to Riyadh in a chat and read `Carriers priced shop …
      in Nms` in `docker logs zaydak-api`; if it is over 12s, the first
      summary still offers no company — raise `CHAT_CARRIER_TIMEOUT_MS` or
      start the quote as soon as the address is known.
      2026-10-01: no chat quote has run since the 2026-09-30 22:53 rebuild
      (no `Carriers priced` / `Carriers failed` line), so still unmeasured.
- [ ] **Walk the transfer deadline live (`BE`).** Set
      `BANK_TRANSFER_PAYMENT_WINDOW_MINUTES` to 4 in the API's `.env`, order by
      transfer in a chat and send nothing: the reminder arrives at a minute
      left, the cancellation after, and the product's stock is back. Then a
      receipt sent in time must hold the order past the deadline until it is
      reviewed. Put the window back afterwards.
- [x] **Remove the claim-link code now that no chat sends one (`BE` `SF`).**
      `mint`, `mintForThread` and `reusableLink` have no caller; drop them,
      `redeemCartClaim` / `claimChatThread` / `cartClaimDestination` and the
      storefront's `/claim` route once the last links have expired — keeping
      `shopperForChannel`, `registerFromChannel` and `renamePlaceholder`.
      Done 2026-09-30. The last link expired on 2026-09-26 at 10:18 UTC (15-minute
      TTL; a read-only check of `cart_claims` found none live). Removed
      `redeemCartClaim`, `claimChatThread`, `cartClaimDestination` and the
      storefront's `/claim` route. `setCustomerName` is what replaced
      `renamePlaceholder` and stays with `shopperForChannel` and
      `registerFromChannel`.

### A code Twilio Verify refused can be revealed (2026-09-26)

With Twilio on a trial, Verify refused the customer sign-in codes (21608 for
an unverified number, 60410 for the fraud-blocked +972 prefix), and since
Verify generates its own codes there was nothing on the server for the OTP
log's reveal to show. `OtpService.adoptRefusedCode` now puts a platform code
on the row when the provider answers the send with a 4xx — not after a
timeout or a 5xx, when it may still deliver — at the provider's length, and
texts nothing: a `super_admin` reveals it from the OTP log, audited, and
relays it.

- [ ] **Subscribe an SMS provider that delivers to +970 and +972 (`OPS`).**
      Until one does, every customer sign-in by phone needs a super admin to
      reveal and relay the code.

### AI search read tables that no longer exist (2026-09-25)

Every WhatsApp product search logged `Semantic search unavailable ...
relation "categories" does not exist`. `ProductIndexService.getIndex` still
read the legacy `categories` table, dropped by
`prisma/manual/2026-04-22-drop-legacy-categories.sql`, and it runs first in
`intelligentSearch` — so `aiSearch` answered empty and the storefront
catalogue and the customer assistant ranked lexically only.
`categorySearchByIds` joined the dropped `category_product` pivot the same way,
hidden by its own `catch`. The index now reads `system_categories` (only
categories a live product uses, with their translations) and the category
ranker matches `products.system_category_id`. `raw-sql-tables.spec.ts` fails
the unit suite on any raw SQL naming a table that is neither a `@@map` nor in
`tables.external`.

- [x] **`ai_request_logs` has never existed (`BE`).**
      `AgentService.logAiRequest` INSERTs into it and swallows the error, so no
      agent request has ever been logged. Create it (manual SQL plus
      `tables.external`, or a Prisma model) or delete the logger; then drop it
      from `KNOWN_MISSING` in `src/common/db/raw-sql-tables.spec.ts`.
      Closed 2026-09-28 by deleting the logger: the `agent_response` /
      `agent_error` log lines already carry the user, latency, method and
      outcome without the prompt text, and Langfuse traces the calls.
      `KNOWN_MISSING` is empty.
- [ ] **The vector ranker still needs pgvector and the Python sidecar
      locally (`INFRA`).** The stock `postgres:16-alpine` has no pgvector, so
      `product_embeddings` is absent, and no sidecar runs on :8000. The
      pipeline no longer fails on it — `intelligentSearch` drops the vector
      ranker and ranks on the other four (`Vector ranker skipped` in the log) —
      but semantic matching stays off until the pgvector image and the sidecar
      are run.

### A shopping assistant, not a command bot — release 4.1 of in-chat checkout (2026-09-25)

The first live Telegram test read like a bot executing commands. The model
promised a share button it never asked for; the first add to cart of each
chat failed on a slug lost between turns, was reported as "unavailable", and
worked on "check again"; a stranger was sent a website cart link
mid-purchase; a number on a website account with its own password was sent
to sign in; the model wrote a markdown image at example.com; and the replies
were help-desk filler. The owner's decision that followed: **the phone number
is the customer's identity, buying happens entirely in the chat, and an
external link is the exception** (online payment), never a sign-in step.
WhatsApp makes the account on the first add to cart (the number is known);
Telegram keeps the chat's cart until checkout and makes or finds the account
the moment the number is shared; a number on an old website account whose
phone nobody proved moves to the customer's own new account, and a
merchant's number takes no order (an email-code bridge for old accounts was
built and removed the same day; see the phone-first roadmap under Back-end &
API). `add_to_cart` takes the name the model showed and
returns the cart and its total; no automatic cart link while the chat can
take the order; on Telegram the share button, the payment and shipping
choices and a "Pay now" button are put there by code; a paid chat order is
told so in the chat; the prompt is a salesperson's (one next-step question,
nothing the catalogue does not say, nothing claimed that no tool confirmed)
with what is on file for a returning customer in this shop; and `cleanReply`
drops any link or image the model writes. Migration
`20260925180000_chat_paid_notice` (applied locally). See
`back-end/docs/features/customer-bot.md`.

- [ ] **Walk the new flow live on Telegram (`BE`).** First visit: browse, add,
      "finish the order", the share button, the name for the courier, the
      address, the payment buttons, Confirm; a card order's Pay now and the
      payment notice; a number on an old website account (it moves to a new
      one) and one on a merchant's (no order). Not yet done — unit tests only.
- [ ] **Walk it on WhatsApp (`BE`).** The account made on the first add, and
      a number on an old website account or a merchant's. Entaj's local
      WhatsApp session is disconnected, so it has not been tried.
- [x] **A conversation summary per customer and shop (`BE`).** The model reads
      the last 10 messages plus the snapshot of what is on file; a
      long-running conversation has no memory beyond that.
      Done 2026-09-30: `CustomerChatMemory` keeps up to 700 characters on
      `customers.chat_summary`, folded in on the fast model after a conversation
      ends and read back as notes for a customer the chat may act as. The
      migration `20260930120000_customer_chat_summary` (two nullable columns)
      was replayed from scratch and applied to the local database with the
      owner's sign-off.

### Checkout inside the Telegram chat — release 4 of in-chat checkout (2026-09-25)

A customer can now order in a shop's own Telegram chat as they can on
WhatsApp — the same summary rendered from the stored row, the same "yes" read
by rule, every payment method from releases 2 and 3. Telegram carries no
number, so the assistant asks for one with `request_phone_share`: a one-key
reply keyboard sends the customer's own contact card, accepted only when
`contact.user_id` is the sender and kept on the thread as
`direct_conversations.verified_phone_e164`. From then on the chat is read the
way a WhatsApp number is (`shopperForChannel`), `register_customer` is
offered, and a registration or a claim link minted there records
`phone_verified_via = telegram_contact`. The summary carries Confirm and
Cancel buttons (`co:<c|x>:<code>`, the code's hash on
`chat_checkouts.confirm_nonce_hash`): a press is acknowledged on arrival,
queued as `telegram-customer-press`, and acts only from the chat the summary
went to, for the account its shared number opens, while it is still the
summary awaiting an answer — a forwarded summary pressed elsewhere does
nothing. The merchant switch is `setShopTelegramCustomerBotOrders` (Settings →
Telegram, under the assistant, confirmed when turned on); turning it on
re-registers the bot's webhook for `callback_query`. Orders carry
`placed_via = telegram_assistant` and a Telegram mark in the vendor's orders.
The WhatsApp processor's answer handling moved into `ChatCheckoutReplies`,
which both chats now share. Migration `20260925170000_telegram_chat_checkout`
(replayed from scratch, applied locally). See
`back-end/docs/features/chat-checkout.md`.

- [ ] **Walk the Telegram path end to end (`BE`).** A real shop bot through
      the ngrok tunnel: switch ordering on, share the number, register, quote,
      press Confirm; a typed "نعم"; a stale button after a re-quote; a
      forwarded summary pressed from another account. Not yet done — unit
      tests and the database concurrency suite only.
- [x] **A claimed Telegram chat whose shared number opens no account
      (`BE`).** An order goes on the account the shared number opens (a
      verified one wins over the claim). When the number opens no account, a
      chat already bound by a claim link gets no checkout and is sent to the
      website: attaching a proven number to the claimed account is not built.
      Closed 2026-09-30, obsolete: a shared number now makes or finds the
      shop's customer on the turn it arrives (`registerFromChannel`, whenever
      ordering is on), and it wins over a claim. Nothing sends a chat to the
      website any more.
- [x] **Ask for everything a quote is missing at once (`BE`).**
      `quote_order` refuses with the first gap (`needs_name`, then the
      address, then the shipping choice), so the assistant asks one question a
      turn. Returning every missing field together — the backend-owned
      "missing fields" a review of the flow suggested — would let it ask once.
      Closed 2026-09-28: `quote` checks the name and the address before
      refusing and returns `missing` with every gap, and the tool tells the
      assistant to ask for both in one message.

### Card and bank transfer in the WhatsApp chat — release 3 of in-chat checkout (2026-09-25)

A chat order can now be paid by card or by bank transfer as well as on
delivery, with no payment detail ever passing through the chat. A card order is
sent a pay link, `/<shop>/pay/<token>` on the storefront: the token (128 bits,
stored as a hash on `chat_checkouts.pay_token_hash`) opens that one order's
payment through the public, throttled `openOrderPayment`, which goes through
`PaymentIntentsService` and names no provider. The session opens when the link
is sent, so an unpaid order is voided on Stripe's clock like a storefront card
order, and a session is reused only by the link that opened it. A transfer
order is sent the account the order froze, the amount and the reference, and a
claim link whose destination (`cart_claims.destination = order:<id>`, answered
by the signed-in `cartClaimDestination` only for the caller's own order) is the
order page, where the receipt is uploaded and reviewed as before. "Send it
again" is `resend_payment_details`. Stripe fixes that came with it: return URLs
go to the storefront's order page (they went to the vendor dashboard), an
expired session voids the order only when no other session is open, a payment
landing on a closed order is flagged `payment-mismatch` instead of reviving it,
the paid session's own intent is the one updated, and `createPaymentLink`
requires the order's own customer. The notification link ("view your order")
points at the storefront too.

- [x] **Tell the customer in the chat when their payment is confirmed (`BE`).**
      Shipped 2026-09-25 in release 4.1: the per-minute reconciler finds chat
      orders that became paid (however they got there) and says so once
      (`chat_checkouts.paid_message_id`).
- [ ] **Walk the card and transfer paths end to end (`BE` + `SF`).** Stripe
      test mode with webhooks forwarded (the Stripe CLI) — pay, cancel and
      come back, let a session expire, send the link again — and a transfer
      receipt uploaded from the link and approved in the dashboard. Not yet
      done; everything so far is unit and render tests.
- [x] **Refund a payment that lands on a closed order (`BE` + `VEN`).** It is
      flagged `payment-mismatch` and audited; nothing refunds it, and the
      vendor's order screen does not say why the flag is there.
      Closed 2026-10-01 on the owner's decision of that day (a merchant
      action, no automatic refund): the order screen's "Payments not applied
      to this order" card says what happened, the amount and the date, and
      refunds it behind a confirm (`refundUnappliedPayment`); the same action
      covers a duplicate charge on a paid order. It refunds exactly the
      charged amount through a provider seam (`StripeRefundGateway`), never
      twice (a claim under the order lock and an idempotency key
      `unapplied_<intent>_<seq>`, kept on the intent's JSON, no migration),
      and touches no order status, total, balance or ledger; the last stray
      payment refunded moves the flag to `payment-refunded`. The merchant's
      bell rings once when such a payment lands (`order.payment_unapplied`),
      the customer gets `order_refund`, a refunded payment is never flagged
      again, and goods refunds now go to the payment the order took (never a
      newer unpaid session, a duplicate charge or a payment that landed after
      close; with none of those left the gateway leg fails loudly instead of
      returning quietly). A session that later settles the order as paid
      clears its own flags, and a stale `refund.updated` can no longer move a
      settled goods refund backwards. The card hides itself on an API without
      `unapplied_payments`. Reviewed adversarially the same day; the four
      findings were fixed with specs that fail without them.
  - [ ] **Stripe dashboard: subscribe the webhook endpoint to
        `refund.updated` (ops).** Until then "Check again" reads a pending
        refund back.
  - [ ] **Test-mode walk with the Stripe CLI (`BE` + `VEN`):** a late payment
        on a cancelled order → refund; a duplicate charge → refund; a pending
        refund → Check again; a refund failing after success.
  - [x] **Drop the `isSchemaMismatchError` fallback in
        `OrderUnappliedPaymentsCard` (`VEN`)** once the API image serves
        `unapplied_payments`.
        Done 2026-10-04: the API serves `unapplied_payments`, so the fallback
        and its test are gone; a refused document on a flagged order is now a
        failure with a retry. The unused `CANCEL_ORDER` document went in the
        same change.
  - [ ] **Owner decision: an unattended sweep that refunds stray payments left
        unrefunded for N days** (chargeback risk).
  - [ ] **Refund a wrong-amount payment on an open order (`BE`)** without
        cancelling it first (today `ORDER_STILL_OPEN`).
        Assessed 2026-10-04, not built: unsafe as the settle stands, and the
        order lock addresses neither reason. The same session can still settle
        the order (if `editOrder` later brings the total to the charged
        amount, the next settle takes the paid branch without asking whether
        the payment was refunded), and the order would stay flagged, unpayable
        and holding its stock. It needs the central settle to refuse a session
        whose payment holds a refund, matching changes in the card resolver
        and `createPaymentLink`, and the owner's call on what the order
        becomes after such a refund: awaiting payment again, or cancelled.
  - [x] **`DisputesService` holds a disputed stray payment from the shop's
        balance (`BE`),** which never received it.
        Looked at 2026-10-04, not started. Skipping the hold on a flagged
        intent is easy, but the resolution paths (won, lost, the backfill)
        must then know whether a hold was ever applied, and the dispute row
        has no column for it. A clean fix keys the release on the dispute's
        own ledger row, which changes existing balance behaviour.
        Done 2026-10-10: completed applied intents alone create new holds;
        mismatch/duplicate flags are read under the order lock. The dispute's
        negative ledger row determines any release/forfeit, and a dispute lock
        prevents double movement across different webhook events. Terminal
        events cannot reopen or replay funds, but missing order/shop IDs can
        still be filled later. 39 dispute tests pass; no historical balances
        were rewritten and no schema migration is required.
  - [x] **`charge.refunded` reads `charge.refunds.data` (`BE`),** absent by
        default at the pinned API version: rely on `refund.updated` or expand
        it.
        Done 2026-10-04: it reads the charge's refunds back from Stripe
        (`StripeService.listRefunds`) and handles each exactly as
        `refund.updated` does. A read Stripe does not answer fails the event,
        so Stripe redelivers.
  - [x] **`listRefunds` reads one page (`BE`):** 100 refunds per charge, not
        paginated.
        Done 2026-10-05: `StripeService.listRefunds` follows `has_more` with
        `starting_after`, and stops if a page does not advance the cursor.
        `stripe.service.list-refunds.spec.ts`.
  - [x] **Storefront and chat wording for a refunded late payment (`SF` +
        `BE`)** (storefront "Refunded", bot "refunded", pay link answers
        CLOSED).
        Done 2026-10-04: `payment-refunded` (written only on a closed order,
        once every stray payment is refunded) reads the same everywhere. The
        storefront's payment line, timeline step, cancelled banner and order
        list say "Refunded" / "مستردّ" (`moneyRefunded`; `payment-reversal` is
        mapped too, the row had been keyed `payment-reversed`, which nothing
        sends). `track_my_orders` says `refunded` / `مستردّ` with a
        `payment_note` on where the money went, and guidance never to call it
        paid, owed or payable. The pay link still answers `CLOSED`, and the
        page reads `payLinkOrder` to say the payment was refunded instead of
        "may have been cancelled or expired". No schema change.
        2026-10-04: `PAYMENT_LABEL_KEY` now has a row for every status the API
        can send. `payment-processing`, cash on delivery, cash, wallet and
        `payment-mismatch` all used to read "Payment pending", the paid ones
        included; `payment-mismatch` is worded for the shopper ("Payment being
        checked by the shop"). `status.test.ts` walks the back-end's
        `PaymentStatus` enum from its source, so a new status cannot fall back
        silently.
  - [x] **The timeline's payment step on a `payment-mismatch` order (`SF`)**
        still reads "Awaiting payment or transfer review", beside a payment
        line that now says the shop is checking it.
        Done 2026-10-04, ticked 2026-10-05: the step reads
        `stepPaymentChecking` ("The shop is checking your payment"). Pinned
        in `order-timeline.render.test.tsx`.
  - [x] **`updateOrder` accepts `payment-refunded` by hand (`BE`).** On an
        open card order the pay link would not answer `CLOSED` (it keys on the
        order status), while the storefront and the chat treat the status as
        terminal.
        Decision 2026-10-05: a vendor cannot set it (`PAYMENT_REFUNDED_BY_HAND`);
        an admin still can, for a refund made outside the app. The pay link
        answers `CLOSED` / `refunded` for that status even while the order is
        open, and opens no session. Pinned in `orders.service.spec.ts` and
        `payment-intents.service.spec.ts`.
  - [x] **A `closed_reason` on the pay link's answer (`BE` + `SF`).**
        Done 2026-10-05: nullable `closed_reason` on `OrderPaymentOpeningEntry`
        (`gone`, `refunded`, `cancelled`, `expired`, `unavailable`). When it
        is present the pay page does not call `payLinkOrder`; `refunded` is
        the refunded card and any other reason is the plain closed card. An
        answer that still omits it keeps the second read.
  - [x] **`updateOrder` can still overwrite `payment-mismatch` by hand (`BE`)**
        without a refund.
        Done 2026-10-04: a merchant changing `payment_status` on a
        `payment-mismatch` order is refused (`PAYMENT_MISMATCH_UNRESOLVED`)
        and nothing is written. Only the refund, a settling session or an
        admin lifts the flag. Order-status moves still work.
  - [x] **Concurrency e2e (`BE`):** a refund claim racing a re-settle under
        the order lock (`test/concurrency/card-payment.e2e-spec.ts`).
        Done 2026-10-04 and run twice on the scratch test database:
        `card-payment.e2e-spec.ts` races a refund claim against a re-settle
        with each lock order forced once and 16 randomized rounds. Every round
        ends with one provider refund under one key, the order
        `payment-refunded` and still cancelled, stock untouched.
  - [x] **`updateRefundStatus` may allow APPROVED to REJECTED as a bare status
        flip (`BE`),** with no money reversal, which would also reopen the
        refund ceiling. Seen while reading, not tested: confirm or refute.
        Refuted 2026-10-04, ticked 2026-10-05: `REFUND_STATUS_TRANSITIONS`
        leaves `approved` with no onward status. The move is
        `invalid_transition`, nothing is written, and the same holds for an
        admin. Pinned in `refunds.service.spec.ts` ("status transitions").
  - [x] **A refund that fails after succeeding restores the flag but rings no
        bell (`BE`).**
        Done 2026-10-04: the succeeded-to-failed transition emits
        `payment.unapplied_refund_failed` once; the shop owner gets a bell
        with the amount and every admin a row.
  - [x] **"Mark as cancelled" fails for a vendor (`VEN` + `BE`).** The status
        menu calls `cancelOrder`, whose owner filter scopes every non-admin
        caller to their own customer id, so a merchant's cancel is refused.
        Cancelling through `updateOrder` was tried on 2026-10-01 and reverted:
        one click with no confirmation cancels a paid card order, nothing
        refunds the card, `createRefund` then refuses the cancelled order, and
        `updateOrder`'s cancellation branch emits no `order.cancelled` (no
        customer email, no bell, no `ORDER_CANCELLED` webhook). The safe fix:
        refuse a vendor cancel of a paid card order server-side (refund
        first), a confirm dialog, and `order.cancelled` + `ORDER_CANCELLED`
        from `updateOrder`'s cancellation branch. Until then the unapplied
        payments card's "Cancel the order first" hint points at an action that
        fails for a merchant.
        Done 2026-10-04: the status menu's cancel goes through `updateOrder`
        behind a confirm dialog. Under the order lock, a merchant's cancel of
        a card order whose payment it took is refused
        (`REFUND_CARD_PAYMENT_FIRST`: refund it instead), and the dialog says
        the same with its confirm disabled. An order whose only card money was
        a wrong amount still cancels, which is what the unapplied payments
        card's hint points at. `updateOrder`'s cancellation emits
        `order.cancelled` and `ORDER_CANCELLED` once. An admin is deliberately
        not refused.
  - [x] **An admin cancelling a paid card order is not refused (`BE`).**
        Deliberate for now, through `cancelOrder` and `updateOrder` alike.
        Decide whether to refuse or warn.
        Done 2026-10-10: both manual entry points now refuse an accepted card
        payment under the order lock, including admin/super_admin callers,
        with `REFUND_CARD_PAYMENT_FIRST`. The goods-refund path is the way
        to return it. Unapplied payments retain their separate cancellation
        behavior. The complete orders service suite passes (350 tests).
  - [x] **`charge_already_refunded` is recorded `succeeded` (`BE`).** On an
        unapplied payment whose charge a goods refund consumed, it should be
        "needs review": not `succeeded`, and `payment-mismatch` not released,
        because the stray money may still be owed.
        Done 2026-10-04: it is recorded `failed` with `error_code:
        charge_already_refunded` (there is no needs-review status; the record
        is JSON), `payment-mismatch` stays, and `payment.unapplied_refunded`
        is not emitted. One exception avoids a false alarm: when the provider
        says this action's own refund, under an earlier key, consumed the
        charge (`findRefundOf`), that refund is recorded.
  - [ ] **A needs-review unapplied payment has no way out for a merchant (`BE`
        + `VEN`, owner's call).** `charge_already_refunded` keeps
        `payment-mismatch`, and only an admin can clear the flag now. Decide
        who may mark it resolved.
  - [ ] **`payment-mismatch` orders flagged before 2026-09-30 carry no intent
        record (`BE` + `VEN`),** so the card shows nothing and they cannot be
        refunded in-app. A backfill, or a by-hand refund path.
  - [~] **An idempotent re-approve never recomputes the wallet split (`BE`,
        pre-existing).** `cardRefundCents` defaults to the refund's full
        amount and the no-op path still reaches `settleGatewayRefund`, so a
        retry after Stripe's 24 h idempotency window over-refunds the wallet
        share to the card. Persist the card share on the refund row.
        Over-refund closed 2026-10-04: a retry no longer sends the whole
        amount to the card. The no-op path passes no amount, and a
        wallet-split order with no refund at Stripe is refused with nothing
        sent. That also closes a case this box did not name: a fully
        wallet-funded refund re-approved from two tabs used to create a card
        refund for the full amount. Left, and it needs a migration: a
        wallet-split order whose gateway leg never produced a refund cannot be
        retried in-app, because the card share is computed under the order
        lock at approval and stored nowhere. A column on `refunds` for it.
  - [x] **Goods-refund status races (`BE`).** `handleChargeRefunded` still
        writes the status unconditionally; a `pending` answer in
        `settleGatewayRefund` can overwrite a `succeeded` a concurrent webhook
        just wrote; and a `succeeded` delivered after `failed` moves the row
        forward. Out-of-order events need a read-back (`retrieveRefund`).
        Done 2026-10-04: every write of a goods refund's gateway status is a
        forward-only compare-and-set (`refunds/gateway-refund-status.ts`)
        shared by the approval and the webhook. A `succeeded` delivered after
        a failure is read back with `retrieveRefund`, and a failed gateway
        call no longer writes `failed` over a refund Stripe already holds.
  - [x] **Re-approving a goods refund that already holds a `gateway_refund_id`
        (`BE`)** should read it back instead of calling `createRefund` again;
        past Stripe's 24 h idempotency window that is a second refund.
        Done 2026-10-04: a re-approval only reads a held refund back
        (`retrieveRefund`) and records it forward-only; with none held it
        first asks Stripe for a refund carrying this row's key and adopts one
        whose answer was lost; it creates one only on an order with no wallet
        credit. A read Stripe does not answer sends and writes nothing.
- [x] **No "pay again" on the storefront's order page (`SF`).** A card
      checkout cancelled on Stripe now returns to the order page (it used to
      land on the vendor dashboard), which offers no way to retry.
      Closed 2026-09-28: the order page offers "Pay by card" for an unpaid,
      open card order. `createPaymentLink` refuses a closed order
      (`ORDER_CLOSED`) or a flagged one, and asks the order's recent Stripe
      sessions first: a paid one is settled and refused, a settling one is
      refused (`PAYMENT_PROCESSING`), and an open one is handed back. A
      customer back before the webhook is never charged twice.
- [x] **`order-payment.render.test.tsx` fails under load (`SF`).** "goes
      straight on to the provider, replacing this page" failed once when the
      three apps' suites ran together (`turbo run test`, as CI does) and
      passes alone every time: a timing assertion that CI can trip.
      Closed 2026-09-28: the redirect is an effect, and the test now waits for
      it (`waitFor`) instead of asserting it the moment the title appears.

### Checkout inside the WhatsApp chat — release 2 of in-chat checkout (2026-09-25)

A customer can now order in the shop's WhatsApp chat, cash on delivery. The
model's `quote_order` prices the cart through the storefront's own `verify` and
freezes it as a `chat_checkouts` row; the summary is rendered from that row by
code and sent as the turn's last message; the customer's "نعم" is read by rule
in the processor before any model runs (`confirmation.ts`), and only then is
`createOrder` called — with the row's id written to the UNIQUE
`orders.chat_checkout_id` and the confirmed totals checked inside the order
transaction (`CHECKOUT_EXPECTATION_FAILED`). A summary is confirmable only while
it is the newest thing the shop said and after the send worker stamped
`direct_messages.sent_at`; a partial unique index keeps one open summary per
thread; a per-minute reconciler repairs a placement a crash interrupted and
sends a confirmation that never went out. Three switches: `CHAT_CHECKOUT_DISABLED`,
the `ai.agent.checkout` capability (off on every plan) and the merchant's
`ai_orders_enabled` (vendor Settings → WhatsApp, confirmed when turned on). The
address form now follows the shop's country and zones — National Address where
a Saudi address is plausible, `save_manual_address` everywhere — and both save
in the storefront's keys. Chat orders carry `placed_via` (a mark in the vendor's
orders list and detail) and skip the platform's WhatsApp/SMS confirmation. See
`back-end/docs/features/chat-checkout.md`.

- [ ] **Turn it on for a pilot shop (prod).** Run `npm run seed:plans` on
      production (the `ai.agent.checkout` rows do not exist until then), add a
      `subscription_overrides` row for the pilot shop, and have the merchant
      switch it on under Settings → WhatsApp.
- [ ] **Walk the plan's manual checklist on the local stack (`BE`).** Happy
      path from a second number against Evolution; a "yes" after a side
      question and after a merchant reply (no order); the kill switch; the 30
      minute expiry; a cart edited on the website after the summary; a
      Palestinian shop with a manual address and an unserved destination. Not
      yet done — everything so far is unit, render and database-level tests.
- [x] **End-to-end chat checkout test on a seeded database (`BE`).** The
      concurrency suite pins the database guarantees in SQL; nothing yet runs
      `confirm` through a real `createOrder`: a commit followed by a crash
      settled by the reconciler without a second order, a replayed confirm,
      an expired negotiated offer refused with `CHECKOUT_EXPECTATION_FAILED`,
      another shop's cart refused.
      Closed 2026-09-28: `test/concurrency/chat-checkout-confirm.e2e-spec.ts`
      runs `quote` and `confirm` through the real cart, `verify` and
      `createOrder` on a migrated database: one order at the summary's price
      and a replayed "yes" admitting nothing; a placement whose answer was
      lost after the commit settled by `reconcile` with no second order; an
      offer that runs out between the re-price and the order refused inside
      the transaction (`CHECKOUT_EXPECTATION_FAILED`); a summary naming
      another shop's cart superseded. Writing it found that `createOrder`
      never checked whose cart `cart_id` was, so any caller could empty
      another customer's cart or price with their bargains; it is now refused
      (`cart_not_yours`), pinned there too.
- [x] **Deliver to somebody else (`BE`).** The order's recipient phone is
      always the sender's number and the name is the account's; a customer
      ordering a gift has no way to name a recipient in the chat.
      Done 2026-09-30: `set_recipient` takes the recipient's name and number. They
      are frozen into the summary's address with `ordered_by`, and the summary
      and the confirmation say «المستلم». The order stays the customer's, and
      `customer_contact` is still their number.
- [x] **Money in the chat is `95.00 SAR` (`BE`).** The summary and the
      confirmation format cents by hand; the storefront's formatter (locale
      digits, symbol placement) is not shared with the back-end.
      Closed 2026-09-30 (the code had already closed it): the summary, the
      placed and paid messages print money with `displayMoney`, which is the
      storefront's `Intl` format (‏22.70 ر.س. in Arabic).

### Chat registration made safe — release 1 of in-chat checkout (2026-09-25)

The WhatsApp assistant's `register_customer` took a phone number and an email
typed into the conversation, looked accounts up by them, and bound the thread,
the guest cart and the next saved address to whatever it found — a stranger's
account for the price of typing their details — creating accounts with
`permissions: ['customer']` and no audit row. It now takes a name and an
optional email and never a phone: `CartClaimService.registerFromChannel`
registers the number the message came from, never matches by email, never
changes an existing account's email, and is offered on WhatsApp only.
`users.phone_verified_at` / `phone_verified_via` (migration
`20260925140000_user_phone_verification`, backfilled from verified SMS login
codes only) separate recognising a sender from trusting them: an account
matched by a number nobody proved is greeted and not written to, a claim link
answers `SIGN_IN_REQUIRED` for one made elsewhere, and an SMS login, a claim
link or a chat registration proves the number. Claim links are sent whole (a
short link's public lookup would have published the token; the call never
worked anyway). Chat carts are handed over by `CartSyncService.adoptGuestCart`,
which keeps the account's own cart and negotiated prices. A bare "نعم" is no
longer dropped as a repeated question.

- [ ] **Run the old tool's audit report (prod).**
      `prisma/manual/2026-09-25-register-customer-audit.sql` lists accounts
      carrying `'customer'` as a permission, WhatsApp threads bound to another
      number's account, and carts with both an owner and a session; the repairs
      are commented out for review.
- [x] **Release 2 — checkout inside the WhatsApp chat, cash on delivery
      (`BE` + `VEN`).** Shipped 2026-09-25 — see the entry above. A `chat_checkouts` record per quote, confirmation as a
      deterministic step outside the model, exactly one order per quote
      (`orders.chat_checkout_id @unique` written inside `createOrder`'s
      transaction, plus an in-transaction price expectation), a merchant switch
      under an `ai.agent.checkout` capability and a `CHAT_CHECKOUT_DISABLED`
      kill switch, a destination-based address (National Address or manual),
      `placed_via` on the order, and concurrency tests on a real database.
      Settle the visitor limits below before switching it on for real shops.
- [x] **Release 3 — bank transfer and card in the chat (`BE` + `SF`).**
      Shipped 2026-09-25 — see the entry above release 2's. IBAN
      message from the frozen instructions, a server-stored redirect on the
      claim link for the receipt upload, a card link through
      `PaymentIntentsService` only (no provider SDK in the chat code), and the
      Stripe return-URL and expiry fixes.
- [x] **Release 4 — Telegram (`BE` + `VEN`).** Shipped 2026-09-25 — see the
      entry above release 3's. Prove the number from a shared contact card
      (`contact.user_id` equal to the sender), a confirm button bound to the
      quote, and the Telegram orders switch.
- [x] **Release 5 — polish (`BE` + `VEN`).** Accept a new negotiated offer in
      the chat, link an inbox thread to its order, chat-order analytics, a
      source filter on orders.
      Closed 2026-09-30, all four. A chat takes a negotiated price itself:
      `take_negotiated_price` mints the offer for the conversation's newest
      open session with an allowed price and adds it to the shared cart,
      with no session id or price from the model. The merchant's inbox
      thread lists the orders it placed (`shopWhatsAppThread.orders`,
      `ThreadOrders`), each linked to its page. Chat-order analytics are
      the sales-by-channel split on the analytics page, and the orders list
      filters by channel (`FilterOrdersInput.channel`), both already in the
      code.
- [x] **`send_login_link` does nothing on the storefront panel (`BE` + `SF`).**
      The panel never reads `loginLinkWanted`; the prompt no longer offers the
      link there, but the tool is still bound.
      Closed 2026-09-28 (the code had already closed it): the tool was removed
      on 2026-09-26, and no chat tool by that name is bound.

### Twilio Verify for one-time codes (2026-09-25)

The Twilio SMS row takes an optional **Verify Service SID** (`VA…`); with it,
sign-in, password-reset and SMS-only signup codes are generated, texted and
checked by Twilio and never exist on this server. `From` became optional and
keeps serving every other text (cart reminders, notifications, magic links).
`OtpService.sendBySms` owns the whole SMS send; a Verify row is stamped
`otps.verifier = 'twilio'` with no hash, and `verify()` asks Twilio. Cooldown,
daily cap, attempts and lockout stay ours. The adapter now talks REST over
`fetch` — the old lazy `import('twilio')` named a package that was never a
dependency, so every send through an enabled Twilio row had been failing.
Migration `20260925120000_otp_verifier` (applied locally; Render's build runs
`prisma migrate deploy`, so production gets it on the next deploy).

Same day: the Twilio check now refuses a From that is not a number the account
bought (the live row held a personal mobile, and the first real OTP failed with
21266 "'To' and 'From' number cannot be the same") and a Verify service whose
codes are not six digits; Send test on a row with both halves sends both;
`OtpLogEntry.verifier` shows the issuer in the admin log and hides Reveal; the
signup wizard takes its box count from the provider. **Taqnyat** and **Msegat**
shipped as plain-gateway SMS providers (mocked tests only).

- [x] **Apply `20260925120000_otp_verifier` in production.** Nothing to do by
      hand: the Render build runs `npm run db:deploy`.
- [x] **Msegat and Taqnyat SMS providers (`BE`).**
- [x] **Check the Verify service's code length (`BE`).**
- [x] **Show the issuer in the admin OTP log (`BE` + admin).**
- [x] **Test the From half of a Twilio row carrying both (`BE`).**
- [ ] **Finish the local Twilio row (console, prod).** Create a Verify service
      in the Twilio console, paste its `VA…` SID into Integrations > SMS, and
      clear From (it holds a personal mobile). On a trial, the destination
      must be a verified number and its country enabled in geo permissions.
- [ ] **Live-test Taqnyat and Msegat (prod).** Both are built from their
      published docs and tested against mocked replies only; Msegat's reply
      shape in particular differs between its docs and clients in the wild.
      Msegat's OTP half (`otp_api`, off by default) needs the same before it
      is switched on: the reply to a wrong code (mapped to `rejected` from
      `404 - Code not found` by inference — if it is really `400`, every typo
      expires the code), the real code length (set `otp_code_length` to what
      Send test delivers), whether `lang` belongs in the header or the body
      (both are sent), and Msegat's own expiry and attempt limit against
      ours. Also: a free Msegat account answers `1064` to any text but "Pin
      Code is: xxxx" / "Verification Code: xxxx" / "رمز التحقق: 1234", so the
      plain-gateway OTP text ("Your verification code is: <code>") and Send
      test's fixed text both fail there until the account is upgraded or the
      wording changes. And check that verifying Msegat id X with the code
      issued for id Y is refused: nothing on our side binds a code to its id
      beyond storing the pair. Then replace the inferred verify mapping (an
      unreadable 2xx counted as a wrong code since 2026-10-01, so a guess is
      never free; a 400/404 a verdict only with Msegat's own code or wording)
      with the replies observed.
  - [x] **A Msegat row whose process died before its send settled reads
        "still being sent" (503) until it expires (`BE`).** Treat a
        reference-less row older than the send timeout plus a margin as
        expired in `checkWithProvider`. (A failed reference write already
        records the delivery as failed since 2026-10-01.)
        Done 2026-10-01: a row with no reference and no send outcome answers
        503 only until its verifier's `startTimeoutMs` (Msegat: its 10s
        request timeout) plus a 50s margin. After that `checkWithProvider`
        logs it and reads it as expired, so `verify` answers `OTP_EXPIRED`
        with no attempt charged and a resend recovers.
- [x] **Sign-in screens hardcode six digits (vendor + admin + storefront).**
      `CODE_LENGTH = 6` / `maxLength={6}` ignore the OTP `code_length`
      setting, so shortening codes breaks phone and email sign-in. Read the
      length, then relax the Verify six-digit check to the 4–8 the API takes.
      Closed 2026-09-28 (the code had already closed it): every code input
      takes its length from the server's `code_length` (admin, vendor,
      storefront), and Twilio Verify accepts 4 to 8 digits.
- [x] **Msegat's own OTP API as an `otp` half (`BE`).** `sendOTPCode` returns
      an `id` that `verifyOTPCode` needs, so the row would have to store a
      provider reference beside `verifier`.
      Closed 2026-10-01: an opt-in `otp` half on the Msegat adapter
      (`MsegatOtp`), off unless a row sets `otp_api` with an `otp_code_length`
      of 4–8 (`otp_lang` Ar/En; env: `MSEGAT_OTP_CODE_LENGTH`,
      `MSEGAT_OTP_LANG`). No migration: Msegat's id is stored in the existing
      `otps.verifier` as `msegat:<id>` (`encodeVerifier` / `parseVerifier`),
      written with `delivered_at` once the send answers; the admin log and
      reveal read the slug alone. A verify before the send answers is a 503
      with no attempt; a send that settled without an id reads as expired.
      `MsegatApiError.refused` lets a 200-with-refusal-code take the platform
      code like a Twilio 4xx. Built from the Apiary blueprint and tested
      against mocked replies only; Twilio Verify and plain-gateway paths
      unchanged.

### Customer assistant per-visitor limits switched off (2026-09-24)

`CUSTOMER_BOT_LIMITS_DISABLED=1` (`customer-bot.visitor-limits.ts`) turns off
the hourly throttle, the per-visitor daily/monthly caps, the unproductive mute
and the panel's per-origin ceiling. It was set in the local `.env.development`
because `entaj`'s Telegram visitors went silent after ~10 answers a day (the
`share` chip). Burst, `no_signal`, `repeat`, the plan allowance and the
platform budget stay on.

- [ ] **Switch the limits back on (`BE`).** Remove the line from
      `back-end/.env.development` and recreate the API container. Before that,
      decide whether the BASIC daily cap (~10 answers per visitor) is too low for
      a real buyer — raising `VISITOR_MONTHLY_FLOOR` or setting
      `perVisitorMonthly` per shop are the two levers.

Closeout of the 2026-09-17 decisions pass: [docs/AI-INTEGRATIONS-CLOSEOUT.md](docs/AI-INTEGRATIONS-CLOSEOUT.md).

### One visitor can no longer eat a merchant's month (2026-09-21)

The customer bot answers anyone, and every answer is exactly **one `request`**
off the shop's `ai.agent.customer` allowance whatever the customer typed. So a
merchant's exposure was never the price of a message, it was volume — and
nothing bounded one person. `CustomerBotThrottle` caps a phone number at thirty
an hour, which is 720 a day: a whole BASIC allowance from one number inside a
week. The panel was looser still, keyed per IP at 20/min with a per-caller
bucket hung on a cart-session cookie the caller mints and can discard.

Phase 1 shipped: `CustomerBotVisitorGate`, one provider behind all three
transports (WhatsApp, Telegram, storefront panel), sitting **before** the
entitlement reservation so a refusal costs no quota, no platform budget and no
model call. Three free checks first (no letter or digit; one character held
down; the same question more than twice in fifteen minutes), then a day and a
month keyed on shop + visitor, then a per-origin hourly backstop on the panel
only — the phone channels' "origin" is Evolution's or Telegram's server, which
would be one bucket for the whole platform. Numbers derive from the shop's own
`limit_value` (5%, floor 30, cap 150; a day gets a third) so a bigger plan
tolerates a chattier customer with no constant to edit, with
`config.perVisitorMonthly` as the per-shop override through
`subscription_overrides` — no migration anywhere. Fails open, because two
Postgres floors stand behind it. Refusals are silent on the phone channels and
`TOO_MANY_REQUESTS` + `retry_after_seconds` on the panel, matching what each
surface already does. `customer-bot.processor.spec.ts` is new — the WhatsApp
processor had no spec at all, and it is the path the exposure runs through.

- [x] Phase 2 — visibility: "who is spending my quota". Shipped as `myAiSpenders`
      on `PlansResolver` + `AiSpendersCard` on `/plan/[shopSlug]/usage`, not as
      chips on the inbox: the inbox cannot aggregate a visitor who used three
      channels, cannot show negotiation spend at all, and its documents escape
      codegen entirely. No migration. **Three of this entry's own premises were
      wrong and are corrected below.**
- [x] Corrected — the figure is `SUM(quantity)`, **not** `COUNT(*)`. `release`
      writes a real row at quantity 0 carrying the same attribution as the
      commit it refunds, so counting rows ranks a visitor whose every turn
      failed as the biggest spender.
- [x] Corrected — signed-out panel spend was **never** "structurally
      unattributable". `sessionId` was already in scope at the panel's
      `reserve` and simply not passed to the existing nullable `ref_id`. One
      line, no migration; on seeded data it was 29% of that channel's turns.
- [x] Corrected — there are **four** writers on the meter, not three.
      `NegotiationQuota` spends the same capability with `ref_type:
      'negotiation_turn'` and a `ref_id` that is a `NegotiationSession`, so a
      `GROUP BY ref_id` without pinning `ref_type` renders negotiation sessions
      as though they were chat threads. Verified against live rows.
- [x] The breakdown can never sum to the meter, so the screen renders an
      explicit `unattributed_turns` remainder and a distinct "not metered"
      state. `total_turns` reads `usage_counters.used` — the number the plan
      enforces — rather than a ledger sum, which would make the remainder
      always zero and hide the gap it exists to report.
- [x] Three live vendor GraphQL bugs found and fixed while in the area:
      `whatsAppInboxTicket` selected `expires_at` (the field is `ttl_seconds`),
      which kept the inbox's SSE stream **permanently closed**;
      `markWhatsAppThreadRead` passed `conversation_id:` for `id:` with a
      `{ success }` selection set on a `Boolean!`, so marking read never
      worked; and `DeleteShopPackage` declared `$id: ID!` against a `String!`
      argument, so deleting a shipping package failed validation.
      `whatsapp-inbox/__tests__/api.schema.test.ts` guards that feature now.
- [x] **104 hand-written GraphQL documents across `apps/vendor` interpolate
      `${...}` and were therefore invisible to codegen** — no build-time
      validation at all, which is how five broken documents shipped. Closed by
      `src/shared/api/__tests__/documents.schema.test.ts`, which **imports** each
      `features/**/api*.ts` and validates every exported `DocumentNode` against
      `schema.gql`. Importing rather than scanning the source is the whole
      point: `gql` resolves the interpolation at import time, so the guard sees
      what the server sees. A source-scanning first attempt reported "1 failure"
      and missed two of the five precisely because they interpolate. Now covers
      **547 documents across 72 modules**, verified to go red on a regression in
      an interpolated document.
- [x] Adversarial review of Phase 2 (5 dimensions, 74 agents, 3-vote verify)
      confirmed 12 findings and refuted 11. Six were real defects in the new
      code and are fixed: the `MAX_ROWS` tail was summed as attributed before
      being trimmed, so the breakdown silently failed to reach its own meter;
      a signed-in negotiator always rendered as `***` because account ids were
      collected from panel rows only; the SSE transport did not cap
      `session_id` where the GraphQL DTO does; and three docs/docblocks claimed
      a released turn lands in the remainder, which it cannot — `release`
      decrements the counter that `total_turns` reads in the same transaction as
      its zero-quantity row, so it is absent from both sides.
- [x] **Security: the first version of the attribution write stored the raw
      `shop_cart_session` in `usage_events.ref_id`.** That id is a bearer
      credential — `CartResolver` is `OptionalJwtGuard` and
      `CartRepository.getOrCreateCart` resolves a signed-out cart from
      `{ shop_id, status, session_id }` alone — and `ref_id` is readable by the
      shop's own vendor through `myUsageEvents` and by any `manage_plans` admin
      platform-wide through `usageLedger`, which turned a reporting query into a
      cart-takeover primitive. Now writes `visitorSubject({ sessionId })`, the
      same `APP_SECRET`-salted digest `CustomerBotVisitorGate` already meters
      the visitor under.
- [x] Phase 3 — manual block. Shipped as a `shop_blocked_contacts` table, **not**
      a column on `DirectConversation`: verified in the code that
      `CustomerInboxService.thread()` looks a conversation up with
      `deleted_at: null` and *creates a fresh row*, so a flag there would be
      silently discarded the moment a merchant tidied the thread away. Both
      properties proven against the live database — a duplicate live block is
      rejected by the partial unique index, and re-blocking after an unblock
      succeeds. Checked above the pause on all three answering paths (WhatsApp,
      Telegram, and the panel for a signed-in visitor), after the unconditional
      store, so a blocked turn spends no quota and says nothing. `is_ai_blocked`
      reaches the inbox list in **one query per page**, not a second N+1.
      `api/customer-bot.md` was created in the same change, paying off the
      pre-existing debt for all 7 operations.
- [x] The block control's header row had to be lifted out of `{paused && ...}`
      — placed where it naturally belonged it would have been invisible on every
      unpaused thread, present in the code and absent from the screen, with no
      type or compile step to say so. Found by reading the JSX before writing,
      and pinned by `thread-view.block.test.tsx`.
- [x] Phase 4 — automatic flagging, never automatic blocking. `ai_flagged_at` /
      `ai_flag_reason` on `DirectConversation` — **columns rather than a table,
      the opposite call from the blocklist and deliberately so**: a block is a
      promise that had to outlive its thread, a flag is a transient hint that
      should not. Stamped when a visitor trips the *hourly* throttle (`rate`),
      their day/month share (`share`), or the unproductive-streak mute
      (`unproductive`). The **burst window does not flag** — three bubbles in a
      second is how people type — and neither do `no_signal` or `repeat`, which
      are noise rather than a squatter. At most one write per thread per hour,
      guarded by an `updateMany` predicate rather than a read-then-write, so the
      flood it reports does not become one row update per message; the stream
      publish is gated on having actually written. Written by the processors,
      not the ceilings, which is why `CustomerBotThrottle.mayAnswer` grew from a
      boolean into `{ allowed, reason }`. Cleared on a hand-reply and on a
      block, since both answer the question the chip asks. **Nothing in the
      answering path reads it back and nothing is ever blocked automatically.**
- [ ] Tune `VISITOR_MONTHLY_FLOOR` (30) from real data. Every number in
      `customer-bot.visitor-limits.ts` is a first guess; the gate logs its
      `reason` on every refusal so the distribution becomes readable. The floor
      is the risky end — too tight cuts off a real buyer mid-purchase.
- [x] `sendNegotiationMessage` is a **fourth transport onto the same meter**
      (`negotiation.quota.ts` spends `ai.agent.customer` from a mutation a
      signed-out visitor drives). It has its own per-identity ceilings, but a
      visitor capped on the panel can still reach the shop's monthly counter
      there. Decide whether it joins the visitor gate.
      Closed 2026-10-01: it joins the visitor gate. `startNegotiation`'s
      greeting and every `sendNegotiationMessage` now spend the caller's
      per-shop day/month share in `CustomerBotVisitorGate` (new
      `VisitorChannel` `'negotiation'`, same identity as the panel: `c:<id>`,
      else `guest_key` — on WEB the panel's own cart session — else
      `ip:<hash>`), ahead of the 60/h origin ceiling, the entitlement and the
      platform budget. A refusal is the template reply, never an error; the
      greeting goes through the new `mayCharge` (rationed, not
      noise-filtered). The gate moved into its own
      `CustomerBotVisitorGateModule` so `NegotiationModule` can import it
      without a cycle. Premise corrections: the only per-identity ceiling
      (`assertDailyCap`) counts sessions at start, so one address could draw
      1,440 metered turns a day against a ~10/day panel share; no
      first-party client calls either mutation (the storefront negotiates
      inside the already-gated panel); and the fourth writer had a second
      entry point, `handleMessagingTurn`, with a live bug: it passed no
      address, so every chat negotiation on the platform shared one
      `unknown` origin bucket (40 starts a day, after which `negotiate_price`
      failed for every shop; 60 phrased turns an hour). In-chat turns now
      pass transport `'chat'`: not re-gated, no origin bucket.
- [ ] Decide whether in-chat `negotiate_price` rides the chat turn's unit
      (template greeting on `'chat'`, nested phrasing cost folded into the
      outer `UsageTracker`): it books one extra `ai.agent.customer` unit per
      phrased reply plus one for a greeting nobody sees, and since the shared
      `unknown` bucket went (2026-10-01) more of those turns are
      model-phrased.
- [x] `loadSessionScoped` (`negotiation.service.ts`) lets a caller with
      neither an account nor a `guest_key` drive any negotiation session by
      id.
      Done 2026-10-04: a session is reachable only by the account on it or the
      holder of its `guest_key`, and a caller with neither is refused before
      the session is read. The hole was wider than this box: the old check
      compared identities only when both sides had one, so any guest key got
      through against an account's session and any signed-in customer against
      a guest's. `handleMessagingTurn` also no longer looks a session up with
      an empty key. A session opened while signed in is no longer reachable
      with only a cart key after the token expires.
      `negotiation.session-scope.spec.ts`.
- [x] `SendNegotiationMessageInput.message` has no `@MaxLength` (the panel
      caps at 1000) and the customer negotiation mutations have no
      `GqlThrottlerGuard`, so template turns still write two
      `negotiation_messages` rows each without limit.
      Done 2026-10-04: `message` is capped at 1,000 characters and
      `StartNegotiationInput.guest_key` at 200, and `startNegotiation`,
      `sendNegotiationMessage` and `acceptNegotiation` carry
      `GqlThrottlerGuard` at 20 a minute per address.
- [x] `CustomerBotQuota.open` returns before `budget.reserveCost` for a shop
      with no entitlement row, so an unseeded shop's turns sit outside
      `AI_DAILY_BUDGET_USD` entirely — and it is the one case where the
      gate's fail-open has no Postgres floor behind it. One-line fix.
      Fixed 2026-09-22, and it was not one line: the unmetered path (no row, or
      an entitlements lookup that threw) now books `reserveCost('chat')` too,
      with its own refusal branch returning `exhausted` and nothing to release.
      The box also missed a second symptom the same fix closes: `settle` and
      `abandon` trued up against a reservation that was never taken, so a
      priced unmetered turn wrote a negative delta that *credited* the day's
      cap. `settleBudget` now skips the one booking that holds no platform
      reservation. Six new `open` cases plus a Telegram processor case
      (unmetered shop, budget refused: the model is never called).
- [x] `back-end/docs/features/api/customer-bot.md` created, covering all
      seven merchant operations plus the SSE stream — the pre-existing debt
      paid off in the same change that added the two block mutations.
- [ ] Near-duplicate detection beyond the exact normalised fingerprint, if the
      logs show it is too brittle. Deliberately out of Phase 1: shingles need
      the previous N messages in memory and the marginal catch looked small.

### Negotiation: money leaks, bargaining economics, and the chat flow (2026-09-20)

A review of the live negotiation flow against a real Arabic haggle on a
product page. The chat half was the visible problem; the money half was worse,
and none of it had shown up in a test because nothing tested the path between
the cart and the till.

**The bargain never reached the till.** `verifyCheckout` and `createOrder`
both rebuild every line from the catalogue, and neither had heard of a
`NegotiatedOffer` — the cart showed 19.73 and the card was charged 22.70. Fixed
with `negotiated-line-pricing.ts`, read off the shopper's own cart rather than
the request, shared by both.

**An offer had no quantity and no owner and was never spent.** One unit
bargained to the floor priced a line of any length; `customer_id` is null for a
guest, so an offer id was a bearer token; and nothing marked one consumed, so
the same bargain could price a second cart and a second order until its TTL ran
out. Now: `quantity` capped at mint, redeem, both cart mutations and again in
the pricing engine (extra units bill at catalogue); `guest_key` snapshotted and
checked; `USED` + `used_at` + `order_id` set inside the order transaction.

**The seller could be walked to its floor by nibbling.** Conceding on any move
above ~2% of list is a ladder: +0.50 a turn from 13 against a 19.73 floor
collected a concession every time while the buyer never arrived. Three rules
now ration the band — gap-proportional reciprocity, a counter floor that spends
margin in proportion to how close the buyer actually is (ACCEPT deliberately
unclamped), and stock scarcity.

**And the chat could not see the page it was floating over**, lost the product
mid-haggle, and flipped language on every bare number.

- [x] **Negotiated price carried into checkout and orders (`BE`).** `loadNegotiatedLinePricing` on both; non-stacking negotiated lines excluded from coupon scope in both, as flash lines already were; a line longer than its offer is `negotiated_quantity` rather than a blend.
- [x] **Offer quantity, ownership and consumption (`BE`).** Migration `20260920120000_negotiated_offer_integrity`: `USED`, `guest_key`, `used_at`, `order_id`.
- [x] **Reciprocity and margin-reach clamps (`BE`).** `requiredCustomerMoveCents`, `counterFloorForTurnCents`; applied to COUNTER, FINAL_OFFER and verbal pushback.
- [x] **Scarcity floor (`BE`).** See the V1 entry's floor D box.
- [x] **Page context for the assistant (`SF` + `BE`).** `page_product_slug` on the mutation and the SSE body; `productSlugFromPath`; the PDP button passes the product beside the message instead of writing "(slug: …)" into the shopper's own chat bubble.
- [x] **`negotiate_price` resolves its own product (`BE`).** Slug optional → page → `findActiveSessionSellable`; no more "I lost track of which product we were negotiating" on a bare number.
- [x] **Panel language follows the thread (`BE`).** `threadLangFromTurns`; the messaging processor already had this fallback and the web path did not, so "13.5" answered an Arabic haggle in English.
- [~] **Negotiate a quantity, not just a price (`BE` + `SF`).** The offer carries `quantity` and the cap is enforced everywhere, but nothing in the chat or the PDP lets a shopper ask for a better price *for five*, which is the trade a merchant would actually make. Volume is the natural thing to want in return for a discount and today the seller asks for nothing.
      Phase A shipped 2026-10-01 (no migration): a quantity is no longer read
      as the bid — `extractOfferCents` drops "5 pcs" / "5 حبات" / "x5" / a
      known quantity and demotes "if I take 5" ("how about 16 if I take 5" →
      16, was 5; "I'll take 16" stays 16); `messageMentionsQuantity` is
      exported for Phase B. Phase B (volume pricing, needing
      `negotiation_sessions.quantity` and `negotiated_offers.min_quantity`)
      was approved by the owner on 2026-10-01 to be written and validated on
      the scratch database only; it is held as a patch outside the checkout
      until the owner approves applying it.
      Phase B built 2026-10-01 as a patch (66 files; `works 2026/2026-10-01-negotiation-volume-phase-b.patch`,
      outside the checkout): migration `20261001120000_negotiation_volume`
      (`negotiation_sessions.quantity`, `negotiated_offers.min_quantity`, both
      `INTEGER NOT NULL DEFAULT 1`, guarded, no backfill), validated from
      scratch on a throwaway database (all 36 migrations, `check:drift` Schema
      OK, idempotent re-run). Volume moves the preferred price toward the
      per-unit floor by cap × (1 − 1/N), caps 25/40/55%; the price for N is a
      minimum as well as a cap from the mint to `createOrder`; the chat reads
      a stated count (`messageStatesQuantity`) and replies with the price per
      piece and the total computed in code; the PDP stepper's count reaches
      the assistant, with a legacy-document fallback for an older API.
      887 back-end tests and the storefront's pass, `tsc` clean.
  - [ ] **Apply the volume patch (owner).** In this order: check the Render
        service first (`render.yaml`: `zaydak-backend` has `autoDeploy: true`
        and its build runs `npm run db:deploy`, so the auto-push applies the
        migration to Render's database if that service is still connected);
        `git apply --3way` the patch in the checkout (four one-line doc
        conflicts, keep both sides); `npx prisma generate`; `prisma migrate
        deploy` on the local database with both `DATABASE_URL` and
        `MIGRATE_DATABASE_URL` set, then `check:drift`; only then rebuild the
        API (the drift check refuses to boot without the columns).
  - [ ] Clamp the cart-line stepper to an offer's [`min_quantity`,
        `quantity`] (needs CartItem fields; today the API refuses and the
        cart shows its generic toast).
  - [ ] Show the asked-for quantity on never-accepted sessions in
        `negotiationOutcomes`.
  - [ ] An optional merchant volume setting or off switch.
  - [ ] Remove `ASK_SHOP_ASSISTANT_LEGACY` once every API the storefront can
        reach has `quantity` / `page_quantity`.
  - [ ] (optional) "I will pay 16 for 5" (a count after a bare "for", no unit
        noun) still reads 5 as the bid unless the session's quantity is known;
        revisit with Phase B.
- [ ] **Ask for something in return (`BE`).** Reciprocal concessions beyond price — a bundle, prepaid instead of COD, waived free shipping — so a discount buys the shop something. Overlaps "Alternative deals" in the V1 entry.
      Scouted 2026-10-01: narrow it to prepaid versus COD (the quantity trade
      has its own box, bundles and free shipping fit "Alternative deals").
      Nothing in the data makes prepaid cheaper for the merchant (COD is
      seeded at a 0 fee, card at 2.9% + 1.00), so the size of the concession
      has to be a merchant setting. Needs a migration and the owner's choice
      of the first trade and the setting's range and default; lands after
      the fee-aware floor below.
- [x] **Fold COD and payment fees into the margin floor (`BE`).** Floor C is cost vs price only; a floor priced at true margin can still lose money once a COD fee lands on it.
      Shipped 2026-10-01 (owner-approved design): at session start floor C is
      priced against the costliest processor fee among the methods
      `ShopPaymentsService.getOptions` lists, from the same `PaymentGatewayFee`
      schedule and `gatewayFeeCents` the profit engine uses
      (`floorFromMinimumMarginAfterFee`, closed form, holds at every price
      from the floor up). Also in `previewNegotiationFloor`, each policy's
      `floor_preview` and `negotiationAvailable`. No migration, no GraphQL
      change. The live rows: card 2.9% + 1.00 SAR, Tabby and Tamara 6%, COD 0,
      so a shop offering Tabby prices its floors against 6% (list 100.00,
      cost 60.00, 30% margin: 85.72 → 90.92 at the card rate). A cheap item
      can reach list and stop negotiating. Sessions already open keep their
      floor; it takes effect with the next API image.
  - [ ] **A way to enter a COD fee (`BE` + `ADM`).** `payment_gateway_fees`
        has no write path (no GraphQL/REST/admin screen); COD is seeded at 0
        and the card rates are placeholders from the manual SQL patch;
        carrier COD charges are not modelled.
  - [x] **Outcome margins after payment fees (`BE` + `VEN`).**
        `negotiationOutcomes` / rollups `margin_cents` and `margin_bps` are
        still before fees, so they read above the policy's fee-aware minimum.
        Done 2026-10-04, on the read path with nothing stored (the rollups are
        one grouped statement, so no version bump). A redeemed deal carries
        its share, by subtotal, of the fee its order paid, VAT and shipping
        included; a deal with no order carries what the floor assumed.
        Cash-on-delivery orders carry no fee and read as before. Fees are
        priced on read, so editing the fee schedule moves past figures.
  - [ ] **Snapshot the fee an order paid (`BE`),** so a later edit to
        `payment_gateway_fees` does not move past outcome margins. Needs a
        column.
  - [~] **Fee base includes VAT and shipping (`BE`).** The floor takes the fee
        on the unit price only; the processor charges the order total.
        VAT done 2026-10-04: the percentage fee is taken on the price plus the
        VAT checkout adds on top (the product's tax class, else the shop's
        default, else the costliest applicable rate, since no address is known
        when a floor is priced; a shop whose prices include VAT adds none).
        List 100.00, cost 60.00, 30% margin under 15% VAT is 91.52, was 90.92.
        Shipping is not in the base: the delivery fee depends on an address
        and a method that do not exist before checkout. Owner's call whether
        the floor should assume one (for example the shop's cheapest rate).
  - [~] **Spread the fixed fee over the offer's quantity (`BE`).** The
        per-order fixed fee is charged to one unit.
        Engine done 2026-10-04: `perUnitPaymentFee` spreads the fixed fee and
        the cap over `FloorInputs.quantity`, rounded up so the floor is never
        under-protected. The service still prices one unit, because a session
        carries no quantity until the volume patch adds
        `negotiation_sessions.quantity`; that over-protects, never
        under-protects. When the patch is applied, pass `quantity` at each
        `computeEffectiveFloor` call, and expect small conflicts with this
        work in the service, the engine and the DTO.
- [x] **Vendor-visible negotiation outcomes (`VEN`).** Which sessions closed, at what price, and how much margin each deal spent. Analytics beyond counters in the V1 entry is the same gap seen from the reporting side.
      Shipped 2026-09-22 as `negotiationOutcomes(filter, page, limit)` (same
      guards as `negotiationPolicies`, shop from `X-SHOP` only) and Analytics →
      Negotiations in the dashboard, gated on `ai.negotiation`. Each session row
      carries list, last-offer and agreed prices, quantity, offer status, the
      order, `discount_cents` (off list) and `margin_cents` (over the cost
      snapshotted at session start — null without one, negative below cost),
      labelled as the two different things they are; the summary sums money
      over redeemed (`USED`) offers only, on the quantity the order actually
      bought. The customer label is never the raw `guest_key` — for the web
      channel that is the cart-session bearer credential — but a digest suffix,
      and the same fix was then applied to `myAiSpenders`, whose key carried
      the whole credential. Found on the way: the GraphQL
      `NegotiatedOfferStatus` enum had no `USED`, so a used offer could not
      have serialised.
  - [x] **Rollups and trends (`BE` + `VEN`).** Per-product and per-strategy
        averages and a trend chart — what is left of "Analytics beyond counters".
        Shipped 2026-10-01 as `negotiationOutcomeRollups(filter, granularity,
        product_limit)`, a query of its own so an API image without it costs
        the dashboard only the breakdown. Same guards and filter as
        `negotiationOutcomes`; one raw statement (`GROUPING SETS ((product),
        (strategy), (day), ())` through `outcomesFilterSql`) with the same
        unwound rule and quantity cap, so `total` equals the summary and the
        products, strategies and trend each sum to it. The trend buckets by
        the shop-local day a session started (day up to 92 days, else month,
        zero-filled; `analytics/time-buckets.ts`). Averages are money-weighted
        and null, not 0%, without a base; `floor_reached` and
        `avg_rounds_to_close` answer the V1 box too — a count and a rate leave
        the server, never the floor. Analytics → Negotiations shows a trend
        card, a by-product table (names drill in) and a by-strategy table.
        A rollup error shows inside the cards; the section used to hide on a
        schema mismatch, and that branch is gone.
    - [x] **Drop the schema-mismatch fallback (`VEN`)** in
          `negotiation-outcomes-page.tsx` (and its render test) once the API
          image carries `negotiationOutcomeRollups`.
          Done 2026-10-05: the latched `isSchemaMismatchError` branch is already
          gone, and `schema.gql` carries `negotiationOutcomeRollups`. A rollup
          error shows "Could not load the breakdown." in the three cards. The
          feature doc already recorded the removal on 2026-10-04.
    - [x] **One copy of the time buckets (`BE`).** Switch `AnalyticsService`
          to `analytics/time-buckets.ts` and delete its private copies.
          Done 2026-10-01: `AnalyticsService` (the sales report series, target
          pacing, sales by channel) buckets through
          `analytics/time-buckets.ts`, and its private copies are deleted.
          2026-10-04: `salesReport` also bounds its window before walking it,
          by the same two rules as the negotiation rollups: over 3,700 days is
          `INVALID_RANGE` on `end`, and an explicit `day` over 92 days is
          `INVALID_GRANULARITY`.
    - [x] **Run the rollups reconciliation against Postgres (`BE`).**
          `test/concurrency/negotiation-outcome-rollups.e2e-spec.ts` is written
          but not yet executed (`typecheck:e2e`, `test:concurrency` with
          `DATABASE_URL_TEST`). Done 2026-10-01 on a throwaway database: it
          failed 9 of 9 with Postgres 42803 — a `COUNT(*) FILTER` inside the
          LATERAL named only outer columns, so the query errored on every real
          database — and passes 9 of 9 since it counts the lateral's own
          `session_id`. The same review capped the window (3,700 days,
          `INVALID_RANGE`) and refused `day` over 92 days, because the bucket
          walk could hold the event loop for minutes.
    - [ ] **Measured skeletons for the breakdown (`VEN`)** (`npm run bones`).
    - [ ] **`(shop_id, created_at)` index on `negotiation_sessions` (`BE`)** if
          the rollups measure slow — a migration, needs owner sign-off.
    - [x] **Week bucket (`BE` + `VEN`)** in `time-buckets.ts`, so the sales
          chart and the negotiation trend gain it together.
          Done 2026-10-01, in the API: `time-buckets.ts` has a `week`
          granularity. It starts on Monday (ISO), as a WEEK target and the
          report builder's WEEK dimension already do, and is keyed by the
          Monday's local `YYYY-MM-DD`, with partial edge weeks like partial
          months. `salesReport` and `negotiationOutcomeRollups` accept it;
          `autoGranularity` never picks it.
    - [ ] **Show weeks to merchants (`VEN` + `BE`, owner's call).** `week`
          exists only in the API. Either pick it automatically for a middle
          band (say 32 to 92 days, which also changes QUARTER target pacing)
          or add a Day/Week/Month toggle on sales over time and the
          negotiation trend.
  - [x] **Cancelled or refunded orders still count as redeemed (`BE`).** Done
        2026-09-25. The summary now counts a redemption only while its order
        stands. Before, nothing flipped an offer back from `USED`, so a
        cancelled, failed or refunded order kept reporting revenue, discount
        and margin the shop never kept. `NegotiatedOffer.order_id` has no
        relation to `Order`, so a second query (`unwoundOrderIds`) reads the
        order status for every spent offer the filter reaches, not just the
        page. The status set, `UNWOUND_ORDER_STATUSES`, is the same as
        `OrdersService`'s `NON_EARNING_STATUSES`. Every approved refund writes
        `order-refunded`, partial ones included, so a partial refund drops the
        whole negotiated line. That matches platform revenue, which counts
        `order-completed` only.
  - [x] **Rows and `redeemed_only` still ignore an unwound order (`BE` +
        `VEN`).** A row on a cancelled order reads `USED` with its discount and
        margin, and `redeemed_only` still matches it. Showing it takes an
        order-status field on `NegotiationOutcomeEntry` (a schema change).
        Filtering it takes the offer-to-order relation, which is an FK
        migration.
        Closed 2026-09-28 without the FK migration: each row carries
        `order_unwound` from the same unwound-order read the summary uses, and
        `redeemed_only` leaves out offers spent on those orders, read first by
        id. The report shows such a deal as "Order cancelled or refunded" with
        its money struck through.
  - [x] **CSV export and a product drill-down (`VEN`).** The API already takes
        `product_id`; the page does not expose it.
        Closed 2026-09-28: a product title drills into that product (a chip
        clears it), and Export CSV downloads every row the filter matches, a
        hundred at a time up to 5,000, money as plain amounts.

### AI usage & quota architecture audit — and the fixes (2026-09-20)

An evidence-based audit of the whole AI accounting stack against an
Outbound-Reply-Entitlement model, **followed by implementing its corrective
plan**. Reports in [docs/audits/](docs/audits/): the architecture audit (the
diagnosis, kept as found), the requirement gap matrix (re-verified after the
work), and the corrective plan (with its own three wrong proposals marked).

The system was in better shape than the review assumed. The billable unit is
**one `request` per answered agent turn**, booked before the model runs by a
single atomic `INSERT … ON CONFLICT … WHERE used + n <= limit`, settled by a
`commit` whose ledger insert carries a UNIQUE `handle_id`. Postgres is the
source of truth and a Redis outage cannot corrupt a balance. What was wrong
was six things around the edges, two of which were costing money: `enforce`
returned inside its Redis catch block and skipped the Postgres-backed daily
budget on all fourteen call sites behind it, and the negotiation assistant made
real provider calls from an `OptionalJwtGuard` mutation with no entitlement, no
budget and no bucket — behind a daily cap a caller disabled by omitting an
optional argument. Separately, `usage_events.cost_cents` is an `Int`, so a
typical sub-cent turn rounded to zero and three reporting surfaces read that
column while the admin AI matrix read `meta.cost_usd` and was right.

Three product decisions were settled before the work and shaped it: negotiation
shares `ai.agent.customer` rather than getting its own key; billing is per **AI
execution**, not per delivered message, so a reply that fails to deliver stays
charged; and the image allowance follows the subscription period.

Three of the plan's own proposals were overruled on review and are marked as
such in the document. `hash(body)` is wrong for an outbound job key — two
legitimate messages are often identical — so the key is the persisted
`DirectMessage` id. Requiring `guest_key` is not a boundary, because a client
can rotate it, so what bounds a rotating caller is a per-origin ceiling on a
salted digest of their address, with the entitlement and the platform budget as
the hard limits behind it. And an aggregate counter/ledger difference cannot
identify a stranded reservation: nothing durable names one, so the nightly
sweep only reads counters that have been quiet for an hour, and reports rather
than repairs.

**Verified:** 438 of 439 unit suites green (7321 tests); `tsc` clean;
`check:di` OK; and the 200-concurrent-reservations-against-100 scenario
**executed against a real isolated Postgres 16**, which was the audit's single
most important untested claim. Fixing the Jest `jose` transform recovered five
suites that had never run, Telegram's customer processor among them.

- [x] **Restore the budget reservation on a Redis outage (`BE`, T0).** Done 2026-09-20 — `enforce` fails open on the Redis bucket only; the budget is booked either way.
- [x] **Meter the negotiation assistant (`BE`, T0).** Done 2026-09-20 — `NegotiationQuota`, one unit per *turn* rather than per provider call, four ceilings, template fallback on refusal.
- [x] **One cost expression across every report (`BE`).** Done 2026-09-20 — `plans/usage-cost.sql.ts`; rounding happens once, after the sum. No column migration.
- [x] **Fix `CustomerBotQuota.abandon` (`BE`).** Done 2026-09-20 — keyed on the released reservation, `cost_usd` always written, and `VendorAgentService.releaseTurn` now writes the row it never did.
- [x] **Make `ai_usage.feature_breakdown` writes atomic (`BE`).** Done 2026-09-20 — one `jsonb_set` statement, no read.
- [x] **Counter/ledger reconciliation sweep (`BE`).** Done 2026-09-20 — `UsageReconcileService`, nightly 04:41 UTC, report-only.
- [x] **Alert on the unmetered fail-open (`BE`).** Done 2026-09-20 — `record`/`release` failures reach Sentry with a replayable payload.
- [x] **Make `telegram-customer.processor.spec.ts` executable (`BE`).** Done 2026-09-20 — `transformIgnorePatterns` for `jose`; recovered five suites.
- [x] **Entitlement concurrency spec in `test/concurrency/` (`BE`).** Done 2026-09-20 — 10 tests, executed against Postgres 16.
- [x] **Decide and document the delivery-failure policy (`BE`).** Done 2026-09-20 — charged per execution (D2), written into the plans and customer-bot docs.
- [x] **Align `ai.image.generate`'s period window (`BE`).** Done 2026-09-20 — subscription-anchored behind a dated transition so no live shop moves on the day it ships.
- [x] **Harden the two remaining idempotency edges (`BE`).** Done 2026-09-20 — `IdempotencyService.claim` is one conditional insert; send jobs carry the stored message id.
- [x] **Move `IMAGE_QUOTA_ANCHORED_FROM` forward if this ships after 2026-11-01 (`BE`, T0).** The constant must be at or after the deploy date, or a shop whose period began in between switches window mid-cycle — which is the thing the dated transition exists to prevent. `ImageGenService.onModuleInit` now logs a `warn` at boot when the date has already passed, so it cannot ship silently mis-set, but moving it is still a human decision.
      Closed 2026-09-30: it shipped on 2026-09-20 (commit 9d421baf) and has run
      in every API image since, ahead of its 2026-11-01 anchor, so nothing
      switches window mid-cycle.
- [x] **Fix `email.processor.spec.ts` (`BE`).** Done 2026-09-20 — two unrelated causes, both stale rather than broken behaviour: the cart-recovery tests mocked a Prisma client with no `cart.update` (the reminder stamp, now also pinned by a test of its own), and the OTP routing test asserted Arabic body copy that `renderOtpEmail` stopped producing at the React Email migration — the template is English-only and the bilingual half is the subject. **The back-end suite is now fully green: 439/439 suites, 7330 tests.**
- [ ] **No provider gives us send idempotency, on either channel (`BE`).** Evolution's `sendText` takes `{number, text}`; Telegram's `sendMessage` takes no key either. So a timeout after the provider accepted a message redelivers, on WhatsApp through BullMQ's retry and on Telegram through the one in-turn retry (`status === 0`). Queue-level identity bounds duplicate *enqueues* and cannot close this. Accepted for now and documented in `telegram-send.ts` and the customer-bot doc — for a customer watching a typing indicator a missing answer costs more than a repeated one. Revisit if either provider ships a key. **Billing is unaffected**: the turn is charged once, on the inbound queue, which retries nothing.
- [x] **Telegram customer path outbound identity — investigated, deliberately not changed (`BE`).** Closed 2026-09-20. It sends inline via `sendTextWithRetry` rather than through `TelegramSendQueue` *on purpose*: the message is recorded before it is sent and a send that throws should fail the turn, which a queue would swallow and retry independently. Routing it through the queue to gain a `jobId` would trade a real behaviour for a guarantee the provider cannot honour anyway. The difference is now written down in the customer-bot doc; the `messageId` contract stays on the queue for its notification and opt-in producers.
- [x] **Re-run the concurrency suite in CI (`INFRA`).** It is gated on `DATABASE_URL_TEST` and runs nowhere automatically, so the guarantee is proven on a laptop and not on every change. Note port 55432 is inside a Hyper-V reserved range on some Windows hosts — see `test/concurrency/README.md`.
      Closed 2026-09-22, and the premise was wrong: CI already ran the suite on
      every push and PR. The real bug was that it could not pass there — CI runs
      it on the migrated, seeded database, where the spec's
      `CREATE TABLE IF NOT EXISTS` did nothing and the real shop foreign keys
      rejected every insert (reproduced: 10 of 10 failed), and its schema pin
      queried `pg_constraint` although Prisma builds those uniques as indexes.
      So the step has very likely been red since 2026-09-20. The spec now runs
      in its own throwaway schema (FK-free copies of the real tables on a
      migrated database, hand-written DDL on an empty one) and pins arbiters
      through `pg_index`, the real public tables included. Verified green on
      both an empty and a migrated scratch database (35 passed, 5 todo, with
      the new contact-email backfill spec).
  - [ ] Confirm in GitHub Actions that the back-end job's concurrency step is
        green again after this lands.

### Langfuse Phase 1 — negotiation tracing + cost (2026-09-19)

Chose Langfuse over LangSmith for cost/self-host/privacy ([docs/langsmith-vs-langfuse.md](docs/langsmith-vs-langfuse.md)). Nest boots an optional `LangfuseSpanProcessor` when `LANGFUSE_*` keys are set. Negotiation start/send turns emit an agent trace with pricing-engine tool span + LLM generation.

**Phase 1.1 (2026-09-19):** generations set `costDetails.total` in **provider USD** from `UsageTracker` (only when `has_reported_cost`); `shopId` + `feature=negotiation` on every observation; `userId` remains the customer. No CallbackHandler double-generation. Shop analytics = filter Traces by metadata `shopId` (do not invent a Users-by-shop mapping).

**Phase 1.2 (2026-09-19) — all AI surfaces:** shared `common/observability/ai-trace.ts` (`withAiTrace` / `withAiLlmGeneration` / `recordAiTurnGeneration`). Wired: vendor-agent, customer-bot (+ storefront panel as `storefront-assistant`), ai-editor, ai-content, intent, moderation, segment-explain, auto-categorize, enhance-vision, system-category-suggestion. Negotiation kept as thin wrappers over the same helper.

**Phase 1.3 (2026-09-19) — cost + Admin matrix + spike alerts:**
- Fixed `UsageTracker` to prefer cost-bearing usage shapes (OpenRouter `cost` on `response_metadata.usage` was lost when LangChain filled token-only `tokenUsage` first).
- Admin `/analytics`: `aiSpendByShop` matrix (Sidekick / Customer bot / Images / Other / Total) from `usage_events`; filter by date window + plan. Vendor quotas/UI unchanged.
- Daily BullMQ sweep `AI_SPEND_SWEEP` alerts when a shop's UTC-yesterday AI spend ≥ max($5, 3× prior-7d daily average). Env: `ALERT_AI_SHOP_SPEND_MULT`, `ALERT_AI_SHOP_SPEND_FLOOR_CENTS`.

**Phase 1.4 (2026-09-19) — TODO follow-through:**
- Customer-bot / storefront Langfuse sampling via `LANGFUSE_SAMPLE_CUSTOMER_BOT` (0..1; default 1). Billing never sampled.
- Admin `aiSpendByPlan` — cost matrix by plan tier (feeds “collect cost distribution”).
- CSV export on the shop AI spend table.

**Product decision (2026-09-19) — two ledgers, no merchant $ quota:**
- **Vendor** keeps plan units only (`myUsage` / `/plan/.../usage`: requests, images, characters…). Never show OpenRouter $ or tokens as a merchant wallet.
- **Platform** sees real provider $ via Langfuse + Admin analytics / `usage_events.cost_cents`.
- **Do not** add a merchant-facing $20 (or any fixed $) AI allowance, and **do not** change plan quota maths for this.
- **Later (after real cost distribution exists):** an **internal** per-shop operational budget (admin-only) for alerts + soft controls — not a sudden Sidekick kill unless the plan terms already say so. Numbers come from observed cost percentiles per tier, not a guess.

- [x] **Wire Langfuse OTEL + negotiation instrument (`BE`).** Done 2026-09-19.
- [x] **Phase 1.1 — costDetails USD + shopId metadata (`BE`).** Done 2026-09-19.
- [x] **Phase 1.2 — shared ai-trace + instrument all Nest AI surfaces (`BE`).** Done 2026-09-19.
- [x] **Phase 1.3 — UsageTracker cost-shape fix + `aiSpendByShop` Admin matrix + daily spike alerts (`BE` + `ADM`).** Done 2026-09-19.
- [x] **Phase 1.4 — customer-bot sampling + `aiSpendByPlan` + CSV export (`BE` + `ADM`).** Done 2026-09-19.
- [x] **Ops: create Langfuse Cloud project + put keys on Backend env** (`LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`).
- [ ] **Smoke: negotiation / Sidekick / bot turn shows non-zero Model costs when OpenRouter reports `usage.cost`.** Rebuild API → Langfuse generation `costDetails` + `usage_events.cost_cents`.
- [ ] **Smoke: Admin `/analytics` AI cost-by-shop + by-plan tables + Langfuse filter by `shopId` / `feature`.**
- [x] **Customer bot sampling** — `LANGFUSE_SAMPLE_CUSTOMER_BOT` (set e.g. `0.1` if Cloud Hobby ceilings bite).
- [x] **Collect cost distribution per plan tier** — Admin `aiSpendByPlan` on `/analytics` (from `usage_events`).
- [ ] **Later: internal per-shop operational budget (admin-only)** — alerts + predefined soft controls; never merchant-facing; not a hard kill unless plan terms cover it. `usage_events` stays billing SoT. Use plan-tier distribution before picking numbers.
- [x] **Richer admin shop-spend CSV export** — Export CSV on AI cost-by-shop. Feature column picker still optional later.

### The chat → form handoff gets an identity (2026-09-16)

The vendor's ask was one sentence: take me straight to the form, colour the
fields the assistant filled, and tell me it worked when I save. Mapping it
found the first and third half-built and disagreeing with each other, so this
is the slice that makes what exists true before anything is added to it.

**The two surfaces behaved differently and one card lied for both.** The
full-page `/ai` chat pushed the vendor to the form on a 600ms timer for three
of the six targets; the docked panel — the surface almost everybody uses —
had no navigation code at all. `NavigateToFormCard` rendered on both and told
both, unconditionally, "جاري فتح النموذج تلقائياً". Worse, the timer path stashed
only `{target, values, entityId}` and dropped `place_stock_at` and
`next_step`, which the tool emits as siblings of `prefill` — so the automatic
route was the one that lost the vendor's warehouse answer and could never
finish a chained request. The timer is gone rather than universalised: the
complaint behind "يحوّلني مباشرة" is about hunting for a button, and the
answer to it is not moving a merchant off the screen they were reading.

**The follow-up step had no owner.** It lived in one global slot in a store of
its own, so a save on a screen the agent cannot even queue a step against
would consume the step staged for a different, still-unsaved entity — and
`update_collection` and `update_coupon` are exactly that, direct writes with
no form handoff. So `useAgentFollowupStore` is retired and the step rides the
prefill, which is now a **ticket**: `handoffId`, `values`, `nextStep`,
`placeStockAt`, consumed by `takeHandoff(target, entityId?)`. Six resume call
sites became five; the collection-edit one is gone because it could only ever
have eaten somebody else's step.

**`clearVendorAgentPrefill` had zero callers**, against a doc comment telling
the next person to call it from the submit handler. A draft the vendor looked
at and rejected therefore came back the next time they opened the form inside
the 15-minute TTL, with no chat on screen to explain it. A save consumes the
ticket; leaving the form releases it, deferred one macrotask so React's
strict-mode remount does not read as the vendor walking away.

Also: the card asks `navigateGuarded` now, like every other programmatic push
in the dashboard — it was the one that skipped the leave prompt; an assisted
save lands on the entity it just made rather than on the list, which is the
one screen where it is a row among forty; and the product and coupon success
toasts stopped being hardcoded English at an Arabic merchant.

Two things the review called for and the code did not support, both checked
rather than taken: the `dirtyFields` patch hole (only `use-collection-editor`
builds a patch, and collections have no `collection_edit` target, so an AI
edit cannot be dropped by it), and `forceDirty` for an AI draft
(`product-form-layout.tsx:161` renders a permanent submit button, so a
prefilled form was always saveable — and forcing the bar would put a
leave-guard dialog in front of a merchant trying to reject the draft).

- [x] **Multi-step UX.** Done 2026-09-16. The plan is conversation state now
  (`lib/task-plan.ts`): `latestPlan(messages)` finds the newest snapshot
  anywhere in the thread and only that turn draws the card, so the stack of
  frozen To-do cards is gone — dedup inside one `AssistantTurn`'s `parts` was
  all a turn could do, and the prescribed flow (form → save → auto-resume)
  guarantees the re-sends land in different turns. A finished turn with an
  `active` step renders **waiting on you** instead of an `animate-spin` that
  never stops, which was the normal case rather than an edge one. A new
  `TaskPlanStrip` pins "step 2 of 3 · <title>" above the composer while the
  plan is incomplete, so the vendor can see where they are from the form the
  panel travelled with them to. Derived from messages rather than a store, so
  the public share view reads the same. And the prompt no longer tells the
  model to mark a step `done` right after `create_coupon` — a tool that
  creates nothing, which is why the card said 2/2 with the form still empty;
  paid for within the 26k ceiling by cutting a line WORK_LOG_STYLE already
  covered. `ai.md` claimed the opposite of all this and now does not.
- [x] **A receipt after a save.** Done 2026-09-16. `vendorAgentSaveReceipt`
  writes an assistant turn with no model call behind it — the sentence is
  composed server-side, because every turn runs `reserveTurn`/`settleTurn`
  against the shop's plan allowance and "تمام، خلصنا" does not need a
  language model, would be slower than the save it acknowledges, and could
  fail on an overloaded provider. Persisted rather than client-drawn so it
  does both halves of the ask: the vendor sees it, and the model sees it on
  the next load. Rides `kind: 'tool'` as planned. Idempotent on `handoff_id`
  over the last 12 assistant turns — a retried save, a double submit or a
  strict-mode remount all reach the success callback twice, and two receipts
  read as two products. Scoped by the ticket: no receipt for a save the vendor
  made alone, and none when a `next_step` is about to speak for itself.
  - [x] **No unread badge on the sparkle trigger.**
        Shipped: `pushReceipt` sets `unread` when the panel is closed;
        `SiteHeader` shows a violet dot + `aiAssistantUnread` aria; opening
        clears it. Receipt deliberately still does not open the panel.
- [x] **Mark the fields the assistant filled.**
      `AiPrefillProvider` keeps the key set; `AiFilledMark` chips on price,
      sale price, quantity, SKU, status, name and media. Dirty clears the chip.
- [x] **The panel has a mobile mode** — `useIsMobile()` in `ai-chat-panel.tsx`:
      full-bleed fixed sheet under the header, no push spacer, resize/expand
      hidden. Desktop docked push unchanged.
- [x] **"لأ، غيّر السعر لـ 300" is structurally impossible** and no design here
  changes that: the prefill is read once in a mount-time lazy initializer, a
  `router.push` to the URL you are already on does not remount, a second
  `create_product` prefill would wipe the fields it did not re-send, and
  `send()` carries no form state. That is a live form channel — read the
  mounted form into the turn, apply a patch back — and a separate feature.
  Done 2026-10-01 for the product create and edit forms: the live form
  channel. A product form opened from a handoff registers itself
  (`useLiveForm`, `store-live-form.ts`) under its ticket's `handoffId`;
  `send()` and `regenerate()` add `form: {form_id, target, entity_id?,
  values}` to the SSE body while that ticket is still the pending one. The
  API sanitizes it (`tools/lib/live-form.ts`: all-or-nothing envelope,
  allow-listed, typed and capped values) and, on a `WEB` turn only, offers
  `patch_form`, adds `## The form on screen` above `## Before you send` (the
  values as one JSON line labelled vendor data), and makes `create_product` /
  `update_product` refuse a second card for that form
  (`AGENT_FORM_ALREADY_OPEN`, hint naming `patch_form`). `patch_form` writes
  nothing: its `form_patch` (`patch_id`, `values`, `changed`; a translatable
  carries only the changed locale) is staged with `setValue(…, {shouldDirty:
  true})`, so the save bar shows and nothing saves until Save. The "Filled by
  Sidekick" marks follow the proposed values now, not "dirty". No GraphQL,
  Prisma or SSE-event change; an API without the field ignores it.
  - [x] **Coupon and collection forms as live forms.** v1 registers only the
        product create/edit forms.
        Note 2026-10-02: when they register, their handoff cards need the
        already-open guard the product card now has (`isLiveFormFor` in
        `NavigateToFormCard`).
        Done 2026-10-05: all four coupon forms register through
        `useCouponLiveForm`, and collection create registers through
        `useLiveForm`. The already-open guard covers both targets. The
        collection edit screen and the product-form drawer do not register.
  - [x] **An old handoff card clicked for the form already on screen.**
        `NavigateToFormCard` still stashes a new ticket and pushes the same URL:
        no remount, the mounted form's save runs the new ticket's `nextStep` /
        `placeStockAt` / receipt, the live channel ends, and a dirty form shows
        the leave dialog for the page it is on. The server guard stops new
        cards; cards already in history still do this.
        Done 2026-10-02: a card pressed while its form is the live form on
        screen stashes nothing and navigates nowhere; it says the form is
        already open, and to ask in the chat or save or discard first. A card
        for another product, or one pressed after the form unmounted, opens as
        before.
  - [ ] **Image and gallery patches** — `patch_form` has no media fields.
  - [x] **Clearing a field from chat.** `patch_form` ignores empty strings, so
        "شيل الخصم" cannot clear `sale_price`; needs an explicit `clear: [field]`.
        Done 2026-10-02: `patch_form` takes `clear: [field]`, limited to the
        nine fields the product form accepts blank
        (`PRODUCT_CLEARABLE_FIELDS`) and refused with
        `AGENT_FORM_FIELD_NOT_CLEARABLE` otherwise, with nothing in that call
        applied. A cleared field travels as `null` and the dashboard writes
        that field's own blank (numbers as `null`, so a reload keeps the
        clear). A clear wins over a value for the same field, and a cleared
        sale price no longer blocks a price cut in the same call.
  - [x] **Name `clear` in the prompt's form block (`BE`)** if models under-use
        it. Today only the tool schema describes it.
        Done 2026-10-04: the block says a field is emptied through
        `patch_form`'s `clear` list and that an empty string is ignored. A
        spec ties the wording to the tool's own argument name.
  - [x] **A composer chip naming the form the assistant can see.**
        Done 2026-10-04: the docked panel's composer shows a chip naming the
        live form ("Editing: <saved product title>" / "New product") for
        exactly as long as the next message would carry that form; it goes
        when the form unmounts, saves or loses its ticket. Product forms only,
        and it shows the saved title, not an unsaved rename.
  - [x] **`update_product` with one locale wipes the other.** It emits
        `name: {en: name_en ?? '', ar: name_ar ?? ''}` and `ProductForm` merges
        the prefill shallowly, so renaming only the Arabic title blanks the
        English one on the edit form (same for description and SEO).
        Done 2026-10-01: `update_product` sends only the locales it was given,
        the product form merges a translatable prefill per locale
        (`mergeProductPrefill`), and the chat-channel card merges it over the
        product's current value before `ProductsService.update`, which had the
        same wipe. Turns persisted with the old `{en: '', ar: …}` shape are
        safe too.
        2026-10-04: collections had a worse form of it. `update_collection`
        writes directly, so a one-language name blanked the other in the
        database. It now merges over the collection's current pair before
        writing, `create_collection` prefills only the locales given, and the
        collection form merges its prefill per locale through the shared
        `mergePrefill` (`shared/lib/merge-prefill.ts`), which the product form
        binds too.
  - [x] **The collection form shows no "Filled by Sidekick" marks (`VEN`).**
        It has no `AiPrefillProvider`; `proposedFromPrefill` is ready for it.
        Done 2026-10-05: the create screen wraps `AiPrefillProvider` and marks
        title, description, SEO and handle while they still hold what the
        assistant proposed, including a later patch. The edit screen and the
        product-form drawer do not, and the drawer does not inherit the
        product form's marks.
  - [x] **Quieter row for a self-correcting refusal.** `AGENT_FORM_ALREADY_OPEN`
        renders as a red "Operation failed" card right above the patch card
        that fixed it.
        Done 2026-10-02: that refusal renders as a quiet grey row ("The form
        is already open on your screen") with no error card, and every other
        failure stays red. It is recognised by the hint naming `patch_form`,
        because a tool refusal carries no code: a string match across the two
        codebases, pinned by a back-end spec.
        2026-10-04: refusals built by `toolRejection` now carry `code`, their
        i18n key, and the dashboard recognises `AGENT_FORM_ALREADY_OPEN` by
        it. The hint match survives only as a fallback for turns persisted
        before that day.
  - [x] **A `code` on the other failures too (`BE`).** `toolFailure` (a thrown
        error) and the dispatcher's own failures (plan gate, unregistered
        tool) still carry none, so not every `ok: false` is machine-readable.
        Done 2026-10-05: a thrown error carries the `AppException` error code,
        or `AGENT_TOOL_FAILED`. The dispatcher stamps `AGENT_TOOL_UNREGISTERED`
        and `AGENT_PLAN_GATE` on the failures it decides itself, and the same
        thrown-error code when a tool throws past its own `toolFailure`.
  - [x] **A patched create draft can outlive its ticket.** Once patched the
        create form is dirty, so `useProductDraft` parks it, and that draft can
        come back on a later manual "Add product".
        Done 2026-10-02: a draft parked by an assistant-opened form carries
        its `handoff_id`, and a manual "Add product" drops one whose ticket
        was saved, released or replaced (`draftOutlivedHandoff`). A reload in
        the same sitting still restores it, and a draft the vendor started
        themselves is never retired.
        2026-10-04: `ProductForm` itself now has render coverage for it,
        beside the two cases that must still restore (a vendor's own draft,
        and a reload while the ticket remains).
  - [x] **`regenerate()` can silently no-op.** Its `removed` flag is set inside
        a `setMessages` updater and read synchronously, which only holds when
        React computes the state eagerly.
        Done 2026-10-02: `regenerate()` decides from the render's own
        `messages` and removes the retried turn by id, so Retry runs when
        React defers the update and never drops a row that arrived in the same
        tick. The old body was reproduced making no request at all.
  - [x] **The agent cannot change an existing product's category.**
        `update_product` has no `system_category_id`; only `patch_form` on an
        open edit form can.
        Done 2026-10-01: `update_product` takes `system_category_id`, checked
        like `create_product` and `patch_form`, on the dashboard and on the
        chat channels.
  - [x] **Align the prompt's live-form rule with `FORM_ALREADY_OPEN_HINT`.**
        The hint now says a change `patch_form` cannot carry (images,
        `next_step`, `hs_code`, `country_of_origin`, `in_stock`) needs the
        vendor to save or discard the open form first; the prompt block does
        not say so.
        Done 2026-10-01: the `## The form on screen` block now says what the
        hint says, and a spec pins the two together. The dashboard prompt is
        21,561 characters, under the 26,000 ceiling.
- [x] **No locale-parity test exists** anywhere in `apps/vendor`, so a key
  added to `en.json` and forgotten in `ar.json` fails at runtime in Arabic
  rather than in CI. Whoever adds strings next should add the test.
  Shipped as `src/shared/i18n/__tests__/messages-parity.test.ts` — same paths,
  same order, no empty leaves.

### Sidekick recited the prompt instead of answering (2026-09-16)

Every vendor who typed "بدي أنشئ منتج" got back the same sentence, word for
word, whatever else was in the message. It was not a cache and not a canned
route — `chat-actions` only serves the WhatsApp/Telegram cards. The sentence was
in the **system prompt**: `CREATING_A_PRODUCT` carried a heading reading
`Example when missing:` followed by one quoted Arabic line, and a small model
given a single quoted exemplar recites it. What reached the vendor was that
line with two words swapped.

So the exemplar is gone and nothing replaced it. The section now says to read
the vendor's message first — "بدي أضيف هودي" is already a name, "منتج بسعر 200"
is already a price — ask only for the half that is missing, and compose the
sentence in the vendor's own dialect. `BEFORE_YOU_SEND` — last in the prompt,
where a model weighs an instruction most — closes on the general rule: a quoted
line in the prompt is a shape, never a script. `NAVIGATE_TO_FORM_STYLE` had the same
shape ("جهزت النموذج. راجع البيانات واضغط إنشاء.") and got the same treatment.
The dashboard prompt came out at 25,982 characters against 25,991 before, and
that is not a coincidence — the 26k ceiling in `vendor-agent.prompt.spec.ts`
rejected the first attempt at 26,942 and the rewrite had to earn its space by
cutting the paragraph the exemplar was illustrating. The ceiling doing its job.
The worked exemplars stay in `REPLY-STYLE.md`, which the model never receives.

Two levers were deliberately left alone, because both cost something the prompt
fix does not:

- [ ] Temperature is `0.3` (`graph/build.ts:68`, nothing overrides it) — low
  enough that the model will not vary wording on its own. Worth raising to
  ~0.6 for the dashboard channel, but measure tool-call reliability first: this
  graph calls tools on most turns and sampling noise lands there too.
- [x] The dev model is `nvidia/nemotron-3-super-120b-a12b:free`
      Closed 2026-09-30, superseded: the model is the admin's `AI_CHAT` row, not
      `OPENROUTER_MODEL`, and it has been `google/gemini-2.5-flash` since
      2026-09-29. Recitation is part of the next Sidekick walk.
  (`OPENROUTER_MODEL`). Verbatim recitation of a few-shot exemplar is a
  small-model behaviour, and the prompt's own comments already concede a small
  model stops weighing sections ~20k characters in. Try a paid tier on the
  dashboard channel and compare before blaming the prompt again.

### Importing ONE product, and the scope that makes it safe (2026-09-15)

"Scrape me this product" is now `import_product`, a fourth Sidekick tool beside
`scan_store`. Ask the assistant to import a product without giving it a link and
it asks for one — not because a prompt rule says so, but because `product_url`
is a **required argument with no default**, which is a question the model cannot
answer on the vendor's behalf.

The thing worth keeping is why this is a `StoreImportScope` on the job rather
than `scan_store` with a smaller number. The difference is not size, it is what
this server is allowed to do to **somebody else's website**. A `PRODUCT` job
discovers nothing, reads no sitemap and follows no link: it fetches exactly the
address it was named. Crawling outward from one product would read a stranger's
site to answer a question about a single item, and could file *their* other
products under an address nobody attested to.

Two consequences fall out of that and both are decisions, not omissions.
It books **no `catalog.store_import` quota unit** — that key counts whole-store
migrations and BASIC's allowance is one a month, so charging a unit per product
would let a vendor spend their entire migration on a single item. The per-shop
rate limiter still applies, and is what bounds this path. And the
"no longer in the source" report is **skipped**: that report is a statement about
coverage, so running it after a scan that returns exactly one product by design
would list every other product ever imported from that host as missing — a
confidently wrong answer on the one screen built to tell a merchant what their
source dropped.

The scope lives on `ScanContext` and exactly two places consult it —
`discoverSitemapUrls` and the crawl's depth cap — so every connector, the CSV,
the identity map, the media rows and `importFromCsv` are untouched. That also
means a single product gets the paid ScrapingBee floor for free, through the same
chain, with the same `requiresProvider` skip when the provider is off.

- [x] **No dashboard entry point yet (`VEN`)**
      The tool works and the service is scope-aware, but the import dialog still
      offers only a whole store. A merchant who wants one product has to ask the
      assistant. A URL field with a "just this product" option is the obvious
      next step, and the progress route already renders a one-row preview
      correctly because `scope` is on `storeImportJob`.
      Done 2026-09-30: the import dialog has a third source, "Import a single
      product". It sends `createStoreImport(scope: PRODUCT)`, a new optional
      input field that means STORE when absent, and it is sent only for a
      product, so an older API still takes whole-store requests. It refuses a
      bare home page and routes to the progress screen, titled "Product
      import", where "Scan again" repeats the scope. Building it showed that
      "a PRODUCT job discovers nothing" was false on Shopify and Woo:
      `products.json` and the Woo Store API ran first and returned the whole
      catalogue, uncharged. `runStrategyChain` now skips a strategy marked
      `wholeCatalogue` for PRODUCT scope.
- [~] **Decide what a single-product import should do about the attestation
      wording (`STORE` · `SEC`)**
      The tool asks the vendor to confirm they own the product's content or are
      authorised to use it, which is the honest question — but it is worded for
      a store migration. On a competitor's product page it is the only thing
      standing between "import this" and copying somebody's listing wholesale,
      so the copy is worth getting right before this reaches a UI.
      Drafted 2026-09-30 and waiting for the owner: the dialog asks that the
      product's content is theirs (their own listing elsewhere) or that they
      have the rights holder's permission, says importing someone else's
      listing without permission is not allowed, and stays required
      (`products.import.product.attest*`, en and ar).
- [ ] **Align `import_product`'s `attested_owner` with the approved wording
      (`BE` · vendor-agent).** Sidekick's tool still asks the store
      migration's "own it or are authorised to use it".
      Checked 2026-10-01: blocked on the box above. No approved wording exists
      yet; the draft is `products.import.product.attest*` in the vendor
      catalogues. Once the owner approves it, this is a one-line change to the
      `attested_owner` `.describe()` in
      `tools/store-import/import-product.tool.ts`.

### The anonymous contact form lands in the customer-bot inbox (2026-09-15)

Approved as option (أ) on 2026-09-14 and the back-end half is built. A stranger on
a storefront can now write to a merchant, and the message arrives as a
`DirectChannel.CONTACT_FORM` thread keyed on `mailto:<email>` — read the way a
WhatsApp thread is, scoped by **shop ownership**, so it appears in the inbox
screen the customer bot already ships.

The channel is the decision. `sendDirectMessage` and the `WEB` inbox exist and
**nothing in any of the three frontends calls them**, and their authorisation is a
`Participant` row — which shop staff do not have and which an ownership transfer
strands. An anonymous sender can never be a participant at all, so a `WEB` thread
would have been a row addressed to nobody in a table nobody reads.

Four rules the surface is built around, each of which is a test. The shop comes
from `X-SHOP` and there is **no shop field on the input** (`subscribeNewsletter`
takes a caller-supplied shop, which is exactly why any shop on the platform is
targetable from any origin). The per-IP ceiling (3/hour) is consumed by *every*
caller before the honeypot is looked at, so a tripped trap is not free; the
per-shop ceiling (30/hour) only afterwards, so a bot cannot exhaust a merchant's
budget and close the form to real customers. Both are `failClosed` — there is no
database-backed floor behind this one, unlike every other limiter here. And the
answer never varies: a known address, an unknown one, a tripped honeypot and a
body the moderator blocked all return `{ success: true }`, because a
distinguishable refusal is an email-enumeration oracle that also tells a spammer
which of their attempts landed. `CONTACT_MESSAGE_RATE_LIMITED` is the only
refusal the operation can produce.

The honeypot is the repo's first — there is no captcha, no Akismet and nothing
else of the kind anywhere — and it is the one field with no `@MaxLength`, since a
length refusal would be exactly the distinguishable answer a trap must not give.

Moderation keeps the regex quick scan rather than passing `skipQuickScan` the way
the vendor agent and the rich-text editor do, and the reason is that this
surface's refusal is *invisible*: a false block is a customer's message
disappearing with nobody told. The scan cannot block — its URL, phone and email
flags are `medium`, which resolves to `flag_for_review` and publishes — so
keeping it guarantees a tracking URL or an order number is never silently
swallowed. It is the customer's own words that are moderated, never the composed
body, whose header line carries an email address the scan would flag every time.

- [x] **Storefront contact form UI (`T4` · `STORE`)**  
      Shipped 2026-09-15 as `apps/storefront/src/features/contact/` and
      `/[shopSlug]/contact`, linked from the footer's Contact us column. The
      identical-response property is honoured and pinned: five outcomes —
      acknowledged, `success: false`, a moderation code, any other code, and a
      dropped connection — are rendered and asserted to produce the *same
      string*, with `CONTACT_MESSAGE_RATE_LIMITED` the only branch. A transport
      failure joins the confirmation branch deliberately: from the browser it is
      indistinguishable from a server that chose to drop the message, and a
      third state for it is the signal an oracle needs. The honeypot is
      off-screen rather than `display: none` (cheap fillers skip that) and is
      never inspected client-side, so a bot still spends the per-IP ceiling.
- [x] **List `/contact` in the per-shop sitemap (`T4` · `STORE`)**  
      Shipped: Added `${base}/contact` with monthly changefreq and 0.5 priority
      in `apps/storefront/src/app/[shopSlug]/sitemap.xml/route.ts`.
- [x] **Teach the shop inbox about `CONTACT_FORM` — the back-end half (`T4` · `BE · customer-bot`)**  
      Both assumptions are fixed. `channelOfIdentity` recognises the `mailto:`
      prefix and `maskChannelIdentity` reuses the existing `maskEmail` instead of
      falling through to `maskPhone` (which rendered an address as a mangled
      phone number, in the inbox list *and* in log sinks). And
      `replyToWhatsAppThread` now refuses this channel — placed **before**
      `inbox.record` and `pauseAssistant`, not merely before the send, because a
      refusal after the record would persist a reply bubble the merchant can read
      back and believe was delivered, which is strictly worse than the original
      silent send. `channel` is on the wire so a screen can render it.
  - [x] **The vendor screen still offers a reply composer on every thread
        (`VEN`)** — `features/whatsapp-inbox/` now queries `channel`, renders a
        dedicated contact-form channel badge, and disables the reply composer
        with an informative notice when `channel === "CONTACT_FORM"`.
  - [x] **Replying to a contact-form sender by email** is a real unbuilt feature,
        refused cleanly rather than half-built. It needs an outbound mail path
        from the inbox, a reply-to that routes the answer back into the same
        thread, and a decision on what a shop's from-address is (platform domain
        vs. the merchant's own). Until then the sender's address is in the
        message body and answering from the merchant's own mail client is the
        supported path.
        Built 2026-10-01 on the owner's decision of that day. The inbox reply
        on a CONTACT_FORM thread runs `ContactFormReplyService.authorize` before
        recording, then queues a `send-contact-reply` email job keyed on the
        stored message. From is the platform's sending address as "<shop> via
        Zaydak" / «<shop> عبر زايدك»; Reply-To is
        `notification_settings.sender_email`, verified or not; with none it is
        refused (`CONTACT_REPLY_SENDER_EMAIL_REQUIRED`) and the vendor box links
        to Settings → Notifications. Guards: suspended shops refused;
        fail-closed ceilings of 30/h and 100/day per shop and 10/day per
        recipient across shops; the merchant's text moderated (block only);
        HTML escaped, no quoted original, a provenance footer, a stable
        Message-ID, an audit row with masked addresses, `sent_at` stamped. The
        email links to the shop's /contact page, so a new message from there
        joins the same thread. The customer's answer lands in the merchant's
        own mailbox. Needs the next API image (an older one refuses the reply)
        and a rebuilt `packages/emails` before `docker compose build api`.
    - [ ] **Inbound email threading:** route a customer's emailed answer back
          into its CONTACT_FORM thread (MX + inbound-parse webhook).
    - [~] **Sent/bounce state on the wire:** expose `DirectMessage.sent_at` on
          the inbox message, and add provider bounce/complaint webhooks so a
          bounced reply does not read as sent.
          First half done 2026-10-04: `WhatsAppInboxMessage.sent_at` is on the
          wire, and a merchant's contact-form reply shows Sending, Sent, or
          Not sent yet (still unsent after two minutes), polling the open
          thread until the worker stamps it. Only that bubble shows a state,
          because null is not "unsent" on a message no queue carried. Left:
          bounce and complaint webhooks, which need an endpoint registered in
          the email provider's console with its secret in the EMAIL
          integration row, a signed public route, and a column for the outcome
          on `direct_messages` (a migration).
    - [~] **Recipient suppression and an abuse link** in contact-reply emails
          (the platform domain also carries OTP mail).
          Abuse line done 2026-10-04: a contact-reply email's footer carries a
          "report this email" line, a mailto to `MAIL_ABUSE_ADDRESS` naming
          the reply's id (the one in its `Message-ID` and its audit row). The
          variable has no default, so the line is omitted until it is set.
          Left: suppression. The repo has no recipient-suppression concept; it
          needs a table keyed on the canonical-mailbox digest (a migration), a
          check in `ContactFormReplyService.authorize`, and writers.
    - [ ] **Set `MAIL_ABUSE_ADDRESS` to a monitored mailbox (`OPS`,
          production-only).** The report line stays hidden until then.
    - [x] **`NotificationsService.senderFor`'s verified-From branch** sends From
          the merchant's own domain, which Resend/SNDR likely refuse for an
          unlinked domain (403 `domain_not_linked`). Drop it or require a
          provider-verified domain.
          Done 2026-10-02: the branch is dropped. `sender_verified` proves a
          click in a mailbox, not a provider-linked domain, so `senderFor`
          returns a Reply-To only and every customer email leaves from the
          platform address. `MailService.sendRendered` takes no `from`, and
          the worker ignores one on a job queued before the change. The
          Sender-email card and the verify page now say where replies land.
    - [ ] **Provider-verified sending domains per shop (`BE`).** DNS/DKIM
          records and a verified flag, if sending as the merchant is ever
          wanted. Until then `senderFor` is Reply-To only by design.
    - [x] **Rename the Sender-email card (`VEN`).** It now means Reply-To; the
          copy was reworded and the title was not.
          Done 2026-10-05: the card title is "Reply-to address" / "عنوان الرد".
    - [ ] **Production delivery needs a verified Resend sending domain (T0-6)
          and `ALLOW_SANDBOX_EMAIL_SENDER` unset (T0-7).** Until then the
          sandbox pre-check refuses a contact reply with `SERVICE_UNAVAILABLE`.
    - [x] **Contact-form threads still offer "Stop AI replies", and Telegram
          threads are labelled "via WhatsApp"** in the inbox.
          Done 2026-10-02: the inbox hides Stop/Resume AI replies and the
          blocked chip on contact-form threads, and labels Telegram threads
          "via Telegram" (`whatsappInbox.thread.viaTelegram`, en and ar).
    - [x] **A double click sends two emails (`BE` + `VEN`).** Each
          `replyToWhatsAppThread` call records a new message, so two clicks are
          two jobs and two emails, each spending the ceilings; and a stalled job
          re-run after SMTP accepted the mail but before `sent_at` is stamped
          sends it again (SNDR de-duplicates on the Message-ID, plain SMTP does
          not). An idempotency key on the input, or claim `sent_at` before the
          send. The WhatsApp path has the same shape.
          Done 2026-10-02 for the email, and decided 2026-10-04 for the chats.
          A double click is one reply on every channel: `InboxReplyDedupe`
          claims a digest of the text per thread for 60 seconds before
          anything is recorded (released on a refusal, fail-open), the email
          worker claims `sent_at` before the send and releases it on a
          transport refusal, and both reply boxes guard with a synchronous
          ref. Claim-before-send was evaluated for the WhatsApp and Telegram
          workers and rejected: `sent_at` on a chat message gates
          `awaitingConfirmation`, so a worker that died mid-send would leave
          an unsent order summary confirmable and skipped by its own re-run.
          Those queues deliver at least once on purpose, and neither provider
          takes an idempotency key. Written into both `markSent` comments and
          pinned by four specs.
    - [x] **The display name can impersonate (`BE`).** "<shop> via Zaydak" uses
          the merchant-written shop name, so a shop named "Zaydak Security", or
          one carrying an email address, mails from the platform domain. Strip
          `@` / angle brackets and refuse the platform's own brand in it; and the
          per-recipient ceiling keys on the lower-cased address only, so
          plus-tags and Gmail dots each get a fresh 10/day.
          Done 2026-10-02: the From name, subject and body use
          `contactReplySender`, which strips address-like and invisible
          characters and refuses the platform's brand in any spelling
          (lookalike letters, spacing, Arabic variants); the handle, then "A
          shop", stands in. The per-recipient ceiling counts
          `canonicalMailbox`: plus-tags folded, Gmail dots removed.
- [x] **Partial unique index for `CONTACT_FORM` threads (`T4` · `BE`)**  
      `2026-09-15-contact-form-thread-unique.sql`. It does more than the index,
      and deliberately: a bare `CREATE UNIQUE INDEX` against already-raced data
      aborts the file, so it **merges split threads first** — keeping the oldest
      row, which is the one the lookup's `orderBy: created_at asc` already
      converges on, moving messages rather than deleting them, and breaking ties
      on `id` so the survivor is the same row on every run.
      `CONCURRENTLY` is unavailable here: `apply-manual-migrations.cjs` sends
      each file as one multi-statement query, which Postgres runs in an implicit
      transaction.
      Verified against the local database three times — clean, re-run (no-op),
      and against a manufactured split, which it merged (1 message moved, 1
      thread retired) before a third insert of the same address was refused by
      the constraint.

### Imported-media publish gate (2026-09-14)

The first piece of the store-import plan to land in code, and deliberately the
first: without it P1 is a trap. A product may not go live while it holds a
**non-terminal** `store_import_media` row — the presence of a pending row, never
the absence of a terminal one, because the artifact pruner deletes media rows
after 60 days and an absence-based gate would be lifted by it silently. "In
transfer" blocks and "transfer failed" does not, so one image the source CDN
404s cannot freeze two thousand good products. It lives in
`back-end/src/products/publish-gate/` as stateless functions over a Prisma
client (so a caller can pass a `tx`), and it is called from the **writer** —
`ProductsService.update`, `bulkUpdateStatus` and the `APPLY_SCHEDULED_PUBLISH`
worker — because three of the four ways a product reaches PUBLISH have no screen
to guard. `UNLISTED` is gated alongside `PUBLISH`: it resolves by slug and sells
through the cart. The bulk action and the cron partition rather than refuse.

- [x] **Surface the held products in the bulk action (`BE · products` · `VEN`)**
      Retired with the publish gate (2026-09-15); see `store-import/media/media-status.ts`.
      Products are no longer held from status updates while images transfer.
- [x] **Name the remaining images in the refusal (`BE · products` · `VEN`)**
      Retired with the publish gate (2026-09-15); see `store-import/media/media-status.ts`.

### Store import — "AI Store Migration" (2026-09-14)

Plan written, nothing built: [docs/future-features/store-import-migration.md](docs/future-features/store-import-migration.md).
A merchant hands us their old store's URL and we fill their catalogue, instead of
them typing 327 products in by hand. The entry point already exists and already
says it is empty — `import-products-dialog.tsx:239-241` carries a `"platform"`
radio whose helper text is literally "Not yet implemented."

The whole plan rests on one decision: **the scrape writes a canonical CSV, not
products**. `importFromCsv` is untouched and runs on it, so the uploaded-file
path and the scanned-store path end at the identical `CsvImportResult` and no
second product writer is ever born. It also hands the merchant a real escape
hatch — download the CSV the scan produced, fix three prices in Excel, re-upload.

ScrapingBee is the *last* connector, not the first: a Shopify store serves
`/products.json` publicly and free, with variants and images, which is both
cheaper and more accurate than reading its HTML. Two things are more dangerous
than the extraction itself — the ~1,284 image fetches to hosts someone else
chose (`remote-image.guard.ts` exists for exactly this and must not be bypassed),
and the fact that no code can prove the merchant owns the source store, which is
why §15 is an attestation plus an audit row plus a rate limit with a named
escalation path rather than a pretence.

A review added the one thing the first draft was missing, and it is the piece
that cannot be retrofitted: **external product identity between imports** (§6).
Matching on slug — all `importFromCsv` can do today — breaks the moment the
merchant renames a product, and then a re-scan builds a second copy of
everything it touched. A separate `store_import_product_map` keyed
`(shop, source_host, external_id)` resolves it *before* the CSV is built and
writes the existing product id into the `id` column the importer already reads,
so identity costs the write path nothing. Hence the split: **writing the map is
P1, reading it is P1.5** — a catalogue imported without recorded identity is one
whose identity cannot be reconstructed afterwards. `CsvImportRowResult` already
carries the `product_id` that join needs (`products-csv.service.ts:42`, set at
`:973` and `:888`), with one trap: on a dry run a `create` row leaves it
`undefined`, so building the map from a dry-run report records nothing and
errors on nothing.

A second pass caught an internal contradiction that made P1 a trap on its own:
decision 3.4 forbids publishing before images are transferred, but the phase
table deferred the publish gate to P2 while P1 already wrote products — so
nothing stopped a merchant pressing Publish from the ordinary product screen.
The gate moves into P1 and lives in the service, not the screen, because
`APPLY_SCHEDULED_PUBLISH` flips status inside a worker where no UI guard exists.
Same pass: the Shopify connector became a strategy chain (`products.json` is
undocumented and cannot be the contract), and `source_host` became the resolved
final host rather than a blind `www` strip.

A third pass closed two defects that each broke a guarantee the second pass had
just added. **The pruner silently lifted the publish gate after 60 days** — the
gate is the *absence* of a PENDING media row and the pruner deletes rows — so it
now never touches a non-terminal row, with a `REAP_STALE_IMPORT_MEDIA` sweep so
"never pruned" does not become "blocked forever". The general rule is worth
keeping: never build a safety gate on the absence of a row something is allowed
to delete. And **the product write and the identity write were two operations**
with a crash window between them producing exactly the catalogue-without-identity
that 3.8 forbids; they now share `importFromCsv`'s own transaction (`:482`) via a
hook that accumulates and flushes once, because a per-row upsert × 5000 would eat
the 60s transaction budget. P1 is an internal milestone — **P1 + P2 is the first
merchant-ready release**, since P1 alone leaves every product an unpublishable
draft.

**P0 shipped on 2026-09-14, and three things about it are worth keeping.** The
plan filed `catalog.store_import` as a `LIMIT` with a `billingUnit` of
`import`; the repo won on both. A LIMIT counts rows that exist right now, which
is right for "how many products may the store hold" and wrong for "how many
migrations a month" — nothing is left behind to count, and a merchant who
deleted last month's imports would get the allowance back. It is a `QUOTA` on a
`MONTH` period, which is also the only kind `EntitlementsService.reserve()` will
serve, and reserve-then-settle is what §13 asked for. And `import` is not a
`BillingUnit`: that enum is Prisma's, crosses GraphQL into all three consoles,
and a new value would cost a schema change and three codegen runs to mean what
`request` already means — one metered run whose count is known before it starts.

The module ships with **no resolver**, deliberately. A mutation now would give a
merchant a button that creates rows nothing can advance. The one service method
checks the attestation *before* the URL — an unattested request must not even
cause a DNS lookup against somebody else's hostname — then runs `source_url`
through `assertPublicHttpUrl` before storing it, writes a QUEUED row and a
sensitive `AuditLog` entry, and stops. `STORE_IMPORT_URL_BLOCKED` says nothing
about the network on purpose: "resolves to 10.0.0.5" would make the field a port
scanner whose answers are readable.

The migration is **written and not applied** — `apply-manual-migrations.cjs`
refuses non-loopback hosts by design and there was no database to hand. The three
tables are Prisma models, so unlike the AI-search tables they must *not* be added
to `tables.external` in `prisma.config.ts`: that list exists to keep `db push`
away from tables Prisma does not model, and listing one it does model would
exclude it from the push meant to maintain it.

- [x] **Apply `2026-09-14-store-import-tables.sql` to the deployed database (`BE · store-import` · `INFRA`)**
      **This item dissolved on inspection, and the correction is worth keeping.**
      Every object in it and in its follow-up
      (`2026-09-14-store-import-decisions.sql`) is declared in `schema.prisma`,
      and the deployed build runs `npm run db:deploy`, which is `prisma db push`
      — so the next deploy creates all of it. Checked the files for the things
      `db push` cannot express: no partial index, no CHECK, no trigger.
      The precondition that makes that safe is already true and must stay true:
      the three tables are **not** in `tables.external` in `prisma.config.ts`.
      That list keeps `db push` away from tables Prisma does not model; naming
      one it *does* model excludes it from the push meant to maintain it, and
      Prisma's data-loss guard keys on the table being non-empty — so a deploy
      shortly after the table fills would drop it silently and go green.
      Applied and verified against the local Docker database on 2026-09-14,
      twice, to prove idempotency: three tables, `IntegrationType.SCRAPING`, all
      four decision columns, `DirectChannel.CONTACT_FORM`. Also corrected: there
      is **no override flag** on `apply-manual-migrations.cjs` — it refuses any
      non-loopback host outright. Applying early is a deliberate `psql -f`;
      [docs/runbooks/ai-integrations-console.md](docs/runbooks/ai-integrations-console.md)
      has it.
- [x] **Enforce `catalog.store_import` (`BE · store-import` · `BE · plans`)**
      Reserved at scan start, settled at a terminal status, released on
      FAILED/CANCELLED — the same reserve-then-settle shape image generation
      uses. The handle is stored whole on `StoreImportJob.reservation` so a
      **retry reuses the original booking**: BASIC's allowance is exactly one
      import a month, so a retry that booked again would let a single failure of
      ours consume a merchant's entire month. Only a new `source_url` books a
      new unit.
- [x] **Abuse signals on the import surface (`BE · store-import` · `SEC`)**
      `StoreImportService.create` consumes three `KeyedRateLimiterService`
      ceilings — per shop hourly (5), per shop daily (20), per `source_host`
      daily (10, across every shop) — all `failClosed`, the only limiter in the
      repo that is, because there is no Postgres floor behind it and the work it
      admits is our server fetching a stranger's site. Order is attestation →
      ceiling → SSRF, so a refused request causes no DNS lookup. A refusal is
      audited (`ACCESS`, `refused: true`, reason + ceiling in `new_values`,
      `is_sensitive`) alongside the accept path.
- [x] **P1 — Shopify connector end to end, no ScrapingBee (`BE · store-import` · `VEN`)**
      Shipped whole: the strategy chain (`products.json` fast path, then sitemap
      + the documented `/products/{handle}.js`), the canonical CSV, the untouched
      `importFromCsv`, the `STORE_IMPORT` queue, the URL step and the
      `/products/import/[jobId]` progress route.
      The seam that made it possible without a second product writer is
      `importFromCsv`'s new `onProductWritten` / `beforeCommit` pair, both called
      **inside its own transaction** — so "a product with no identity row" is
      unreachable rather than merely unlikely, which is the one state §3.8 says
      cannot be reconstructed afterwards.
      Two decisions landed with it (2026-09-14), and the currency one was
      tightened on 2026-09-17. A **known currency mismatch refuses the whole
      import** with no acknowledgement path: `importFromCsv` takes cents with no
      currency argument and never reads `Shop.currency`, so a USD `4599` would
      otherwise land as `4599` SAR. `source_currency` is still recorded so the
      preview can name both currencies; `currency_ack` remains as an unused
      database column. A catalogue over the importer's row ceiling is
      **committed in batches**, each its own transaction — that relaxes "the
      whole catalogue or none", which nothing was built on, and leaves the
      identity invariant untouched because the hook runs inside *each* batch.
- [x] **P1.5 — re-import identity, retention, failure recovery (`BE · store-import`)**
      The back-end half is in: `resolveIdentities` runs on the scan path and
      writes a matched product's id into the CSV's own `id` column;
      `reportMissingFromSource` records what the source no longer carries and
      **nothing acts on it** (no delete, no soft delete, no mutation that takes
      the list); `missing_from_source` / `matched_products` / `new_products` are
      on `storeImportJob`; and both sweeps run on `TOKEN_CLEANUP`
      (`PRUNE_STORE_IMPORT_ARTIFACTS` nightly 04:50, never touching a
      non-terminal media row at any age; `REAP_STALE_IMPORT_MEDIA` hourly :40,
      the counterweight that stops "never pruned" becoming "blocked forever").
  - [x] The vendor re-import screen — shipped with the progress route. The
        missing-from-source panel carries **no interactive element at all**: no
        delete, no bulk action, no checkbox. Rows link to the product so a
        merchant who agrees acts with the product in front of them. Two tests
        pin the absence, because a half-failed scan followed by deleting what it
        "did not find" is the one way to make this worse than manual entry.
  - [x] Failure recovery beyond the reaper: `storeImportMediaIssues`,
        `retryStoreImportMedia` and `skipStoreImportMedia` (landed with P2).
  - [x] `images_transferred` is now maintained by the transfer worker; all three
        counters move, and the screen renders them separately because "in
        transfer" is not "failed".
- [x] **P2 — image transfer (`BE · store-import`)**
      The `TRANSFER_IMPORT_IMAGES` worker pulls each PENDING row through
      `AttachmentsService.uploadFromUrl` — so `remote-image.guard` still sees
      every one of the ~1,284 fetches to hosts somebody else chose — repoints the
      product's media JSON to our storage, and moves the three counters.
      It blocks on PENDING **only**: a failure ends that row, never the job,
      because a job-level gate would freeze 2,000 good products behind one image
      the source CDN 404s. Storage quota is checked *before* the pull rather than
      after, and the `@@unique([job_id, product_id, source_url])` index is what
      makes a re-run idempotent instead of doubling a gallery.
      `storeImportMediaIssues` / `retryStoreImportMedia` / `skipStoreImportMedia`
      are the merchant's three answers, and they exist because the gate lifts on
      a *terminal* state: a failed transfer stops blocking the product but leaves
      a gap in the gallery with nothing to explain it. This list is the
      explanation.
- [x] **P3 — ScrapingBee connector (`BE · integrations` · `ADM`)**
      Shipped 2026-09-17 (the 2026-09-15 kill-switch note was stale).
      `StoreImportModule` imports `IntegrationsModule` and provides
      `ScrapingCredentialsService`. `scanJob` sets `providerAvailable` from
      `isAvailable()`, which is false with no key, with the `off` provider, or
      when `monthly_credit_cap` is exhausted (`getMonthlyCreditsSpent` against
      `store_import_jobs.provider_credits`). The scan report records
      `provider_available` so an empty scan says whether the paid floor was
      eligible. Local Docker and the super-admin `SCRAPING` row already hold
      keys; production console fill / rotation of a key that was pasted in a
      chat is still owner work, not a missing connector.
      The original entry, still accurate about what was built:
      **Half of this item had already shipped and the entry did not say so:**
      `IntegrationType.SCRAPING`, the full provider spec, the `off` provider,
      `SUPPORTED_TYPES` and the admin console's `nav.ts` were all in place. What
      was missing was only the connector, and that is what landed — JSON-LD
      extractor first and `extract_rules` second, resolved per call through
      `ScrapingCredentialsService` so a rotated key applies on the next scan
      rather than the next deploy.
      The strategy sets `requiresProvider`, so the chain **skips** it when the
      provider is off rather than failing the scan: the free strategies above it
      may well have been enough. Credits are recorded in the provider's own unit
      with a `pricing_snapshot` taken at execution time, and cents are derived —
      so an old job can still be explained later (was it expensive because the
      store was large, or because the rate went up?).
- [x] **P4 — AI normalization pass (`BE · ai`)**
      Category, tags and translation over the existing `AutoCategorizeService`,
      on the existing `ai.text.translate` key with **no new entitlement key**,
      holding the enrichment rule: it fills a blank and never overwrites what the
      page actually said.
      It also closed a hole that predates it. `AutoCategorizeService` was
      completely unmetered with no platform ceiling at all, so a 1,000-product
      import fired 1,000 model calls with nothing bounding them. Decision
      (2026-09-14): it stays **free to the merchant on every plan** —
      categorising fills a field in *our* schema, and charging for it penalises a
      merchant for making our search work — but it now runs behind
      `AiRateLimiterService`, keyed on the shop, so `AI_DAILY_BUDGET_USD`
      actually bounds it.
- [x] **P5 — Sidekick tools (`BE · vendor-agent`)**
      `scan_store`, `get_store_import`, `commit_store_import`. `scan_store`
      returns a job id immediately rather than awaiting a scan that runs for
      minutes against a 20s tool deadline; `commit_store_import` joins
      `GATED_TOOLS` **and** `DRY_RUNNABLE`, so its approval card quotes real
      numbers from an actual dry run instead of an estimate; and the two writes
      stay off the chat channels by omission, which is what keeps "nothing writes
      on a chat channel without a runtime-enforced confirmation" true.
- [x] **P6 — WooCommerce connector (`BE · store-import`)**
      Store API (`/wp-json/wc/store/v1/products`), which reads products
      **publicly with no credentials at all** — which is exactly why this one
      could ship today and the other two could not.
      The trap is handled structurally rather than by care: the `products`
      endpoint **excludes variations by default**, so the strategy makes an
      unconditional second pass with `type=variation`. Missing it yields a
      perfectly correct product count and a short SKU count — a defect that
      surfaces only after the merchant has been selling, because nothing about it
      looks wrong.
  - [ ] **Salla and Zid (`BE · store-import` · `INFRA`)**
        Deferred deliberately (2026-09-14), and not for effort: each needs an
        **OAuth application registered with the platform under your account**,
        which is a credential and a review, not code. Building the OAuth layer
        before the applications exist ships something that cannot be exercised.
- [~] **ScrapingBee account + funding + key into the admin console (`INFRA`)**
      **The account exists and the key is live** (2026-09-15). Verified against
      the provider twice: `/usage` answers 200 with **1000 credits, 0 used,
      concurrency 5, renewing 2026-09-30**, and a real plain-page scrape answers
      200 with `Spb-cost: 1` — which is the exact header
      `scrapingbee.client.ts` reads, so the credit accounting is measured rather
      than assumed.
      The key is in the gitignored `back-end/.env` and `.env.development` only,
      with `SCRAPINGBEE_MONTHLY_CAP=1000` beside it; the variables are
      documented (valueless) in the tracked `.env.example`.
      **The free tier is the thing to plan around: 1000 credits a month.** A
      plain page costs 1 and a JavaScript-rendered one costs 5, and the paid
      strategy renders — so this account is about **200 rendered pages a
      month**. A 327-product store read page-by-page would need ~1,635 and stop
      a fifth of the way in. It is ample for single-product imports and for
      proving the path; a whole-catalogue scrape of a JS-rendered store needs a
      paid plan.
  - [ ] Put the key in the **admin console** (Integrations → Scraping) for
        production rather than leaving it on the environment: the console row is
        AES-256-GCM encrypted and resolved per call, so rotating it applies on
        the next scan instead of the next deploy. Set the monthly cap there too.
  - [ ] **Rotate this key.** It was pasted into a chat transcript on
        2026-09-15, so treat it as disclosed. It is a trial key with a 1000-credit
        ceiling, so the exposure is bounded — but rotate before it is funded.
- [x] **A cancel during NORMALIZING is overwritten by READY (`BE · store-import` · T3)**
      `scanJob` writes READY with a plain `update({ where: { id } })`, while every
      earlier transition goes through the compare-and-set in `advance()`. A cancel
      that lands during the AI enrichment pass therefore flips back to READY, with
      its quota reservation already released, and the merchant can commit it. Make
      the READY write an `updateMany` matching `NORMALIZING` and treat zero rows as
      `STORE_IMPORT_INVALID_STATE`. Found while writing
      `docs/store-import-scraping-laravel.md` (2026-09-30).
      Done 2026-10-01: the READY write is an `updateMany` matching
      `NORMALIZING`; a miss throws `STORE_IMPORT_INVALID_STATE`, `failJob`
      leaves the CANCELLED row alone and the processor does not retry. A twin
      delivery (a stalled lock) that finds the row already READY keeps that
      file instead of failing a good scan. A sibling closed in the same
      change: a cancel landing between the scan's load and its booking found
      no handle to release, and the unit the scan then booked stayed
      reserved for the period; the scan's catch now refunds it
      (`settleIfCancelled`; a second release is rolled back by the ledger's
      unique `handle_id`). Pinned by `store-import-cancel-race.spec.ts`,
      which fails three cases with the old write.
  - [x] **A Stop during IMPORTING is overwritten by DONE (`BE · store-import`).**
        The commit loop never re-checks status and the DONE write is a plain
        update, so every remaining batch lands; `cancel` settles from a stale
        `committed_rows` read, so a Stop during the first batch makes the
        whole import free. Make the per-batch and DONE writes compare-and-set
        on IMPORTING, stop on a miss, and settle a job cancelled while
        importing as `commit` from the worker rather than from `cancel`.
        Done 2026-10-01: each batch's `committed_rows` write and the DONE
        write are `updateMany` matching IMPORTING, and a miss stops the
        commit; the batch already in the importer lands, nothing after it
        does. `cancel` no longer settles a live commit: the worker's
        `stopCommit` records how far it got on the CANCELLED row, recomputes
        `in_stock`, settles as `commit` once any row landed and queues the
        image transfer for what landed. `cancel` itself settles only a commit
        untouched past `COMMIT_STALE_MS`.
        `store-import-commit-cancel.spec.ts`.
        2026-10-04: one more guarded write before the first batch, so a Stop
        pressed between the commit claim and the first batch writes nothing
        and the worker releases the unit.
  - [x] **The batch in flight still lands on a Stop (`BE · store-import`).**
        Its transaction never reads the job. Locking the job row inside the
        batch's transaction would let a Stop roll it back.
        Done 2026-10-04: each batch's transaction ends by locking the job row
        (`SELECT … FOR NO KEY UPDATE`; `FOR UPDATE` would conflict with the
        key-share its own media rows hold) and reading its status. A Stop that
        got there first rolls the batch back whole, and one that arrives later
        waits for the commit, so what landed is exactly what committed.
        `commitJob`'s catch also settles a cancelled commit whose batch failed
        on its own, which nobody settled before. Pinned with mocks in
        `store-import-commit-cancel.spec.ts`.
  - [x] **A two-connection Postgres test for the commit lock (`BE ·
        store-import`),** modelled on
        `test/concurrency/store-import-override-lock.e2e-spec.ts`: a cancel
        before the lock, a cancel after it, and a save during a batch.
        Done 2026-10-05: `test/concurrency/store-import-commit-lock.e2e-spec.ts`
        runs those three on two real connections. A Stop before the lock marks
        the job cancelled, which the lock then reads. A Stop that arrives while
        `FOR NO KEY UPDATE` is held waits, then cancels. A save waits on that
        same lock and writes once it commits; the row stays READY so the save
        reaches the lock, because an IMPORTING row is refused before it.
  - [x] **The AI pass keeps spending after a Stop (`BE · store-import`).**
        `enrich` only sees the in-process abort signal, so a cancelled scan's
        categorise/translate calls run to the end. Poll the job status between
        batches.
        Done 2026-10-01: `enrich` takes a `stopped` poll from `scanJob` that
        reads the job row, checked after the abort signal before every
        categorise and translate batch.
  - [x] **`previewCommit`'s report write is unguarded (`BE · store-import`).**
        It writes `report` from a read taken before a dry run that can take
        seconds; a commit that finishes in between loses `report.commit`.
        Guard it with `updateMany` on READY and ignore a miss.
        Done 2026-10-01: the `report.preview` write is an `updateMany`
        matching READY and a miss is ignored, so a commit that finishes during
        the dry run keeps `report.commit`.

### The chat panel's mentions moved into the text (2026-09-13)

The slide-in AI panel's `@`-mention composer was rebuilt on the inline model: a
picked entity stays in the draft as `@Display`, painted by a transparent-text
backdrop mirrored behind the real textarea, and the picker opens at the "@"
being typed instead of stretched across the composer. The full-page chat at
`/ai` keeps the chip model untouched — none of the five shared mention modules
were edited, and the new hook, picker and input are panel-only files.

The move is not cosmetic: with chips, the picked list was the truth and
`serializeMentions` read it directly; inline, the **text** is the truth, so the
`[Referenced: …]` tail is rebuilt by scanning the draft on every send. A token
deleted with Backspace is then simply absent, with nothing tracking the
deletion. Nothing server-side changed — the back-end has no parser for that
tail at all, only prompt prose, and the shape it emits is unchanged.

Two things were only visible once the model flipped. The sent bubble renders
the stripped text and then every tail entry as a pill, so an inline token would
have shown the product name twice and the highlight would have vanished on
send; `splitBubbleMentions` highlights what it finds in the text and pills only
the rest, which also keeps every turn persisted before this change rendering
correctly. And the token boundary could not be the reference implementation's
`(?=$|[^\w])` — JavaScript's `\w` is ASCII-only, so it matches `@هودي` inside
`@هوديات`.

Three follow-up defects, all reported from the coupon flow and all one cause:
the picker was only ever re-derived from a `change` event. Nothing dismissed it
on click-away, so it stayed parked on a drilled-in category; the `+` menu's
**Mention** item then ran through the typing path, which keeps the drilled-in
level on purpose, wrote an `@` and changed no state the popup renders from — so
it looked dead until an edit reset it. It is now `openAtCaret`, a command that
always reopens at the root, plus the reference component's `onClick`/`onKeyUp`
re-detection and a delayed blur close. Separately, `use-mention-search` was
sending each category's first request with the *previous* query still in its
180ms debounce, and the back-end matches a coupon `search` against the code
alone — so a shop full of coupons showed "No matches".

Adding the re-detection then surfaced a fourth: clicking a mention that was
already resolved reopened the *category* menu, because the re-detect ran the
typing path and that resets to the root whenever the picker was shut. A caret
inside `@SALE20` is not a vendor choosing a kind — it is one who wants the
coupon list, to swap it. `mentionSpanAt` tells the two apart and carries the
token's span, so the swap replaces the whole token instead of the half before
the caret.

- [x] **Walk the composer in a real browser, RTL included (`T3` · `VEN` · `UI`)**  
      Done as a committed Playwright suite (`e2e/`), run against a real Chromium
      against the local stack — all four cases green, four times over.
      The measurement is the part worth keeping. A `<textarea>`'s text is not in
      the DOM, so there is no text node to put a `Range` around. The obvious
      workaround — build a third mirror from the computed style — only proves
      that two mirrors agree, which is the very thing in question. Instead the
      suite uses `document.caretPositionFromPoint`, which over a text control
      answers with a **character offset into the real value**: sample points
      across the backdrop highlight, ask which character of the actual textarea
      is under each, and require every answer to fall inside that token. No
      model, and it stays true under `rtl`, across a wrap, and after a scroll.
      It was then **sabotaged on purpose** to prove the assertions can fail —
      including the case only the caret sampling catches: shifting the tint runs
      alone, leaving the backdrop's box and every computed style identical.
      Runs on demand, deliberately not in CI: it needs a seeded database where
      the test vendor owns a shop with products. `e2e/README.md` says how.

### The agent reports progress from inside a tool (2026-09-12)

A tool was a black box between `tool_start` and `tool_result`, which is worst
exactly where it matters — the CSV import and the 1000-product price update carry
a 60-second timeout against a 20-second default. No transport work was needed and
no websocket server was added: the agent already streams over REST + SSE with a
generic serializer, the browser parser is equally generic, and LangGraph's
custom-writer channel was already wired end to end.

The frame carries a `call_id`, which is the load-bearing detail. The hook had been
re-finding a pending tool by "name with a null result", so two concurrent calls to
the same tool would have collided. `call_id` is required on `tool_progress` and
optional on `tool_start`/`tool_result`, so a turn replayed by an older back-end
still matches by name.

Deliberately silent in two places: the approval preview emits nothing, because a
progress bar for a call the vendor has not yet approved is a lie about what is
happening; and progress is never persisted, so a reloaded conversation shows none —
every row in it is already finished.

- [x] **Arabic typography canvas overlay (`T3-17` · `BE · ai/image`)**  
      Shipped 2026-09-14 — see the entry at the top of this section.
- [ ] **Production Replicate webhook URL configuration (`T2-4` · `INFRA` · `BE · ai/image`)**  
      **Both halves of this had moved on and the entry did not say so.** The
      value is no longer an environment variable: it is a field on the `AI_MEDIA`
      integration row in the admin console (`webhook_base_url` +
      `webhook_secret`), with the env vars left only as `envFallback` for a
      deployment configured before the screen existed. And the signature
      verification it asks for **already ships and is tested** — the Replicate
      strategy verifies an svix `webhook-signature`, pinned by
      `replicate.strategy.spec.ts`. So the remaining work is filling in two
      fields on a screen that exists; steps in
      [docs/runbooks/ai-integrations-console.md](docs/runbooks/ai-integrations-console.md).
- [x] **Enable output image moderation (`T2-5` · `BE · ai/image`) — NOT ENABLED, by decision**  
      **"Configure threshold" rests on something that does not exist**, and
      inventing it would have been the wrong fix. `ImageModerationService.classify`
      returns `{ safe: boolean, reason?, degraded }` — no score, no number, and
      the flag is a plain boolean. What *does* exist and is correct is the
      posture table in the service's docblock: a product shot whose classifier
      call failed is kept (the image is paid for and prompt moderation already
      ran), an `on_model` shot in the same state is dropped.
      What shipped instead is the thing that was actually missing: a repeatable
      harness (`npm run eval:image-moderation`) that runs the real classifier
      over a labelled folder and prints a confusion table, dry by default and
      printing its call count before it spends anything.
      The bar is in its exit code and the asymmetry is deliberate: **zero false
      positives on the known-safe set.** A false positive destroys an image the
      merchant paid to generate; a false negative is caught by the first net,
      since this is explicitly the second one.
      **Decided against, 2026-09-15: output-side image moderation stays OFF.**
      The owner does not want an OpenRouter vision call judging generated
      images. So `AI_IMAGE_OUTPUT_MODERATION_ENABLED` is not being enabled, no
      `OPENROUTER_API_KEY` is being configured for it, and the eval is not being
      run. Nothing regresses by leaving it: the flag already defaults to off,
      prompt-side moderation — the FIRST net, which shapes the request before a
      provider is ever called — is untouched and still runs.
      The harness stays committed rather than being deleted, because it costs
      nothing switched off and it is the thing that makes reversing this a
      morning's work rather than a rebuild. The one consequence worth
      remembering: `AI_IMAGE_ON_MODEL_ENABLED`, the shot whose output contains a
      person, names output moderation as its stated precondition — so that flag
      stays off too while this one does.
      Imported images are a separate question and are unaffected: nothing in the
      store-import path moderates or rewrites them. `AttachmentsService` has no
      AI dependency at all — `uploadFromUrl` is `fetchRemoteImage` plus
      `ingestBytes`, so an imported image is stored byte-for-byte with a
      thumbnail beside it and no classifier in the way.
  - [ ] If it is ever wanted: `npm run eval:image-moderation` needs
        `OPENROUTER_API_KEY` and 20–40 boundary-heavy real product photos
        (deliberately not committed — licensing, repo weight). Green run first,
        then the flag. Left as a box rather than deleted so the route back is
        written down.
- [x] **Anonymous merchant contact form (`T4` · `BE · conversations` · `STORE`)**  
      Back-end shipped 2026-09-15 — see the entry at the top of this section. The
      storefront half is the open box there.
- [x] **WhatsApp & Telegram dual-channel stability (`T4-50` · `BE · messaging`)**  
      **This entry read as though something were unbuilt. Nothing was.** Evolution
      v2.3.7 runs, per-shop webhook registration at pairing works, and each shop's
      Telegram bot works. The real defect was narrower and worse: **Telegram order
      notifications had almost no addressable audience.** Nothing bound a customer
      to a shop's bot except as a by-product of the AI cart-claim flow — so a
      merchant who switched `telegram_enabled` on saw "success" and delivered to
      zero people, forever, with no signal anywhere.
      Three pieces closed it. A `t.me/<shop bot>?start=<token>` **opt-in deep
      link** on the order-confirmation page and the account area, over a
      single-use Redis `GETDEL` token in its own keyspace — that is the one that
      makes "finalize the secondary channel" mean something. A **reconciliation
      sweep** that asks Evolution what it actually thinks of the sessions we call
      live, on its own queue (a second `@Processor` on an existing queue is a
      second *worker* competing for its jobs, which would have silently starved
      the retention sweeps), marking and notifying rather than auto-reconnecting,
      since Baileys cannot reconnect without a rescan. And a **rate limiter on
      `WHATSAPP_SEND`**, which had none while `TELEGRAM_SEND` did, against a
      shared Evolution server that is a single point of failure for every shop on
      it.
      That also turns "under load" from an adjective into something measurable:
      there is now a number for how many sessions are dead.

---

## Platform & infrastructure

Focus: Secret hygiene, domain configuration, transactional delivery, and database alignment.

### Country Capability Profiles — Palestine launch (2026-10-07)

Platform `CountryProfile` rows gate create-store and checkout: `Shop.home_country`
is declared explicitly (not inferred from phone/IP). PS is enabled (ILS, COD +
bank transfer, merchant delivery, city codes); SA is seeded disabled. Effective
options are Allowed × Enabled via `CountryCapabilityService`. Shipping zones
carry `city_codes`; bank accounts validate by `bank_account_mode`.

- [x] **Foundation (`BE`).** `home_country`, `CountryProfile` enums/table, PS/SA seed, capability service.
- [x] **Create Store country picker (`VEN` + `BE`).** Enabled profiles only; `createShop` rejects disabled countries.
- [x] **Backend enforcement (`BE`).** Payments, delivery channels, OTO mode, checkout intersection.
- [x] **PS city registry + zone matcher (`BE` + `VEN`).** Stable codes; vendor city picker when `shipping_match=CITY`.
- [x] **FREEFORM bank accounts (`BE`).** Mode-aware validation; SAR IBAN path kept for SAUDI_IBAN.
- [x] **Admin UI to edit CountryProfiles (`ADM`/`BE`).** `/settings/country-profiles` toggles `enabled`; caps stay seed-managed.
- [x] **Storefront address `city_code` picker for PS (`SF`).** Checkout sends `city_code` from `palestineCities` when `home_country=PS`.
- [ ] **Enable SA CountryProfile when Saudi launch is ready (`BE`).** Flip `enabled` (admin toggle or seed) + verify OTO/IBAN paths.

### Credential forms submit as POST (2026-09-25)

Sign-in on dash.zaydak.com landed on
`/login?identifier=vendor@zaydak.com&password=…`. No form in the three apps
declared a `method`, so each was a GET form whose `onSubmit` only existed after
hydration; a click or Enter before that was a native submit into the query
string. All 24 credential forms (sign-in, OTP, reset, signup, change password,
claim cart) now carry `method="post"`, and a `no-restricted-syntax` rule in
`@repo/eslint-config/next` fails any `<form>` under `app/(auth)`,
`features/auth`, `features/signup` or `change-password` without it. A native
POST re-renders the page (checked on vendor `/login`: 200, clean URL).

- [ ] **Rotate the `vendor@zaydak.com` password (`SEC`)**  
      It went out in a URL on 2026-09-25, so it sits in Vercel's request logs
      and that browser's history and autocomplete.
- [ ] **Check that dash.zaydak.com's login hydrates promptly (`VEN`)**  
      The leak needed a submit before React attached. Slow hydration only
      costs a reload now; a page that never hydrates means sign-in is broken there.

### Vercel preview against a local Docker API (2026-09-17)

A Vercel frontend cannot reach `localhost:3000`. For a trial, ngrok exposes
the local Docker API and Preview `NEXT_PUBLIC_GRAPHQL_URL` points at that HTTPS
`/graphql`. The apps send `ngrok-skip-browser-warning` on GraphQL, REST and
`fetch` streams so the free interstitial is not parsed as a failed mutation.
Production still belongs on Render. Steps: [docs/vercel-local-api-ngrok.md](docs/vercel-local-api-ngrok.md).

- [ ] **Keep the tunnel URL on Vercel Preview only (`INFRA`)**  
      A free ngrok host dies on every agent restart and needs an env edit plus
      a redeploy. Production `NEXT_PUBLIC_GRAPHQL_URL` stays on the Render API.
- [ ] **Click through the ngrok warning once per browser for EventSource (`VEN`)**  
      The bell, WhatsApp QR and inbox use `EventSource`, which cannot send the
      skip header. Open the tunnel URL in that browser once, or those streams
      stay on the interstitial while GraphQL still works.

### Bunny Storage + CDN follow-ups (2026-09-17)

Production already selects `STORAGE_DRIVER=bunnycdn` (`BunnyStorage` behind
`StorageDriver`); docker/dev stays on `local` via `.env.development`. Vendor and
storefront allowlist `*.b-cdn.net` and `cdn.zaydak.com` for `next/image`.
Since 2026-09-23 the Bunny credentials can be saved in the admin console
(Integrations → Storage), where an enabled row beats `BUNNYCDN_*`;
`STORAGE_DRIVER` itself stays env-only.

- [ ] **Point the pull zone at `cdn.zaydak.com` (`INFRA`)**  
      Add the custom hostname in the Bunny pull-zone console, set DNS CNAME, then
      set Render `BUNNYCDN_PULL_ZONE=cdn.zaydak.com` (or the pull zone on
      Integrations → Storage, which beats the env var). New uploads bake that host;
      existing `*.b-cdn.net` rows keep working until rebased.
- [ ] **Migrate historical local / staging URLs (`INFRA` · `BE · attachments`)**  
      After objects are reachable under the new base, run
      `npm run rebase:urls -- --from <old> --to https://cdn.zaydak.com` (dry-run,
      then `--apply`). Moves no bytes — copy or sync objects into the storage zone
      first if they only exist under `./uploads` or an old zone.
- [x] **Admin Integrations → Storage (`ADM` · `BE · integrations`)**
      Add Bunny (and optionally S3) provider specs under `IntegrationType.STORAGE`
      so credentials can move out of Render env into `integration_configs`, matching
      SMS / email / AI. Env remains the fallback until then.
      Shipped 2026-09-23: a `bunnycdn` spec (storage zone, zone password as a
      secret, region, pull zone normalised to a bare hostname), a free verify
      that lists the zone root, and no Send test. `StorageCredentialsService`
      resolves the row per upload with `BUNNYCDN_*` as the fallback, and
      `StorageFactory.create()` is now async and rebuilds the Bunny driver when
      the resolved credentials change. The form warns that a new pull zone or
      storage zone affects only new uploads. A review found that an enabled row
      that cannot be decrypted fell back to the env zone silently; it now fails
      uploads closed rather than baking a URL for the wrong zone. The optional
      S3 spec was skipped; receipts still refuse public Bunny.
- [ ] **Deleting an object written before a `storage_zone` edit (`BE · attachments`)**
      After the zone is changed in the console, deleting or replacing an older
      attachment aims at the new zone and silently orphans the object in the old
      one. Record the zone per attachment, derive it from the URL host, or add an
      orphan sweep.
- [x] **Verify the pull-zone hostname too (`BE · integrations`)**
      Done 2026-09-25. After the zone listing passes, Bunny `verify()` sends
      `HEAD https://{pull_zone}/` through the shared SSRF guard (public
      addresses only, pinned socket, no redirects, 5s). Any status passes,
      since a storage-backed zone answers `/` with 404 or 403. It fails on no
      DNS, a private address, a refused connection or TLS handshake, a
      timeout, or Bunny's own "Domain suspended or not configured" reply. That
      reply is a `BunnyCDN` server with no `CDN-PullZone` header, and it is
      what a mistyped `*.b-cdn.net` name gets, because that domain resolves
      and handshakes for any name. Checked against live hosts first. Nothing
      else is fingerprinted, so a proxy in front of the pull zone still
      passes.
- [x] **Say when the saved row is not in use (`ADM` + `BE`)**
      On a server running `STORAGE_DRIVER=local`, Integrations → Storage still
      reads as configured.
      Closed 2026-09-28: `integrationStatus` gains `not_in_use_reason`
      (`STORAGE_DRIVER_LOCAL` / `STORAGE_DRIVER_S3`) for STORAGE while
      `STORAGE_DRIVER` is not `bunnycdn`, read through the factory's own
      `storageDriverInUse`, and the Storage screen says the server reads
      nothing saved there instead of showing the zone as in use.
- [ ] **Complete / harden `S3Storage` (`BE · attachments`)**  
      The driver exists for the same `StorageDriver` interface but is not the
      production path; flesh out only if a second region or private receipts need it
      (bank-transfer receipts already refuse public Bunny — see `RECEIPT_STORAGE_DRIVER`).

### Production readiness execution plan (2026-09-16)

[The Arabic production plan](docs/production-readiness/README.md) defines a
feature freeze, 12 ordered phases (P00–P11), acceptance and rollback evidence,
decision owners, and a mapping of all 458 capability rows in the readiness
report. The files describe future execution; no production gate is marked
passed by creating them. Existing area items remain here and link to their
phase tasks as work begins.

- [ ] `INFRA · T0` Execute and evidence the P00–P11 release gates, starting with scope/baseline and urgent security containment; track details in [the phase files](docs/production-readiness/README.md).

### A new capability is off in production until somebody remembers to seed it (2026-09-15)

`catalog.store_import` shipped and then denied on every tier with
`FEATURE_NOT_AVAILABLE` — twice in one day, once locally and once in production
after a deploy. The code was complete and correct each time: the capability was
in `feature-registry.ts` with per-tier grants, and `reserveForJob` was booking
against it. What was missing was rows.

The failure is nastier than "it denies", because `plans-admin.service.ts:230`
and `plans.service.ts:82` read the `features` **table**, not the registry. So an
unseeded capability produces three symptoms at once — it denies for every shop,
it is absent from the admin plan editor, and it is absent from the merchant's
pricing table — and none of the three points at a seed.

The deploy synced the schema (`db:deploy`) and the permissions
(`sync:permissions`) and nothing else, so entitlements were the one code-owned
registry with no automatic path into the database. `seed:plans` now runs beside
`sync:permissions` in `render.yaml`'s build command, where it belongs: it is the
same kind of thing, and it is idempotent and strictly additive without
`--force` — verified as a no-op on an already-seeded database (`0 created, 0
reset, 150 left as-is`, exit 0). `npm run seed` and `seed:taxonomy` stay one-time
and by hand; they are demo rows and a fixed taxonomy, not registries.

  - [ ] **Run `seed:plans` once on the already-deployed database (`INFRA`)**
        The build change fixes the next deploy, not the current row set. Until
        that deploy runs, `catalog.store_import` is still denying in production.
        `npm run check:drift` confirms it before and after — it reports schema,
        permissions and entitlements together and exits non-zero on any of them.
  - [x] **Put `check:drift` in CI, not only in the runbook (`INFRA`)**
        `.github/workflows/ci.yml` runs `npm run check:drift` after the seeds
        on the scratch Postgres service.
  - [x] **Two stale rows the drift check reports and nothing cleans up (`BE · plans`)**
        **Closed 2026-09-18.** Decisions were already in the manual SQL:
        deactivate `catalog.import_export` (keep history), drop
        `vendor_bot_links.code_hash` / `code_expires_at`. Both now ship as
        Prisma migrate `20260918010000_retire_stale_drift`. Drift also stops
        warning on *inactive* orphan features — that is the retirement path.

### Upstash ran out of daily requests, and one cron registration took the whole API with it (2026-09-14)

The deploy after the build was fixed got further and still failed, on
`No open ports detected`. Redis was the cause and it said so plainly, once the
message was found above the 400-line Lua dump BullMQ prints with it:

```
ReplyError: ERR max requests limit exceeded. Limit: 500000, Usage: 500004
```

Upstash's free plan caps a database at 500,000 requests a **month**, and past
the cap it fails **every** command — the log shows it rejecting bare `AUTH`. So this is
not a bug in anything the deploy carried; it is the plan's ceiling, and no code
change clears it.

What the code did with that is the part worth fixing. `CleanupScheduler`
registers fifteen schedules from `onModuleInit` with no `try`/`catch`, and Nest
aborts `app.init()` when a lifecycle hook rejects. `main.ts`'s
`unhandledRejection` handler logs without exiting, so the process stayed up,
never reached `app.listen()`, and Render spent four minutes scanning a port
nothing was ever going to bind. A rate-limited cache had taken GraphQL, REST
and the storefront's tenant lookup down with it.

All nineteen `upsertJobScheduler` calls across five classes now go through
`registerScheduler` (`src/queues/register-scheduler.ts`): logs, reports to
Sentry, continues. Per call rather than per hook, so one queue's fault cannot
swallow the fourteen registrations behind it. Five unit tests pin it, the
load-bearing one being that a rejection resolves rather than throws.

- [ ] **Move the Redis off the free plan (`INFRA` · `T0`)**  
      500K requests a month is the ceiling that took production down, and it
      is a *monthly* quota — there is no overnight reset to wait for, so this
      is the blocker on the API being up at all. Upstash pay-as-you-go removes
      the cap; Render Key Value is the alternative if the bill is better there.
      **Docker-as-prod `zaydak-redis` is not this box:** 2026-09-17 recreate
      proved `noeviction` + 512mb on the running local stack. Upstash was not
      touched.
The same shape was then swept for across the whole boot path. Two more live
boot-blockers came back, and both are fixed here:

- `SystemCategoriesService.onModuleInit` wraps its NOT NULL deadline check in
  a catch that re-throws *unconditionally* under `NODE_ENV=production`, so a
  pool timeout was indistinguishable from a real verdict. It is live rather
  than latent: the deadline (2026-05-06) has passed, so the count runs on
  every production boot — and because the pg pool is lazy behind the driver
  adapter, `$connect()` resolves even against an unreachable database, which
  makes this plausibly the boot's first real query and not shielded by any
  earlier fail-fast. The count now `.catch()`es to `null`; the deliberate
  "there are unclassified products" throw stays fatal.
- `ContentModerationService.onModuleInit` was a bare
  `await this.chat.isAvailable()` — a read of `integration_configs` through
  the resolver — whose entire purpose is to log one warning. It would take
  the API down to fail to announce that a side feature is off.

- [ ] **Decide what an unverifiable receipt bucket should do (`SEC` · `INFRA`)**  
      `PrivateReceiptStore.onModuleInit` awaits `GetPublicAccessBlockCommand`
      unguarded, then fails closed unless all four public-access blocks are
      on. Refusing to boot against a bucket *proven* public is right; refusing
      because S3 was briefly unreachable is the scheduler bug again, and the
      code cannot presently tell the two apart. Latent today —
      `RECEIPT_STORAGE_DRIVER` defaults to `db` and the blueprint never sets
      it — so this is a decision to make before that driver is switched on.
      Deliberately left alone in this change: it is a security posture, not an
      oversight.
- [ ] **Re-measure the daily command burn (`INFRA`)**  
      This is the first deploy where `CACHE_MANAGER` actually reaches Redis —
      before the `stores` fix it silently ran in-process, so every cache read
      and write in the repo is new traffic against that quota. Size the plan to
      the measured figure rather than to the old one — the burn that exhausted
      a month's allowance has not been characterised yet.

### The deploy failed on a dependency that was never installed (2026-09-14)

`nest build` stopped at `redis.module.ts:5 - TS2307: Cannot find module
'@keyv/redis'` on commit `20f2c66d` — the same commit that *adds* the package,
to both `back-end/package.json` and the committed lockfile. Nothing about the
diff is wrong. The build command Render actually ran is:

```
npx prisma generate && npm run build && npm run db:deploy && npm run sync:permissions
```

`render.yaml` and `back-end/docs/10_deployment/README.md` both start that line
with `npm ci --include=dev`. The live service does not, so it compiles new
source against whatever `node_modules` the 411MB build cache restores. Every
dependency added since that cache was written is absent, and the one that names
itself in the error is simply the first of them to be imported — so the failure
points at Redis and is about nothing but the missing install.

The same log prints `Using Node.js version 24.14.1 (default)`, which is the
second half of one finding: the blueprint's `NODE_VERSION: "20"` is not reaching
the service either. The service is dashboard-managed and has drifted from the
file that claims to define it, so the blueprint is currently documentation.

- [ ] Restore the install step on the `spark-backend` build command (Render →
      Settings → Build Command), or re-link the service to `render.yaml` so the
      blueprint is the single definition. (`INFRA` · `T0`)
- [ ] Pin the service to Node 20 (`NODE_VERSION`) to match the blueprint, or
      raise the blueprint to 24 if that is now intended. (`INFRA` · `T2`)

### The production boot log, read and answered (2026-09-12)

A Render boot log carried four complaints. Three were code, and two of those
were the same root cause wearing different hats.

**61 Redis connections from a single instance.** BullMQ opens one per `Queue`
and two per `Worker`, and it was being handed *options*, so each of them dialled
its own. Render keeps the old instance serving while the new one boots, so a
deploy asked Upstash for ~122 at once; past the cap the extra connections are
closed during the handshake, and that reached the log as a bare `write EPIPE`
thrown from ioredis's `auth` plus a lookup-cache pre-warm that timed out —
neither of which names a connection limit. `BullModule.forRootAsync` now takes
`BULLMQ_REDIS_CLIENT`, an ioredis *instance*: BullMQ marks it shared and only
each worker's blocking read still duplicates. Measured 61 → 24 on the local
stack: one shared client, one blocking connection per worker, and the six the
app itself holds. It is a second client rather than `REDIS_CLIENT` because
BullMQ needs `maxRetriesPerRequest: null`, which would hang the rate-limit
counter in front of a login instead of letting the request through.

**`products.search_vector` reported as drift on every boot.** It is declared
`Unsupported("tsvector")` — created by `prisma db push`, omitted from the
runtime DMMF — so the checker saw a column nothing had asked for.
`UNSUPPORTED_COLUMNS` suppresses the warning only, never the fatal side, and a
unit test holds the list to what `schema.prisma` actually declares.

**`pg`'s SSL deprecation warning.** Neon hands out `?sslmode=require`, which
`pg` treats as `verify-full` today and will treat as unverified TLS in v9.
`pinSslMode` writes down what is already happening, so that upgrade cannot
quietly downgrade every deployment with nothing in a diff to point at.

The fourth is not code — see below.

- [ ] **Turn Upstash eviction off (`INFRA`)**  
      The database reports `optimistic-volatile`, so Redis is free to drop queue
      keys under memory pressure and the jobs vanish with no error anywhere.
      BullMQ prints `IMPORTANT! Eviction policy is …` once per connection on
      every boot and nothing in this repo can silence it. Upstash console → the
      database → **Eviction** off; it then reports `noeviction`.
- [ ] **Confirm the connection count against the plan's limit (`INFRA`)**  
      ~24 per instance, ~48 during a deploy's overlap. Worth reading off the
      Upstash console once so the headroom is a known number rather than an
      assumption — and worth re-checking after anything adds a queue or a
      pub/sub subscriber.

- [ ] **Rotate disclosed development credentials (`T0-1`, `T0-3`, `T0-4` · `SEC` · `INFRA`)**  
      Rotate database passwords, JWT secrets, and BunnyCDN keys from development templates and apply placeholders.
      Local P01 (2026-09-16) rotated only `SECRETS_ENCRYPTION_KEY` and `APP_SECRET` on Docker `zaydak`. Provider revoke at Neon/JWT/Bunny/Stripe/etc. is still this item. See `docs/production-readiness/p01-secret-rotation-log.md`.
- [ ] **Set dedicated `SECRETS_ENCRYPTION_KEY` (`T0-2` · `INFRA` · `BE · integrations`)**  
      Configure dedicated encryption key in Render prior to rotating `APP_SECRET` to prevent orphaning stored integration secrets.
      Isolated local rotation is done (`zaydak`, 14 envelopes, PREVIOUS unset). Render still needs the same window.
- [ ] **Configure verified Resend email domain (`T0-6` · `INFRA` · `ADM · integrations`)**  
      Verify production sending domain in Resend and configure production sender address in Admin integrations.
- [ ] **Unset sandbox email sender flag (`T0-7` · `INFRA`)**  
      Remove `ALLOW_SANDBOX_EMAIL_SENDER` in Render. The repo half is done (2026-09-12):
      `.env.example` no longer ships it armed, and `DeploymentSafetyService` now raises
      `ALLOW_SANDBOX_EMAIL_SENDER_SET` (warn) against a remote database, distinguishing
      the armed `'1'` from an inert value like `'true'` that merely *looks* on.
      **Order matters:** do this only after `T0-6` is proven with a real Send test —
      unset first and `assertEmailDeliverable` re-arms and hard-blocks vendor signup
      with a 503.
- [ ] **Configure and verify live SMS provider (`T0-8`, `T1-13` · `INFRA` · `BE · otp`)**  
      Configure Twilio credentials and verify end-to-end SMS deliverability to target
      regional phone numbers. Twilio's provider spec is fully built and its `verify()`
      is a free account-lookup; only sending costs money. The repo half is done
      (2026-09-12): a boot check now logs at ERROR and fires
      `DEV_SINK_PROVIDER_IN_PRODUCTION` when a remote-database deployment resolves any
      channel to a dev sink. Before that, `is_dev_sink` existed in the data and was
      rendered in the admin console and nowhere else — production could be shipping OTPs
      to a console sink in total silence.
- [ ] **Run the attachment MIME repair against production (`T2-23` · `INFRA` · `BE · attachments`)**  
      `npm run repair:attachment-mime` (dry-run by default, `--apply` to commit) against
      the production database and BunnyCDN pull zone. The code half has shipped for a
      while; a `--report` mode added 2026-09-12 sizes the problem **from the database
      alone**, with no storage connection and no CDN key, so run that first.
- [ ] **Execute production database seeds (`T0-9` · `INFRA` · `BE · prisma`)**  
      Run `npm run seed`, `seed:taxonomy`, and `seed:plans` on production database and verify with `check:drift`.
- [ ] **Enable CORS headers on CDN pull zones (`T2-14` · `INFRA`)**  
      Configure `Access-Control-Allow-Origin` on BunnyCDN pull zones to enable canvas image editor exports.
- [ ] **Reconcile Neon production database instance (`T0-11` · `INFRA`)**  
      Verify and document canonical production database host between Render environment variables and Neon console.
- [ ] **Turn on shop subdomains in production (`INFRA` · `STORE`)**  
      Set `NEXT_PUBLIC_ROOT_DOMAIN=zaydak.com` on the storefront and vendor
      projects, and add `https://*.zaydak.com` to the back-end's
      `CORS_ORIGINS` **beside** the apex entry — a wildcard does not match the
      apex. Without the CORS entry every shop subdomain's requests are refused
      by the browser, and a refusal withholds the header rather than erroring,
      so it reports as "the API is down" with nothing in the logs.
      **This is configuration only — there is no code work here** (verified
      2026-09-12): `common/config/cors-origins.ts` already parses
      `https://*.zaydak.com` as a first-class rule, with unit tests and a note in
      `docs/10_deployment/README.md`. Two traps remain: a malformed pattern is
      *dropped* at startup rather than rejected loudly, so read the `CORS` logger's
      `Allowed origins:` line to confirm it survived; and `NEXT_PUBLIC_*` is inlined
      at build time, so both Vercel projects need a redeploy, not just a variable.

---

## Design system & UI

Focus: Bilingual layout fidelity, GPU canvas resilience, and design token consistency.

### Scroll image reveal: a grid that assembles itself on scroll (2026-09-22)

`packages/ui/src/components/scroll-image-reveal.tsx` is a new shared piece,
recreated from Skiper UI's `skiper32` (itself Codrops' "Scroll3DGrid"): a CSS
grid of images whose tiles each start somewhere else and travel to their slot
as the gallery scrolls into view. Two effects — `"columns"` rises each column
into place, the middle one first, so the grid arrives as a V; `"scatter"`
starts every tile below, behind and turned, and lands each on its own timing.
Built on `motion`'s `useScroll` rather than the reference's GSAP + Lenis, which
would have added two dependencies for one component; smoothing is an opt-in
spring. Poses are hashed from index and seed (never `Math.random()`), the
column count is measured from computed `grid-template-columns` so
`--reveal-columns` breakpoints keep the V centred, reduced motion renders the
grid settled, and the root clips x only. Geometry lives in
`scroll-image-reveal-geometry.ts` with its own tests; the playground is
`apps/vendor/src/app/scroll-reveal-demo` (dev-only via `assertDevOnly`).

- [ ] **Nothing real renders it yet (`UI`).** The only consumer is the
      playground. The natural home is a storefront lookbook or "shop the look"
      section in the theme editor; until such a screen is being built this is
      a component ahead of a screen, and should not be wired in for its own
      sake.
- [ ] **Inner parallax zoom is not ported (`UI`).** Codrops scales a
      `grid__item-inner` from 2 down to 0.5 inside each tile as it travels;
      here a tile's image is static. Worth adding as an opt-in if the columns
      effect reads flat on a real page.

### Drawers nest, and dialogs can hand the scroll to the window — 2026-09-20

Two additions to `@repo/ui`, both out of the storefront's sign-in popup and
both default-off, so nothing else moved.

`DialogContent` takes `scroll="viewport"`: instead of pinning the dialog to the
centre of the window and leaving a tall one to scroll inside itself, it puts
the dialog in a full-window scroller, so the bar is the browser's own and the
whole card travels with it. Short content still sits centred.

`DialogContent` stacks too, in that mode only, and the storefront's sign-in
popup is the first thing using it: "create an account" opens a second card
over the sign-in card instead of swapping the first card's contents. Centring
is what makes a stack impossible — two cards centred independently put the
taller one over the shorter one entirely — so both go to the top of their
scroller once there is a stack, the one behind lifts, narrows, dims and drops
its close button, and the one in front starts lower with a shadow.

`Drawer` now stacks when nested. Base UI already marks the child `data-nested`,
marks every ancestor `data-nested-dialog-open`, counts depth into
`--nested-dialogs` and renders no backdrop for a nested dialog; what was
missing was the step back, so each parent moves inward off its anchored edge
and narrows, leaving a strip visible past the frontmost drawer. The popup also
carries `data-swipe-axis` and the `group/drawer-popup` name, so a call site can
size its own content against the axis without being told which side it is on.

- [x] **Use the nested drawer somewhere real (`UI`).**
      **The premise in this box is wrong, and was checked on 2026-09-21.**
      "The vendor's draft-order → new-customer pair" is not two dialogs waiting
      to be converted: `NewCustomerDialog` is **already a bottom `Drawer`** —
      the only one among the seven overlays in `components/drafts/`. What opens
      it, `CustomerPickerDialog`, is a `Dialog`. So the pair is a Drawer inside
      a Dialog, and "convert it" really means *demoting the picker to a drawer
      so the child can step back off it*, which is a different proposal that
      should be argued on its own merits.
      It probably should not be argued for. All four `Drawer` call sites in the
      repo are top-level desktop "create X" sheets (admin shop-form, vendor
      targets, vendor collections, vendor drafts) and none consults a
      breakpoint; a bottom sheet is a poor fit for a desktop customer picker.
      And "use the nested drawer somewhere real" is a component looking for a
      screen — the wrong direction.
      Two findings worth keeping regardless, because they are real and cheap:
      the step-back styling in `drawer.tsx` keys on `data-nested-dialog-open`
      and **nothing keys on `data-nested`**, so the frontmost child is unstyled
      as a child; and the storefront's `AuthLayer` already does the equivalent
      stacking with Dialogs (rendering the child inside the parent's
      `DialogContent`), which is the pattern to copy if this is ever wanted
      here. Also note `new-customer-dialog` used to refetch `GET_CONTACTS` with
      `{ page: 1, limit: 100 }`, not the picker's `{ page: 1, limit: 50 }`
      watch query. That was cosmetic, not a live bug (checked by two readers on
      2026-09-22): the picker closes before the drawer opens, the new customer
      goes straight onto the draft, and reopening the picker always refetches,
      so the only symptom was a stale list for one round-trip. It now evicts
      every cached `contacts(...)` list instead.
      Closed 2026-10-04 as not doing: a component should not look for a
      screen, and no screen nests drawers. The one real finding in it is
      fixed: the frontmost drawer is styled as a child (`data-nested`),
      casting its shadow toward its free edge onto the parent's strip, pinned
      per side in `drawer-nested.render.test.tsx`. Not looked at in a browser.

### Segmented filter bar shared by nine list screens (2026-09-13)

`packages/ui/src/components/filter-bar.tsx` is a new shared control: one chip
per applied filter reading *field | operator | value*, each segment its own
menu, plus a dashed button that adds another. It replaced the
`DataTableFacetedFilter` buttons on the vendor dashboard's orders, customers,
collections and coupons lists, and the status `<Select>`s on the admin
console's users, shops, withdrawals, subscribers and otp-logs lists.

It is fully controlled, and the rule every screen is built on is that the chips
are the state and the query is derived from them — not the reverse. A derived
array drops a chip the instant it is added, because a new chip has no values
yet, and the add-then-pick flow never completes. Each feature got a
`lib/**/filters.*` module holding `FILTER_FIELDS`, `toQuery` and `toFilters`,
reusing the option constants the badges already render from rather than
retyping them, so no server mapping changed: the comma-joined
`order_status=a,b`, the digit heuristic routing a search to tracking vs
customer, the page resets and the `skip` guards are all byte-identical.

Three decisions are worth remembering. Each segment owns its own Base UI
`Popover` rather than the bar sharing one portal, which is what makes the menus
land correctly under a right-to-left `dir` with nothing mirrored by hand.
Async values are fetched from the handler that opens the menu rather than from
an effect, and replies are sequence-numbered behind a 250ms debounce, so the
answer to a query nobody is typing any more is dropped instead of rendered.
And one chip per field is enforced by the bar itself — a field already on the
bar is not offered again and the add button goes once every field is used —
because a second chip on the same field could only ever be ignored by the
mapping while still showing a value the list is not filtering by.

- [ ] None of this has been checked in a real browser, in either direction. The
      unit tests pin the reducer; jsdom runs no layout and no animation, so the
      chip springs, the popover placement under RTL and the applied-value pulse
      are all unverified visually.
- [x] `apps/vendor`'s products list keeps its own bespoke search-and-chips bar.
      Decide whether the two patterns converge or stay deliberately different.
      **Decided 2026-09-17: they stay different.** The recommendation below is
      now the decision — overrule it and the refactor is ~1,167 lines.
      Nine screens now sit on the shared bar (vendor collections, coupons,
      customers, orders; admin otp-logs, subscribers, shops, users,
      withdrawals) and products is the only holdout, which reads like
      duplication until you compare what the two actually are:
      the shared `FilterBar` takes `fields` / `value: Filter[]` / `onChange`
      and draws *field | operator | value* chips. It has **no text input of its
      own** — search is a separate box the bar cannot see, which is precisely
      why the `clear` slot had to be invented so one button could empty both.
      The products bar is the opposite shape: **one field does both**. Typing is
      a product search, focusing it empty lists the filter keys, picking one
      turns into a chip and the same list becomes that key's values. There is no
      operator segment because the omnibox implies "is".
      So converging costs one of two things, and neither is a tidy-up: either
      products loses the single-field interaction, which is a deliberate
      Shopify-parity decision rather than an accident, or the shared bar grows
      an omnibox mode that exactly one of ten consumers uses.
      Revisit if a *second* screen wants the omnibox — that is when the shape
      becomes a pattern rather than one screen's answer. (Note the scale
      argument in the code comments does not support convergence either way:
      the category menu reads `productCategories`, the handful a shop's products
      actually sit on, not the ~5500-node flat taxonomy.)

### RTL: the source-level half of the audit is done (2026-09-12)

The shared primitives every table, modal and drawer in all three apps renders
through were audited for physical direction utilities written where logical ones
belong, and 25 files were corrected. The convention already existed — 99 uses of
the `rtl:` variant, 43 of them `rtl:rotate-180` — so this was finding the misses,
not inventing a policy.

The confirmed defect was `SheetContent`'s close button at `right-3`. A sheet opens
from the edge the reader's text ends at, so the close belongs on the panel's
*outer* corner; pinned physically it sat on the **inner** corner under RTL,
directly over the title, while `SheetTitle`'s `pe-6` went on reserving the gap at
the opposite end. `cart-drawer.tsx` had worked around it locally with a written-out
comment — that workaround is now removed, since a source fix plus a local fix
inverts the button again.

Two fixes could not be CSS. `apple-switch` samples a direction sign at pointer-down
because pointer deltas are viewport pixels: without it an RTL user drags *away*
from "on" to switch it on. `switch` needed a `--switch-dir` custom property because
its track is a flex row, so the thumb already rests on the inline-start edge and a
rightward `translateX` pushed the checked thumb clean off the track.

Judgement was applied rather than a sweep: `input-otp` stays physical because every
call site sets `dir="ltr"` deliberately (a verification code reads left-to-right in
either locale), `avatar`'s `-space-x-2` already compiles to `margin-inline`, and
`sheet`/`drawer` `data-[side]` geometry stays physical because the *caller* picks
the side and the callers that care already flip it.

- [~] **Walk the RTL screens in a real browser (`T3-20` · `VEN` · `ADM` · `UI`)**  
      Ran 2026-09-17 against local Chromium (`npx playwright test --config e2e/playwright.config.ts -g "RTL"`).
      Vendor `:3001` was up; API `:3000` and storefront `:3003` were listening.
      **Passed:** session sign-in (`vendor@zaydak.com` → shop `c1ded7ed69c6`);
      vendor products list `html[dir=rtl]` with start-aligned headers;
      vendor sidebar; AI composer Arabic draft under RTL
      (`e2e/.artifacts/rtl-vendor-products.png`, `rtl-vendor-sidebar.png`,
      `rtl-arabic-draft.png`). The files-list sheet was not measured: every
      row was an image and opens the full-screen editor (`rtl-vendor-files-no-sheet.png`).
      **Did not complete:** storefront cart drawer — `http://localhost:3003/`
      and `http://localhost:3003/c1ded7ed69c6` timed out (curl 15s, no HTTP
      status); admin login — `:3002` was not running, spec skipped.
      Spec: `e2e/specs/rtl-walkthrough.spec.ts`.

- [x] **GPU shader CI smoke tests (`T4-38` · `UI` · `CI`)**  
      Add Playwright smoke test asserting non-blank canvas render for WebGL backgrounds and trackball components. Added `e2e/specs/gpu-shader-smoke.spec.ts`.

---

## Deferred — outside this release

Not counted in the Index. Do not start these during the current release.

### Deferred — Tap Commerce Platform Integration (2026-09-16)

Approved future card-settlement direction: one Zaydak Commerce Platform account,
one Tap Merchant per shop, Lead → Connect onboarding, charges with
`merchant.id` + `platform.id`. **No implementation in this release** (no Tap
APIs, no Prisma model, no checkout change).

**Frozen / do not extend:** vendor withdrawal product, payout approval as a
payout rail, internal merchant wallet as money the platform later sends, manual
settlement. Live `createWithdrawal` / admin `/withdrawals` / `Balance` ledger
stay so production does not break; they are deprecated, not a backlog to finish.

Plan, inventory, phases, and **BLOCKED — Requires Tap confirmation** questions:
[docs/future-features/tap-commerce-platform.md](docs/future-features/tap-commerce-platform.md).
Supersedes [Stripe Connect](docs/future-features/payment-providers-stripe-connect.md).
Decision: D26.

**Research reopened 2026-09-25** — comparing Tap with the other Saudi
providers is item 5 in [TODO-AKRAM.md](TODO-AKRAM.md). The build stays
deferred until that recommendation updates D26.

### Deferred — Admin TOTP / WebAuthn (2026-09-16)

V1 does not ship a second factor on admin accounts. Equivalent controls
(separate admin origin, permission-gated mutations, Origin-bound session
cookies, refresh consume + reuse detection, lockout, fail-closed identity
throttle, revoke-on-suspend) are accepted by D28. Enrollment, recovery codes
and lockout-for-TOTP are a later identity surface, not a launch checkbox.

---

## Done — recent closures

Key milestones and recent completions moved out of the active backlog:

### Storefront template: rail, pieces on a hanger (2026-10-06)

The owner asked for the Molimao "on the rail" study (garments hung on a
rail, a hover that turns one toward you, a click that opens it) rebuilt in
React beside doughn, hullo and drip. It lives in
`apps/vendor/src/features/storefront-templates/rail` and opens at
`/theme-preview/rail`. "Use this theme" writes `rail`. A shop on that
template hangs its own products on the public home. The theme preview keeps
the eight drawn pieces. See
`apps/vendor/docs/features/storefront-templates.md`.

- [x] **Hang the shop's products and render the rail as that shop's home (`VEN`).**
      Done 2026-10-06. A shop whose template is `rail` renders that home and
      drops the default header and footer. The pieces are the shop's products
      that have a photo; the link uses the tenant base. A shop with no photos
      keeps the drawn sample, which is also what the theme preview shows.

### Assembled products (2026-10-06)

A simple or service product can be built from other products. The vendor form's Assembly card writes the rules (`setProductComposition`): one counted group with a price per count, a cone cap, and add-on groups. The cart, checkout and order price the selection and keep two builds of one product as two lines. A drip shop's public home reads those rules when the shop has a `drip-gelato` product. The theme preview still reads the sample.

- [x] **Point the drip cone at a shop's assembled product (`VEN`).**
      Done 2026-10-06. A drip home loads `storefrontProductComposition` for
      the `drip-gelato` product and builds the cone from those parts, prices
      and cut-outs. The theme preview still uses `data.js`. A shop with no
      assembly rules keeps the sample, and checkout still maps it onto the
      `drip-*` products.
- [x] **A cut-out photo on the part, separate from its catalogue photo (`VEN`).**
      Done 2026-10-06. `product_composition_parts.cutout_url` is the
      transparent image used inside a build. The part product's own photo is
      unchanged. The assembly form has a field for the URL.
- [x] **Decrement each chosen part when a composed line is sold (`BE`).**
      Done 2026-10-06. The sale, the shipment, the edit, the cancel and the
      refund move each tracked part named in the snapshot, and the cart hold
      covers those parts as well as the builder. A part that does not track
      quantity is left alone.

### Arabic typography overlay (2026-09-14)

`T3-17`, deferred since 2026-09-12, is built. Generated marketing graphics can
now carry a line of Arabic drawn by a **text renderer** rather than asked of the
diffusion model, which cannot letter Arabic at all — it produces glyph-shaped
marks a reader sees as nonsense, and no prompt clause fixes that, because the
failure is in the representation. `back-end/src/ai/image/typography/` composites
through sharp's bundled Pango (harfbuzz 12.1 + fribidi): joining, bidi
reordering, mixed Arabic/Latin/digits on one line, word wrap inside the frame,
and a configurable size, colour and band. It is wired last in the ingest loop,
after `postProcess`, because the type size and the wash are fractions of the
*final* canvas and `square` changes what that is.

The blocker was never the shaping — it was that no face ships server-side and
the consoles' other Arabic face is licensed as a webfont, a grant to a browser
downloading it that says nothing about a server rasterising it. **Tajawal** is
vendored under the SIL OFL (`back-end/assets/fonts/`, `OFL.txt` verbatim beside
it, copied into `dist/` by the `nest-cli.json` assets step), which also makes a
generated graphic match the letterforms the storefront already sets Arabic in.

Two decisions worth keeping: the contrast under the caption is **manufactured,
not borrowed** — the storefront hero's own three-stop wash, because a vendor's
upload is at an unknown exposure and type that relies on the picture being dark
is invisible on half the shops; and the renderer **never throws** — no font, an
unreadable format or a layout that will not fit returns the bytes unmodified and
logs, since an uncaptioned graphic is a lesser failure than a broken pipeline.

- [x] **No client-facing way to ask for a caption (`BE · ai/image` · `VEN`)**
      The renderer reads `params.caption` off the generation row, and nothing
      writes it: there is no DTO field, no shot option and no control in the
      studio, so only a server-side caller composing `extraParams` can reach it.
      Needs the input surface and one control in the vendor enhance panel.
      Shipped 2026-09-22. The box was wrong that no input existed:
      `GenerateImageInput.caption` was declared and validated, and then
      silently dropped — `generate` never wrote it into `params`. It is now
      sanitised, moderated before any spend (a refusal names the caption), and
      persisted. `EnhanceImageShotsInput.caption` is drawn only on a shot that
      declares a caption band — today `social`, into the upper third its layout
      already keeps clear — moderated once before the quota lock, and kept off
      the options type that presets store. The enhance studio has a caption
      input shown only while such an output is picked, kept across re-rolls and
      restored with a run.
  - [x] The product-form image panel has no caption field, and the Sidekick
        `generate_product_image` tool cannot pass one.
        Closed 2026-09-28: the product form's AI panel takes an optional text
        on the image (`caption`) in Text to image and Edit, hidden for
        background removal and upscale, and a caption the safety filter
        refuses reads as the text. `generate_product_image` takes `caption`
        too, passes the vendor's language to the service, and names the
        refused input instead of "Validation failed".
  - [x] Moderate `customScene` and the caption before the vision analysis call
        in `runShots`, so a refused run does not spend a vision call first.
        Done 2026-09-25. Both moderation blocks now run right after the
        reference is resolved, ahead of `vision.analyze`, which is a paid
        OpenRouter call on a cache miss. Refusal shapes and codes are
        unchanged, and the caption is still moderated once, only when a picked
        shot draws it. The spec asserts the vision mock is never called on
        either refusal.
  - [x] An invalid shot-option combination (`unknown_style` and friends) still
        costs a vision call: the composer that rejects it needs the analysis,
        so it runs after. Validate the options before analysing.
        Closed 2026-09-28: `runShots` composes every shot's prompt once
        without the analysis before any paid call, so an off-vocabulary option
        is refused before the moderation and the vision call; the prompts sent
        are still composed with the analysis.

### Every storefront operation admits a customer session, checked in CI (2026-09-27)

The storefront signs a customer out on `AUTHENTICATION_REQUIRED`, and
`JwtAuthGuard` answers exactly that to a customer's token on any operation
without a shop-customer guard. Two such operations signed customers out in a
live test on 2026-09-26, and the spec that pinned them named those two by
hand. `src/customers/storefront-operations-admit-customers.spec.ts` (in
`npm test`, so CI) now reads every operation from the storefront's codegen
output, finds each root field's resolver through its `@Query`/`@Mutation`
metadata across every `*.resolver.ts`, and fails on a field guarded
`JwtAuthGuard` without `ShopCustomerGuard`/`OptionalShopCustomerGuard` — or
on one no resolver answers. No list is kept: a new storefront operation is
checked as soon as its types are generated. Taking the guard off
`lookupNationalAddress` makes it fail naming that operation; today all pass.

- [x] **The storefront's REST calls are outside the check (`BE` + `SF`).**
      The bank-transfer receipt upload and download go through controllers the
      same guards protect, and they are not in the GraphQL documents the spec
      reads.
      Closed 2026-09-28: the same spec now finds the storefront's REST calls
      in its own source by each controller route's prefix (the receipt upload
      and download, and the assistant's stream), matches each to its route
      through `@Controller` and method metadata, and holds it to the same
      guard rule. No list is kept.

### The second live Telegram test, answer by answer (2026-09-26)

The order went through in the chat, but under the wrong name: the account
said "Omer", the assistant asked for a name anyway, thanked "Osama", and
`update_my_details` renamed only a customer with none. It also offered "the
saved address" before looking and then said there was none (the address sat
on an older record of the same person), read a National Address back as raw
parts it had translated, and re-asked a step the customer had already asked
for. Now the prompt never asks for a name that is on file and a name the
customer gives is saved (`setName`, the old one audited); the summary shows
the name, frozen with it, and the order carries that name; every
confirmation repeats the name and the address; no saved address is offered
before `get_saved_addresses` returns it; the lookup hands back one
`display` line composed as the summary prints it (street first, the
building labelled) to read back as written; the same address is saved once
(`saveOnce`); the cart line is said as it stands ("2 × …"); the dialect
holds; Arabic money reads "ر.س"; the Telegram button is named as it reads;
and a Telegram chat whose number opens no customer yet gets one on any turn
instead of a dead end.

- [x] **Arabic names for a National Address (`BE`).** OTO answers in English
      only, so "Wadi Samael, East Umm Al Hamam, Riyadh" is what the customer
      reads back and the summary prints, in an Arabic chat. The MOMRAH city
      and district tables with Arabic names are bundled only in the vendor
      app (`apps/vendor/src/shared/geo`); give the back-end a copy from
      `scripts/generate-geo.cjs` and store the Arabic city and district
      beside the English.
      Closed 2026-09-28: `scripts/generate-geo.cjs` also writes a compact copy
      of the MOMRAH city and district names for the back-end
      (`src/geo/sa-place-names.data.json`), `nationalAddressBlob` saves
      `city_ar` / `district_ar` beside the English on an unambiguous match,
      and `describeAddress` prints them for Arabic. The courier and the
      order's `city` keep the English.

### `AuthShell`'s render test fails at HEAD (found 2026-09-26)

Seen while running `npx turbo run lint typecheck test --continue` for the
phone-first step 4, with no change under `packages/ui`:
`auth-shell.render.test.tsx` looks for the text "vendor dashboard" and the
eyebrow slot, and the rendered shell carries neither.

- [x] **Make `auth-shell.render.test.tsx` agree with `AuthShell` (`UI`).** Two
      of its tests fail (`renders every slot once`, `renders eyebrow, title,
      and description`): decide whether the component or the test moved.
      Closed 2026-09-28: the component moved. The eyebrow and quote were
      retired on 2026-09-25 and are accepted without being drawn, so the test
      now says so; 9 of 9 pass.

### Suggest a box on the product's shipping card (2026-09-25)

Ported from the Mlsoon vendor wizard's "اقترح لي صندوقًا". The package row on
the product form gained **Suggest a box**: the vendor types the item's own
size, and `suggestPackage` (`features/products/lib/suggest-package.ts`) adds
4 cm to each side and picks the smallest saved `BOX` it fits in any
orientation, marking it "Suggested". When none fits it proposes a box at the
padded size with an estimated empty-carton weight (500 g/m² board), and
nothing is created until the vendor approves it or edits it in the prefilled
package dialog. The typed size is deliberately not saved into the product's
`length_mm`/`width_mm`/`height_mm`: those are the *parcel* size and override
the package at booking, so an item size there would quote a box with no room.

- [x] **Package dialog shows raw keys for bad dimensions (`VEN`).**
      Done 2026-09-25: the three checks are one, and it names the existing
      `validation.positiveDimensions`. `package-form-dialog.test.tsx` is new and
      renders through `nextIntlMock()` (the real English catalogue), so it
      asserts the sentence a merchant reads; putting one old key back turns
      three of its four cases red. A key-echo mock would have passed either way.
- [x] **`ShippingCard` is hardcoded English (`VEN`).** Done 2026-09-25: every
      string on the card is in a new `products.shipping` namespace, en + ar at
      the same position. The width and height inputs also gained accessible
      names (only length had one, through the group label), and the summary
      chip's value gap is `ms-1` instead of a physical `ml-1`. The unit symbols
      (`kg`, `lb`, `g`, `oz`) and the package dialog's `cm` / `kg` suffixes stay
      Latin, as they are elsewhere in the dashboard.

### A store with no markup still ships its catalogue — the hydration payload reader (2026-09-15)

Scanning `zaydak.dev/en/bakery-shop` failed with `STORE_IMPORT_NO_PRODUCTS` while
the screen reported "Pages read 300 / Products 59", and three separate things
were wrong.

**The store publishes zero structured data.** No `application/ld+json`, no
`itemprop`, no `product:price` — only `og:title`/`description`/`image` and
`og:type=website`. The free floor's only extractor was schema.org markup, so it
correctly found nothing; the crawl *did* reach the product pages (they are plain
`<a href>` links) and had nothing to parse. Its `/sitemap.xml` is 63 marketing
pages × 7 locales with no product URL at all, so the sitemap strategy was doomed
independently of markup.

**But the whole product object was in the page.** It is PickBazar (Laravel +
Next.js), and the RSC flight payload carries `name`, `slug`, `description`,
`price`, `sale_price`, `sku`, `quantity`, `unit`, `currency` and the **S3 origin**
image URL — the one the `<img src>` hides behind a `/_next/image?url=` proxy on
the source's own host. So the fix was not AI and not a paid provider: a free
reader for the data a headless storefront must embed for its own front-end.
`hydration-payload.ts` reads `self.__next_f`, `__NEXT_DATA__`, Remix contexts and
plain `application/json` tags, and `page-products.ts` runs it after JSON-LD on the
same download — a separate strategy would have re-fetched a stranger's whole site
to read it a different way. Two rules make it safe: a page yields only the product
it is **about** (a listing's two dozen cards would otherwise all be filed under
the listing's address), and a payload number is **corroborated against a money
figure the page renders** before it is believed, because `"price": 3` is three
riyals or three cents and nothing in the JSON says which. The corroboration set
counts only money-shaped figures — an early version took every number and put the
SKU `3084` in it as `308400`.

**And the counters were progress artifacts.** `trackProgress` wrote every frame's
`done` into `products_found` and every `discovering` frame's `total` into
`discovered_urls`; `done` is a page count in the generic strategies and `total` on
the crawl is `MAX_PAGES`, the request budget. The two figures were effectively
transposed, with the honest one under the wrong label, and nothing covered the
method. `ScanProgress.unit` now says what `done` counts, every call site declares
it, `total` is written nowhere, and the write is an `updateMany` on the running
statuses so a late frame cannot clobber a `READY` row.

  - [x] **Persist the strategy trace on a failed scan (`BE · store-import` · `VEN`)**
        Shipped 2026-09-22. Part of the plan was already built (`onStep` and a
        closed-vocabulary normaliser existed, and the chain already attached the
        trace to its errors) — what was missing was anyone reading it. `failJob`
        now merges `report.diagnostics` (strategy names, counts and a fixed skip-
        reason list; anything else becomes `failed`, `err.message` is never
        copied), the resolver surfaces `strategy_trace` / `provider_available` on
        FAILED jobs, the pruner selects `csv IS NOT NULL OR report IS NOT NULL`
        so a diagnostics-only report still expires (checked on real Postgres),
        and the progress screen shows a "What we tried" panel. The suspicion in
        the entry was right: `readScanReport`'s trace-only fallback fabricated a
        scan with `matched_products: 0`, which defeated the vendor's `hasReport`
        gate and drew a grid of zeroes on a scan that read nothing; it is gone.
        Follow-ups closed in the same wave: the job's `error` column now only
        ever holds a code (`failure-code.ts` — a network fault from the source is
        `STORE_IMPORT_SOURCE_UNREACHABLE`, anything else the new
        `STORE_IMPORT_FAILED`; the raw message goes to the server log, and older
        rows are filtered on read), and stored traces from older successful
        scans are sanitised when read too.
  - [x] **A scan that fails after the chain succeeded keeps no trace (`BE`).**
        Done 2026-09-25. `scanJob`'s catch now attaches the completed trace to
        the error (`attachCompletedChainTrace`) before either `failJob` sees
        it. So the "What we tried" panel is no longer empty when a scan's
        strategies found products and it then hit `STORE_IMPORT_TOO_LARGE` or
        a fault on the way to READY. The trace rides under
        `completedStrategyTrace`, not `strategyTrace`, because `failureCode`
        reads the latter as "thrown while reading the source". A fault after
        the chain comes from our own database and stays `STORE_IMPORT_FAILED`.
        It goes through the same closed-vocabulary fold, so no message is
        copied (`store-import-scan-failure.spec.ts`).
  - [x] **Widen the `strategy_trace` / `provider_available` field
        descriptions (`BE`).** Done 2026-09-25: both now say "a scan that
        FAILED, in the strategy chain or after it returned". The same was done
        for the matching comment in the pruner. `schema.gql` and all three
        apps' codegen were regenerated.
  - [x] **PickBazar `variation_options` imported as SIMPLE (`BE · store-import`).**
        Closed 2026-10-07. The hydration mapper ignored the variant matrix on
        purpose (unknown shapes). mlsoon / Marvel forks ship a stable
        `variation_options` field; reading it builds Option axes + variants
        (e.g. Box of 6 / Box of 9). Re-scan the product after the API rebuild.
        `hydration.spec.ts`.
  - [x] **Vendor strategy labels are a hand copy (`VEN` + `BE`).** Done
        2026-09-25. `connectors/strategy-labels.spec.ts` collects every
        strategy name from `CONNECTORS` and every `STRATEGY_SKIP_REASONS`
        token. It fails when one is missing from the vendor's
        `STRATEGY_LABEL_KEYS` / `STRATEGY_REASON_KEYS`, which it reads as text
        from `apps/vendor/src/features/products/lib/store-import.ts`. It reads
        text because `back-end/` cannot import the dashboard, and CI checks out
        the whole repo. The check runs one way only: a label for a retired name
        stays, since failed jobs keep their trace for sixty days.
  - [x] **A failed job renders six numbers that mean nothing (`VEN`)**
        Gated `StoreImportCounts` and `StoreImportImages` on `hasReport`
        (`new_products != null || matched_products != null || import_report`),
        so failed jobs without a scan report omit the empty cards. Widened
        `Stat` to render `—` for null values.
  - [x] **Rewrite `STORE_IMPORT_NO_PRODUCTS` in en/ar (`VEN`)**
        Rewrote the message in en/ar to state clearly that the store publishes
        no readable product data (no structured catalog or public feed) and
        suggest importing directly via CSV export instead.
  - [x] **`images_found` counts a different population from the other three (`BE · store-import`)**
        In `store-import.service.ts`, `images_found` is now updated upon `DONE`
        from `prisma.storeImportMedia.count({ where: { job_id: jobId } })`,
        aligning it with the media rows population.
  - [x] **Unwrap `/_next/image?url=` and friends in `shared/source-url.ts` (`BE · store-import`)**
        Added `unwrapOptimizedImageUrl` to `shared/source-url.ts` and called it
        from `absoluteUrl`, correctly extracting the origin image URL for Next.js
        and Vercel image optimizer proxies. Pinned with unit tests.
  - [x] **`shopify:sitemap+ajax` returns empty for a non-standard product path (`BE · store-import`)**
        `sitemap-ajax.strategy.ts` falls back to reading bounded candidate URLs
        when standard `/products/<handle>` paths are absent, and `ajaxUrlFor`
        queries `/products/{handle}.js` using the candidate handle. Covered by
        spec in `shopify-strategy-chain.spec.ts`.
  - [x] **The crawl is scoped to the HOST, not to the path the merchant named (`BE · store-import`)**
        Seeded at `zaydak.dev/en/bakery-shop`, `generic:crawl` follows every
        same-host link, and that host is a marketplace: the shop page links to
        `/en`, which links to other merchants' shops. The verified run stayed
        clean — 62 pages, 51 products, all of them the bakery's — because the
        frontier ran out first, but nothing in the code prevents a larger budget
        from filing a stranger's catalogue under the address this merchant
        attested to owning, which is exactly the harm the attestation exists to
        bound. Latent until now only because the generic floor found nothing.
        Prefer links under the seed's own path prefix before widening to the
        host, or stop at the prefix for a seed that has one.
  - [x] **Enforce `monthly_credit_cap`, or take the field off the console (`BE · store-import` · `ADM`)**
        `ScrapingCredentialsService` now aggregates `provider_credits` billed across
        all jobs in the calendar month and enforces `monthlyCreditCap` in `isAvailable()`.
        `scrapingbee.strategy.ts` bounds per-job credits to the remaining monthly
        budget, and `StoreImportService` wires `providerAvailable` from the credentials service.
        Covered with tests in `scraping-credentials.service.spec.ts` and `scrapingbee.strategy.spec.ts`.

### Error messages are always English (found 2026-09-24)

Found while tracing the foreign-shop toast under Vendor dashboard. `formatError`
in `app.module.ts` translates every `AppException` with
`t(error_code, extensions.lang ?? 'en')`, and nothing in the code base sets
`extensions.lang` — so a request sending `accept-language: ar` still gets
"Resource not found" rather than "المورد غير موجود" (checked against the local
API). The same trace exposed a second gap: `QueryTraceInterceptor` runs after
guards, so a `ShopHeaderGuard` refusal leaves no line in the log at all — only
the server layout's `shop(slug)` call showed up, not the dashboard's own failing
queries.

- [x] **Carry the request language into `formatError` (`BE`).** Done 2026-09-25:
      `handleGraphqlErrors` (`common/filters/graphql-error-context.ts`), run from
      Apollo's `didEncounterErrors` — which fires before `formatError` and, unlike
      it, sees the request — stamps `extensions.lang` from `accept-language`
      (`parseAcceptLanguage`, now exported from `lang.decorator.ts`). An `ar`
      request gets `المورد غير موجود`; `formatError` rebuilds `extensions` from an
      allow-list, so `lang` never reaches the client. `graphql-error-context.spec.ts`
      drives the real hook with located `AppException`s. (The first cut's spec
      re-implemented the hook inside the test and so tested nothing.)
- [x] **Log guard refusals (`BE`).** Done 2026-09-25: the interceptor records
      each root field it sees on the request, by response key, and the same hook
      logs `QUERY_TRACE_GUARD_REFUSAL` for an error on a field it never saw, and
      `QUERY_TRACE_REQUEST_ERROR` for one with no path (parse, validation,
      complexity). Per field, not per request: a first cut used one
      "interceptor ran" flag, which a sibling field that passed would set and so
      hide the refusal beside it.

### Product attributes read back in the shape they are written (2026-09-24)

Saving a product with a MULTI_SELECT attribute failed with `option <cuid> not
in definition pet_type`: both product mappers returned the stored option
**ids** as `value`, the vendor form submitted them unchanged, and the write
validator only accepts option `value` slugs. SELECT was worse and silent — the
mapper read a `value_option` relation that is really `option`, so it returned
`[]`, the form dropped the field, and `update`'s full replace would have deleted
it. `readAttributeValue` (`products/helpers/attribute-entry.helper.ts`) now
returns slugs for both and gives MULTI_SELECT a `display_value`; its spec
round-trips the read through `validateAndResolveAttributeValues`.

- [x] **`display_value` reads `label.en` only (`BE`).** Done 2026-09-24:
      `readAttributeValue` (`products/helpers/attribute-entry.helper.ts`) accepts
      `lang` and resolves option labels via `optionLabel(o, lang)` checking `label[lang]`,
      falling back to the opposite locale, then value. Propagated through
      `products.service.ts` (`mapEntry`, `mapPublicEntry`, `findAll`, `findOne`,
      `findAllStorefront`, `findOneStorefront`, `findStorefrontRecommendations`) and
      injected via `@CurrentLang() lang = 'en'` in `ProductsResolver` and
      `StorefrontProductsResolver`. Pinned in `attribute-entry.helper.spec.ts`.
- [x] **NUMBER and BOOLEAN attributes never reach the storefront spec table
      (`BE`).** Done 2026-09-24: `readAttributeValue` now sets `display_value` for
      `NUMBER` attributes as `${num} ${unit}` (when unit definition is present) or
      `${num}`, and for `BOOLEAN` attributes localized as `'نعم'/'لا'` for Arabic and
      `'Yes'/'No'` for English. Both are now picked up by the storefront's
      `attribute.display_value ?? text(...)` logic. Pinned in `attribute-entry.helper.spec.ts`.

### A shopper could create an order recorded as paid (2026-09-22)

Found by the backlog triage, confirmed by two independent readers.
`CreateOrderInput.payment_gateway` was free text, so any signed-in shopper
sending `"cash"` got an order recorded `order-processing` / `payment-cash` —
which reads as paid and fires `ORDER_PAID` to the shop's webhooks — even with
COD switched off and above the carrier's COD ceiling, and the courier then
collected nothing, because `codObligationCents` is non-zero only for
`CASH_ON_DELIVERY`. No balance credit happened automatically, but the goods
could ship unpaid. `orders/payment-gateway-policy.ts` now says who may record
which gateway: a shopper gets the checkout list (COD, STRIPE, BANK_TRANSFER,
FULL_WALLET_PAYMENT), checked case-insensitively by the DTO and again by
`createOrder` before any read, and COD / card / bank transfer must also pass the
shop's own `shopPaymentOptions` policy (`ShopPaymentsService.assertGatewayAvailable`,
previously dead code). Draft conversion passes the server-only `merchantPlaced`
opt and gets the merchant list (COD, CASH, and later INVOICE) with no wallet or
card gateway and no wallet spend — the draft's customer is the merchant's pick,
so a convert with `FULL_WALLET_PAYMENT` would have spent a stranger's wallet.
Anything else is `PAYMENT_METHOD_NOT_AVAILABLE` (422). Every refusal branch was
sabotage-checked.

- [x] Service allow-list, shop-options check and merchant list on convert, with
      specs and docs (orders, draft-orders, shop-payments and their api refs).

### OTP-primary storefront sign-in — 2026-09-18

`/login` now leads with email/phone → `sendOtpCode` → `verifyOtpCode` (auto-submit
on the sixth digit). Password is behind **Or → Sign in with password** on the
same screen (vendor shape, inverted). Session handover is shared via
`completeSignIn` (tokens + guest cart/wishlist adopt + hard navigate) for OTP,
password, and register.

- [x] **OTP primary + password alternate on storefront login (`SF`).**
- [x] **Google / Apple Sign-In on storefront login (`BE` + `SF`).** See Vendor
      entry for shared back-end; configure live client ids under INFRA.
- [x] **Eyeball OTP login on mobile + RTL (`SF`).** Slot sizing and resend copy.
      Already done, and the box was stale: the sign-in popup renders the same
      `LoginForm` as `/login`, and the popup entry above records a Chromium
      measurement at 390×844 in English and Arabic — six OTP slots across, the
      resend copy present in both locales. Closed on that evidence 2026-09-22.

### A capability in the registry but not in the database denies on every tier (2026-09-15)

Store import refused every scan with `FEATURE_NOT_AVAILABLE`, which reads on the
progress screen as "Something went wrong. Please try again." The shop was on no
plan at all — no `shop_subscriptions` row, so it resolved through
`FALLBACK_PLAN_CODE = 'free'` — but that was not the cause. `catalog.store_import`
was in `feature-registry.ts` and **nowhere in the database**: no `features` row,
no `plan_entitlements` row on any of the five plans. `entitlement()` returns null,
and absent denies by design, so PLUS would have been refused identically. The key
shipped with the store-import work and `npm run seed:plans` was never re-run.
Fixed locally by seeding (5 rows created, 145 left as-is — it is additive without
`--force`); `check:drift` now reports all 30 capabilities present on every active
plan, where it would have been fatal before. `FEATURE_NOT_AVAILABLE` was also
unmapped in the vendor's `STORE_IMPORT_ERROR_KEYS`, which is what turned a plan
refusal into "try again" — now mapped to its own sentence, apart from
`PLAN_QUOTA_EXCEEDED`, because "your plan never had this" and "you used yours up"
are different facts.

- [x] **`seed:plans` is not part of the deploy, so this will recur in production
      (`INFRA`)** — `render.yaml` runs `sync:permissions` on every deploy precisely
      because forgetting it yields "INSUFFICIENT_PERMISSIONS with nothing in the
      code to explain why", and then excludes `seed:plans` as a manual one-time
      step. Entitlements fail in exactly that shape. CI cannot catch it either:
      it seeds a fresh database and then runs `check:drift`, so the gate only
      ever proves the registry is self-consistent, never that a long-lived
      database has been re-seeded. Either add `seed:plans` (additive, no
      `--force`) to the build command beside `sync:permissions`, or run it by
      hand before store import is enabled in production.
      **Stale — closed 2026-09-22.** The first option shipped: `render.yaml`'s
      `buildCommand` ends `… && npm run sync:permissions && npm run seed:plans`,
      with the reasoning in the comment above it, and
      `docs/production-readiness/p03-migrations-workflow.md` records the order.
      The Platform entry "A new capability is off in production until somebody
      remembers to seed it" already said so. What remains is the one-off run on
      the already-deployed database, which is its own box there.

### The vendor test suite was red on main, in four places (2026-09-21)

Found while closing the draft-order boxes, not by anything watching for it.
`npx vitest run` in `apps/vendor` failed **3 files / 16 tests**, and the
locale-parity guard failed separately — all four from the same shape: a feature
shipped, the component grew a dependency or a string, and its test and its
Arabic half were never brought along.

- **`messages-parity.test.ts`** — the six `products.import.progress.scanAgain*`
  keys (the re-scan confirm dialog) were in `en.json` and in neither place in
  `ar.json`. An Arabic merchant pressing **Scan again** got `MISSING_MESSAGE`
  and raw key names. This is the test the chat-handoff entry below records as
  shipped *precisely* to stop that, and it was red and reporting to nobody.
- **`store-import-progress.test.tsx`** — every test in the file threw
  "invariant expected app router to be mounted". `StoreImportRescan` calls
  `useRouter()`; the suite never mocked `next/navigation`. Same feature as
  above.
- **`variants-table.render.test.tsx`** — the module threw on import:
  `VariantsTable` gained `useMutation` with the per-variant negotiation policy
  work and the mock returned only `useQuery`.
- **`code-sign-in.render.test.tsx`** — same shape again: `useApolloClient` is
  handed to `completeVendorSignIn` on the success path, and the mock did not
  export it, so the component never rendered at all.

All four fixed; the suite is **200 files / 1758 tests green**. Every fix is in
the test harness or `ar.json` — no component behaviour changed.

- [x] **Confirm the vendor suite actually runs in CI (`INFRA`).** Three broken
      files and a red guard sat on `main` long enough to be found by accident,
      which is the signature of a suite nothing executes on a push. `npx turbo
      run test` covers the workspaces in principle; check the CI job really
      invokes it and fails the build on it. Note `back-end/` is not a turbo
      workspace and is not covered by that command at all.
      Verified 2026-09-22: it does. `.github/workflows/ci.yml` runs on push to
      `main` and on pull requests, and its frontend job has a Unit tests step
      running `npx turbo run test` with no `continue-on-error`; the back-end
      job runs `npm test` on its own. The remaining gap is process, not
      configuration — results sitting red unread, or masked by an earlier red
      step in the same job (Lint and Typecheck run first). The back-end job's
      `typecheck:all` step was itself red at HEAD (54 spec type errors that
      ts-jest never reports, because it runs with isolated modules); this
      wave took it to zero.

### The API image stopped building — the TypeScript compile outgrew Node's default heap (2026-09-15)

`docker compose build api` began failing at `nest build` with
`FATAL ERROR: Ineffective mark-compacts near heap limit`, exit 134. Nothing in
the build was wrong; the compile had simply crossed a ceiling nobody set.

The number to know is that **Node sizes its default heap from the container's
view of memory, not the machine's**. The Docker VM has 7.6 GiB and 16 CPUs, and
`node:22-slim` inside it still reports a `heap_size_limit` of **2096 MB** — the
compile died at 2041. So the host having plenty of RAM says nothing about
whether this build fits, and it will fail identically on a bigger machine.

`ENV NODE_OPTIONS=--max-old-space-size=4096` on the `build` stage is the fix.
It is scoped to that stage deliberately: nothing inherits from `build` (the
runtime stage derives from `base` and only `COPY --from=build`s artifacts out),
so the running app keeps the default, which it has never come near.

- [x] **The Render build runs the same compile and this fix does not reach it (`INFRA` · `T1`)**
      `render.yaml` is `runtime: node` with its own `buildCommand`, so it never
      reads the Dockerfile — `npm run build` there is still on whatever heap the
      free plan's builder hands it. Either set `NODE_OPTIONS` on the service or
      move the ceiling into the `build` script itself; a script-level value
      needs `cross-env` to survive a Windows `npm run build`, which is why it
      went in the Dockerfile first.
      Done 2026-09-22 in the script, and the box was wrong that it needs
      `cross-env`: `"build"` is now `node --max-old-space-size=4096
      node_modules/@nestjs/cli/bin/nest.js build`, a direct node invocation that
      works in sh and cmd alike, and the tsc builder compiles in-process so the
      flag reaches the compile. Deliberately **not** `NODE_OPTIONS` in
      `render.yaml` — Render env vars apply at runtime too, and a 4GB ceiling on
      a 512MB instance trades a heap error for an OOM kill. `check:di`,
      `schema:check` and `schema:generate` still call bare `nest build`; route
      them through the flag if one of them ever hits the ceiling.

### A BullMQ dedupe job id may not contain `:` (2026-09-15)

`createStoreImport` returned INTERNAL_SERVER_ERROR for every store import. The
cause was a job id built as `scan:<id>` — BullMQ reserves `:` for its own Redis
keys and rejects a custom id holding one, but only when the id is not
*precisely* three colon-separated parts, a compatibility carve-out for old
repeatable jobs. So `scan:<id>` threw while `insights:<id>:<day>` beside it
passed, and the number of colons was the only thing deciding it. Three ids were
dead (`scan`, `commit`, `transfer`) and three more were alive only by that
accident (`insights`, `tg`, `cart-recovery`). All six now build through
`dedupeJobId` in `queue.constants.ts`, which joins on `-`, strips a `:` arriving
inside a segment and refuses an empty one. Verified against real BullMQ on the
live Redis: the old ids throw the reported error, the new ids do not. Nothing
reads a dedupe id back, so the format change cost at most one duplicate job for
keys already queued. Documented in `07_background_jobs`.

### `Button` derives Base UI's `nativeButton` from `render` (2026-09-15)

A `render={<Link />}` button is an `<a>`, but Base UI's `nativeButton` defaults
to `true` regardless — so the primitive put `type="button"` on the anchor
instead of `role="button"`, installed a `<button>`'s keyboard model rather than
the one that steps aside for a link's own Enter, and logged a console error from
every screen carrying one (reported from the store-import progress screen).
About 30 call sites had learned to pass `nativeButton={false}`; 12 files had
not, each a latent error. `Button` now derives it — anything not literally an
intrinsic `<button>` in `render` is not native — so the ~190 call sites are
asked for nothing, and an explicit prop still wins for the function form of
`render`, whose output cannot be inspected. `button.render.test.tsx` pins the
cases apart.
