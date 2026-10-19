import type { TranslatedText } from "@/shared/types/api"
import type { Product, ProductAttributeEntry } from "@/features/products/types"
import { centsToMajor } from "@/shared/lib/format"
import type {
  AttributeValueEntryInput,
  ProductFormInput,
  ProductOptionDefinitionInput,
  ProductStatus,
  ProductType,
  SaleType,
  TargetAudience,
  WeightUnit,
} from "@/features/products/validations/product"
import { productFormDefaults } from "./form-defaults"

/**
 * Id → name dictionaries the edit page loads up-front so pickers (for
 * tags) can render selected chips without a second round-trip. Left
 * empty on create.
 */
export interface AttributeSnapshot {
  /** Already-resolved human-readable string, from the server. */
  display_value?: string | null
  /** Server-resolved `name.en`/`ar` for early label rendering. */
  name?: TranslatedText | null
  is_outdated: boolean
}

export interface InitialProductSnapshots {
  tags?: Record<string, string>
  collections?: Record<string, string>
  /**
   * Map of `system_category_id → displayable path` for a single chosen
   * taxonomy node (e.g. `{ sc_abc: "Apparel > Clothing > Shirts" }`).
   * Lets the picker render the selection before the flat taxonomy list
   * finishes loading.
   */
  systemCategory?: Record<string, string>
  /**
   * Per-attribute metadata the renderer needs before the schema arrives
   * (outdated badge, resolved display value). Keyed by attribute key.
   */
  attributes?: Record<string, AttributeSnapshot>
}

function toTranslatable(
  value: string | TranslatedText | null | undefined,
): { en: string; ar: string } {
  if (!value) return { en: "", ar: "" }
  if (typeof value === "string") return { en: value, ar: "" }
  return { en: value.en ?? "", ar: value.ar ?? "" }
}

function toOptionsDict(
  value: Record<string, unknown> | null | undefined,
): Record<string, string> {
  if (!value) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(value)) {
    if (v == null) continue
    out[k] = String(v)
  }
  return out
}

/**
 * Reshape a `ProductAttributeEntry[]` (server row → raw value JSON +
 * type tag) into the form's keyed record. The renderer decides which
 * sub-field is live based on the live definition's type; we pre-fill
 * whichever sub-field matches the server-reported type so edits don't
 * lose data on a first render before the schema query resolves.
 */
function attributeEntriesToValueRecord(
  entries: ProductAttributeEntry[] | null | undefined,
): Record<string, AttributeValueEntryInput> {
  if (!entries?.length) return {}
  const out: Record<string, AttributeValueEntryInput> = {}
  for (const entry of entries) {
    if (!entry?.key) continue
    const type = String(entry.type ?? "").toUpperCase()
    const raw = entry.value

    switch (type) {
      case "TEXT":
        out[entry.key] = { text: raw == null ? "" : String(raw) }
        break
      case "NUMBER":
        out[entry.key] = {
          number:
            typeof raw === "number"
              ? raw
              : raw != null && !Number.isNaN(Number(raw))
                ? Number(raw)
                : undefined,
        }
        break
      case "BOOLEAN":
        out[entry.key] = { boolean: !!raw }
        break
      case "SELECT":
        out[entry.key] = { option: raw == null ? "" : String(raw) }
        break
      case "MULTI_SELECT":
        out[entry.key] = {
          options: Array.isArray(raw) ? raw.map((v) => String(v)) : [],
        }
        break
      default:
        // Unknown server-reported type — store raw as text so the user
        // can at least see it, renderer will replace once schema loads.
        out[entry.key] = { text: raw == null ? "" : String(raw) }
    }
  }
  return out
}

function attributeEntriesToSnapshot(
  entries: ProductAttributeEntry[] | null | undefined,
): Record<string, AttributeSnapshot> {
  if (!entries?.length) return {}
  const out: Record<string, AttributeSnapshot> = {}
  for (const entry of entries) {
    if (!entry?.key) continue
    out[entry.key] = {
      display_value: entry.display_value ?? null,
      name: entry.name ?? null,
      is_outdated: !!entry.is_outdated,
    }
  }
  return out
}

/**
 * Reshape a `Product` entry from the server into the flatter, UI-friendly
 * form shape. Prices move from integer cents → major units; translatable
 * JSON becomes `{ en, ar }` pairs. `version` is tucked into
 * `expected_version` so the next update can participate in the
 * optimistic-lock check (PRODUCTS.md §14.6).
 */
export function productEntryToFormInput(
  product: Product,
  expectedVersionOverride?: number,
): ProductFormInput {
  const defaults = productFormDefaults()

  const expectedVersion =
    expectedVersionOverride ?? product.version ?? undefined

  const optionDefinitions: ProductOptionDefinitionInput[] | undefined =
    product.option_definitions?.map((def) => ({
      name: toTranslatable(def.name),
      position: def.position ?? 1,
      values: def.values.map((v) => ({ label: toTranslatable(v.label) })),
    }))

  return {
    ...defaults,
    name: toTranslatable(product.name),
    description: toTranslatable(product.description),
    seo_title: toTranslatable(product.seo_title),
    seo_description: toTranslatable(product.seo_description),
    slug: product.slug ?? "",
    status: (product.status as ProductStatus) ?? "DRAFT",
    product_type: (product.product_type as ProductType) ?? "SIMPLE",
    sale_type: (product.sale_type as SaleType) ?? "FIXED_PRICE",
    price: product.price_cents != null ? centsToMajor(product.price_cents) : undefined,
    sale_price:
      product.sale_price_cents != null
        ? centsToMajor(product.sale_price_cents)
        : undefined,
    cost_per_item:
      product.cost_per_item_cents != null
        ? centsToMajor(product.cost_per_item_cents)
        : undefined,
    sku: product.sku ?? "",
    barcode: product.barcode ?? "",
    quantity: product.quantity ?? 0,
    track_quantity: product.track_quantity ?? true,
    continue_selling_when_out_of_stock:
      product.continue_selling_when_out_of_stock ?? false,
    image: product.image ?? null,
    // Keep the full media JSON shape — alt/position/media_type round-trip
    // verbatim so the vendor's accessibility text isn't wiped on re-edit.
    gallery: (product.gallery ?? []).map((g) => ({
      id: g.id ?? undefined,
      original: g.original ?? "",
      thumbnail: g.thumbnail ?? "",
      color: g.color ?? "",
      alt: g.alt ?? undefined,
      position: g.position ?? undefined,
      media_type: g.media_type ?? undefined,
    })),
    // Same rule as the gallery: keep whatever the column holds rather than
    // reshaping it, so a key this build does not know about survives a re-edit
    // instead of being silently dropped on the next save.
    video: (product.video ?? []).map((v) => ({
      url: String(v.url ?? ""),
      poster: typeof v.poster === "string" ? v.poster : "",
      attachment_id:
        typeof v.attachment_id === "string" ? v.attachment_id : undefined,
      duration_seconds:
        typeof v.duration_seconds === "number" ? v.duration_seconds : undefined,
    })),
    is_digital: !!product.is_digital,
    requires_shipping: product.requires_shipping ?? true,
    weight_grams: product.weight_grams ?? undefined,
    weight_unit_display: (product.weight_unit_display as WeightUnit | undefined) ?? undefined,
    length_mm: product.length_mm ?? undefined,
    width_mm: product.width_mm ?? undefined,
    height_mm: product.height_mm ?? undefined,
    package_id: product.package_id ?? undefined,
    hs_code: product.hs_code ?? "",
    country_of_origin: product.country_of_origin ?? "",
    system_category_id:
      product.system_category?.id ?? product.system_category_id ?? "",
    tag_ids: (product.tags ?? []).map((t) => t.id),
    collection_ids: (product.collections ?? []).map((c) => c.id),
    brand: product.brand ?? "",
    type_name: product.type_name ?? "",
    target_audience:
      (product.target_audience as TargetAudience | undefined) ?? undefined,
    // Per-location edits start empty on every load: the variants table
    // stages them, the submit hook flushes them, and the reloaded product
    // is the truth again.
    inventory_levels: [],
    variation_options: (product.variation_options ?? []).map((v, idx) => ({
      id: v.id,
      title: toTranslatable(v.title),
      options: toOptionsDict(v.options as Record<string, unknown> | null),
      price:
        v.price_cents != null ? centsToMajor(v.price_cents) : 0,
      sale_price:
        v.sale_price_cents != null ? centsToMajor(v.sale_price_cents) : undefined,
      cost_per_item:
        v.cost_per_item_cents != null
          ? centsToMajor(v.cost_per_item_cents)
          : undefined,
      sku: v.sku ?? "",
      quantity: v.quantity ?? 0,
      position: v.position ?? idx,
      is_disable: !!v.is_disable,
      // Tri-state mirror. The form maps server `null` → null (inherit),
      // explicit `true`/`false` → same. The variant card's tri-state
      // select reads/writes this directly.
      track_quantity: v.track_quantity ?? null,
      image: v.image ?? null,
    })),
    option_definitions: optionDefinitions ?? [],
    attribute_values: attributeEntriesToValueRecord(product.attributes),
    min_bid_price:
      product.min_bid_price_cents != null
        ? centsToMajor(product.min_bid_price_cents)
        : undefined,
    max_bid_price:
      product.max_bid_price_cents != null
        ? centsToMajor(product.max_bid_price_cents)
        : undefined,
    max_percentage:
      product.max_percentage_bps != null
        ? product.max_percentage_bps / 100
        : undefined,
    expected_version: expectedVersion,
  }
}

/**
 * Build id → display-name dictionaries from a product's resolved relations
 * so pickers can render selected chips without refetching.
 */
export function snapshotsFromProduct(product: Product): InitialProductSnapshots {
  const pickName = (
    value: string | TranslatedText | null | undefined,
  ): string => {
    if (!value) return ""
    if (typeof value === "string") return value
    return value.en ?? value.ar ?? ""
  }

  const tags: Record<string, string> = {}
  for (const t of product.tags ?? []) {
    tags[t.id] = pickName(t.name)
  }

  // A product can sit in a collection that is off the picker's first page, so
  // the chip's label comes from the product itself rather than from the list.
  const collections: Record<string, string> = {}
  for (const c of product.collections ?? []) {
    collections[c.id] = pickName(c.name) || c.slug
  }

  // Prefer the path for the display snapshot so the user sees the full
  // ancestor chain ("Apparel > Clothing > Shirts"), not just the leaf.
  const systemCategory: Record<string, string> = {}
  if (product.system_category) {
    const sc = product.system_category
    systemCategory[sc.id] = formatSystemCategoryPath(sc.path, sc.name)
  }

  const attributes = attributeEntriesToSnapshot(product.attributes)

  return { tags, collections, systemCategory, attributes }
}

/**
 * Convert a taxonomy `path` ("apparel/apparel-clothing/shirts") into a
 * human-readable breadcrumb, falling back to the leaf name when no path
 * has been materialized yet.
 */
export function formatSystemCategoryPath(
  path: string | null | undefined,
  fallbackName?: string | null,
): string {
  if (!path) return fallbackName?.trim() || ""
  const parts = path.split("/").filter(Boolean)
  if (parts.length === 0) return fallbackName?.trim() || ""
  return parts
    .map((slug) =>
      slug
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
    )
    .join(" > ")
}
