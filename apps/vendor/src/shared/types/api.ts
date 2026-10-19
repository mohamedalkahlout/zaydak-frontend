/**
 * Cross-feature primitives used by every API response. Feature-owned
 * response/input types live in features/<x>/types.ts.
 */

export interface GraphQLResult<T> {
  success: boolean
  data: T
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  total_pages: number
}

export type TranslatedText = { en?: string; ar?: string }
