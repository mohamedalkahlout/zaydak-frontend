import { initials } from "@/shared/lib/format"
import type { Order } from "@/features/orders/types"

export { formatDate, formatMoney, formatMoneyCents } from "@/shared/lib/format"

export function customerInitials(order: Order): string {
  return initials(order.customer?.name)
}

export function itemCount(order: Order): number {
  return order.products.reduce((sum, p) => sum + p.order_quantity, 0)
}
