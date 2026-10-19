import type { GraphQLResult, PaginationMeta, TranslatedText } from "@/shared/types/api"
import type { ProductImage } from "@/features/products/types"

export interface Tag {
  id: string
  name: string | TranslatedText
  slug: string
  icon?: string | null
  image?: ProductImage | null
  details?: string | TranslatedText | null
  shop_id?: string | null
  products_count?: number | null
  created_at: string
  updated_at: string
}

export interface TagsResponse {
  tags: GraphQLResult<Tag[]> & { meta?: PaginationMeta }
}

export interface TagResponse {
  tag: GraphQLResult<Tag>
}

export interface CreateTagInput {
  name: TranslatedText
  slug?: string
  icon?: string
  image?: Record<string, unknown>
  details?: TranslatedText
  shop_id?: string
}

export type UpdateTagInput = Partial<CreateTagInput> & { id: string }

export interface CreateTagResponse {
  createTag: GraphQLResult<Tag>
}

export interface UpdateTagResponse {
  updateTag: GraphQLResult<Tag>
}

export interface DeleteTagResponse {
  deleteTag: { success: boolean; message?: string | null }
}
