import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { useLeaveGuardStore } from "@/shared/stores/leave-guard"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"

const upsert = vi.fn(() => Promise.resolve({ data: {} }))
const settingValue = { enabled: true, steps: [60, 1440, 4320] }

vi.mock("../settings-shell", () => ({
  useSettingsShop: () => ({ slug: "acme" }),
}))

vi.mock("@apollo/client/react", () => ({
  useSuspenseQuery: () => ({
    data: {
      setting: {
        success: true,
        data: { key: "abandoned_checkout", value: settingValue },
      },
    },
  }),
  useMutation: () => [upsert, { loading: false }],
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock("sileo", () => ({
  sileo: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import { AbandonedCartsPane } from "../abandoned-carts-pane"

const bar = () => useUnsavedBarStore.getState()

beforeEach(() => {
  vi.clearAllMocks()
  settingValue.enabled = true
  useLeaveGuardStore.setState({ guard: null, pending: null })
  useUnsavedBarStore.getState().hide()
})

describe("AbandonedCartsPane", () => {
  it("shows the save bar when the switch flips and writes abandoned_checkout", async () => {
    render(<AbandonedCartsPane />)
    fireEvent.click(screen.getByRole("switch"))
    expect(bar().active).toBe(true)

    await act(async () => {
      await bar().onSave?.()
    })

    expect(upsert).toHaveBeenCalledWith({
      variables: {
        input: {
          key: "abandoned_checkout",
          value: { enabled: false, steps: [60, 1440, 4320] },
        },
      },
      refetchQueries: expect.any(Array),
    })
  })

  it("collapses the bar when the switch is reverted", () => {
    render(<AbandonedCartsPane />)
    fireEvent.click(screen.getByRole("switch"))
    expect(bar().active).toBe(true)
    fireEvent.click(screen.getByRole("switch"))
    expect(bar().active).toBe(false)
  })

  it("links to the marketing abandoned-carts list, not a second table here", () => {
    render(<AbandonedCartsPane />)
    const link = screen.getByRole("link", { name: "Open abandoned carts" })
    expect(link.getAttribute("href")).toBe("/store/acme/marketing/carts")
    expect(screen.queryByRole("table")).toBeNull()
  })
})
