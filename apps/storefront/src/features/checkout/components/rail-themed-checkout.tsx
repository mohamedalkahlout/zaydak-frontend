"use client"

import { RailCheckoutFrame } from "@repo/storefront-templates/rail/checkout"

import { useCheckoutFrame } from "./themed-checkout"

export function RailThemedCheckout() {
  return <RailCheckoutFrame {...useCheckoutFrame()} />
}
