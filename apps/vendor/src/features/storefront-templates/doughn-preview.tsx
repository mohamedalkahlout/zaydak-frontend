"use client"

import { DoughnCheckoutFrame } from "@repo/storefront-templates/doughn/checkout"
import { PreviewShell } from "./preview-shell"

export function DoughnPreview() {
  return <PreviewShell shopName="doughn" homeHref="/theme-preview/doughn" Frame={DoughnCheckoutFrame} />
}
