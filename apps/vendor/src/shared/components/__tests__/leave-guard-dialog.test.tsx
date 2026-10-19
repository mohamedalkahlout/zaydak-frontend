import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { useLeaveGuardStore } from "@/shared/stores/leave-guard"

// The dialog is the only thing that turns a parked navigation back into a
// real one, so the order it does things in is the contract: `onLeave` first
// (the screen is clean before anything mounts over it), then the exact action
// that was held, or a push of the href when a link click had none.

const push = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

// Imported after the mocks are registered.
import { LeaveGuardDialog } from "../leave-guard-dialog"

const store = () => useLeaveGuardStore.getState()

function park(href: string, proceed?: () => void) {
  act(() => {
    store().request(href, proceed)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  useLeaveGuardStore.setState({ guard: null, pending: null })
})

describe("LeaveGuardDialog", () => {
  it("renders nothing until a navigation is pending", () => {
    render(<LeaveGuardDialog />)
    expect(screen.queryByText("Discard unsaved changes?")).toBeNull()
  })

  it("opens on a parked navigation", () => {
    render(<LeaveGuardDialog />)
    act(() => {
      store().arm({ allow: () => false, onLeave: vi.fn() })
    })
    park("/store/acme/orders")
    expect(screen.getByText("Discard unsaved changes?")).toBeTruthy()
    expect(
      screen.getByText(
        "You have unsaved changes on this screen. If you leave now they will be lost.",
      ),
    ).toBeTruthy()
  })

  it("staying drops the navigation and touches nothing else", () => {
    const onLeave = vi.fn()
    render(<LeaveGuardDialog />)
    act(() => {
      store().arm({ allow: () => false, onLeave })
    })
    park("/store/acme/orders")

    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }))
    expect(store().pending).toBeNull()
    expect(onLeave).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
    // Still armed: the edit is still there.
    expect(store().guard).not.toBeNull()
  })

  it("leaving runs onLeave, then pushes the parked href", () => {
    const calls: string[] = []
    const onLeave = vi.fn(() => calls.push("onLeave"))
    push.mockImplementation(() => calls.push("push"))
    render(<LeaveGuardDialog />)
    act(() => {
      store().arm({ allow: () => false, onLeave })
    })
    park("/store/acme/orders")

    fireEvent.click(screen.getByRole("button", { name: "Discard and leave" }))
    expect(push).toHaveBeenCalledWith("/store/acme/orders")
    expect(calls).toEqual(["onLeave", "push"])
    expect(store().pending).toBeNull()
  })

  it("leaving re-runs the exact action that was held, when there was one", () => {
    const proceed = vi.fn()
    render(<LeaveGuardDialog />)
    act(() => {
      store().arm({ allow: () => false, onLeave: vi.fn() })
    })
    park("/store/beta", proceed)

    fireEvent.click(screen.getByRole("button", { name: "Discard and leave" }))
    expect(proceed).toHaveBeenCalledTimes(1)
    expect(push).not.toHaveBeenCalled()
  })
})
