"use client"

import { PERSONNE_FONTS } from "@/features/shop/components/personne-fonts"
import { PersonneCheckoutFrame } from "@repo/storefront-templates/personne/checkout"

import { useCheckoutFrame } from "./themed-checkout"

export function PersonneThemedCheckout() {
  return (
    <div className={PERSONNE_FONTS}>
      <PersonneCheckoutFrame {...useCheckoutFrame()} fontClass={PERSONNE_FONTS} />
    </div>
  )
}
