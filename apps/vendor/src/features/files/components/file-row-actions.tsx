"use client"

import { useRef } from "react"
import { Loader2Icon } from "lucide-react"
import { BsArrowRepeat, BsDownload, BsLink45Deg, BsStars } from "react-icons/bs"
import { sileo } from "sileo"
import { Button } from "@repo/ui/components/button"
import { fileKind } from "@/features/files/lib/list/helpers"
import type { FileEntry } from "@/features/files/types"
import { useTranslations } from "next-intl"

/**
 * Per-row hover actions for the Files list: **Replace** (swap the file's
 * bytes in place, keeping its URL) and **Copy link** (put the file URL on the
 * clipboard). Revealed on row hover / keyboard focus so they don't clutter
 * the table. Clicks stop propagation so they never open the detail panel.
 *
 * The replacement picker is a per-row hidden input: the picked File is handed
 * straight to `onReplace` — no shared ref that a re-render could reset — and
 * the `accept` is pinned to the file's own MIME type (the backend rejects a
 * type change, so guide the user up front).
 */
export function FileRowActions({
  file,
  replacing,
  onReplace,
  onEnhance,
}: {
  file: FileEntry
  replacing: boolean
  onReplace: (file: FileEntry, picked: File) => void
  /** Opens the file view on its AI Studio section — it runs the enhance. */
  onEnhance: (file: FileEntry) => void
}) {
  const t = useTranslations("files")
  const inputRef = useRef<HTMLInputElement>(null)
  const isImage = fileKind(file.mime_type) === "image"

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(file.url)
      sileo.success({ title: t("toast.linkCopied") })
    } catch {
      sileo.error({ title: t("toast.copyFailed") })
    }
  }

  return (
    <div
      className="flex items-center justify-end gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100"
      onClick={(e) => e.stopPropagation()}
    >
      {/* No `accept` filter — a replacement may change file type now that the
          new bytes get a new URL rather than reusing the old extension. */}
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        onChange={(e) => {
          const picked = e.target.files?.[0]
          if (picked) onReplace(file, picked)
          e.target.value = ""
        }}
      />
      {/* Images only — the backend rejects a non-image reference, so don't
          offer the action where it can only fail. */}
      {isImage && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={() => onEnhance(file)}
          title={t("rowActions.enhance")}
          aria-label={t("rowActions.enhanceNamed", { name: file.original_name })}
        >
          <BsStars className="size-4" aria-hidden />
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-foreground"
        disabled={replacing}
        onClick={() => inputRef.current?.click()}
        title={t("rowActions.replace")}
        aria-label={t("rowActions.replaceNamed", { name: file.original_name })}
      >
        {replacing ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <BsArrowRepeat className="size-4" aria-hidden />
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:text-foreground"
        onClick={handleCopyLink}
        title={t("rowActions.copyLink")}
        aria-label={t("rowActions.copyLinkNamed", { name: file.original_name })}
      >
        <BsLink45Deg className="size-4" aria-hidden />
      </Button>
      {/* Plain anchor, not a fetch — the browser streams the bytes itself and
          `download` keeps the vendor's original filename. */}
      <Button
        variant="ghost"
        size="icon"
        nativeButton={false}
        render={
          <a
            href={file.url}
            download={file.original_name}
            target="_blank"
            rel="noreferrer"
          />
        }
        className="size-8 text-muted-foreground hover:text-foreground"
        title={t("rowActions.download")}
        aria-label={t("rowActions.downloadNamed", { name: file.original_name })}
      >
        <BsDownload className="size-4" aria-hidden />
      </Button>
    </div>
  )
}
