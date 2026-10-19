import { afterEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, render, screen } from "@testing-library/react"
import en from "@/shared/messages/en.json"

/**
 * The sign-in popup, and what it guarantees.
 *
 * **It draws nothing until something opens it.** It is mounted once by
 * `ShopShell`, above every route in the shop — so a popup that rendered its
 * form while closed would put a second `useSearchParams`, a second code
 * cooldown timer and a duplicate set of form ids on every page in the shop.
 *
 * **It asks for a number, and nothing else.** A customer signs in with a phone
 * and a texted code: no password, no email, no separate sign-up card to stack
 * — so there is nothing here to switch to.
 */

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>()
  return {
    ...actual,
    useTranslations: (namespace?: string) =>
      actual.createTranslator({
        locale: "en",
        messages: en as never,
        namespace: namespace as never,
      }),
    useLocale: () => "en",
  }
})

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [vi.fn(), { loading: false }],
  useApolloClient: () => ({}),
}))

vi.mock("sileo", () => ({
  sileo: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock("@/features/shop/shop-context", () => ({
  useShop: () => ({
    base: "/acme",
    slug: "acme",
    mode: "path",
    shop: { name: "Acme" },
  }),
}))

const { useAuthDialogStore } = await import("@/shared/stores/auth-dialog")
const { AuthDialog } = await import("../auth-dialog")

/** Opening is a store write from outside React, so it needs its own act. */
function openPopup() {
  act(() => {
    useAuthDialogStore.getState().open("login", "/acme/cart")
  })
}

afterEach(() => {
  cleanup()
  useAuthDialogStore.setState({ stack: [], redirect: null })
})

describe("the sign-in popup", () => {
  it("renders nothing while closed", () => {
    render(<AuthDialog />)

    expect(document.querySelector("[data-slot=dialog-content]")).toBeNull()
    expect(screen.queryByLabelText("Mobile number")).toBeNull()
  })

  it("asks for a mobile number once opened, and for nothing else", () => {
    render(<AuthDialog />)

    openPopup()

    expect(screen.getByLabelText("Mobile number")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Text me a code" })).toBeTruthy()
    // No password, no email, no second card: the number is the way in.
    expect(document.querySelector("input[type=password]")).toBeNull()
    expect(document.querySelector("input[type=email]")).toBeNull()
    expect(screen.queryByRole("button", { name: /create account/i })).toBeNull()
    expect(document.querySelectorAll("[data-slot=dialog-content]")).toHaveLength(1)
    // Captured on open, so the shopper comes back to the page they were on.
    expect(useAuthDialogStore.getState().redirect).toBe("/acme/cart")
  })

  it("closes, and clears the form with it", () => {
    render(<AuthDialog />)
    openPopup()

    act(() => {
      useAuthDialogStore.getState().close()
    })

    expect(screen.queryByLabelText("Mobile number")).toBeNull()
  })
})
