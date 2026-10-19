"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"

import { Button } from "@repo/ui/components/button"
import { cn } from "@repo/ui/lib/utils"

import { useShopStorefrontTemplate } from "@/features/storefront-templates/use-shop-template"
import { useLeaveGuard } from "@/shared/hooks/use-leave-guard"
import { navigateGuarded } from "@/shared/stores/leave-guard"

import {
  isThemeEditorDirty,
  useThemeEditorStore,
} from "../state/theme-editor-store"
import { EditorHeader } from "./editor-header"
import { MockThemePreview } from "./preview/mock-theme-preview"
import { TemplatePreviewFrame } from "./preview/template-preview-frame"
import { SectionInspector } from "./section-inspector"
import { SectionTree } from "./section-tree"

const PANE =
  "flex min-h-0 flex-col overflow-hidden rounded-xl bg-background shadow-sm ring-1 ring-foreground/10"
const PREVIEW_PANE =
  "flex min-h-0 flex-col overflow-hidden rounded-xl bg-muted/70 shadow-sm ring-1 ring-foreground/10"

export function ThemeEditor() {
  const t = useTranslations("themeEditor")
  const params = useParams<{ shopSlug: string }>()
  const router = useRouter()
  const shopSlug = params.shopSlug
  const { templateId } = useShopStorefrontTemplate(shopSlug)
  const hydrate = useThemeEditorStore((s) => s.hydrate)
  const ready = useThemeEditorStore((s) => s.ready)
  const loading = useThemeEditorStore((s) => s.loading)
  const layout = useThemeEditorStore((s) => s.layout)
  const savedLayout = useThemeEditorStore((s) => s.savedLayout)
  const reset = useThemeEditorStore((s) => s.reset)
  const surface = useThemeEditorStore((s) => s.surface)
  const setSurface = useThemeEditorStore((s) => s.setSurface)
  const dirty = isThemeEditorDirty(layout, savedLayout)
  const themesHref = `/store/${shopSlug}/online-store/themes`

  useEffect(() => {
    void hydrate(shopSlug)
  }, [hydrate, shopSlug])

  useLeaveGuard({
    when: dirty,
    allow: (path) => path.startsWith(`/store/${shopSlug}/online-store/editor`),
    onLeave: () => reset(),
  })

  function exit() {
    navigateGuarded(themesHref, () => router.push(themesHref))
  }

  return (
    <div className="fixed inset-0 z-[45] flex flex-col bg-muted">
      <EditorHeader onExit={exit} />
      <div className="shrink-0 px-2 pt-2 lg:hidden">
        <div className="flex rounded-lg bg-background p-0.5 shadow-sm ring-1 ring-foreground/10">
          {(["tree", "preview", "inspector"] as const).map((item) => (
            <Button
              key={item}
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={surface === item}
              className={cn(
                "h-8 flex-1 rounded-md",
                surface === item && "bg-muted shadow-none",
              )}
              onClick={() => setSurface(item)}
            >
              {t(`surfaces.${item}`)}
            </Button>
          ))}
        </div>
      </div>
      {loading || !ready ? (
        <div className="grid flex-1 place-items-center px-4 text-sm text-muted-foreground">
          {t("loading")}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-2 p-2 lg:grid-cols-[17rem_minmax(0,1fr)_19rem]">
          <div
            className={cn(
              PANE,
              surface === "tree" ? "flex" : "hidden lg:flex",
            )}
          >
            <SectionTree />
          </div>
          <div
            className={cn(
              PREVIEW_PANE,
              surface === "preview" ? "flex" : "hidden lg:flex",
            )}
          >
            {templateId === undefined ? null : templateId ? (
              <TemplatePreviewFrame templateId={templateId} />
            ) : (
              <MockThemePreview />
            )}
          </div>
          <div
            className={cn(
              PANE,
              surface === "inspector" ? "flex" : "hidden lg:flex",
            )}
          >
            <SectionInspector />
          </div>
        </div>
      )}
    </div>
  )
}
