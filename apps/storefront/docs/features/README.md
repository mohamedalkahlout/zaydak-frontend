# Storefront Feature Docs

One standardized doc per feature in `apps/storefront/src/features/`. Each covers:
overview, screens/routes, a diagram, components, state and forms, GraphQL
operations, validation, and the main files. `tenancy` is the one exception — it
is shared infrastructure rather than a feature folder, and it is documented in
the same shape because every other feature's links and queries run through it.

App-level guidance — the URL-as-shop-scope rule, the inverted route guard, the
money rule and the fragments rule — is in [../../README.md](../../README.md).

| Feature | What it does |
|---------|--------------|
| [tenancy](tenancy.md) | Which shop a request belongs to. A storefront answers at `zaydak.com/acme/...`, `acme.zaydak.com/...` and a merchant's own domain; this resolves the host first (a custom domain from the back-end's verdict, handed to the browser on `<html data-host-shop>`), rewrites a shop hostname onto the `/[shopSlug]` tree, and hands every link the `base` prefix that is correct at each. Shared infrastructure, not a feature folder. |
| [shop](shop.md) | Shop identity: the directory at `/`, the shop chrome (header, footer, closed-shop screen) and the shop home page. Owns the shop query every other feature reads currency and name from. |
| [catalog](catalog.md) | Browsing and reading products: the grid with URL-driven filters and infinite scroll, the product page with its variation picker and gallery, and the public reviews list. |
| [negotiation](negotiation.md) | Product-page negotiate chat and cart line for AI-negotiated offers (engine prices only; no floor on the client). |
| [cart](cart.md) | The cart, anonymous or signed-in: add, change quantity, remove, discount codes, and the server-computed summary every screen renders. |
| [assistant](assistant.md) | The shop's assistant as a pill on every page and a panel over the shop — an overlay rather than a route, so asking never navigates a shopper away from what they are asking about. Answers in prose plus **cards**: the products it surfaced and a receipt for anything it added to the cart, both built from the back-end's record of what the tools returned rather than parsed from the reply. Nothing is stored; the panel holds its own transcript. |
| [wishlist](wishlist.md) | Saving products for later. The heart on every tile and the saved-items page. |
| [addresses](addresses.md) | The customer's address book at `/account/addresses`, and the picker checkout chooses from. Owns the address shape both order mutations send. |
| [checkout](checkout.md) | Address, payment route and placing the order: `verifyCheckout` prices it, `createOrder` commits it, Stripe takes over from there. Also the public `/pay/[token]` page a card order placed in a WhatsApp chat is paid from. |
| [orders](orders.md) | Order history, order detail (which doubles as the confirmation screen), and cancelling. |
| [auth](auth.md) | Customer sign-in by phone and a texted code (no password, no email sign-in, sign-up is the same step), the account hub with the customer's details, and the sign-out that keeps the shopper in the shop. |
| [contact](contact.md) | Writing to a shop without an account, at `/[shopSlug]/contact`. Built around one property: every outcome except the rate limit renders the **same** confirmation, because the back-end answers a known address, an unknown one, a tripped honeypot and a blocked body identically and a client that varied would give that back. |
| [telegram](telegram.md) | Opting in to order updates on the shop's own Telegram bot — one card on the order screen and the account hub, which renders nothing unless the shop has a bot and the customer has not already opted in. |
