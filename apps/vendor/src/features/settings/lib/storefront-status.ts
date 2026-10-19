import type { SettingsShop } from "../types"

export type StorefrontStatus = "connected" | "pendingApproval" | "inactive"

/**
 * Whether the storefront address actually answers, read from both flags.
 *
 * `is_approved` is the platform's verdict and `is_active` is the storefront
 * switch, and the back-end refuses to resolve a shop for anyone but its owner
 * when *either* is false (`ShopsService`, the storefront 404). A badge that
 * read `is_active` alone said "Connected" over an address customers could not
 * open. Approval is checked first because `disapproveShop` clears both flags
 * together — an unapproved shop is "waiting on the platform", never merely
 * "switched off". Same precedence as the admin console's `shopStatus()`.
 *
 * Maintenance mode is deliberately not folded in: the storefront still serves
 * a shop under maintenance, behind a banner, so the address is reachable.
 */
export function storefrontStatus(
  shop: Pick<SettingsShop, "is_active" | "is_approved">,
): StorefrontStatus {
  if (!shop.is_approved) return "pendingApproval"
  if (!shop.is_active) return "inactive"
  return "connected"
}
