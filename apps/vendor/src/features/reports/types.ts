export interface ReportColumnSchema {
  key: string
  role: string
  kind: string
  availability: string
}

export interface ReportSchema {
  dimensions: ReportColumnSchema[]
  measures: ReportColumnSchema[]
  max_dimensions: number
  max_range_days: number
}

export interface ReportSchemaResponse {
  reportSchema: { success: boolean; data: ReportSchema }
}

export interface ReportColumn {
  key: string
  role: string
  kind: string
}

export interface ReportResult {
  columns: ReportColumn[]
  rows: Array<Record<string, string | number | null>>
  totals: Record<string, number | null>
  currency: string
  timezone: string
  unavailable_measures: string[]
  truncated: boolean
  source: string
}

export interface RunReportResponse {
  runReport: { success: boolean; data: ReportResult }
}

export interface RunReportInput {
  dimensions: string[]
  measures: string[]
  start: string
  end: string
  limit?: number
}
