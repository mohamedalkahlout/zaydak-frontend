"use client"

import { useCallback, useEffect, useMemo } from "react"
import { useQuery } from "@apollo/client/react"
import { useRouter } from "next/navigation"

import { DripTemplate, type DripShopCart } from "@repo/storefront-templates/drip"

import { useSignInGate } from "@/features/auth/use-sign-in-gate"
import { STOREFRONT_PRODUCTS } from "@/features/catalog/api"
import { useCart } from "@/features/cart/use-cart"
import { useQuantityQueue } from "@/features/cart/use-quantity-queue"
import { STOREFRONT_PRODUCT_COMPOSITION } from "@/features/shop/api"
import { useShop } from "@/features/shop/shop-context"
import {
  DRIP_BUILDER_SLUG,
  dripBagLinesFromCart,
  dripCatalogueFromComposition,
  dripComposition,
  type DripOrderLine,
  type DripServerBagLine,
  type StorefrontComposition,
} from "@/features/shop/lib/drip-order"
import { formatMoney } from "@/shared/lib/format"

type DripSite = {
  setBag?: (lines: DripServerBagLine[], subtotalCents: number) => void
  closeBag?: () => void
}

function dripSite(): DripSite | undefined {
  return (window as { __site?: DripSite }).__site
}

/**
 * The drip home wired to the shop cart. The cone reads the builder's
 * assembly when the shop has one, and the sample until that query lands.
 * Add, quantity and remove write the shop cart. The bag sheet is that
 * cart. Checkout opens it; it does not copy the lines a second time.
 */
export function DripShopHome({ fonts }: { fonts: string }) {
  const { base, currency } = useShop()
  const router = useRouter()
  const requireSignIn = useSignInGate()
  const { addItem, setQuantity, removeItem, cart, refetch } = useCart()
  const { data, loading: productsLoading } = useQuery(STOREFRONT_PRODUCTS, {
    variables: { filters: { limit: 24 } },
  })

  const bySlug = useMemo(() => {
    const map = new Map<string, string>()
    for (const product of data?.storefrontProducts.data ?? []) {
      if (product.slug) map.set(product.slug, product.id)
    }
    return map
  }, [data])

  const builderId = bySlug.get(DRIP_BUILDER_SLUG) ?? null
  const compositionQuery = useQuery(STOREFRONT_PRODUCT_COMPOSITION, {
    variables: { product_id: builderId ?? "" },
    skip: !builderId,
  })
  const assembled = useMemo(
    () =>
      dripCatalogueFromComposition(
        (compositionQuery.data?.storefrontProductComposition.data ??
          null) as StorefrontComposition | null,
        bySlug,
      ),
    [bySlug, compositionQuery.data],
  )

  const { quantityOf, set: queueSet, cancel: queueCancel } = useQuantityQueue(
    async (itemId, quantity) => {
      const result = await setQuantity(itemId, quantity)
      if (!result.data?.updateCartItem.success) {
        throw new Error(result.data?.updateCartItem.message ?? "cart")
      }
    },
  )

  const lines = useMemo(() => {
    if (!builderId || !assembled?.binding || !cart) return []
    return dripBagLinesFromCart(cart.items, builderId, assembled.binding).map(
      (line) => ({
        ...line,
        quantity: quantityOf(line.id, line.quantity),
      }),
    )
  }, [assembled, builderId, cart, quantityOf])

  const subtotalCents = cart?.summary.subtotal_price_cents ?? 0

  const persistLine = useCallback(
    async (line: DripOrderLine) => {
      if (!builderId) return false
      const composition = dripComposition(line, bySlug, assembled?.binding)
      if (!composition) return false
      const result = await addItem({
        product_id: builderId,
        quantity: line.quantity,
        composition,
      })
      return Boolean(result.data?.addToCart.success)
    },
    [addItem, assembled?.binding, builderId, bySlug],
  )

  const changeQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      if (quantity < 1) {
        queueCancel(itemId)
        const result = await removeItem(itemId)
        return Boolean(result.data?.removeCartItem.success)
      }
      queueSet(itemId, quantity)
      return true
    },
    [queueCancel, queueSet, removeItem],
  )

  const goCheckout = useCallback(async () => {
    const destination = `${base}/checkout`
    dripSite()?.closeBag?.()
    if (!requireSignIn(destination)) router.push(destination)
    return true
  }, [base, requireSignIn, router])

  const formatCents = useCallback(
    (cents: number, lang: string) =>
      formatMoney(cents, cart?.summary.currency ?? currency, lang === "ar" ? "ar" : "en"),
    [cart?.summary.currency, currency],
  )

  const shopCart = useMemo<DripShopCart>(
    () => ({
      persistLine,
      setQuantity: changeQuantity,
      removeLine: (itemId) => changeQuantity(itemId, 0),
      goCheckout,
      formatCents,
    }),
    [changeQuantity, formatCents, goCheckout, persistLine],
  )

  const ready = Boolean(builderId) && !compositionQuery.loading

  useEffect(() => {
    if (!ready) return
    dripSite()?.setBag?.(lines, subtotalCents)
  }, [assembled, lines, ready, subtotalCents])

  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) void refetch()
    }
    window.addEventListener("pageshow", onShow)
    return () => window.removeEventListener("pageshow", onShow)
  }, [refetch])

  // The bare `.drip-tpl` that used to sit here is the pistachio page.
  // It replaced the cream loader for the whole composition read.
  const productsPending = productsLoading && !data
  const compositionPending =
    Boolean(builderId) && !compositionQuery.data && compositionQuery.loading
  const hold = productsPending || compositionPending

  return (
    <DripTemplate
      fonts={fonts}
      shopCart={shopCart}
      catalogue={hold ? undefined : assembled?.catalogue}
      hold={hold}
    />
  )
}
