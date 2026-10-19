"use client"

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import {
  AlertCircleIcon,
  ColumnsIcon,
  DownloadIcon,
  Loader2Icon,
  MaximizeIcon,
  MinusIcon,
  PlusIcon,
  RefreshCwIcon,
  ReplaceIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { ShiningText } from "@repo/ui/components/shining-text"
import { cn } from "@/shared/lib/utils"
import {
  GET_ENHANCE_STYLES,
  type EnhanceStylesResponse,
} from "@/features/files/api/queries"
import { nodeKey, type ShotRun } from "@/features/files/lib/use-enhance-file"
import { isTerminal } from "@/features/products/api/ai-image"
import {
  ZOOM_STEP,
  boundsOf,
  edgePath,
  fitViewport,
  layoutClusters,
  nudgeForKey,
  withOffset,
  zoomAt,
  type Box,
  type Viewport,
} from "@/features/files/lib/enhance-graph"
import { EnhanceCompare } from "./enhance-compare"

/**
 * The AI Studio review, rendered as a free canvas on the image editor's stage.
 *
 * The source image is a node that stays put, and every shot the run produces
 * hangs off it on an arrow — so the vendor watches the outputs branch out of
 * their photo instead of watching their photo be replaced by a strip of
 * thumbnails. Shot nodes appear the moment the run starts, as pending
 * placeholders on dashed arrows, and fill in as each generation settles; a shot
 * that fails keeps its node and its arrow and shows why, because a card that
 * vanishes reads as an image that was never requested.
 *
 * The canvas is free in the literal sense: drag the background to pan, wheel to
 * zoom at the cursor, drag any node to rearrange, arrow-keys to nudge the
 * focused one, and a fit button to bring everything back. Nothing here is
 * destructive — every result is already its own attachment in the library by
 * the time this renders, so the actions on a node prune and promote rather than
 * decide whether an image survives.
 *
 * **The `enhance` shot is the only one comparable to the source** — same frame,
 * same angle, new background — so it alone offers the wipe slider, opened as an
 * overlay. Every other shot is a different crop of a different scene, where a
 * before/after divider would compare nothing.
 *
 * Two layout rules this component has to keep straight:
 *
 *   - **The graph axis is content, so it never mirrors.** The viewport subtree
 *     is pinned `dir="ltr"` to keep the app's global `dir="rtl"` out, and nodes
 *     are placed with physical `left`/`top`. The chrome around the viewport —
 *     toolbar, overlay, badges — is ordinary UI and flips as usual, and the
 *     localized text inside the nodes re-asserts the app's direction.
 *   - **It is styled with the editor's hardcoded dark palette** (`neutral-*`),
 *     not semantic tokens: it always sits on the editor's forced-dark stage.
 */
export function EnhanceCanvas({
  runs,
  sources,
  busy,
  onReplace,
  onDone,
  onCancelRun,
  onUseAsSource,
  onRerunShot,
  onDiscardShot,
}: {
  runs: ShotRun[]
  /**
   * The images the run started from — one for a single-file run, N for a batch
   * fired from the library's selection. Each gets its own cluster, so an arrow
   * never crosses from one source's outputs to another's.
   */
  sources: { id: string; url: string; original_name: string }[]
  /**
   * Which node has an action in flight, keyed by {@link nodeKey}, so only that
   * node spins. Not the shot id: four variations share one, and the spinner
   * would appear on all four.
   */
  busy: { kind: "replace" | "discard"; key: string } | null
  /** Promote the enhanced original over the source file. */
  onReplace: () => void
  /** Keep everything and close the review. */
  onDone: () => void
  /**
   * Stop the shots that have not landed yet. Offered only while some shot is
   * still pending — once everything is terminal there is nothing to stop, and
   * Done is the action that closes the review.
   */
  onCancelRun: () => void
  /**
   * Open this shot's output as the studio's next subject.
   *
   * Every result is already a real attachment, so "enhance the enhanced one"
   * needs no new backend concept — only a route. Without it the vendor's only
   * path to a second pass was to close the editor, find the generated row in a
   * paginated library and open it again, which is enough friction that the
   * feature effectively did not exist.
   */
  onUseAsSource: (run: ShotRun) => void
  /**
   * Generate this one node again on the same settings. Offered on failed nodes
   * too — a shot that timed out is the single most likely thing a vendor wants
   * to retry, and the run's settings are still known.
   */
  onRerunShot: (run: ShotRun) => void
  /** Delete one shot's generated attachment. */
  onDiscardShot: (run: ShotRun) => void
}) {
  const t = useTranslations("aiStudio")
  const dir = useLocale() === "ar" ? "rtl" : "ltr"
  // `useId` wraps its value in punctuation (`:r0:` / `«r0»` depending on the
  // React version) that has no business inside an SVG `url(#…)` reference —
  // strip it to bare word characters so the arrowheads resolve either way.
  const markerId = `edge${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  const { data } = useQuery<EnhanceStylesResponse>(GET_ENHANCE_STYLES)
  // Shot names are localized server-side by the registry, so they need no key
  // here — only the chrome around them does.
  const shotName = (id: string) =>
    data?.enhanceStyles?.shots?.find((s) => s.id === id)?.name ?? id
  /** The file a node branches off, for its alt text and download filename. */
  const sourceName = (run: ShotRun) =>
    sources.find((s) => s.id === run.sourceId)?.original_name ?? ""

  const stageRef = useRef<HTMLDivElement>(null)
  const closeCompareRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const fittedRef = useRef(false)
  /** The pointer currently driving a pan or a node drag, if any. */
  const dragPointerRef = useRef<number | null>(null)
  const [view, setView] = useState<Viewport>({ scale: 1, tx: 0, ty: 0 })
  // A drag reads the zoom at apply time, not at pointerdown: the wheel keeps
  // firing during a drag (pointer capture does not redirect it), and a stale
  // scale would make the node track the cursor at the wrong rate from then on.
  const viewRef = useRef(view)
  useEffect(() => {
    viewRef.current = view
  }, [view])
  /** Per-node drag offsets in world units, keyed by shot id (or `source`). */
  const [offsets, setOffsets] = useState<
    Record<string, { dx: number; dy: number }>
  >({})
  const [focused, setFocused] = useState<string | null>(null)
  const [comparing, setComparing] = useState(false)
  /** The shot whose download is being fetched, so only its button spins. */
  const [downloading, setDownloading] = useState<string | null>(null)

  /**
   * Save one result to the vendor's machine.
   *
   * Goes through `fetch` + a blob URL rather than a bare `<a download>`,
   * because `download` is ignored cross-origin: the CDN serves these on a
   * different host, so the plain anchor would navigate away from the editor —
   * abandoning a review that may still have unsettled shots in it — instead of
   * saving anything. The same-origin blob keeps the filename we choose, which
   * an inline `Content-Disposition` would otherwise decide for us.
   *
   * Falls back to opening the URL in a new tab if the fetch is refused (a CDN
   * without CORS): a new tab is a worse save but it is not a lost review, and
   * this is exactly the configuration the editor's own pixel export already
   * degrades on.
   */
  const download = async (run: ShotRun) => {
    if (!run.result || downloading) return
    setDownloading(nodeKey(run))
    // Named after the node's own source, not "the" source: on a batch the file
    // names are the only thing telling twenty downloads apart.
    const base = sourceName(run).replace(/\.[^.]+$/, "")
    const filename = `${base}-${run.shot}.webp`
    try {
      const res = await fetch(run.result.url, { mode: "cors" })
      if (!res.ok) throw new Error(String(res.status))
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      window.open(run.result.url, "_blank", "noopener")
    } finally {
      setDownloading(null)
    }
  }

  // Compare and Replace promote one output over *the* source file, so both are
  // only meaningful when the run has exactly one. On a batch there is no "the
  // original" to replace, and offering it on twenty clusters would ask the
  // vendor which of twenty photos they meant.
  const single = sources.length === 1
  const enhanceRun = single ? runs.find((r) => r.shot === "enhance") : undefined
  const settling = runs.some((r) => !r.result && !r.error)

  /**
   * Layout slots, frozen at mount so the graph never rearranges under the
   * vendor: discarding a card leaves every survivor exactly where it was, and
   * re-rolling one leaves it in its own place.
   *
   * Keyed by {@link nodeKey} rather than by generation id, which is what made
   * re-rolling break: a re-roll mints a new generation, that id matched no
   * frozen slot, and the node fell through to the source's box — landing on top
   * of the source image.
   */
  const [slots] = useState(() =>
    sources.map((s) => ({
      id: s.id,
      nodes: runs.filter((r) => r.sourceId === s.id).map(nodeKey),
    })),
  )
  const clusters = useMemo(
    () => layoutClusters(slots.map((s) => s.nodes.length)),
    [slots],
  )
  const boxes = useMemo(() => {
    const at = (key: string, box: Box) => {
      const o = offsets[key]
      return withOffset(box, o?.dx, o?.dy)
    }
    const sourceBoxes = slots.map((s, i) =>
      at(`src:${s.id}`, clusters[i]?.source ?? { x: 0, y: 0, w: 0, h: 0 }),
    )
    return {
      sources: sourceBoxes,
      shots: runs.map((r) => {
        const ci = slots.findIndex((s) => s.id === r.sourceId)
        const si = ci >= 0 ? slots[ci]!.nodes.indexOf(nodeKey(r)) : -1
        const fallback = sourceBoxes[ci >= 0 ? ci : 0]!
        return at(nodeKey(r), clusters[ci]?.shots[si] ?? fallback)
      }),
      /** The source box a given run branches off, for its arrow. */
      sourceOf: (r: ShotRun) => {
        const ci = slots.findIndex((s) => s.id === r.sourceId)
        return sourceBoxes[ci >= 0 ? ci : 0]!
      },
    }
  }, [clusters, runs, slots, offsets])

  const allBoxes = useMemo(
    () => [...boxes.sources, ...boxes.shots],
    [boxes],
  )

  const fit = useCallback(() => {
    const el = stageRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setView(fitViewport(boundsOf(allBoxes), width, height))
  }, [allBoxes])

  // Measure the stage ourselves — the editor never does, and it hands over an
  // `overflow-hidden` box with no scrollbars, so the graph has to be framed to
  // fit rather than allowed to spill. The first non-zero measurement is what
  // triggers the opening fit; later resizes leave the vendor's own framing
  // alone, and so does discarding a shot.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const box = entry?.contentRect
      if (!box || box.width <= 0 || fittedRef.current) return
      fittedRef.current = true
      setView(fitViewport(boundsOf(allBoxes), box.width, box.height))
    })
    ro.observe(el)
    return () => ro.disconnect()
    // Opening fit only — `boxes` is read once, at the first measurement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // React attaches `wheel` passively at the root, so `preventDefault` inside an
  // `onWheel` prop is a no-op and ctrl+wheel would zoom the whole page. The
  // listener has to be registered by hand as non-passive.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      // Firefox reports line deltas and some setups report pages; normalize so
      // one detent zooms the same everywhere.
      const dy =
        e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY
      setView((v) =>
        zoomAt(
          v,
          Math.exp(-dy * 0.0018),
          e.clientX - rect.left,
          e.clientY - rect.top,
        ),
      )
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

  // The wipe is the one thing here that covers the canvas, so it owns focus
  // while it is up and hands it back when it closes. The host editor is a plain
  // div with no dialog primitive behind it, so there is nothing else to do this.
  useEffect(() => {
    if (!comparing) {
      returnFocusRef.current?.focus()
      returnFocusRef.current = null
      return
    }
    returnFocusRef.current = document.activeElement as HTMLElement | null
    closeCompareRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setComparing(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [comparing])

  /**
   * Shared pointer-drag loop. It captures the pointer rather than listening on
   * the window, so the drag survives the cursor leaving the element and the
   * grabbing cursor holds for the whole gesture without touching
   * `document.body`. `onMove` gets the delta since the previous event, so
   * nothing has to remember where the drag began.
   */
  const startDrag = (
    e: React.PointerEvent,
    onMove: (dx: number, dy: number) => void,
  ) => {
    // One gesture at a time. `setPointerCapture` is per-pointer, so a second
    // touch would otherwise start its own drag on the same element and every
    // delta would be applied twice.
    if (e.button !== 0 || dragPointerRef.current !== null) return
    dragPointerRef.current = e.pointerId
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    let last = { x: e.clientX, y: e.clientY }
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return
      onMove(ev.clientX - last.x, ev.clientY - last.y)
      last = { x: ev.clientX, y: ev.clientY }
    }
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return
      dragPointerRef.current = null
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerup", end)
      el.removeEventListener("pointercancel", end)
    }
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerup", end)
    el.addEventListener("pointercancel", end)
  }

  const startPan = (e: React.PointerEvent) => {
    setFocused(null)
    startDrag(e, (dx, dy) =>
      setView((v) => ({ ...v, tx: v.tx + dx, ty: v.ty + dy })),
    )
  }

  const startNodeDrag = (e: React.PointerEvent, key: string) => {
    e.stopPropagation()
    // Focus by hand, without scrolling: the keyboard nudge needs real DOM focus,
    // a pointerdown that starts a capture does not reliably move it, and the
    // stage is `overflow-hidden`, so a scroll-into-view would shift the box the
    // viewport maths is measured against and never scroll back.
    ;(e.currentTarget as HTMLElement).focus({ preventScroll: true })
    startDrag(e, (dx, dy) =>
      setOffsets((o) => {
        // Screen pixels → world units at the *current* zoom, so a wheel during
        // the drag doesn't desync the node from the cursor.
        const { scale } = viewRef.current
        const cur = o[key] ?? { dx: 0, dy: 0 }
        return {
          ...o,
          [key]: { dx: cur.dx + dx / scale, dy: cur.dy + dy / scale },
        }
      }),
    )
  }

  const onNodeKeyDown = (e: React.KeyboardEvent, key: string) => {
    // The wipe overlay covers the canvas; nudging a node the vendor cannot see
    // is not what an arrow key means while it is open.
    if (comparing) return
    const step = nudgeForKey(e.key)
    if (!step) return
    e.preventDefault()
    setOffsets((o) => {
      const cur = o[key] ?? { dx: 0, dy: 0 }
      return { ...o, [key]: { dx: cur.dx + step.dx, dy: cur.dy + step.dy } }
    })
  }

  const zoomByButton = (factor: number) => {
    const el = stageRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    // Buttons have no cursor to pin, so zoom about the middle of the stage.
    setView((v) => zoomAt(v, factor, width / 2, height / 2))
  }

  /** Node chrome shared by the source and every shot. */
  const nodeShell = (key: string, box: Box, label: string, className?: string) => ({
    tabIndex: 0,
    role: "group" as const,
    "aria-label": label,
    onPointerDown: (e: React.PointerEvent) => startNodeDrag(e, key),
    // Double-click is the canvas's fit gesture; on a node it would refit the
    // view out from under whoever was double-clicking the image.
    onDoubleClick: (e: React.MouseEvent) => e.stopPropagation(),
    onKeyDown: (e: React.KeyboardEvent) => onNodeKeyDown(e, key),
    onFocus: () => setFocused(key),
    // Functional so a node-to-node transfer (blur fires after the new focus)
    // cannot clear the ring that was just set.
    onBlur: () => setFocused((f) => (f === key ? null : f)),
    style: { left: box.x, top: box.y, width: box.w, height: box.h },
    className: cn(
      "absolute cursor-grab rounded-2xl outline-none transition-shadow active:cursor-grabbing",
      focused === key && "ring-2 ring-violet-500 ring-offset-2 ring-offset-neutral-950",
      className,
    ),
  })

  return (
    <div className="absolute inset-0 z-10 bg-neutral-950">
      {/* Viewport. Pinned LTR: the graph axis is content, so it must not flip
          with the interface. Its own dot grid replaces the editor's, which is
          painted on the container and would sit still while the graph moves. */}
      <div
        ref={stageRef}
        dir="ltr"
        onPointerDown={startPan}
        onDoubleClick={fit}
        role="group"
        aria-label={t("canvas.aria")}
        className="absolute inset-0 cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)",
          // Floored: an 18px grid at the 0.25 zoom floor is 4.5px, which stops
          // reading as a grid and starts reading as noise behind the images.
          backgroundSize: `${Math.max(12, 18 * view.scale)}px ${Math.max(12, 18 * view.scale)}px`,
          backgroundPosition: `${view.tx}px ${view.ty}px`,
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left will-change-transform"
          style={{
            transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
          }}
        >
          {/* Edges sit under the nodes and take no pointer events, so an arrow
              can never swallow a click meant for the canvas behind it. */}
          <svg
            aria-hidden
            width="1"
            height="1"
            className="pointer-events-none absolute left-0 top-0 overflow-visible"
          >
            <defs>
              {(
                [
                  ["done", "rgb(139 92 246)"],
                  ["pending", "rgb(115 115 115)"],
                  ["failed", "rgb(82 82 82)"],
                ] as const
              ).map(([state, color]) => (
                <marker
                  key={state}
                  id={`${markerId}-${state}`}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
                </marker>
              ))}
            </defs>
            {runs.map((run, i) => {
              const state = run.result
                ? "done"
                : run.error
                  ? "failed"
                  : "pending"
              const shot = boxes.shots[i]
              if (!shot) return null
              return (
                <path
                  // `nodeKey`, not `run.shot`: four variations share a shot id
                  // and a batch repeats it per source, so keying on it collapsed
                  // every sibling arrow into one.
                  key={nodeKey(run)}
                  d={edgePath(boxes.sourceOf(run), shot)}
                  fill="none"
                  strokeWidth={2.5}
                  // World-unit strokes would thin to sub-pixel at the zoom
                  // floor, which is exactly when the vendor is looking at the
                  // whole graph and most needs to see what connects to what.
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                  strokeDasharray={state === "done" ? undefined : "7 7"}
                  stroke={
                    state === "done"
                      ? "rgb(139 92 246 / 0.85)"
                      : state === "failed"
                        ? "rgb(82 82 82)"
                        : "rgb(115 115 115)"
                  }
                  markerEnd={`url(#${markerId}-${state})`}
                />
              )
            })}
          </svg>

          {/* ── One source node per cluster ── */}
          {slots.map((slot, i) => {
            const box = boxes.sources[i]
            const file = sources.find((s) => s.id === slot.id)
            if (!box || !file) return null
            return (
              <div
                key={slot.id}
                {...nodeShell(
                  `src:${slot.id}`,
                  box,
                  t("canvas.source"),
                )}
              >
                <div className="size-full overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-900 p-2 shadow-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={file.url}
                    alt={t("compare.altOriginal", {
                      name: file.original_name,
                    })}
                    draggable={false}
                    className="size-full rounded-xl object-contain"
                  />
                </div>
                {/* Physical `left`, not `start`: the badge is pinned to the
                    node's leading edge in the LTR-pinned world, and a `dir` on
                    the element would flip it to the opposite corner while the
                    graph did not. The direction goes on the text, which is the
                    part that needs it. */}
                <span className="absolute -top-3 left-3 flex max-w-[90%] items-center gap-1.5 rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] font-medium text-neutral-200 shadow">
                  <span dir={dir}>{t("canvas.source")}</span>
                  {/* Named only on a batch. With one source the label would be
                      the file the editor is already showing behind the canvas,
                      which says nothing; with twenty it is the only way to tell
                      the clusters apart. */}
                  {!single && (
                    <span
                      dir={dir}
                      className="truncate text-neutral-400"
                      title={file.original_name}
                    >
                      {file.original_name}
                    </span>
                  )}
                </span>
              </div>
            )
          })}

          {/* ── One node per shot ── */}
          {runs.map((run, i) => {
            const box = boxes.shots[i]
            if (!box) return null
            const label = shotName(run.shot)
            return (
              // `key` before the spread, not after: written after, the
              // transform cannot hoist it and it lands inside the props object,
              // which React 19 no longer reads a key from.
              <div
                key={nodeKey(run)}
                {...nodeShell(nodeKey(run), box, label)}
                aria-busy={!run.result && !run.error}
              >
                <div
                  className={cn(
                    "size-full overflow-hidden rounded-2xl border bg-neutral-900 shadow-2xl",
                    run.result
                      ? "border-violet-500/50"
                      : run.error
                        ? "border-neutral-700"
                        : "border-dashed border-neutral-600",
                  )}
                >
                  {run.result ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={run.result.url}
                        alt={t("altShot", { name: sourceName(run), shot: label })}
                        draggable={false}
                        className="size-full object-contain"
                      />
                      <div
                        onPointerDown={(e) => e.stopPropagation()}
                        className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-linear-to-t from-black/85 to-transparent p-2"
                      >
                        {single && run.shot === "enhance" && (
                          <>
                            <NodeAction
                              label={t("canvas.compare")}
                              disabled={busy !== null}
                              onClick={() => setComparing(true)}
                            >
                              <ColumnsIcon className="size-4" />
                            </NodeAction>
                            <NodeAction
                              label={t("replaceOriginal")}
                              disabled={busy !== null}
                              onClick={onReplace}
                            >
                              {busy?.kind === "replace" ? (
                                <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" />
                              ) : (
                                <ReplaceIcon className="size-4" />
                              )}
                            </NodeAction>
                          </>
                        )}
                        {/* Available on every successful shot, `enhance`
                            included: a second pass on an enhanced original is
                            as reasonable a next step as one on a social post,
                            and the result is an ordinary attachment either
                            way. */}
                        <NodeAction
                          label={t("canvas.useAsSource")}
                          disabled={busy !== null}
                          onClick={() => onUseAsSource(run)}
                        >
                          <SparklesIcon className="size-4" />
                        </NodeAction>
                        <NodeAction
                          label={t("canvas.rerun")}
                          disabled={busy !== null || settling}
                          onClick={() => onRerunShot(run)}
                        >
                          <RefreshCwIcon className="size-4" />
                        </NodeAction>
                        <NodeAction
                          label={t("canvas.download")}
                          disabled={busy !== null || downloading !== null}
                          onClick={() => void download(run)}
                        >
                          {downloading === nodeKey(run) ? (
                            <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" />
                          ) : (
                            <DownloadIcon className="size-4" />
                          )}
                        </NodeAction>
                        <NodeAction
                          label={t("discardShot", { shot: label })}
                          disabled={busy !== null}
                          onClick={() => onDiscardShot(run)}
                        >
                          {busy?.kind === "discard" &&
                          busy.key === nodeKey(run) ? (
                            <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" />
                          ) : (
                            <XIcon className="size-4" />
                          )}
                        </NodeAction>
                      </div>
                    </>
                  ) : run.error ? (
                    <div
                      dir={dir}
                      className="flex size-full flex-col items-center justify-center gap-2 px-4 text-center"
                    >
                      <AlertCircleIcon className="size-6 text-neutral-500" />
                      <p className="text-xs leading-snug text-neutral-400">
                        {run.error}
                      </p>
                      {/* Retry first, dismiss second. A failed shot is the
                          case where the vendor most wants another attempt and
                          least wants to rebuild the run to get one — and
                          dismissing was, until now, the only thing this card
                          offered. */}
                      <div
                        onPointerDown={(e) => e.stopPropagation()}
                        className="flex items-center gap-3"
                      >
                        <button
                          type="button"
                          disabled={busy !== null || settling}
                          onClick={() => onRerunShot(run)}
                          className="text-[11px] font-medium text-violet-300 underline-offset-2 hover:text-violet-200 hover:underline disabled:opacity-50"
                        >
                          {t("canvas.rerun")}
                        </button>
                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() => onDiscardShot(run)}
                          className="text-[11px] font-medium text-neutral-400 underline-offset-2 hover:text-neutral-200 hover:underline disabled:opacity-50"
                        >
                          {t("canvas.dismiss")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      dir={dir}
                      className="flex size-full flex-col items-center justify-center gap-2 text-center"
                    >
                      <Loader2Icon className="size-6 animate-spin text-violet-400 motion-reduce:animate-none" />
                      {/* The canvas is pinned dark, so the sweep is spelled
                          out in neutrals rather than the theme tokens. */}
                      <ShiningText
                        className="text-xs"
                        baseColor="#a3a3a3"
                        crestColor="#f5f5f5"
                        text={t("canvas.generating")}
                        role="status"
                        aria-live="polite"
                      />
                    </div>
                  )}
                </div>
                <span className="absolute -top-3 left-3 max-w-[85%] truncate rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] font-medium text-neutral-200 shadow">
                  <span dir={dir}>{label}</span>
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Chrome: ordinary interface, so it flips with the locale ── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex flex-wrap items-center justify-center gap-2 px-4">
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-neutral-700 bg-neutral-900/90 p-1 shadow-xl backdrop-blur">
          <ToolbarButton
            label={t("canvas.zoomOut")}
            onClick={() => zoomByButton(1 / ZOOM_STEP)}
          >
            <MinusIcon className="size-4" />
          </ToolbarButton>
          <span className="min-w-12 text-center text-xs font-medium tabular-nums text-neutral-300">
            {Math.round(view.scale * 100)}%
          </span>
          <ToolbarButton
            label={t("canvas.zoomIn")}
            onClick={() => zoomByButton(ZOOM_STEP)}
          >
            <PlusIcon className="size-4" />
          </ToolbarButton>
          <ToolbarButton label={t("canvas.fit")} onClick={fit}>
            <MaximizeIcon className="size-4" />
          </ToolbarButton>
        </div>

        {/* Only while something can still be stopped. Placed before Done so
            the destructive option is not the one under the thumb once the run
            settles and Done takes its place. */}
        {runs.some((r) => !isTerminal(r.status)) && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onCancelRun}
            disabled={busy !== null}
            className="pointer-events-auto border-neutral-700 bg-neutral-900/90 text-neutral-200 backdrop-blur hover:bg-neutral-800 hover:text-white"
          >
            {t("canvas.cancelRun")}
          </Button>
        )}

        <Button
          type="button"
          size="sm"
          onClick={onDone}
          disabled={busy !== null}
          className="pointer-events-auto bg-white text-neutral-900 hover:bg-neutral-200"
        >
          {t("done")}
        </Button>
      </div>

      <p className="pointer-events-none absolute bottom-4 start-4 hidden text-xs text-neutral-500 lg:block">
        {t("canvas.hint")}
      </p>

      {/* The wipe, opened from the enhanced original's node. It carries the
          app's direction, not the canvas's: the slider is interface, and its
          geometry is already logical. */}
      {comparing && enhanceRun?.result && sources[0] && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-neutral-950/95 p-6">
          <EnhanceCompare
            // `sources[0]` is safe here and only here: `enhanceRun` is resolved
            // only when the run has exactly one source, so there is precisely
            // one "original" the wipe could be comparing against.
            originalUrl={sources[0].url}
            enhancedUrl={enhanceRun.result.url}
            name={sources[0].original_name}
            // The wipe only spins the button matching the pending action, so it
            // takes the kind alone — the canvas tracks `shot` as well because it
            // has several nodes that can be busy independently.
            busy={busy?.kind ?? null}
            keepLabel={t("canvas.close")}
            onReplace={onReplace}
            onKeepBoth={() => setComparing(false)}
            onDiscard={() => {
              setComparing(false)
              onDiscardShot(enhanceRun)
            }}
          />
          <button
            type="button"
            aria-label={t("canvas.close")}
            onClick={() => setComparing(false)}
            className="absolute end-4 top-4 rounded-full bg-neutral-800/80 p-2 text-neutral-300 hover:bg-neutral-700 hover:text-white"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}

/** Icon button on a result node's action bar. */
function NodeAction({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full bg-black/60 p-1.5 text-neutral-200 transition-colors",
        "hover:bg-black hover:text-white disabled:opacity-50",
      )}
    >
      {children}
    </button>
  )
}

/** Icon button in the floating viewport toolbar. */
function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="rounded-full p-1.5 text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
    >
      {children}
    </button>
  )
}
