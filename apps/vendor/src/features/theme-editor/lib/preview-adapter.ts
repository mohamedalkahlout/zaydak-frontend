import type { PreviewDevice, StoreLayoutDocument } from "../types"

/**
 * The editor talks to preview through this shape so MockThemePreview can later
 * become StorefrontIframePreview without rewriting the shell.
 */
export interface ThemePreviewHandle {
  renderLayout(layout: StoreLayoutDocument): void
  selectSection(sectionId: string | null): void
  setDevice(device: PreviewDevice): void
}

export const PREVIEW_DEVICE_WIDTH: Record<PreviewDevice, number | "full"> = {
  desktop: "full",
  tablet: 768,
  mobile: 390,
}
