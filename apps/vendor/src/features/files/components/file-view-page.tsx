"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useSuspenseQuery } from "@apollo/client/react"
import { GET_FILE } from "@/features/files/api"
import type { FileResponse } from "@/features/files/types"
import { fileKind } from "@/features/files/lib/list/helpers"
import {
  fileDetailHref,
  fileViewHref,
  filesListHref,
  parseFileViewTab,
  parseRunId,
  RUN_PARAM,
} from "@/features/files/lib/routes"
import { FilesImageEditor } from "./files-image-editor"
import { FileViewUnavailable } from "./file-view-unavailable"

/**
 * The **file view route** — `/store/:shopSlug/content/files/:fileId`.
 *
 * This is what used to be a full-screen overlay owned by the list's state. It
 * is now a page: the file id is a path segment and the open workspace is
 * `?tab=`, so the view can be linked, refreshed, shared with a teammate, and
 * left with the back button. The list's own params ride along on the URL so
 * closing lands back on the exact page/filter/sort the vendor came from.
 *
 * The subject is fetched by id rather than read out of the list cache: a
 * pasted or bookmarked URL has no list behind it, and even from the list the
 * file may not be on the page still in cache after a filter change.
 */
export function FileViewPage() {
  const router = useRouter()
  const params = useParams<{ shopSlug: string; fileId: string }>()
  const searchParams = useSearchParams()

  const shopSlug = params?.shopSlug ?? ""
  const fileId = params?.fileId ?? ""
  const tab = parseFileViewTab(searchParams.get("tab"))
  // Read once at mount, deliberately: re-reading would restart the restore
  // every time `mirrorRun` rewrites the URL during a live run.
  const [runId] = useState(() => parseRunId(searchParams))

  const { data, refetch } = useSuspenseQuery<FileResponse>(GET_FILE, {
    variables: { id: fileId },
    // A deleted or foreign id resolves to a GraphQL error, and the view has a
    // real answer for that (see below) — far better than the route throwing
    // into the segment's error boundary.
    errorPolicy: "all",
  })

  const file = data?.attachment?.data ?? null
  const backHref = filesListHref(shopSlug, searchParams)

  const close = useCallback(() => {
    router.push(backHref)
  }, [router, backHref])

  // The editor owns which workspace is live; this only mirrors it onto the URL
  // so the address bar stays copyable. That is why it goes through the native
  // history API — which Next.js supports for exactly this and keeps in sync
  // with `useSearchParams` — rather than `router.replace`: a router navigation
  // would re-render the segment on the server, putting a network hop in front
  // of a tab click and risking a remount that discards canvas history and any
  // AI run in flight.
  //
  // Replace, not push: stepping back through every Edit/AI toggle before
  // reaching the list is not what the back button means to anyone. Opening the
  // view and leaving it are the entries worth keeping.
  const mirrorTab = useCallback(
    (next: "edit" | "ai") => {
      window.history.replaceState(
        null,
        "",
        fileViewHref(shopSlug, fileId, searchParams, next),
      )
    },
    [shopSlug, fileId, searchParams],
  )

  /**
   * Put the run on the URL the instant a submit fires.
   *
   * `replaceState` for the same reason `mirrorTab` uses it — a run is not a
   * navigation, and pushing would put an entry between the vendor and the list.
   * The URL is written *before* the mutation resolves, which is the whole point:
   * a vendor reloading is usually doing it **during** a slow run, so writing it
   * on completion would miss the case that matters.
   */
  const mirrorRun = useCallback(
    (nextRunId: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set(RUN_PARAM, nextRunId)
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}?${params.toString()}`,
      )
    },
    [searchParams],
  )

  /**
   * Point the studio at a different attachment — today, a result the vendor
   * wants to run a second pass on.
   *
   * `router.push`, not `replaceState`: this is a real change of subject, so the
   * back button should walk back through the chain to the photo the vendor
   * started from. That is the opposite of `mirrorTab`, which uses the native
   * history API precisely to avoid leaving entries — and it is the reason both
   * cannot share one helper.
   *
   * Lands on `?tab=ai` regardless of the current tab: chaining is an AI action,
   * and arriving on the Edit workspace would hide the rail that was just used.
   * `FilesImageEditor` is keyed on `file.id` upstream, so the new subject
   * remounts it with clean canvas history rather than inheriting the previous
   * image's undo stack.
   */
  const openFile = useCallback(
    (attachmentId: string) => {
      router.push(fileViewHref(shopSlug, attachmentId, searchParams, "ai"))
    },
    [router, shopSlug, searchParams],
  )

  // A PDF or a video has no editor, and its home — the list's detail sheet —
  // is addressable as `?file=<id>`. So this route sends it there rather than
  // dead-ending on an explanation whose only action was "go back and click it
  // again". `replace`, not push: Back should return to wherever the vendor
  // came from, never to a screen whose whole job is to leave. Navigation
  // only, no state, so an effect is the right home for it under the compiler
  // rules; a missing file stays put, because there is nothing to send it to.
  useEffect(() => {
    if (file && fileKind(file.mime_type) !== "image") {
      router.replace(fileDetailHref(shopSlug, file.id, searchParams))
    }
  }, [file, router, shopSlug, searchParams])

  if (!file) {
    return (
      <FileViewUnavailable
        reason="missing"
        backHref={backHref}
        onBack={close}
      />
    )
  }

  // The editor is a canvas — it can only host images. A non-image is already
  // on its way to the detail sheet (the effect above); this paints for the
  // frame the redirect is in flight, so the screen is never blank and a slow
  // navigation still shows the file's name and a way back.
  if (fileKind(file.mime_type) !== "image") {
    return (
      <FileViewUnavailable
        reason="not-image"
        name={file.original_name}
        backHref={backHref}
        onBack={close}
      />
    )
  }

  return (
    <FilesImageEditor
      key={file.id}
      file={file}
      view={tab}
      runId={runId}
      onRunStarted={mirrorRun}
      onViewChange={mirrorTab}
      onClose={close}
      onSaved={() => void refetch()}
      onOpenFile={openFile}
    />
  )
}
