"use client"

import { JuratTemplate } from "@repo/storefront-templates/jurat"
import { JURAT_FONTS } from "./jurat-fonts"

/** The public home when the shop's template is jurat. */
export function JuratStorefrontHome() {
  return <JuratTemplate fonts={JURAT_FONTS} />
}
