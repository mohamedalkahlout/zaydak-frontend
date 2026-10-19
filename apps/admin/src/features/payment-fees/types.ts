import type { AdminPaymentGatewayFeesQuery } from "@/shared/api/generated/graphql"

/** One row of the fee schedule, as selected by `AdminPaymentGatewayFees`. */
export type PaymentFeeRow =
  AdminPaymentGatewayFeesQuery["paymentGatewayFees"]["data"][number]

/**
 * The highest percentage the form accepts. Mirrors `PAYMENT_FEE_MAX_BPS`
 * (2000 bps) in the back-end's `upsert-payment-gateway-fee.input.ts`, which is
 * the rule that actually holds; this only tells the admin before submitting.
 */
export const MAX_FEE_PERCENT = 20

/**
 * Whether a row can be edited here: its payment method is one the API accepts.
 *
 * A row for any other method was written by hand before this screen existed.
 * No order can be paid that way, so the fee is never charged, and the mutation
 * would refuse the method. The list still shows it rather than hiding a row
 * somebody may be looking for.
 */
export function isEditableFee(
  row: Pick<PaymentFeeRow, "gateway">,
  gateways: readonly string[],
): boolean {
  return gateways.includes(row.gateway)
}

/** The existing fee for a method and currency, whatever case was typed. */
export function findFee<T extends Pick<PaymentFeeRow, "gateway" | "currency">>(
  rows: readonly T[],
  gateway: string,
  currency: string,
): T | undefined {
  const code = currency.trim().toUpperCase()
  return rows.find((row) => row.gateway === gateway && row.currency === code)
}
