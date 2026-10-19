"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import {
  ImageEditor,
  type EditorMedia,
  type EditorSavePlan,
  type EditorView,
} from "@/features/products/components/form/ui/image-editor"
import { useAttachmentUpload } from "@/shared/lib/upload/use-attachment-upload"
import { UPDATE_FILE, DELETE_FILE, REPLACE_FILE_FROM_EXISTING } from "@/features/files/api"
import type { FileEntry, UpdateFileResponse, ReplaceFileFromExistingResponse } from "@/features/files/types"
import { useReplaceFile } from "@/features/files/lib/use-replace-file"
import {
  nodeKey,
  useEnhanceFile,
  type ShotRun,
} from "@/features/files/lib/use-enhance-file"
import { EnhanceStudioControls } from "./enhance-studio-controls"
import { EnhanceCanvas } from "./enhance-canvas"

/**
 * The Content > Files image viewer/editor — the same full-screen editor used
 * on the product form, rendered by the **file view route**
 * (`/content/files/:fileId`) when a vendor opens an image from the Files list.
 * It is a page, not an overlay: the file id and the open workspace both live in
 * the URL, so the view is linkable, survives a refresh, and closes with the
 * back button. This component owns neither — the route hands them in.
 *
 * It offers two saves:
 *
 *   - **Save** replaces the file in place (same URL → references stay valid):
 *     metadata is written via `updateAttachment`, and any pixel edits overwrite
 *     the bytes through `POST /attachments/:id/replace`.
 *   - **Save as new** exports the current canvas as a brand-new attachment,
 *     leaving the original untouched.
 *
 * It is also the **only** host of the AI enhance flow: the editor's **AI Studio
 * workspace** — one of the two the header switches between — holds
 * `EnhanceStudioControls` (wrapped in `.dark` so the semantic tokens match the
 * editor's forced-dark chrome), and the list's enhance star links straight to
 * that workspace (`?tab=ai`). Starting a run swaps the canvas
 * stage for `EnhanceCanvas`, the free canvas where the source image sits as a
 * node and each shot branches off it on an arrow.
 *
 * A run produces one image per picked shot, and **no shot is privileged** —
 * `'enhance'` may be absent from the run and may fail while another shot
 * succeeds. So every handler here reads the run set rather than assuming an
 * enhanced original exists: Replace is only reachable when that specific shot
 * came back, and it closes the editor since the canvas would otherwise show the
 * pre-replace bytes. Discard prunes one shot's generated attachment; everything
 * else is already safely in the library.
 */
export function FilesImageEditor({
  file,
  view,
  runId,
  onRunStarted,
  onViewChange,
  onClose,
  onSaved,
  onOpenFile,
}: {
  file: FileEntry
  /** Which workspace to open on, read from the URL by the route. */
  view: EditorView
  /**
   * A run to restore, read from `?run=` by the route. The images were never at
   * risk — they are ordinary attachments in the library — so what this brings
   * back is the *review*: which node failed, why, and from which source.
   */
  runId?: string | null
  /** Reports a new run's id so the route can put it on the URL immediately. */
  onRunStarted?: (runId: string) => void
  /** Tab clicks go back to the route, which mirrors them onto the URL. */
  onViewChange: (view: EditorView) => void
  onClose: () => void
  onSaved: () => void
  /**
   * Navigate the studio onto another attachment. Owned by the route, because
   * the file is a URL segment here — this component holds no router and no
   * shop slug, and the AI Studio workspace is a `?tab=` on the same route.
   */
  onOpenFile: (attachmentId: string) => void
}) {
  const t = useTranslations("aiStudio")
  const [updateFile] = useMutation<UpdateFileResponse>(UPDATE_FILE)
  const [deleteFile] = useMutation(DELETE_FILE)
  const [replaceFromExisting] = useMutation<ReplaceFileFromExistingResponse>(
    REPLACE_FILE_FROM_EXISTING,
  )
  const { replaceFile } = useReplaceFile()
  const { uploadFiles } = useAttachmentUpload("files")

  // ─── AI enhance run (own instance — the editor covers the Files page) ───
  const {
    enhance,
    restore,
    rerunShot,
    reset: resetEnhance,
    cancelRun,
    dismissRun,
    state: enhanceState,
    outcome,
    error: enhanceError,
  } = useEnhanceFile({ onRunStarted })

  // Rebuild the review the URL names, once. `restore` is a no-op while a run is
  // already polling, so a re-entry cannot fight a live run.
  useEffect(() => {
    if (!runId) return
    void restore(runId, [file])
  }, [runId, file, restore])
  // Which *node* is busy, not merely that something is — the canvas shows one
  // node per shot per variation, so an untargeted flag spins every node's
  // action at once, and a shot-targeted one spins all four variations of it.
  const [resultBusy, setResultBusy] = useState<{
    kind: "replace" | "discard"
    key: string
  } | null>(null)

  useEffect(() => {
    if (enhanceState !== "error" || !enhanceError) return
    sileo.error({ title: t("toast.enhanceFailed"), description: enhanceError })
    // Only tear the review down when there is nothing on it to read. A run where
    // every shot failed still has a node per shot with its own reason, and those
    // reasons are the whole point of showing them — a toast that names one of
    // three failures is not a substitute. A submit or start failure produces no
    // runs at all, and that is what this resets.
    if (!outcome?.runs.length) resetEnhance()
  }, [enhanceState, enhanceError, outcome, resetEnhance, t])

  // The run, not just its result — the busy flag is keyed by node now, and a
  // node's identity needs the shot, the source and the variation together.
  // This host always runs on exactly one file, so the first `enhance` node is
  // unambiguously the one Replace promotes.
  const enhancedRun = outcome?.runs.find((r) => r.shot === "enhance" && r.result)
  const enhanced = enhancedRun?.result

  const handleReplaceWithEnhanced = async () => {
    if (!enhanced || !enhancedRun || resultBusy) return
    setResultBusy({ kind: "replace", key: nodeKey(enhancedRun) })
    try {
      const { data } = await replaceFromExisting({
        variables: { id: file.id, replacementId: enhanced.attachment_id },
        update(cache, result) {
          if (!result.data?.replaceAttachmentFromExisting.success) return
          // The original is retired and the result is now canonical. Invalidate
          // the library so returning to it loads the new count and references.
          cache.evict({ id: cache.identify({ __typename: "AttachmentEntry", id: file.id }) })
          cache.evict({ id: "ROOT_QUERY", fieldName: "attachments" })
        },
      })
      if (!data?.replaceAttachmentFromExisting.success) {
        sileo.error({ title: t("toast.replaceFailed") })
        setResultBusy(null)
        return
      }
      sileo.success({ title: t("toast.replaced") })
      resetEnhance()
      // Close without refetching the retired original's detail route.
      onClose()
    } catch {
      sileo.error({ title: t("toast.replaceFailedRetry") })
      setResultBusy(null)
    }
  }

  const handleKeepAll = () => {
    const kept = outcome?.runs.filter((r) => r.result).length ?? 0
    // A run where every shot failed still ends here, and "0 images kept" is not
    // a success — closing the review quietly is the honest outcome.
    if (kept > 0) sileo.success({ title: t("toast.kept", { count: kept }) })
    resetEnhance()
    setResultBusy(null)
    onSaved()
  }

  /**
   * Delete one node's generated image and drop it from the review set.
   *
   * Both halves key on the node, not on its shot id: one node is one
   * generation, so a four-variation run has four `enhance` nodes and discarding
   * one must delete one attachment and remove one card.
   */
  const handleDiscardShot = async (run: ShotRun) => {
    if (!run.result) {
      // A failed shot has no attachment to delete — just clear the card.
      dismissRun(run)
      return
    }
    setResultBusy({ kind: "discard", key: nodeKey(run) })
    try {
      await deleteFile({ variables: { id: run.result.attachment_id } })
      dismissRun(run)
      onSaved()
    } catch {
      sileo.error({ title: t("toast.discardFailed") })
    } finally {
      setResultBusy(null)
    }
  }

  // No cache-bust needed: a replace mints a new URL, so re-opening the editor
  // after a save loads a URL the browser has never seen.
  const media = useMemo<EditorMedia>(
    () => ({
      id: file.id,
      original: file.url,
      thumbnail: file.thumbnail || file.url,
      alt: file.alt ? { en: file.alt } : undefined,
    }),
    [file],
  )

  const savePlan = useMemo<EditorSavePlan>(
    () => ({
      // Save → replace the file's bytes, keeping its id; the backend repoints
      // every reference at the new URL, so edits propagate everywhere.
      primary: {
        label: t("save"),
        run: async (ctx) => {
          await updateFile({
            variables: {
              id: file.id,
              name: ctx.name || undefined,
              alt: ctx.alt,
            },
          }).catch(() => null)

          if (ctx.pixelEdited) {
            const edited = await ctx.exportFile(file.mime_type)
            if (edited) {
              const { ok, error } = await replaceFile(file.id, edited)
              if (!ok) {
                sileo.error({
                  title: t("toast.saveFailed"),
                  description: error,
                })
                return false
              }
            }
          }

          sileo.success({ title: t("toast.saved") })
          onSaved()
          return true
        },
      },
      // Save as new → export the current canvas as a fresh attachment.
      secondary: {
        label: t("saveAsNew"),
        run: async (ctx) => {
          const copy = await ctx.exportFile("image/jpeg")
          if (!copy) {
            sileo.error({ title: t("toast.exportFailed") })
            return false
          }
          const [uploaded] = await uploadFiles([copy])
          if (!uploaded?.id) {
            sileo.error({ title: t("toast.saveAsNewFailed") })
            return false
          }
          if (ctx.name || ctx.alt) {
            await updateFile({
              variables: {
                id: uploaded.id,
                name: ctx.name || undefined,
                alt: ctx.alt,
              },
            }).catch(() => null)
          }

          sileo.success({ title: t("toast.savedAsNew") })
          onSaved()
          return true
        },
      },
    }),
    [file.id, file.mime_type, updateFile, replaceFile, uploadFiles, onSaved, t],
  )

  return (
    <ImageEditor
      media={media}
      onClose={onClose}
      onSave={onClose}
      savePlan={savePlan}
      initialView={view}
      onViewChange={onViewChange}
      aiSection={
        <div className="dark">
          <EnhanceStudioControls
            // Remount per file so one image's picks never carry to the next.
            key={file.id}
            busy={enhanceState === "running"}
            disabled={!!outcome}
            // `outcome` exists from the moment the mutation returns the queued
            // generations, so it cannot tell "running" from "ready to review" —
            // only the run state can.
            activeRunId={runId}
            busyHint={
              enhanceState === "running" ? t("hintRunning") : t("hintReview")
            }
            // The rail names no source — this host's source is the file the
            // route resolved, which is the one on the canvas. Everything else
            // is the rail's run, forwarded whole so a new run setting reaches
            // the hook without an edit here.
            onSubmit={(...run) => void enhance(file, ...run)}
          />
        </div>
      }
      stageOverlay={
        outcome ? (
          <EnhanceCanvas
            runs={outcome.runs}
            sources={outcome.sources}
            busy={resultBusy}
            onReplace={() => void handleReplaceWithEnhanced()}
            onDone={handleKeepAll}
            onCancelRun={cancelRun}
            // Clear the review before navigating: the run belongs to the file
            // being left, and carrying its nodes onto the next subject would
            // show results that branch off an image no longer on the canvas.
            onUseAsSource={(run) => {
              if (!run.result) return
              const next = run.result.attachment_id
              resetEnhance()
              onSaved()
              onOpenFile(next)
            }}
            onRerunShot={(run) => void rerunShot(run)}
            onDiscardShot={(run) => void handleDiscardShot(run)}
          />
        ) : undefined
      }
    />
  )
}
