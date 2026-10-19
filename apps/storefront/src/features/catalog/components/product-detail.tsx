"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useSuspenseQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { ArrowRight, ChevronRight, PackageX, ShoppingBag } from "lucide-react"
import { sileo } from "sileo"

import { Button } from "@repo/ui/components/button"
import { cn } from "@repo/ui/lib/utils"

import { imageRef, imageRefs, text } from "@/shared/lib/multilang"
import { useAddToCartGesture } from "@/features/cart/use-add-gesture"
import { useCart } from "@/features/cart/use-cart"
import { useShop } from "@/features/shop/shop-context"
import { useSignInGate } from "@/features/auth/use-sign-in-gate"
import { WishlistButton } from "@/features/wishlist/components/wishlist-button"
import {
  STOREFRONT_PRODUCT,
  STOREFRONT_RECOMMENDATIONS,
  VIEW_PRODUCT,
} from "../api"
import {
  isPurchasable,
  maxOrderableQuantity,
  priceDisplay,
  stockState,
} from "../lib/product"
import {
  defaultVariation,
  findVariation,
  selectionOf,
  type OptionSelection,
} from "../lib/variations"
import { DetailSection } from "./detail-section"
import { ProductFacts } from "./product-facts"
import { ProductGallery } from "./product-gallery"
import { ProductGrid } from "./product-grid"
import { ProductPrice, SaleBadge } from "./product-price"
import { ProductRating, ProductReviews } from "./product-reviews"
import { QuantityStepper } from "./quantity-stepper"
import { VariationPicker } from "./variation-picker"
import { NegotiateButton } from "@/features/negotiation/components/negotiate-panel"

/**
 * The product page.
 *
 * **Server-rendered.** `app/[shopSlug]/products/[slug]/page.tsx` preloads
 * `STOREFRONT_PRODUCT` and this reads it back with `useSuspenseQuery`, so there
 * is no loading branch here any more — the component either has a product or
 * has established there is none. Everything below the fold that depends on the
 * *loaded* product stays a client query: `RelatedProducts` needs the product
 * id this query returns, so the server cannot start it without waiting for this
 * one first, and a second serial round trip before first paint costs more than
 * the related rail is worth.
 *
 * Three blocks, in this order at every width: the gallery mosaic across the
 * top, then a two-column body — everything about the *thing* on the left,
 * everything about *buying it* on the right — then related products.
 *
 * The columns are placed explicitly (`lg:col-start`/`lg:row-start`) rather than
 * left to auto-flow, because the reading order has to differ from the visual
 * one. On a phone the buy bar comes first, straight under the photos, and the
 * description follows it; on a desktop the description is the left column and
 * the buy bar sits top-right. Auto-flow can produce one of those orders, not
 * both.
 */
export function ProductDetail({ slug }: { slug: string }) {
  const t = useTranslations("product")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const router = useRouter()
  const { slug: shopSlug, base, currency, shop } = useShop()
  const requireSignIn = useSignInGate()
  const { addItem, mutating } = useCart()
  const addGesture = useAddToCartGesture()

  // Preloaded by the page, so this resolves against the server's own read
  // rather than opening a request after hydration — the product's name, price,
  // description and photos are in the HTML the crawler and the shopper both
  // receive. `errorPolicy: "all"` keeps a NOT_FOUND as a value: the page below
  // renders its own "no such product" panel, and a missing slug is an ordinary
  // outcome of a stale link rather than an error boundary's business.
  const { data } = useSuspenseQuery(STOREFRONT_PRODUCT, {
    variables: { slug },
    errorPolicy: "all",
  })
  const product = data?.storefrontProduct.data ?? null

  const [viewProduct] = useMutation(VIEW_PRODUCT)
  useEffect(() => {
    // Fire-and-forget: the counter is not rendered here, and a shopper should
    // never see an error because a view failed to record.
    void viewProduct({ variables: { slug } }).catch(() => {})
  }, [slug, viewProduct])

  const variations = useMemo(
    () => product?.variation_options ?? [],
    [product],
  )
  const hasVariations = variations.length > 0

  const [selection, setSelection] = useState<OptionSelection | null>(null)
  const [quantity, setQuantity] = useState(1)

  // Adjust-state-during-render rather than an effect: the picker must open on a
  // real variation, and seeding it in an effect would commit one frame showing
  // the parent row's price before correcting itself.
  const [seededFor, setSeededFor] = useState<string | null>(null)
  if (product && hasVariations && seededFor !== product.id) {
    setSeededFor(product.id)
    const initial = defaultVariation(variations)
    setSelection(initial ? selectionOf(initial) : {})
    setQuantity(1)
  }

  const selected = useMemo(
    () => (selection ? findVariation(variations, selection) : null),
    [variations, selection],
  )

  if (!product) {
    return (
      <div className="shop-container py-16 sm:py-24">
        <div className="relative overflow-hidden rounded-3xl bg-card px-6 py-16 text-center ring-1 ring-shop-hairline sm:py-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,var(--shop-accent-soft)_0%,transparent_58%)]"
          />
          <span
            aria-hidden
            className="relative mx-auto grid size-12 place-items-center rounded-full bg-shop-accent-soft text-shop-accent"
          >
            <PackageX className="size-5" strokeWidth={1.5} />
          </span>
          <h1 className="relative mt-5 font-heading text-shop-title font-semibold tracking-tight">
            {t("notFoundTitle")}
          </h1>
          <p className="relative mx-auto mt-3 max-w-md text-shop-body text-muted-foreground">
            {t("notFoundBody")}
          </p>
          <Button
            className="relative mt-8 bg-shop-accent text-shop-accent-foreground hover:bg-shop-accent/90"
            nativeButton={false}
            render={<Link href={`${base}/products`} />}
          >
            {t("backToCatalog")}
          </Button>
        </div>
      </div>
    )
  }

  const name = text(product.name, locale, product.slug)
  const description = text(product.description, locale)

  // A chosen variation is the authority on price and stock — the parent row's
  // figures describe no purchasable thing once options exist.
  const price = selected
    ? priceDisplay({
        product_type: "SIMPLE",
        price_cents: selected.price_cents,
        selling_price_cents: selected.selling_price_cents,
        compare_at_price_cents: selected.compare_at_price_cents,
      })
    : priceDisplay(product)

  const effectiveStock = selected
    ? stockState({
        in_stock: selected.quantity > 0 || product.continue_selling_when_out_of_stock,
        quantity: selected.quantity,
        track_quantity: product.track_quantity,
        continue_selling_when_out_of_stock:
          product.continue_selling_when_out_of_stock,
      })
    : stockState(product)

  const maxQuantity = selected
    ? maxOrderableQuantity({
        quantity: selected.quantity,
        track_quantity: product.track_quantity,
        continue_selling_when_out_of_stock:
          product.continue_selling_when_out_of_stock,
      })
    : maxOrderableQuantity(product)

  const needsSelection = hasVariations && !selected
  const canBuy =
    !needsSelection && effectiveStock !== "out_of_stock" && isPurchasable(product)

  // A variation's own photo leads the gallery when it has one, so choosing
  // "Red" shows the red one without the shopper hunting for it in the strip.
  const galleryImages = imageRefs(product.gallery)
  const cover = imageRef(product.image)
  const variationImage = selected ? imageRef(selected.image) : null
  const images = [
    ...(variationImage ? [variationImage] : []),
    ...(cover && cover.original !== variationImage?.original ? [cover] : []),
    ...galleryImages.filter(
      (image) =>
        image.original !== cover?.original &&
        image.original !== variationImage?.original,
    ),
  ]

  const collection = product.collections?.[0]
  const badge = collection ? text(collection.name, locale) : null
  const specs = specRows(product, locale, selected?.sku ?? null, t)

  async function add() {
    if (!product) return false
    try {
      await addItem({
        product_id: product.id,
        quantity,
        variation_option_id: selected?.id ?? null,
      })
      return true
    } catch {
      sileo.error({ title: tCommon("somethingWentWrong") })
      return false
    }
  }

  /**
   * The confirmation starts before the mutation settles, not after it succeeds.
   *
   * `addToCart` predicts the item count, so the badge has already moved; the
   * drawer renders the money as unsettled until the server prices the cart.
   * Waiting for the round trip to acknowledge the click would leave the buy bar
   * looking inert for the length of it, which is the whole complaint. A failure
   * still surfaces — `add` raises its own toast — over a drawer showing the
   * cart genuinely unchanged.
   *
   * The gesture is fired from the click's own `currentTarget`, synchronously:
   * it measures the element, and the reference is only valid for the duration
   * of the dispatch.
   */
  async function onAddToCart(event: React.MouseEvent<HTMLButtonElement>) {
    const photo = variationImage ?? cover
    addGesture(event.currentTarget, photo?.thumbnail ?? photo?.original ?? null)
    await add()
  }

  /**
   * Buy now is add-to-cart plus a redirect, not a second order path.
   *
   * `createOrder` prices and places the *cart*, so there is nothing to skip:
   * anything that bypassed it would have to build a second one. A signed-out
   * shopper is asked to sign in before the address form, which is the app's
   * deliberate ordering — the popup now asks it here, over the product, and
   * `/checkout` stays a guarded route for anyone arriving at it directly.
   */
  async function onBuyNow() {
    if (!(await add())) return
    // The cart is filled first either way, so a shopper who signs in from the
    // popup lands on checkout with the item already in it.
    if (requireSignIn(`${base}/checkout`)) return
    router.push(`${base}/checkout`)
  }

  const buyLabel = mutating
    ? t("adding")
    : needsSelection
      ? t("selectVariationFirst")
      : effectiveStock === "out_of_stock"
        ? t("outOfStock")
        : t("buyNow")

  return (
    <div className="shop-container py-6 lg:py-8">
      <nav
        aria-label={t("breadcrumb")}
        className="mb-4 inline-flex max-w-full items-center gap-2 rounded-full bg-card px-3.5 py-1.5 text-sm ring-1 ring-shop-hairline"
      >
        <Link
          href={`${base}/products`}
          className="shrink-0 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {t("backToCatalog")}
        </Link>
        <ChevronRight
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground/50 rtl:rotate-180"
        />
        <span className="truncate">{name}</span>
      </nav>

      <ProductGallery
        images={images}
        alt={name}
        activeId={variationImage?.id ?? null}
        badge={badge}
      />

      <div className="mt-2.5 grid gap-2.5 lg:grid-cols-2 lg:items-start">
        {/* ── The thing ─────────────────────────────────────────────────── */}
        <section className="shop-panel order-2 p-6 sm:p-8 lg:order-none lg:col-start-1 lg:row-start-1 lg:p-10">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <SaleBadge price={price} />
                <StockChip
                  state={effectiveStock}
                  quantity={selected?.quantity ?? product.quantity}
                />
              </div>
              <h1 className="font-heading text-shop-title font-semibold tracking-tight text-balance">
                {name}
              </h1>
              {product.brand && (
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {product.brand}
                </p>
              )}
            </div>
            <WishlistButton
              productId={product.id}
              variationOptionId={selected?.id ?? null}
              className="size-10 shrink-0"
            />
          </div>

          <div className="mt-2.5">
            <ProductRating productId={product.id} />
          </div>

          {hasVariations && product.option_definitions && (
            <div className="mt-6">
              <VariationPicker
                definitions={product.option_definitions}
                variations={variations}
                selection={selection ?? {}}
                onSelect={(optionName, value) =>
                  setSelection((current) => ({
                    ...(current ?? {}),
                    [optionName.toLowerCase()]: value.toLowerCase(),
                  }))
                }
              />
            </div>
          )}

          <div className="mt-6 flex flex-col gap-4">
            {description && (
              <DetailSection title={t("description")} defaultOpen>
                <p className="max-w-prose text-shop-body leading-relaxed whitespace-pre-line text-muted-foreground">
                  {description}
                </p>
              </DetailSection>
            )}

            <DetailSection title={t("shippingTitle")} defaultOpen>
              <ProductFacts
                isDigital={product.is_digital}
                requiresShipping={product.requires_shipping}
                shopName={shop?.name ?? shopSlug}
                availability={stockLabel(effectiveStock, selected?.quantity ?? product.quantity, t)}
                weight={
                  typeof product.weight_grams === "number" && product.weight_grams > 0
                    ? `${product.weight_grams} ${product.weight_unit_display ?? "g"}`
                    : null
                }
                origin={product.country_of_origin ?? null}
              />
            </DetailSection>

            {specs.length > 0 && (
              <DetailSection title={t("specifications")}>
                <dl className="divide-y divide-shop-hairline text-sm">
                  {specs.map((row) => (
                    <div key={row.label} className="flex gap-4 py-2.5">
                      <dt className="w-40 shrink-0 text-muted-foreground">
                        {row.label}
                      </dt>
                      <dd className="min-w-0 flex-1">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </DetailSection>
            )}
          </div>

          <p className="mt-5 text-xs text-muted-foreground">
            {t("views", { count: product.views })}
          </p>
        </section>

        {/* ── Buying it ─────────────────────────────────────────────────── */}
        <div className="order-1 flex flex-col gap-2.5 lg:order-none lg:col-start-2 lg:row-start-1">
          <div className="rounded-3xl bg-foreground p-5 text-background sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <ProductPrice
                price={price}
                currency={currency}
                size="xl"
                tone="inverse"
              />
              <Button
                size="lg"
                className="h-12 rounded-full bg-shop-accent px-6 text-base text-shop-accent-foreground hover:bg-shop-accent/90"
                disabled={!canBuy || mutating}
                onClick={onBuyNow}
              >
                {buyLabel}
                <ArrowRight className="rtl:rotate-180" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <QuantityStepper
              value={quantity}
              onChange={setQuantity}
              max={maxQuantity}
              disabled={!canBuy}
            />
            <Button
              variant="outline"
              size="lg"
              className="h-11 min-w-40 flex-1 border-shop-hairline bg-card hover:border-shop-accent hover:text-shop-accent"
              disabled={!canBuy || mutating}
              onClick={onAddToCart}
            >
              <ShoppingBag />
              {mutating ? t("adding") : t("addToCart")}
            </Button>
          </div>

          <NegotiateButton
            productId={product.id}
            productTitle={name}
            productSlug={product.slug}
            variationOptionId={selected?.id ?? null}
          />

          <ProductReviews productId={product.id} />
        </div>
      </div>

      <RelatedProducts currentId={product.id} />
    </div>
  )
}

/** The stock wording, resolved once so the chip and the facts grid agree. */
function stockLabel(
  state: ReturnType<typeof stockState>,
  quantity: number,
  t: (key: string, values?: Record<string, number>) => string,
): string {
  if (state === "low_stock") return t("lowStock", { count: quantity })
  if (state === "backorder") return t("backorder")
  if (state === "out_of_stock") return t("outOfStock")
  return t("inStock")
}

function StockChip({
  state,
  quantity,
}: {
  state: ReturnType<typeof stockState>
  quantity: number
}) {
  const t = useTranslations("product")

  const tone = {
    in_stock: "text-shop-in-stock",
    low_stock: "text-shop-low-stock",
    backorder: "text-muted-foreground",
    out_of_stock: "text-shop-out-of-stock",
  }[state]

  return (
    <span className={cn("text-xs font-medium", tone)}>
      {stockLabel(state, quantity, t)}
    </span>
  )
}

type SpecSource = {
  sku?: string | null
  country_of_origin?: string | null
  weight_grams?: number | null
  weight_unit_display?: string | null
  attributes?: ReadonlyArray<{
    key: string
    name: unknown
    value: unknown
    unit?: string | null
    display_value?: string | null
  }> | null
}

/**
 * The spec table's rows.
 *
 * `attributes[].display_value` is the vendor-facing rendering the back-end
 * already produced (unit appended, option label resolved); falling back to the
 * raw `value` only when it is absent avoids re-implementing that formatting and
 * getting a different answer for the same row.
 */
function specRows(
  product: SpecSource,
  locale: string,
  selectedSku: string | null,
  t: (key: string) => string,
): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = []

  const sku = selectedSku ?? product.sku
  if (sku) rows.push({ label: t("sku"), value: sku })

  if (product.country_of_origin) {
    rows.push({ label: t("origin"), value: product.country_of_origin })
  }

  if (typeof product.weight_grams === "number" && product.weight_grams > 0) {
    rows.push({
      label: t("weight"),
      value: `${product.weight_grams} ${product.weight_unit_display ?? "g"}`,
    })
  }

  for (const attribute of product.attributes ?? []) {
    const label = text(attribute.name, locale, attribute.key)
    const value =
      attribute.display_value ?? text(attribute.value, locale)
    if (label && value) rows.push({ label, value })
  }

  return rows
}

/**
 * "You might also like".
 *
 * **Ranked by similarity now, not by the vendor's own grouping.** It used to
 * ask for the newest members of the product's first collection, which is a
 * reasonable heuristic and wrong in two common shapes: a product in no
 * collection got the shop's newest products (related to nothing), and a shop
 * whose one collection is "All products" got the same four tiles under every
 * product it sells. `storefrontRecommendations` answers from pgvector
 * similarity over the product's own embedding instead, and when that comes back
 * short the server tops it up from the same taxonomy category — so the fallback
 * is still *about this product* rather than about the shop.
 *
 * Still a client query, not a preload: it depends on the loaded product's id,
 * which the server pass does not have until the product resolves.
 *
 * The server excludes the product being viewed, and the `currentId` filter here
 * is kept as a second line — the ranker is a suggestion and this component
 * showing "you might also like: the thing you are looking at" is the one bug
 * worth spending a comparison on.
 */
function RelatedProducts({ currentId }: { currentId: string }) {
  const t = useTranslations("product")

  const { data, loading } = useQuery(STOREFRONT_RECOMMENDATIONS, {
    variables: { product_id: currentId, limit: 5 },
  })

  const products = (data?.storefrontRecommendations.data ?? [])
    .filter((entry) => entry.id !== currentId)
    .slice(0, 4)

  if (!loading && products.length === 0) return null

  return (
    <section className="mt-14">
      <h2 className="mb-6 text-center font-heading text-shop-title font-semibold tracking-tight">
        {t("relatedTitle")}
      </h2>
      <ProductGrid products={products} loading={loading} skeletonCount={4} />
    </section>
  )
}

export function ProductDetailSkeleton() {
  return (
    <div className="shop-container animate-pulse py-6 lg:py-8">
      <div className="h-7 w-48 rounded-full bg-card ring-1 ring-shop-hairline" />
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:grid-rows-2 sm:aspect-[2.2/1]">
        <div className="col-span-2 aspect-square rounded-2xl bg-muted ring-1 ring-shop-hairline sm:aspect-auto sm:row-span-2" />
        <div className="aspect-square rounded-2xl bg-muted ring-1 ring-shop-hairline sm:aspect-auto" />
        <div className="aspect-square rounded-2xl bg-muted ring-1 ring-shop-hairline sm:aspect-auto" />
        <div className="col-span-2 aspect-[2/1] rounded-2xl bg-muted ring-1 ring-shop-hairline sm:aspect-auto" />
      </div>
      <div className="mt-2.5 grid gap-2.5 lg:grid-cols-2">
        <div className="h-96 rounded-3xl bg-muted ring-1 ring-shop-hairline" />
        <div className="flex flex-col gap-2.5">
          <div className="h-24 rounded-3xl bg-muted ring-1 ring-shop-hairline" />
          <div className="h-11 rounded-full bg-muted ring-1 ring-shop-hairline" />
          <div className="h-56 rounded-3xl bg-muted ring-1 ring-shop-hairline" />
        </div>
      </div>
    </div>
  )
}
