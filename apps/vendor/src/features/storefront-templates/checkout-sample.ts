import type { ReactNode } from "react"

import type { CheckoutFrameProps } from "@repo/storefront-templates/checkout-frame"

export const SAMPLE_FIELDS = {
  name: "Name",
  nameValue: "Lina",
  contact: "Email or phone",
  contactValue: "lina@example.com",
}

const lines = [
  { id: "1", name: "Pistachio", qty: 2 },
  { id: "2", name: "Saffron rose", qty: 1 },
]

/** Sample customer copy for the theme-preview checkout. Same role as each template's content.ts. */
export function checkoutSample(
  shopName: string,
  homeHref: string,
  onPlace: () => void,
  fields: ReactNode,
): CheckoutFrameProps {
  return {
    shopName,
    homeHref,
    title: "Checkout",
    backHref: homeHref,
    backLabel: "Shop",
    lines,
    moneyRows: [
      { label: "Subtotal", value: "42 SAR" },
      { label: "Shipping", value: "Free" },
    ],
    totalLabel: "Total",
    total: "42 SAR",
    pending: false,
    placeLabel: "Place order",
    placingLabel: "Placing your order…",
    placing: false,
    canPlace: true,
    onPlace,
    fields,
    empty: null,
    loading: false,
    notice: "Preview. Nothing is charged.",
  }
}
