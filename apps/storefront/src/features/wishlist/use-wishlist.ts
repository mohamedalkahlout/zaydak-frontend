"use client"

import { useCallback, useEffect } from "react"
import { useMutation, useQuery } from "@apollo/client/react"

import { useShopSession } from "@/shared/stores/auth"
import { useGuestWishlistStore } from "@/shared/stores/guest-wishlist"
import { useShopSlug } from "@/shared/lib/use-shop-slug"
import { IN_WISHLIST, TOGGLE_WISHLIST, WISHLISTS } from "./api"

/**
 * Whether one product is saved, and a toggle for it.
 *
 * **Two backing stores behind one interface, chosen by whether there is a
 * session.** Signed in, this is the server's list: `inWishlist` per product,
 * `toggleWishlist` to write. Signed out, it is `localStorage` — and the heart
 * still works, because `adoptGuestWishlist` moves whatever was staged onto the
 * account the moment one exists. Before that existed the signed-out heart sent
 * the visitor to sign in instead, on the grounds that a locally-staged wishlist
 * would be lost at the very moment they did; the handover is what removed the
 * objection rather than worked around it.
 *
 * `inWishlist` is `JwtAuthGuard`, so it stays skipped for a signed-out visitor
 * rather than fired and allowed to fail — an unauthenticated call would trip
 * the Apollo error link's auth handling and sign the visitor out of a session
 * they never had.
 *
 * The toggle refetches `wishlists` rather than writing the cache by hand. The
 * saved-items page is a separate paginated query whose *shape* changes on a
 * toggle (a row appears or disappears, `meta.total` moves), and hand-patching
 * that is how a list ends up one item out of step with its own count.
 */
export function useWishlistToggle(productId: string | null | undefined) {
  const slug = useShopSlug()
  const { isAuthenticated } = useShopSession(slug)

  const guestIds = useGuestWishlistStore((s) => s.ids)
  const adoptGuest = useGuestWishlistStore((s) => s.adopt)
  const toggleGuest = useGuestWishlistStore((s) => s.toggle)

  // Reading `localStorage` is a browser-only act, so it cannot happen during
  // render: these screens are server-rendered, and a `useState` initializer
  // touching storage would give the server an empty list and the client a full
  // one — a hydration mismatch that throws out the tree. `adopt` is idempotent
  // per shop, so the tenth heart on a grid costs nothing.
  useEffect(() => {
    if (slug) adoptGuest(slug)
  }, [slug, adoptGuest])

  const { data, loading } = useQuery(IN_WISHLIST, {
    variables: { product_id: productId ?? "" },
    skip: !isAuthenticated || !productId,
    fetchPolicy: "cache-first",
  })

  const [toggleMutation, { loading: toggling }] = useMutation(TOGGLE_WISHLIST, {
    refetchQueries: [WISHLISTS],
  })

  const toggle = useCallback(
    async (variationOptionId?: string | null) => {
      if (!productId) return null

      // The signed-out path is synchronous and local. It deliberately drops
      // `variationOptionId`: the guest list is product ids only, because the
      // ids are all `storefrontProducts` needs to rebuild the saved-items page
      // and all `toggleWishlist` needs at handover. A saved variation is a
      // refinement worth having only once there is an account to hold it.
      if (!isAuthenticated) {
        if (!slug) return null
        return toggleGuest(slug, productId)
      }

      const result = await toggleMutation({
        variables: {
          input: {
            product_id: productId,
            ...(variationOptionId
              ? { variation_option_id: variationOptionId }
              : {}),
          },
        },
        // The server's answer is authoritative, but writing it back into
        // `inWishlist` is what repaints every heart for this product on screen
        // — the tile in the grid and the one on the PDP are the same cache
        // entry, so neither has to be told separately.
        update(cache, { data: mutationData }) {
          const next = mutationData?.toggleWishlist.data.in_wishlist
          if (typeof next !== "boolean") return
          cache.writeQuery({
            query: IN_WISHLIST,
            variables: { product_id: productId },
            data: { inWishlist: { success: true, in_wishlist: next } },
          })
        },
      })
      return result.data?.toggleWishlist.data.in_wishlist ?? null
    },
    [productId, isAuthenticated, slug, toggleGuest, toggleMutation],
  )

  return {
    isAuthenticated,
    saved: isAuthenticated
      ? (data?.inWishlist.in_wishlist ?? false)
      : !!productId && guestIds.includes(productId),
    loading,
    toggling,
    toggle,
  }
}
