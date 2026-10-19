"use client"

import { JURAT_FONTS } from "./jurat-fonts"
import { JuratCheckoutFrame } from "@repo/storefront-templates/jurat/checkout"
import { PreviewShell } from "./preview-shell"

export function JuratPreview() {
  return (
    <div className={JURAT_FONTS}>
      <PreviewShell shopName="جرعة فن" homeHref="/theme-preview/jurat" Frame={JuratCheckoutFrame} />
    </div>
  )
}
