"use client"

import Link from "next/link"
import { FileIcon, SparklesIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { useTranslations } from "next-intl"

/**
 * Page title with icon, the AI Studio entry, and the two upload actions
 * (from URL / from device).
 *
 * AI Studio sits here rather than only on the rows because it no longer needs
 * a file: `studioHref` opens the studio with the source picker, so a vendor
 * with an image on their desktop and an empty library has a way in.
 */
export function FilesHeader({
  uploading,
  studioHref,
  onUploadClick,
  onUploadFromUrl,
}: {
  uploading: boolean
  studioHref: string
  onUploadClick: () => void
  onUploadFromUrl: () => void
}) {
  const t = useTranslations("files")
  return (
    <div className="flex items-center justify-between gap-3">
      <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <FileIcon className="size-5 text-muted-foreground" />
        {t("header.title")}
      </h1>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          nativeButton={false}
          render={<Link href={studioHref} />}
        >
          <SparklesIcon className="size-4 text-violet-500" />
          {t("header.aiStudio")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={uploading}
          onClick={onUploadFromUrl}
        >
          {t("header.uploadFromUrl")}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={uploading}
          onClick={onUploadClick}
        >
          {t("header.uploadFiles")}
        </Button>
      </div>
    </div>
  )
}
