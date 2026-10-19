import type { GraphQLResult, PaginationMeta, TranslatedText } from "@/shared/types/api"

/**
 * The three statuses a product can be in — Shopify's set, and the whole of it.
 *
 * `PUBLISH` rather than `ACTIVE` because that is the wire value; the label the
 * vendor reads is "Active" and lives in `products.status.<value>`
 * (`PRODUCT_STATUS_LABELS` keeps an English copy for non-React callers).
 */
export type ProductStatus = "DRAFT" | "PUBLISH" | "UNLISTED"

export type ProductType = "SIMPLE" | "VARIABLE" | "DIGITAL" | "SERVICE"

/** Pricing mechanism — orthogonal to `ProductType`. */
export type SaleType = "FIXED_PRICE" | "NEGOTIABLE" | "AUCTION"

export type ProductSortBy =
  | "NEWEST"
  | "OLDEST"
  | "PRICE_LOW"
  | "PRICE_HIGH"
  | "MOST_VIEWED"

export type TargetAudience = "MEN" | "WOMEN" | "KIDS" | "UNISEX"

/** Vendor display preference for weight (storage stays grams). */
export type WeightUnit = "KG" | "LB" | "G" | "OZ"


/** Computed stock bucket — filter only, not a DB field. */
export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK"

export interface ProductImage {
  id?: string
  original?: string
  thumbnail?: string
}

export interface ProductGalleryImage extends ProductImage {
  color?: string | null
  /** SEO/accessibility text — multilang ({en, ar}). */
  alt?: { en?: string; ar?: string } | null
  /** Display order in the gallery. */
  position?: number | null
  media_type?: "IMAGE" | "VIDEO" | "EXTERNAL_VIDEO" | "MODEL_3D" | null
}

export interface ProductVideo {
  url: string
  [key: string]: unknown
}

export interface ProductVariationOption {
  id: string
  title: string | TranslatedText | null
  /** Display order in the variant grid (Shopify-style). */
  position?: number | null
  price_cents?: number | null
  sale_price_cents?: number | null
  cost_per_item_cents?: number | null
  sku?: string | null
  quantity?: number | null
  sold_quantity?: number | null
  is_disable?: boolean | null
  /**
   * Per-variant inventory tracking override. NULL/undefined = inherit
   * the parent product's `track_quantity`. FALSE = this variant is
   * always in stock (digital, license-key, infinite). Lets one listing
   * mix tracked + untracked SKUs (e.g. paperback + ebook).
   */
  track_quantity?: boolean | null
  options?: Record<string, unknown> | null
  image?: ProductImage | null
}

/** One Shopify-style option type, e.g. "Size: S / M / L". */
export interface ProductOptionDefinition {
  name: TranslatedText
  position: number
  values: { label: TranslatedText }[]
}

export interface ProductShopRef {
  id: string
  name: string
  slug: string
}

export interface ProductCollectionRef {
  id: string
  name: string | TranslatedText
  slug: string
}

export interface ProductTagRef {
  id: string
  name: string | TranslatedText
  slug?: string
}

export interface ProductSystemCategoryRef {
  id: string
  slug: string
  path: string
  name: string
  level: number
}

export interface Product {
  id: string
  name: string | TranslatedText | null
  slug: string
  description?: string | TranslatedText | null

  shop?: ProductShopRef | null
  shop_id?: string | null
  /** Google-taxonomy node classifying this product. */
  system_category_id?: string | null
  system_category?: ProductSystemCategoryRef | null
  collections?: ProductCollectionRef[]
  tags?: ProductTagRef[]

  price_cents?: number | null
  sale_price_cents?: number | null
  cost_per_item_cents?: number | null
  min_price_cents?: number | null
  max_price_cents?: number | null

  sku?: string | null
  barcode?: string | null
  quantity?: number | null
  sold_quantity?: number | null
  in_stock: boolean

  track_quantity?: boolean | null
  continue_selling_when_out_of_stock?: boolean | null

  status: ProductStatus
  product_type: ProductType
  sale_type: SaleType

  is_digital?: boolean | null

  requires_shipping?: boolean | null
  weight_grams?: number | null
  weight_unit_display?: WeightUnit | null
  length_mm?: number | null
  width_mm?: number | null
  height_mm?: number | null
  package_id?: string | null
  hs_code?: string | null
  country_of_origin?: string | null

  seo_title?: TranslatedText | null
  seo_description?: TranslatedText | null

  image?: ProductImage | null
  gallery?: ProductGalleryImage[] | null
  video?: ProductVideo[] | null

  min_bid_price_cents?: number | null
  max_bid_price_cents?: number | null
  /** 1 basis point = 0.01%, 10000 = 100%. */
  max_percentage_bps?: number | null

  /** Optimistic-lock token — increments on every update. */
  version?: number | null

  target_audience?: TargetAudience | null
  brand?: string | null
  /** The merchant's own label for the product ("Perfume") — not `product_type`. */
  type_name?: string | null
  ai_keywords?: TranslatedText | null

  views?: number | null

  variation_options?: ProductVariationOption[]
  option_definitions?: ProductOptionDefinition[] | null

  attributes?: ProductAttributeEntry[] | null

  created_at: string
  updated_at?: string
}

export interface ProductsResponse {
  products: GraphQLResult<Product[]> & { meta?: PaginationMeta }
}

export interface ProductResponse {
  product: GraphQLResult<Product>
}

export interface ProductFilterInput {
  shop_ids?: string[]
  statuses?: ProductStatus[]
  product_types?: ProductType[]
  sale_types?: SaleType[]
  collection_ids?: string[]
  tag_ids?: string[]
  stock_statuses?: StockStatus[]
  /** Single SystemCategory id — expands to its descendants server-side. */
  system_category_id?: string
  search?: string
  min_price_cents?: number
  max_price_cents?: number
  sort_by?: ProductSortBy
  page?: number
  limit?: number
}

export interface CreateVariationInput {
  id?: string
  title: TranslatedText
  price_cents: number
  options: Record<string, unknown>
  sale_price_cents?: number
  cost_per_item_cents?: number
  sku?: string
  quantity?: number
  position?: number
  /**
   * Per-variant `track_quantity` override (Shopify-parity #2.10). Omit
   * (or send `null`) to inherit the parent product's flag — the
   * common case. Send `false` only when this variant is intentionally
   * untracked (license-key style).
   */
  track_quantity?: boolean | null
  image?: Record<string, unknown>
}

export interface ProductOptionDefinitionInput {
  name: TranslatedText
  position?: number
  values: { label: TranslatedText }[]
}

export interface CreateProductInput {
  name: TranslatedText
  slug?: string
  description?: TranslatedText
  seo_title?: TranslatedText
  seo_description?: TranslatedText
  shop_id?: string
  price_cents?: number
  sale_price_cents?: number
  cost_per_item_cents?: number
  sku?: string
  barcode?: string
  quantity?: number
  in_stock?: boolean
  track_quantity?: boolean
  continue_selling_when_out_of_stock?: boolean
  status?: ProductStatus
  product_type?: ProductType
  sale_type?: SaleType
  is_digital?: boolean
  requires_shipping?: boolean
  weight_grams?: number
  weight_unit_display?: WeightUnit
  length_mm?: number
  width_mm?: number
  height_mm?: number
  package_id?: string | null
  hs_code?: string
  country_of_origin?: string
  image?: Record<string, unknown>
  gallery?: Record<string, unknown>[]
  video?: Record<string, unknown>[]
  min_bid_price_cents?: number
  max_bid_price_cents?: number
  max_percentage_bps?: number
  target_audience?: TargetAudience
  brand?: string
  type_name?: string
  ai_keywords?: TranslatedText
  collection_ids?: string[]
  tag_ids?: string[]
  system_category_id?: string
  attribute_values?: ProductAttributeValueInput[]
  variation_options?: CreateVariationInput[]
  option_definitions?: ProductOptionDefinitionInput[]
}

/**
 * Update shape — adds optimistic-lock token. Callers must send
 * `expected_version` (the `version` last fetched from the server) to
 * guard against lost updates — backend responds with `STALE_OBJECT`
 * when the value is out of date.
 */
export type UpdateProductInput = Partial<CreateProductInput> & {
  id: string
  expected_version?: number
}

export interface CreateProductResponse {
  createProduct: GraphQLResult<Product>
}

export interface UpdateProductResponse {
  updateProduct: GraphQLResult<Product>
}
export interface DeleteProductResponse {
  deleteProduct: { success: boolean; message?: string | null }
}

export interface ViewProductResponse {
  viewProduct: GraphQLResult<{ id: string; views: number }>
}

// ── System categories (Shopify-style taxonomy) ─────────
// Read-only tree seeded from Google Product Taxonomy. `path` is the
// materialized ancestor chain — derived server-side, never edit.

export interface SystemCategory {
  id: string
  slug: string
  /** Materialized ancestor chain, `/`-delimited. */
  path: string
  parent_id: string | null
  /** Resolved display name for the requested locale. */
  name: string
  level: number
}

export interface SystemCategoryTreeNode extends SystemCategory {
  children?: SystemCategoryTreeNode[]
}

export interface ProductOrganizationOptionsResponse {
  productOrganizationOptions: GraphQLResult<{
    types: string[]
    vendors: string[]
  }>
}

/** A taxonomy node the shop's own products sit on — the Category filter's rows. */
export interface ProductCategory extends ProductSystemCategoryRef {
  parent_id?: string | null
  product_count: number
}

export interface ProductCategoriesResponse {
  productCategories: GraphQLResult<ProductCategory[]> & {
    meta?: { total: number }
  }
}

export interface SystemCategoriesFlatResponse {
  systemCategoriesFlat: GraphQLResult<SystemCategory[]> & { meta?: PaginationMeta }
}

export interface SystemCategoryTreeResponse {
  systemCategoryTree: GraphQLResult<SystemCategoryTreeNode[]>
}

export interface SystemCategoryResponse {
  systemCategory: GraphQLResult<SystemCategory>
}

// ── Category metafields ────────────────────────────────
// Admin-managed schema that hangs off a SystemCategory. Effective
// schema = node's own + all ancestor definitions (extend-only).

export type AttributeType =
  | "TEXT"
  | "NUMBER"
  | "BOOLEAN"
  | "SELECT"
  | "MULTI_SELECT"

export interface AttributeOption {
  id: string
  /** Canonical string used on the wire (not the id). */
  value: string
  label: TranslatedText
  sort_order: number
}

export interface AttributeDefinition {
  id: string
  key: string
  name: TranslatedText
  description?: TranslatedText | null
  type: AttributeType
  required: boolean
  filterable: boolean
  sort_order: number
  unit?: string | null
  options: AttributeOption[]
  version: number
  system_category_id: string
}

export interface CategoryAttributesResponse {
  categoryAttributes: GraphQLResult<AttributeDefinition[]>
}

/**
 * One AI-proposed value, in the same shape the form already stores — so
 * accepting a suggestion is a copy, not a translation.
 *
 * `value_option` carries the option's **value slug** rather than its id,
 * matching `AttributeValueEntryInput.option`. The server has already checked
 * every entry against the definition it names, so nothing here can be a key
 * this category does not have or an option outside its list.
 */
export interface AttributeSuggestion {
  key: string
  type: AttributeType
  value_text?: string | null
  value_number?: number | null
  value_boolean?: boolean | null
  value_option?: string | null
  value_options?: string[] | null
}

export interface AttributeSuggestionsResponse {
  suggestProductAttributes: GraphQLResult<AttributeSuggestion[]> & {
    /**
     * Whether a model actually answered. An empty list means "nothing
     * confident to add" when true and "the provider is unconfigured or fell
     * over" when false — without it both render as a silent empty box.
     */
    generated: boolean
  }
}

/**
 * Per-product value row returned on `product.attributes`. `value` carries
 * the raw payload matching the definition type. `display_value` is the
 * already-resolved label for UI display. `is_outdated` trips when the
 * definition has been edited since this value was written.
 */
export interface ProductAttributeEntry {
  key: string
  name: TranslatedText
  type: string
  value: unknown
  display_value?: string | null
  is_outdated: boolean
  definition_version: number
  unit?: string | null
}

/**
 * Exactly one of the `value_*` fields must be populated per the backend's
 * `pav_exactly_one_value` CHECK constraint. SELECT / MULTI_SELECT take
 * the option *value string*, not the id.
 */
export interface ProductAttributeValueInput {
  attribute_key: string
  value_text?: string
  value_number?: number
  value_boolean?: boolean
  value_option?: string
  value_options?: string[]
}
