"use client"

import { useRef, useState } from "react"
import { useTranslations } from "next-intl"
import {
  FolderOpenIcon,
  ImageIcon,
  Link2Icon,
  Loader2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { SectionLabel } from "./enhance-studio-controls"
import { MediaLibraryPicker } from "./media-library-picker"
import {
  STUDIO_SOURCE_ATTR,
  type StudioSource,
} from "@/features/files/lib/use-studio-source"
import type { FileEntry } from "@/features/files/types"

/**
 * The **Images** section — the studio's first decision, and the only one that
 * exists before there is anything to run on.
 *
 * Three ways in, because the vendor's image is in one of three places: on their
 * device, already in their library, or behind a link. The add tile is split so
 * the first two are one click each rather than one click plus a menu; the link
 * field sits below because pasting is a different gesture from picking.
 *
 * **One source per run.** `enhanceImageShots` takes a single `attachmentId`, so
 * the grid holds the add tile and the chosen image and nothing else — no row of
 * empty slots implying a capacity the backend does not have. Multi-reference is
 * a real feature (flux-2-pro accepts up to 8) and it is in the backlog; until
 * the mutation grows to match, offering slots would be a promise this screen
 * can't keep.
 */
export function AiStudioSourcePicker({
  source,
  busy,
  progress,
  error,
  onUploadFiles,
  onPickFromLibrary,
  onImportUrl,
  onClear,
}: {
  source: StudioSource | null
  busy: boolean
  progress: number
  error: string | null
  onUploadFiles: (files: File[] | FileList) => void
  onPickFromLibrary: (file: FileEntry) => void
  onImportUrl: (url: string) => void
  onClear: () => void
}) {
  const t = useTranslations("aiStudio")
  const inputRef = useRef<HTMLInputElement>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [url, setUrl] = useState("")

  const submitUrl = () => {
    if (!url.trim() || busy) return
    onImportUrl(url)
    setUrl("")
  }

  return (
    <div className="space-y-2">
      <SectionLabel>{t("source.images")}</SectionLabel>

      <div className="grid grid-cols-4 gap-2">
        {/* Add tile — upload on top, library below. Kept first so its position
            doesn't move when a source arrives beside it. */}
        <div className="flex aspect-square flex-col overflow-hidden rounded-lg border border-input">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            title={t("source.uploadTitle")}
            aria-label={t("source.uploadTitle")}
            className="flex flex-1 items-center justify-center border-b border-input text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            {busy ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <UploadIcon className="size-4" />
            )}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setLibraryOpen(true)}
            title={t("source.libraryTitle")}
            aria-label={t("source.libraryTitle")}
            className="flex flex-1 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <FolderOpenIcon className="size-4" />
          </button>
        </div>

        {source ? (
          <div className="group relative aspect-square overflow-hidden rounded-lg border border-violet-500">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={source.url}
              alt={source.name}
              className="size-full object-cover"
            />
            <button
              type="button"
              onClick={onClear}
              aria-label={t("source.remove")}
              className="absolute end-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            >
              <XIcon className="size-3" />
            </button>
          </div>
        ) : (
          // One inert placeholder, not a row of them: it says "an image goes
          // here", which is true, without implying three of them could.
          <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-input text-muted-foreground/50">
            <ImageIcon className="size-4" />
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={STUDIO_SOURCE_ATTR}
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) onUploadFiles(e.target.files)
          e.target.value = ""
        }}
      />

      {busy && progress > 0 && progress < 100 && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-violet-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Import from URL — the backend fetches it; the browser can't (CORS). */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-input px-2.5",
          busy && "opacity-50",
        )}
      >
        <Link2Icon className="size-4 shrink-0 text-muted-foreground" />
        <input
          type="url"
          value={url}
          disabled={busy}
          placeholder={t("source.urlPlaceholder")}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              submitUrl()
            }
          }}
          className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {/* Explicit, never on blur: importing writes a real file into the
            library, and tabbing out of a field the vendor was still editing is
            not consent to do that. */}
        {url.trim() && (
          <button
            type="button"
            disabled={busy}
            onClick={submitUrl}
            className="shrink-0 text-xs font-medium text-violet-400 hover:text-violet-300 disabled:opacity-50"
          >
            {t("source.import")}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <MediaLibraryPicker
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        onPick={onPickFromLibrary}
      />
    </div>
  )
}
