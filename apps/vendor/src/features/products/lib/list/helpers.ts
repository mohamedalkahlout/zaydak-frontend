import type { Product, ProductVariationOption, StockStatus } from "@/features/products/types"
import { LOW_STOCK_THRESHOLD } from "./constants"

type TranslatableName = Product["name"] | ProductVariationOption["title"]

/** Normalize a translatable name to a string (EN → AR → empty). */
export function productName(name: TranslatableName): string {
  if (!name) return ""
  if (typeof name === "string") return name
  return name.en ?? name.ar ?? ""
}

/** Total stock across a product (simple uses quantity; variable sums options). */
export function totalStock(product: Product): number {
  if (product.product_type === "VARIABLE" && product.variation_options?.length) {
    return product.variation_options.reduce(
      (sum, v) => sum + (v.quantity ?? 0),
      0,
    )
  }
  return product.quantity ?? 0
}

/**
 * How many variants the row has, or 0 for a product that is not variable.
 *
 * The list only prints this to qualify the stock number ("… for 2 variants"),
 * so a SIMPLE product returns 0 rather than 1 — it has no variants, it is one
 * thing, and saying "for 1 variant" on every simple row is noise.
 */
export function variantCount(product: Product): number {
  if (product.product_type !== "VARIABLE") return 0
  return product.variation_options?.length ?? 0
}

export function stockBucket(product: Product): StockStatus {
  if (!product.in_stock || totalStock(product) === 0) return "OUT_OF_STOCK"
  if (totalStock(product) <= LOW_STOCK_THRESHOLD) return "LOW_STOCK"
  return "IN_STOCK"
}

/** Display the price or a price range for variable products. */
export function priceDisplay(
  product: Product,
  format: (cents: number | null | undefined) => string,
): string {
  if (
    product.product_type === "VARIABLE" &&
    product.min_price_cents != null &&
    product.max_price_cents != null &&
    product.min_price_cents !== product.max_price_cents
  ) {
    return `${format(product.min_price_cents)} – ${format(product.max_price_cents)}`
  }
  return format(product.sale_price_cents ?? product.price_cents)
}

/**
 * A row's link into the editor, carrying the list's own query string.
 *
 * That suffix is what the editor header's up/down arrows read back: it lets
 * them re-run the exact same `products` query (a cache hit) and step through
 * the list the vendor built, and it is what sends Back to the page and filters
 * they left rather than to page 1.
 */
export function productEditHref(
  shopSlug: string,
  slug: string,
  listQuery?: string,
): string {
  const base = `/store/${shopSlug}/products/${slug}/edit`
  return listQuery ? `${base}?${listQuery}` : base
}
