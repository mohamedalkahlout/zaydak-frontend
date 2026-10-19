import type {
  ProductSortBy,
  ProductStatus,
  ProductType,
  SaleType,
  StockStatus,
} from "@/features/products/types"

export const PAGE_SIZE = 6

/**
 * The tint each status wears in the list.
 *
 * Colour is the only ornament the pill gets — no status dot and no chevron.
 * A dot inside an already-tinted pill states the hue twice, and a chevron on
 * every row turns a column of statuses into a column of dropdowns; what is
 * being read down this column is three words, and the tint is what makes them
 * scannable before they are read. The pill takes a ring on hover instead,
 * which costs nothing at rest.
 *
 * Labels are not here. The list toolbar and the form both read
 * `products.status.<value>` (and `products.list.views` for All), so a locale
 * switch cannot leave one screen on "Active" and the other on "نشط".
 * `PRODUCT_STATUS_LABELS` stays as the English fallback for non-React callers.
 */
export const STATUS_STYLE: Record<ProductStatus, string> = {
  PUBLISH: "bg-emerald-100 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-300",
  DRAFT: "bg-zinc-100 text-zinc-700 dark:bg-zinc-400/15 dark:text-zinc-300",
  UNLISTED: "bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-300",
}

/**
 * The enum values the list's filters offer, in the order the menus list them.
 *
 * Values only — the words are looked up by the enum, so neither locale can
 * drift from the other: `products.productTypes.<VALUE>`,
 * `products.organization.saleType.<VALUE>` (the form's Selling method reads the
 * same keys) and `products.stockStatus.<VALUE>`.
 */
export const PRODUCT_TYPE_OPTIONS: readonly ProductType[] = [
  "SIMPLE",
  "VARIABLE",
  "DIGITAL",
  "SERVICE",
]

export const SALE_TYPE_OPTIONS: readonly SaleType[] = [
  "FIXED_PRICE",
  "NEGOTIABLE",
  "AUCTION",
]

/** Backend-aligned stock bucket used for list filtering. */
export const STOCK_OPTIONS: readonly StockStatus[] = [
  "IN_STOCK",
  "LOW_STOCK",
  "OUT_OF_STOCK",
]

/**
 * The saved views the list opens with, in the order they appear in the "All"
 * selector at the top-left of the toolbar.
 *
 * These are Shopify's product tabs, collapsed into one control. They write the
 * same `statuses` URL key the faceted Status filter used to, and there is no
 * longer a Status facet beside them: two controls over one piece of state is
 * two places to look for what the list is currently showing. The tradeoff is
 * that a view is one status where the URL still accepts several — a URL naming
 * more than one falls back to reporting the count (`labelForView`).
 *
 * Each reads `products.list.views.<value>`.
 */
export const PRODUCT_VIEWS: readonly { value: ProductStatus | "ALL" }[] = [
  { value: "ALL" },
  { value: "PUBLISH" },
  { value: "DRAFT" },
  { value: "UNLISTED" },
]

/** In the order the sort select lists them; each reads `products.list.sort.<value>`. */
export const PRODUCT_SORT_OPTIONS: readonly { value: ProductSortBy }[] = [
  { value: "NEWEST" },
  { value: "OLDEST" },
  { value: "PRICE_LOW" },
  { value: "PRICE_HIGH" },
  { value: "MOST_VIEWED" },
]

export const DEFAULT_SORT_BY: ProductSortBy = "NEWEST"

/**
 * Every column the table can render, in its default left-to-right order.
 *
 * `select` and `actions` are the two fixed ends — they are the checkbox and
 * the row menu, not data — so the view panel reorders only what lies between
 * them and the table re-pins them on either side of whatever order it is given.
 */
export const PRODUCT_COLUMN_ORDER = [
  "select",
  "name",
  "status",
  "inventory",
  "category",
  "collections",
  "product_type",
  "price",
  "negotiation",
  "brand",
  "created_at",
  "updated_at",
  "actions",
] as const

/**
 * Columns the panel can move and hide — the fixed ends removed. Each one's
 * header is `products.list.column.<id>`, read by the table and the view panel
 * alike.
 */
export const PRODUCT_REORDERABLE_COLUMNS = PRODUCT_COLUMN_ORDER.filter(
  (id) => id !== "select" && id !== "actions",
)

/** A data column — one with a header of its own. */
export type ProductColumnId = Exclude<
  (typeof PRODUCT_COLUMN_ORDER)[number],
  "select" | "actions"
>

/**
 * Off by default. A row that carries every column scrolls sideways before it
 * says anything, so the list opens on the six that identify a product and the
 * rest are one click away in the view panel.
 */
export const PRODUCT_COLUMN_VISIBILITY: Record<string, boolean> = {
  collections: false,
  brand: false,
  created_at: false,
  updated_at: false,
}

export const LOW_STOCK_THRESHOLD = 5
