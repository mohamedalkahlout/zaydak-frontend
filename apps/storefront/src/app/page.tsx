import { PUBLIC_SHOPS, directoryVariables } from "@/features/shop/api"
import { ShopDirectory } from "@/features/shop/components/shop-directory"
import { PreloadQuery, storefrontContext } from "@/shared/apollo/rsc"

/**
 * The marketplace's front door, with its one query started on the server.
 *
 * `storefrontContext()` is called with **no slug** here, and this is the only
 * page in the app where that is right: `/` has no shop scope, `shops` is the
 * one list query not behind `RequireShopGuard`, and sending an `X-SHOP` would
 * narrow the directory to a single storefront.
 *
 * There is no `Suspense` at this level because `ShopDirectory` no longer
 * suspends as a whole — the heading and the search box render immediately and
 * only the grid waits, behind its own boundary.
 */
export default async function LandingPage() {
  return (
    <PreloadQuery
      query={PUBLIC_SHOPS}
      variables={directoryVariables("")}
      context={await storefrontContext()}
    >
      <ShopDirectory />
    </PreloadQuery>
  )
}
