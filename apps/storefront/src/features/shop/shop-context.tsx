"use client"

import { createContext, useContext, useMemo } from "react"
import { useSuspenseQuery } from "@apollo/client/react"

import { SHOP_BY_SLUG } from "./api"
import type { StorefrontShopQuery } from "@/shared/api/generated/graphql"
import { CurrencyProvider } from "@/shared/lib/currency/use-currency"

type ShopData = NonNullable<StorefrontShopQuery["shop"]["data"]>

interface ShopContextValue {
  /** The slug out of the URL. Present before the query resolves. */
  slug: string
  /**
   * The prefix every in-app link starts with.
   *
   * `"/acme"` when the visitor is on the apex, `""` when they are on the shop's
   * own hostname — where the address bar already says which shop this is and a
   * slug segment in the path would be a second, wrong copy of that fact.
   *
   * This is why links are written `` `${base}/cart` `` rather than
   * `` `/${slug}/cart` ``: one expression that is correct at both addresses,
   * with no call site having to know which one it is rendering for. A hardcoded
   * `` `/${slug}/cart` `` on a shop host navigates to `acme.zaydak.com/acme/cart`,
   * which the proxy then rewrites to `/acme/acme/cart` and 404s.
   */
  base: string
  /**
   * How the shop was addressed. `base` covers every link *into* this shop;
   * this covers the handful that point back **out** of it — the directory
   * links, which are `/` on the apex and a different origin entirely on a shop
   * host. See `marketplaceHref`.
   */
  mode: "path" | "host"
  shop: ShopData | null
  /** True once the query has settled and there is no shop to show. */
  missing: boolean
  /**
   * The shop's ISO-4217 code, or null when there is no shop at all.
   *
   * Null rather than a guessed default on purpose: a price rendered in the
   * wrong currency is worse than a price that has not appeared yet, so callers
   * skeleton the amount instead of printing one. With the shop preloaded on the
   * server this is only ever null for a closed storefront, which renders no
   * prices — but the contract is unchanged and callers need no edit.
   */
  currency: string | null
}

const ShopContext = createContext<ShopContextValue | null>(null)

/**
 * Loads the shop once, for the whole `/[shopSlug]` subtree.
 *
 * Every screen under it needs at least the name and the currency, and having
 * each fetch its own copy would mean N identical round trips and N different
 * moments at which prices appear.
 *
 * **It suspends rather than reporting `loading`.** The layout above it preloads
 * `SHOP_BY_SLUG` on the server (`app/[shopSlug]/layout.tsx`), so by the time
 * this renders the result is already streaming in and `useSuspenseQuery`
 * resolves against that stream instead of opening a second request. That is
 * what puts the shop's name, currency and prices in the HTML — with `useQuery`
 * the server render returned `loading: true` and shipped a skeleton to the
 * browser and to every crawler that does not run JavaScript.
 *
 * It also collapses a read that used to happen twice: the layout still fetches
 * the shop shell for `generateMetadata` and the brand colours, but that is a
 * cached six-field read, not a second copy of this query.
 *
 * `errorPolicy: "all"` is load-bearing. `ShopsService.findBySlug` answers
 * NOT_FOUND for a shop that is missing, unapproved, suspended or soft-deleted,
 * and all four mean "this storefront is not open" — a screen this app renders.
 * Without it `useSuspenseQuery` would *throw* that, turning an ordinary closed
 * shop into an error boundary's problem.
 */
export function ShopProvider({
  slug,
  base,
  mode,
  children,
}: {
  slug: string
  /** See `ShopContextValue.base`. Resolved on the server and passed down. */
  base: string
  /** See `ShopContextValue.mode`. */
  mode: "path" | "host"
  children: React.ReactNode
}) {
  const { data, error } = useSuspenseQuery(SHOP_BY_SLUG, {
    variables: { slug },
    // A shop's name and currency change about never; refetching them on every
    // navigation inside the store would be a request per page view.
    fetchPolicy: "cache-first",
    errorPolicy: "all",
  })

  const value = useMemo<ShopContextValue>(() => {
    const shop = data?.shop.data ?? null
    return {
      slug,
      base,
      mode,
      shop,
      missing: !!error || !shop,
      currency: shop?.currency ?? null,
    }
  }, [data, error, slug, base, mode])

  return (
    <ShopContext.Provider value={value}>
      <CurrencyProvider baseCurrency={value.currency}>
        {children}
      </CurrencyProvider>
    </ShopContext.Provider>
  )
}

/** Throws outside the provider — every storefront screen is shop-scoped. */
export function useShop(): ShopContextValue {
  const ctx = useContext(ShopContext)
  if (!ctx) throw new Error("useShop must be used inside a ShopProvider")
  return ctx
}
