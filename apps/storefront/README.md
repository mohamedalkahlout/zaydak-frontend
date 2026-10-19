# storefront

The customer-facing shop. Port **3003**.

A storefront answers at **two addresses**, and both render the same route tree:

```
zaydak.com/acme/products/mug     path mode — the shop is the first path segment
acme.zaydak.com/products/mug     host mode — the shop is the hostname label
```

One deployment serves every storefront either way. On a shop's own hostname
`proxy.ts` rewrites the path **internally** to `/acme/products/mug`, so the route
tree, `params.shopSlug` and the `X-SHOP` header are unchanged and the address bar
keeps showing the short URL. Platform subdomains only: a merchant's own domain
(`nike.com`) is **not yet implemented**. The mechanism in full is in
[docs/features/tenancy.md](docs/features/tenancy.md).

```bash
npm run codegen   # GraphQL types from ../../back-end/src/schema.gql
npm run dev       # http://localhost:3003
npm run build
npm run typecheck
npm test
```

## Routes

The `Route` column is the internal route tree, which both addresses reach. On a
shop's own hostname the `/[shopSlug]` prefix is absent from the browser URL —
`/checkout`, not `/acme/checkout`.

| Route | What it is | Session |
|-------|-----------|---------|
| `/` | Shop directory. The only route with no shop scope, and apex-only: on a shop's own hostname `/` is that shop's home. | public |
| `/[shopSlug]` | Shop home — hero, facet chips, product rails, collection bento, new arrivals. | public |
| `/[shopSlug]/products` | Catalogue: search, filters, sort, paging. | public |
| `/[shopSlug]/products/[slug]` | Product page: gallery, variations, reviews. | public |
| `/[shopSlug]/cart` | Cart. Works signed-out. | public |
| `/[shopSlug]/login`, `/register` | Customer auth. | guests only |
| `/[shopSlug]/forgot-password`, `/reset-password` | OTP password reset. | guests only |
| `/[shopSlug]/checkout` | Address, payment, place order. | required |
| `/[shopSlug]/wishlist` | Saved items. Works signed-out — the list is staged in `localStorage` and adopted at sign-in. | public |
| `/[shopSlug]/account` | Account hub. | required |
| `/[shopSlug]/account/addresses` | Saved delivery addresses. | required |
| `/[shopSlug]/account/orders`, `/orders/[id]` | Order history and detail. | required |

## The five things to know before editing

**The address is the shop scope — and it selects the credential too.**
`shared/lib/tenant.ts` resolves it from the hostname first and the first path
segment second — in the browser through `shared/lib/shop-scope.ts`, on the
server through `proxy.ts` — and the Apollo session link turns the answer into
`X-SHOP`. Host first is not a preference: on `acme.zaydak.com/products/mug` the
first path segment is `products`, so a path-only read would send
`X-SHOP: products` on every request to every shop host. A reserved label (`www`,
`admin`, `api` — `shared/lib/reserved-subdomains.ts`, a mirror of the
back-end's list) is never a shop and falls back to the path, so
`www.zaydak.com/acme` still serves Acme.

There is no active-shop store: the vendor dashboard needs one because a vendor
*chooses* between shops, but `/acme/products/mug` and
`acme.zaydak.com/products/mug` are both Acme's mug and cannot be anything else.
Deriving it removes the class of bug where a store lags a route change and one
query goes out scoped to the shop the visitor just left — and with two
addresses there are now two ways to go stale, because the hostname carries the
shop too. A derived scope lags neither. Nearly every operation this app calls
sits behind `RequireShopGuard`, so an operation that goes out without the header
does not return less data — it fails.

What a call site writes links with is **`base`**: `/acme` on the apex, `""` on
the shop's own host. Every in-app link is `` `${base}/cart` `` — from
`useShop()`, or `shopPathFor(slug, path)` outside React — rather than
`` `/${slug}/cart` ``, which on a shop host navigates to
`acme.zaydak.com/acme/cart`, is rewritten to `/acme/acme/cart` and 404s. A link to
the shop home carries a trailing slash, `` `${base}/` ``, because in host mode
`base` is empty and an empty `href` is not a link. Links back **out** of the shop
take `marketplaceHref(mode)` instead: on a shop host a bare `/` is that shop's
home, which would loop the closed-storefront screen back onto the shop it is
apologising for.

The same answer picks the **session**. Cookies are named
`shop_{key}_access_token`, the auth store holds a slice per shop, and the token
and `X-SHOP` are resolved together in one link from one read of the slug — two
independent reads used to pair one shop's token with another's header whenever
the URL moved between them. Signing in at `/acme` is therefore not signing in at
`/beta`, and the enforcement is the back-end's: the access token carries a
`shop_id` claim and `ShopHeaderGuard` answers `SHOP_SESSION_MISMATCH` against
any other shop. All storefronts share one browser origin, so the cookie names
buy concurrent sessions and a coherent UI, never isolation.

**The guard is inverted.** The consoles are private by default with a public
allow-list. This app is public by default (`shared/auth/route-access.ts`), with
`checkout` and `account` as the only gated sections. It reads the access cookie
**named for the resolved shop**, so "signed in at another shop" and "signed out
here" collapse into one state and need no new branch — arriving at
`/beta/checkout` while signed in at `/acme` reads as an ordinary sign-in.

`routeDecision` no longer parses the shop out of the path. `proxy.ts` resolves the
tenant once and hands it both the `shopSlug` and the `base` every redirect is
built from, so a redirect never gains or loses a slug segment. Left to parse for
itself on a shop host it would read `checkout` as the shop, find the section
empty, and conclude the page is public — checkout un-gated silently, with no
test failing and nothing in the logs. `isWithinShop(raw, base)` replaced
`isSameShopPath` for the same reason: on a shop host every same-origin path is
within the shop, so `base` is empty there and only the open-redirect checks
remain.

The matcher in `proxy.ts` is a negative pattern because the shop slug is dynamic
— there is no finite list of paths to enumerate — plus one explicit
`/sitemap.xml` entry, which the extension clause would otherwise exclude: without
it a shop host's `/sitemap.xml` falls through to the marketplace index and claims
every other shop's URLs. **`/monitoring` is excluded with `api`**, so Sentry's
ingest tunnel is not rewritten to `/[shopSlug]/monitoring` on a shop host.
`robots.txt` stays excluded and reads the `Host` header
itself. There is also **no role gate**: the back-end's `createOrder` has no
permission check, so any signed-in account can shop, vendors included.

**Money is never computed here.** `verifyCheckout` prices the order — subtotal,
shipping, tax, discount — and the client renders what comes back. The one
scaling from integer cents to major units happens in `shared/lib/format.ts` and
nowhere else. `Shop.currency` exists on the API so a price is never rendered in
a guessed currency; while it is loading, `ProductPrice` shows a placeholder
instead of a number.

**Shared selections are GraphQL fragments, not template strings.**
`graphql-codegen` extracts `gql()` arguments statically, so a `${...}` inside
one makes the operation invisible to it — it silently generates no types and the
document falls back to `unknown`. `fragmentMasking` is off in `codegen.ts` so a
fragment's fields read inline. **Tests are not codegen documents**
(`!src/**/__tests__/**`, `!src/**/*.{test,spec}.{ts,tsx}`, in all three apps): a
test's own probe document is typed by nothing and must not decide whether the
app's codegen passes — one selecting a field the schema lacks once stopped it —
nor ship in the production `gql.ts` map.

**Public pages fetch on the server; user-shaped data does not.** See below.

## Server rendering

Every public route — the directory, a shop's home, the catalogue, a product —
starts its queries on the server and ships finished HTML. The private ones
(cart, checkout, account, orders, wishlist) stay client-fetched, because they
are per-visitor, need a token, and no crawler should see them anyway.

The mechanism is three pieces:

1. **`shared/apollo/rsc.ts`** — a `react-server`-only Apollo client registered
   with `registerApolloClient`, which wraps `makeClient` in React's `cache()`
   so each request gets its own instance and its own normalized cache.
2. **`<PreloadQuery>`** in the page or layout starts the query during the RSC
   pass and streams the result into the browser's cache. It never awaits the
   network, so nesting several of them runs them in parallel, not in sequence.
3. **`useSuspenseQuery`** in the client component reads it back. It resolves
   against the stream rather than opening a request, which is what puts the
   content in the markup.

The last step is the one that is easy to get wrong: **`useQuery` does not work
here.** It does not suspend, so during the server render it returns
`loading: true` and the skeleton is what lands in the HTML — the data arrives
after hydration exactly as before, and every crawler that does not run
JavaScript still sees an empty page. If a preload appears to do nothing, check
that the reader is `useSuspenseQuery` and that its variables are byte-identical
to the preload's.

**When a preloaded query fails, the browser is told almost nothing.**
`@apollo/client-react-streaming` puts a contentless `{ type: "error" }` marker
into the stream it tees to the browser, and the SSR half rethrows it as the
fixed string *"Error from event stream. Redacted for security concerns."* React
reports a recoverable error and re-renders the subtree on the client. The
redaction is deliberate — a server error must not be handed to a browser
verbatim — but it names neither the operation nor the cause, so the two things
that make it readable are both on this side:

- **`rsc.ts` carries an `ErrorLink` that logs.** It prints
  `[storefront RSC] <Operation> failed: <message> [<error_code>]` to the server
  terminal, with the HTTP status for a `ServerError` and the endpoint for a bare
  network failure. It only logs; the error propagates as before. Before it
  existed a storefront page could degrade to client rendering with the cause
  recorded nowhere — and the most common cause is the API being down,
  restarting, or having thrown on schema drift at boot, which from the browser
  looks exactly like a front-end bug.
- **Every `useSuspenseQuery` that reads a preload sets `errorPolicy: "all"`.**
  A throw during the RSC pass costs the whole subtree its server rendering, so a
  failing read hands its error back instead and the component renders its own
  empty or "could not load" state. All nine reads do this.

Two rules constrain what may be preloaded:

- **The server client carries no credentials.** Everything preloaded is a public
  read behind `OptionalJwtGuard`. A server client that could authenticate is one
  that can serve one visitor's data to another out of a shared cache.
- **The shop scope is an argument, never ambient.** `currentShopSlug()` reads
  `window.location` — host first, then path — plus, on a merchant's own domain
  (whose hostname names no shop), the shop the proxy resolved and the root
  layout wrote on `<html data-host-shop>`. It has no server
  equivalent by design: a module-level "current shop" is shared by every request
  in flight in the process, so setting it and then awaiting hands that scope to
  whatever renders in the gap. Server reads pass the slug through
  `storefrontContext(slug)`, which puts `X-SHOP` on that one request; every server
  component under `/[shopSlug]` already has the slug from `params`, which the
  internal rewrite keeps true on a shop host too. The one thing the server cannot
  re-derive is the *mode* — after the rewrite the two addresses are
  deliberately identical — so the proxy stamps it on the request and
  `serverTenant(shopSlug)` (`shared/lib/tenant-server.ts`) reads it back, for the
  three things that must still differ: the link prefix, the canonical origin, and
  the paths `robots.txt` names.

`robots.ts` and `sitemap.ts` are the other half of the same change, and both now
answer per host. On the apex the sitemap lists every approved shop's home,
catalogue and products, bounded at 500 shops and 1,000 products each and logging
when a bound bites; on a shop host `/sitemap.xml` is rewritten to
`app/[shopSlug]/sitemap.xml/route.ts`, which emits that one shop. `robots.ts`
derives its disallow list from `PRIVATE_SEGMENTS` / `GUEST_ONLY_SEGMENTS` (plus
`cart` and `wishlist`, public but per-visitor) so it cannot drift from the route
guard, and it shapes the patterns for whichever host asked — `/*/checkout`
under the apex, `/checkout` on a shop host, where the wildcard form would match
nothing and leave every private page open with nothing in the output looking
wrong.

Absolute URLs all come from **one** function, `shopUrlBase(slug)` in
`shared/lib/site-url.ts`: both sitemaps, the canonical tags on the shop layout,
the catalogue, the product page and the policies pages, the OpenGraph URLs, and
`ProductJsonLd`'s `shopUrl`. It prefers the shop's own host, so the apex's
`/acme/products/mug` names `acme.zaydak.com/products/mug` as canonical rather than
itself. Path URLs keep serving 200 — the apex never redirects, because
`zaydak.com/acme` is the marketplace's own browsing surface and bouncing it would
send every click in the shop directory off the marketplace; the canonical tag is
what collapses it with the shop's own address for crawlers. Host mode is
different: once a merchant promotes a custom domain, the platform subdomain and
every alias `308` to it, path and query intact. The verdict comes from the
back-end through `shared/lib/domain-request.ts`, never from a rule written here. The root
layout's metadata is a `generateMetadata` so `metadataBase` can be the request's
own origin rather than a value inlined at build time.

Two env vars, and the second is optional. `NEXT_PUBLIC_SITE_URL` is the apex
origin. `NEXT_PUBLIC_ROOT_DOMAIN` is the apex hostname, and leaving it unset means
there is no second address at all: `shopUrlBase` degrades to the path form and the
app behaves exactly as it did before shop hostnames existed. The two root-domain
exports in `shared/lib/hostname.ts` are not interchangeable. `ROOT_DOMAIN` is the
**read** path and defaults to `localhost`, so `demo.localhost:3003` works in
development with no env file and no real production host ever matches it.
`CANONICAL_ROOT_DOMAIN` is the **write** path and stays null until the variable is
set, because with that same default an unconfigured deployment would publish
`http://acme.localhost` as the canonical URL of every page.

Error reporting is opt-in and env-only. Copy `.env.example` and leave the five
Sentry keys empty until a dedicated storefront project exists. Set
`NEXT_PUBLIC_SENTRY_DSN` (browser) and/or `SENTRY_DSN` (Node/edge). Unset, every
`Sentry.init` is a no-op — there is no hardcoded fallback. Use a storefront
project, not the vendor dashboard's DSN. Source-map upload needs `SENTRY_ORG`, `SENTRY_PROJECT`,
and `SENTRY_AUTH_TOKEN` at build; leave the token off local machines. The ingest
tunnel is `/monitoring`, excluded from the proxy matcher so a shop host does
not rewrite it. Client init lives in `src/instrumentation-client.ts`; the
matching `error.tsx` / `global-error.tsx` / `[shopSlug]/error.tsx` report
through `Sentry.captureException`.

## Design

The app re-skins `@repo/ui` rather than forking it: `app/globals.css` redefines
the shared tokens (warm paper ground, ink type, one commerce accent, softer
radius) so all ~40 primitives change at once. Storefront-only tokens are
prefixed `--shop-*` and exposed to Tailwind as `bg-shop-accent`,
`text-shop-sale`, `border-shop-hairline`. Latin UI uses the SF system stack
(`--font-heading`); Arabic uses Tajawal, loaded by `next/font` and bound
to `--font-tajawal` in the root layout — the same face as the rest of the
platform.

The **product tile is a photograph, not a panel**: the image fills a fixed
frame and the caption sits over its lower third on a scrim, with a white pill
button along the bottom edge. Everything on it is coloured through the
`--shop-photo-*` tokens, which are the one set here with **no dark-mode
counterpart** — a photo is the same in both themes, so a caption that flipped
with the page would be wrong in exactly one of them. `ProductPrice`'s `photoBare` tone is
part of that set. It is **tight**: it shares the tile's last line with the
add-to-cart button, so it takes the locale's narrowest currency marker and
leaves the markdown to the badge on the picture. That line stacks under a
`15rem` **container** query rather than a screen breakpoint, because the
catalogue grid and the home rail are different widths at the same viewport.

Three consequences of a tile being a photograph, all in `CardPhotos`. The scrim
is painted on the **caption box** rather than the frame, so its height is the
caption's and a product with little to say keeps more of its picture. A product
with **no** photograph is given a colour by `cardTint` instead of a void, since
a grid of identical dark slabs reads as a broken page. And a sold-out one goes
grey, which is the only sold-out signal legible across a whole grid. The tile
also carries a small gallery off the same `gallery` blob the product page
reads, scrubbed by pointer position on a mouse and tapped through dots on
touch, fetching nothing past the first photo until it is asked for.

The page is held between two hard edges: the **notch header**
(`shared/components/notch-nav.tsx`, `--shop-notch-*`) and the footer slab
(`--shop-footer-*`). They are separate token sets on purpose, and in light mode
they no longer share a ground: the header is white (it overlays the home hero,
where a near-black bar reads as a second header laid over the artwork rather
than as a shape cut out of it) while the footer stays a slab of ink. In dark
mode both are near-black. Each also carries different furniture — a sliding
pill behind the active link, against an accent field and a rule.
