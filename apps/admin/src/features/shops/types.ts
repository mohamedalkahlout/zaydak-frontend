import type {
  AdminShopDomainsQuery,
  AdminShopsQuery,
} from "@/shared/api/generated/graphql"
import { ShopDomainStatus, ShopStatusFilter } from "@/shared/api/generated/graphql"

/** One row of the `shops` list. */
export type ShopRow = NonNullable<AdminShopsQuery["shops"]["data"]>[number]

/**
 * Filter option order — the lifecycle as it is lived, then the archive.
 *
 * `ShopStatusFilter.All` is deliberately absent: the console's "no filter"
 * choice is *omitting* `status`, which returns active, suspended and pending.
 * `all` would drag deleted shops into the default view.
 */
export const SHOP_STATUSES = [
  ShopStatusFilter.Active,
  ShopStatusFilter.Pending,
  ShopStatusFilter.Suspended,
  ShopStatusFilter.Deleted,
] as const

export type ShopStatus = "active" | "suspended" | "pending" | "deleted"

/**
 * Three independent columns collapsed into one label, and the order is the
 * whole point of the function.
 *
 * `deleted_at` is read **first**: the soft delete also clears `is_active`, so
 * reading `is_active` before it would label every deleted shop "suspended".
 * `is_approved` comes next, because a shop awaiting review has never been live
 * and calling it "suspended" would suggest somebody took it down. Only then
 * does `is_active` decide between active and suspended.
 */
export function shopStatus(
  row: Pick<ShopRow, "deleted_at" | "is_approved" | "is_active">,
): ShopStatus {
  if (row.deleted_at) return "deleted"
  if (!row.is_approved) return "pending"
  return row.is_active ? "active" : "suspended"
}

/**
 * The bulk actions the selection bar offers.
 *
 * Approve, disapprove and delete are absent on purpose: `approveShop`,
 * `disapproveShop` and `deleteShop` take a single `slug`, not an id list, so a
 * bulk button behind them would be a loop of mutations with no transaction and
 * a half-applied outcome when one fails. Only `setShopsActive` and
 * `restoreShops` are genuinely plural, and only those are wired.
 */
export type ShopBulkKind = "suspend" | "activate" | "restore"

/**
 * Of a selection, the rows one bulk action would actually change.
 *
 * `is_active` decides suspend/activate rather than the status label, for the
 * same reason the row menu reads it directly: a shop awaiting review reads
 * "pending" whichever way its switch is set, so the label cannot answer this.
 */
export function shopsEligibleFor(
  kind: ShopBulkKind,
  rows: readonly ShopRow[],
): ShopRow[] {
  return rows.filter((row) => {
    const deleted = shopStatus(row) === "deleted"
    switch (kind) {
      case "suspend":
        return !deleted && row.is_active
      case "activate":
        return !deleted && !row.is_active
      case "restore":
        return deleted
    }
  })
}

export function statusBadgeVariant(
  status: ShopStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "secondary"
    case "pending":
      return "outline"
    case "suspended":
      return "outline"
    case "deleted":
      return "destructive"
  }
}

/** One address on `/shops/[shopId]/domains`. */
export type ShopDomainRow = NonNullable<
  AdminShopDomainsQuery["adminShopDomains"]["data"]
>[number]

/**
 * The shop the address list belongs to.
 *
 * The domains screen arrives with an id in a URL and nothing else, so this is
 * where it learns the name, the slug and the three status flags — it never
 * pages the list query to find the row it is already looking at.
 */
export type ShopDomainsShop = AdminShopDomainsQuery["adminShopDomains"]["shop"]

/**
 * Badge variant per address status.
 *
 * `VERIFYING` shares the quiet outline with `PENDING` rather than borrowing the
 * live variant: the nightly sweep demotes a domain that stopped answering back
 * to `VERIFYING`, so it is the state of an address that is *not* serving as
 * much as of one that has never served.
 */
export function domainStatusVariant(
  status: ShopDomainStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case ShopDomainStatus.Active:
      return "secondary"
    case ShopDomainStatus.Failed:
      return "destructive"
    default:
      return "outline"
  }
}
