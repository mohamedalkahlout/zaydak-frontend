"use client"

import { useTranslations } from "next-intl"
import { cn } from "@/shared/lib/utils"
import type { FileEntry } from "@/features/files/types"
import { fileAltText, fileKind } from "@/features/files/lib/list/helpers"
import { fileTypeIcon } from "@/features/files/lib/list/file-type-icon"

/**
 * Renders a file's visual: the raster/SVG thumbnail for images, or a
 * per-extension `react-icons` glyph on its category tint for videos, PDFs and
 * other files (which carry no thumbnail).
 *
 * The URL is used as-is — no cache-bust token. Replace mints a new URL for
 * new bytes, so a given URL's content never changes and every layer (browser,
 * CDN, OG scraper) invalidates on its own.
 */
export function FilePreview({
  file,
  className,
  iconClassName,
}: {
  file: FileEntry
  className?: string
  iconClassName?: string
}) {
  const t = useTranslations("files")
  const kind = fileKind(file.mime_type)
  const src = file.thumbnail || (kind === "image" ? file.url : null)
  const alt = fileAltText(file, t("unavailable.fallbackName"))

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={cn("h-full w-full object-cover", className)}
        loading="lazy"
      />
    )
  }

  const { Icon, tone } = fileTypeIcon(file.mime_type)

  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center",
        tone.bg,
        className,
      )}
      role="img"
      aria-label={alt}
    >
      <Icon
        className={cn("size-8 shrink-0", tone.fg, iconClassName)}
        aria-hidden
      />
    </div>
  )
}
