import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"
import type { NotificationPreferencesResult } from "../../types"

// The preference matrix is a save-bar screen: toggles must stage locally and
// persist only when the bar's onSave runs. These tests drive that contract by
// capturing what the component registers with the store.

const update = vi.fn(() => Promise.resolve({ data: {} }))
const refetch = vi.fn(() =>
  Promise.resolve({ data: { notificationPreferences: { success: true, data: [] } } }),
)
const show = vi.fn()
const hide = vi.fn()
const setError = vi.fn()

let queryData: NotificationPreferencesResult | undefined

vi.mock("@apollo/client/react", () => ({
  useQuery: () => ({ data: queryData, loading: false, refetch }),
  useMutation: () => [update, { loading: false }],
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("@/shared/stores/unsaved-bar", () => ({
  useUnsavedBarStore: (selector: any) => selector({ show, hide, setError }),
}))

import { NotificationPreferences } from "../notification-preferences"
import { NOTIFY_TYPES } from "../../lib/notify-type"

function prefs(
  rows: NotificationPreferencesResult["notificationPreferences"]["data"] = [],
): NotificationPreferencesResult {
  return { notificationPreferences: { success: true, data: rows } }
}

/** The config the component last handed the save bar. */
function lastBarConfig() {
  return show.mock.calls.at(-1)?.[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  queryData = prefs(
    NOTIFY_TYPES.map((type) => ({ notify_type: type, in_app: true, email: false })),
  )
})

describe("NotificationPreferences", () => {
  it("renders an in-app and an email switch for every notify type", () => {
    render(<NotificationPreferences />)
    expect(screen.getAllByRole("switch")).toHaveLength(NOTIFY_TYPES.length * 2)
  })

  it("stages a toggle without firing a mutation", () => {
    render(<NotificationPreferences />)
    fireEvent.click(screen.getAllByRole("switch")[0]!)
    expect(update).not.toHaveBeenCalled()
    expect(show).toHaveBeenCalled()
  })

  it("lets the merchant change message delivery only on explicit Save", async () => {
    render(<NotificationPreferences />)

    expect(
      screen.getByText("New customer messages sent to your store."),
    ).toBeDefined()
    const email = screen.getByRole("switch", {
      name: "Email notifications for Messages",
    })
    expect(email.getAttribute("aria-checked")).toBe("false")

    fireEvent.click(email)
    expect(email.getAttribute("aria-checked")).toBe("true")
    expect(update).not.toHaveBeenCalled()

    act(() => lastBarConfig()?.onSave?.())

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(update).toHaveBeenCalledWith({
      variables: {
        input: {
          notify_type: "MESSAGE",
          in_app: true,
          email: true,
        },
      },
    })
  })

  it("keeps the bar hidden while the draft matches the server", () => {
    render(<NotificationPreferences />)
    expect(hide).toHaveBeenCalled()
    expect(show).not.toHaveBeenCalled()
  })

  it("persists only the changed type when the bar saves", async () => {
    render(<NotificationPreferences />)
    // First switch is ORDER's in-app channel, currently on.
    fireEvent.click(screen.getAllByRole("switch")[0]!)

    lastBarConfig()?.onSave?.()

    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(update).toHaveBeenCalledWith({
      variables: {
        input: {
          notify_type: NOTIFY_TYPES[0],
          in_app: false,
          email: false,
        },
      },
    })
  })

  it("reverts the draft on discard", () => {
    render(<NotificationPreferences />)
    const first = () => screen.getAllByRole("switch")[0]!

    fireEvent.click(first())
    expect(first().getAttribute("aria-checked")).toBe("false")

    // Discard runs from the header bar, outside React's event system.
    act(() => lastBarConfig()?.onDiscard?.())
    expect(first().getAttribute("aria-checked")).toBe("true")
  })

  it("falls back to the server defaults for a type with no stored row", () => {
    queryData = prefs([])
    render(<NotificationPreferences />)
    const switches = screen.getAllByRole("switch")
    // Defaults are in_app on, email off — so every even index is checked.
    expect(switches[0]!.getAttribute("aria-checked")).toBe("true")
    expect(switches[1]!.getAttribute("aria-checked")).toBe("false")
  })
})
