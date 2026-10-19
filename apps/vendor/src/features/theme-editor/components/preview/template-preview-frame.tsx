"use client"

import { useTranslations } from "next-intl"

import type { StorefrontTemplateId } from "@/features/storefront-templates/registry"

import { PREVIEW_DEVICE_WIDTH } from "../../lib/preview-adapter"
import { useThemeEditorStore } from "../../state/theme-editor-store"

/**
 * The editor's preview once a shop has chosen a storefront template: the same
 * full-screen route the library opens, fitted to the device width. Section
 * clicks stay in the tree; this template has no section anchors to scroll to.
 */
export function TemplatePreviewFrame({
  templateId,
}: {
  templateId: StorefrontTemplateId
}) {
  const t = useTranslations("themeEditor.library")
  const device = useThemeEditorStore((s) => s.previewDevice)
  const width = PREVIEW_DEVICE_WIDTH[device]
  const name = t(`themes.${templateId}.name`)

  return (
    <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto p-3 md:p-5">
      <iframe
        title={t("previewTitle", { name })}
        src={`/theme-preview/${templateId}`}
        className="min-h-[70vh] w-full rounded-xl bg-white shadow-sm ring-1 ring-foreground/10"
        style={{ maxWidth: width === "full" ? 1100 : width }}
      />
    </div>
  )
}
