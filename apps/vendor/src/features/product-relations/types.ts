import type { GraphQLResult } from "@/shared/types/api"

/**
 * Surface kind for a vendor-curated link. Maps 1:1 to the backend's
 * `ProductRelationType` Prisma enum:
 *
 *   - RELATED       — generic "you may also like" carousel
 *   - UPSELL        — higher-tier swap shown on the PDP
 *   - CROSS_SELL    — complementary item shown in cart
 *   - COMPLEMENTARY — "frequently bought together" set
 *
 * The same (source, target) pair can co-exist under different types
 * since they surface in different UI slots on the storefront.
 */
export type ProductRelationType =
  | "RELATED"
  | "UPSELL"
  | "CROSS_SELL"
  | "COMPLEMENTARY"

export interface ProductRelation {
  id: string
  source_product_id: string
  target_product_id: string
  type: ProductRelationType
  position: number
  created_at: string
}

export interface ProductRelationsQueryResponse {
  productRelations: GraphQLResult<ProductRelation[]>
}

export interface AddProductRelationResponse {
  addProductRelation: GraphQLResult<ProductRelation>
}

export interface RemoveProductRelationResponse {
  removeProductRelation: { success: boolean; message?: string | null }
}

export interface ReorderProductRelationResponse {
  reorderProductRelation: GraphQLResult<ProductRelation>
}
