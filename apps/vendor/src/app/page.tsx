import { redirect } from "next/navigation"

/**
 * `/` has no screen of its own. `/store` chooses the shop — the one this
 * browser opened last if the signed-in account still holds it, otherwise the
 * account's first — and the proxy sends a signed-out visitor to sign in.
 *
 * This used to redirect straight to `/store/{active_shop_slug}`. That cookie
 * outlives the session that wrote it, so after an account switch `/` opened the
 * previous account's shop, a dashboard whose every query the back-end refuses;
 * signed out, it planted that shop in the login page's `?redirect=`.
 */
export default function RootPage() {
  redirect("/store")
}
