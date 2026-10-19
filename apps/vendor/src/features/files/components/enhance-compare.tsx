"use client"

import { useCallback, useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { ChevronsLeftRightIcon, Loader2Icon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { cn } from "@/shared/lib/utils"
import {
  logicalPos,
  posForKey,
  revealClip,
} from "@/features/files/lib/compare-geometry"

/**
 * Before/after review of an AI enhance, opened as an overlay from the enhanced
 * original's node on the {@link EnhanceCanvas}. A draggable divider wipes
 * between the original and the enhanced result — the standard compare idiom in
 * pro image tools, and the reason only the `enhance` shot offers it: it is the
 * one output framed like the source. The enhanced copy already exists as its
 * own attachment, so everything here decides what happens to a file that is
 * already safely in the library.
 *
 * **`pos` is logical, not physical**: it is how much of the original is revealed
 * measured from the *inline-start* edge, so the original sits on the left in
 * English and on the right in Arabic and the gesture reads the same either way.
 * Everything that touches an axis converts at the boundary — pointer maths, the
 * clip, the divider offset and the arrow keys — because a wipe built on `left:`
 * and `ArrowLeft` inverts under RTL and the drag fights the pointer.
 *
 * Styled with the editor's hardcoded dark palette (neutral-*), not semantic
 * tokens — it always sits on the editor's dark stage.
 */
export function EnhanceCompare({
  originalUrl,
  enhancedUrl,
  name,
  busy,
  keepLabel,
  onReplace,
  onKeepBoth,
  onDiscard,
}: {
  originalUrl: string
  enhancedUrl: string
  name: string
  busy: "replace" | "discard" | null
  /**
   * Label for the middle action. Defaults to "Keep both", which is what the
   * choice means when this *is* the review; the canvas overrides it to "Close"
   * because there the wipe is a lens over a review that stays open behind it.
   */
  keepLabel?: string
  onReplace: () => void
  onKeepBoth: () => void
  onDiscard: () => void
}) {
  const t = useTranslations("aiStudio")
  const rtl = useLocale() === "ar"
  const boxRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(50)

  const posFromClientX = useCallback(
    (clientX: number) => {
      const box = boxRef.current
      if (!box) return
      setPos(logicalPos(clientX, box.getBoundingClientRect(), rtl))
    },
    [rtl],
  )

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault()
    posFromClientX(e.clientX)
    const move = (ev: PointerEvent) => posFromClientX(ev.clientX)
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const next = posForKey(e.key, pos, rtl)
    if (next === null) return
    setPos(next)
    e.preventDefault()
  }

  return (
    <div className="flex max-h-full max-w-full flex-col items-center gap-3">
      <div
        ref={boxRef}
        onPointerDown={startDrag}
        className="relative max-w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-md shadow-2xl"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={enhancedUrl}
          alt={t("compare.altEnhanced", { name })}
          draggable={false}
          className="block max-h-[calc(100vh-13rem)] max-w-full object-contain"
        />
        <div
          className="absolute inset-0"
          style={{ clipPath: revealClip(pos, rtl) }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={originalUrl}
            alt={t("compare.altOriginal", { name })}
            draggable={false}
            className="size-full bg-neutral-900 object-contain"
          />
        </div>

        <span className="pointer-events-none absolute start-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
          {t("compare.original")}
        </span>
        <span className="pointer-events-none absolute end-2 top-2 rounded-full bg-violet-600/90 px-2 py-0.5 text-[11px] font-medium text-white">
          {t("compare.enhanced")}
        </span>

        <div
          role="slider"
          aria-label={t("compare.sliderAria")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          aria-valuetext={t("compare.sliderValue", { percent: Math.round(pos) })}
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="absolute inset-y-0 z-10 w-0.5 bg-white/90 outline-none"
          style={{ insetInlineStart: `${pos}%` }}
        >
          <span className="absolute left-1/2 top-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-neutral-900/90 text-white shadow-lg">
            <ChevronsLeftRightIcon className="size-4" />
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDiscard}
          disabled={busy !== null}
          className="text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
        >
          {busy === "discard" && <Loader2Icon className="size-4 animate-spin" />}
          {t("discard")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onKeepBoth}
          disabled={busy !== null}
          className={cn(
            "border-neutral-700 bg-transparent text-neutral-200",
            "hover:bg-neutral-800 hover:text-white",
          )}
        >
          {keepLabel ?? t("keepBoth")}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onReplace}
          disabled={busy !== null}
          className="bg-white text-neutral-900 hover:bg-neutral-200"
        >
          {busy === "replace" && <Loader2Icon className="size-4 animate-spin" />}
          {t("replaceOriginal")}
        </Button>
      </div>
    </div>
  )
}
