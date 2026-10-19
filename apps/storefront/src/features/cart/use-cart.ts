"use client"

import { useCallback, useEffect } from "react"
import { useMutation, useQuery } from "@apollo/client/react"

import { useCartSessionStore } from "@/shared/stores/cart-session"
import {
  ADD_TO_CART,
  APPLY_CART_COUPON,
  CART,
  CLEAR_CART,
  REMOVE_CART_COUPON,
  REMOVE_CART_ITEM,
  UPDATE_CART_ITEM,
} from "./api"
import type {
  StorefrontAddToCartMutation,
  StorefrontCartQuery,
} from "@/shared/api/generated/graphql"

export type CartEnvelope = NonNullable<StorefrontCartQuery["cart"]["data"]>
export type CartLine = CartEnvelope["items"][number]

export interface AddToCartArgs {
  product_id: string
  quantity: number
  variation_option_id?: string | null
  composition?: Record<string, unknown> | null
}

/**
 * The cart, as one hook.
 *
 * Two things it exists to centralise:
 *
 * **The session id.** Every operation needs it and it must be identical across
 * all of them, so it lives in `useCartSessionStore` rather than in this hook —
 * a catalogue page mounts one `useCart` per tile, and a `useState` here meant
 * that many copies of the same string, each starting from `null`. See that
 * store for why the null start was not merely wasteful.
 *
 * **Refetching.** Every mutation returns the whole envelope, so the Apollo
 * cache updates itself and nothing here refetches. That is what keeps the
 * header badge, the drawer, the cart page and the checkout summary in step
 * without a store of their own.
 */
export function useCart() {
  const sessionId = useCartSessionStore((s) => s.sessionId)
  const adopt = useCartSessionStore((s) => s.adopt)

  // Reading the cookie is a browser-only act, so it cannot happen during
  // render: these screens are server-rendered, and a `useState` initializer
  // that read `document` would give the server no session and the client one —
  // a hydration mismatch that throws out the tree. `adopt` is idempotent, so
  // the tenth `useCart` on a page costs nothing.
  useEffect(() => {
    adopt()
  }, [adopt])

  const { data, loading, error, refetch } = useQuery(CART, {
    variables: { session_id: sessionId },
    // Nothing useful can be asked before there is an identity to ask about.
    // `CartRepository.getOrCreateCart` throws when handed neither a user nor a
    // session id, so sending `session_id: null` was not a harmless early start
    // — it was a guaranteed failed round trip on every page load, followed by
    // the real one a paint later. Skipping costs that same paint and no request.
    skip: !sessionId,
    // A signed-in visitor's cart lives on the server and can change from
    // another tab or a vendor edit; re-reading it on mount keeps the badge
    // honest while still painting instantly from cache.
    fetchPolicy: "cache-and-network",
  })

  const [addMutation, addState] = useMutation(ADD_TO_CART)
  const [updateMutation, updateState] = useMutation(UPDATE_CART_ITEM)
  const [removeMutation, removeState] = useMutation(REMOVE_CART_ITEM)
  const [clearMutation, clearState] = useMutation(CLEAR_CART)
  const [applyCouponMutation, applyCouponState] = useMutation(APPLY_CART_COUPON)
  const [removeCouponMutation, removeCouponState] = useMutation(REMOVE_CART_COUPON)

  const cart = data?.cart.data ?? null

  /** Guarantees an id before a *write*, even on a visitor's very first click. */
  const writeSession = useCallback(() => sessionId ?? adopt(), [sessionId, adopt])

  const addItem = useCallback(
    (input: AddToCartArgs) =>
      addMutation({
        variables: {
          session_id: writeSession(),
          input: {
            product_id: input.product_id,
            quantity: input.quantity,
            ...(input.variation_option_id
              ? { variation_option_id: input.variation_option_id }
              : {}),
            ...(input.composition ? { composition: input.composition } : {}),
          },
        },
        optimisticResponse: optimisticAdd(cart, input.quantity),
      }),
    [addMutation, writeSession, cart],
  )

  const setQuantity = useCallback(
    (itemId: string, quantity: number) =>
      updateMutation({
        variables: {
          session_id: writeSession(),
          input: { item_id: itemId, quantity },
        },
      }),
    [updateMutation, writeSession],
  )

  const removeItem = useCallback(
    (itemId: string) =>
      removeMutation({
        variables: { session_id: writeSession(), item_id: itemId },
      }),
    [removeMutation, writeSession],
  )

  const clear = useCallback(
    async () => {
      // `clearCart` returns only `{ success }`, so unlike every other mutation
      // here it cannot repaint the cache on its own — this is the one place a
      // refetch is the right answer rather than a missing optimistic update.
      const result = await clearMutation({
        variables: { session_id: writeSession() },
      })
      await refetch()
      return result
    },
    [clearMutation, refetch, writeSession],
  )

  const applyCoupon = useCallback(
    (code: string) =>
      applyCouponMutation({
        variables: { session_id: writeSession(), code },
      }),
    [applyCouponMutation, writeSession],
  )

  const removeCoupon = useCallback(
    (couponId: string) =>
      removeCouponMutation({
        variables: { session_id: writeSession(), coupon_id: couponId },
      }),
    [removeCouponMutation, writeSession],
  )

  return {
    cart,
    items: cart?.items ?? [],
    summary: cart?.summary ?? null,
    /** Badge count. Zero while loading, so the header never flashes a number. */
    itemCount: cart?.summary.total_items ?? 0,
    /** True before the session id exists — the query has not been allowed out yet. */
    loading: loading || !sessionId,
    error,
    mutating:
      addState.loading ||
      updateState.loading ||
      removeState.loading ||
      clearState.loading ||
      applyCouponState.loading ||
      removeCouponState.loading,
    /**
     * A quantity write, on its own.
     *
     * `mutating` is the whole cart's flag and freezing every control on it is
     * right for a remove, a clear or a coupon — each of those is about to
     * repaint the list. A quantity write is the one mutation the shopper is
     * expected to still be interacting with while it runs (see
     * `useQuantityQueue`), so a caller can subtract it: `mutating && !updating`
     * is "busy with something that is not this".
     */
    updating: updateState.loading,
    addItem,
    setQuantity,
    removeItem,
    clear,
    applyCoupon,
    removeCoupon,
    refetch,
  }
}

/**
 * An optimistic `addToCart` that bumps the badge and nothing else.
 *
 * The count is what a shopper watches when they click "add", and it is the one
 * figure this app is allowed to predict: it is a sum of quantities, not a
 * price. **Every money field is passed through untouched**, and no line is
 * fabricated — `verifyCheckout` and the pricing engine decide what an item
 * costs once discounts, flash sales, automatic coupons and tax have had their
 * say, and a client that guessed would show a subtotal that then corrected
 * itself in front of the customer. Callers render the pending state instead
 * (see `CartDrawer`), which is honest about what is not known yet.
 *
 * Returns undefined when the cart has never been loaded — there is no envelope
 * to base a prediction on, and Apollo treats a missing `optimisticResponse` as
 * "just wait for the server", which is exactly right.
 */
export function optimisticAdd(
  cart: CartEnvelope | null,
  quantity: number,
): StorefrontAddToCartMutation | undefined {
  if (!cart) return undefined

  return {
    __typename: "Mutation",
    addToCart: {
      __typename: "CartResponse",
      success: true,
      message: null,
      data: {
        ...cart,
        summary: {
          ...cart.summary,
          total_items: cart.summary.total_items + quantity,
        },
      },
    },
  }
}
