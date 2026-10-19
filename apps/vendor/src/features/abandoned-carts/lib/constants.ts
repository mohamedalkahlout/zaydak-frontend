import type {
  AbandonedCartReminderStatus,
  AbandonedCartSortDir,
  AbandonedCartSortField,
  AbandonedCartsView,
} from "../types"

export const PAGE_SIZE = 15
export const PAGE_SIZE_OPTIONS = [15, 25, 50] as const

/**
 * Rows the activity-log export asks for in one request. It is the back-end's
 * own cap (`OPS_EXPORT_CAP`): `abandonedCartOps` returns at most this many ops
 * per window, reading past the non-op audit rows (draft records) to fill them.
 * So a short page is the whole window, and only a full one means older
 * entries may have been left out — which is what the export's warning keys on.
 */
export const OPS_EXPORT_LIMIT = 2000

/**
 * The most carts one "select all matching" holds. It is the back-end's own cap
 * (`SELECT_ALL_CAP`): `abandonedCartIds` returns the first this-many ids in the
 * list's order plus the true total. The screen keeps a copy so it can say
 * "the first 500 of 1,240" on the button, before anything is selected.
 */
export const SELECT_ALL_LIMIT = 500

/**
 * Ids one `hideAbandonedCarts` call accepts (`ArrayMaxSize(100)` on its
 * input). A longer selection is sent as several calls of this size, never cut.
 */
export const HIDE_BATCH_LIMIT = 100

/**
 * Rows one `abandonedCarts` page can carry (the API clamps `limit` to 100).
 * Remind and Export need whole rows, so a selection that reaches past the page
 * on screen is read back this many at a time.
 */
export const SELECTION_PAGE_LIMIT = 100

/**
 * Pages read looking for a selection's rows before giving up on the rest:
 * 2,000 rows, which is also as far as the list itself reads when it filters
 * in memory. Whatever is still missing by then is reported, not dropped.
 */
export const SELECTION_SCAN_PAGES = 20

export const REMINDER_STATUS_VALUES = [
  "READY",
  "SENT",
  "RETURNED",
  "FAILED",
  "COMPLETED",
] as const satisfies readonly AbandonedCartReminderStatus[]

export type ReminderStatusFilter = (typeof REMINDER_STATUS_VALUES)[number]

export const SORT_FIELDS = [
  "LAST_ACTIVITY",
  "ITEM_COUNT",
  "TOTAL",
  "CREATED_AT",
] as const satisfies readonly AbandonedCartSortField[]

export const SORT_DIRS = ["ASC", "DESC"] as const satisfies readonly AbandonedCartSortDir[]

export const VIEW_VALUES = ["customer", "product"] as const satisfies readonly AbandonedCartsView[]

export const VALUE_BANDS = [
  { id: "lt_100", min: undefined, max: 10_000 },
  { id: "100_500", min: 10_000, max: 50_000 },
  { id: "500_1000", min: 50_000, max: 100_000 },
  { id: "gte_1000", min: 100_000, max: undefined },
] as const

export type ValueBandId = (typeof VALUE_BANDS)[number]["id"]

export const CREATED_PRESETS = [
  "last_7_days",
  "last_30_days",
  "this_month",
] as const

export type CreatedPreset = (typeof CREATED_PRESETS)[number]

export const CUSTOMER_COLUMN_IDS = [
  "customer",
  "products",
  "total",
  "updated",
  "status",
  "country",
  "created",
] as const

export const PRODUCT_COLUMN_IDS = [
  "product",
  "carts",
  "lost",
  "lastLeft",
] as const

export const MERGE_TAGS = [
  "name",
  "shop_name",
  "cart_url",
  "discount_code",
  "discount_amount",
  "date",
] as const

export type MergeTag = (typeof MERGE_TAGS)[number]
