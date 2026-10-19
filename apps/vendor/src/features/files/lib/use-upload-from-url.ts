"use client"

import { useCallback, useState } from "react"
import { useTranslations } from "next-intl"
import { useAuthStore } from "@/shared/stores/auth"
import { useActiveShopStore } from "@/shared/stores/active-shop"
import { tunnelHeaders } from "@/shared/lib/apollo/tunnel-headers"
import { documentLocale } from "@/shared/i18n/outside-react"

/**
 * Uploads a file from a remote URL via `POST /attachments/from-url`. The fetch
 * of the remote URL happens **on the server** — the browser can't fetch an
 * arbitrary third-party URL because of CORS — so we only hand the backend the
 * link and it downloads + persists the bytes onto our CDN. Same auth + X-SHOP
 * headers as {@link useReplaceFile}.
 */

const ENDPOINT =
  (process.env.NEXT_PUBLIC_GRAPHQL_URL
    ? process.env.NEXT_PUBLIC_GRAPHQL_URL.replace(/\/graphql\/?$/, "")
    : "http://localhost:3000") + "/attachments/from-url"

/**
 * What the controller returns per created attachment — the same shape
 * `POST /attachments` uses, so both upload paths hand callers the id they need
 * without a follow-up query.
 */
export interface UploadedFromUrl {
  id: string
  original: string
  thumbnail?: string | null
}

interface UploadResult {
  ok: boolean
  /**
   * The created attachment. The Files page ignores it and just refetches, but
   * the AI Studio needs the id immediately — an enhance run is keyed on it, and
   * hunting for the new row in a paginated, sorted, filtered list to find an id
   * the server already returned would be a race for no reason.
   */
  file?: UploadedFromUrl
  error?: string
}

interface UploadResponse {
  success?: boolean
  message?: string
  data?: UploadedFromUrl[]
}

export function useUploadFromUrl() {
  const t = useTranslations("files.errors")
  const [uploading, setUploading] = useState(false)

  const uploadFromUrl = useCallback(
    async (url: string): Promise<UploadResult> => {
      const token = useAuthStore.getState().accessToken
      const shopSlug = useActiveShopStore.getState().slug
      if (!token || !shopSlug) {
        return { ok: false, error: t("noShop") }
      }

      setUploading(true)
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            "X-SHOP": shopSlug,
            // The API words `message` from this; without it an Arabic
            // dashboard shows the server's error in English.
            "Accept-Language": documentLocale(),
            ...tunnelHeaders(),
          },
          body: JSON.stringify({ url, context: "files" }),
        })
        let json: UploadResponse | null = null
        try {
          json = (await res.json()) as UploadResponse
        } catch {
          /* fall through to the status-based error below */
        }
        if (res.ok && json?.success) return { ok: true, file: json.data?.[0] }
        return {
          ok: false,
          error: json?.message ?? t("uploadFailed", { status: res.status }),
        }
      } catch {
        return { ok: false, error: t("uploadNetwork") }
      } finally {
        setUploading(false)
      }
    },
    [t],
  )

  return { uploadFromUrl, uploading }
}
