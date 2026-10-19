"use client"

import { useCallback, useState } from "react"
import { useTranslations } from "next-intl"
import { useAuthStore } from "@/shared/stores/auth"
import { useActiveShopStore } from "@/shared/stores/active-shop"
import { tunnelHeaders } from "@/shared/lib/apollo/tunnel-headers"
import { documentLocale } from "@/shared/i18n/outside-react"

/**
 * Wraps POST /attachments so the chat can hand-off files to the existing
 * attachments pipeline (multer → storage driver → CDN URL). We do NOT
 * re-invent a storage route — that endpoint already gives us signed CDN
 * URLs + thumbnails and applies the same auth + shop scoping used by
 * the product form.
 *
 * The returned URLs are suitable for embedding in the user's chat
 * message as `[Attached images: ...]`. The agent prompt tells the LLM
 * to pass those URLs to create_product / update_product.
 */

export interface UploadedAttachment {
  url: string
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

const ENDPOINT =
  (process.env.NEXT_PUBLIC_GRAPHQL_URL
    ? process.env.NEXT_PUBLIC_GRAPHQL_URL.replace(/\/graphql\/?$/, "")
    : "http://localhost:3000") + "/attachments"

export function useChatUpload() {
  const t = useTranslations("aiChat.upload")
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = useCallback(
    async (file: File): Promise<UploadedAttachment | null> => {
      const token = useAuthStore.getState().accessToken
      const shopSlug = useActiveShopStore.getState().slug
      if (!token || !shopSlug) {
        setError(t("notSignedIn"))
        return null
      }

      setUploading(true)
      setError(null)

      try {
        const fd = new FormData()
        fd.append("files", file)
        fd.append("context", "ai-chat")

        const res = await fetch(ENDPOINT, {
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

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as
            | { message?: string }
            | null
          throw new Error(
            body?.message ?? t("failedStatus", { status: res.status }),
          )
        }

        const json = (await res.json()) as UploadResponse
        const item = json.data?.[0]
        if (!item?.original) {
          throw new Error(t("noUrl"))
        }

        return {
          url: item.original,
          thumbnail: item.thumbnail ?? item.original,
          name: file.name,
          size: file.size,
          type: file.type,
        }
      } catch (err) {
        // A network failure rejects `fetch` with the browser's own TypeError
        // ("Failed to fetch") — English whatever the dashboard's language —
        // so only the messages thrown above are shown as they are.
        setError(
          err instanceof Error && !(err instanceof TypeError)
            ? err.message
            : t("failed"),
        )
        return null
      } finally {
        setUploading(false)
      }
    },
    [t],
  )

  return { upload, uploading, error }
}
