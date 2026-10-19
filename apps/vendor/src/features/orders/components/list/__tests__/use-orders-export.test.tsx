import { afterEach, describe, expect, it, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"

/**
 * "Export orders" downloads the list on screen from the streamed CSV route:
 * the list's filters and sort, without the page, and every matching order.
 */

const csv = vi.hoisted(() => ({ downloadCsv: vi.fn() }))
const toast = vi.hoisted(() => ({ error: vi.fn(), warning: vi.fn() }))
const auth = vi.hoisted(() => ({ token: "tok" as string | null }))
const shop = vi.hoisted(() => ({ slug: "entaj" as string | null }))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)
vi.mock("@/shared/lib/csv", () => csv)
vi.mock("sileo", () => ({ sileo: toast }))
vi.mock("@/shared/stores/auth", () => ({
  useAuthStore: { getState: () => ({ accessToken: auth.token }) },
}))
vi.mock("@/shared/stores/active-shop", () => ({
  useActiveShopStore: { getState: () => ({ slug: shop.slug }) },
}))
vi.mock("@/shared/lib/apollo/tunnel-headers", () => ({
  tunnelHeaders: () => ({ "ngrok-skip-browser-warning": "1" }),
}))
vi.mock("@/shared/i18n/outside-react", () => ({
  documentLocale: () => "en",
}))

const { useOrdersExport } = await import("../use-orders-export")

afterEach(() => {
  csv.downloadCsv.mockReset()
  toast.error.mockReset()
  toast.warning.mockReset()
  auth.token = "tok"
  shop.slug = "entaj"
  vi.unstubAllGlobals()
})

describe("useOrdersExport", () => {
  it("asks the streamed route for the list's filters and downloads the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "order_number,total\nTRK-1,124.25",
    })
    vi.stubGlobal("fetch", fetchMock)
    const { result } = renderHook(() =>
      useOrdersExport({
        order_status: "order-completed",
        channel: "TELEGRAM",
        created_from: "2026-09-01T00:00:00.000Z",
        sort_by: "total",
        sort_order: "asc",
        page: 3,
        limit: 15,
      }),
    )

    await act(() => result.current.exportOrders())

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const parsed = new URL(url)
    expect(parsed.pathname).toBe("/api/v1/orders/export.csv")
    expect(parsed.searchParams.get("order_status")).toBe("order-completed")
    expect(parsed.searchParams.get("channel")).toBe("TELEGRAM")
    expect(parsed.searchParams.get("created_from")).toBe(
      "2026-09-01T00:00:00.000Z",
    )
    expect(parsed.searchParams.get("sort_by")).toBe("total")
    expect(parsed.searchParams.get("sort_order")).toBe("asc")
    expect(parsed.searchParams.has("page")).toBe(false)
    expect(parsed.searchParams.has("limit")).toBe(false)
    expect(init.headers).toMatchObject({
      Authorization: "Bearer tok",
      "X-SHOP": "entaj",
    })
    expect(csv.downloadCsv).toHaveBeenCalledTimes(1)
    const [name, body] = csv.downloadCsv.mock.calls[0] as [string, string]
    expect(name).toMatch(/^orders-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(body).toContain("TRK-1,124.25")
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it("does not download when the request is refused", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, text: async () => "" }),
    )
    const { result } = renderHook(() => useOrdersExport({}))

    await act(() => result.current.exportOrders())

    expect(csv.downloadCsv).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalled()
  })

  it("does not call the API when there is no session", async () => {
    auth.token = null
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const { result } = renderHook(() => useOrdersExport({}))

    await act(() => result.current.exportOrders())

    expect(fetchMock).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalled()
  })
})
