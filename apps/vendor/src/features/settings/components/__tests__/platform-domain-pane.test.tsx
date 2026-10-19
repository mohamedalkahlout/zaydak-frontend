import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

/**
 * The platform subdomain's own page.
 *
 * The thing worth pinning is that this address is reachable and *changeable*
 * at all. It has no `shop_domains` row, so every action keyed off an `id`
 * skipped it: the row opened nothing, and once a custom domain was promoted
 * the only way to make `<slug>.<root>` the shop's address again was to delete
 * that domain. A sentinel id gives it a URL, and `clearPrimaryShopDomain`
 * gives it a way back — it takes no argument precisely because the address it
 * promotes has nothing to name.
 *
 * (No jest-dom in this project — assertions use plain DOM properties.)
 */

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

vi.mock("next/navigation", () => ({
  useParams: () => ({ shopSlug: "acme" }),
}))

vi.mock("sileo", () => ({
  sileo: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

let shop: any = {
  id: "s1",
  name: "Acme",
  slug: "acme",
  logo: null,
  is_active: true,
  is_approved: true,
}

vi.mock("../settings-shell", () => ({
  useSettingsShop: () => shop,
}))

let rows: any[] = []
let loading = false
const clearPrimary = vi.fn().mockResolvedValue({ data: {} })
const setPrimary = vi.fn().mockResolvedValue({ data: {} })

/** Operation name off a gql document, so each mutation is told apart. */
function opName(doc: any): string {
  return doc?.definitions?.find((d: any) => d.kind === "OperationDefinition")
    ?.name?.value ?? ""
}

vi.mock("@apollo/client/react", () => ({
  useQuery: () => ({ data: { shopDomains: { data: rows } }, loading }),
  useMutation: (doc: any) =>
    opName(doc) === "ClearPrimaryShopDomain"
      ? [clearPrimary, { loading: false }]
      : [setPrimary, { loading: false }],
}))

import {
  SettingsHeaderSlotsProvider,
  useSettingsHeaderSlotTargets,
} from "../settings-header-slots"
import { PlatformDomainPane } from "../platform-domain-pane"

/**
 * The shell's header slots, so the heading, the state pill and the actions the
 * pane portals into them land in the document under test.
 */
function Harness({ children }: { children: React.ReactNode }) {
  const { slots, setTitle, setActions } = useSettingsHeaderSlotTargets()
  return (
    <SettingsHeaderSlotsProvider value={slots}>
      <div data-testid="title-slot" ref={setTitle} />
      <div data-testid="actions-slot" ref={setActions} />
      {children}
    </SettingsHeaderSlotsProvider>
  )
}

const platform = (over: Record<string, unknown> = {}) => ({
  id: null,
  hostname: "acme.zaydak.com",
  kind: "PLATFORM_SUBDOMAIN",
  status: "ACTIVE",
  is_primary: true,
  ...over,
})

const custom = (over: Record<string, unknown> = {}) => ({
  id: "dom_1",
  hostname: "acme.com",
  kind: "CUSTOM",
  status: "ACTIVE",
  is_primary: false,
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  loading = false
  shop = {
    id: "s1",
    name: "Acme",
    slug: "acme",
    logo: null,
    is_active: true,
    is_approved: true,
  }
  rows = [platform(), custom()]
})

describe("PlatformDomainPane", () => {
  it("names the address and says the platform manages it", () => {
    render(
      <Harness>
        <PlatformDomainPane />
      </Harness>,
    )
    expect(screen.queryAllByText("acme.zaydak.com").length).toBeGreaterThan(0)
    expect(screen.queryByText(/Managed by the platform/)).not.toBeNull()
  })

  it("offers no DNS setup, because there is none to do", () => {
    // Nobody points `<slug>.<root>` anywhere — the platform already answers for
    // it — so a records table, a readiness check or a Verify button here would
    // each be an empty box or a lie. That is why this is its own pane rather
    // than the domain screen with things hidden.
    render(
      <Harness>
        <PlatformDomainPane />
      </Harness>,
    )
    expect(screen.queryByRole("button", { name: "I updated DNS records" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Check again" })).toBeNull()
    expect(screen.queryByText("Delete domain")).toBeNull()
  })

  it("hands primacy back to itself when a custom domain holds it", async () => {
    // The whole reason the page exists. `clearPrimaryShopDomain` takes no
    // argument: clearing every custom primary flag *is* promoting this address,
    // which is the state the shop was in before anything was promoted.
    rows = [platform({ is_primary: false }), custom({ is_primary: true })]
    render(
      <Harness>
        <PlatformDomainPane />
      </Harness>,
    )

    expect(screen.queryByText(/Redirects to/)).not.toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Change" }))
    fireEvent.click(screen.getByRole("radio", { name: /^Primary domain/ }))
    fireEvent.click(screen.getByRole("button", { name: "Change domain type" }))

    expect(clearPrimary).toHaveBeenCalled()
    expect(setPrimary).not.toHaveBeenCalled()
  })

  it("cannot be stepped down, because there is nothing to hand primacy to", () => {
    render(
      <Harness>
        <PlatformDomainPane />
      </Harness>,
    )
    fireEvent.click(screen.getByRole("button", { name: "Change" }))

    expect(screen.queryByText(/always serves your store/)).not.toBeNull()

    // Asserted through the confirm rather than the radio's own `disabled`
    // property: Base UI's radio is a button with `aria-disabled`, not a native
    // input, so reading `.disabled` off it is `undefined` either way — which
    // would pass this test against a control that was fully live.
    const option = screen.getByRole("radio", { name: /^Redirecting domain/ })
    expect(option.getAttribute("aria-disabled")).toBe("true")

    fireEvent.click(option)
    expect(
      (screen.getByRole("button", { name: "Change domain type" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
  })

  it("says why the address is not live, rather than calling it a setup step", () => {
    // `PENDING` here is the *storefront* being unapproved or switched off, not
    // DNS. A merchant reading "Needs setup" over an address with nothing to set
    // up would go looking for records that do not exist.
    shop = { ...shop, is_approved: false }
    rows = [platform({ status: "PENDING" }), custom()]
    render(
      <Harness>
        <PlatformDomainPane />
      </Harness>,
    )
    expect(
      screen.queryByText(/once the platform approves your store/),
    ).not.toBeNull()
  })

  it("explains a path-scoped deployment instead of answering 'not found'", () => {
    // The server omits this row when it has no apex configured, so the shop
    // lives at `<storefront>/<handle>` and there is no subdomain to describe.
    rows = [custom()]
    render(
      <Harness>
        <PlatformDomainPane />
      </Harness>,
    )
    expect(screen.queryByText(/No store subdomain on this deployment/)).not.toBeNull()
  })
})
