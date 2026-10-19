import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { useLeaveGuardStore } from "@/shared/stores/leave-guard"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import type { SettingsShop } from "../../types"
import {
  bpsToPercentString,
  percentStringToBps,
} from "../taxes-pane"

const update = vi.fn(() => Promise.resolve({ data: {} }))
const refetchQueries = vi.fn(() => Promise.resolve([]))

const SHOP: SettingsShop = {
  id: "s1",
  name: "Acme",
  slug: "acme",
  tax_bps: 1500,
  is_active: true,
  is_approved: true,
  logo: null,
  cover_image: null,
  description: null,
  socials: [],
  owner: { id: "u1", name: "Sara Ali", email: "sara@acme.test" },
  settings: { contact: "", email: "", website: "", location: null, brand: null },
}

vi.mock("../settings-shell", () => ({
  useSettingsShop: () => SHOP,
}))

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [update, { loading: false }],
  useApolloClient: () => ({ refetchQueries }),
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("sileo", () => ({
  sileo: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import { TaxesPane } from "../taxes-pane"

const bar = () => useUnsavedBarStore.getState()

beforeEach(() => {
  vi.clearAllMocks()
  useLeaveGuardStore.setState({ guard: null, pending: null })
  useUnsavedBarStore.getState().hide()
})

describe("tax_bps helpers", () => {
  it("converts bps to a percent string", () => {
    expect(bpsToPercentString(0)).toBe("0")
    expect(bpsToPercentString(1500)).toBe("15")
    expect(bpsToPercentString(1550)).toBe("15.5")
  })

  it("parses percent strings to bps", () => {
    expect(percentStringToBps("15")).toBe(1500)
    expect(percentStringToBps("15.5")).toBe(1550)
    expect(percentStringToBps("")).toBeNull()
    expect(percentStringToBps("abc")).toBeNull()
  })
})

describe("TaxesPane", () => {
  it("shows the save bar when the rate changes and saves tax_bps", async () => {
    render(<TaxesPane />)
    const input = screen.getByRole("textbox") as HTMLInputElement
    expect(input.value).toBe("15")

    fireEvent.change(input, { target: { value: "10" } })
    expect(bar().active).toBe(true)

    await act(async () => {
      await bar().onSave?.()
    })

    expect(update).toHaveBeenCalledWith({
      variables: { slug: "acme", input: { tax_bps: 1000 } },
    })
  })

  it("collapses the bar when the rate is reverted", () => {
    render(<TaxesPane />)
    const input = screen.getByRole("textbox") as HTMLInputElement
    fireEvent.change(input, { target: { value: "10" } })
    expect(bar().active).toBe(true)
    fireEvent.change(input, { target: { value: "15" } })
    expect(bar().active).toBe(false)
  })
})
