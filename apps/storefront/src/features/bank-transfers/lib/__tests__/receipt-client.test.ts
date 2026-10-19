import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { downloadReceipt, receiptEndpoint, uploadReceipt } from "../receipt-client"

const auth = vi.hoisted(() => ({ refresh: vi.fn(), logout: vi.fn(), token: vi.fn() }))
vi.mock("@/shared/auth/access-token", () => ({ sessionAccessToken: auth.token }))
vi.mock("@/shared/auth/refresh", () => ({ refreshAccessToken: auth.refresh }))
vi.mock("@/shared/auth/session", () => ({ forceLogout: auth.logout }))

class FakeXhr {
  static codes: number[] = []
  static requests: FakeXhr[] = []
  headers: Record<string, string> = {}
  upload: { onprogress?: (event: { lengthComputable: boolean; loaded: number; total: number }) => void } = {}
  status = 0
  timeout = 0
  responseText = ""
  onload?: () => void
  onloadend?: () => void
  onabort?: () => void
  onerror?: () => void
  ontimeout?: () => void
  form?: FormData
  url = ""
  open(_method: string, url: string) { this.url = url }
  setRequestHeader(key: string, value: string) { this.headers[key] = value }
  send(form: FormData) {
    this.form = form
    FakeXhr.requests.push(this)
    this.status = FakeXhr.codes.shift() ?? 200
    this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 })
    queueMicrotask(() => { this.onload?.(); this.onloadend?.() })
  }
  abort() { this.onabort?.(); this.onloadend?.() }
}

const fields = () => ({ bank_account_id: "old-account", sender_name: "Sara", transfer_reference: "REF1", transferred_at: "2026-09-09T09:00:00Z", claimed_amount: "20.35", note: "", file: new File(["receipt"], "receipt.pdf", { type: "application/pdf" }) })

beforeEach(() => {
  vi.resetAllMocks()
  FakeXhr.codes = []
  FakeXhr.requests = []
  vi.stubGlobal("XMLHttpRequest", FakeXhr)
  auth.token.mockReturnValue("expired-shop-token")
  auth.refresh.mockResolvedValue("rotated-shop-token")
  auth.logout.mockResolvedValue(undefined)
})
afterEach(() => vi.unstubAllGlobals())

describe("private receipt transport", () => {
  it("retries once with the rotated shop token and preserves the receipt and frozen account", async () => {
    FakeXhr.codes = [401, 201]
    const progress = vi.fn()
    await uploadReceipt("acme", "order-1", fields(), progress)
    expect(auth.refresh).toHaveBeenCalledExactlyOnceWith("acme")
    expect(FakeXhr.requests).toHaveLength(2)
    expect(FakeXhr.requests[1]!.headers).toMatchObject({ "X-SHOP": "acme", Authorization: "Bearer rotated-shop-token" })
    expect(FakeXhr.requests[1]!.form!.get("bank_account_id")).toBe("old-account")
    expect(FakeXhr.requests[1]!.form!.get("claimed_amount_cents")).toBe("2035")
    expect(FakeXhr.requests[1]!.form!.get("file")).toBeInstanceOf(File)
    expect(progress).toHaveBeenCalledWith(50)
  })
  it("signs out only the affected shop after a second unauthorized response", async () => {
    FakeXhr.codes = [401, 401]
    await expect(uploadReceipt("acme", "order-1", fields(), vi.fn())).rejects.toThrow()
    expect(FakeXhr.requests).toHaveLength(2)
    expect(auth.logout).toHaveBeenCalledExactlyOnceWith("acme", "/acme/login?expired=1")
  })
  it("never replays a state conflict as a new submission", async () => {
    FakeXhr.codes = [409]
    await expect(uploadReceipt("acme", "order-1", fields(), vi.fn())).rejects.toThrow()
    expect(auth.refresh).not.toHaveBeenCalled()
    expect(FakeXhr.requests).toHaveLength(1)
  })
  it.each(["https://evil.test/receipt", "//evil.test/receipt", "/bank-transfers/receipts/../orders", "/bank-transfers/receipts/id?token=secret"])("rejects a receipt URL that could leak the bearer: %s", (path) => {
    expect(() => receiptEndpoint(path)).toThrow()
  })
  it("downloads through authenticated fetch with caching and redirects disabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => "" })
    vi.stubGlobal("fetch", fetchMock)
    await expect(downloadReceipt("acme", "/bank-transfers/receipts/id123", "receipt.pdf")).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/bank-transfers/receipts/id123"), expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer expired-shop-token", "X-SHOP": "acme" }), cache: "no-store", redirect: "error" }))
  })
})
