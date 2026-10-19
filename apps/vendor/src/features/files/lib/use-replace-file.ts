"use client"

import { useCallback, useState } from "react"
import { useTranslations } from "next-intl"
import { useAuthStore } from "@/shared/stores/auth"
import { useActiveShopStore } from "@/shared/stores/active-shop"
import { tunnelHeaders } from "@/shared/lib/apollo/tunnel-headers"
import { documentLocale } from "@/shared/i18n/outside-react"

/**
 * Replaces a file's bytes via `POST /attachments/:id/replace`. The backend
 * keeps the same `attachment.id` but writes a NEW storage object and repoints
 * every reference to it in one transaction — so callers must refetch to pick
 * up the new URL, and no cache-busting is needed (the old URL is gone rather
 * than stale). Same auth + X-SHOP headers as {@link useAttachmentUpload};
 * a plain `fetch` since we don't need progress.
 */

const ENDPOINT_BASE =
  (process.env.NEXT_PUBLIC_GRAPHQL_URL
    ? process.env.NEXT_PUBLIC_GRAPHQL_URL.replace(/\/graphql\/?$/, "")
    : "http://localhost:3000") + "/attachments"

interface ReplaceResult {
  ok: boolean
  error?: string
}

interface ReplaceResponse {
  success?: boolean
  message?: string
}

export function useReplaceFile() {
  const t = useTranslations("files.errors")
  const [replacingId, setReplacingId] = useState<string | null>(null)

  const replaceFile = useCallback(
    async (id: string, file: File): Promise<ReplaceResult> => {
      const token = useAuthStore.getState().accessToken
      const shopSlug = useActiveShopStore.getState().slug
      if (!token || !shopSlug) {
        return { ok: false, error: t("noShop") }
      }

      setReplacingId(id)
      const fd = new FormData()
      fd.append("file", file)

      try {
        const res = await fetch(`${ENDPOINT_BASE}/${id}/replace`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-SHOP": shopSlug,
            // The API words `message` from this; without it an Arabic
            // dashboard shows the server's error in English.
            "Accept-Language": documentLocale(),
            ...tunnelHeaders(),
          },
          body: fd,
        })
        let json: ReplaceResponse | null = null
        try {
          json = (await res.json()) as ReplaceResponse
        } catch {
          /* fall through to the status-based error below */
        }
        if (res.ok && json?.success) return { ok: true }
        return {
          ok: false,
          error: json?.message ?? t("replaceFailed", { status: res.status }),
        }
      } catch {
        return { ok: false, error: t("replaceNetwork") }
      } finally {
        setReplacingId(null)
      }
    },
    [t],
  )

  return { replaceFile, replacingId }
}
