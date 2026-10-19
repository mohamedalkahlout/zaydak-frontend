import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { useLeaveGuardStore } from "@/shared/stores/leave-guard"

// The shell is a layout: it derives "where am I" from the pathname and has no
// section state of its own, so what is worth pinning is that derivation — the
// rail entry that lights up, the heading, the breadcrumb under General — plus
// the two ways out (the X and Escape) and the one time Escape must stand down.
//
// Boundaries are mocked rather than provided (the repo's component-test
// convention); translations return their key, so assertions read as keys and
// an en/ar edit by another feature cannot break them.

let pathname = "/store/acme/settings/shipping"
let searchParams = new URLSearchParams()
let shopSlugParam: string | undefined = "acme"
const push = vi.fn()
const replace = vi.fn()
// One object for the whole file, the way Next's router is stable: the shell's
// `?section=` effect lists it as a dependency and must not re-run per render.
const router = { push, replace }

/** Operation name off a gql document, so each query is keyed to its data. */
function opName(doc: any): string {
  return doc?.definitions?.[0]?.name?.value ?? ""
}

// `acme` carries no logo so the initials branch renders.
const SHOPS = [
  { id: "s1", name: "Acme", slug: "acme", logo: null, is_active: true, is_approved: true },
  { id: "s2", name: "Beta", slug: "beta", logo: null, is_active: true, is_approved: true },
]

vi.mock("@apollo/client/react", () => ({
  useSuspenseQuery: (doc: any) =>
    opName(doc) === "MyShops"
      ? { data: { myShops: { success: true, data: SHOPS } } }
      : { data: { me: { data: { name: "Sara Ali", email: "sara@acme.test" } } } },
}))

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useParams: () => ({ shopSlug: shopSlugParam }),
  useRouter: () => router,
  useSearchParams: () => searchParams,
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

// Imported after the mocks are registered.
import { SettingsShell, useSettingsShop } from "../settings-shell"

function renderShell() {
  return render(
    <SettingsShell>
      <div data-testid="pane" />
    </SettingsShell>,
  )
}

function currentLinks(container: HTMLElement) {
  return Array.from(container.querySelectorAll('a[aria-current="page"]'))
}

function railLinks(container: HTMLElement) {
  return Array.from(container.querySelectorAll("nav a"))
}

beforeEach(() => {
  vi.clearAllMocks()
  pathname = "/store/acme/settings/shipping"
  searchParams = new URLSearchParams()
  shopSlugParam = "acme"
  useLeaveGuardStore.getState().disarm()
})

afterEach(() => {
  useLeaveGuardStore.getState().disarm()
})

describe("SettingsShell", () => {
  it("lights the rail entry the URL names, and titles the pane after it", () => {
    const { container } = renderShell()
    const active = currentLinks(container)
    expect(active).toHaveLength(1)
    expect(active[0].getAttribute("href")).toBe("/store/acme/settings/shipping")
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Shipping and delivery")
  })

  it("draws the breadcrumb back to General on a sub-view, with General still lit", () => {
    pathname = "/store/acme/settings/general/brand"
    const { container } = renderShell()
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Brand")
    const back = screen.getByLabelText("General")
    expect(back.getAttribute("href")).toBe("/store/acme/settings/general")
    const active = currentLinks(container)
    expect(active).toHaveLength(1)
    expect(active[0].getAttribute("href")).toBe("/store/acme/settings/general")
  })

  it("draws a breadcrumb back to Domains on a domain's detail screen and leaves the heading to the page", () => {
    // The heading is the hostname, which only the page can know once it has
    // loaded — so the shell mounts an empty title slot rather than a title.
    pathname = "/store/acme/settings/domains/dom_1"
    const { container } = renderShell()
    const back = screen.getByLabelText("Domains")
    expect(back.getAttribute("href")).toBe("/store/acme/settings/domains")
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull()
    expect(container.querySelector("[data-slot=settings-header-title]")).not.toBeNull()
    const active = currentLinks(container)
    expect(active).toHaveLength(1)
    expect(active[0].getAttribute("href")).toBe("/store/acme/settings/domains")
  })

  it("lets a page mount its own header content through the slots", async () => {
    pathname = "/store/acme/settings/domains/dom_1"
    const { SettingsHeaderActions, SettingsHeaderTitle } = await import(
      "../settings-header-slots"
    )
    const { container } = render(
      <SettingsShell>
        <SettingsHeaderTitle>
          <h1>acme.com</h1>
        </SettingsHeaderTitle>
        <SettingsHeaderActions>
          <button type="button">View</button>
        </SettingsHeaderActions>
      </SettingsShell>,
    )
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("acme.com")
    const actions = container.querySelector("[data-slot=settings-header-actions]")
    expect(actions?.querySelector("button")?.textContent).toBe("View")
    expect(container.querySelector("[data-slot=settings-header-title] h1")).not.toBeNull()
  })

  it("titles the contact sub-view after the card it opened from", () => {
    pathname = "/store/acme/settings/general/contact"
    renderShell()
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Store contact details")
  })

  it("falls back to the overlay title with nothing lit when the path is not a section", () => {
    pathname = "/store/acme/orders"
    const { container } = renderShell()
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Settings")
    expect(currentLinks(container)).toHaveLength(0)
  })

  it("filters the rail by the translated label and says so when nothing matches", () => {
    const { container } = renderShell()
    const input = screen.getByPlaceholderText("Search")
    fireEvent.change(input, { target: { value: "ship" } })
    const links = railLinks(container)
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute("href")).toBe("/store/acme/settings/shipping")

    fireEvent.change(input, { target: { value: "zzz" } })
    expect(railLinks(container)).toHaveLength(0)
    expect(screen.getByText("No matches")).toBeTruthy()
  })

  it("closes to the shop's dashboard from the X", () => {
    renderShell()
    fireEvent.click(screen.getByRole("button", { name: "Close settings" }))
    expect(push).toHaveBeenCalledWith("/store/acme")
  })

  it("closes on Escape, except while a dialog is mounted", () => {
    renderShell()
    fireEvent.keyDown(window, { key: "Escape" })
    expect(push).toHaveBeenCalledTimes(1)

    // The address dialog's own Escape has to close the dialog, not throw the
    // vendor off the screen behind it.
    const dialog = document.createElement("div")
    dialog.setAttribute("data-slot", "dialog-content")
    document.body.appendChild(dialog)
    try {
      fireEvent.keyDown(window, { key: "Escape" })
      expect(push).toHaveBeenCalledTimes(1)
    } finally {
      dialog.remove()
    }
  })

  it("names the shop in the rail header and the signed-in user in its footer", () => {
    renderShell()
    expect(screen.getByText("Acme")).toBeTruthy()
    expect(screen.getByText("acme")).toBeTruthy()
    expect(screen.getByText("Sara Ali")).toBeTruthy()
    expect(screen.getByText("sara@acme.test")).toBeTruthy()
  })

  it("holds the X and Escape while a leave guard is armed against the exit", () => {
    // The General group arms this while its form is dirty. `router.push` is
    // what the X and Escape call, which no link-click listener can see, so the
    // shell has to ask the guard itself.
    useLeaveGuardStore.getState().arm({ allow: () => false, onLeave: vi.fn() })
    renderShell()
    fireEvent.click(screen.getByRole("button", { name: "Close settings" }))
    fireEvent.keyDown(window, { key: "Escape" })
    expect(push).not.toHaveBeenCalled()
    expect(useLeaveGuardStore.getState().pending?.href).toBe("/store/acme")
  })

  it("drops a stale ?section= from a sub-route instead of obeying it", () => {
    pathname = "/store/acme/settings/general"
    searchParams = new URLSearchParams("section=plan")
    renderShell()
    expect(replace).toHaveBeenCalledTimes(1)
    expect(replace).toHaveBeenCalledWith("/store/acme/settings/general")
    // The path won: General is what is on screen.
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("General")
  })

  it("keeps every other query parameter when it strips ?section=", () => {
    pathname = "/store/acme/settings/general"
    searchParams = new URLSearchParams("section=plan&billing=ok")
    renderShell()
    expect(replace).toHaveBeenCalledWith("/store/acme/settings/general?billing=ok")
  })

  it("leaves the URL alone when there is no ?section= to strip", () => {
    pathname = "/store/acme/settings/shipping"
    searchParams = new URLSearchParams("tab=rates")
    renderShell()
    expect(replace).not.toHaveBeenCalled()
  })
})

describe("useSettingsShop", () => {
  function Probe() {
    const shop = useSettingsShop()
    return <span data-testid="probe">{shop?.slug ?? ""}</span>
  }

  it("returns the shop the URL names", () => {
    shopSlugParam = "beta"
    render(<Probe />)
    expect(screen.getByTestId("probe").textContent).toBe("beta")
  })

  it("falls back to the first shop for a slug that is not one of the vendor's", () => {
    shopSlugParam = "nope"
    render(<Probe />)
    expect(screen.getByTestId("probe").textContent).toBe("acme")
  })

  it("falls back to the first shop when the URL carries no slug", () => {
    shopSlugParam = undefined
    render(<Probe />)
    expect(screen.getByTestId("probe").textContent).toBe("acme")
  })
})
