"use client"

import { BsStars } from "react-icons/bs"
import { Checkbox } from "@repo/ui/components/checkbox"
import { Badge } from "@repo/ui/components/badge"
import { cn } from "@/shared/lib/utils"
import type { FileEntry } from "@/features/files/types"
import {
  fileKind,
  humanFileSize,
  mimeLabel,
} from "@/features/files/lib/list/helpers"
import { FilePreview } from "./file-preview"
import { useTranslations } from "next-intl"

/**
 * A single grid tile: preview, hover/selected checkbox, an AI-enhance action
 * for images, and a caption with the file name and size. Clicking the preview
 * opens the detail panel.
 */
export function FileTile({
  file,
  selected,
  onToggle,
  onOpen,
  onEnhance,
}: {
  file: FileEntry
  selected: boolean
  onToggle: () => void
  onOpen: () => void
  /** Opens the file view on its AI Studio section — it runs the enhance. */
  onEnhance: () => void
}) {
  const t = useTranslations("files")
  const isImage = fileKind(file.mime_type) === "image"

  return (
    <div className="group flex flex-col gap-1.5">
      <div
        className={cn(
          "relative aspect-square overflow-hidden rounded-lg border bg-muted/40 transition-shadow",
          selected && "ring-2 ring-primary ring-offset-1",
        )}
      >
        <button
          type="button"
          onClick={onOpen}
          className="absolute inset-0 cursor-pointer"
          aria-label={t("list.openFile", { name: file.original_name })}
        >
          <FilePreview file={file} />
        </button>

        <div
          className={cn(
            "absolute left-1.5 top-1.5 rounded bg-background/90 p-0.5 shadow-sm transition-opacity",
            !selected && "opacity-0 group-hover:opacity-100",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Checkbox
            checked={selected}
            onCheckedChange={onToggle}
            aria-label={t("list.selectFile", { name: file.original_name })}
          />
        </div>

        {/* Sits above the full-bleed open button, so stop propagation or the
            click opens the editor instead of enhancing. Images only — the
            backend rejects a non-image reference. */}
        {isImage && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onEnhance()
            }}
            title={t("rowActions.enhance")}
            aria-label={t("rowActions.enhanceNamed", { name: file.original_name })}
            className={cn(
              "absolute right-1.5 top-1.5 rounded bg-background/90 p-1.5 shadow-sm transition-opacity",
              "hover:bg-background",
              "opacity-0 group-hover:opacity-100 focus:opacity-100",
            )}
          >
            <BsStars className="size-3.5" aria-hidden />
          </button>
        )}

        <Badge
          variant="secondary"
          className="absolute bottom-1.5 right-1.5 px-1.5 py-0 text-[10px] shadow-sm"
        >
          {mimeLabel(file.mime_type)}
        </Badge>
      </div>

      <div className="min-w-0 px-0.5">
        <p className="truncate text-xs font-medium" title={file.original_name}>
          {file.original_name}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {humanFileSize(file.size)}
        </p>
      </div>
    </div>
  )
}
