import type { OrderStatus } from "@/features/orders/types"

/**
 * Valid next-status targets per current status. Mirrors the backend state
 * machine from the frontend integration guide — the server rejects illegal
 * transitions, so this table should match what the API accepts. Terminal
 * states have an empty list.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  "order-pending": [
    "order-processing",
    "order-cancelled",
    "order-failed",
  ],
  "order-processing": [
    "order-at-local-facility",
    "order-out-for-delivery",
    "order-completed",
    "order-cancelled",
    "order-failed",
  ],
  "order-at-local-facility": ["order-out-for-delivery"],
  "order-out-for-delivery": ["order-completed", "order-failed"],
  "order-completed": ["order-refunded"],
  "order-cancelled": [],
  "order-refunded": [],
  "order-failed": [],
}

const TERMINAL: ReadonlySet<OrderStatus> = new Set([
  "order-cancelled",
  "order-refunded",
  "order-failed",
])

export function isTerminalStatus(status: OrderStatus): boolean {
  return TERMINAL.has(status)
}

export function nextStatuses(status: OrderStatus): OrderStatus[] {
  return ORDER_STATUS_TRANSITIONS[status] ?? []
}

export function canCancel(status: OrderStatus): boolean {
  return nextStatuses(status).includes("order-cancelled")
}
