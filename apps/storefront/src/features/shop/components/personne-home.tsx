"use client"

import { PersonneTemplate } from "@repo/storefront-templates/personne"
import { PERSONNE_FONTS } from "./personne-fonts"

/** The public home when the shop's template is personne. */
export function PersonneStorefrontHome() {
  return <PersonneTemplate fonts={PERSONNE_FONTS} />
}
