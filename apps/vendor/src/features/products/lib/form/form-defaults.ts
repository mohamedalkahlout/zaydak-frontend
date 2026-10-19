import type { ProductFormInput } from "@/features/products/validations/product"
import type { ProductKind } from "@/features/products/lib/list/product-kind-meta"

/**
 * Defaults for a fresh product form. Mirrors what Shopify pre-fills when
 * you click "Add product" — DRAFT status, SIMPLE type, tracked inventory,
 * physical shipping on, no oversell.
 *
 * `kind` is the choice made in the "Add product" dialog, arriving as
 * `?kind=` on the create route. It only ever *relaxes* the physical
 * defaults above: a download or a service has nothing to weigh or ship,
 * so seeding `requires_shipping: false` saves the merchant from filling
 * in a shipping card that does not apply to them.
 *
 * `VARIABLE` is deliberately not seeded here — the type is derived from
 * having committed option axes (`useVariantOptions.syncFormVariations`),
 * and a VARIABLE product with no variants is rejected by the server.
 * The dialog's "Product with options" choice opens the variants editor
 * instead; see `PRODUCT_KIND_META`.
 */
export function productFormDefaults(kind?: ProductKind): ProductFormInput {
  const isDigital = kind === "DIGITAL"
  const isService = kind === "SERVICE"
  const productType: ProductFormInput["product_type"] = isDigital
    ? "DIGITAL"
    : isService
      ? "SERVICE"
      : "SIMPLE"

  return {
    name: { en: "", ar: "" },
    description: { en: "", ar: "" },
    seo_title: { en: "", ar: "" },
    seo_description: { en: "", ar: "" },
    slug: "",
    status: "DRAFT",
    product_type: productType,
    sale_type: "FIXED_PRICE",
    price: undefined,
    sale_price: undefined,
    cost_per_item: undefined,
    sku: "",
    barcode: "",
    quantity: 0,
    track_quantity: !isDigital && !isService,
    continue_selling_when_out_of_stock: false,
    image: null,
    gallery: [],
    video: [],
    is_digital: isDigital,
    requires_shipping: !isDigital && !isService,
    weight_grams: undefined,
    weight_unit_display: undefined,
    length_mm: undefined,
    width_mm: undefined,
    height_mm: undefined,
    package_id: undefined,
    hs_code: "",
    country_of_origin: "",
    system_category_id: "",
    tag_ids: [],
    collection_ids: [],
    brand: "",
    type_name: "",
    target_audience: undefined,
    variation_options: [],
    inventory_levels: [],
    option_definitions: [],
    attribute_values: {},
    min_bid_price: undefined,
    max_bid_price: undefined,
    max_percentage: undefined,
    expected_version: undefined,
  }
}
