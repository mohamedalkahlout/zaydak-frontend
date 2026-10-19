"use client"

import Link from "next/link"
import { FolderOpenIcon, SparklesIcon, UploadIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { useTranslations } from "next-intl"

/** Empty state — either "no files at all" or "no matches for filters". */
export function FilesEmpty({
  hasFilters,
  studioHref,
  onUploadClick,
  onReset,
}: {
  hasFilters?: boolean
  /** AI Studio brings its own source picker, so it works from an empty library. */
  studioHref?: string
  onUploadClick?: () => void
  onReset?: () => void
}) {
  const t = useTranslations("files")
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-20 text-center">
        <FolderOpenIcon className="size-9 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{t("empty.noMatch")}</p>
          <p className="text-sm text-muted-foreground">
            {t("empty.tryDifferent")}
          </p>
        </div>
        {onReset && (
          <Button variant="outline" size="sm" onClick={onReset}>
            {t("empty.clearFilters")}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 px-4 py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <UploadIcon className="size-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium">{t("empty.uploadFirst")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t("empty.dragHint")}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {onUploadClick && (
          <Button size="sm" className="gap-1.5" onClick={onUploadClick}>
            <UploadIcon className="size-4" />
            {t("header.uploadFiles")}
          </Button>
        )}
        {/* An empty library is exactly when a vendor wants to start from an
            image they have not uploaded yet — the studio takes it directly. */}
        {studioHref && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            nativeButton={false}
            render={<Link href={studioHref} />}
          >
            <SparklesIcon className="size-4 text-violet-500" />
            {t("header.aiStudio")}
          </Button>
        )}
      </div>
    </div>
  )
}
