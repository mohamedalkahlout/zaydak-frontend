# Dead code audit

**Last updated:** 2026-08-14

> **Superseded in part (2026-09-04).** Every `back-end/src/chat/**` row below is now moot:
> the module was deleted outright when the Sidekick assistant was retired. See
> [ai-surface-audit.md](ai-surface-audit.md) and the `TODO.md` entry "Sidekick chat retired".
> The non-`chat/` findings still stand.

A whole-repo sweep for code that nothing reaches: unreferenced files, exported
symbols nobody imports, GraphQL operations that are declared but never executed,
dependencies that are installed but never used, and translation namespaces no
screen asks for.

Nothing here has been deleted. This is the finding list; each section is ordered
so the safest removals come first.

## How this was measured

A custom analyzer (no `knip`/`ts-prune` in this repo) over 2,344 `.ts`/`.tsx`
files in `back-end/src`, `apps/*/src`, `packages/ui/src`, `back-end/prisma` and
`scripts/`. It builds three indexes:

1. **Import graph** — resolves relative specifiers, the `@/` alias per app,
   `@repo/ui/*`, and NodeNext's `./x.js` → `x.ts` form the back-end uses.
   Dynamic `import()` and `require()` are followed too.
2. **Reachability** — a BFS from the real entrypoints: `back-end/src/main.ts`,
   every Next.js `page`/`layout`/`route`/`error` file, `proxy.ts`,
   `instrumentation*.ts`, the Sentry configs, the two `i18n/request.ts` files
   (wired through `next.config.ts`), the prisma and seed scripts. A file the BFS
   never touches is unreachable in production.
3. **Export/reference index** — every exported symbol, counted against every
   other file. `export { A, B }` manifests are discounted so a shadcn-style
   re-export does not read as a use, and `export default` is excluded entirely
   because a default import can be renamed at will.

Tests are indexed separately, so "reachable only from a `.spec.ts`" is reported
as its own state rather than counted as dead.

### What was checked and ruled *not* dead

These showed up in the raw output and were verified by hand as false positives:

| Flagged | Why it is alive |
|---|---|
| `apps/*/src/shared/i18n/request.ts` | Named in `next.config.ts` via `createNextIntlPlugin`, never imported by code. |
| `instrumentation.ts` → `onRequestError`, `instrumentation-client.ts` → `onRouterTransitionStart` | Next.js calls these by name; they are framework convention, not call sites. |
| `back-end/src/common/testing/guard-chain.ts` (127 lines) | Used by 9 resolver specs via `describeGuardChain`. |
| `back-end/src/prisma/prisma.mock.ts` | Used by ~120 specs via `createPrismaMock`. |
| `shopifyql/__fixtures__/drift-corpus.ts` (both copies) | The paired back-end/front-end parser drift test reads them. |
| `reflect-metadata`, `react-dom`, `@types/papaparse` | Required runtime/peer/type packages with no direct `import` of their own. |
| `tw-animate-css` | Imported from `globals.css`, not from TypeScript. |
| `packages/ui` shadcn sub-exports | Deliberate component-library surface — see the last section. |
| Back-end GraphQL operations unused by these two apps | The API also serves the live Laravel storefront, which is not in this repo. Out of scope; cannot be judged from here. |

---

## 1. Unreachable files — 44 files, ~3,314 lines

Nothing imports these, and nothing that imports them is itself reachable. Each
was confirmed to have no test importer either.

### 1a. The customer-chat vendor-CRUD cluster (back-end) — ~783 lines

The largest single find. Three handlers, the state service only they use, and
the middleware that was meant to wrap them:

| File | Lines |
|---|---|
| `back-end/src/chat/handlers/vendor-update.handler.ts` | 280 |
| `back-end/src/chat/handlers/vendor-create.handler.ts` | 168 |
| `back-end/src/chat/handlers/vendor-delete.handler.ts` | 163 |
| `back-end/src/chat/tools/tool-middleware.service.ts` | 117 |
| `back-end/src/chat/product-crud-state.service.ts` | 55 |

`VendorCreateHandler` / `VendorUpdateHandler` / `VendorDeleteHandler` appear in
no module's `providers` and nothing constructs them. `ProductCrudStateService`
is referenced *only* by those three dead handlers, so it dies with them.
`ToolMiddlewareService` has no reference anywhere, including its own module.

The live path is `VendorIntentHandler` (registered in `chat.module.ts`, used by
`ai-orchestrator.service.ts`) — vendor CRUD through the chat now goes through
the Sidekick tool registry instead.

### 1b. Two abandoned LangChain/LangGraph seams (back-end) — 277 lines

| File | Lines | Note |
|---|---|---|
| `back-end/src/ai/langchain/tools/product-search.tool.ts` | 98 | `createProductSearchTool` never called |
| `back-end/src/ai/langchain/tools/recommendations.tool.ts` | 79 | `createRecommendationsTool` never called |
| `back-end/src/chat/langgraph/tool-adapter.ts` | 81 | `wrapSidekickTool` never called |
| `back-end/src/chat/langgraph/graph.module.ts` | 19 | `LangGraphModule` referenced by nothing, not even `app.module.ts` |

Careful here: the rest of `back-end/src/chat/langgraph/` **is live** —
`LangGraphService` (`graph.service.ts`) is registered in `chat.module.ts` and
called by `ai-orchestrator.service.ts`. Only the module wrapper and the tool
adapter are orphaned. Likewise `back-end/src/vendor-agent/graph/` (the Sidekick
migration in `TODO.md`) is entirely live and unrelated.

### 1c. Other back-end files

| File | Lines | Note |
|---|---|---|
| `back-end/src/chat/types/bot-response.examples.ts` | 347 | Seven exported `example_*` fixtures; no prompt or test reads them |
| `back-end/src/products/types/product-media.shape.ts` | 83 | `ProductMediaShape` / `ProductVideoShape`. The vendor app has its own copy in `validations/product.ts` and only mentions this path in a comment |
| `back-end/src/customer-segments/filters/order-aggregate.helper.ts` | 81 | Both exports unused |
| `back-end/src/customer-segments/shopifyql/index.ts` | 16 | Barrel; every consumer deep-imports instead |

### 1d. `packages/ui` — 3 whole components, 516 lines

| File | Lines | Note |
|---|---|---|
| `smooth-input.tsx` | 329 | Neither app imports it |
| `breadcrumb.tsx` | 126 | Full shadcn breadcrumb set, unused |
| `resizable.tsx` | 61 | Unused |

These are the three files where *every* export is unused, unlike the partial
cases in section 6.

### 1e. `apps/vendor`

| File | Lines | Note |
|---|---|---|
| `features/skiper20/_data/countries.ts` + `_data/index.ts` | 216 | A 214-line country table. `country-select-dialog.tsx` switches **locales** and reads `SUPPORTED_LOCALES` from `shared/i18n/config` — it never touches `COUNTRIES` |
| `shared/components/tiptap-extension/node-background-extension.ts` | 151 | Not in any editor's extension list |
| `features/segments/components/segments-bulk-bar.tsx` | 138 | Bulk selection UI, never mounted |
| `features/products/components/form/ui/section-card.tsx` | 80 | Dead. Note the coupons copy (`features/coupons/components/new/ui/section-card`) is live and used by 4+ forms — do not delete that one |
| `shared/hooks/use-scrolling.ts` | 76 | `useScrolling` never called |
| `features/coupons/components/new/cards/advanced-card.tsx` | 75 | Not rendered by any coupon form |
| `shared/components/tiptap-templates/simple/theme-toggle.tsx` | 48 | Dead, and it is the sole importer of `tiptap-icons/sun-icon.tsx` (59) and `moon-star-icon.tsx` (31) — all three go together |
| `shared/lib/auth/permissions.ts` | 46 | The only permissions helper in the app, and nothing imports it. UI gating is done elsewhere |
| `shared/components/contexts/ai-context.tsx` | 41 | Provider + hook, never mounted |
| `shared/lib/tiptap-collab-utils.ts` | 2 | — |

**Three superseded AI tool cards** (178 lines). `tool-event-renderer.tsx` is the
registry that maps a tool event to its card; it imports the *deleted*/*updated*
collection cards but not these:

- `features/ai/components/tool-cards/product-created-card.tsx` (79)
- `features/ai/components/tool-cards/product-updated-card.tsx` (62)
- `features/ai/components/tool-cards/collection-created-card.tsx` (37)

### 1f. Barrel files nobody imports (11 files, ~60 lines)

The codebase consistently deep-imports, so these `index.ts` re-export barrels
are never resolved:

`features/ai/index.ts`, `features/coupons/index.ts`, `features/customers/index.ts`,
`features/files/index.ts`, `features/inventory/index.ts`, `features/orders/index.ts`,
`features/products/index.ts`, `features/shops/index.ts`,
`features/skiper20/components/index.ts`, `features/skiper20/_data/index.ts`,
`shared/types/index.ts`, `shared/components/tiptap-node/image-upload-node/index.tsx`,
plus `features/products/components/form/pickers/category-picker.tsx` (a 4-line
re-export shim).

`features/skiper20/index.ts` itself **is live** — `site-header.tsx` imports
`LanguageSelectDialog` from it. Only the inner barrels are dead.

---

## 2. Dead GraphQL operations — 24 documents

Declared with `gql` and exported, but never passed to `useQuery`/`useMutation`
or any client call. These are the highest-signal items in the report: each one
is a client-side contract for a back-end operation the UI does not actually
use, and several name capabilities the product visibly lacks.

**`apps/vendor`** (23):

| File | Operation |
|---|---|
| `features/ai/api/mutations.ts` | `VENDOR_AGENT_CHAT`, `REVOKE_VENDOR_AGENT_CONVERSATION_SHARE` |
| `features/auth/api/mutations.ts` | `REFRESH_TOKEN`, `REQUEST_MAGIC_LINK`, `VERIFY_MAGIC_LINK` |
| `features/auth/api/queries.ts` | `GET_LOOKUPS` |
| `features/collections/api/queries.ts` | `GET_SHOP_COLLECTION_BY_ID` |
| `features/coupons/api/mutations.ts` | `VERIFY_COUPON` |
| `features/insights/api/queries.ts` | `MARK_INSIGHT_READ` |
| `features/inventory/api/mutations.ts` | `ADJUST_INVENTORY`, `TRANSFER_INVENTORY`, `UPDATE_PURCHASE_ORDER` |
| `features/orders/api/mutations.ts` | `CREATE_ORDER`, `DELETE_ORDER` |
| `features/orders/api/queries.ts` | `GET_ORDER_BY_TRACKING` |
| `features/product-relations/api.ts` | `REORDER_PRODUCT_RELATION` |
| `features/products/api/ai-image.ts` | `CANCEL_IMAGE_GENERATION` |
| `features/products/api/mutations.ts` | `DELETE_PRODUCT` |
| `features/products/api/queries.ts` | `GET_SYSTEM_CATEGORY_TREE`, `GET_SYSTEM_CATEGORY` |
| `features/segments/api/mutations.ts` | `BULK_DELETE_SEGMENTS` |
| `features/tags/api/queries.ts` | `GET_TAG_BY_ID` |
| `features/targets/api/queries.ts` | `GET_TARGET` |

**`apps/admin`** (1): `features/integrations/api.ts` → `SET_INTEGRATION_ENABLED`.

`REFRESH_TOKEN` is worth a look before deleting: token refresh runs through the
`/api/auth/refresh` route rather than this document, so it is dead *here*, but
confirm the route path covers every case first. `BULK_DELETE_SEGMENTS`,
`ADJUST_INVENTORY` and `TRANSFER_INVENTORY` line up with the "no bulk selection
UI yet" items already in `TODO.md` — those are **unfinished**, not abandoned,
and should be left in place.

---

## 3. Dead exports inside live files — 140

Symbols exported from a file that is otherwise in use, and referenced by nobody
(not even the declaring file). Excluding the 24 GraphQL documents above, the
remainder is mostly response/props interfaces that outlived their query and a
handful of helpers.

**`back-end` (23):**

`ai/ai.schemas.ts` `ParsedIntent` · `ai/image/dto/enhance-image-shots.input.ts`
`VARIATION_COUNTS` · `ai/utils/arabic.ts` `extractVerbRoot` ·
`category-attributes/dto/attribute-option.input.ts` `AttributeFilterInput` (an
exposed but unreachable GraphQL input class) ·
`category-attributes/types/attribute.types.ts` `ReadModelAttribute` ·
`chat/language-detector.ts` `isRtl` · `chat/tools/tool-helpers.ts`
`ORDER_STATUS_LABELS_PLAIN`, `formatCurrency` · `common/context/shop.context.ts`
`ShopContext` · `common/helpers/translate.helper.ts` `invalidateLookupCache` ·
`common/observability/sentry.ts` `isSentryActive` ·
`customer-segments/filters/function-args.helper.ts` `requireOneOf` ·
`customer-segments/filters/helpers.ts` `valueToScalar`, `buildNumberWhere` ·
`customer-segments/segment-insights.service.ts` `SegmentInsightsAccessor` ·
`notifications/catalog/event-registry.ts` `isKnownEventKey`,
`eventKeyForDomainEvent` · `plans/feature-registry.ts` `ConfigOf` ·
`plans/plan-catalog.ts` `planDefinitionFor` ·
`staff-notifications/types/staff-recipient.types.ts` `StaffEvent` ·
`system-categories/system-categories.constants.ts` `TOP_PRECOMPUTED_CATEGORIES` ·
`vendor-agent/tools/tool-registry.ts` `RegisteredToolName`, `ALL_TOOL_GROUPS`.

`invalidateLookupCache` deserves a second look rather than a delete: a cache
invalidator with no caller usually means a cache that is never invalidated.

**`apps/admin` (5):** `features/integrations/nav.ts` `SupportedIntegrationType` ·
`features/plans/types.ts` `OverrideRow`, `PlanEntitlementRow` ·
`features/users/validations.ts` `EditUserFormValues` · plus
`SET_INTEGRATION_ENABLED` from section 2.

Separately, admin has a **complete, unwired row-selection kit**:
`shared/lib/selection.ts` (`toggleId`, `headerState`, `keepVisible`) and
`shared/components/data-table/data-table.tsx` (`DataTableSelectionBar`,
`DataTableSelectHead`, `DataTableSelectCell`). This is the missing half of the
three "no row selection UI yet" backlog items — it is **pre-built, not dead**.
Keep it.

**`apps/vendor` (76)** — the long tail. Mostly `*Response` interfaces paired
with the dead queries above (`CreateOrderResponse`, `DeleteOrderResponse`,
`DeleteProductResponse`, `LookupsResponse`, `MarkInsightReadResponse`,
`ShopCollectionByIdResponse`, `ReorderProductRelationResponse`,
`RenameAttachmentResponse`, `UpdateDraftOrderResponse`,
`DeleteDraftOrderResponse`, `AnalyticsSummaryResponse`,
`VendorAgentChatResponse`/`Variables`, `ToolErrorResult`), unused zod-derived
types in `features/products/validations/product.ts` (`AltTextValue`,
`GalleryImageValue`, `AttributeValueEntryOutput`, `VariationOptionOutput`) and
`features/coupons/validations/coupon.ts` (`CouponEligibilityUI`, `MinimumMode`,
`AppliesTo`), unused constant tables (`VENDOR_STATUS_LABEL`,
`VENDOR_STATUS_STYLE`, `SALE_TYPE_LABEL`, `VENDOR_PRODUCT_STATUS_LABELS`,
`STATUS_TABS`, `DEFAULT_QUERY`, `SR_ONLY`), and 7 unused helpers in the vendored
`shared/components/tiptap-ui/ai-menu/ai-menu.tsx`.

Note the tiptap scaffold is already ESLint-exempt as upstream code we do not
maintain (see `CLAUDE.md`); its dead exports are best left alone for the same
reason.

---

## 4. Deprecated methods with no callers

Four methods carry `@deprecated`. Two still have callers and two do not:

| Method | State |
|---|---|
| `AiBudgetService.enforceBudget` (`ai/ai-budget.service.ts:238`) | **Dead.** Body is empty, doc says "kept for external callers" — there are none, not even a test |
| `ConversationService.findByShareToken` (`vendor-agent/conversation.service.ts:817`) | **Dead.** A thin wrapper over the live `lookupShare` |
| `AiBudgetService.trackCall` (`:309`) | Alive — `image-gen.service.ts` + 2 specs |
| `CustomerSegmentsService.matchesRules` (`:354`) | Test-only — its spec is the sole caller, which the doc states is deliberate |

---

## 5. Unused dependencies — 13

Installed, never imported. Verified against `.css` as well as TypeScript, and
excluding type-only and implicit-peer packages.

**`back-end/package.json` (1 certain, 1 to verify):**

- `stopword` — no import anywhere in `src/`.
- `@as-integrations/express5` — no direct import, but this is the Apollo Server
  5 / Express 5 integration `@nestjs/apollo` resolves at runtime. **Verify before
  removing**; it is most likely a required peer.

**`apps/vendor/package.json` (10):** `@tanstack/react-query`, and nine Tiptap
extensions that are not in any editor's extension list —
`@tiptap/extension-color`, `-link`, `-table`, `-table-cell`, `-table-header`,
`-table-row`, `-task-item`, `-task-list`, `-text-style`.

The task ones are a genuine trap: `simple-editor.tsx` gets `TaskItem`/`TaskList`
from `@tiptap/extension-list`, so the standalone `-task-item`/`-task-list`
packages are shadowed duplicates. Removing them also trims
`optimizePackageImports` churn in `next.config.ts`.

**`apps/admin/package.json`:** none.

---

## 6. Unused translation keys

Only the reliable measure is reported. A per-key sweep is not trustworthy here
because the apps build keys dynamically in 57 (vendor) + 45 (admin) places —
`t(\`tasks.${taskKey}.cta\`)` and friends — so a key can be live without its
name ever appearing as a literal.

What *is* reliable is the namespace level: three top-level namespaces in
`apps/vendor` are never passed to `useTranslations`/`getTranslations`.

| Namespace | Keys | Superseded by |
|---|---|---|
| `locale` | `english`, `arabic`, `switchTo` | `LOCALE_LABELS` in `shared/i18n/config.ts` |
| `nav` | `dashboard`, `products`, `orders`, `customers`, `coupons` | the `sidebar` namespace |
| `products` | `title`, `addProduct`, `editProduct`, `categoryMetafields`, `connectToOption`, `disconnect` | screen-local namespaces |

14 keys × 2 locales = 28 dead entries across `en.json` and `ar.json`.
`apps/admin` has none — all 12 of its namespaces are requested.

Both apps are at full parity otherwise: 0 missing and 0 extra keys in `ar.json`
against `en.json` (1,587 vendor keys, 616 admin keys).

---

## 7. `packages/ui` partial exports — 38, intentional

`packages/ui` has 48 unused named exports in total; 10 of them belong to the
three fully-dead files in section 1d. The other **38, spread across 12
otherwise-live shadcn primitives**, are unused by both apps — `AvatarBadge`,
`CardAction`, `CommandShortcut`, `SidebarRail`, `SidebarInput`, `TableCaption`,
most of `field.tsx` and `input-group.tsx`, and so on.

**These are not recommended for deletion.** `@repo/ui` is a component library
whose primitives ship as complete sets; pruning individual parts guarantees a
conflict the next time `npx shadcn@latest add` touches the file, and the parts
cost nothing at runtime — the apps set `optimizePackageImports`/
`transpilePackages` so unused exports are already dropped per route chunk.

The three fully-unused *files* in section 1d are the different case: no part of
them is used, so nothing is being kept whole.

---

## Suggested order

1. **Section 1a + 1b** — 1,060 lines of back-end code with zero references and
   no ambiguity. Biggest win, lowest risk.
2. **Section 1e/1f** — vendor files and barrels; each is independently checkable.
3. **Section 5** — dependency removals (keep `@as-integrations/express5` until
   verified). Cheapest install/build win.
4. **Section 4 + section 6** — two deprecated methods and 28 translation keys.
5. **Section 2 + 3** — read as a pair: delete each dead document together with
   its orphaned `*Response` interface. Skip the ones tied to open `TODO.md`
   items (bulk selection, inventory adjust/transfer).

The analyzer is reproducible; re-running it after each batch is the cheapest way
to confirm a removal did not orphan something new.
