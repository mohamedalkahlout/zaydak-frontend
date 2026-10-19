"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useMutation, useQuery } from "@apollo/client/react"
import {
  XIcon,
  Undo2Icon,
  Redo2Icon,
  InfoIcon,
  CropIcon,
  Maximize2Icon,
  PencilIcon,
  CrosshairIcon,
  SparklesIcon,
  SlidersHorizontalIcon,
  CheckIcon,
  Loader2Icon,
  RotateCcwIcon,
  RotateCwIcon,
  FlipHorizontal2Icon,
  FlipVertical2Icon,
  ChevronDownIcon,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import {
  ButtonGroup,
  ButtonGroupSeparator,
} from "@repo/ui/components/button-group"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@repo/ui/components/dropdown-menu"
import { Input } from "@repo/ui/components/input"
import { useHydrated } from "@repo/ui/hooks/use-hydrated"
import { cn } from "@/shared/lib/utils"
import {
  useAttachmentUpload,
} from "@/shared/lib/upload/use-attachment-upload"
import {
  GET_ATTACHMENT,
  GET_ATTACHMENT_USAGE,
  SUGGEST_ATTACHMENT_ALT,
  RENAME_ATTACHMENT,
  type AttachmentByIdResponse,
  type AttachmentUsageResponse,
  type SuggestAltResponse,
} from "@/features/products/api/media"
import type { ProductImageValue } from "@/features/products/validations/product"

type FocalPoint = { x: number; y: number }
export interface EditorMedia {
  id?: string
  original: string
  thumbnail: string
  alt?: ProductImageValue["alt"]
  focal_point?: FocalPoint
}

/**
 * What a caller-supplied save handler receives. Lets a host (e.g. the Files
 * page) run its own persistence — replace-in-place vs. save-as-new — instead
 * of the editor's built-in "upload a new attachment" behavior. `exportFile`
 * renders the current canvas (edits included) to a File in the requested MIME
 * type, falling back to JPEG for types canvas cannot encode.
 */
export interface EditorSaveContext {
  media: EditorMedia
  name: string
  alt: string
  pixelEdited: boolean
  exportFile: (mime: string) => Promise<File | null>
}

export interface EditorSaveAction {
  label: string
  /** Return `true` to close the editor; `false`/throw keeps it open. */
  run: (ctx: EditorSaveContext) => Promise<boolean> | boolean
}

/**
 * Opt-in override of the header save buttons. When provided, the built-in
 * single "Save" is replaced by `primary` (filled) plus an optional
 * `secondary` (ghost) — e.g. "Save" (replace in place) + "Save as new".
 */
export interface EditorSavePlan {
  primary: EditorSaveAction
  secondary?: EditorSaveAction
}

/**
 * Crop presets. The named ones carry a message key; a bare ratio such as
 * "3:2" reads the same in every language and is shown as its id.
 */
const ASPECTS: {
  id: string
  labelKey?: "original" | "square" | "freeform"
  ratio: number | null
}[] = [
  { id: "original", labelKey: "original", ratio: null },
  { id: "square", labelKey: "square", ratio: 1 },
  { id: "3:2", ratio: 3 / 2 },
  { id: "5:4", ratio: 5 / 4 },
  { id: "7:5", ratio: 7 / 5 },
  { id: "16:9", ratio: 16 / 9 },
  { id: "freeform", labelKey: "freeform", ratio: 0 },
]

const DRAW_COLORS = [
  "#000000", "#4b5563", "#9ca3af", "#ffffff",
  "#ef4444", "#f59e0b", "#22c55e", "#06b6d4", "#2563eb", "#d946ef",
]
const DEFAULT_DRAW_COLOR = "#4b5563"
const DEFAULT_DRAW_SIZE = 12

/**
 * A rail tool inside the Edit workspace. One is open at a time, and the open
 * one also decides what the canvas does under the pointer (crop box, brush,
 * focal picker).
 */
type Tool = "info" | "crop" | "resize" | "draw" | "focal"

/**
 * The top-level workspace, switched from the header. The two never mix: Edit
 * owns the pixels (crop / resize / draw / focal + metadata), AI owns the
 * generative flow. Splitting them keeps a seven-accordion rail from hiding the
 * one control the vendor came for.
 */
export type EditorView = "edit" | "ai"
/** Local shorthand; `EditorView` is the name hosts import. */
type View = EditorView

export function ImageEditor({
  media,
  onClose,
  onSave,
  savePlan,
  aiSection,
  initialView = "edit",
  onViewChange,
  stageOverlay,
}: {
  media: EditorMedia
  onClose: () => void
  onSave: (next: EditorMedia) => void
  /** When set, overrides the header's single Save with a custom save plan. */
  savePlan?: EditorSavePlan
  /**
   * Body of the "AI Studio" workspace. The host owns its content — the editor
   * supplies the shell (header, scroll area) and the switch that reaches it.
   * Passing nothing drops the AI workspace *and* its header tab entirely, so a
   * host with no AI flow (the product form) sees the plain editor.
   */
  aiSection?: React.ReactNode
  /**
   * Which workspace the editor opens on. Lets a host land the vendor where
   * they asked to be — the Files list's enhance star opens straight on "ai".
   */
  initialView?: View
  /**
   * Notified on every workspace switch. The editor still owns which workspace
   * is live — this is a mirror, not a controller — so a host can reflect it
   * somewhere durable. The Files route writes it to the URL, which makes AI
   * Studio a shareable link that `initialView` reads back on load.
   */
  onViewChange?: (view: View) => void
  /**
   * When set, rendered in the canvas stage INSTEAD of the canvas (which stays
   * mounted but hidden, preserving edit history) — e.g. an AI before/after
   * compare. The host clears it to return to the canvas.
   */
  stageOverlay?: React.ReactNode
}) {
  const t = useTranslations("products.imageEditor")
  const tc = useTranslations("common")
  const hydrated = useHydrated()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const drawColorRef = useRef<string>(DEFAULT_DRAW_COLOR)
  const drawSizeRef = useRef<number>(DEFAULT_DRAW_SIZE)
  const cropRef = useRef<{
    apply?: () => void
    setRatio?: (r: number | null) => void
  } | null>(null)
  const { uploadFiles, uploading } = useAttachmentUpload("product-image")

  // History of dataURLs; index 0 = original load. Pixel edits push new frames.
  const historyRef = useRef<string[]>([])
  const [histIndex, setHistIndex] = useState(0)
  const [histLen, setHistLen] = useState(1)
  const [dims, setDims] = useState({ w: 0, h: 0 })
  const [ready, setReady] = useState(false)

  const [requestedView, setRequestedView] = useState<View>(initialView)
  const [tool, setTool] = useState<Tool>("info")
  const [alt, setAlt] = useState<string>(
    (media.alt?.en as string) || (media.alt?.ar as string) || "",
  )
  // null = untouched → falls back to the fetched attachment name (below).
  const [name, setName] = useState<string | null>(null)
  const [focal, setFocal] = useState<FocalPoint | null>(
    media.focal_point ?? null,
  )
  const [saving, setSaving] = useState(false)

  // The live workspace is derived, never stored: a host with no `aiSection` has
  // only Edit, and while a `stageOverlay` (the AI before/after) owns the stage
  // the edit tools would be manipulating a canvas nobody can see — so a pending
  // result pins the vendor to AI until they resolve it.
  const aiPending = !!stageOverlay
  const view: View = !aiSection ? "edit" : aiPending ? "ai" : requestedView
  const selectView = (next: View) => {
    setRequestedView(next)
    onViewChange?.(next)
  }
  /** Canvas interaction. The AI workspace has no direct-manipulation tool. */
  const canvasTool: Tool | null = view === "ai" ? null : tool

  // ─── Canvas helpers ─────────────────────────────────────────────────────
  const paint = useCallback((dataUrl: string): Promise<void> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = "anonymous"
      img.onload = () => {
        const c = canvasRef.current
        if (!c) return resolve()
        c.width = img.naturalWidth
        c.height = img.naturalHeight
        const ctx = c.getContext("2d")!
        ctx.clearRect(0, 0, c.width, c.height)
        ctx.drawImage(img, 0, 0)
        setDims({ w: img.naturalWidth, h: img.naturalHeight })
        resolve()
      }
      img.onerror = () => resolve()
      img.src = dataUrl
    })
  }, [])

  const pushFrame = useCallback(
    (dataUrl: string) => {
      const next = historyRef.current.slice(0, histIndex + 1)
      next.push(dataUrl)
      historyRef.current = next
      setHistIndex(next.length - 1)
      setHistLen(next.length)
    },
    [histIndex],
  )

  // Initial load — fetch as blob to dodge canvas taint even without CORS.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(media.original, { mode: "cors" })
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        await paint(url)
        URL.revokeObjectURL(url)
      } catch {
        // Fallback: direct load (may taint if server lacks CORS).
        await paint(media.original)
      }
      if (cancelled) return
      const c = canvasRef.current
      if (c) {
        try {
          historyRef.current = [c.toDataURL("image/png")]
          setHistIndex(0)
          setHistLen(1)
        } catch {
          // A cross-origin image served without CORS taints the canvas, so
          // toDataURL throws. Keep the editor usable for viewing + metadata
          // instead of hanging forever at "not ready"; pixel edits just can't
          // be snapshotted/exported until the source sends CORS headers.
          historyRef.current = []
          setHistIndex(0)
          setHistLen(0)
        }
      }
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const undo = async () => {
    if (histIndex <= 0) return
    const i = histIndex - 1
    setHistIndex(i)
    await paint(historyRef.current[i])
  }
  const redo = async () => {
    if (histIndex >= histLen - 1) return
    const i = histIndex + 1
    setHistIndex(i)
    await paint(historyRef.current[i])
  }

  // Produce a fresh dataURL from an offscreen transform, repaint, push.
  const applyTransform = useCallback(
    (build: (src: HTMLCanvasElement) => HTMLCanvasElement) => {
      const c = canvasRef.current
      if (!c) return
      const out = build(c)
      const url = out.toDataURL("image/png")
      void paint(url).then(() => pushFrame(url))
    },
    [paint, pushFrame],
  )

  const rotate = (deg: 90 | -90) =>
    applyTransform((src) => {
      const out = document.createElement("canvas")
      out.width = src.height
      out.height = src.width
      const ctx = out.getContext("2d")!
      ctx.translate(out.width / 2, out.height / 2)
      ctx.rotate((deg * Math.PI) / 180)
      ctx.drawImage(src, -src.width / 2, -src.height / 2)
      return out
    })

  const flip = (axis: "h" | "v") =>
    applyTransform((src) => {
      const out = document.createElement("canvas")
      out.width = src.width
      out.height = src.height
      const ctx = out.getContext("2d")!
      ctx.translate(axis === "h" ? out.width : 0, axis === "v" ? out.height : 0)
      ctx.scale(axis === "h" ? -1 : 1, axis === "v" ? -1 : 1)
      ctx.drawImage(src, 0, 0)
      return out
    })

  // ─── Save ───────────────────────────────────────────────────────────────
  const buildAltMap = (): ProductImageValue["alt"] => {
    const t = alt.trim()
    return t ? { ...(media.alt ?? {}), en: t } : media.alt
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const pixelEdited = histIndex > 0
      let next: EditorMedia = {
        ...media,
        alt: buildAltMap(),
        focal_point: focal ?? undefined,
      }

      const finalName = (name ?? detail?.original_name ?? "").trim()

      if (pixelEdited) {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvasRef.current?.toBlob((b) => resolve(b), "image/jpeg", 0.92),
        )
        if (blob) {
          const file = new File([blob], `${finalName || "edited"}.jpg`, {
            type: "image/jpeg",
          })
          const [uploaded] = await uploadFiles([file])
          if (uploaded) {
            next = {
              ...next,
              id: uploaded.id,
              original: uploaded.original,
              thumbnail: uploaded.thumbnail,
            }
          }
        }
      }

      if (finalName && next.id) {
        await renameAttachment({
          variables: { id: next.id, name: finalName },
        }).catch(() => null)
      }

      onSave(next)
    } finally {
      setSaving(false)
    }
  }

  // Render the current canvas (edits included) to a File. Encodes in the
  // requested MIME when the canvas supports it (jpeg/png/webp), else JPEG —
  // so an in-place replace can preserve the original's type.
  const exportFile = useCallback(
    async (mime: string): Promise<File | null> => {
      const c = canvasRef.current
      if (!c) return null
      const type = ["image/jpeg", "image/png", "image/webp"].includes(mime)
        ? mime
        : "image/jpeg"
      const blob = await new Promise<Blob | null>((resolve) =>
        c.toBlob((b) => resolve(b), type, 0.92),
      )
      if (!blob) return null
      const finalName = (name ?? "").trim() || "image"
      const ext =
        type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg"
      return new File([blob], `${finalName}.${ext}`, { type })
    },
    [name],
  )

  // Drive a caller-supplied save action (savePlan). Builds the shared context,
  // closes on a truthy result, and always clears the busy flag. `detail` is
  // read at click time (post-render), so referencing it here is safe.
  const runSaveAction = async (action: EditorSaveAction) => {
    setSaving(true)
    try {
      const ok = await action.run({
        media: {
          ...media,
          alt: buildAltMap(),
          focal_point: focal ?? undefined,
        },
        name: (name ?? detail?.original_name ?? "").trim(),
        alt: alt.trim(),
        pixelEdited: histIndex > 0,
        exportFile,
      })
      if (ok) onClose()
    } finally {
      setSaving(false)
    }
  }

  // ─── Data: name/details + usage ─────────────────────────────────────────
  const { data: attData } = useQuery<AttachmentByIdResponse>(GET_ATTACHMENT, {
    variables: { id: media.id },
    skip: !media.id || !hydrated,
    fetchPolicy: "cache-first",
  })
  const { data: usageData } = useQuery<AttachmentUsageResponse>(
    GET_ATTACHMENT_USAGE,
    {
      variables: { url: media.original },
      skip: !hydrated,
      fetchPolicy: "cache-and-network",
    },
  )

  const [renameAttachment] = useMutation(RENAME_ATTACHMENT)

  const detail = attData?.attachment.data
  const effectiveName = name ?? detail?.original_name ?? ""
  const displayName =
    effectiveName || media.original.split("/").pop() || t("fallbackName")

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-neutral-100">
      {/* Top bar */}
      <header className="flex items-center gap-3 border-b border-neutral-800 px-4 py-2.5">
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
            aria-label={t("exit")}
          >
            <XIcon className="size-5" />
          </button>

          {/* Workspace switch — only meaningful when the host supplies an AI flow. */}
          {aiSection && (
            <div className="flex items-center gap-0.5 rounded-lg border border-neutral-800 bg-neutral-900 p-0.5">
              <ViewTab
                active={view === "edit"}
                disabled={aiPending}
                onClick={() => selectView("edit")}
                icon={<SlidersHorizontalIcon className="size-4" />}
                label={tc("edit")}
                title={aiPending ? t("editLocked") : t("editTitle")}
              />
              <ViewTab
                active={view === "ai"}
                accent
                onClick={() => selectView("ai")}
                icon={<SparklesIcon className="size-4" />}
                label={t("aiStudio")}
                title={t("aiStudioTitle")}
              />
            </div>
          )}
        </div>

        <span className="min-w-0 flex-1 truncate text-center text-sm font-medium">
          {displayName}
        </span>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={undo}
            disabled={histIndex <= 0}
            className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-30"
            aria-label={t("undo")}
          >
            <Undo2Icon className="size-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={histIndex >= histLen - 1}
            className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-30"
            aria-label={t("redo")}
          >
            <Redo2Icon className="size-4" />
          </button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            {t("discard")}
          </Button>
          {savePlan ? (
            <ButtonGroup>
              <Button
                type="button"
                size="sm"
                onClick={() => runSaveAction(savePlan.primary)}
                disabled={saving || uploading || !ready}
                className="rounded-lg rounded-e-none border-0 bg-white text-neutral-900 hover:bg-neutral-200"
              >
                {saving || uploading ? (
                  <Loader2Icon className="mr-1 size-4 animate-spin" />
                ) : null}
                {savePlan.primary.label}
              </Button>
              {savePlan.secondary && (
                <>
                  <ButtonGroupSeparator className="bg-neutral-300" />
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          size="icon-sm"
                          disabled={saving || uploading || !ready}
                          aria-label={t("moreSaveOptions")}
                          className="rounded-lg rounded-e-lg! border-0 bg-white text-neutral-900 hover:bg-neutral-200"
                        />
                      }
                    >
                      <ChevronDownIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => runSaveAction(savePlan.secondary!)}
                      >
                        {savePlan.secondary.label}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </ButtonGroup>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving || uploading || !ready}
              className="bg-white text-neutral-900 hover:bg-neutral-200"
            >
              {saving || uploading ? (
                <Loader2Icon className="mr-1 size-4 animate-spin" />
              ) : null}
              {tc("save")}
            </Button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Canvas stage */}
        <div
          ref={wrapRef}
          className="relative flex flex-1 items-center justify-center overflow-hidden p-6"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        >
          {!ready && (
            <Loader2Icon className="absolute size-8 animate-spin text-neutral-500" />
          )}
          {stageOverlay}
          <div className={stageOverlay ? "hidden" : "contents"}>
            <CanvasStage
              canvasRef={canvasRef}
              dims={dims}
              tool={canvasTool}
              focal={focal}
              setFocal={setFocal}
              onDrawCommit={() => {
                const c = canvasRef.current
                if (c) pushFrame(c.toDataURL("image/png"))
              }}
              drawColor={drawColorRef}
              drawSize={drawSizeRef}
              cropRef={cropRef}
              onCropApply={(rect) =>
                applyTransform((src) => {
                  const out = document.createElement("canvas")
                  out.width = Math.max(1, Math.round(rect.w))
                  out.height = Math.max(1, Math.round(rect.h))
                  const ctx = out.getContext("2d")!
                  ctx.drawImage(
                    src,
                    rect.x, rect.y, rect.w, rect.h,
                    0, 0, rect.w, rect.h,
                  )
                  return out
                })
              }
            />
          </div>
        </div>

        {/* Right rail — one workspace at a time, never both. */}
        <aside className="flex w-85 shrink-0 flex-col overflow-hidden border-l border-neutral-800 bg-neutral-900/60">
          {view === "ai" ? (
            <>
              <div className="flex shrink-0 items-center gap-2.5 border-b border-neutral-800 px-4 py-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-violet-600/15 text-violet-300">
                  <SparklesIcon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-100">
                    {t("aiStudio")}
                  </p>
                  <p className="truncate text-xs text-neutral-400">
                    {t("aiStudioSubtitle")}
                  </p>
                </div>
              </div>
              {/* Unpadded on purpose: the AI body owns its own spacing so it
                  can pin a footer action flush to the bottom of the scroller. */}
              <div className="min-h-0 flex-1 overflow-y-auto">{aiSection}</div>
            </>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <Section
                icon={<InfoIcon className="size-4" />}
                title={t("section.info")}
                open={tool === "info"}
                onToggle={() => setTool("info")}
              >
                <InfoPanel
                  name={effectiveName}
                  onName={setName}
                  alt={alt}
                  onAlt={setAlt}
                  url={media.original}
                  format={detail?.mime_type?.split("/")[1]?.toUpperCase()}
                  size={detail?.size}
                  dims={dims}
                  createdAt={detail?.created_at}
                  usage={usageData?.attachmentUsage}
                />
              </Section>

              <Section
                icon={<CropIcon className="size-4" />}
                title={t("section.crop")}
                open={tool === "crop"}
                onToggle={() => setTool(tool === "crop" ? "info" : "crop")}
              >
                <CropPanel
                  cropRef={cropRef}
                  onRotate={rotate}
                  onFlip={flip}
                  onApply={() => cropRef.current?.apply?.()}
                />
              </Section>

              <Section
                icon={<Maximize2Icon className="size-4" />}
                title={t("section.resize")}
                open={tool === "resize"}
                onToggle={() => setTool(tool === "resize" ? "info" : "resize")}
              >
                <ResizePanel
                  key={`${dims.w}x${dims.h}`}
                  dims={dims}
                  onApply={(w, h) =>
                    applyTransform((src) => {
                      const out = document.createElement("canvas")
                      out.width = w
                      out.height = h
                      const ctx = out.getContext("2d")!
                      ctx.imageSmoothingQuality = "high"
                      ctx.drawImage(src, 0, 0, w, h)
                      return out
                    })
                  }
                />
              </Section>

              <Section
                icon={<PencilIcon className="size-4" />}
                title={t("section.draw")}
                open={tool === "draw"}
                onToggle={() => setTool(tool === "draw" ? "info" : "draw")}
              >
                <DrawPanel colorRef={drawColorRef} sizeRef={drawSizeRef} />
              </Section>

              <Section
                icon={<CrosshairIcon className="size-4" />}
                title={t("section.focal")}
                open={tool === "focal"}
                onToggle={() => setTool(tool === "focal" ? "info" : "focal")}
              >
                <p className="text-xs text-neutral-400">
                  {t("focalHint")}
                  {focal && (
                    <>
                      {" "}
                      {t("focalCurrent", {
                        x: Math.round(focal.x * 100),
                        y: Math.round(focal.y * 100),
                      })}
                    </>
                  )}
                </p>
                {focal && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFocal(null)}
                    className="mt-2 text-neutral-300 hover:bg-neutral-800"
                  >
                    {t("resetFocal")}
                  </Button>
                )}
              </Section>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

// ─── Header workspace switch ─────────────────────────────────────────────────
/**
 * One segment of the header's Edit / AI Studio switch. A plain toggle button
 * (`aria-pressed`) rather than a tab — the rail it reveals is a working panel,
 * not a passive tabpanel, and toggle semantics don't promise arrow-key
 * navigation the switch doesn't implement.
 */
function ViewTab({
  active,
  accent,
  disabled,
  onClick,
  icon,
  label,
  title,
}: {
  active: boolean
  /** Tint the active state violet — reserved for the AI workspace. */
  accent?: boolean
  disabled?: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={title}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
        active
          ? accent
            ? "bg-violet-600/20 text-violet-200"
            : "bg-neutral-800 text-neutral-100"
          : "text-neutral-400 hover:text-neutral-200",
        disabled && "cursor-not-allowed opacity-40 hover:text-neutral-400",
      )}
    >
      {icon}
      {label}
    </button>
  )
}

// ─── Collapsible section ─────────────────────────────────────────────────────
function Section({
  icon,
  title,
  open,
  onToggle,
  children,
}: {
  icon: React.ReactNode
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="mb-2 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3.5 py-3 text-left text-sm font-medium hover:bg-neutral-800/50"
      >
        <span className="flex items-center gap-2.5 text-neutral-200">
          {icon}
          {title}
        </span>
        <ChevronDownIcon
          className={cn(
            "size-4 text-neutral-500 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && <div className="border-t border-neutral-800 p-3.5">{children}</div>}
    </div>
  )
}

// ─── Information panel ────────────────────────────────────────────────────────
function InfoPanel({
  name,
  onName,
  alt,
  onAlt,
  url,
  format,
  size,
  dims,
  createdAt,
  usage,
}: {
  name: string
  onName: (v: string) => void
  alt: string
  onAlt: (v: string) => void
  url: string
  format?: string
  size?: number
  dims: { w: number; h: number }
  createdAt?: string
  usage?: { count: number; product_names: string[] }
}) {
  const t = useTranslations("products.imageEditor")
  const locale = useLocale()
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [suggest, { loading }] = useMutation<SuggestAltResponse>(
    SUGGEST_ATTACHMENT_ALT,
  )

  const runSuggest = async () => {
    setSuggestion(null)
    const res = await suggest({ variables: { url, lang: "en" } }).catch(
      () => null,
    )
    const s = res?.data?.suggestAttachmentAlt.alt
    if (s) setSuggestion(s)
  }

  const humanSize =
    size != null
      ? size >= 1024 * 1024
        ? `${(size / (1024 * 1024)).toFixed(2)} MB`
        : `${Math.round(size / 1024)} kB`
      : null
  const date = createdAt
    ? new Date(createdAt).toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null
  // The first few product names, in the locale's own list punctuation; an
  // ellipsis marks the ones left out.
  const usedInNames =
    usage && usage.product_names.length
      ? new Intl.ListFormat(locale, { style: "short", type: "unit" }).format(
          usage.product_names.slice(0, 3),
        ) + (usage.count > 3 ? "…" : "")
      : ""

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-xs font-medium text-neutral-300">
        {t("name")}
        <Input
          value={name}
          onChange={(e) => onName(e.target.value)}
          className="h-9 border-neutral-700 bg-neutral-950 text-sm text-neutral-100"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-neutral-300">{t("altText")}</span>
          <button
            type="button"
            onClick={runSuggest}
            disabled={loading}
            className="inline-flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 disabled:opacity-50"
          >
            {loading ? (
              <Loader2Icon className="size-3 animate-spin" />
            ) : (
              <SparklesIcon className="size-3" />
            )}
            {t("suggestAlt")}
          </button>
        </div>
        <textarea
          value={alt}
          onChange={(e) => onAlt(e.target.value)}
          rows={3}
          placeholder={t("altPlaceholder")}
          className="w-full resize-none rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500"
        />
        {suggestion && (
          <div className="rounded-lg bg-violet-600/90 p-3 text-sm text-white">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide opacity-90">
                {t("suggestion")}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onAlt(suggestion)
                    setSuggestion(null)
                  }}
                  className="rounded p-0.5 hover:bg-white/20"
                  aria-label={t("useSuggestion")}
                >
                  <CheckIcon className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setSuggestion(null)}
                  className="rounded p-0.5 hover:bg-white/20"
                  aria-label={t("dismissSuggestion")}
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            </div>
            {suggestion}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-neutral-300">{t("details")}</span>
        <p className="text-xs text-neutral-400">
          {[format, dims.w && dims.h ? `${dims.w} × ${dims.h}` : null, humanSize]
            .filter(Boolean)
            .join(" • ")}
        </p>
        {date && (
          <p className="text-xs text-neutral-500">{t("added", { date })}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-neutral-300">{t("usedIn")}</span>
        {usage && usage.count > 0 ? (
          <p className="text-xs text-neutral-400">
            {usedInNames
              ? t("usedInNamed", { count: usage.count, names: usedInNames })
              : t("usedInCount", { count: usage.count })}
          </p>
        ) : (
          <p className="text-xs text-neutral-500">{t("notReferenced")}</p>
        )}
      </div>
    </div>
  )
}

// ─── Crop / transform panel ──────────────────────────────────────────────────
function CropPanel({
  cropRef,
  onRotate,
  onFlip,
  onApply,
}: {
  cropRef: React.MutableRefObject<{ apply?: () => void; setRatio?: (r: number | null) => void } | null>
  onRotate: (deg: 90 | -90) => void
  onFlip: (axis: "h" | "v") => void
  onApply: () => void
}) {
  const t = useTranslations("products.imageEditor")
  const [active, setActive] = useState(0)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        {ASPECTS.map((a, i) => (
          <button
            key={a.id}
            type="button"
            onClick={() => {
              setActive(i)
              cropRef.current?.setRatio?.(a.ratio)
            }}
            className={cn(
              "flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-neutral-800",
              active === i && "bg-neutral-800",
            )}
          >
            <span>{a.labelKey ? t(`aspect.${a.labelKey}`) : a.id}</span>
            {active === i && <CheckIcon className="size-4 text-neutral-300" />}
          </button>
        ))}
      </div>
      <Button
        type="button"
        onClick={onApply}
        className="bg-neutral-800 text-neutral-100 hover:bg-neutral-700"
      >
        {t("applyCrop")}
      </Button>
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div>
          <p className="mb-1.5 text-xs text-neutral-400">{t("flip")}</p>
          <div className="flex gap-2">
            <IconBtn onClick={() => onFlip("h")} label={t("flipHorizontal")}>
              <FlipHorizontal2Icon className="size-4" />
            </IconBtn>
            <IconBtn onClick={() => onFlip("v")} label={t("flipVertical")}>
              <FlipVertical2Icon className="size-4" />
            </IconBtn>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs text-neutral-400">{t("rotate")}</p>
          <div className="flex gap-2">
            <IconBtn onClick={() => onRotate(-90)} label={t("rotateLeft")}>
              <RotateCcwIcon className="size-4" />
            </IconBtn>
            <IconBtn onClick={() => onRotate(90)} label={t("rotateRight")}>
              <RotateCwIcon className="size-4" />
            </IconBtn>
          </div>
        </div>
      </div>
    </div>
  )
}

function IconBtn({
  onClick,
  label,
  children,
}: {
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-9 flex-1 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-950 text-neutral-200 hover:bg-neutral-800"
    >
      {children}
    </button>
  )
}

// ─── Resize panel ────────────────────────────────────────────────────────────
function ResizePanel({
  dims,
  onApply,
}: {
  dims: { w: number; h: number }
  onApply: (w: number, h: number) => void
}) {
  const t = useTranslations("products.imageEditor")
  // Remounted (via a dims-based key at the call site) whenever the canvas
  // dimensions change, so these inputs re-seed from the current size without
  // a state-syncing effect.
  const [w, setW] = useState(dims.w)
  const [h, setH] = useState(dims.h)
  const [lock, setLock] = useState(true)
  const ratio = dims.w && dims.h ? dims.w / dims.h : 1

  const changed = w !== dims.w || h !== dims.h

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <label className="flex flex-1 items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-950 px-2.5">
          <span className="text-xs text-neutral-500">{t("width")}</span>
          <input
            type="number"
            value={w}
            onChange={(e) => {
              const nw = Math.max(1, Number(e.target.value) || 0)
              setW(nw)
              if (lock) setH(Math.round(nw / ratio))
            }}
            className="h-9 w-full bg-transparent text-sm text-neutral-100 outline-none"
          />
          <span className="text-xs text-neutral-500">px</span>
        </label>
        <button
          type="button"
          onClick={() => setLock((l) => !l)}
          className={cn(
            "rounded-md border border-neutral-700 p-2 text-neutral-400 hover:bg-neutral-800",
            lock && "text-violet-400",
          )}
          aria-label={t("lockAspect")}
        >
          <span className="text-[10px] font-bold">{lock ? "🔒" : "🔓"}</span>
        </button>
        <label className="flex flex-1 items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-950 px-2.5">
          <span className="text-xs text-neutral-500">{t("height")}</span>
          <input
            type="number"
            value={h}
            onChange={(e) => {
              const nh = Math.max(1, Number(e.target.value) || 0)
              setH(nh)
              if (lock) setW(Math.round(nh * ratio))
            }}
            className="h-9 w-full bg-transparent text-sm text-neutral-100 outline-none"
          />
          <span className="text-xs text-neutral-500">px</span>
        </label>
      </div>
      <Button
        type="button"
        disabled={!changed}
        onClick={() => onApply(w, h)}
        className="bg-neutral-800 text-neutral-100 hover:bg-neutral-700 disabled:opacity-40"
      >
        {t("apply")}
      </Button>
    </div>
  )
}

// ─── Draw panel ──────────────────────────────────────────────────────────────
function DrawPanel({
  colorRef,
  sizeRef,
}: {
  colorRef: React.MutableRefObject<string>
  sizeRef: React.MutableRefObject<number>
}) {
  const t = useTranslations("products.imageEditor")
  const [color, setColor] = useState(DEFAULT_DRAW_COLOR)
  const [size, setSize] = useState(DEFAULT_DRAW_SIZE)
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1.5 text-xs text-neutral-400">{t("colour")}</p>
        <div className="grid grid-cols-10 gap-1.5">
          {DRAW_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setColor(c)
                colorRef.current = c
              }}
              className={cn(
                "aspect-square rounded-md ring-1 ring-white/10",
                color === c && "ring-2 ring-white",
              )}
              style={{ backgroundColor: c }}
              aria-label={t("colourSwatch", { color: c })}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs text-neutral-400">{t("brushSize", { size })}</p>
        <input
          type="range"
          min={2}
          max={48}
          value={size}
          onChange={(e) => {
            const s = Number(e.target.value)
            setSize(s)
            sizeRef.current = s
          }}
          className="w-full accent-violet-500"
        />
      </div>
      <p className="text-xs text-neutral-500">{t("drawHint")}</p>
    </div>
  )
}

// ─── Interactive canvas stage ─────────────────────────────────────────────────
type Rect = { x: number; y: number; w: number; h: number }

function CanvasStage({
  canvasRef,
  dims,
  tool,
  focal,
  setFocal,
  onDrawCommit,
  drawColor,
  drawSize,
  cropRef,
  onCropApply,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  dims: { w: number; h: number }
  /** `null` in the AI workspace — the canvas is display-only there. */
  tool: Tool | null
  focal: FocalPoint | null
  setFocal: (f: FocalPoint) => void
  onDrawCommit: () => void
  drawColor: React.MutableRefObject<string>
  drawSize: React.MutableRefObject<number>
  cropRef: React.MutableRefObject<{
    apply?: () => void
    setRatio?: (r: number | null) => void
  } | null>
  onCropApply: (rect: Rect) => void
}) {
  const drawing = useRef(false)
  const [crop, setCrop] = useState<Rect | null>(null)
  const ratioRef = useRef<number | null>(null)

  // Map a pointer event to natural canvas coordinates.
  const toCanvas = (e: React.PointerEvent) => {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    const sx = c.width / r.width
    const sy = c.height / r.height
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy }
  }

  // Crop bootstrap when entering crop mode / choosing a ratio.
  const initCrop = useCallback(
    (ratio: number | null) => {
      ratioRef.current = ratio
      const { w, h } = dims
      if (!w || !h) return
      if (ratio === null || ratio === 0) {
        // Original / freeform → 90% box centered.
        const cw = w * 0.9
        const ch = ratio === null ? h * 0.9 : h * 0.9
        setCrop({ x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch })
        return
      }
      let cw = w * 0.9
      let ch = cw / ratio
      if (ch > h * 0.9) {
        ch = h * 0.9
        cw = ch * ratio
      }
      setCrop({ x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch })
    },
    [dims],
  )

  useEffect(() => {
    if (tool === "crop") initCrop(ratioRef.current)
    else setCrop(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, dims.w, dims.h])

  // Expose apply/setRatio to the panel via the shared ref.
  useEffect(() => {
    cropRef.current = {
      apply: () => {
        if (crop) onCropApply(crop)
      },
      setRatio: (r) => initCrop(r),
    }
  }, [crop, cropRef, initCrop, onCropApply])

  // ── Pointer handlers ──
  const onPointerDown = (e: React.PointerEvent) => {
    if (tool === "draw") {
      drawing.current = true
      const ctx = canvasRef.current!.getContext("2d")!
      const p = toCanvas(e)
      ctx.strokeStyle = drawColor.current
      ctx.lineWidth = drawSize.current
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ;(e.target as Element).setPointerCapture(e.pointerId)
    } else if (tool === "focal") {
      const c = canvasRef.current!
      const p = toCanvas(e)
      setFocal({ x: clamp01(p.x / c.width), y: clamp01(p.y / c.height) })
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (tool === "draw" && drawing.current) {
      const ctx = canvasRef.current!.getContext("2d")!
      const p = toCanvas(e)
      ctx.lineTo(p.x, p.y)
      ctx.stroke()
    }
  }

  const onPointerUp = () => {
    if (tool === "draw" && drawing.current) {
      drawing.current = false
      onDrawCommit()
    }
  }

  // Crop rect drag (move) — natural-coord delta.
  const dragCrop = (e: React.PointerEvent) => {
    if (!crop) return
    const start = toCanvas(e)
    const orig = { ...crop }
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      const c = canvasRef.current!
      const r = c.getBoundingClientRect()
      const nx = orig.x + (ev.clientX - (r.left + (start.x * r.width) / c.width)) * (c.width / r.width)
      const ny = orig.y + (ev.clientY - (r.top + (start.y * r.height) / c.height)) * (c.height / r.height)
      setCrop({
        ...orig,
        x: Math.min(Math.max(0, nx), c.width - orig.w),
        y: Math.min(Math.max(0, ny), c.height - orig.h),
      })
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  const cursor =
    tool === "draw" || tool === "focal" ? "crosshair" : "default"

  return (
    <div className="relative max-h-full max-w-full">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="max-h-[calc(100vh-9rem)] max-w-full rounded-md object-contain shadow-2xl"
        style={{ cursor, touchAction: "none" }}
      />

      {/* Crop overlay */}
      {tool === "crop" && crop && dims.w > 0 && (
        <div className="pointer-events-none absolute inset-0">
          <CropOverlay dims={dims} crop={crop} onDrag={dragCrop} />
        </div>
      )}

      {/* Focal marker */}
      {focal && (tool === "focal" || tool === "info") && (
        <div
          className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-violet-500/70 shadow"
          style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%` }}
        />
      )}
    </div>
  )
}

function CropOverlay({
  dims,
  crop,
  onDrag,
}: {
  dims: { w: number; h: number }
  crop: Rect
  onDrag: (e: React.PointerEvent) => void
}) {
  if (!dims.w || !dims.h) return null
  const pct = (v: number, total: number) => `${(v / total) * 100}%`
  return (
    <div
      className="pointer-events-auto absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"
      onPointerDown={onDrag}
      style={{
        left: pct(crop.x, dims.w),
        top: pct(crop.y, dims.h),
        width: pct(crop.w, dims.w),
        height: pct(crop.h, dims.h),
      }}
    >
      <span className="absolute -left-0.5 -top-0.5 size-2 bg-white" />
      <span className="absolute -right-0.5 -top-0.5 size-2 bg-white" />
      <span className="absolute -bottom-0.5 -left-0.5 size-2 bg-white" />
      <span className="absolute -bottom-0.5 -right-0.5 size-2 bg-white" />
    </div>
  )
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v))
}
