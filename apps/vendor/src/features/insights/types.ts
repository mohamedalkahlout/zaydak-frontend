// Hand-written types mirroring the back-end AiInsight GraphQL surface. `title`
// and `body` are `{ en, ar }` maps already rendered in the shop's currency.

export type InsightSeverity =
  | "info"
  | "warning"
  | "critical"
  | "opportunity"

export interface AiInsight {
  id: string
  type: string
  severity: InsightSeverity | string
  title: Record<string, string>
  body: Record<string, string>
  data: Record<string, unknown>
  suggested_actions?: unknown
  is_read: boolean
  created_at: string
  expires_at?: string | null
}

export interface InsightsResponse {
  insights: { success: boolean; data: AiInsight[] }
}

export interface MarkInsightReadResponse {
  markInsightRead: { success: boolean }
}

export interface DismissInsightResponse {
  dismissInsight: { success: boolean }
}
