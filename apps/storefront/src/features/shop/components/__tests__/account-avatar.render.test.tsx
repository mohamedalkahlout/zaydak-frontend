import { afterEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"

import messages from "@/shared/messages/en.json"

/**
 * The header's account control, and the split between what the slab shows and
 * what the menu shows.
 *
 * **The slab is always the plain glyph.** It carries the shop's own mark two
 * slabs over, and a second image on the same strip competes with the one that
 * says where you are — so the customer's face is not on the bar at any state.
 * What changes on the slab is only whether the glyph is a link or a menu.
 *
 * **The states that are easy to collapse are the ones that look alike.**
 * `hydrated` is false during SSR *and* during the first client render, because
 * the token cookie can only be read in an effect — so "no session yet" and "no
 * session" must render the same neutral link, or the header flashes "Sign in"
 * at a signed-in customer on every page load. And once a session *is* known,
 * the profile is still a separate request: `user` stays null for its
 * duration, which is a third state that has to degrade to that same glyph
 * rather than to an empty circle.
 *
 * **The initials belong to the menu**, as the heading of the customer's own
 * panel — and the same neutral glyph for a customer who has not given a name,
 * or while the profile is in flight. A shop's customer has no uploaded photo:
 * it is not a platform account. Under the name the menu shows the number the
 * customer signs in with; with no name, the number is the heading.
 *
 * These are pinned together because they are one `if` ladder, and the natural
 * way to break it is to write a "signed in" branch that assumes `user`.
 */

const auth = vi.hoisted(() => ({
  value: {
    user: null as Record<string, unknown> | null,
    isAuthenticated: false,
    hydrated: true,
    loading: false,
  },
}))

vi.mock("@/features/auth/use-current-user", () => ({
  useCurrentUser: () => auth.value,
}))

vi.mock("@/features/cart/use-cart", () => ({
  useCart: () => ({
    cart: null,
    itemCount: 0,
    items: [],
    summary: null,
    loading: false,
    error: undefined,
    mutating: false,
    addItem: vi.fn(),
    setQuantity: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    applyCoupon: vi.fn(),
    removeCoupon: vi.fn(),
    refetch: vi.fn(),
  }),
}))

vi.mock("@/features/shop/shop-context", () => ({
  useShop: () => ({
    slug: "acme",
    base: "/acme",
    shop: { name: "Acme", logo: null },
    loading: false,
    missing: false,
    currency: "USD",
  }),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/acme/products",
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("sileo", () => ({
  sileo: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}))

import { useAuthDialogStore } from "@/shared/stores/auth-dialog"
import { ShopHeader } from "../shop-header"

function renderHeader() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ShopHeader />
    </NextIntlClientProvider>,
  )
}

/**
 * The control is found by its label rather than by role, because `@repo/ui`'s
 * `Button` renders its `nativeButton={false}` anchor with an explicit
 * `role="button"` — so the signed-out control is an `<a href>` that queries as
 * a button, not as a link. Asserting on `href` directly keeps this test about
 * the account states rather than about that quirk.
 */
const control = (label: string) => screen.getByLabelText(label)

/** Open the account menu and wait for its items to mount. */
async function openMenu(label: string) {
  fireEvent.click(control(label))
  await waitFor(() => {
    expect(screen.getByRole("menuitem", { name: /orders/i })).toBeTruthy()
  })
}

/** The avatar at the head of the open account menu. */
const menuAvatar = () =>
  document.querySelector("[data-slot=dropdown-menu-label] [data-slot=avatar]")

/** A signed-in shop customer. */
const customer = (name: string | null = "Sara Nour") => ({
  user: {
    id: "cust-1",
    name,
    phone_e164: "+970599123456",
    email: "sara@example.com",
  },
  isAuthenticated: true,
  hydrated: true,
  loading: false,
})

afterEach(() => {
  cleanup()
  useAuthDialogStore.setState({ stack: [], redirect: null })
  auth.value = {
    user: null,
    isAuthenticated: false,
    hydrated: true,
    loading: false,
  }
})

describe("the header account control", () => {
  it("links to the account before the token cookie has been read", () => {
    auth.value = { ...auth.value, hydrated: false }
    renderHeader()

    const el = control("Account")
    expect(el.getAttribute("href")).toBe("/acme/account")
    // A plain link, not a menu trigger: there is nothing yet to put in a menu,
    // and this is the markup the server rendered too.
    expect(el.hasAttribute("aria-haspopup")).toBe(false)
  })

  it("opens the sign-in popup rather than leaving the page", () => {
    // The popup reads the address bar rather than the router, because the
    // things that open it are event handlers and not all of them are in a
    // component with `usePathname`.
    window.history.pushState({}, "", "/acme/products")
    renderHeader()

    const el = control("Sign in")
    // Not a link: signing in from the header happens over the page the
    // shopper is on, so there is no href to follow and nothing to unmount.
    expect(el.getAttribute("href")).toBe(null)

    fireEvent.click(el)

    expect(useAuthDialogStore.getState().stack).toEqual(["login"])
    // Captured on open, so `completeSignIn` comes back to the page the
    // shopper was standing on rather than the shop home.
    expect(useAuthDialogStore.getState().redirect).toBe("/acme/products")
  })

  it("keeps the neutral glyph while the signed-in profile is still in flight", () => {
    // The session is proven — the cookie is there — but the profile has not
    // answered, so there is no name to take initials from.
    auth.value = { ...auth.value, isAuthenticated: true, loading: true }
    renderHeader()

    // Already a menu, because the session is real; just without a face on it.
    const el = control("Account")
    expect(el.getAttribute("aria-haspopup")).toBe("menu")
    expect(el.querySelector("img")).toBeNull()
  })

  it("keeps the slab a glyph, and puts the initials in the menu", async () => {
    auth.value = customer()
    renderHeader()

    // The trigger is the glyph, never the initials: the slab already carries
    // the shop's own mark.
    const trigger = control("Hi Sara Nour")
    expect(trigger.textContent).toBe("")
    expect(trigger.querySelector("svg")).not.toBeNull()

    await openMenu("Hi Sara Nour")

    // First and last word, so a middle name cannot push the surname out.
    expect(menuAvatar()?.textContent).toBe("SN")
    expect(menuAvatar()?.querySelector("img")).toBeNull()
  })

  it("heads the menu with the number for a customer with no name yet", async () => {
    auth.value = customer(null)
    renderHeader()

    // No name to greet: the generic label, and the glyph rather than initials.
    await openMenu("Account")

    const label = document.querySelector("[data-slot=dropdown-menu-label]")
    expect(label?.textContent).toContain("+970599123456")
    expect(label?.querySelector("[data-slot=avatar]")).toBeNull()
  })

  it("carries no language control of its own on the slab", () => {
    renderHeader()

    // The globe came off the bar deliberately: language lives in the account
    // menu and the notch drawer, and a third route to the same two-item choice
    // is what this asserts stays gone. The consequence — a signed-out visitor
    // at `xl` has neither panel — is tracked in TODO.md.
    expect(screen.queryByRole("radio", { name: "العربية" })).toBeNull()
    expect(screen.queryByLabelText("Change language")).toBeNull()
  })

  it("switches language from inside the menu without closing it", async () => {
    auth.value = customer()
    renderHeader()

    fireEvent.click(control("Hi Sara Nour"))
    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: /orders/i })).toBeTruthy()
    })

    const arabic = screen.getByRole("radio", { name: "العربية" })
    expect(arabic.getAttribute("aria-checked")).toBe("false")
    // Its own `lang`, so the browser picks the Arabic face for this word while
    // the rest of the menu is still English.
    expect(arabic.getAttribute("lang")).toBe("ar")

    fireEvent.click(arabic)

    // The menu must survive the press. Switching language re-renders the
    // chrome, and watching this panel flip script is the confirmation that it
    // worked — a menu that slams shut sends the shopper to check the page
    // behind it instead. A `DropdownMenuItem` would have closed it, which is
    // why the segments are plain buttons.
    expect(screen.getByRole("menuitem", { name: /orders/i })).toBeTruthy()
    expect(screen.getByRole("radio", { name: "العربية" })).toBeTruthy()
  })

  it("opens the account menu when the circle is clicked", async () => {
    auth.value = customer()
    renderHeader()

    fireEvent.click(control("Hi Sara Nour"))

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: /orders/i })).toBeTruthy()
    })
    // The number the customer signs in with is the menu's, never the slab's —
    // it would not fit on a notch.
    expect(screen.getByText("+970599123456")).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: /addresses/i })).toBeTruthy()
    expect(screen.getByRole("menuitem", { name: /sign out/i })).toBeTruthy()
  })
})
