"use client"

import { useCallback, useState } from "react"
import { useTranslations } from "next-intl"
import { documentLocale } from "@/shared/i18n/outside-react"
import type { Translate } from "@/shared/i18n/translator"
import { useAuthStore } from "@/shared/stores/auth"
import { useActiveShopStore } from "@/shared/stores/active-shop"
import { tunnelHeaders } from "@/shared/lib/apollo/tunnel-headers"

/**
 * Shared uploader for the `POST /attachments` REST endpoint (multer →
 * storage driver → URL + thumbnail). One place so every screen that
 * accepts files — product media, gallery, variant swatches, AI chat —
 * uses the same auth + X-SHOP + validation, and the same result shape.
 *
 * Uses XMLHttpRequest (not fetch) purely so we can surface upload
 * progress; fetch has no upload-progress event. Sends every file in a
 * single request (the backend's FilesInterceptor accepts up to 10) and
 * maps each returned URL back to its source file by index.
 */

export interface UploadedFile {
  id?: string
  original: string
  thumbnail: string
  name: string
  size: number
  type: string
}

interface UploadResponseItem {
  id: string
  original: string
  thumbnail?: string
}
interface UploadResponse {
  success: boolean
  data: UploadResponseItem[]
  message?: string
}

/** Mirrors the backend's ALLOWED_MIMES (images only for product media). */
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
]
export const ACCEPTED_IMAGE_ATTR = ACCEPTED_IMAGE_TYPES.join(",")

/**
 * The full backend ALLOWED_MIMES set (images + video + PDF). Used by the
 * standalone Content > Files page, which accepts more than product media.
 */
export const ACCEPTED_FILE_TYPES = [
  ...ACCEPTED_IMAGE_TYPES,
  "application/pdf",
  "video/mp4",
  "video/webm",
]
export const ACCEPTED_FILE_ATTR = ACCEPTED_FILE_TYPES.join(",")

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10MB — matches controller
export const MAX_UPLOAD_FILES = 10 // matches FilesInterceptor limit

const ENDPOINT =
  (process.env.NEXT_PUBLIC_GRAPHQL_URL
    ? process.env.NEXT_PUBLIC_GRAPHQL_URL.replace(/\/graphql\/?$/, "")
    : "http://localhost:3000") + "/attachments"

function humanSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)}MB`
    : `${Math.round(bytes / 1024)}KB`
}

/**
 * Reject bad files before we hit the network so the user sees a precise
 * per-file reason instead of a generic 400. Returns an error string, or
 * null when every file passes. `t` is scoped to `upload`.
 */
function validate(
  files: File[],
  acceptedTypes: string[],
  t: Translate,
): string | null {
  if (files.length > MAX_UPLOAD_FILES) {
    return t("tooMany", { max: MAX_UPLOAD_FILES })
  }
  for (const f of files) {
    if (!acceptedTypes.includes(f.type)) {
      return t("unsupportedType", { name: f.name })
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      return t("tooLarge", {
        name: f.name,
        size: humanSize(f.size),
        limit: humanSize(MAX_UPLOAD_BYTES),
      })
    }
  }
  return null
}

/**
 * @param context stored on each attachment (`product-image`, `files`, …).
 * @param options.acceptedTypes MIME allow-list to validate against before
 *   the network round-trip. Defaults to images only, so existing callers
 *   (product media) keep their tight validation; the Files page passes the
 *   wider {@link ACCEPTED_FILE_TYPES}.
 */
export function useAttachmentUpload(
  context: string,
  options?: { acceptedTypes?: string[] },
) {
  const acceptedTypes = options?.acceptedTypes ?? ACCEPTED_IMAGE_TYPES
  const t = useTranslations("upload")
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => setError(null), [])

  const uploadFiles = useCallback(
    async (files: File[]): Promise<UploadedFile[]> => {
      if (!files.length) return []

      const token = useAuthStore.getState().accessToken
      const shopSlug = useActiveShopStore.getState().slug
      if (!token || !shopSlug) {
        setError(t("signedOut"))
        return []
      }

      const invalid = validate(files, acceptedTypes, t)
      if (invalid) {
        setError(invalid)
        return []
      }

      setUploading(true)
      setError(null)
      setProgress(0)

      const fd = new FormData()
      files.forEach((f) => fd.append("files", f))
      fd.append("context", context)

      return new Promise<UploadedFile[]>((resolve) => {
        const xhr = new XMLHttpRequest()
        xhr.open("POST", ENDPOINT)
        xhr.setRequestHeader("Authorization", `Bearer ${token}`)
        xhr.setRequestHeader("X-SHOP", shopSlug)
        // The API words its own errors from this, as it does for GraphQL
        // through the Apollo locale link; without it `json.message` below
        // arrives in English under an Arabic dashboard.
        xhr.setRequestHeader("Accept-Language", documentLocale())
        for (const [name, value] of Object.entries(tunnelHeaders())) {
          xhr.setRequestHeader(name, value)
        }

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100))
          }
        }

        xhr.onload = () => {
          setUploading(false)
          setProgress(100)
          let json: UploadResponse | null = null
          try {
            json = JSON.parse(xhr.responseText) as UploadResponse
          } catch {
            /* fall through to error below */
          }

          if (xhr.status >= 200 && xhr.status < 300 && json?.success) {
            const results = (json.data ?? []).map((item, i) => ({
              id: item.id,
              original: item.original,
              thumbnail: item.thumbnail ?? item.original,
              name: files[i]?.name ?? "",
              size: files[i]?.size ?? 0,
              type: files[i]?.type ?? "",
            }))
            resolve(results)
          } else {
            setError(json?.message ?? t("failed", { status: xhr.status }))
            resolve([])
          }
        }

        xhr.onerror = () => {
          setUploading(false)
          setError(t("network"))
          resolve([])
        }

        xhr.send(fd)
      })
    },
    [context, acceptedTypes, t],
  )

  return { uploadFiles, uploading, progress, error, reset }
}
