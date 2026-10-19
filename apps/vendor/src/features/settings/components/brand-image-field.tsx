"use client"

import { useRef, useState } from "react"
import { useTranslations } from "next-intl"
import {
  ImageIcon,
  ImagesIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  TrashIcon,
  UploadIcon,
} from "lucide-react"
import { sileo } from "sileo"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { MediaLibraryPicker } from "@/features/files/components/media-library-picker"
import {
  ACCEPTED_IMAGE_ATTR,
  ACCEPTED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  useAttachmentUpload,
} from "@/shared/lib/upload/use-attachment-upload"
import { cn } from "@/shared/lib/utils"
import { BrandAddButton, BrandRow, BrandTile } from "./brand-row"
import { fileToSettingsImage } from "../lib/brand"
import type { SettingsImage } from "../types"

/** Stated up front rather than discovered by a rejected upload. */
const MAX_UPLOAD_MB = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))

/** Which recommendation the slot carries — formats and the size to aim for. */
const HINT_KEY = {
  wide: "hintWide",
  square: "hintSquare",
  cover: "hintCover",
} as const

/**
 * One brand image slot, drawn as an empty slot until it holds something.
 *
 * It **stages** — `onChange` writes into the pane's form and the contextual
 * save bar is what persists it. The upload itself is not a staged edit though:
 * the file has to reach `/attachments` to have a URL at all, so the bytes go up
 * immediately and only the *reference* waits for Save. A vendor who uploads and
 * then discards leaves an orphan in the media library, which is the same thing
 * product media does and is preferable to holding a `File` in memory across a
 * pane switch.
 *
 * Two sources fill the slot and neither is the obvious default, so the plus
 * opens a menu rather than firing one of them: a vendor with the file on disk
 * and a vendor who uploaded it last week are equally common. The row still
 * takes a drop, which is the third way and needs no menu at all.
 *
 * SVG is deliberately allowed here. The library picker's default filter drops
 * it because the AI models cannot read it — a logo has the opposite need.
 */
export function BrandImageField({
  label,
  addLabel,
  value,
  onChange,
  shape = "wide",
}: {
  /** Shown once the slot is filled. */
  label: string
  /** Shown while it is empty — "Add a default logo". */
  addLabel: string
  value: SettingsImage | null
  onChange: (next: SettingsImage | null) => void
  /** Drives the preview box and the recommendation; nothing is cropped. */
  shape?: "wide" | "square" | "cover"
}) {
  const t = useTranslations("settings.brand")
  const tCommon = useTranslations("common")
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { uploadFiles, uploading, progress } = useAttachmentUpload("brand", {
    acceptedTypes: ACCEPTED_IMAGE_TYPES,
  })

  const take = async (files: File[]) => {
    const [first] = files
    if (!first) return
    const [uploaded] = await uploadFiles([first])
    if (!uploaded?.id) {
      sileo.error({ title: t("uploadFailed") })
      return
    }
    onChange({
      id: uploaded.id,
      original: uploaded.original,
      thumbnail: uploaded.thumbnail,
    })
  }

  const tile = (
    <BrandTile
      filled={!!value || dragging}
      wide={shape !== "square"}
      className={cn(dragging && "border-primary bg-primary/5 ring-primary/30")}
    >
      {uploading ? (
        <span className="text-[10px] font-medium tabular-nums">
          <Loader2Icon className="mx-auto size-4 animate-spin" />
          {progress}%
        </span>
      ) : value ? (
        /* Plain <img>: these are CDN URLs on hosts next/image is not
           configured for, and a settings preview gains nothing from the
           optimizer. Same call the library picker makes. */
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={value.thumbnail || value.original}
          alt=""
          className={cn(
            "size-full",
            shape === "cover" ? "object-cover" : "object-contain p-1",
          )}
        />
      ) : (
        <ImageIcon className="size-4" />
      )}
    </BrandTile>
  )

  return (
    <>
      <BrandRow
        tile={tile}
        title={value ? label : addLabel}
        hint={t(HINT_KEY[shape], { size: MAX_UPLOAD_MB })}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void take(Array.from(e.dataTransfer.files))
        }}
        action={
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={uploading}
              render={(props) =>
                value ? (
                  <button
                    {...props}
                    type="button"
                    aria-label={label}
                    className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                  >
                    <MoreHorizontalIcon className="size-4" />
                  </button>
                ) : (
                  <BrandAddButton {...props} label={addLabel} />
                )
              }
            />
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => inputRef.current?.click()}>
                {value ? (
                  <RefreshCwIcon className="size-4" />
                ) : (
                  <UploadIcon className="size-4" />
                )}
                {value ? t("replace") : t("upload")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLibraryOpen(true)}>
                <ImagesIcon className="size-4" />
                {t("fromLibrary")}
              </DropdownMenuItem>
              {value && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => onChange(null)}
                  >
                    <TrashIcon className="size-4" />
                    {tCommon("delete")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_ATTR}
        className="hidden"
        onChange={(e) => {
          void take(Array.from(e.target.files ?? []))
          // Clearing lets the same file be chosen twice in a row — without it
          // the second pick fires no change event.
          e.target.value = ""
        }}
      />

      <MediaLibraryPicker
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        accept={(mime) => ACCEPTED_IMAGE_TYPES.includes(mime)}
        onPick={(file) => onChange(fileToSettingsImage(file))}
      />
    </>
  )
}
