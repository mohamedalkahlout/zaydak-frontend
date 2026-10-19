"use client"

import { JURAT_FONTS } from "@/features/shop/components/jurat-fonts"
import { JuratCheckoutFrame } from "@repo/storefront-templates/jurat/checkout"

import { useCheckoutFrame } from "./themed-checkout"

export function JuratThemedCheckout() {
  return (
    <div className={JURAT_FONTS}>
      <JuratCheckoutFrame {...useCheckoutFrame()} fontClass={JURAT_FONTS} />
    </div>
  )
}
