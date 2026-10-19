/**
 * Which money rows checkout shows. Every figure is already priced: this only
 * decides the label and whether a zero shipping fee may say "free".
 */
export function checkoutMoneyRows(input: {
  needsShipping: boolean
  addressReady: boolean
  hasQuote: boolean
  shippingAvailable: boolean
  shippingFeeCents: number
  discountCents: number
  taxCents: number
  subtotal: string
  shipping: string
  freeLabel: string
  pending: string
  discount: string
  tax: string
  labels: {
    subtotal: string
    shipping: string
    discount: string
    tax: string
  }
}): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [
    { label: input.labels.subtotal, value: input.subtotal },
  ]

  if (input.needsShipping) {
    const shippingIsFree =
      input.hasQuote && input.shippingFeeCents === 0 && input.shippingAvailable
    const value =
      !input.addressReady && !input.hasQuote
        ? input.pending
        : shippingIsFree
          ? input.freeLabel
          : input.shipping
    rows.push({ label: input.labels.shipping, value })
  }

  if (input.discountCents > 0) {
    rows.push({ label: input.labels.discount, value: input.discount })
  }
  if (input.taxCents > 0) {
    rows.push({ label: input.labels.tax, value: input.tax })
  }
  return rows
}
