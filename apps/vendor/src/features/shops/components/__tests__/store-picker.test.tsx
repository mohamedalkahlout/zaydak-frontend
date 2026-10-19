import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import type { Shop } from "../../types"

/**
 * The picker is the first screen after sign-in, and what these tests pin is
 * everything it does beyond listing rows: the account menu that used to be a
 * static chip, the keyboard model (`/` into the search box, arrows down the
 * list, Escape back out), and the one-link-per-row hint on a store that still
 * carries the name or handle creation gave it.
 *
 * Boundaries are mocked rather than provided (the repo's component-test
 * convention); translations return `namespace.key`, so assertions read as
 * keys. `StoreFrame` mounts a WebGL canvas, which jsdom cannot give, so the
 * shader ground is mocked away.
 *
 * (No jest-dom in this project — assertions use plain DOM properties.)
 */

const push = vi.fn()
const refresh = vi.fn()
const setSlug = vi.fn()
const logoutMock = vi.fn(() => Promise.resolve())
const changeLocale = vi.fn()

let shops: Shop[] = []
let loading = false

/** Operation name off a gql document, so each query is keyed to its fixture. */
function opName(doc: any): string {
  return doc?.definitions?.[0]?.name?.value ?? ""
}

vi.mock("@apollo/client/react", () => ({
  // `useSwitchShop` asks the client for its in-flight tracker; an unregistered
  // client has none, which is the "nothing to wait for" path this screen takes.
  useApolloClient: () => ({}),
  useQuery: (doc: any) => {
    if (opName(doc) === "GetMe") {
      return {
        data: {
          me: {
            success: true,
            data: {
              id: "u1",
              name: "Jane Doe",
              email: "jane@example.com",
              role: "vendor",
            },
          },
        },
        loading: false,
      }
    }
    return {
      data: loading ? undefined : { myShops: { success: true, data: shops } },
      loading,
    }
  },
}))

vi.mock("next-intl", () => ({
  useTranslations:
    (ns?: string) => (key: string, vars?: Record<string, unknown>) => {
      const full = ns ? `${ns}.${key}` : key
      return vars ? `${full}:${JSON.stringify(vars)}` : full
    },
  useLocale: () => "en",
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh, prefetch: vi.fn() }),
}))

// An anchor that swallows navigation: jsdom implements none and would log a
// "not implemented" error on every click of a hint link.
vi.mock("next/link", () => ({
  default: ({ children, href, onClick, ...rest }: any) => (
    <a
      href={href}
      onClick={(event) => {
        onClick?.(event)
        event.preventDefault()
      }}
      {...rest}
    >
      {children}
    </a>
  ),
}))

vi.mock("@/shared/components/app-image", () => ({
  default: ({ alt, ...rest }: any) => <img alt={alt} {...rest} />,
}))

vi.mock("@repo/ui/components/shader-background", () => ({
  ShaderBackground: () => null,
}))

vi.mock("@/shared/stores/active-shop", () => ({
  useActiveShopStore: (sel: any) => sel({ slug: null, setSlug }),
}))

vi.mock("@/shared/lib/auth/use-logout", () => ({
  useLogout: () => logoutMock,
}))

vi.mock("@/shared/i18n/client", () => ({
  useChangeLocale: () => ({
    locale: "en",
    change: changeLocale,
    pending: false,
  }),
}))

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }))

const { StorePicker } = await import("../store-picker")
const { sileo } = await import("sileo")

const shop = (over: Partial<Shop> & Pick<Shop, "id" | "name" | "slug">): Shop => ({
  is_active: true,
  is_approved: true,
  logo: null,
  ...over,
})

/**
 * Four stores that between them cover every row shape: a finished one, a
 * fresh one (placeholder name *and* generated handle — the name must win), a
 * suspended one, and a renamed one still on its generated handle.
 */
const FIXTURE: Shop[] = [
  shop({ id: "s1", name: "Acme", slug: "acme" }),
  shop({
    id: "s2",
    name: "My Store",
    slug: "3f9a1c2b7d4e",
    is_active: false,
    is_approved: false,
  }),
  shop({ id: "s3", name: "Beta", slug: "beta-shop", is_active: false }),
  shop({ id: "s4", name: "Gamma", slug: "3f9a1c2b7d4e-1" }),
]

beforeAll(() => {
  // Base UI positions its popups with floating-ui, which measures the anchor.
  // jsdom ships no ResizeObserver, and without one the popup never mounts.
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  shops = FIXTURE
  loading = false
})

const searchBox = () =>
  screen.getByRole("searchbox", {
    name: "shops.searchPlaceholder",
  }) as HTMLInputElement

/** The row buttons, in list order — never the hint links beside them. */
const rows = () =>
  screen
    .getAllByRole("button")
    .filter((el) => el.hasAttribute("data-shop")) as HTMLButtonElement[]

const accountTrigger = () =>
  screen.getByRole("button", { name: "shops.accountMenu" })

describe("StorePicker — the list", () => {
  it("opens a store by setting the active slug and pushing its dashboard", () => {
    render(<StorePicker />)
    fireEvent.click(screen.getByText("Acme"))
    expect(setSlug).toHaveBeenCalledWith("acme")
    expect(push).toHaveBeenCalledWith("/store/acme")
  })

  it("filters to Inactive by hiding every approved-and-switched-on store", async () => {
    render(<StorePicker />)
    expect(rows()).toHaveLength(4)

    fireEvent.click(screen.getByRole("button", { name: "shops.filter.label" }))
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "shops.filter.inactive" }),
    )

    const names = rows().map((row) => row.textContent)
    expect(names.some((n) => n?.includes("My Store"))).toBe(true)
    expect(names.some((n) => n?.includes("Beta"))).toBe(true)
    expect(names.some((n) => n?.includes("Acme"))).toBe(false)
    expect(names.some((n) => n?.includes("Gamma"))).toBe(false)
  })

  it("searches the slug as well as the name", () => {
    render(<StorePicker />)
    fireEvent.change(searchBox(), { target: { value: "beta-shop" } })
    expect(rows()).toHaveLength(1)
    expect(rows()[0]!.textContent).toContain("Beta")
  })

  it("says which of pending and suspended a store is", () => {
    render(<StorePicker />)
    expect(screen.getByText("shops.pending")).not.toBeNull()
    expect(screen.getByText("shops.suspended")).not.toBeNull()
  })
})

describe("StorePicker — the account menu", () => {
  it("is a labelled menu button carrying the initials", () => {
    render(<StorePicker />)
    const trigger = accountTrigger()
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu")
    expect(trigger.textContent).toContain("JD")
    expect(trigger.textContent).toContain("Jane Doe")
  })

  it("names the account it opens for", async () => {
    render(<StorePicker />)
    fireEvent.click(accountTrigger())
    const menu = await screen.findByRole("menu")
    expect(within(menu).getByText("Jane Doe")).not.toBeNull()
    expect(within(menu).getByText("jane@example.com")).not.toBeNull()
  })

  it("logs out with a toast first, so the confirmation is seen before the redirect", async () => {
    render(<StorePicker />)
    fireEvent.click(accountTrigger())
    fireEvent.click(await screen.findByRole("menuitem", { name: "header.logOut" }))
    expect(sileo.success).toHaveBeenCalledWith({ title: "header.loggedOut" })
    expect(logoutMock).toHaveBeenCalledTimes(1)
  })

  it("routes Change password to the dashboard's change-password screen", async () => {
    render(<StorePicker />)
    fireEvent.click(accountTrigger())
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "header.changePassword" }),
    )
    expect(push).toHaveBeenCalledWith("/store/change-password")
  })

  it("offers both locales and changes to the one picked", async () => {
    render(<StorePicker />)
    fireEvent.click(accountTrigger())
    const options = await screen.findAllByRole("menuitemradio")
    expect(options.map((o) => o.textContent)).toEqual(["English", "العربية"])
    expect(options[0]!.getAttribute("aria-checked")).toBe("true")

    fireEvent.click(options[1]!)
    expect(changeLocale).toHaveBeenCalledWith("ar")
  })
})

describe("StorePicker — the keyboard", () => {
  it("lands in the search box on / from anywhere on the page", () => {
    render(<StorePicker />)
    expect(document.activeElement).not.toBe(searchBox())
    const handled = !fireEvent.keyDown(window, { key: "/" })
    expect(handled).toBe(true)
    expect(document.activeElement).toBe(searchBox())
  })

  it("lets a / typed into the box be a /", () => {
    render(<StorePicker />)
    searchBox().focus()
    // Not prevented, so the browser inserts the character.
    expect(fireEvent.keyDown(searchBox(), { key: "/" })).toBe(true)
  })

  it("leaves / alone while a menu is open", async () => {
    render(<StorePicker />)
    fireEvent.click(accountTrigger())
    const menu = await screen.findByRole("menu")
    // The menu's typeahead owns the key (Base UI prevents it itself); what
    // matters is that the shortcut does not pull focus out from under it.
    fireEvent.keyDown(menu, { key: "/" })
    expect(document.activeElement).not.toBe(searchBox())
  })

  it("also answers Cmd/Ctrl+K", () => {
    render(<StorePicker />)
    fireEvent.keyDown(window, { key: "k", metaKey: true })
    expect(document.activeElement).toBe(searchBox())
    searchBox().blur()
    fireEvent.keyDown(window, { key: "K", ctrlKey: true })
    expect(document.activeElement).toBe(searchBox())
  })

  it("enters the list with ArrowDown and walks it with the arrows, Home and End", () => {
    render(<StorePicker />)
    const [first, second, third, last] = rows()
    expect(rows()).toHaveLength(4)

    searchBox().focus()
    fireEvent.keyDown(searchBox(), { key: "ArrowDown" })
    expect(document.activeElement).toBe(first)

    fireEvent.keyDown(first!, { key: "ArrowDown" })
    expect(document.activeElement).toBe(second)
    // Down skips the hint link beside the fresh store — it is not a row.
    fireEvent.keyDown(second!, { key: "ArrowDown" })
    expect(document.activeElement).toBe(third)
    fireEvent.keyDown(third!, { key: "ArrowUp" })
    expect(document.activeElement).toBe(second)

    fireEvent.keyDown(second!, { key: "End" })
    expect(document.activeElement).toBe(last)
    // Down from the last row wraps to the top.
    fireEvent.keyDown(last!, { key: "ArrowDown" })
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(first!, { key: "End" })
    fireEvent.keyDown(last!, { key: "Home" })
    expect(document.activeElement).toBe(first)
  })

  it("goes back to the search box from the first row rather than wrapping", () => {
    render(<StorePicker />)
    const first = rows()[0]!
    first.focus()
    fireEvent.keyDown(first, { key: "ArrowUp" })
    expect(document.activeElement).toBe(searchBox())
  })

  it("clears the search on Escape before it gives up focus", () => {
    render(<StorePicker />)
    fireEvent.change(searchBox(), { target: { value: "beta" } })
    expect(rows()).toHaveLength(1)
    searchBox().focus()

    fireEvent.keyDown(searchBox(), { key: "Escape" })
    expect(searchBox().value).toBe("")
    expect(rows()).toHaveLength(4)
    expect(document.activeElement).toBe(searchBox())

    fireEvent.keyDown(searchBox(), { key: "Escape" })
    expect(document.activeElement).not.toBe(searchBox())
  })

  it("shows the / badge only while the box is empty", () => {
    const { container } = render(<StorePicker />)
    expect(container.querySelector("kbd")).not.toBeNull()
    fireEvent.change(searchBox(), { target: { value: "a" } })
    expect(container.querySelector("kbd")).toBeNull()
  })
})

describe("StorePicker — the setup hints", () => {
  /**
   * The setup hints, and only those. A bare `screen.queryAllByRole("link")`
   * would also return the brand anchor `StoreFrame` puts in the page header
   * (`AppLogo href="/shops"`, labelled "Home"). That header precedes `<main>`,
   * so the brand would be `hintLinks()[0]` — every count one too high, and the
   * first "link" clicked would be the logo rather than a hint. A hint can only
   * ever appear on a store row, so the search is scoped to the store list; the
   * brand link is asserted on its own below, so this narrowing hides nothing.
   */
  const hintLinks = () =>
    within(screen.getByRole("list")).queryAllByRole(
      "link",
    ) as HTMLAnchorElement[]

  it("has the frame's brand link on the page, and not among the hints", () => {
    render(<StorePicker />)
    const brand = screen.getByRole("link", { name: "Home" })
    expect(brand.getAttribute("href")).toBe("/shops")
    expect(hintLinks().includes(brand)).toBe(false)
  })

  it("sends a store still called by the placeholder to Settings > General, even on a generated handle", () => {
    render(<StorePicker />)
    const link = hintLinks().find((a) =>
      a.getAttribute("href")!.startsWith("/store/3f9a1c2b7d4e/"),
    )!
    expect(link.getAttribute("href")).toBe("/store/3f9a1c2b7d4e/settings/general")
    expect(link.textContent).toContain("shops.hint.name")
    expect(link.getAttribute("title")).toBe(
      'shops.hint.nameTitle:{"name":"My Store"}',
    )
  })

  it("sends a renamed store still on its generated handle to Settings > Domains", () => {
    render(<StorePicker />)
    const link = hintLinks().find((a) =>
      a.getAttribute("href")!.startsWith("/store/3f9a1c2b7d4e-1/"),
    )!
    expect(link.getAttribute("href")).toBe(
      "/store/3f9a1c2b7d4e-1/settings/domains",
    )
    expect(link.textContent).toContain("shops.hint.handle")
    expect(link.getAttribute("title")).toBe("shops.hint.handleTitle")
  })

  it("puts no hint on a store with a chosen name and handle", () => {
    render(<StorePicker />)
    expect(hintLinks()).toHaveLength(2)
    expect(
      hintLinks().some((a) => a.getAttribute("href")!.includes("/store/acme/")),
    ).toBe(false)
    expect(
      hintLinks().some((a) =>
        a.getAttribute("href")!.includes("/store/beta-shop/"),
      ),
    ).toBe(false)
  })

  it("keeps the hint outside the row button and scopes the dashboard when followed", () => {
    render(<StorePicker />)
    const link = hintLinks()[0]!
    expect(link.closest("button")).toBeNull()

    fireEvent.click(link)
    expect(setSlug).toHaveBeenCalledWith("3f9a1c2b7d4e")
    expect(push).toHaveBeenCalledWith(
      "/store/3f9a1c2b7d4e/settings/general",
    )
  })
})
