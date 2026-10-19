import type { GraphQLResult, PaginationMeta } from "@/shared/types/api"
import type { BankAccountSnapshot } from "@/features/bank-transfers/types"

export type OrderStatus =
  | "order-pending"
  | "order-processing"
  | "order-at-local-facility"
  | "order-out-for-delivery"
  | "order-completed"
  | "order-cancelled"
  | "order-refunded"
  | "order-failed"

export type PaymentStatus =
  | "payment-pending"
  | "payment-processing"
  | "payment-success"
  | "payment-failed"
  | "payment-reversal"
  | "payment-refunded"
  | "payment-cash-on-delivery"
  | "payment-cash"
  | "payment-wallet"
  | "payment-awaiting-for-approval"
  | "payment-mismatch"
  | "payment-completed"

/** unfulfilled | partial | fulfilled — orthogonal to `order_status`. */
export type FulfillmentStatus = "unfulfilled" | "partial" | "fulfilled"

/** Derived at read time from payment + settled refunds; never stored. */
export type FinancialStatus =
  | "pending"
  | "authorized"
  | "paid"
  | "partially_refunded"
  | "refunded"
  | "voided"

export type RefundStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "processing"
  | "refunded"

export interface OrderProduct {
  id?: string
  product_id: string
  name: string | { en?: string; ar?: string } | null
  slug?: string | null
  image?: { id?: string; original?: string; thumbnail?: string } | null
  order_quantity: number
  /** How much of this line has already shipped. Drives the remaining-to-fulfill maths. */
  fulfilled_quantity?: number
  unit_price_cents: number
  subtotal_cents?: number | null
  variation_option_id?: string | null
  variation_title?: string | { en?: string; ar?: string } | null
  variation_options?: Record<string, string> | null
}

export interface OrderFulfillmentLine {
  order_product_id: string
  quantity: number
}

export interface OrderFulfillment {
  id: string
  /** success | cancelled */
  status: string
  tracking_number?: string | null
  tracking_company?: string | null
  tracking_url?: string | null
  /**
   * The location these items shipped from. A split order carries one
   * fulfillment per warehouse, so this is what tells two otherwise-identical
   * groups apart on the shipments card.
   */
  location_id?: string | null
  location_name?: string | null
  shipped_at?: string | null
  created_at: string
  line_items: OrderFulfillmentLine[]
}

export interface OrderPayment {
  status: PaymentStatus
  gateway?: string | null
  altered_gateway?: string | null
}

export interface OrderPricing {
  subtotal_cents: number
  tax_cents?: number | null
  discount_cents?: number | null
  delivery_fee_cents?: number | null
  total_cents: number
  paid_total_cents?: number | null
}

export interface OrderDelivery {
  fee_cents?: number | null
  time?: string | null
}

export interface OrderCustomer {
  id?: string | null
  name?: string | null
  email?: string | null
  phone?: string | null
  contact?: string | null
}

export interface OrderAddresses {
  shipping?: Record<string, unknown> | null
  billing?: Record<string, unknown> | null
}

export interface OrderCoupon {
  coupon_id: string
  code: string
  applied_discount_cents: number
}

export interface OrderRefund {
  id: string
  order_id: string
  product_id?: string | null
  amount_cents: number
  refund_quantity?: number | null
  is_partial: boolean
  status: string
  title?: string | null
  description?: string | null
  images?: unknown
  created_at: string
  updated_at: string
}

export interface OrderInvoice {
  id: string
  invoice_number: string
  invoice_url?: string | null
  issued_at: string
  /** ISO date the payment falls due. Set only on an INVOICE order (a draft
   *  converted with "Payment due later"): issued_at plus its terms. */
  due_date?: string | null
  status?: string | null
  currency?: string | null
  total_amount_cents: number
}

export interface OrderCancellation {
  amount_cents: number
  tax_cents: number
  delivery_fee_cents: number
}

export interface OrderWalletPoint {
  id: string
  amount_cents: number
}

/** Why a card payment recorded against the order was not applied to it. */
export type UnappliedPaymentReason =
  | "paid_after_close"
  | "amount_mismatch"
  | "duplicate_charge"

/** Where the refund of an unapplied payment stands. */
export type UnappliedRefundStatus =
  | "none"
  | "requested"
  | "pending"
  | "succeeded"
  | "failed"

/**
 * A card payment the order never took: paid after it closed, for a different
 * amount, or a second time. The money is the customer's until it is refunded
 * (`REFUND_UNAPPLIED_PAYMENT`). Read through its own query
 * (`ORDER_UNAPPLIED_PAYMENTS`), never the order detail fragment.
 */
export interface OrderUnappliedPayment {
  /** The payment intent row id — what the refund mutation takes. */
  id: string
  reason: UnappliedPaymentReason | string
  amount_cents: number
  currency: string
  paid_at: string
  refund_status: UnappliedRefundStatus | string
  refunded_at?: string | null
  /** The provider's code for the last attempt that did not settle. */
  refund_error?: string | null
}

export interface OrderShopRef {
  id: string
  name: string
  slug: string
  logo?: unknown
}

export interface Order {
  id: string
  tracking_number: string
  order_status: OrderStatus
  /** Only present on the detail query — the list fragment does not select it. */
  fulfillment_status?: FulfillmentStatus
  financial_status?: FinancialStatus
  fulfillments?: OrderFulfillment[] | null
  payment: OrderPayment
  pricing: OrderPricing
  delivery?: OrderDelivery | null
  /** Which shipping method priced the fee, frozen at creation:
   *  { source: "rule", rule_id, zone_id, name: {en,ar}, type } or
   *  { source: "merchant_override" }. Null on orders predating the column. */
  shipping_method?: Record<string, unknown> | null
  payment_instructions?: BankAccountSnapshot | null
  payment_expires_at?: string | null
  customer?: OrderCustomer | null
  products: OrderProduct[]
  addresses?: OrderAddresses | null
  coupons?: OrderCoupon[] | null
  refunds?: OrderRefund[] | null
  invoices?: OrderInvoice[] | null
  cancellation?: OrderCancellation | null
  wallet_point?: OrderWalletPoint | null
  shop?: OrderShopRef | null
  note?: string | null
  language?: string | null
  /** `whatsapp_assistant` for an order the shop's assistant took in a chat. */
  placed_via?: string | null
  /** Only from `ORDER_UNAPPLIED_PAYMENTS`; no order fragment selects it. */
  unapplied_payments?: OrderUnappliedPayment[] | null
  created_at: string
  updated_at?: string
}

export interface OrderResponse {
  order: GraphQLResult<Order>
}

export interface CreateOrderResponse {
  createOrder: GraphQLResult<Order>
}

export interface UpdateOrderResponse {
  updateOrder: GraphQLResult<Order>
}

export interface EditOrderLineInput {
  order_product_id?: string
  product_id: string
  variation_option_id?: string | null
  order_quantity: number
  unit_price_cents?: number
}

export interface EditOrderInput {
  id: string
  lines: EditOrderLineInput[]
  delivery_fee_cents?: number
  reason?: string
}

export interface EditOrderResponse {
  editOrder: GraphQLResult<Order>
}

export interface DeleteOrderResponse {
  deleteOrder: { success: boolean; message?: string | null }
}

// ─── Fulfillment ────────────────────────────────────────────────────────────

export interface FulfillOrderLineInput {
  order_product_id: string
  quantity: number
}

export interface FulfillOrderInput {
  order_id: string
  /** Omit to ship every remaining quantity on the order. */
  lines?: FulfillOrderLineInput[]
  tracking_number?: string
  tracking_company?: string
  tracking_url?: string
}

export interface FulfillOrderResponse {
  fulfillOrder: GraphQLResult<Order>
}

// ─── Refunds ────────────────────────────────────────────────────────────────

export interface RefundLineInput {
  order_product_id: string
  quantity: number
  reason?: string
  /** Re-credit inventory when the refund is approved. Back-end defaults to true. */
  restock?: boolean
}

export interface CreateRefundInput {
  order_id: string
  lines?: RefundLineInput[]
  /** Optional override of the computed total (subtotal − discount + tax, allocated per line). */
  amount_cents?: number
  title?: string
  description?: string
}

export interface CreateRefundResponse {
  createRefund: GraphQLResult<OrderRefund>
}

export interface UpdateRefundStatusResponse {
  updateRefundStatus: GraphQLResult<OrderRefund>
}

export interface OrderUnappliedPaymentsResponse {
  order: GraphQLResult<Pick<Order, "id" | "unapplied_payments">> & {
    message?: string | null
  }
}

export interface RefundUnappliedPaymentResponse {
  refundUnappliedPayment: {
    success: boolean
    message?: string | null
    data?: OrderUnappliedPayment | null
  }
}

export interface OrdersResponse {
  orders: GraphQLResult<Order[]> & { meta?: PaginationMeta }
}

export interface OrderFilters {
  order_status?: string
  payment_status?: string
  /** Comma-joined `SalesChannel` names; the API derives each order's channel. */
  channel?: string
  /** Placed at or after this instant (ISO). */
  created_from?: string
  /** Placed before this instant (ISO, exclusive). Absent for a window that runs to now. */
  created_to?: string
  tracking_number?: string
  customer_name?: string
  customer_id?: string
  shop_id?: string
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: "asc" | "desc"
}

/** `exportOrdersCsv`: the list, under its filters, as one CSV body. */
export interface ExportOrdersCsvData {
  exportOrdersCsv: {
    success: boolean
    csv: string
    /** Orders in the file. */
    rows: number
    /** More orders matched than one export carries (10,000). */
    truncated: boolean
  }
}

// ── Draft orders ───────────────────────────────────────
// Merchant-built orders staged before conversion into a real Order. Money is
// integer cents; the totals are an estimate (no tax/shipping until convert).

export type DraftOrderStatus = "open" | "completed" | "cancelled"

/** The terms select's options (`DRAFT_PAYMENT_TERMS` in lib/drafts/payment).
 *  The back-end's `PAYMENT_TERMS` accepts these four and nothing else. */
export type DraftPaymentTerm = "due_on_receipt" | "net_7" | "net_15" | "net_30"

/** How a draft is converted: the merchant was paid (CASH, recorded as paid,
 *  nothing for a courier to collect) or will be (INVOICE, payment pending). */
export type DraftConvertGateway = "CASH" | "INVOICE"

export interface DraftOrderLine {
  id: string
  product_id: string
  variation_option_id?: string | null
  product_name?: string | { en?: string; ar?: string } | null
  slug?: string | null
  image?: { id?: string; original?: string; thumbnail?: string } | null
  variant_title?: string | { en?: string; ar?: string } | null
  quantity: number
  unit_price_cents: number
  subtotal_cents: number
}

/** A coupon stored on a draft, resolved for display (no discount figure). */
export interface DraftOrderCoupon {
  id: string
  /** Null for an automatic coupon. */
  code?: string | null
  description?: string | null
  /** False when the coupon was deleted after it was added. */
  available: boolean
  /** Targets customers or caps uses per customer: conversion refuses it on a
   *  draft with no customer. */
  requires_customer: boolean
}

export interface DraftOrder {
  id: string
  shop_id: string
  customer_id?: string | null
  customer_name?: string | null
  customer_contact?: string | null
  /** Resolved customer email address for sending invoices and notifications. */
  customer_email?: string | null
  status: DraftOrderStatus
  note?: string | null
  manual_discount_cents: number
  /** Merchant-set delivery fee for the converted order. Null = the shop's
   *  zones price it at conversion; 0 = free delivery on purpose. */
  shipping_override_cents?: number | null
  /** The shipping option frozen on the draft — a ShippingRule id or a
   *  `carrier:<company>:<deliveryOptionId>` composite. Set, it outranks
   *  `shipping_override_cents` at conversion so the created order keeps the
   *  carrier identity that booking needs. */
  shipping_rule_id?: string | null
  shipping_method_name?: string | null
  currency: string
  shipping_address?: Record<string, unknown> | null
  billing_address?: Record<string, unknown> | null
  /** Vendor-facing tags (Shopify pattern) for custom views / filtering. */
  tags: string[]
  /** "Payment due later": converting creates an INVOICE order (payment
   *  pending) instead of a CASH one (paid). Always sent by the server; optional
   *  here only so fixtures predating the field still type-check. */
  payment_due_later?: boolean
  /** One of `DRAFT_PAYMENT_TERMS`, or null. Sets the invoice due date. */
  payment_terms?: DraftPaymentTerm | null
  /** Ids of the coupons stored on the draft. Conversion passes them to
   *  `createOrder`, which prices them for the draft's customer. Always sent by
   *  the server; optional here only so older fixtures still type-check. */
  coupon_ids?: string[]
  /** `coupon_ids` resolved for display, in the same order. */
  coupons?: DraftOrderCoupon[]
  /** The Order created when this draft was converted. */
  order_id?: string | null
  line_items: DraftOrderLine[]
  subtotal_cents: number
  estimated_total_cents: number
  created_at: string
  updated_at: string
}

export interface DraftOrderResponse {
  draftOrder: GraphQLResult<DraftOrder>
}

export interface DraftOrdersResponse {
  draftOrders: GraphQLResult<DraftOrder[]> & { meta?: PaginationMeta }
}

export interface CreateDraftOrderResponse {
  createDraftOrder: GraphQLResult<DraftOrder>
}

export interface UpdateDraftOrderResponse {
  updateDraftOrder: GraphQLResult<DraftOrder>
}

export interface ConvertDraftOrderResponse {
  convertDraftOrder: GraphQLResult<DraftOrder>
}

export interface DeleteDraftOrderResponse {
  deleteDraftOrder: { success: boolean; message?: string | null }
}

/** One staged line as the FE draft form holds it (denormalized for display). */
export interface DraftLineInput {
  product_id: string
  variation_option_id?: string | null
  quantity: number
}

export interface CreateDraftOrderInput {
  lines: DraftLineInput[]
  customer_id?: string | null
  customer_name?: string | null
  customer_contact?: string | null
  note?: string | null
  manual_discount_cents?: number
  shipping_override_cents?: number | null
  shipping_rule_id?: string | null
  shipping_method_name?: string | null
  shipping_address?: Record<string, unknown> | null
  billing_address?: Record<string, unknown> | null
  tags?: string[]
  payment_due_later?: boolean
  payment_terms?: DraftPaymentTerm | null
}

export type UpdateDraftOrderInput = Partial<CreateDraftOrderInput> & {
  id: string
}

export interface SendDraftInvoiceInput {
  id: string
  to?: string | null
  subject?: string | null
  custom_message?: string | null
}

export interface SendDraftInvoiceResponse {
  sendDraftInvoice: {
    success: boolean
    message?: string | null
  }
}
