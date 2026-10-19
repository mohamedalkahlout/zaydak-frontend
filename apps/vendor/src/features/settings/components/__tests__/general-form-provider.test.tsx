import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { useLeaveGuardStore } from "@/shared/stores/leave-guard"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import type { SettingsShop } from "../../types"

// The provider's two contracts with the shell above it: the save bar shows
// while the form is dirty (value-based, so re-typing the original collapses
// it), and the leave guard is armed for exactly as long — vouching for the
// three URLs the form is mounted on and nothing else.

const update = vi.fn(() => Promise.resolve({ data: {} }))
const refetchQueries = vi.fn(() => Promise.resolve([]))

const SHOP: SettingsShop = {
  id: "s1",
  name: "Acme",
  slug: "acme",
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

// Imported after the mocks are registered.
import { GeneralFormProvider, useGeneralForm } from "../general-form-provider"

/** A pane stand-in: stages into the shared form the way the real ones do. */
function Probe() {
  const { form } = useGeneralForm()
  return (
    <>
      <button
        type="button"
        onClick={() => form.setValue("name", "Acme Two", { shouldDirty: true })}
      >
        edit
      </button>
      <button
        type="button"
        onClick={() => form.setValue("name", "Acme", { shouldDirty: true })}
      >
        revert
      </button>
      <button
        type="button"
        onClick={() => form.setValue("timezone", "Asia/Dubai", { shouldDirty: true })}
      >
        edit-tz
      </button>
    </>
  )
}

const guard = () => useLeaveGuardStore.getState()
const bar = () => useUnsavedBarStore.getState()

beforeEach(() => {
  vi.clearAllMocks()
  useLeaveGuardStore.setState({ guard: null, pending: null })
  useUnsavedBarStore.getState().hide()
})

describe("GeneralFormProvider", () => {
  it("shows the save bar and arms the leave guard once the form is dirty", () => {
    render(
      <GeneralFormProvider>
        <Probe />
      </GeneralFormProvider>,
    )
    expect(bar().active).toBe(false)
    expect(guard().guard).toBeNull()

    fireEvent.click(screen.getByText("edit"))
    expect(bar().active).toBe(true)
    expect(guard().guard).not.toBeNull()
  })

  it("vouches for the General group's own URLs and for nothing else", () => {
    render(
      <GeneralFormProvider>
        <Probe />
      </GeneralFormProvider>,
    )
    fireEvent.click(screen.getByText("edit"))
    const { allow } = guard().guard!
    expect(allow("/store/acme/settings/general")).toBe(true)
    expect(allow("/store/acme/settings/general/contact")).toBe(true)
    expect(allow("/store/acme/settings/general/brand")).toBe(true)
    expect(allow("/store/acme/settings/shipping")).toBe(false)
    expect(allow("/store/acme")).toBe(false)
    expect(allow("/store/acme/orders")).toBe(false)
  })

  it("disarms when the edit is typed back to the server value", () => {
    // Dirty is value-based: the bar and the guard both follow the value, not
    // the fact that a key was pressed.
    render(
      <GeneralFormProvider>
        <Probe />
      </GeneralFormProvider>,
    )
    fireEvent.click(screen.getByText("edit"))
    fireEvent.click(screen.getByText("revert"))
    expect(bar().active).toBe(false)
    expect(guard().guard).toBeNull()
  })

  it("confirming an exit discards the edit, hides the bar and disarms", () => {
    render(
      <GeneralFormProvider>
        <Probe />
      </GeneralFormProvider>,
    )
    fireEvent.click(screen.getByText("edit"))
    act(() => {
      guard().request("/store/acme/settings/shipping")
    })
    expect(guard().pending?.href).toBe("/store/acme/settings/shipping")

    act(() => {
      guard().confirm()
    })
    expect(bar().active).toBe(false)
    expect(guard().guard).toBeNull()
    expect(guard().pending).toBeNull()
    expect(update).not.toHaveBeenCalled()
  })

  it("submits changed timezone in updateShop mutation", async () => {
    render(
      <GeneralFormProvider>
        <Probe />
      </GeneralFormProvider>,
    )
    fireEvent.click(screen.getByText("edit-tz"))
    expect(bar().active).toBe(true)

    await act(async () => {
      bar().onSave()
    })
    expect(update).toHaveBeenCalledWith({
      variables: {
        slug: "acme",
        input: { timezone: "Asia/Dubai" },
      },
    })
  })
})

