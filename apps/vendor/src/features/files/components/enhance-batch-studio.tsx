"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { useMutation, useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { ArrowLeftIcon, Loader2Icon, SparklesIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { DELETE_FILE, GET_FILES } from "@/features/files/api"
import type { FileEntry, FilesResponse } from "@/features/files/types"
import {
  filesListHref,
  parseStudioIds,
  parseRunId,
  RUN_PARAM,
} from "@/features/files/lib/routes"
import {
  nodeKey,
  useEnhanceFile,
  type ShotRun,
} from "@/features/files/lib/use-enhance-file"
import { EnhanceStudioControls } from "./enhance-studio-controls"
import { EnhanceCanvas } from "./enhance-canvas"

/**
 * **AI Studio holding a batch** — `/content/files/studio?ids=a&ids=b&…`.
 *
 * One set of settings applied to the library's selection. It is the third host
 * of `EnhanceStudioControls`, and the reason the rail has always named no
 * source: it reports *what to run*, and each host supplies *what to run it on*.
 *
 * **Why this is a route and not a dialog over the list.** Both halves of the
 * screen live on the URL: the selection as `?ids=`, and the run being reviewed
 * as `?run=`. So the batch survives a refresh, can be linked, and can be handed
 * to a teammate. The run id is written the instant the submit fires rather than
 * when it lands, which is the case that matters — a vendor reloading a
 * twenty-image batch is doing it *during* the run.
 *
 * The images were never the fragile part: every result is ingested as an
 * ordinary attachment and reaches the library whatever the browser does. What
 * used to be lost was the *review* — which node failed, why, and from which
 * source — and that is what `restore` brings back.
 *
 * **It hosts the run rather than handing off, unlike the single-source studio.**
 * `AiStudioPage` forwards to `/content/files/:id?tab=ai` precisely to avoid a
 * second copy of the run logic — but a batch has no single id to forward to, so
 * there is nowhere to hand off. What keeps that from becoming two
 * implementations is that everything subtle is already shared: the run driver
 * (`useEnhanceFile`), the review (`EnhanceCanvas`) and the rail are the same
 * components the file view uses. This adds a header, a loader and a discard
 * handler, and nothing else.
 *
 * **What it deliberately does not offer.** No pixel editor and no save plan —
 * there is no single canvas to edit or save. No "replace original" either: that
 * promotes one output over *the* source file, and with twenty sources there is
 * no such thing. `EnhanceCanvas` reaches the same conclusion from
 * `sources.length` rather than being told, so the two cannot disagree.
 */
export function EnhanceBatchStudio() {
  const t = useTranslations("aiStudio")
  const params = useParams<{ shopSlug: string }>()
  const searchParams = useSearchParams()
  const shopSlug = params?.shopSlug ?? ""
  const ids = useMemo(() => parseStudioIds(searchParams), [searchParams])

  const [deleteFile] = useMutation(DELETE_FILE)
  // Read once at mount: re-reading would restart the restore each time the
  // URL is rewritten during a live run.
  const [runId] = useState(() => parseRunId(searchParams))

  /**
   * Put the run on the URL the instant a submit fires — before the mutations
   * resolve, which is the case that matters: a vendor reloading a twenty-image
   * batch is doing it *during* the run, not after.
   */
  const mirrorRun = useCallback((nextRunId: string) => {
    const params = new URLSearchParams(window.location.search)
    params.set(RUN_PARAM, nextRunId)
    window.history.replaceState(
      null,
      "",
      window.location.pathname + '?' + params.toString(),
    )
  }, [])

  const {
    enhance,
    restore,
    rerunShot,
    reset: resetEnhance,
    cancelRun,
    dismissRun,
    state: enhanceState,
    outcome,
  } = useEnhanceFile({ onRunStarted: mirrorRun })
  const [busy, setBusy] = useState<{
    kind: "replace" | "discard"
    key: string
  } | null>(null)

  // One round-trip for the whole selection. `attachments(ids:)` resolves them
  // shop-scoped and soft-delete filtered, so an id the vendor no longer owns
  // simply does not come back rather than erroring the screen.
  const { data, loading } = useQuery<FilesResponse>(GET_FILES, {
    variables: { ids, limit: ids.length || 1 },
    skip: !ids.length,
  })

  /**
   * The selection, in the order the URL named it.
   *
   * Re-ordered rather than taken as the server returned it, because the server
   * sorts by date: the clusters would then be stacked in an order the vendor did
   * not choose and cannot see the reason for. Files that came back are the only
   * ones kept — a deleted id resolves to nothing and is dropped here, so it can
   * never reach the run as a source that fails for a reason nobody can read.
   */
  const sources = useMemo<FileEntry[]>(() => {
    const byId = new Map((data?.attachments?.data ?? []).map((f) => [f.id, f]))
    return ids.map((id) => byId.get(id)).filter((f): f is FileEntry => !!f)
  }, [data, ids])

  const missing = ids.length - sources.length

  /**
   * Clear the review when the selection changes under it — unless the URL is
   * asking for a specific run, which is the restore case and must not be wiped
   * by the very effect watching the ids it arrived with.
   */
  useEffect(() => {
    if (runId) return
    resetEnhance()
  }, [ids, runId, resetEnhance])

  // Restore after the selection resolves: the canvas needs the source files
  // to draw its clusters, and those arrive from `attachments(ids:)`.
  useEffect(() => {
    if (!runId || !sources.length) return
    void restore(runId, sources)
  }, [runId, sources, restore])

  const handleDiscard = async (run: ShotRun) => {
    if (!run.result) {
      dismissRun(run)
      return
    }
    setBusy({ kind: "discard", key: nodeKey(run) })
    try {
      await deleteFile({ variables: { id: run.result.attachment_id } })
      dismissRun(run)
    } finally {
      setBusy(null)
    }
  }

  const backHref = filesListHref(shopSlug, searchParams)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950 text-neutral-100">
      <header className="flex items-center gap-3 border-b border-neutral-800 px-4 py-2.5">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href={backHref} />}
          className="gap-1.5 text-neutral-300 hover:bg-neutral-800 hover:text-white"
        >
          <ArrowLeftIcon className="size-4" />
          {t("source.backToFiles")}
        </Button>
        <span className="flex min-w-0 flex-1 items-center justify-center gap-1.5 text-sm font-medium">
          <SparklesIcon className="size-4 text-violet-400" />
          {t("batch.title", { count: sources.length })}
        </span>
        <div className="w-28 shrink-0" aria-hidden />
      </header>

      <div className="flex min-h-0 flex-1">
        <div
          className="relative flex flex-1 items-center justify-center overflow-hidden"
          style={
            outcome
              ? undefined
              : {
                  backgroundImage:
                    "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)",
                  backgroundSize: "18px 18px",
                }
          }
        >
          {outcome ? (
            <EnhanceCanvas
              runs={outcome.runs}
              sources={outcome.sources}
              busy={busy}
              // Never reachable: the canvas hides Replace unless the run has
              // exactly one source, and this screen always has the selection.
              // Passed as a no-op rather than made optional so the prop stays
              // required for the host that does implement it.
              onReplace={() => {}}
              onDone={resetEnhance}
              onCancelRun={cancelRun}
              // Chaining one output into a fresh single-image studio would
              // abandon the batch mid-review. The output is already a library
              // file, so the vendor can open it there — same two clicks, no lost
              // canvas.
              onUseAsSource={() => {}}
              onRerunShot={(run) => void rerunShot(run)}
              onDiscardShot={(run) => void handleDiscard(run)}
            />
          ) : (
            <div className="flex max-w-md flex-col items-center gap-3 p-6 text-center">
              {loading ? (
                <Loader2Icon className="size-6 animate-spin text-neutral-500" />
              ) : (
                <>
                  {/* The selection, as a strip, so the vendor can see exactly
                      what is about to be spent on before they spend it. */}
                  <div className="flex max-w-full flex-wrap justify-center gap-1.5">
                    {sources.slice(0, 12).map((f) => (
                      <span
                        key={f.id}
                        className="size-14 overflow-hidden rounded-md border border-neutral-700"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={f.thumbnail || f.url}
                          alt={f.original_name}
                          className="size-full object-cover"
                        />
                      </span>
                    ))}
                    {sources.length > 12 && (
                      <span className="flex size-14 items-center justify-center rounded-md border border-neutral-700 text-xs text-neutral-400">
                        {t("batch.more", { count: sources.length - 12 })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-400">
                    {sources.length
                      ? t("batch.stageHint", { count: sources.length })
                      : t("batch.empty")}
                  </p>
                  {/* Named, not swallowed: an id that no longer resolves is a
                      file deleted since the selection was made, and silently
                      running on fewer images than were picked is exactly the
                      kind of quiet shortfall a vendor discovers in their bill. */}
                  {missing > 0 && (
                    <p className="text-xs text-amber-400">
                      {t("batch.missing", { count: missing })}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <aside className="dark flex w-85 shrink-0 flex-col overflow-hidden border-s border-neutral-800 bg-neutral-900/60">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <EnhanceStudioControls
              busy={enhanceState === "running"}
              disabled={!!outcome || !sources.length}
              // The rail names no source; it only needs to know how many, so it
              // can price and gate the run honestly.
              sourceCount={sources.length}
              activeRunId={runId}
              busyHint={
                enhanceState === "running"
                  ? t("hintRunning")
                  : outcome
                    ? t("hintReview")
                    : t("batch.empty")
              }
              // The run is forwarded whole — shots, options, variations,
              // references, caption — so a new run setting reaches the hook
              // without an edit here.
              onSubmit={(...run) => void enhance(sources, ...run)}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}
