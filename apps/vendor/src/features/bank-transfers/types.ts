import type { GraphQLResult } from "@/shared/types/api"

export interface Bank {
  code: string
  name: string
  swift?: string | null
  icon?: string | null
}

export interface BankAccountSnapshot {
  id: string
  bank_code?: string | null
  bank_name?: string | null
  account_holder_name: string
  account_number?: string | null
  iban?: string | null
  swift_code?: string | null
  currency: string
  notes?: string | null
}

export interface ShopBankAccount extends BankAccountSnapshot {
  shop_id: string
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ShopPaymentSettings {
  cod_enabled: boolean
  card_enabled: boolean
  bank_transfer_enabled: boolean
  card_available: boolean
  bank_transfer_available: boolean
}

export type PaymentSettingsPatch = Partial<Pick<ShopPaymentSettings,
  "cod_enabled" | "card_enabled" | "bank_transfer_enabled">>

export interface PaymentsSettingsResponse {
  banks: GraphQLResult<Bank[]>
  shopBankAccounts: GraphQLResult<ShopBankAccount[]>
  shopPaymentSettings: GraphQLResult<ShopPaymentSettings>
}

export type BankTransferStatus = "PENDING" | "APPROVED" | "REJECTED"

export interface BankTransfer {
  id: string
  order_id: string
  customer_name?: string | null
  bank_account_snapshot: BankAccountSnapshot
  amount_due_cents: number
  claimed_amount_cents?: number | null
  currency: string
  sender_name: string
  sender_bank_code?: string | null
  transfer_reference: string
  transferred_at: string
  note?: string | null
  receipt_mime_type: string
  receipt_original_name: string
  receipt_url?: string | null
  receipt_purged_at?: string | null
  status: BankTransferStatus
  rejection_reason?: string | null
  reviewed_at?: string | null
  created_at: string
  can_review: boolean
}

export interface OrderBankTransfersResponse {
  orderBankTransfers: GraphQLResult<BankTransfer[]>
}
