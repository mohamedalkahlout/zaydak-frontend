// Hand-written types mirroring the back-end targets schema. Money values are
// integer cents, counts are plain integers, rates are basis points — the `unit`
// field on Target says which, so the UI formats correctly.

export type TargetMetric =
  | "TOTAL_SALES"
  | "NET_SALES"
  | "GROSS_SALES"
  | "ORDERS_COUNT"
  | "AOV"
  | "NET_PROFIT"
  | "RETURNING_CUSTOMER_RATE"

export type TargetPeriod = "WEEK" | "MONTH" | "QUARTER" | "YEAR" | "CUSTOM"

export type TargetStatus =
  | "DRAFT"
  | "UPCOMING"
  | "IN_PROGRESS"
  | "ACHIEVED"
  | "NOT_ACHIEVED"

export type TargetUnit = "money" | "count" | "rate"

export interface PacePoint {
  date: string
  value: number
}

export interface TargetProgress {
  currentValue: number
  targetValue: number
  attainmentBps: number
  status: TargetStatus
  paceable: boolean
  projectedValue: number | null
  elapsedBps: number
  pacingSeries: PacePoint[]
  idealPaceSeries: PacePoint[]
  costCoverageBps: number | null
}

export interface Target {
  id: string
  name: string
  metric: TargetMetric
  period: TargetPeriod
  periodStart: string
  periodEnd: string
  unit: TargetUnit
  targetValue: number
  currency: string
  status: TargetStatus
  createdAt: string
  progress?: TargetProgress
}

export interface TargetsResponse {
  targets: { success: boolean; data: Target[] }
}

export interface TargetResponse {
  target: { success: boolean; data: Target }
}

export interface CreateTargetResponse {
  createTarget: { success: boolean; data: Target }
}

export interface UpdateTargetResponse {
  updateTarget: { success: boolean; data: Target }
}

/** Wire input for createTarget/updateTarget. */
export interface CreateTargetInput {
  name: string
  metric: TargetMetric
  period: TargetPeriod
  targetValue: number
  anchor?: string
  start?: string
  end?: string
  activate?: boolean
}
