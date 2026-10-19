import type {
  AdminPlatformAnalyticsQuery,
  AdminPlatformCostQuery,
  AdminPlatformSalesByChannelQuery,
  AdminPlatformTopProductsQuery,
} from "@/shared/api/generated/graphql"

/** Headline platform figures. `total_vendors` is nullable in the schema because the back-end only populates it for an admin caller. */
export type PlatformTotals = AdminPlatformAnalyticsQuery["analytics"]["data"]

/** One month of platform revenue. `total_cents` is integer cents. */
export type MonthlyRevenue =
  AdminPlatformAnalyticsQuery["yearlySales"]["data"][number]

/** Platform-wide order counts per status. */
export type OrderStatusCounts =
  AdminPlatformAnalyticsQuery["ordersByStatus"]["data"]

/**
 * The status field names, without `__typename`.
 *
 * `keyof OrderStatusCounts` includes the `__typename` literal codegen adds, so
 * indexing with it widens every count to `number | "OrdersByStatus"` and the
 * arithmetic stops type-checking. Excluding it here keeps the counts numeric.
 */
export type OrderStatusKey = Exclude<keyof OrderStatusCounts, "__typename">


/** Provider cost for one metered capability, across every store. `cost_cents` is integer cents. */
export type FeatureCostRow = NonNullable<
  AdminPlatformCostQuery["usageSummary"]["data"]
>[number]

/** One store's consumption over the window, ranked by what it cost us. */
export type ShopCostRow = NonNullable<
  AdminPlatformCostQuery["usageTopShops"]["data"]
>[number]

/** AI spend matrix row (Sidekick / bot / images / other / total), integer cents. */
export type AiSpendByShopRow = NonNullable<
  AdminPlatformCostQuery["aiSpendByShop"]["data"]
>[number]

/** AI spend by plan tier, integer cents. */
export type AiSpendByPlanRow = NonNullable<
  AdminPlatformCostQuery["aiSpendByPlan"]["data"]
>[number]

/** Platform sales split by where each order was placed. Every amount is integer cents. */
export type SalesByChannelData =
  AdminPlatformSalesByChannelQuery["salesByChannel"]["data"]

/** A best seller across the whole marketplace. `total_sales_cents` is integer cents. */
export type TopProductRow =
  AdminPlatformTopProductsQuery["topProducts"]["data"][number]

/**
 * The order statuses, in the sequence a shipment actually moves through, with
 * the bar colour each one gets. Terminal-but-unhappy states come last.
 *
 * Kept as a list rather than derived from `Object.keys` so the order on screen
 * is a decision in the code and not an accident of the GraphQL selection.
 */
export const ORDER_STATUS_ROWS: ReadonlyArray<{
  key: OrderStatusKey
  color: string
}> = [
  { key: "pending", color: "bg-amber-400" },
  { key: "processing", color: "bg-sky-400" },
  { key: "at_local_facility", color: "bg-indigo-400" },
  { key: "out_for_delivery", color: "bg-violet-400" },
  { key: "completed", color: "bg-emerald-500" },
  { key: "cancelled", color: "bg-zinc-400" },
  { key: "refunded", color: "bg-rose-400" },
  { key: "failed", color: "bg-red-500" },
]
