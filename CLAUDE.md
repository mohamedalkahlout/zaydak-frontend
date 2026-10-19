# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

A Turborepo monorepo. The frontend apps are npm workspaces under `apps/`; shared config lives in `packages/`. **The NestJS API in `back-end/` is deliberately NOT a workspace member** — it keeps its own `package-lock.json` and is installed/built on its own by Render (`rootDir: back-end`).

```
zaydak/
├── apps/
│   ├── vendor/              # Next.js dashboard (workspace: "vendor", port 3001)
│   ├── admin/               # Next.js admin console (workspace: "admin", port 3002)
│   └── storefront/          # Next.js customer shop (workspace: "storefront", port 3003)
├── packages/
│   ├── ui/                  # @repo/ui — shared components, design tokens, `cn`
│   ├── storefront-templates/ # @repo/storefront-templates — doughn, drip, rail, hullo, personne, jurat presentation
│   ├── eslint-config/       # @repo/eslint-config  — flat config, "./next" + "./base"
│   └── typescript-config/   # @repo/typescript-config — base / nextjs / react-library
├── back-end/                # NestJS API (standalone, own lockfile)
├── turbo.json
└── package.json             # workspaces: apps/*, packages/*
```

| Directory | Stack | Purpose |
|-----------|-------|---------|
| `back-end/` | NestJS + GraphQL (code-first, Apollo 5) + REST + Prisma 7 + PostgreSQL | The API. Owns all data and business logic. |
| `apps/vendor/` | Next.js 16 (App Router) + React 19 + Apollo Client 4 + Zustand + zod | The dashboard where shop owners manage their store. Calls the back-end over GraphQL. |
| `apps/admin/` | Same stack | Platform administration console. `admin` and `super_admin` share it. Sends no `X-SHOP` header. |
| `apps/storefront/` | Same stack | The customer-facing shop. One deployment serves every storefront, scoped either by the first path segment (`/{shopSlug}`) or by a platform subdomain (`{shopSlug}.{root}`). |

Each sub-project has its own `CLAUDE.md` or `README.md` with detailed guidance. **Read the relevant one before working in that project.** Onboarding docs live in `docs/` (root index), `back-end/docs/`, `apps/vendor/docs/`, and `apps/storefront/docs/`.

### packages/storefront-templates (`@repo/storefront-templates`)

Just-in-time, like `@repo/ui`: raw `.ts` / `.tsx` / `.css`, so vendor and storefront list it in `transpilePackages` and `@source` it from their Tailwind entry. It holds the doughn, drip, rail, hullo, personne, and jurat presentation (markup, CSS, motion, fonts, art) and each template's checkout frame. Exports are per template (`@repo/storefront-templates/drip`, `…/drip/checkout`, `…/doughn/theme`). It takes products, cart lines, and copy as props. It does not import Apollo, Zustand, `next-intl`, or `@/features/*`. Cart, checkout, and catalogue mapping stay in the storefront. The template picker, `/theme-preview/[templateId]`, and the theme editor stay in the vendor app. It is not part of `@repo/ui`.

### packages/ui (`@repo/ui`)

A **just-in-time** package: it exports raw `.tsx`, so every consuming app must list it in `transpilePackages` and add `@source "<relative>/packages/ui/src"` to its Tailwind entry (Tailwind skips `node_modules`).

Exports are per-file — there is no barrel:

```ts
import { Button } from "@repo/ui/components/button"
import { cn } from "@repo/ui/lib/utils"
import { useIsMobile } from "@repo/ui/hooks/use-mobile"
```
```css
@import "@repo/ui/styles.css";   /* design tokens + base layer */
```

What belongs here: the 38 shadcn-style primitives, `cn`, `use-mobile`/`use-hydrated`, the design tokens, the **presentational** shell (`site-header`, `app-sidebar`, `nav-main`, `unsaved-bar`, `locale-switcher`, `sidebar-toggle-icon`), and the auth frame both apps sign in through (`auth-shell` on its `shader-background` mesh-drift ground, plus `auth-heading` for the screens inside it). That card is a **`.light` island**: `tokens.css` re-declares the light palette on `.light` and narrows the `dark` variant to `&:is(.dark *):not(:is(.light, .light *))`, so every token-styled control inside it — inputs, the `bg-card` "Or" pill, muted type — stays light under a dark `<html>`. The card was already a hardcoded `bg-white`, so before this the two disagreed in exactly one theme and the separator's pill read as a dark box on a white card. Everything in it is slot-driven and store-free — it reads no Zustand store, calls no GraphQL, and knows no routes. Each app wraps those pieces and injects its own data (see `apps/*/src/shared/components/site-header.tsx`).

`SiteHeader` does **not** require a `SidebarProvider`: it reads the context through `useSidebarOptional()` and renders its mobile toggle only when there is a sidebar above it to toggle. That is what lets the same header serve a screen with no sidebar (the admin's integrations screen). `useSidebar()` still throws — for anything that genuinely needs the sidebar a missing provider is a bug worth failing on. This distinction is load-bearing: the header threw on every request to `/integrations/*` in production while `next build` stayed green, because those routes are dynamic and nothing rendered them until a real request arrived. `site-header.render.test.tsx` pins both cases.

`Button` is **flat** — a face, a border and a focus ring, with nothing painted beneath it. There is no second button component and nothing to opt into; the API is variants, sizes and the focus ring, so all ~190 call sites look the same. The press reads through the face colour alone (`hover:` / `aria-expanded:` on the variant), so there is no ledge `box-shadow`, no sheen, no press travel and no `usePressDepth` hook — a call site's own `transform`/`translate` utilities have nothing underneath to fight with. Since a button paints no depth it never shifts between states, so a disabled or loading one cannot make a row jump. The one prop it does decide for a call site is Base UI's **`nativeButton`**, derived from `render`: a `render={<Link />}` button is an `<a>`, and the primitive's `true` default put `type="button"` on the anchor with a `<button>`'s keyboard model and logged a console error from every screen carrying one — so anything that is not literally an intrinsic `<button>` is treated as not native, and an explicit prop still wins. See `packages/ui/README.md`.

What does **not** belong here: anything importing from `@/features/*`, a store, or `next-intl`. Pass already-localized strings in as props.

`Bones` (`components/bones`) is the skeleton whose shape is **measured**, not hand-drawn — it wraps `boneyard-js`'s `<Skeleton>` and both consoles use it on their analytics screens. It lives here because only one part of it is app-local: the generated bone registry. Each app's `shared/components/bones.tsx` is a two-line re-export whose real job is the side-effect `import "@/bones/registry"`, which must sit in a `"use client"` module — imported from a server layout (what the boneyard docs suggest) it is evaluated during SSR, where `registerBones` does nothing useful.

Two things about it are ours, not the library's, and both exist because of the same sharp edge: **`boneyard-js` resolves bones only from `initialBones` or its generated registry, and says nothing at all when a name resolves to neither.** With no fallback that is a silent empty box, indistinguishable from a broken import — which is exactly how it was first reported. So `Bones` (1) calls the same `snapshotBones()` the CLI uses on its own live subtree once the real content has rendered, caching it per `name` + viewport bucket, so a name works with **no capture step**; and (2) logs a one-line dev warning naming the skeleton when it has nothing to draw. The committed capture is still worth running — it is the only thing that covers a brand-new tab's *first* paint, before any content has rendered, and the only thing that is responsive across breakpoints.

That cache is an **external store rather than a bare `Map`**, which buys two things. It is mirrored into `sessionStorage` in production so a reload paints immediately (validated on read, capped, and deliberately not written in development, where a reload usually follows a layout edit and the pre-edit shape is worse than nothing); and because components subscribe to it, a measurement taken by one instance reaches a **sibling of the same name already on screen**, which a plain `Map` could not do. Hydration happens inside `useSyncExternalStore`'s `subscribe` — client-only and post-commit, so no hydration mismatch and no `set-state-in-effect` exemption. `bones.render.test.tsx` pins the three states apart. Note it deliberately renders **no wrapper element**: two call sites style `[&>[data-boneyard-content]]:h-full` to give a recharts `ResponsiveContainer` a parent with height, so the DOM has to stay identical to plain `<Skeleton>`.

`DitherField` (`components/dither-field`) is the package's shader-as-page-furniture wrapper, over `Dithering` from `@paper-design/shaders-react`. Three things about it are ours rather than the library's, and each exists because the raw component fails silently. It mounts its **WebGL context only while the host is on screen** (`hooks/use-on-screen`) — contexts are a browser-wide resource capped around sixteen, and a decoration at the foot of a page must not hold one on a visit that never scrolls there. It **resolves colours before handing them over**, because the shader parses `#hex`/`rgb()`/`hsl()` and turns everything else — every `oklch()` token in `tokens.css` included — into *opaque black*; `var()` is substituted from `:root` and anything else is normalised through a 2D canvas, re-derived when `<html>`'s class changes. And it **claims the one unhandled rejection** `ShaderMount` produces on a browser with no WebGL2, which is thrown from an un-awaited async call where no error boundary can reach it and Next's dev overlay reports it as a page error. The field always layers *over* the host's own background, so every failure path degrades to the plain surface. First use was the storefront's inverted footer slab; that footer is now a white slab and draws none, so the cart's coupon ticket is the remaining consumer. See `packages/ui/README.md`.

`FilterBar` (`components/filter-bar`) is the segmented filter row both consoles' list screens share — one chip per applied filter reading *field | operator | value*, each segment its own menu, plus a dashed button that adds another. It is fully controlled, and the one rule a caller must not break is **deriving `value` from the screen's existing filter state on every render**: a chip that has just been added carries no values yet, so a derived array drops it the instant it appears and the add-then-pick flow can never complete — the chips are the state, and the query is derived from them, not the other way round. Each segment owns its own Base UI `Popover` rather than the bar sharing one portal, which is what makes the menus land correctly under a right-to-left `dir` with nothing to mirror by hand, and what stops a chip being removed from taking an open popup's anchor with it. Async values are fetched from the handler that opens the menu rather than from an effect (`set-state-in-effect` is an error here), and replies are sequence-numbered behind a 250ms debounce, so the answer to a query nobody is typing any more is dropped rather than rendered. Each app wraps it once (`apps/*/src/shared/components/filter-bar.tsx`) to inject the `filterBar` message namespace, so a screen passes only its own fields. See `packages/ui/README.md`.

Add new shadcn primitives to this package with `npx shadcn@latest add <name> -c packages/ui`. Every `components.json` (both apps and the package) points `ui` at `@repo/ui/components` and `utils` at `@repo/ui/lib/utils`, so the CLI can never write an app-local copy that shadows the shared one.

The frontend talks to the back-end at `NEXT_PUBLIC_GRAPHQL_URL` (default `http://localhost:3000/graphql`), sending a Bearer token and an `X-SHOP` header (the shop slug from the URL). Frontend GraphQL types are generated from `back-end/src/schema.gql` via codegen.

---

## Monorepo commands (run from the repo root)

`npm install` at the root installs every workspace. Do **not** run `npm install` inside `apps/vendor` — it belongs to the root lockfile. `back-end/` is the exception: install it separately with `cd back-end && npm install`.

```bash
npm install                        # install all workspaces (NOT back-end)
npx turbo run dev                  # dev servers for every app
npx turbo run build                # build every app (cached)
npx turbo run lint typecheck test  # whole-repo checks
npx turbo run build --filter=vendor   # scope any task to one workspace
```

Adding a package: create `packages/<name>/package.json` named `@repo/<name>`, then declare it as `"@repo/<name>": "*"` in the consuming app and re-run `npm install` at the root.

**`npm run lint` is green and gates CI** (re-verified 2026-09-23). It has been red three times: 88 errors in August, 28 again by mid-September (18 in `apps/storefront`, 8 in `apps/vendor`, 2 in `apps/admin`), and 8 in `apps/vendor` by 2026-09-22 (React Compiler memoization, `set-state-in-effect`, refs during render, `any`) — each time meaning no rule it enforces could gate anything. 93 warnings remain in `apps/vendor`, 15 in `apps/admin`, 11 in `apps/storefront`, 1 in `packages/ui`, and are not gated.

The back-end has the same trap in a different place: its jest runs ts-jest with isolated modules, so **specs are never type-checked by the test run**, and `npm run typecheck:all` (a CI step) had quietly gone to 54 errors at HEAD — including tests that referenced an undefined fixture or a removed enum member and so tested nothing. It was taken to zero on 2026-09-23. Run `npx tsc --noEmit` in `back-end/` after touching specs; a green jest run says nothing about types.

Measure it with **`npx turbo run lint --continue`**. Without `--continue`, turbo halts at the first failing task and reports the two errors in `apps/admin` when there are twenty-eight — which is how a red repo reads as almost-green. The same applies to `npx turbo run test`. And note that `back-end/` is not a turbo workspace: neither command sees it, and its CI job runs no lint at all.

Most of those errors were the React Compiler rules, and the fixes are worth knowing because the same three shapes will come up again:

- **`set-state-in-effect`** — the "seed a dialog's form when it opens" effect. Replaced by React's **adjust-state-during-render** pattern: compare against a `seededFrom` state value and set during render, so React discards the render and re-runs rather than committing one frame with the previous row's values in the inputs. The genuine exception is **restoring persisted state after hydration** (`signup-wizard`, `use-vendor-agent`): a `useState` initializer cannot read `sessionStorage`/`localStorage` without a hydration mismatch, so those keep an effect and a written-out `eslint-disable`.
- **`refs`** — a ref read during render. Usually the value belonged in state all along (`bulk-inventory-editor`'s dirty flag also drove the amber ring; `file-detail-sheet`'s server snapshot fed every dirty comparison). Latest-callback refs move their write into an effect.
- **`purity`** — `Date.now()` in the render body. Anchored in state instead; on `usage-page` it was also an Apollo variable, so it changed identity every render and the cache could never serve the window.

Media-query hooks (`use-mobile`, `use-is-breakpoint`) are now `useSyncExternalStore` rather than `useState` + effect, and `theme-toggle-button` reads `<html class="dark">` through a `MutationObserver` — which also fixes it missing the class being changed from anywhere else.

**The Tiptap editor scaffold is exempt**, by an explicit path list in `apps/vendor/eslint.config.mjs`. It is upstream code we do not maintain, and fixes in place would be rewritten by the next sync. Test files may use `any` (override in `@repo/eslint-config/next`). Anything outside those two boundaries is held to the rules.

---

## back-end/ (NestJS API)

See [back-end/CLAUDE.md](back-end/CLAUDE.md) for full details (modules, guards, patterns, env vars).

```bash
cd back-end
npm run start:dev       # Watch mode (GraphQL at http://localhost:3000/graphql)
npm run build           # Compile TS + copy assets (i18n, mail templates, fonts)
npm test                # Jest unit tests
npx jest "auth.service" # Run a single test file by pattern
npm run seed            # Seed all data
npm run lint
npx prisma generate     # Regenerate Prisma client after schema changes
```

**Key patterns:** `X-SHOP` header for shop scoping, `SOFT_DELETE_WHERE` constant, `serializeJson()` for JSON fields, `AuditLogService` for mutation logging, BullMQ queues on Redis, Sentry for errors.

---

## apps/vendor/ (Next.js dashboard)

See [apps/vendor/CLAUDE.md](apps/vendor/CLAUDE.md) (which points to [apps/vendor/AGENTS.md](apps/vendor/AGENTS.md)) for full details.

```bash
cd apps/vendor
npm run codegen         # Generate GraphQL types from ../../back-end/src/schema.gql
npm run dev             # Dev server (http://localhost:3001)
npm run build           # Production build
npm test                # Vitest
npm run typecheck       # tsc --noEmit
```

**Key patterns:** feature folders under `src/features/`; the **mandatory contextual save bar** for all edit screens (stage locally, never auto-save — see `apps/vendor/AGENTS.md`); Apollo Client with links that attach the token, `X-SHOP`, and locale; global state in three Zustand stores (`auth`, `active-shop`, `unsaved-bar`); forms validated with zod; English/Arabic via next-intl.

**Every string a merchant reads goes through next-intl — no English literals in components, and no hand-rolled `isAr ? "…" : "…"`** (the 2026-09-28 sweep moved ~1,900 of them into the catalogues: 4,301 → 6,382 messages per language, across ~350 files, the Tiptap editor's toolbar included). Messages are split one file per namespace: `src/shared/messages/{en,ar}/<namespace>.json`, assembled by each folder's `index.ts`; a new namespace is a file in both folders plus a line in both indexes, and `messages-parity.test.ts` fails if either is missing. zod schemas take a translator (`Translate`) and zod's own default messages follow the dashboard language (`ZodLocale`); code outside React uses `translatorFor()` from `shared/i18n/outside-react.ts`; country names come from `regionName()` (`shared/lib/country-name.ts`). Rules and patterns in `apps/vendor/AGENTS.md`.

**Images go through `src/shared/components/app-image.tsx`, never `next/image` directly** (a `no-restricted-imports` rule in `eslint.config.mjs` enforces it, and the storefront has its own copy of both). `next/image`'s loader *throws* on a host missing from `images.remotePatterns`, and in the App Router that throw is caught by the nearest `error.tsx` — one imported product thumbnail on `burst.shopifycdn.com` turned all of `/store/[shopSlug]/products/**` into "Failed to load products". Catalogue URLs are stored by the Shopify CSV importer exactly as the file carried them, so an unlisted host is normal input rather than a misconfiguration; the wrapper derives `unoptimized` from the src, keeping the optimizer for the hosts the config lists and degrading the rest to a direct browser fetch. `canOptimize` mirrors `remotePatterns` because `/_next/image` checks that list server-side too — add a host in both or in neither. Do **not** reach for `images.loader: "custom"` here: configuring one turns the `/_next/image` endpoint off entirely.

---

## apps/admin/ (Next.js admin console)

```bash
cd apps/admin
npm run codegen         # Generate GraphQL types from ../../back-end/src/schema.gql
npm run dev             # Dev server (http://localhost:3002)
npm run build
npm run typecheck
npm test                # Vitest
```

The platform console. `admin` and `super_admin` sign into the **same** app; the back-end still enforces the finer distinction per operation through `@RequirePermissions`.

**Key patterns:** it deliberately mirrors the vendor dashboard's auth layer rather than sharing it — same cookie split (`refresh_token` httpOnly, `access_token` readable + short-lived), same `/api/auth/{session,refresh}` routes, same `proxy.ts` route guard. It differs in two ways: **no `X-SHOP` link** (platform-scoped) and **no `active-shop` store**. Operations live in `src/features/<name>/api.ts` and use the codegen `gql` tag, so they are `TypedDocumentNode`s — no generic argument on `useQuery`/`useMutation`.

The **role gate** lives in the login screen (`isAdminRole`, `src/shared/auth/roles.ts`) and runs *before* the session cookie is written. It is a UX guard, never the security boundary — `proxy.ts` only checks that a cookie exists and never decodes the JWT. **Every authed route must be added to `proxy.ts`'s `matcher`** — a route absent from it is never seen by the guard.

Screens: `(auth)/{login,forgot-password,reset-password,verify-otp}`, `/analytics`, `/users`, `/shops`, `/withdrawals`, `/commissions`, `/plans`, `/subscribers`, `/integrations`, `/otp-logs`, `/settings/otp`. English/Arabic via next-intl (cookie-resolved, no `/[locale]` segments).

**`/analytics` is the platform's own reporting screen, and it adds no back-end.** Every figure comes from operations the vendor dashboard already calls — the trick is that this app sends **no `X-SHOP`**, so `AnalyticsResolver.resolveShopId` returns `undefined` and the service's `shopFilter(undefined)` omits the shop predicate, making the same aggregates cover the whole marketplace. `ShopOwnershipGuard` would normally block that and returns early for `admin`/`super_admin` on purpose. The resolver carries **no plan gate** — as of 2026-09-24 analytics is on every plan and the `analytics.reports` capability no longer exists — but `FeatureGuard` still returns true for those roles when there is no shop, because platform staff are not consuming a shop's plan. Adding a `@RequireFeature` to a resolver an admin screen depends on would otherwise break it silently — that early return is what prevents it.

What makes the screen admin-specific rather than a copy of the vendor dashboard is the **cost half**: `usageSummary` and `usageTopShops` (gated on `manage_plans` alone) expose `cost_cents`, what the platform paid a provider for a metered call. That is our margin against a shop's subscription, and the vendor's own `myUsageEvents` is an explicit pick with the field removed — it exists nowhere they can reach. `analytics.total_vendors` is the same kind of field: the back-end only populates it for an admin caller. Rows in "top shops by cost" link to `/subscribers/[shopId]/usage`, so an outlier is one click from the events behind it.

Two things to know before editing it. **Every figure on the screen is now integer cents** — as of 2026-09-12 `analytics`/`yearlySales`/`topProducts` return `*_cents` `Int` fields alongside `usageSummary`/`usageTopShops`'s `cost_cents`, so the screen no longer carries two money units and `formatMajorAmount` is gone. Scaling happens only inside a named formatter (`formatAmountCents`, `formatCompactCents` in `features/analytics/lib/analytics.ts`) and nothing divides by 100 inline. The one deliberate exception lives elsewhere: the vendor agent's **tool** payloads still convert to major units at the tool boundary, because a tool result is read by the LLM, which writes prose with a currency symbol and has no formatter. And **the monthly revenue bars are CSS, not a chart library**: the admin console ships no recharts, and twelve labelled bars did not justify adding ~500KB to this bundle for one panel.

**`/users` is where accounts are created, suspended and deleted.** Suspension (`is_active: false`) and soft deletion (`deleted_at`) are separate states of the same row and the screen shows both — a suspended account that vanished from the list could never be reactivated — so `accountStatus()` reads `deleted_at` first, because deleting also clears `is_active`. Suspending revokes the account's refresh tokens; an access token already issued survives until it expires, which is what the confirm dialog says rather than promising an instant lockout. The row actions mirror two server rules in `canManage()` (`features/users/types.ts`): nobody acts on their own account, and only a `super_admin` acts on — or creates — an `admin`/`super_admin`. That mirror is UX only; `UsersService`'s `assertNotSelf` / `assertMayTarget` / `assertMayAssignRole` are the boundary. The caller's own id and role come from the `me` query, since the auth store holds tokens and nothing else.

**`/shops` is the same screen for storefronts, and it sits next to `/users` because a shop is an account's other half.** It lists, searches, creates, approves, suspends, deletes and restores. What makes it more than `/users` with different columns is that a shop has **three** independent columns, not two: `is_approved` (the platform's verdict), `is_active` (the storefront switch) and `deleted_at`. `shopStatus()` (`features/shops/types.ts`) collapses them in that precedence — `deleted_at` first because deleting also clears `is_active`, then `is_approved`, and only then `is_active` decides active from suspended.

The two flags gate genuinely different things, and that is the thing to know before touching either: **`is_approved` gates only the public directory** (`shops`, `shop(slug)`), while `ShopHeaderGuard`, product resolution and the cart all read **`is_active`**. Writing one without the other is broken in both directions, which is why `approveShop` now sets both to `true` and `disapproveShop` both to `false` — approving alone listed a shop publicly with every product query behind it failing (and the console labelled it "Suspended", because that is what approved-but-inactive is), and disapproving alone only hid it from the directory while anyone holding a direct link kept shopping.

Creating a shop from here is `adminCreateShop`, a separate mutation rather than a flag on `createShop`: `createShop` binds the shop to the caller and gates on `create_shop`, which an `admin` deliberately does not hold. It names `owner_id` — the dialog's owner picker reuses the `USERS` query — and promotes a `customer` owner to `vendor` in the same transaction, exactly as self-service signup does. `setShopsActive` and `restoreShops` are gated on `manage_all_shops` **alone**; a second permission beside it would open them to every vendor, since `PermissionsGuard` matches with `.some()`. There is no `adminUpdateShop`, so the screen has no Edit action.

A shop's row menu opens one detail route, **`/shops/[shopId]/domains`** — every address that shop answers at, and **read-only**. The back-end half is `adminShopDomains(shop_id)`, a *separate* resolver rather than an argument on the merchant's `shopDomains`: every operation there is scoped by `X-SHOP` and takes no shop argument, which is precisely what makes it impossible for a merchant to reach another shop's domains, and adding an optional `shop_id` would have put an overridable scope on the one surface whose safety comes from not having one. It is gated on `manage_all_shops` **alone** and carries no `ShopHeaderGuard` (this app sends no header). Read-only is a decision, not a gap: the DNS lives in the merchant's registrar, and an admin promoting or detaching a domain would move where somebody else's shop answers with nothing on the merchant's own screen to say why — so there is no admin mutation to pair with it. The thing the screen exists to say is that the platform subdomain's status is **derived** from `is_active && is_approved` rather than verified: a PENDING platform address is a statement about the shop, not about DNS somebody forgot to set.

`/plans` is the catalog and `/subscribers` is who is paying for it. They were two tabs on `/plans` and are now two routes: a tab is invisible until you have already arrived at the page hiding it, and "the past-due shops" is something an admin sends to a colleague. They still share the `plans` feature folder — same API, same money helpers.

**Every list uses the shared table chrome in `src/shared/components/data-table/`** — the same look as the vendor dashboard's lists, without TanStack Table (admin lists page on the server, so there is no client row model to drive). `DataTableCard` is a white `bg-card` with a quiet ring on the gray dashboard; the filter bar (`DataTableToolbar`) and the pagination bar (`DataTableFooter`) are rows *inside* that card, not floating above and below it. `DataTableHeader`/`Head`/`Row`/`Cell` are the styled `@repo/ui` primitives (sentence-case headers on white, denser `px-3 py-1.5` cells, row hover), `DataTableSkeletonRows` is the first-load placeholder that keeps the card at its settled height, and `DataTablePagination` is numbered paging driven by `meta.page`/`meta.total_pages`. Do not hand-roll a bordered `div` + bare `Table` for a new screen, and do not add prev/next buttons of your own.

**`/integrations/[type]` holds the platform's third-party credentials** (SMS, email, error monitoring, AI chat, AI image & video, WhatsApp, Telegram, shipping, storage) — they move out of `.env` and into `integration_configs`, encrypted with AES-256-GCM by `SecretCryptoService`. One settings screen per integration type, still one route each, because they are configured and linked to one at a time and each is a form with its own unsaved state.

`STORAGE` holds only the Bunny **credentials** (zone, zone password, region, pull zone), resolved per upload by `StorageCredentialsService` with `BUNNYCDN_*` as the fallback; which driver runs (`local` / `bunnycdn` / `s3`) stays the env-only `STORAGE_DRIVER`, and bank-transfer receipts still refuse public Bunny. URLs are baked at write time, so a new pull zone or storage zone affects only new uploads — the form says so. An enabled row that cannot be decrypted fails uploads closed rather than falling back to the env zone, because a silent fallback would bake a URL for the wrong zone into the row for good. `integrationStatus` reports that as `UNUSABLE` with an `unusable_reason` code, not `NONE`. On a server whose `STORAGE_DRIVER` is not `bunnycdn` it also sets `not_in_use_reason`, and the screen says nothing saved there is read, instead of showing the zone as in use; the boot check pages an `UNUSABLE` type (`UNUSABLE_INTEGRATION_IN_PRODUCTION`) unless it is not in use. The state is generic: a type that does fall back shows `ENVIRONMENT` with the reason set, and `UNUSABLE` only when `.env` is empty too. Verify also probes `https://{pull_zone}/`, so a custom hostname whose CNAME is not live yet cannot be saved.

**The screen is shaped like the vendor dashboard's settings overlay**: a left rail card (title, filter, the list of types) beside the content pane, and **no app sidebar**. It renders through `SettingsShell` rather than `DashboardShell` — the rail already is a nav column, and two side by side are two answers to "where am I". What replaces the sidebar is the way out: an X and the Escape key, both landing on `/users`. The Escape handler bails when a `[data-slot=dialog-content]` is mounted, so a confirm dialog's own Escape closes the dialog instead of throwing the admin off the screen behind it. Both shells share `useBfcacheAuthGuard`; a second copy of an auth check is the kind of thing that gets fixed in one place only.

The rail is `IntegrationRail`, rendered by `app/integrations/layout.tsx` rather than by the page, so switching type keeps its filter box and only the pane re-renders. Its entries are `Link`s with the active one derived from `usePathname()` — the vendor's rail swaps panes in local state because its sections *are* panes; here each type is already a URL, and keeping it that way is what preserves linkability and one unsaved form per route. The **Settings** group in the app sidebar therefore holds a single **Integrations** entry: listing the types there as well would put the same three links on screen twice. Cards use `rounded-xl bg-card ring-1 ring-foreground/10` — `--background` is already `#f1f1f1` and `--card` white, so the card-on-grey depth comes from the tokens with no per-page background.

Two rules the screen is built around. The form is rendered entirely from `integrationProviders` — labels, help text, which fields are secret, and a `select`'s options all come from the server, so a provider added on the back-end costs this app nothing; only a new *type* touches `features/integrations/nav.ts`. And **no response ever carries a secret**: a secret input is seeded with the server's mask (`••••1234`) so "something is configured" is visible, and what gets submitted is decided by a `touched` set rather than by comparing strings — nothing can post the mask back as a credential. The env values remain the fallback whenever no provider is enabled, which is why the screen leads with the *resolved* status rather than `is_enabled`.

`MONITORING` (Sentry) is the one type that is not resolved per use — the SDK is a process-wide client, so the back-end's `SentryConfigService` pushes a saved DSN into the running process instead of it being read at send time. The screen is otherwise identical, except that its **Send test** takes no destination: `testNeedsDestination` in `features/integrations/types.ts` mirrors the back-end registry and drops the field.

`AI_MEDIA` also carries the **off switch**, and it is a *provider* rather than a flag on the row. The back-end falls back to `.env` whenever no row is enabled, so disabling the Replicate row would hand generation straight back to `REPLICATE_API_TOKEN` while this screen showed it as off; enabling a credential-free `off` provider is still an enabled row, so the fallback never runs. The switch is rendered whenever the catalog contains an `off` provider for the type (`offSpecOf`), that provider is filtered out of the transport picker so one control owns the decision, and while off the primary Save deliberately does *not* switch — editing a token is not a request to resume spending.

`WHATSAPP` is the one type carrying an action that is not about its own row: **Sync webhooks**. Every other receiver here is one URL a provider was told about once, but Evolution registers a callback **per shop instance, at pairing** — so changing the callback origin reaches nobody already connected, and saving the form again cannot fix it. The button calls `syncWhatsAppWebhooks` (back-end, `manage_integrations` alone) and reports `{updated, failed}` rather than a bare success, because partial reach is the expected outcome on a shared server holding many live sessions. `supportsWebhookSync` in `features/integrations/types.ts` is what gates it, next to `supportsTestSend`. The type has **no Send test** either — a message can only leave through a shop's connected instance, and the platform row holds none.

`TELEGRAM` holds the platform's own bot — the assistant every vendor messages — and is one field, `bot_token`, because a bot **is** its token: there is no server to host and no global key controlling other people's sessions the way Evolution's does. A shop's customer-facing bot is deliberately not configurable here for the reason `integration_configs` makes structural: the table carries no `shop_id` and allows one enabled row per type, so a per-shop token lives on its own model instead. There is **no callback origin field** either, unlike WhatsApp's: Telegram registers a webhook per bot through `setWebhook`, so the URL is decided when a bot is connected rather than stored as platform configuration. It has **no Send test**, and it is the strongest of the exclusions — a bot cannot address anyone who has not started a conversation with it, so there is no destination to ask an admin for at all; `getMe` is the whole check. See `back-end/docs/features/telegram.md`.

`AI_MEDIA` (Replicate) is the one type with **no Send test at all** — the cheapest call a generation provider accepts still starts a billable prediction, so `supportsTestSend` (mirroring the back-end registry) hides the button, and **Verify** carries the whole check via Replicate's free account endpoint. It is also one row for two pipelines: the image and video generators bill the same vendor account and already share `ImageProviderType`, so `AI_MEDIA` holds the token, the webhook signing secret and the callback origin once. The back-end reads it per call through `AiMediaCredentialsService`, so a rotated token applies on the next generation rather than the next deploy.

**Withdrawals move money.** `updateWithdrawalStatus` debits the shop's balance and writes a `payout` ledger row on APPROVED, and reverses both on leaving APPROVED — so the console confirms every status change and names the effect. Deleting an approved withdrawal is disabled in the UI because the back-end's soft delete never returns the funds.

Money crosses the GraphQL boundary as **integer cents and basis points**, the same units the database stores — `WithdrawalEntry.amount_cents: Int!`, `CommissionEntry.commission_bps: Int!` alongside `min_balance_cents` / `max_balance_cents`. (This paragraph used to say the opposite and name two fields that do not exist; both were renamed in the 2026-09-12 cents migration and the note was not.) Scaling to something a person reads happens only inside a named helper in `src/shared/lib/format.ts` — `formatAmountCents`, `formatBps`, and `centsToMajor` / `bpsToPercent` for the form boundary, whose inverse on submit is `Math.round(x * 100)`. Nothing divides by 100 inline.

The **`PermissionsGuard` matches on `.some()`, not `.every()`** — `@RequirePermissions(MANAGE_OWN_SHOP, MANAGE_ALL_SHOPS)` is reachable by any vendor. Only operations gated *exclusively* by admin permissions (`manage_all_shops`, `approve_shop`, `manage_users`, `manage_all_orders`, `manage_role_permissions`, `manage_plans`, `manage_integrations`) are truly admin-only. There is no dedicated `back-end/src/admin/` module; the admin surface is decorator-scattered across ~17 feature modules.

---

## apps/storefront/ (Next.js customer shop)

See [apps/storefront/README.md](apps/storefront/README.md) and [apps/storefront/docs/features/](apps/storefront/docs/features/) for full details.

```bash
cd apps/storefront
npm run codegen         # Generate GraphQL types from ../../back-end/src/schema.gql
npm run dev             # Dev server (http://localhost:3003)
npm run build
npm run typecheck
npm test                # Vitest
```

Where a customer browses, buys, and saves things. Routes: `/` (shop directory), then everything else under `/[shopSlug]` — home, `products`, `products/[slug]`, `cart`, `checkout`, `wishlist`, `login`, `register`, `account`, `account/addresses`, `account/orders`, `account/orders/[id]`. That `[shopSlug]` segment is the *internal* route tree: on a shop's own hostname it is absent from the public URL and the proxy puts it back (below). It adds **no back-end**: every operation already existed for the other two apps.

**The URL is the shop scope, and the URL is now the host as well as the path.** A storefront answers at two addresses — `zaydak.com/acme/products/mug` ("path mode", the apex) and `acme.zaydak.com/products/mug` ("host mode", the shop's own hostname) — and both render the same `app/[shopSlug]/…` tree, because `proxy.ts` resolves the tenant and, in host mode, does an **internal `NextResponse.rewrite`** of `/products/mug` to `/acme/products/mug`. The address bar never changes, so `params.shopSlug`, `storefrontContext(slug)` and the Apollo `X-SHOP` link all keep working untouched — nothing downstream had to learn a second way of asking which shop it is on, and in path mode the rewrite is a no-op, so every URL that worked before still does. Resolution is **pure and synchronous** (`shared/lib/hostname.ts` → `shared/lib/tenant.ts`) because the proxy, the RSC tree and the browser all have to reach the same verdict, and the only way three runtimes agree for free is a function of the host string alone: a platform subdomain *is* a shop handle, constrained by the same `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` the back-end enforces on `UpdateShopInput.slug`, so `acme.<root>` yields `acme` by reading it rather than looking it up — no database, no cache. Whether a shop by that name exists is still decided where it always was, by `fetchShopShell` in the shop layout. `RESERVED_SUBDOMAINS` (`shared/lib/reserved-subdomains.ts`) mirrors the back-end's list so `www.<root>` falls through to the apex instead of resolving as somebody's shop; `demo`, `test`, `alpha` and `beta` are deliberately *not* reserved, because they are the product's own worked examples and real trading names. There is still no `active-shop` store, for the reason there never was one: the vendor dashboard needs one because a vendor *chooses* between shops, but `/acme/products/mug` is Acme's mug and cannot be anything else, and deriving it removes the class of bug where a store lags a route change and one query goes out scoped to the shop the visitor just left. Nearly every operation this app calls is behind `RequireShopGuard`, so a request missing the header does not return less data, it **fails**. **Custom merchant domains are implemented, and they are the one case needing a lookup.** `proxy.ts` asks the back-end (`shared/lib/domain-request.ts` -> `domainRequest(hostname)`) for a *verdict* rather than a slug: whose shop this is, what part this address plays (`PLATFORM` / `PRIMARY` / `ALIAS`), and whether to serve or **308 to the shop's primary domain**. That lookup does not touch the pure path above it — `resolveTenant` still reads the tenant out of the host string, and the RSC tree never asks about redirects — which is what lets a platform subdomain start bouncing to `nike.com` without any of the three runtimes needing to agree about anything new. A `SERVE` verdict is cached — in the back-end, invalidated on every write that could change it, and in-process per storefront instance — while a **`REDIRECT` verdict is never cached anywhere**. That asymmetry is the loop guard: at most one domain is primary at a time, so a consistent read cannot point two hostnames at each other, and every possible loop comes from two stale answers disagreeing across instances. A shorter TTL would have made that rarer; a fresh read makes it impossible, and a loop is the one failure here that shows the visitor nothing at all.

**Every in-app link is written `` `${base}/cart` ``, never `` `/${slug}/cart` ``.** `TenantScope` is `{mode, slug, base}`, where `base` is `"/acme"` in path mode and the **empty string** in host mode; it is resolved on the server (`shared/lib/tenant-server.ts`, reading the `x-storefront-tenant-mode` header the proxy stamps) and threaded layout → `ShopShell` → `ShopProvider`, read back with `useShopTenant()`/`useShopSlug()`. For callers outside React — the Apollo error link, `forceLogout`, the receipt uploader — `shopPathFor(slug, path)` does the same job from a slug they were handed rather than the one in the address bar. A slug-prefixed literal is right on the apex and **wrong on the shop host**, where it navigates to `acme.zaydak.com/acme/cart`, which the proxy then rewrites to `/acme/acme/cart` and 404s; that is what the ~56 link sites across 26 files were converted for. Two shapes to remember: a bare shop-home link needs a **trailing slash** after `base`, because `base` is `""` in host mode and `href=""` is not a link; and a link to the marketplace directory must go through `marketplaceHref(mode)` (`shared/lib/site-url.ts`), because a relative `/` on a shop host is that shop's own home — on the closed-storefront screen, whose whole purpose is the way out, "browse all shops" became a loop back to the closed shop. `routeDecision` no longer parses the shop out of the path either: it takes `shopSlug` and `base` and builds every redirect from `base`, and `isWithinShop(raw, base)` replaced `isSameShopPath(raw, slug)`.

**Two root-domain constants, and the difference between them is load-bearing.** `ROOT_DOMAIN` is the **read** path and defaults to `"localhost"`, which buys `demo.localhost:3003` in development with no env file and costs nothing in production: no real host ends in `.localhost`, so a deployment that never sets `NEXT_PUBLIC_ROOT_DOMAIN` falls through to path mode and the feature is absent rather than broken. `CANONICAL_ROOT_DOMAIN` is the **write** path and is `null` until that variable is explicitly set, because the same default applied to *emitted* URLs would name `http://acme.localhost` as the canonical address of every page — every canonical tag, every OpenGraph URL, both sitemaps — on any deployment that had not configured an apex, and the failure is invisible in development, where that string is correct. So `shopUrlBase(slug)` is the single answer for a shop's absolute base, resolving against the canonical constant and degrading to `${SITE_URL}/${slug}` when there is none; the root layout's exported `metadata` became `generateMetadata` so `metadataBase` can vary per request, and `ProductJsonLd` takes a `shopUrl` rather than a `shopSlug`. Path URLs keep serving 200 — **the apex never redirects**, which is a decision rather than a gap: `zaydak.com/acme` is the marketplace's own browsing surface, and bouncing it would send every click in the shop directory off the marketplace. The canonical tag is what collapses it with the shop's own address for crawlers. Host mode is different and does redirect: once a merchant promotes a custom domain, `acme.zaydak.com` and every alias 308 to it, path and query intact.

**The route guard is inverted relative to the two consoles.** There, everything is private and a short list is public; here everything is public — browsing, reading a product, filling a cart — and only `checkout` and `account` need a session (`shared/auth/route-access.ts`). `proxy.ts`'s matcher is a **negative** pattern rather than an enumerated list, because the shop slug is dynamic: `/acme/checkout` and `/beta/checkout` are different URLs and new shops appear without a deploy. It carries a second entry, `"/sitemap.xml"`, because that negative pattern excludes every path with a file extension — without the extra entry a shop host's `/sitemap.xml` fell through to `app/sitemap.ts` and served the **whole marketplace's** URLs from a host with no business claiming them; routed through the rewrite it lands on the per-shop route instead. `robots.txt` stays excluded and reads the `Host` header itself. There is also **no role gate**, because nobody signs in here as an account: **a customer signs in with a phone number and a code texted to it, and in no other way** — no password, no email sign-in, no separate sign-up (`back-end/docs/features/customer-auth.md`). The session is the shop's customer's own (`typ: customer`, subject `customers.id`, bound to the shop); the back-end's `JwtAuthGuard` accepts it only on operations that carry a shop-customer guard, so it reaches that shop's shopper operations and nothing else, and a vendor buying from another vendor is an ordinary customer by their number.

**The cart works signed-out, and that is why `session_id` is on every cart operation.** `CartResolver` is `OptionalJwtGuard` and keys the cart on the shop's customer when one is signed in and on a caller-minted `session_id` when there is not. Dropping the argument would not error — it would silently hand every signed-out visitor a fresh empty cart on each page. The id lives in the `shop_cart_session` cookie, deliberately not httpOnly because it is a GraphQL argument client JS has to read. Checkout is the boundary: `createOrder` requires the customer (`ShopCustomerGuard`), so guest checkout is refused by the back-end on purpose and the route guard puts the phone sign-in *before* the address form rather than after it.

**Public pages are server-rendered; user-shaped data is not.** The directory, a shop's home, the catalogue and a product all start their queries during the RSC pass through `<PreloadQuery>` (`shared/apollo/rsc.ts`, a `react-server`-only Apollo client) and read them back with `useSuspenseQuery`, so the markup contains the products rather than a skeleton that fills in after hydration. The cart, checkout, account, orders and wishlist stay client-fetched — per-visitor, token-bearing, and nothing a crawler should reach. Two rules bound it: the server client **carries no credentials** (everything preloaded is behind `OptionalJwtGuard`, so a shared cache has no per-visitor data in it to leak), and the shop scope is **an argument, never ambient** — `currentShopSlug()` reads the browser's own host and path (the host first, or `/products/mug` on a shop host would go out as `X-SHOP: products`) and deliberately has no server equivalent, because a module-level "current shop" is shared by every request in flight and setting it before an await hands that scope to whatever renders in the gap. Server reads pass the slug through `storefrontContext(slug)`. The trap to know: **`useQuery` silently defeats the whole thing** — it does not suspend, so the server render returns `loading: true` and ships the skeleton; a preload only pays off when the reader is `useSuspenseQuery` and its variables match exactly. `app/[shopSlug]/products/[slug]/page.tsx` also owns the app's only per-product `generateMetadata` (before it, every product shared the shop's share card) and answers a real 404 for a slug that is not a product. `robots.ts` derives its disallow list from the route guard's own segment lists, prefixing each pattern with a wildcard segment on the apex and with nothing on a shop host, where `/*/checkout` would match nothing and open every private page to crawlers with no test failing; `sitemap.ts` sweeps shops and products, bounded and logging when a bound bites. Both need `NEXT_PUBLIC_SITE_URL`.

**Money is never computed here.** `verifyCheckout` prices the order — subtotal, shipping, tax, discount — against the address, and the summary renders what comes back; the client adds no shipping fee to a subtotal of its own. Scaling integer cents to major units happens in `shared/lib/format.ts` and nowhere else. `Shop.currency` was added to the back-end for this app (a `storefrontProducts` row carries cents and no currency), so `ProductPrice` renders a placeholder while it loads rather than a number in a guessed currency.

**Shared selection sets are GraphQL fragments, not template strings.** `graphql-codegen` extracts `gql()` arguments statically, so a `${...}` inside one is invisible to it: the operation generates no types and the document silently falls back to `unknown`. `codegen.ts` also sets `fragmentMasking: false` (these fragments exist to stop a repeated field list drifting, not to scope data ownership) and `enumsAsTypes: true` (catalogue filters live in the URL and arrive as strings). Test files are excluded from the codegen documents in all three apps: a test's probe document is typed by nothing, and one selecting a field the schema lacks used to stop the storefront's codegen.

**Cookies are prefixed `shop_`,** for the same reason the console's are `admin_` — cookies are not isolated by port (RFC 6265 §8.5), so all three apps share one jar on localhost and under any single apex domain.

The app **re-skins `@repo/ui` rather than forking it**: `app/globals.css` redefines the shared tokens (warm paper ground, ink type, one commerce accent reserved for buy/sale/badge, softer radius) so all ~40 primitives change at once, and adds storefront-only `--shop-*` tokens exposed to Tailwind as `bg-shop-accent`, `text-shop-sale`, `border-shop-hairline`. Latin UI uses the SF system stack; Arabic uses Tajawal (`next/font`, the same face as the two consoles).

---

## Documentation maintenance (MANDATORY)

Keep the docs true as the code changes. **Whenever you add or change a feature, update its docs in the SAME change — do not mark the task done until the docs are written.**

1. **Per-feature overview doc (always).** Every feature has one standardized overview doc:
   - Back-end module `back-end/src/<name>/` -> `back-end/docs/features/<name>.md`
   - Frontend feature `apps/vendor/src/features/<name>/` -> `apps/vendor/docs/features/<name>.md`
   - Storefront feature `apps/storefront/src/features/<name>/` -> `apps/storefront/docs/features/<name>.md`

   New feature -> create the file from the template below and add a row to that folder's `README.md` index. Changed feature -> update the file. Always bump its `**Last updated:**` date.
2. **API reference (back-end, whenever the API changes).** Any change to a GraphQL query/mutation, a REST route, a DTO/input field, a return type, or an error code MUST be mirrored in `back-end/docs/features/api/<name>.md` - the full contract (per operation: auth, arguments, input fields with their validation, returns, error codes, an example; plus a consolidated error table). Also update the operation table in `back-end/docs/features/<name>.md`, and for a new/removed operation the row in `back-end/docs/features/api/README.md`. Bump the reference's `**Last updated:**` date. A new feature with a public API gets a new `api/<name>.md`; an internal-only service (no GraphQL ops, no REST) does not.
3. **Onboarding sections.** If a change alters overall structure, a core flow, an integration, an entrypoint, background jobs, or deployment, update the matching numbered section in `back-end/docs/` or `apps/vendor/docs/`.

Per-feature doc template (keep every doc to this shape):

- Back-end: Overview · one Mermaid diagram · Data model · API (Operation/Type/Input/Returns/Auth) · Key flows · Permissions & X-SHOP scoping · Error codes · Main files (3-7) · Notes.
- Frontend: Overview · Screens/routes · one Mermaid diagram · Components · State & forms · GraphQL operations · Validation · Main files (3-7) · Notes.

House style for ALL docs (per-feature and onboarding sections):

- Plain English. No emojis, no marketing tone, no future plans - document only what exists today.
- Exactly one Mermaid diagram per overview/onboarding file. Overview feature docs max ~110 lines; onboarding sections max ~80 lines. The `api/` reference files have no line limit - be complete.
- If something is not built yet, write "Not yet implemented" instead of inventing it.
- Never put secrets or credentials in docs.

## Task backlog - TODO.md (MANDATORY)

`TODO.md` at the repo root is the durable backlog of future work. Keep it current:

- **It is filed by area** — Vendor dashboard, Storefront, Admin console, Back-end & API, AI & Sidekick, Platform & infrastructure, Design system/UI/monorepo — then Roadmaps, Backlog, Ideas, Done. Newest first inside each area. The `## Index` table at the top counts the open boxes per area; update it when the count moves.
- An entry is a `###` heading naming the work that shipped, a short prose record of it, then its `- [ ]` follow-ups. The open boxes are the backlog; the prose is why the code looks the way it does.
- When the user names a future task, or you defer or discover follow-up work, add a checkbox item to the right entry — or a new entry under the right area — with a one-line description.
- `- [ ]` is untouched, `- [~]` is started but unfinished, `- [x]` is done. Both of the first two count as open.
- When every box in an entry is checked, move the whole entry to `## Done — closed out`.
- Keep entries short and specific. `TODO.md` is the long-lived backlog; the in-session todo list (the TodoWrite tool) is separate and ephemeral.
