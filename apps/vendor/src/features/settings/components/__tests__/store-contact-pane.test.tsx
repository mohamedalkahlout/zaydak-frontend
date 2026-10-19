import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { useForm } from "react-hook-form"
import type { GeneralValues, SettingsShop } from "../../types"

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
  useMutation: () => [vi.fn(), { loading: false }],
  useApolloClient: () => ({ refetchQueries: vi.fn() }),
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("sileo", () => ({
  sileo: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import { GeneralFormProvider } from "../general-form-provider"
import { StoreContactPane } from "../store-contact-pane"

function Harness() {
  return (
    <GeneralFormProvider>
      <StoreContactPane />
    </GeneralFormProvider>
  )
}

describe("StoreContactPane format validation", () => {
  it("shows error when email is formatted as a phone or lacks @/domain", async () => {
    render(<Harness />)

    const emailInput = screen.getByPlaceholderText("sara@acme.test")
    fireEvent.change(emailInput, { target: { value: "+966501234567" } })
    fireEvent.blur(emailInput)

    await waitFor(() => {
      expect(screen.getByText("Please enter a valid email address.")).toBeTruthy()
    })

    fireEvent.change(emailInput, { target: { value: "notanemail" } })
    fireEvent.blur(emailInput)

    await waitFor(() => {
      expect(screen.getByText("Please enter a valid email address.")).toBeTruthy()
    })

    fireEvent.change(emailInput, { target: { value: "valid@store.com" } })
    fireEvent.blur(emailInput)

    await waitFor(() => {
      expect(screen.queryByText("Please enter a valid email address.")).toBeNull()
    })
  })

  it("shows error when phone contains @ or invalid phone characters", async () => {
    render(<Harness />)

    const phoneInput = screen.getByPlaceholderText("Add a phone number")
    fireEvent.change(phoneInput, { target: { value: "support@store.com" } })
    fireEvent.blur(phoneInput)

    await waitFor(() => {
      expect(screen.getByText("Please enter a valid phone number.")).toBeTruthy()
    })

    fireEvent.change(phoneInput, { target: { value: "+966 50 123 4567" } })
    fireEvent.blur(phoneInput)

    await waitFor(() => {
      expect(screen.queryByText("Please enter a valid phone number.")).toBeNull()
    })
  })
})
