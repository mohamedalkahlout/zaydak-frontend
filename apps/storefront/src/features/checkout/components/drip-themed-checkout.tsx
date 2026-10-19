"use client"

import { DripCheckoutFrame } from "@repo/storefront-templates/drip/checkout"

import { useCheckoutFrame } from "./themed-checkout"

export function DripThemedCheckout({ fonts }: { fonts: string }) {
  return <DripCheckoutFrame {...useCheckoutFrame()} fontClass={fonts} />
}
