"use client"

import { HulloCheckoutFrame } from "@repo/storefront-templates/hullo/checkout"
import { PreviewShell } from "./preview-shell"

export function HulloPreview() {
  return <PreviewShell shopName="hullo" homeHref="/theme-preview/hullo" Frame={HulloCheckoutFrame} />
}
