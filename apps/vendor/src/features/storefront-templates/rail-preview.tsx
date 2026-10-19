"use client"

import { RailCheckoutFrame } from "@repo/storefront-templates/rail/checkout"
import { PreviewShell } from "./preview-shell"

export function RailPreview() {
  return <PreviewShell shopName="Rail" homeHref="/theme-preview/rail" Frame={RailCheckoutFrame} />
}
