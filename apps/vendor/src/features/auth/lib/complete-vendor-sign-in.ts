import type { ApolloClient } from "@apollo/client"

import { ensureVendorShop } from "@/features/shops/lib/ensure-vendor-shop"
import { safeRedirect } from "@/shared/lib/auth/redirect"
import { shopSlugOfPath } from "@/shared/lib/shop-path"

/**
 * After tokens are persisted: make sure the vendor has a shop, then land on
 * its dashboard (or a safe `?redirect=` that already points inside a store).
 *
 * Empty-shop auth destinations (`/store`, `/shops`, `/create-store`) are
 * replaced with `/store/{slug}` so a brand-new Google account never sees the
 * empty picker.
 *
 * A redirect into a shop is followed only when the account that just signed in
 * holds that shop. The parameter outlives the session that wrote it — the
 * proxy adds it whenever a signed-out request reaches a dashboard page — so
 * after an account switch it names the *previous* account's shop, and
 * following it opened a dashboard whose every query `ShopHeaderGuard` refuses
 * with RESOURCE_NOT_FOUND. Only current handles are known here, so a retired
 * handle of the vendor's own shop lands on the dashboard instead of the deep
 * link.
 */
export async function completeVendorSignIn({
  client,
  temporaryName,
  redirect,
}: {
  client: ApolloClient
  temporaryName: string
  redirect: string | null
}): Promise<string> {
  try {
    const { slug, slugs } = await ensureVendorShop(client, temporaryName)
    const dashboard = `/store/${slug}`
    const dest = safeRedirect(redirect, dashboard)
    if (
      dest === "/store" ||
      dest === "/shops" ||
      dest === "/login" ||
      dest === "/create-store" ||
      dest === "/"
    ) {
      return dashboard
    }
    const redirectShop = shopSlugOfPath(dest)
    if (redirectShop && !slugs.includes(redirectShop)) return dashboard
    return dest
  } catch {
    // The shop list never arrived, so nothing vouches for a shop-scoped
    // redirect. `/store` makes the same choice on the server, against this
    // account's own shops.
    const dest = safeRedirect(redirect, "/store")
    return shopSlugOfPath(dest) ? "/store" : dest
  }
}
