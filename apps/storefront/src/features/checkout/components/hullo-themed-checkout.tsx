"use client"

import { HulloCheckoutFrame } from "@repo/storefront-templates/hullo/checkout"

import { useCheckoutFrame } from "./themed-checkout"

export function HulloThemedCheckout() {
  return <HulloCheckoutFrame {...useCheckoutFrame()} />
}
