"use client"

import { useEffect } from "react"
// The cache must come from the integration package too — it wraps InMemoryCache
// with the streaming/SSR transport, and the plain one is not assignable.
import {
  ApolloClient,
  ApolloNextAppProvider,
  InMemoryCache,
} from "@apollo/client-integration-nextjs"

import { useApolloClient } from "@apollo/client/react"

import { useAuthStore } from "@/shared/stores/auth"
import { useShopSlug } from "@/shared/lib/use-shop-slug"
import { composeLinks } from "./links"
import { storefrontProductsFieldPolicy } from "./storefront-products-policy"

function makeClient() {
  return new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            // Infinite scroll: `page` is excluded from keyArgs and later pages
            // concatenate via `merge`. See `storefront-products-policy.ts`.
            storefrontProducts: storefrontProductsFieldPolicy,
          },
        },
        // Neither public product type carries an `id` the cache can normalize
        // on its own in every response shape, so pin the key fields. Without
        // this a product read through the list and the same product read
        // through the PDP are two cache entries, and a wishlist toggle on one
        // does not repaint the other.
        PublicProduct: { keyFields: ["id"] },
        CartEnvelope: { keyFields: ["id"] },
      },
    }),
    // Reads the shop and its token per request, not at construction time, so a
    // rotated token — or a walk to another storefront — is picked up without
    // rebuilding the client.
    link: composeLinks(),
  })
}

/**
 * Keeps the session store and the normalized cache in step with the shop in the
 * URL.
 *
 * **It lives here, in the root layout, not in `ShopShell`.** `ShopShell`
 * renders inside `<PreloadQuery>`, above `ShopProvider`'s `useSuspenseQuery`,
 * so its effects do not commit until the shop query resolves — and it is not
 * re-created when a visitor walks from one storefront to another on the client.
 */
function SessionSync() {
  // Host-aware: on `acme.zaydak.com` the path carries no slug, and reading the
  // first segment would hydrate the auth store under a shop called `products`
  // and evict the cache on every navigation between sections.
  const slug = useShopSlug()
  const client = useApolloClient()

  useEffect(() => {
    useAuthStore.getState().hydrate(slug)

    // These five ROOT_QUERY fields take no shop argument — they are scoped only
    // by the `X-SHOP` header, on a single normalized cache mounted above
    // `[shopSlug]`. Evicting them on a shop change is what stops one shop's
    // profile, cart, saved items, orders or addresses being handed to another.
    //
    // Deliberately not `clearStore()`: this component sits above
    // `<PreloadQuery>`, so clearing the whole cache would discard the shop
    // payload the server just streamed and force an immediate re-suspend.
    for (const fieldName of [
      "me",
      "cart",
      "wishlists",
      "orders",
      "myAddresses",
      "shopPaymentOptions",
      "shopBankAccounts",
      "orderBankTransfers",
    ]) {
      client.cache.evict({ id: "ROOT_QUERY", fieldName })
    }
    client.cache.gc()
  }, [slug, client])

  return null
}

export function ApolloProvider({ children }: { children: React.ReactNode }) {
  return (
    <ApolloNextAppProvider makeClient={makeClient}>
      <SessionSync />
      {children}
    </ApolloNextAppProvider>
  )
}
