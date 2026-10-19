import type { TranslatedText } from "@/shared/types/api"

/**
 * Derived label, not a mode. The back-end recomputes it on every write:
 * AUTOMATED once any source selects by condition or pulls from another
 * collection, MANUAL while membership is entirely hand-picked.
 */
export type CollectionType = "MANUAL" | "AUTOMATED"

export type CollectionSort =
  | "MOST_RELEVANT"
  | "BEST_SELLING"
  | "TITLE_ASC"
  | "TITLE_DESC"
  | "PRICE_ASC"
  | "PRICE_DESC"
  | "CREATED_DESC"
  | "CREATED_ASC"
  | "MANUAL"

export type CollectionRuleField =
  | "title"
  | "system_category_id"
  | "product_type"
  | "brand"
  | "tag"
  | "status"
  | "sale_type"
  | "price_cents"
  | "sale_price_cents"
  | "inventory_quantity"
  | "weight_grams"
  | "attribute"

export type CollectionRuleOperator =
  | "EQ"
  | "NE"
  | "GT"
  | "GTE"
  | "LT"
  | "LTE"
  | "BETWEEN"
  | "IN"
  | "NOT_IN"
  | "CONTAINS"
  | "NOT_CONTAINS"
  | "STARTS_WITH"
  | "ENDS_WITH"
  | "IS_SET"
  | "IS_NOT_SET"
  | "DESCENDANT_OF"

export type CollectionRuleMatch = "ALL" | "ANY"

export type CollectionSourceKind = "PRODUCTS" | "COLLECTIONS"

/** One row of the conditions panel. `values` are OR-ed against each other. */
export interface CollectionRuleCondition {
  field: CollectionRuleField
  operator: CollectionRuleOperator
  values: unknown[]
  attribute_key?: string
}

export interface CollectionExclusion {
  match: CollectionRuleMatch
  conditions: CollectionRuleCondition[]
  product_ids: string[]
  collection_ids: string[]
}

export interface CollectionSource {
  id: string
  kind: CollectionSourceKind
  match: CollectionRuleMatch
  conditions: CollectionRuleCondition[]
  collection_ids: string[]
  exclude: CollectionExclusion
}

/** Rules v2. The API always returns this shape, whatever the row holds. */
export interface CollectionRules {
  version: 2
  sources: CollectionSource[]
}

export interface ShopCollection {
  id: string
  shop_id: string
  type: CollectionType
  name: TranslatedText
  slug: string
  image?: { url?: string; alt?: string } | null
  description?: TranslatedText | null
  seo_title?: TranslatedText | null
  seo_description?: TranslatedText | null
  sort_order: number
  sort: CollectionSort
  is_published: boolean
  rules?: CollectionRules | null
  rules_version: number
  product_count: number
  created_at: string
  updated_at: string
}

/** A product as the editor's "Collection items" panel renders it. */
export interface CollectionItem {
  id: string
  name: TranslatedText
  slug: string
  image?: { original?: string; thumbnail?: string } | null
  price_cents?: number | null
  sale_price_cents?: number | null
  status: string
  quantity: number
  in_stock: boolean
  /** True when a human put it here rather than a condition matching it. */
  pinned: boolean
  position: number
}

export interface CreateShopCollectionInput {
  name: TranslatedText
  slug: string
  image?: { url: string; alt?: string }
  description?: TranslatedText
  seo_title?: TranslatedText
  seo_description?: TranslatedText
  sort_order?: number
  sort?: CollectionSort
  is_published?: boolean
  rules?: CollectionRules
  product_ids?: string[]
}

export type UpdateShopCollectionInput = Partial<CreateShopCollectionInput> & {
  id: string
}

export interface ShopCollectionResponse {
  success: boolean
  data?: ShopCollection | null
  message?: string | null
  error_code?: string | null
}

export interface CreateShopCollectionResult {
  createCollection: ShopCollectionResponse
}

export interface UpdateShopCollectionResult {
  updateCollection: ShopCollectionResponse
}

export interface ShopCollectionsResponse {
  collections: {
    success: boolean
    data: ShopCollection[]
    meta: { total: number; page: number; total_pages: number }
  }
}

export interface ShopCollectionByIdResponse {
  collection: ShopCollectionResponse
}

interface ItemsPayload {
  success: boolean
  data: CollectionItem[]
  meta: { total: number; page: number; total_pages: number }
}

export interface CollectionPreviewResponse {
  previewCollection: ItemsPayload
}

export interface CollectionItemsResponse {
  collectionItems: ItemsPayload
}
