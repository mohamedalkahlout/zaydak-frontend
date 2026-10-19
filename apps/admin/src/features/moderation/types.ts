export interface AbusiveReportRow {
  id: string
  message?: string | null
  user_id: string
  model_type: string
  model_id: string
  created_at: string
}

export interface BecameSellerRow {
  id: string
  user_id: string
  status: string
  url?: string | null
  name?: string | null
  phone?: string | null
  message?: string | null
  created_at: string
  updated_at: string
}

export type BecameSellerStatus = "pending" | "approved" | "rejected" | string

export function becameSellerBadgeVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status.toLowerCase()) {
    case "approved":
      return "default"
    case "pending":
      return "outline"
    case "rejected":
      return "destructive"
    default:
      return "secondary"
  }
}

export const REPORT_MODEL_TYPES = [
  "all",
  "Shop",
  "Product",
  "User",
  "Review",
] as const

export const SELLER_STATUS_FILTERS = [
  "all",
  "pending",
  "approved",
  "rejected",
] as const
