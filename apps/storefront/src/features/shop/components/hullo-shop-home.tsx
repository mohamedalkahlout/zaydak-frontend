"use client"

import { useCallback, useEffect, useMemo } from "react"
import { useQuery } from "@apollo/client/react"
import { useLocale } from "next-intl"
import { useRouter } from "next/navigation"

import {
  HulloTemplate,
  type HulloShopCart,
} from "@repo/storefront-templates/hullo"

import { useSignInGate } from "@/features/auth/use-sign-in-gate"
import { STOREFRONT_PRODUCTS } from "@/features/catalog/api"
import { useCart } from "@/features/cart/use-cart"
import { useQuantityQueue } from "@/features/cart/use-quantity-queue"
import { hulloLinesFromCart, hulloMenuFromProducts } from "@/features/shop/lib/hullo-menu"
import { useShop } from "@/features/shop/shop-context"
import { formatMoney } from "@/shared/lib/format"
import { HULLO_FONTS } from "./hullo-fonts"

type HulloSite = {
  setCart?: (
    lines: ReturnType<typeof hulloLinesFromCart>,
    totalCents: number,
  ) => void
  closeTray?: () => void
}

function hulloSite(): HulloSite | undefined {
  return (window as { __site?: HulloSite }).__site
}

/**
 * The hullo home wired to the shop cart. Cards are `storefrontProducts`.
 * Add, quantity and remove write that cart. The tray is painted from it.
 * Checkout opens the same cart; it does not copy the lines a second time.
 * The cup builder, the camera roll and the hours sign stay the template's
 * own scene, and a built cup is not a cart line.
 */
export function HulloShopHome() {
  const { base, currency } = useShop()
  const locale = useLocale()
  const router = useRouter()
  const requireSignIn = useSignInGate()
  const { addItem, setQuantity, removeItem, cart, refetch } = useCart()
  const { data, loading } = useQuery(STOREFRONT_PRODUCTS, {
    variables: { filters: { limit: 24 } },
  })

  const menu = useMemo(
    () => hulloMenuFromProducts(data?.storefrontProducts.data ?? [], locale),
    [data, locale],
  )

  const { quantityOf, set: queueSet, cancel: queueCancel } = useQuantityQueue(
    async (itemId, quantity) => {
      const result = await setQuantity(itemId, quantity)
      if (!result.data?.updateCartItem.success) {
        throw new Error(result.data?.updateCartItem.message ?? "cart")
      }
    },
  )

  const lines = useMemo(
    () => (cart ? hulloLinesFromCart(cart.items, quantityOf) : []),
    [cart, quantityOf],
  )
  const totalCents = cart?.summary.total_price_cents ?? 0

  const addProduct = useCallback(
    async (productId: string) => {
      const result = await addItem({ product_id: productId, quantity: 1 })
      return Boolean(result.data?.addToCart.success)
    },
    [addItem],
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
    hulloSite()?.closeTray?.()
    if (!requireSignIn(destination)) router.push(destination)
    return true
  }, [base, requireSignIn, router])

  const formatCents = useCallback(
    (cents: number) =>
      formatMoney(cents, cart?.summary.currency ?? currency, locale),
    [cart?.summary.currency, currency, locale],
  )

  const shopCart = useMemo<HulloShopCart>(
    () => ({
      addProduct,
      setQuantity: changeQuantity,
      removeLine: (itemId) => changeQuantity(itemId, 0),
      goCheckout,
      formatCents,
    }),
    [addProduct, changeQuantity, formatCents, goCheckout],
  )

  const ready = menu.items.length > 0

  useEffect(() => {
    if (!ready) return
    hulloSite()?.setCart?.(lines, totalCents)
  }, [lines, ready, totalCents])

  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) void refetch()
    }
    window.addEventListener("pageshow", onShow)
    return () => window.removeEventListener("pageshow", onShow)
  }, [refetch])

  if (loading && !data) return <div className="hullo-tpl" />

  return (
    <HulloTemplate
      menu={ready ? menu.items : undefined}
      filters={ready ? menu.filters : undefined}
      currency={currency ?? "SAR"}
      shopCart={ready ? shopCart : undefined}
      fonts={HULLO_FONTS}
    />
  )
}
