"use client"

import { DoughnCheckoutFrame } from "@repo/storefront-templates/doughn/checkout"

import { useCheckoutFrame } from "./themed-checkout"

export function DoughnThemedCheckout() {
  return <DoughnCheckoutFrame {...useCheckoutFrame()} />
}
