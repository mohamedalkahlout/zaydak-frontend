"use client"

import { useTranslations } from "next-intl"
import { Loader2Icon } from "lucide-react"
import type { FileEntry } from "@/features/files/types"
import { FileTile } from "./file-tile"

/** Grid of file tiles plus placeholder tiles for in-flight uploads. */
export function FilesGrid({
  files,
  selected,
  onToggle,
  onOpen,
  onEnhance,
  pending,
}: {
  files: FileEntry[]
  selected: Set<string>
  onToggle: (id: string) => void
  onOpen: (id: string) => void
  onEnhance: (file: FileEntry) => void
  pending: number
}) {
  const t = useTranslations("files.grid")
  return (
    <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: pending }).map((_, i) => (
        <div
          key={`pending-${i}`}
          className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border bg-muted/40"
        >
          <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
          <span className="text-[11px] text-muted-foreground">
            {t("uploading")}
          </span>
        </div>
      ))}

      {files.map((file) => (
        <FileTile
          key={file.id}
          file={file}
          selected={selected.has(file.id)}
          onToggle={() => onToggle(file.id)}
          onOpen={() => onOpen(file.id)}
          onEnhance={() => onEnhance(file)}
        />
      ))}
    </div>
  )
}
