import type { GraphQLResult, PaginationMeta } from "@/shared/types/api"

export type SegmentRuleLogic = "AND" | "OR"

export interface SegmentRule {
  logic: SegmentRuleLogic
  conditions: Array<{
    field: string
    operator: string
    value: unknown
  }>
}

export interface Segment {
  id: string
  shop_id?: string | null
  name: string
  description?: string | null
  /** Canonical ShopifyQL source. Null on legacy rows; prefer this over rules. */
  query?: string | null
  rules: SegmentRule
  coupons_count: number
  created_at: string
  updated_at: string
}

export interface SegmentsResponse {
  customerSegments: GraphQLResult<Segment[]> & { meta?: PaginationMeta }
}

export interface SegmentResponse {
  customerSegment: GraphQLResult<Segment>
}

/**
 * Mutation responses include an optional `message` for human-readable
 * errors, on top of the shared { success, data } envelope.
 */
export interface CreateSegmentResponse {
  createCustomerSegment: GraphQLResult<Segment> & { message?: string | null }
}

export interface UpdateSegmentResponse {
  updateCustomerSegment: GraphQLResult<Segment> & { message?: string | null }
}

export interface DeleteSegmentResponse {
  deleteCustomerSegment: { success: boolean; message?: string | null }
}

// ─── Preview ──────────────────────────────────────────────────────────────

export interface SegmentPreviewSample {
  id: string
  name: string
  phone_number?: string | null
  /** `contacts.email`, normalised by the server — read this, not `meta.email`. */
  email?: string | null
  meta?: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface SegmentPreview {
  success: boolean
  count: number
  sample: SegmentPreviewSample[]
  message?: string | null
}

export interface PreviewSegmentResponse {
  previewCustomerSegment: SegmentPreview
}

// ─── Templates ────────────────────────────────────────────────────────────

export type SegmentTemplateCategory =
  | "AUDIENCE"
  | "ACQUISITION"
  | "BEHAVIOUR"
  | "ENGAGEMENT"
  | "GEOGRAPHY"
  | "TIER"

export interface SegmentTemplate {
  id: string
  name: { en: string; ar: string }
  description: { en: string; ar: string }
  category: SegmentTemplateCategory
  query: string
}

export interface SegmentTemplatesResponse {
  segmentTemplates: {
    success: boolean
    templates: SegmentTemplate[]
  }
}

// ─── Filter catalog (for editor autocomplete) ─────────────────────────────

export interface FilterCatalogEntry {
  field: string
  description: string
  valueKind: string
  allowedOperators: string[]
  /** Closed set of accepted values for enum-typed fields. Empty otherwise. */
  enumValues: string[]
  /** Execution cost: `low` | `medium` | `high`. Editor warns on high-cost filters. */
  cost: string
}

/** `customerSegmentFilters` returns both languages; the editor picks one. */
export interface FilterCatalogWireEntry {
  field: string
  description: { en: string; ar: string }
  valueKind: string
  allowedOperators: string[]
  enumValues: string[]
  cost: string
}

export function localizeFilterCatalog(
  filters: FilterCatalogWireEntry[],
  locale: string,
): FilterCatalogEntry[] {
  return filters.map((filter) => ({
    ...filter,
    description:
      locale === "ar"
        ? filter.description.ar || filter.description.en
        : filter.description.en || filter.description.ar,
  }))
}

export interface FilterCatalogResponse {
  customerSegmentFilters: {
    success: boolean
    /** True when backend has `OPENROUTER_API_KEY` configured. */
    aiAvailable: boolean
    filters: FilterCatalogWireEntry[]
  }
}

// ─── Describe ─────────────────────────────────────────────────────────────

export interface DescribeSegmentResponse {
  describeCustomerSegment: {
    success: boolean
    description: string
  }
}

export interface CustomerBaseCountResponse {
  contacts: {
    success: boolean
    meta: PaginationMeta
  }
}

export interface GeneratedSegmentOutOfScope {
  reason: string
  suggestion?: string | null
}

export interface GeneratedSegment {
  query: string
  canonical: string
  retried: boolean
  /**
   * Set when the prompt was outside the customer-segment scope — the
   * UI renders the reason instead of applying a query to the editor.
   */
  outOfScope?: GeneratedSegmentOutOfScope | null
}

export interface GenerateSegmentResponse {
  generateCustomerSegmentFromPrompt: {
    success: boolean
    data?: GeneratedSegment | null
    message?: string | null
  }
}

export interface GenerateSegmentInputVariables {
  prompt: string
  seedQuery?: string
  locale?: string
}

// ─── Segment Insights ────────────────────────────────────────────────────

export interface InsightsValueCount {
  value: string
  count: number
}

export interface InsightsHistoryPoint {
  date: string
  cumulative: number
}

export interface SegmentInsightsData {
  count: number
  baseCount: number
  sizeHistory: InsightsHistoryPoint[]
  topCountries: InsightsValueCount[]
  topCities: InsightsValueCount[]
  topLanguages: InsightsValueCount[]
  emailSubscribedRatio: number
  smsSubscribedRatio: number
  /** Integer cents. */
  avgTotalSpentCents: number
  /** Integer cents. */
  medianTotalSpentCents: number
  avgOrdersCount: number
}

export interface SegmentInsightsResponse {
  segmentInsights: {
    success: boolean
    data?: SegmentInsightsData | null
    message?: string | null
  }
}

// ─── AI Explain ──────────────────────────────────────────────────────────

export interface ExplainSuggestion {
  label: string
  refinement: string
}

export interface SegmentExplainData {
  summary: string
  suggestions: ExplainSuggestion[]
}

export interface SegmentExplainResponse {
  explainCustomerSegment: {
    success: boolean
    data?: SegmentExplainData | null
    message?: string | null
  }
}

// ─── Form input ───────────────────────────────────────────────────────────

export interface SegmentFormValues {
  name: string
  description?: string
  query: string
}
