"use client"

import { useRef, useState } from "react"
import { useFieldArray } from "react-hook-form"
import { useQuery } from "@apollo/client/react"
import {
  PlusIcon,
  Loader2Icon,
  StarIcon,
  ImageIcon,
  AlertCircleIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import { Checkbox } from "@repo/ui/components/checkbox"
import { Badge } from "@repo/ui/components/badge"
import { ImagesBadge } from "@repo/ui/components/images-badge"
import { useHydrated } from "@repo/ui/hooks/use-hydrated"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { cn } from "@/shared/lib/utils"
import {
  useAttachmentUpload,
  ACCEPTED_IMAGE_ATTR,
} from "@/shared/lib/upload/use-attachment-upload"
import type {
  ProductFormApi,
  ProductImageValue,
  ProductVideoValue,
} from "@/features/products/validations/product"
import {
  GET_ATTACHMENTS,
  type AttachmentsQueryResponse,
  type AttachmentEntry,
} from "@/features/products/api/media"
import { ImageEditor, type EditorMedia } from "./image-editor"
import { AiImagePanel, type ReferenceOption } from "./ai-image-panel"
import { AiFilledMark } from "@/features/ai/components/ai-filled-mark"
import { useAiFilled } from "@/features/ai/components/ai-prefill-context"

/**
 * Shopify-style product media manager. The form keeps media as a primary
 * `image` plus a `gallery[]`; this component presents both as one ordered
 * tile grid where tile 0 is the primary. Every structural edit (add,
 * remove, reorder, set-primary) rebuilds that unified list and writes it
 * back to `image` + `gallery` in one shot, so the two fields can never
 * drift out of sync. Alt-text / colour edits are written targeted (no
 * array rebuild) to preserve input focus.
 *
 * Two ways in: "Upload new" (drag-drop or picker → `/attachments`) and
 * "Select existing" (the `ImagesBadge` folder → picks from files already
 * uploaded to this shop, no re-upload).
 */

interface MediaItem {
  key: string
  id?: string
  original: string
  thumbnail: string
  alt?: ProductImageValue["alt"]
  focal_point?: ProductImageValue["focal_point"]
  color?: string
  slot: "image" | "gallery"
  galleryIndex: number
}

export function MediaManager({ form }: { form: ProductFormApi }) {
  const t = useTranslations("products.mediaManager")
  const tAi = useTranslations("aiImage")
  const tVideo = useTranslations("productVideo")
  const fileRef = useRef<HTMLInputElement>(null)
  const gallery = useFieldArray({ control: form.control, name: "gallery" })
  const { uploadFiles, uploading, progress, error } =
    useAttachmentUpload("product-image")
  const [aiOpen, setAiOpen] = useState(false)

  const image = form.watch("image")
  const galleryVals = form.watch("gallery") ?? []
  const videos = form.watch("video") ?? []

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dragOver, setDragOver] = useState(false)
  const [pending, setPending] = useState(0)
  const [detailKey, setDetailKey] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  // ─── Unified ordered media list ───────────────────────────────────────
  // Cheap to derive from the two watched fields on each render — no memo
  // needed for the handful of media items a product carries.
  const items: MediaItem[] = []
  if (image?.original) {
    items.push({
      key: image.id || image.original,
      id: image.id,
      original: image.original,
      thumbnail: image.thumbnail || image.original,
      alt: image.alt,
      focal_point: image.focal_point,
      slot: "image",
      galleryIndex: -1,
    })
  }
  galleryVals.forEach((g, i) => {
    if (g?.original) {
      items.push({
        key: g.id || g.original || `g${i}`,
        id: g.id,
        original: g.original,
        thumbnail: g.thumbnail || g.original,
        alt: g.alt,
        focal_point: g.focal_point,
        color: g.color ?? "",
        slot: "gallery",
        galleryIndex: i,
      })
    }
  })

  const isEmpty = items.length === 0 && pending === 0

  // ─── Write helpers ────────────────────────────────────────────────────
  const writeMedia = (list: MediaItem[]) => {
    const [first, ...rest] = list
    form.setValue(
      "image",
      first
        ? {
            id: first.id,
            original: first.original,
            thumbnail: first.thumbnail,
            alt: first.alt,
            focal_point: first.focal_point,
          }
        : null,
      { shouldDirty: true },
    )
    gallery.replace(
      rest.map((m) => ({
        id: m.id,
        original: m.original,
        thumbnail: m.thumbnail,
        alt: m.alt,
        focal_point: m.focal_point,
        color: m.color ?? "",
      })),
    )
  }

  // Apply an edited media value (possibly a freshly re-uploaded asset) back
  // onto its tile, preserving order.
  const applyEdit = (key: string, next: EditorMedia) => {
    writeMedia(
      items.map((m) =>
        m.key === key
          ? {
              ...m,
              id: next.id,
              original: next.original,
              thumbnail: next.thumbnail,
              alt: next.alt,
              focal_point: next.focal_point,
            }
          : m,
      ),
    )
  }

  const addMedia = (
    incoming: Array<{ id?: string; original: string; thumbnail: string }>,
  ) => {
    if (!incoming.length) return
    const next: MediaItem[] = [
      ...items,
      ...incoming.map((m, i) => ({
        key: m.id || m.original || `new${i}`,
        id: m.id,
        original: m.original,
        thumbnail: m.thumbnail || m.original,
        slot: "gallery" as const,
        galleryIndex: -1,
      })),
    ]
    writeMedia(next)
  }

  const removeKeys = (keys: Set<string>) => {
    writeMedia(items.filter((m) => !keys.has(m.key)))
    setSelected(new Set())
  }

  const setPrimary = (key: string) => {
    const target = items.find((m) => m.key === key)
    if (!target) return
    writeMedia([target, ...items.filter((m) => m.key !== key)])
  }

  // ─── Upload ───────────────────────────────────────────────────────────
  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList)
    if (!files.length) return
    setPending(files.length)
    const uploaded = await uploadFiles(files)
    setPending(0)
    addMedia(uploaded)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files)
  }

  // ─── Selection ────────────────────────────────────────────────────────
  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const detailItem = items.find((m) => m.key === detailKey) ?? null

  return (
    <div
      className="flex flex-col gap-2"
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false)
      }}
      onDrop={onDrop}
    >
      {/* Header row: label, or selection bar when tiles are selected. */}
      <div className="flex h-6 items-center justify-between">
        {selected.size > 0 ? (
          <>
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked
                onCheckedChange={() => setSelected(new Set())}
              />
              {t("selectedCount", { count: selected.size })}
            </label>
            <button
              type="button"
              onClick={() => removeKeys(selected)}
              className="text-sm font-medium text-destructive hover:underline"
            >
              {t("remove")}
            </button>
          </>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium">
              {t("title")}
              <MediaFilledMark />
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAiOpen(true)}
                className="flex items-center gap-1 text-xs font-medium text-violet-600 hover:underline dark:text-violet-400"
              >
                <SparklesIcon className="size-3.5" />
                {tAi("generateWithAi")}
              </button>
              {!isEmpty && (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  {t("selectExisting")}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_IMAGE_ATTR}
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) void handleFiles(e.target.files)
          e.target.value = ""
        }}
      />

      {isEmpty ? (
        // ── Empty state ──────────────────────────────────────────────────
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed bg-muted/30 px-4 py-10 text-center transition-colors",
            dragOver && "border-primary bg-primary/5",
          )}
        >
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              {t("uploadNew")}
            </Button>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t("selectExistingMedia")}
            >
              <ImagesBadge
                text={t("selectExisting")}
                images={existingThumbs(form)}
                className="text-muted-foreground"
              />
            </button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setAiOpen(true)}
            className="gap-1.5 text-violet-600 hover:text-violet-700 dark:text-violet-400"
          >
            <SparklesIcon className="size-4" />
            {tAi("generateWithAi")}
          </Button>
          <p className="text-xs text-muted-foreground">
            {dragOver ? t("dropToUpload") : t("accepts")}
          </p>
        </div>
      ) : (
        // ── Tile grid ────────────────────────────────────────────────────
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {items.map((m, index) => (
            <MediaTile
              key={m.key}
              item={m}
              isPrimary={index === 0}
              selected={selected.has(m.key)}
              onToggle={() => toggleSelect(m.key)}
              onOpen={() => setDetailKey(m.key)}
              onSetPrimary={() => setPrimary(m.key)}
            />
          ))}

          {/* Processing placeholders while an upload is in flight. */}
          {Array.from({ length: pending }).map((_, i) => (
            <div
              key={`pending-${i}`}
              className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border bg-muted/40"
            >
              <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">
                {uploading ? t("uploading", { progress }) : t("processing")}
              </span>
            </div>
          ))}

          {/* Add tile. */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t("addMedia")}
          >
            <PlusIcon className="size-6" />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <VideoStrip
        videos={videos}
        label={tVideo("sectionLabel")}
        removeLabel={tVideo("removeVideo")}
        onRemove={(i) =>
          form.setValue(
            "video",
            videos.filter((_, idx) => idx !== i),
            { shouldDirty: true },
          )
        }
      />

      {/* Full-screen image editor — opens on tile click. */}
      {detailItem && (
        <ImageEditor
          media={{
            id: detailItem.id,
            original: detailItem.original,
            thumbnail: detailItem.thumbnail,
            alt: detailItem.alt,
            focal_point: detailItem.focal_point,
          }}
          onClose={() => setDetailKey(null)}
          onSave={(next) => {
            applyEdit(detailItem.key, next)
            setDetailKey(null)
          }}
        />
      )}

      {/* Select-existing picker. */}
      <ExistingMediaDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        existingKeys={new Set(items.map((m) => m.id ?? m.original))}
        onAdd={(picked) => {
          addMedia(
            picked.map((a) => ({
              id: a.id,
              original: a.url,
              thumbnail: a.thumbnail ?? a.url,
            })),
          )
          setPickerOpen(false)
        }}
      />

      {/* AI image generation. Picked results are staged into media via the
          same addMedia path, so the contextual save bar handles persistence. */}
      <AiImagePanel
        open={aiOpen}
        onOpenChange={setAiOpen}
        onAdd={addMedia}
        referenceOptions={referenceOptions(items)}
        productId={(form.getValues() as { id?: string }).id}
      />
    </div>
  )
}

/**
 * The staged product clips, with a remove control.
 *
 * A separate strip from the tile grid rather than a tile inside it, because the
 * grid's whole contract is "index 0 is the primary image" — a video has no
 * place in that ordering, and slotting one in would make the primary depend on
 * where the vendor dropped a clip.
 */
function VideoStrip({
  videos,
  onRemove,
  label,
  removeLabel,
}: {
  videos: ProductVideoValue[]
  onRemove: (index: number) => void
  label: string
  removeLabel: string
}) {
  if (!videos.length) return null
  return (
    <div className="flex flex-col gap-2 pt-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-3">
        {videos.map((v, i) => (
          <div
            key={`${v.url}-${i}`}
            className="group relative w-40 overflow-hidden rounded-lg border bg-black"
          >
            { }
            <video
              src={v.url}
              poster={v.poster || undefined}
              controls
              playsInline
              preload="metadata"
              className="aspect-video w-full"
            />
            <button
              type="button"
              onClick={() => onRemove(i)}
              aria-label={removeLabel}
              className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            >
              <Trash2Icon className="size-3.5" />
            </button>
            {v.duration_seconds ? (
              <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {v.duration_seconds}s
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Existing media that carry an attachment id — usable as an AI reference. */
function referenceOptions(items: MediaItem[]): ReferenceOption[] {
  return items
    .filter((m): m is MediaItem & { id: string } => !!m.id)
    .map((m) => ({ id: m.id, thumbnail: m.thumbnail }))
}

/** First few existing-media thumbnails to tease inside the ImagesBadge folder. */
function existingThumbs(form: ProductFormApi): string[] {
  const image = form.getValues("image")
  const g = form.getValues("gallery") ?? []
  return [image?.thumbnail || image?.original, ...g.map((x) => x?.thumbnail)]
    .filter((s): s is string => !!s)
    .slice(0, 3)
}

// ─── Tile ──────────────────────────────────────────────────────────────────
function MediaTile({
  item,
  isPrimary,
  selected,
  onToggle,
  onOpen,
  onSetPrimary,
}: {
  item: MediaItem
  isPrimary: boolean
  selected: boolean
  onToggle: () => void
  onOpen: () => void
  onSetPrimary: () => void
}) {
  const t = useTranslations("products.mediaManager")
  return (
    <div
      className={cn(
        "group relative aspect-square overflow-hidden rounded-lg border bg-muted/40 transition-shadow",
        selected && "ring-2 ring-primary ring-offset-1",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="absolute inset-0 cursor-pointer"
        aria-label={t("editMedia")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.thumbnail}
          alt={
            (item.alt?.en as string) || (item.alt?.ar as string) || t("mediaAlt")
          }
          className="h-full w-full object-cover"
        />
      </button>

      {/* Selection checkbox — visible on hover or once selected. */}
      <div
        className={cn(
          "absolute left-1.5 top-1.5 rounded bg-background/90 p-0.5 shadow-sm transition-opacity",
          !selected && "opacity-0 group-hover:opacity-100",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox checked={selected} onCheckedChange={onToggle} />
      </div>

      {isPrimary ? (
        <Badge
          variant="secondary"
          className="absolute bottom-1.5 left-1.5 gap-1 px-1.5 py-0 text-[10px] shadow-sm"
        >
          <StarIcon className="size-2.5 fill-current" />
          {t("primary")}
        </Badge>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onSetPrimary()
          }}
          className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] font-medium opacity-0 shadow-sm transition-opacity hover:text-primary group-hover:opacity-100"
        >
          <StarIcon className="size-2.5" />
          {t("setPrimary")}
        </button>
      )}
    </div>
  )
}

// ─── Select-existing dialog ─────────────────────────────────────────────────
function ExistingMediaDialog({
  open,
  onOpenChange,
  existingKeys,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  existingKeys: Set<string>
  onAdd: (picked: AttachmentEntry[]) => void
}) {
  const t = useTranslations("products.mediaManager")
  const tc = useTranslations("common")
  const hydrated = useHydrated()
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const { data, loading } = useQuery<AttachmentsQueryResponse>(GET_ATTACHMENTS, {
    variables: { limit: 60 },
    skip: !open || !hydrated,
    fetchPolicy: "cache-and-network",
  })

  const images = (data?.attachments.data ?? []).filter((a) =>
    a.mime_type.startsWith("image/"),
  )

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const confirm = () => {
    onAdd(images.filter((a) => picked.has(a.id)))
    setPicked(new Set())
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setPicked(new Set())
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("selectExistingMedia")}</DialogTitle>
        </DialogHeader>

        {loading && !images.length ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2Icon className="size-6 animate-spin" />
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <ImageIcon className="size-8" />
            <p className="text-sm">{t("noUploads")}</p>
          </div>
        ) : (
          <div className="grid max-h-[55vh] grid-cols-3 gap-3 overflow-y-auto p-0.5 sm:grid-cols-4">
            {images.map((a) => {
              const already = existingKeys.has(a.id) || existingKeys.has(a.url)
              const isPicked = picked.has(a.id)
              return (
                <button
                  key={a.id}
                  type="button"
                  disabled={already}
                  onClick={() => toggle(a.id)}
                  className={cn(
                    "group relative aspect-square overflow-hidden rounded-lg border bg-muted/40 transition-shadow",
                    isPicked && "ring-2 ring-primary ring-offset-1",
                    already && "cursor-not-allowed opacity-40",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.thumbnail ?? a.url}
                    alt={a.original_name}
                    className="h-full w-full object-cover"
                  />
                  {isPicked && (
                    <span className="absolute inset-0 bg-primary/10" />
                  )}
                  <div className="absolute left-1.5 top-1.5">
                    <Checkbox checked={isPicked} tabIndex={-1} />
                  </div>
                  {already && (
                    <span className="absolute bottom-1.5 left-1.5 rounded bg-background/90 px-1.5 py-0.5 text-[10px] shadow-sm">
                      {t("added")}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {tc("cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={picked.size === 0}
            onClick={confirm}
          >
            {picked.size > 0 ? t("addCount", { count: picked.size }) : t("add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MediaFilledMark() {
  const image = useAiFilled("image")
  const gallery = useAiFilled("gallery")
  if (!image && !gallery) return null
  return <AiFilledMark name={image ? "image" : "gallery"} />
}
