import { GRAPHQL_URL } from "@/shared/apollo/endpoint"
import { tunnelHeaders } from "@/shared/apollo/tunnel-headers"
import { sessionAccessToken } from "@/shared/auth/access-token"
import { refreshAccessToken } from "@/shared/auth/refresh"
import { forceLogout } from "@/shared/auth/session"
import { STOREFRONT_CLIENT_HEADER } from "@/shared/api/headers"
import { shopPathFor } from "@/shared/lib/shop-scope"
import type { ReceiptFields } from "./receipt-schema"

const API_BASE = GRAPHQL_URL.replace(/\/graphql\/?$/, "")

class ReceiptRequestError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

function errorMessage(body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      message?: string
      validation_errors?: Array<{ messages?: string[] }>
    }
    return parsed.validation_errors?.flatMap((item) => item.messages ?? []).join(" · ") || parsed.message || ""
  } catch { return "" }
}

/** Both upload and download rotate the shop-bound session at most once. */
async function withSession<T>(slug: string, request: (token: string | null) => Promise<T>): Promise<T> {
  try { return await request(sessionAccessToken(slug)) }
  catch (error) {
    if (!(error instanceof ReceiptRequestError) || error.status !== 401) throw error
    const token = await refreshAccessToken(slug)
    if (token) {
      try { return await request(token) }
      catch (retryError) {
        if (!(retryError instanceof ReceiptRequestError) || retryError.status !== 401) throw retryError
      }
    }
    await forceLogout(slug, shopPathFor(slug, "/login?expired=1"))
    throw error
  }
}

export async function uploadReceipt(slug: string, orderId: string, fields: ReceiptFields, onProgress: (percent: number) => void, signal?: AbortSignal): Promise<void> {
  const form = new FormData()
  form.append("file", fields.file)
  form.append("bank_account_id", fields.bank_account_id)
  form.append("sender_name", fields.sender_name)
  form.append("transfer_reference", fields.transfer_reference)
  form.append("transferred_at", new Date(fields.transferred_at).toISOString())
  if (fields.sender_bank_code) form.append("sender_bank_code", fields.sender_bank_code)
  if (fields.note) form.append("note", fields.note)
  if (fields.claimed_amount) form.append("claimed_amount_cents", String(Math.round(Number(fields.claimed_amount) * 100)))

  await withSession(slug, (token) => new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException("Aborted", "AbortError")); return }
    const xhr = new XMLHttpRequest()
    const abort = () => xhr.abort()
    signal?.addEventListener("abort", abort, { once: true })
    xhr.open("POST", `${API_BASE}/bank-transfers/orders/${encodeURIComponent(orderId)}/receipt`)
    xhr.timeout = 120_000
    xhr.setRequestHeader("X-SHOP", slug)
    xhr.setRequestHeader(STOREFRONT_CLIENT_HEADER, "1")
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`)
    for (const [name, value] of Object.entries(tunnelHeaders())) {
      xhr.setRequestHeader(name, value)
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100))
    }
    xhr.onloadend = () => signal?.removeEventListener("abort", abort)
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new ReceiptRequestError(xhr.status, errorMessage(xhr.responseText)))
    }
    xhr.onerror = xhr.ontimeout = () => reject(new ReceiptRequestError(0, ""))
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"))
    xhr.send(form)
  }))
}

/** A returned path cannot send a bearer token to another origin. */
export function receiptEndpoint(path: string): string {
  if (!/^\/bank-transfers\/receipts\/[a-zA-Z0-9_-]+$/.test(path)) throw new Error("Invalid receipt path")
  return `${API_BASE}${path}`
}

export async function downloadReceipt(slug: string, path: string, filename: string): Promise<void> {
  const endpoint = receiptEndpoint(path)
  const blob = await withSession(slug, async (token) => {
    const response = await fetch(endpoint, {
      headers: {
        "X-SHOP": slug,
        [STOREFRONT_CLIENT_HEADER]: "1",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...tunnelHeaders(),
      },
      cache: "no-store",
      redirect: "error",
    })
    if (!response.ok) throw new ReceiptRequestError(response.status, errorMessage(await response.text()))
    return response.blob()
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename || "receipt"
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Keep the Blob alive long enough for the browser to start saving it.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
