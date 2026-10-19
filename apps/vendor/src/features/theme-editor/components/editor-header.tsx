"use client"

import { useTranslations } from "next-intl"
import {
  ArrowLeft,
  Monitor,
  Redo2,
  Smartphone,
  Tablet,
  Undo2,
} from "lucide-react"

import { Button } from "@repo/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { cn } from "@repo/ui/lib/utils"

import {
  isThemeEditorDirty,
  useThemeEditorStore,
} from "../state/theme-editor-store"
import type { PreviewDevice } from "../types"

const DEVICES: PreviewDevice[] = ["desktop", "tablet", "mobile"]

export function EditorHeader({
  onExit,
}: {
  onExit: () => void
}) {
  const t = useTranslations("themeEditor")
  const layout = useThemeEditorStore((s) => s.layout)
  const savedLayout = useThemeEditorStore((s) => s.savedLayout)
  const history = useThemeEditorStore((s) => s.history)
  const future = useThemeEditorStore((s) => s.future)
  const device = useThemeEditorStore((s) => s.previewDevice)
  const inspectorTab = useThemeEditorStore((s) => s.inspectorTab)
  const saving = useThemeEditorStore((s) => s.saving)
  const publishing = useThemeEditorStore((s) => s.publishing)
  const undo = useThemeEditorStore((s) => s.undo)
  const redo = useThemeEditorStore((s) => s.redo)
  const setDevice = useThemeEditorStore((s) => s.setDevice)
  const setInspectorTab = useThemeEditorStore((s) => s.setInspectorTab)
  const setSurface = useThemeEditorStore((s) => s.setSurface)
  const saveDraftMock = useThemeEditorStore((s) => s.saveDraftMock)
  const publishMock = useThemeEditorStore((s) => s.publishMock)
  const dirty = isThemeEditorDirty(layout, savedLayout)

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
      <div className="flex min-w-0 items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onExit}
          className="gap-1.5"
        >
          <ArrowLeft className="size-4 rtl:-scale-x-100" />
          <span className="hidden sm:inline">{t("exit")}</span>
        </Button>

        <Select value="home" onValueChange={() => undefined}>
          <SelectTrigger size="sm" className="hidden max-w-44 md:flex">
            <SelectValue>{t("templates.home")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="home">{t("templates.home")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="ms-auto flex min-w-0 items-center gap-2">
        {dirty && (
          <span className="hidden truncate text-xs text-muted-foreground lg:inline">
            {t("unsavedChanges")}
          </span>
        )}
        <div className="flex items-center rounded-lg bg-muted p-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={history.length === 0}
            aria-label={t("undo")}
            onClick={undo}
          >
            <Undo2 className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={future.length === 0}
            aria-label={t("redo")}
            onClick={redo}
          >
            <Redo2 className="size-4" />
          </Button>
        </div>
        <div
          className="hidden items-center rounded-lg bg-muted p-0.5 sm:flex"
          role="group"
          aria-label={t("preview")}
        >
          {DEVICES.map((item) => {
            const Icon =
              item === "desktop" ? Monitor : item === "tablet" ? Tablet : Smartphone
            return (
              <Button
                key={item}
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-pressed={device === item}
                aria-label={t(`devices.${item}`)}
                className={cn(
                  "rounded-md",
                  device === item && "bg-background text-foreground shadow-sm",
                )}
                onClick={() => setDevice(item)}
              >
                <Icon className="size-4" />
              </Button>
            )
          })}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="hidden lg:inline-flex"
          aria-pressed={inspectorTab === "theme"}
          onClick={() => {
            setInspectorTab(inspectorTab === "theme" ? "section" : "theme")
            setSurface("inspector")
          }}
        >
          {t("themeSettings")}
        </Button>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!dirty || saving}
            onClick={() => void saveDraftMock()}
          >
            {saving ? t("saving") : t("save")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={publishing}
            onClick={() => void publishMock()}
          >
            {publishing ? t("publishing") : t("publish")}
          </Button>
        </div>
      </div>
    </header>
  )
}
