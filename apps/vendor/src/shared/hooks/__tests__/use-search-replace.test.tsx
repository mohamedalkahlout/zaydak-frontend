import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, renderHook } from "@testing-library/react"

let committed = ""
const replace = vi.fn()

vi.mock("next/navigation", () => ({
  usePathname: () => "/store/acme/coupons",
  useSearchParams: () => new URLSearchParams(committed),
  useRouter: () => ({ replace }),
}))

const { useSearchReplace } = await import("../use-search-replace")

describe("useSearchReplace", () => {
  beforeEach(() => {
    committed = "statuses=active"
    replace.mockReset()
  })

  it("does not replace when the query string is already the base", () => {
    const { result } = renderHook(() => useSearchReplace())
    act(() => {
      result.current.replaceSearch(new URLSearchParams("statuses=active"))
    })
    expect(replace).not.toHaveBeenCalled()
  })

  it("replaces without scrolling and treats the write as in flight until the URL lands", () => {
    const { result, rerender } = renderHook(() => useSearchReplace())

    act(() => {
      result.current.replaceSearch(new URLSearchParams())
    })

    expect(replace).toHaveBeenCalledWith("/store/acme/coupons", {
      scroll: false,
    })
    expect(result.current.writeInFlight).toBe(true)
    expect(result.current.base).toBe("")

    committed = ""
    rerender()
    expect(result.current.writeInFlight).toBe(false)
  })
})
