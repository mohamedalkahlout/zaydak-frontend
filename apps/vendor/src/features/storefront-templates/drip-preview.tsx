"use client"

import { DripCheckoutFrame } from "@repo/storefront-templates/drip/checkout"
import { PreviewShell } from "./preview-shell"

export function DripPreview({ fonts }: { fonts: string }) {
  return (
    <PreviewShell shopName="DRIP" homeHref="/theme-preview/drip" Frame={DripCheckoutFrame} fontClass={fonts} />
  )
}
