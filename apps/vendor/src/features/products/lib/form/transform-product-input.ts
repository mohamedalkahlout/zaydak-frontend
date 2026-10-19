import type { TranslatedText } from "@/shared/types/api"
import type { CreateProductInput, CreateVariationInput, ProductAttributeValueInput, ProductOptionDefinitionInput, UpdateProductInput } from "@/features/products/types"
import { majorToCents } from "@/shared/lib/format"
import type {
  ProductFormOutput,
  ProductOptionDefinitionOutput,
} from "@/features/products/validations/product"

/** Drop empty locales so the server doesn't see `{ en: "" }`. */
function cleanTranslatable(
  value: { en?: string; ar?: string } | undefined,
): TranslatedText | undefined {
  if (!value) return undefined
  const out: TranslatedText = {}
  if (value.en?.trim()) out.en = value.en.trim()
  if (value.ar?.trim()) out.ar = value.ar.trim()
  return Object.keys(out).length > 0 ? out : undefined
}

function cleanString(value: string | undefined | null): string | undefined {
  if (value == null) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function stripEmpty<T extends Record<string, unknown>>(obj: T): T {
  const out = { ...obj } as Record<string, unknown>
  for (const key of Object.keys(out)) {
    if (out[key] === undefined) delete out[key]
  }
  return out as T
}

function toVariationInput(
  v: ProductFormOutput["variation_options"][number],
  fallbackPosition: number,
): CreateVariationInput {
  return stripEmpty({
    // Preserve existing id so the backend upserts rather than wipes +
    // recreates — keeps OrderProduct / CartItem FKs valid (PRODUCTS.md
    // §10.2 diff-by-SKU upsert).
    id: cleanString(v.id),
    title: cleanTranslatable(v.title) ?? { en: "" },
    options: v.options,
    price_cents: majorToCents(v.price),
    sale_price_cents:
      v.sale_price != null ? majorToCents(v.sale_price) : undefined,
    cost_per_item_cents:
      v.cost_per_item != null ? majorToCents(v.cost_per_item) : undefined,
    sku: cleanString(v.sku),
    quantity: v.quantity ?? 0,
    position: v.position ?? fallbackPosition,
    // Pass through the tri-state override. `null` (the form default)
    // tells the backend "inherit parent" — leave the column NULL so the
    // reservation engine COALESCEs against the product flag. `stripEmpty`
    // drops nulls, so we send `track_quantity` only when the vendor
    // actually set an override, keeping the wire payload tight.
    track_quantity: v.track_quantity,
    image: v.image && v.image.original ? (v.image as Record<string, unknown>) : undefined,
  }) as CreateVariationInput
}

/**
 * Strip empty option-definition rows + flatten to the wire shape. The
 * server's `validateVariationsAgainstDefinitions` rejects definitions with
 * an empty `name.en`, so we drop those at the boundary instead of hitting
 * a server 422.
 */
function toOptionDefinitionsInput(
  definitions: ProductOptionDefinitionOutput[] | undefined,
): ProductOptionDefinitionInput[] | undefined {
  if (!definitions?.length) return undefined
  const out: ProductOptionDefinitionInput[] = []
  for (let i = 0; i < definitions.length; i += 1) {
    const def = definitions[i]
    const name = cleanTranslatable(def.name)
    if (!name?.en) continue
    const values = def.values
      .map((v) => {
        const label = cleanTranslatable(v.label)
        return label?.en ? { label } : null
      })
      .filter((v): v is { label: TranslatedText } => v !== null)
    if (values.length === 0) continue
    out.push({ name, position: def.position ?? i + 1, values })
  }
  return out.length > 0 ? out : undefined
}

/**
 * Flatten the form's keyed `attribute_values` record into the server's
 * `ProductAttributeValueInput[]`. Only emits entries that have exactly
 * one populated sub-field — empty entries (user cleared a previously
 * filled optional) are dropped so we don't trip the backend's
 * exactly-one-value CHECK constraint. Required-but-empty fails at the
 * form's zod layer before we get here.
 */
function toAttributeValuesInput(
  values: ProductFormOutput["attribute_values"],
): ProductAttributeValueInput[] | undefined {
  const out: ProductAttributeValueInput[] = []
  for (const [key, entry] of Object.entries(values ?? {})) {
    if (!key || !entry) continue

    const payload: ProductAttributeValueInput = { attribute_key: key }
    let populated = 0

    if (entry.text != null && entry.text !== "") {
      payload.value_text = entry.text
      populated += 1
    }
    if (entry.number != null && !Number.isNaN(entry.number)) {
      payload.value_number = entry.number
      populated += 1
    }
    if (typeof entry.boolean === "boolean") {
      payload.value_boolean = entry.boolean
      populated += 1
    }
    if (entry.option != null && entry.option !== "") {
      payload.value_option = entry.option
      populated += 1
    }
    if (entry.options && entry.options.length > 0) {
      payload.value_options = entry.options
      populated += 1
    }

    // Guard the server's exactly-one CHECK — don't ship an empty wrapper,
    // don't ship more than one sub-field (the renderer shouldn't allow
    // this, but a stale form after a schema change could).
    if (populated === 1) out.push(payload)
  }
  return out.length > 0 ? out : undefined
}

/**
 * Common auction fields shared between create + update. AUCTION products
 * store bid amounts as integer cents and `max_percentage` as basis points
 * (1 bp = 0.01%, 10000 = 100%) per PRODUCTS.md §3.
 */
function auctionFields(
  data: ProductFormOutput,
): Pick<
  CreateProductInput,
  "min_bid_price_cents" | "max_bid_price_cents" | "max_percentage_bps"
> {
  if (data.sale_type !== "AUCTION") return {}
  return {
    min_bid_price_cents:
      data.min_bid_price != null ? majorToCents(data.min_bid_price) : undefined,
    max_bid_price_cents:
      data.max_bid_price != null ? majorToCents(data.max_bid_price) : undefined,
    max_percentage_bps:
      data.max_percentage != null
        ? Math.round(data.max_percentage * 100)
        : undefined,
  }
}

/**
 * Reshape validated form output into the `CreateProductInput` payload.
 * Prices move from major units → integer cents; empty strings / locales
 * are stripped so the backend's "required" checks see real values only.
 */
export function toCreateProductInput(
  data: ProductFormOutput,
): CreateProductInput {
  const isVariable = data.product_type === "VARIABLE"

  const payload = {
    name: cleanTranslatable(data.name) ?? { en: "" },
    slug: cleanString(data.slug),
    description: cleanTranslatable(data.description),
    seo_title: cleanTranslatable(data.seo_title),
    seo_description: cleanTranslatable(data.seo_description),
    status: data.status,
    product_type: data.product_type,
    sale_type: data.sale_type,
    ...auctionFields(data),

    // Pricing — VARIABLE products derive price from variations server-side.
    price_cents:
      !isVariable && data.price != null ? majorToCents(data.price) : undefined,
    sale_price_cents:
      !isVariable && data.sale_price != null
        ? majorToCents(data.sale_price)
        : undefined,
    cost_per_item_cents:
      !isVariable && data.cost_per_item != null
        ? majorToCents(data.cost_per_item)
        : undefined,

    // Inventory (SIMPLE only)
    sku: !isVariable ? cleanString(data.sku) : undefined,
    barcode: !isVariable ? cleanString(data.barcode) : undefined,
    quantity: !isVariable ? data.quantity : undefined,
    track_quantity: data.track_quantity,
    continue_selling_when_out_of_stock: data.continue_selling_when_out_of_stock,

    // Media
    image:
      data.image && data.image.original
        ? (data.image as Record<string, unknown>)
        : undefined,
    gallery:
      data.gallery && data.gallery.length > 0
        ? (data.gallery as Record<string, unknown>[])
        : undefined,
    // Omitted when empty on CREATE, matching `gallery` — a new product with no
    // clip should not write an empty array over the column's default.
    video:
      data.video && data.video.length > 0
        ? (data.video as Record<string, unknown>[])
        : undefined,

    // Flags
    is_digital: data.is_digital,

    // Shipping
    requires_shipping: data.requires_shipping,
    weight_grams: data.weight_grams,
    weight_unit_display: data.weight_unit_display,
    length_mm: data.length_mm,
    width_mm: data.width_mm,
    height_mm: data.height_mm,
    package_id: cleanString(data.package_id),
    hs_code: cleanString(data.hs_code),
    country_of_origin: cleanString(data.country_of_origin),

    // Organization
    system_category_id: cleanString(data.system_category_id),
    tag_ids: data.tag_ids.length > 0 ? data.tag_ids : undefined,
    collection_ids:
      data.collection_ids.length > 0 ? data.collection_ids : undefined,
    brand: cleanString(data.brand),
    type_name: cleanString(data.type_name),
    target_audience: data.target_audience,

    // Variations
    variation_options: isVariable
      ? data.variation_options.map((v, i) => toVariationInput(v, i))
      : undefined,

    // Shopify variant-grid schema
    option_definitions: isVariable
      ? toOptionDefinitionsInput(data.option_definitions)
      : undefined,

    // Metafields
    attribute_values: toAttributeValuesInput(data.attribute_values),
  }

  return stripEmpty(payload) as CreateProductInput
}

/**
 * Reshape the validated form output into an `UpdateProductInput` payload.
 *
 * Backend contract (PRODUCTS.md §10.2):
 *   - Omitted field → keep as-is.
 *   - Value (even null) → overwrite.
 *   - `collection_ids: []` / `tag_ids: []` → clear the list.
 *
 * So we always send collection_ids + tag_ids (empty array means "clear"),
 * strings that were cleared get `null`, and `expected_version` tags along
 * for the optimistic-lock check.
 */
export function toUpdateProductInput(
  data: ProductFormOutput,
  id: string,
): UpdateProductInput {
  const isVariable = data.product_type === "VARIABLE"
  const payload: UpdateProductInput = {
    id,
    name: cleanTranslatable(data.name),
    slug: cleanString(data.slug),
    description: cleanTranslatable(data.description),
    seo_title: cleanTranslatable(data.seo_title),
    seo_description: cleanTranslatable(data.seo_description),
    status: data.status,
    product_type: data.product_type,
    sale_type: data.sale_type,
    ...auctionFields(data),

    price_cents:
      !isVariable && data.price != null ? majorToCents(data.price) : undefined,
    sale_price_cents:
      !isVariable && data.sale_price != null
        ? majorToCents(data.sale_price)
        : undefined,
    cost_per_item_cents:
      !isVariable && data.cost_per_item != null
        ? majorToCents(data.cost_per_item)
        : undefined,

    sku: !isVariable ? cleanString(data.sku) : undefined,
    barcode: !isVariable ? cleanString(data.barcode) : undefined,
    quantity: !isVariable ? data.quantity : undefined,
    track_quantity: data.track_quantity,
    continue_selling_when_out_of_stock: data.continue_selling_when_out_of_stock,

    image:
      data.image && data.image.original
        ? (data.image as Record<string, unknown>)
        : undefined,
    gallery: data.gallery as Record<string, unknown>[],
    // Sent unconditionally on UPDATE, unlike the create path above: an empty
    // array is how a vendor REMOVES the last clip, and omitting it would make
    // that deletion silently un-saveable.
    video: (data.video ?? []) as Record<string, unknown>[],

    is_digital: data.is_digital,

    requires_shipping: data.requires_shipping,
    weight_grams: data.weight_grams,
    weight_unit_display: data.weight_unit_display,
    length_mm: data.length_mm,
    width_mm: data.width_mm,
    height_mm: data.height_mm,
    package_id: cleanString(data.package_id),
    hs_code: cleanString(data.hs_code),
    country_of_origin: cleanString(data.country_of_origin),

    system_category_id: cleanString(data.system_category_id),
    tag_ids: data.tag_ids,
    collection_ids: data.collection_ids,

    brand: cleanString(data.brand),
    type_name: cleanString(data.type_name),
    target_audience: data.target_audience,

    variation_options: isVariable
      ? data.variation_options.map((v, i) => toVariationInput(v, i))
      : undefined,

    option_definitions: isVariable
      ? toOptionDefinitionsInput(data.option_definitions)
      : undefined,

    attribute_values: toAttributeValuesInput(data.attribute_values),
  }

  // Optimistic-lock token — only send if we actually have one so legacy
  // edits from stale UIs don't trip the STALE_OBJECT guard unnecessarily.
  if (data.expected_version !== undefined) {
    payload.expected_version = data.expected_version
  }

  return stripEmpty(payload as Record<string, unknown>) as UpdateProductInput
}
