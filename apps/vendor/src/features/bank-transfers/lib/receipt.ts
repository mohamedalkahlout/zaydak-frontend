import { GRAPHQL_URL } from "@/shared/lib/apollo/links"
import { ACCESS_TOKEN_COOKIE } from "@/shared/lib/auth/cookie-names"
import { refreshAccessToken } from "@/shared/lib/auth/refresh"
import { forceLogout } from "@/shared/lib/auth/session"
import { getCookie } from "@/shared/lib/cookies"
import { useAuthStore } from "@/shared/stores/auth"

/** Fetch privately: a bearer token never appears in a URL or a new browser tab. */
export async function fetchReceipt(receiptPath: string, signal?: AbortSignal): Promise<Blob> {
  const api = new URL(GRAPHQL_URL, window.location.origin)
  const url = new URL(receiptPath, api.origin)
  // A response URL must never be allowed to send our access token off-site.
  if (url.origin !== api.origin || !/^\/bank-transfers\/receipts\/[^/]+$/.test(url.pathname)) {
    throw new Error("INVALID_RECEIPT_URL")
  }
  const request = (token: string | null) => fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
    credentials: "omit",
    signal,
  })
  let response = await request(useAuthStore.getState().accessToken ?? getCookie(ACCESS_TOKEN_COOKIE))
  if (response.status === 401) {
    const token = await refreshAccessToken()
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError")
    if (token) response = await request(token)
    if (!token || response.status === 401) {
      await forceLogout()
      throw new Error("UNAUTHORIZED")
    }
  }
  if (!response.ok) throw new Error(`RECEIPT_${response.status}`)
  const blob = await response.blob()
  if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(blob.type)) {
    throw new Error("INVALID_RECEIPT_TYPE")
  }
  return blob
}
