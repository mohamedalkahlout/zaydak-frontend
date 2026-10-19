"use client"

import { PERSONNE_FONTS } from "./personne-fonts"
import { PersonneCheckoutFrame } from "@repo/storefront-templates/personne/checkout"
import { PreviewShell } from "./preview-shell"

export function PersonnePreview() {
  return (
    <div className={PERSONNE_FONTS}>
      <PreviewShell shopName="Personne" homeHref="/theme-preview/personne" Frame={PersonneCheckoutFrame} />
    </div>
  )
}
