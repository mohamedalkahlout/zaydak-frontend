"use client"

import { useCallback, useState } from "react"
import { useTranslations } from "next-intl"
import {
  ACCEPTED_IMAGE_TYPES,
  useAttachmentUpload,
} from "@/shared/lib/upload/use-attachment-upload"
import { useUploadFromUrl } from "@/features/files/lib/use-upload-from-url"
import type { FileEntry } from "@/features/files/types"

/**
 * Turns any of the three "give the studio an image" gestures — upload from the
 * device, pick one already in the library, paste a link — into the one thing a
 * run actually needs: an attachment id.
 *
 * All three already mint a real `Attachment` server-side, so there is no
 * staged-but-not-uploaded state to invent. That is deliberate: `enhanceImageShots`
 * is keyed on an attachment id, so a source that isn't persisted yet could not
 * start a run anyway, and a half-committed source would be a state with nothing
 * to do.
 *
 * The hook reports the source and never navigates — the page decides that.
 */

/** What the studio needs to hand off: the id, plus enough to show a preview. */
export interface StudioSource {
  id: string
  url: string
  name: string
}

/**
 * SVG is dropped from the studio's allow-list even though the library accepts
 * it: the generation models rasterize nothing, so an SVG source fails inside
 * the provider after the spend path has already started. Better to refuse it at
 * the file picker, where the vendor can still do something about it.
 */
export const STUDIO_SOURCE_TYPES = ACCEPTED_IMAGE_TYPES.filter(
  (t) => t !== "image/svg+xml",
)
export const STUDIO_SOURCE_ATTR = STUDIO_SOURCE_TYPES.join(",")

/** Is this library file usable as a generation source? */
export function isStudioSourceMime(mime: string): boolean {
  return STUDIO_SOURCE_TYPES.includes(mime)
}

export function useStudioSource() {
  const t = useTranslations("files.studioSource")
  const {
    uploadFiles,
    uploading,
    progress,
    error: uploadError,
  } = useAttachmentUpload("files", { acceptedTypes: STUDIO_SOURCE_TYPES })
  const { uploadFromUrl, uploading: importing } = useUploadFromUrl()

  const [source, setSource] = useState<StudioSource | null>(null)
  const [error, setError] = useState<string | null>(null)

  /** Upload from the device. Only the first image is taken — a run has one source. */
  const uploadFromDevice = useCallback(
    async (picked: File[] | FileList) => {
      const files = Array.from(picked)
      if (!files.length) return
      setError(null)
      const [uploaded] = await uploadFiles(files.slice(0, 1))
      // `uploadFiles` reports its own reason through `uploadError`, which the
      // page already renders — overwriting it here with something vaguer would
      // replace "unsupported file type" with "that didn't work".
      if (!uploaded?.id) return
      setSource({
        id: uploaded.id,
        url: uploaded.original,
        name: uploaded.name || t("fallbackName"),
      })
    },
    [uploadFiles, t],
  )

  /** Choose a file that is already in the library — nothing to upload. */
  const pickFromLibrary = useCallback((file: FileEntry) => {
    setError(null)
    setSource({ id: file.id, url: file.url, name: file.original_name })
  }, [])

  /** Import a remote link. The backend fetches it; the browser can't (CORS). */
  const importFromUrl = useCallback(
    async (url: string) => {
      const trimmed = url.trim()
      if (!trimmed) return
      setError(null)
      const { ok, file, error: err } = await uploadFromUrl(trimmed)
      if (!ok) {
        setError(err ?? t("importFailed"))
        return
      }
      if (!file?.id) {
        // The bytes landed but the response shape was not what we expect, so we
        // have no id to run on. Say so instead of silently doing nothing — the
        // file is in the library and the vendor can pick it from there.
        setError(t("importUnreadable"))
        return
      }
      setSource({
        id: file.id,
        url: file.original,
        name: trimmed.split("/").pop() || t("fallbackName"),
      })
    },
    [uploadFromUrl, t],
  )

  const clear = useCallback(() => {
    setSource(null)
    setError(null)
  }, [])

  return {
    source,
    busy: uploading || importing,
    progress,
    error: error ?? uploadError,
    uploadFromDevice,
    pickFromLibrary,
    importFromUrl,
    clear,
  }
}
