import { beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { UnsavedBar, type UnsavedBarLabels } from "@repo/ui/components/unsaved-bar"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"

const labels: UnsavedBarLabels = {
  discard: "Discard",
  save: "Save",
  saving: "Saving...",
  retry: "Retry",
}

describe("Contextual Save Bar (<UnsavedBar />)", () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    useUnsavedBarStore.getState().hide()
  })

  it("renders in inactive hidden state when active is false", () => {
    const { container } = render(
      <UnsavedBar
        active={false}
        label="Unsaved changes"
        saving={false}
        error={null}
        errorNonce={0}
        labels={labels}
      />,
    )

    const bar = container.firstElementChild as HTMLElement
    expect(bar.getAttribute("aria-hidden")).toBe("true")
    expect(bar.className).toContain("pointer-events-none")
    expect(bar.className).toContain("opacity-0")

    const discardBtn = screen.getByRole("button", { name: "Discard", hidden: true })
    const saveBtn = screen.getByRole("button", { name: "Save", hidden: true })
    expect(discardBtn.getAttribute("tabIndex")).toBe("-1")
    expect(saveBtn.getAttribute("tabIndex")).toBe("-1")
  })

  it("renders active save bar with custom label and action buttons", () => {
    const onSave = vi.fn()
    const onDiscard = vi.fn()

    const { container } = render(
      <UnsavedBar
        active={true}
        label="Unsaved product details"
        saving={false}
        error={null}
        errorNonce={0}
        onSave={onSave}
        onDiscard={onDiscard}
        labels={labels}
      />,
    )

    const bar = container.firstElementChild as HTMLElement
    expect(bar.getAttribute("aria-hidden")).toBe("false")
    expect(bar.className).toContain("opacity-100")
    expect(screen.getByText("Unsaved product details")).toBeDefined()

    const saveBtn = screen.getByRole("button", { name: "Save" })
    const discardBtn = screen.getByRole("button", { name: "Discard" })

    expect(saveBtn.getAttribute("tabIndex")).toBe("0")
    expect(discardBtn.getAttribute("tabIndex")).toBe("0")

    fireEvent.click(saveBtn)
    expect(onSave).toHaveBeenCalledTimes(1)

    fireEvent.click(discardBtn)
    expect(onDiscard).toHaveBeenCalledTimes(1)
  })

  it("renders discard as a link when discardHref is provided", () => {
    render(
      <UnsavedBar
        active={true}
        label="Unsaved changes"
        saving={false}
        error={null}
        errorNonce={0}
        discardHref="/store/acme/products"
        labels={labels}
      />,
    )

    const linkBtn = screen.getByRole("button", { name: "Discard" })
    expect(linkBtn.getAttribute("href")).toBe("/store/acme/products")
    expect(linkBtn.tagName.toLowerCase()).toBe("a")
  })

  it("disables save button and displays saving label while saving is in progress", () => {
    const onSave = vi.fn()

    render(
      <UnsavedBar
        active={true}
        label="Saving changes"
        saving={true}
        error={null}
        errorNonce={0}
        onSave={onSave}
        labels={labels}
      />,
    )

    const saveBtn = screen.getByRole("button", { name: "Saving..." })
    expect(saveBtn.hasAttribute("disabled")).toBe(true)

    fireEvent.click(saveBtn)
    expect(onSave).not.toHaveBeenCalled()
  })

  it("renders assertive error state with retry button when error is set", () => {
    const onSave = vi.fn()

    const { container } = render(
      <UnsavedBar
        active={true}
        label="Unsaved changes"
        saving={false}
        error="SKU already exists in store catalog"
        errorNonce={1}
        onSave={onSave}
        labels={labels}
      />,
    )

    const bar = container.firstElementChild as HTMLElement
    expect(bar.getAttribute("aria-live")).toBe("assertive")
    expect(bar.className).toContain("bg-[#5a0a0a]")

    expect(screen.getByText("SKU already exists in store catalog")).toBeDefined()
    const retryBtn = screen.getByRole("button", { name: "Retry" })
    expect(retryBtn).toBeDefined()

    fireEvent.click(retryBtn)
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  describe("useUnsavedBarStore integration", () => {
    it("updates store state when show, update, setError, and hide are dispatched", () => {
      const onSave = vi.fn()
      const onDiscard = vi.fn()

      const store = useUnsavedBarStore.getState()
      expect(store.active).toBe(false)

      store.show({
        label: "Modified inventory",
        saving: false,
        onSave,
        onDiscard,
      })

      let state = useUnsavedBarStore.getState()
      expect(state.active).toBe(true)
      expect(state.label).toBe("Modified inventory")
      expect(state.saving).toBe(false)
      expect(state.error).toBeNull()

      store.update({ saving: true })
      state = useUnsavedBarStore.getState()
      expect(state.saving).toBe(true)

      store.setError("Failed to sync inventory")
      state = useUnsavedBarStore.getState()
      expect(state.error).toBe("Failed to sync inventory")
      expect(state.errorNonce).toBe(1)

      store.hide()
      state = useUnsavedBarStore.getState()
      expect(state.active).toBe(false)
      expect(state.error).toBeNull()
    })
  })
})
