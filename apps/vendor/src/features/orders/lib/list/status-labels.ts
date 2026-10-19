import type { OrderStatus, PaymentStatus } from "@/features/orders/types"

/**
 * Where a status's words live, as a key rather than as the words themselves.
 *
 * This file used to hold two English `Record`s, and they were the third copy of
 * the same vocabulary — the filter menu had one, the badge had another — which
 * is how "COD", "Cash on delivery" and "Cash on delivery" ended up being three
 * spellings of one payment state on three surfaces of the same screen. Every
 * caller now resolves the same key under the `orders` namespace, so a status is
 * renamed in `messages/{en,ar}.json` and nowhere else.
 *
 * `t.has()` guards each read: a status the server invents is rendered as its
 * raw id, which is what the badges did before and is still better than a
 * missing-message path in a table cell.
 */
export const orderStatusKey = (status: OrderStatus | string) =>
  `orderStatus.${status}`

export const paymentStatusKey = (status: PaymentStatus | string) =>
  `paymentStatus.${status}`
