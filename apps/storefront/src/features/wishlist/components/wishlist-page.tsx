"use client"

import Image from "@/shared/components/app-image"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { Heart, X } from "lucide-react"
import { sileo } from "sileo"

import { Button } from "@repo/ui/components/button"

import { formatMoney } from "@/shared/lib/format"
import { imageRef, text } from "@/shared/lib/multilang"
import { useAddToCartGesture } from "@/features/cart/use-add-gesture"
import { useCart } from "@/features/cart/use-cart"
import { useShop } from "@/features/shop/shop-context"
import { STOREFRONT_PRODUCTS } from "@/features/catalog/api"
import { useShopSession } from "@/shared/stores/auth"
import { useGuestWishlistStore } from "@/shared/stores/guest-wishlist"
import { WISHLISTS } from "../api"
import { consumeWishlistMergeNotice } from "../adopt-guest-wishlist"
import { useWishlistToggle } from "../use-wishlist"

const PAGE_SIZE = 24

/**
 * One saved item, from either source, in the shape the row draws.
 *
 * Every field the row does not strictly need is optional, because the two
 * sources are different GraphQL types (`WishlistProduct` and `PublicProduct`)
 * that happen to overlap on what a saved row shows. Widening here rather than
 * casting keeps the row honest about what may be missing — `text()` and
 * `imageRef()` both already take an unknown and fall back.
 */
interface SavedItem {
  key: string
  productId: string
  variationOptionId: string | null
  product: {
    id: string
    slug: string
    name?: unknown
    image?: unknown
    price_cents?: number | null
    sale_price_cents?: number | null
    product_type?: string | null
  }
}

/**
 * Saved items.
 *
 * **Two sources, one list.** Signed in, the rows come from `wishlists`, which
 * is *not* shop-scoped — a customer's saved items span every shop they have
 * ever shopped, and the API has no filter for one — so the list is narrowed
 * here to this shop's products, because a storefront showing another store's
 * items would offer links that leave the shop without saying so. The rows the
 * filter drops are still saved and still visible from that shop's own page.
 *
 * Signed out, there are no rows to fetch: the list is product ids in
 * `localStorage`, so the page rehydrates them through `storefrontProducts`'
 * `ids` filter — which is what that filter was added for. It is already
 * shop-scoped by the same query, so the narrowing above has no signed-out
 * twin, and a product that has since been unpublished or deleted simply does
 * not come back, which is the right outcome without a sweep of its own.
 *
 * Both queries are declared unconditionally and one is always skipped: hooks
 * cannot be called behind a branch, and `skip` is how Apollo says "not this
 * one" without one.
 */
export function WishlistPage() {
  const t = useTranslations("wishlist")
  const tCommon = useTranslations("common")
  const { shop, slug, base } = useShop()
  const { isAuthenticated } = useShopSession(slug)

  // A sign-in armed this when it moved guest hearts onto the account. It
  // reads-and-clears, so it appears once, on the list the moved rows are in.
  // Same persisted-after-hydration exception as the cart page's notice.
  const [mergeNotice, setMergeNotice] = useState(false)
  useEffect(() => {
    if (!consumeWishlistMergeNotice()) return
    /* eslint-disable-next-line react-hooks/set-state-in-effect --
     * Restoring persisted state after hydration: this flag was written to
     * `sessionStorage` before the post-sign-in document load, so a `useState`
     * initializer would read it on the server too and mismatch the hydrated
     * markup. Same exception as the vendor's `signup-wizard`.
     */
    setMergeNotice(true)
  }, [])

  const guestIds = useGuestWishlistStore((s) => s.ids)
  const adoptGuest = useGuestWishlistStore((s) => s.adopt)
  const pruneGuest = useGuestWishlistStore((s) => s.prune)
  useEffect(() => {
    if (slug) adoptGuest(slug)
  }, [slug, adoptGuest])

  const { data, loading: accountLoading } = useQuery(WISHLISTS, {
    variables: { page: 1, limit: PAGE_SIZE },
    skip: !isAuthenticated,
  })

  const { data: guestData, loading: guestLoading } = useQuery(
    STOREFRONT_PRODUCTS,
    {
      variables: {
        filters: {
          ids: guestIds,
          ...(shop?.id ? { shop_ids: [shop.id] } : {}),
          limit: PAGE_SIZE,
        },
      },
      // No ids means nothing to ask about — and an empty `ids` array is a
      // request for nothing, not a request for everything, so skipping also
      // saves a guaranteed-empty round trip.
      skip: isAuthenticated || guestIds.length === 0,
    },
  )

  // The rehydration doubles as the prune sweep. The list was asked for
  // verbatim, so every staged id that did not come back is deleted,
  // unpublished or from a shop that's off — keeping it would retry a corpse
  // on every sign-in from now on. It must only run once `data` actually
  // resolved: a query still loading, or one that errored, must not look like
  // proof that everything saved is gone.
  useEffect(() => {
    if (isAuthenticated) return
    const rows = guestData?.storefrontProducts.data
    if (!rows) return
    pruneGuest(slug, new Set(rows.map((product) => product.id)))
  }, [guestData, isAuthenticated, slug, pruneGuest])

  const entries: SavedItem[] = isAuthenticated
    ? (data?.wishlists.data ?? [])
        .filter((entry) => !shop?.id || entry.product?.shop_id === shop.id)
        .flatMap((entry) =>
          entry.product
            ? [
                {
                  key: entry.id,
                  productId: entry.product_id,
                  variationOptionId: entry.variation_option_id ?? null,
                  product: {
                    ...entry.product,
                    product_type: null,
                  },
                },
              ]
            : [],
        )
    : (guestData?.storefrontProducts.data ?? []).map((product) => ({
        key: product.id,
        productId: product.id,
        // The guest list holds ids only; a variation is a refinement that
        // arrives with an account. `moveToCart` surfaces the back-end's own
        // message when a VARIABLE product needs one.
        variationOptionId: null,
        product,
      }))

  const loading = isAuthenticated
    ? accountLoading
    : guestLoading && guestIds.length > 0

  if (loading) {
    return (
      <div className="shop-container grid animate-pulse gap-4 py-10 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-32 rounded-3xl bg-muted ring-1 ring-shop-hairline"
          />
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="shop-container py-16 sm:py-24">
        <div className="relative overflow-hidden rounded-3xl bg-card px-6 py-16 text-center ring-1 ring-shop-hairline sm:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,var(--shop-accent-soft)_0%,transparent_58%)]"
          />
          <span
            aria-hidden
            className="relative mx-auto grid size-14 place-items-center rounded-full bg-shop-accent-soft text-shop-accent"
          >
            <Heart className="size-6" strokeWidth={1.5} />
          </span>
          <h1 className="relative mt-6 font-heading text-shop-title font-semibold tracking-tight">
            {t("empty")}
          </h1>
          <p className="relative mx-auto mt-3 max-w-md text-shop-body leading-relaxed text-muted-foreground">
            {t("emptyBody")}
          </p>
          <Button
            className="relative mt-8 rounded-full bg-shop-accent text-shop-accent-foreground hover:bg-shop-accent/90"
            nativeButton={false}
            render={<Link href={`${base}/products`} />}
          >
            {t("moveToCart")}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="shop-container py-10">
      <h1 className="mb-8 font-heading text-shop-title font-semibold tracking-tight">
        {t("title")}
      </h1>

      {mergeNotice && (
        <div className="mb-9 flex items-start justify-between gap-4 rounded-3xl border border-shop-accent/20 bg-shop-accent-soft px-4 py-3">
          <p className="text-shop-body text-sm leading-relaxed">{t("mergedNotice")}</p>
          <button
            type="button"
            onClick={() => setMergeNotice(false)}
            aria-label={tCommon("close")}
            className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-card hover:text-shop-accent"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => (
          <WishlistRow key={entry.key} entry={entry} />
        ))}
      </ul>
    </div>
  )
}

function WishlistRow({ entry }: { entry: SavedItem }) {
  const t = useTranslations("wishlist")
  const tProduct = useTranslations("product")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const { base, currency } = useShop()
  const { addItem } = useCart()
  const addGesture = useAddToCartGesture()
  const { toggle, toggling } = useWishlistToggle(entry.productId)
  // Local, not `useCart().mutating`: every row holds its own copy of the hook,
  // so the shared flag disabled every "move to cart" on the page at once.
  const [adding, setAdding] = useState(false)

  const product = entry.product

  const name = text(product.name, locale, product.slug)
  const image = imageRef(product.image)
  const price = product.sale_price_cents ?? product.price_cents ?? null

  return (
    <li className="shop-panel flex gap-4 p-4">
      <Link
        href={`${base}/products/${product.slug}`}
        data-flight-source
        className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-secondary ring-1 ring-shop-hairline"
      >
        {image ? (
          <Image
            src={image.thumbnail ?? image.original}
            alt=""
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : null}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Link
          href={`${base}/products/${product.slug}`}
          className="line-clamp-2-title text-sm font-medium hover:text-shop-accent"
        >
          {name}
        </Link>
        {price !== null && (
          <span className="font-heading text-sm font-semibold tabular-nums">
            {formatMoney(price, currency, locale)}
          </span>
        )}

        <div className="mt-auto flex flex-wrap gap-2">
          {product.product_type === "VARIABLE" && !entry.variationOptionId ? (
            <Button
              size="xs"
              variant="outline"
              className="rounded-full border-shop-hairline bg-card hover:border-shop-accent hover:text-shop-accent"
              nativeButton={false}
              render={<Link href={`${base}/products/${product.slug}`} />}
            >
              {t("chooseOptions")}
            </Button>
          ) : (
            <Button
              size="xs"
              className="rounded-full bg-shop-accent text-shop-accent-foreground hover:bg-shop-accent/90"
              disabled={adding}
              onClick={async (event) => {
                setAdding(true)
                // Fired up front rather than on success — the confirmation is
                // the photo leaving the row, and the drawer behind it renders
                // its own pending state for money the pricing engine has not
                // returned yet. Read `currentTarget` before the first await.
                addGesture(
                  event.currentTarget,
                  image?.thumbnail ?? image?.original ?? null,
                )
                try {
                  await addItem({
                    product_id: product.id,
                    quantity: 1,
                    variation_option_id: entry.variationOptionId,
                  })
                } catch (error) {
                  sileo.error({
                    title: tCommon("somethingWentWrong"),
                    description:
                      error instanceof Error ? error.message : undefined,
                  })
                } finally {
                  setAdding(false)
                }
              }}
            >
              {t("moveToCart")}
            </Button>
          )}
          <Button
            size="xs"
            variant="ghost"
            className="hover:text-shop-accent"
            disabled={toggling}
            onClick={async () => {
              await toggle(entry.variationOptionId)
              sileo.success({ title: tProduct("removedFromWishlist") })
            }}
          >
            {t("remove")}
          </Button>
        </div>
      </div>
    </li>
  )
}
