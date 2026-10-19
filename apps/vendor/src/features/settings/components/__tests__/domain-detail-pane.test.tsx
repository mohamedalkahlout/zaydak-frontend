import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

/**
 * One custom domain's setup screen.
 *
 * The case worth pinning is the return visit: the merchant edited their DNS,
 * pressed "I updated DNS records", was told to try again later, and came back.
 * The records are right, so step one is ticked and its instructions are
 * folded — and the button that advances the stored status must still be on
 * screen, because it is the only thing that does. (No timer re-checks a
 * pending domain, and the configuration query reads DNS without writing.)
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

const push = vi.fn()
const replace = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace }),
  useParams: () => ({ shopSlug: "acme" }),
}))

vi.mock("sileo", () => ({
  sileo: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock("@/shared/components/app-image", () => ({
  default: () => <span data-testid="logo" />,
}))

vi.mock("../settings-shell", () => ({
  useSettingsShop: () => ({
    id: "s1",
    name: "Acme",
    slug: "acme",
    logo: null,
    is_active: true,
    is_approved: true,
  }),
}))

/** Operation name off a gql document, so each query is keyed to its data. */
function opName(doc: any): string {
  return doc?.definitions?.find((d: any) => d.kind === "OperationDefinition")
    ?.name?.value ?? ""
}

const platform = {
  id: null,
  hostname: "acme.zaydak.com",
  kind: "PLATFORM_SUBDOMAIN",
  status: "ACTIVE",
  is_primary: true,
}

let rows: any[] = []
let configuration: any = null
let configError: Error | null = null
let listLoading = false
const refetch = vi.fn()

vi.mock("@apollo/client/react", () => ({
  useQuery: (doc: any) => {
    switch (opName(doc)) {
      case "ShopDomains":
        return { data: { shopDomains: { data: rows } }, loading: listLoading }
      case "ShopDomainConfiguration":
        return {
          data: configuration
            ? { shopDomainConfiguration: { data: configuration } }
            : undefined,
          loading: !configuration && !configError,
          error: configError ?? undefined,
          refetch,
        }
      default:
        return { data: { me: { data: { name: "Sara Ali" } } }, loading: false }
    }
  },
  useMutation: () => [vi.fn(), { loading: false }],
}))

import { DomainDetailPane } from "../domain-detail-pane"
import {
  SettingsHeaderSlotsProvider,
  useSettingsHeaderSlotTargets,
} from "../settings-header-slots"

/**
 * The shell's header slots, so the heading, the state pill and the actions
 * the pane portals into them land in the document under test.
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

function renderPane(domainId: string) {
  return render(
    <Harness>
      <DomainDetailPane domainId={domainId} />
    </Harness>,
  )
}

/**
 * Two resolvers that answered and agree — the quiet default.
 *
 * Every test below is about something else, and a grid full of disagreement
 * would put a second red thing on screen in each of them.
 */
const propagation = {
  checked_at: "2026-09-13T10:00:00.000Z",
  agreement: "FULL",
  resolvers: [
    {
      key: "CLOUDFLARE",
      name: "Cloudflare (1.1.1.1)",
      responded: true,
      agrees: true,
    },
    { key: "GOOGLE", name: "Google (8.8.8.8)", responded: true, agrees: true },
  ],
}

const config = (checks: Partial<Record<string, unknown>> = {}) => ({
  zone_unreachable: false,
  issues: [],
  propagation,
  domain: { id: "dom_1", hostname: "acme.com" },
  dns_provider: {
    provider: "GODADDY",
    display_name: "GoDaddy",
    management_url: "https://dcc.godaddy.com/manage/dns",
  },
  dns_diff: [],
  checks: {
    dns_configured: false,
    dns_propagated: false,
    ownership_verified: false,
    routing_ready: false,
    tls: "PENDING",
    ...checks,
  },
})

beforeEach(() => {
  vi.clearAllMocks()
  listLoading = false
  configError = null
  rows = [
    platform,
    {
      id: "dom_1",
      hostname: "acme.com",
      kind: "CUSTOM",
      status: "VERIFYING",
      is_primary: false,
      created_at: "2026-09-12T10:00:00.000Z",
    },
  ]
  configuration = config()
})

describe("DomainDetailPane", () => {
  it("keeps 'I updated DNS records' on screen when the records are right but the row is not yet active", () => {
    // Step one is done and its report folded; the button must not fold with it.
    configuration = config({ dns_configured: true })
    renderPane("dom_1")

    expect(screen.queryByText("DNS records are pointing to your store")).not.toBeNull()
    expect(screen.queryByRole("button", { name: "I updated DNS records" })).not.toBeNull()
    // Provisioning: the platform's turn, and the pill says so.
    expect(screen.queryByText("Provisioning TLS")).not.toBeNull()
    expect(screen.queryByText("Waiting for the DNS changes to reach every resolver")).not.toBeNull()
  })

  it("reads never-checked DNS as 'needs setup' with the instructions open", () => {
    rows = rows.map((r) => (r.id === "dom_1" ? { ...r, status: "PENDING" } : r))
    renderPane("dom_1")
    expect(screen.queryByText("Needs setup")).not.toBeNull()
    expect(screen.queryByText("Configure DNS records on GoDaddy")).not.toBeNull()
    expect(document.querySelector("[data-variant='setup']")).not.toBeNull()
  })

  it("reads checked-and-wrong DNS as invalid, with the steps below it failed", () => {
    // The row is VERIFYING (Verify was pressed) and the live reading still
    // finds the records wrong.
    renderPane("dom_1")
    expect(screen.getAllByText("Invalid DNS").length).toBeGreaterThan(0)
    expect(screen.queryByText("DNS records not yet detected at GoDaddy")).not.toBeNull()
    expect(screen.queryByText("Verify the DNS records match the values below")).not.toBeNull()
    expect(screen.queryByText("Domain is not live")).not.toBeNull()
    expect(document.querySelector("[data-variant='error']")).not.toBeNull()
    expect(document.querySelectorAll("li[data-icon='error']")).toHaveLength(2)
  })

  it("shows the verified records as a report with an Issue badge when there are warnings", () => {
    rows = rows.map((r) => (r.id === "dom_1" ? { ...r, status: "ACTIVE" } : r))
    configuration = {
      ...config({
        dns_configured: true,
        dns_propagated: true,
        ownership_verified: true,
        routing_ready: true,
        tls: "PROVISIONING",
      }),
      issues: [
        {
          // An unknown code on purpose: this test is about the "Issue" badge
          // and the fold, and a known one would render the catalogue's sentence
          // instead of the fixture's, which is asserted on below.
          code: "DNS_SOMETHING_THIS_APP_DOES_NOT_KNOW",
          severity: "ERROR",
          message: "Your domain is behind a proxy.",
        },
      ],
      dns_diff: [
        {
          action: "CORRECT",
          type: "A",
          name: "@",
          current_value: "76.76.21.21",
          required_value: "76.76.21.21",
          reason: "ok",
        },
      ],
    }
    renderPane("dom_1")
    expect(screen.queryByText("Issue")).not.toBeNull()
    // A warning is never folded away by default.
    expect(screen.queryByText("Your domain is behind a proxy.")).not.toBeNull()
    expect(screen.queryByText("76.76.21.21")).not.toBeNull()
    expect(screen.queryByText("Domain is live")).not.toBeNull()
    expect(screen.queryByText("Provisioning TLS certificate for secure connections")).not.toBeNull()
    expect(screen.queryByText("Estimated: a few minutes")).not.toBeNull()
    expect(document.querySelector("[data-variant='live']")).not.toBeNull()
  })

  it("offers a re-check, not 'I updated DNS records', once the domain serves", () => {
    // A domain can break after activation — the registration lapses, the DNS
    // moves, the CNAME goes. Nobody presses Verify on a domain that works, so
    // the button used to be gated out entirely and the only thing that could
    // write the row back was the nightly sweep: two strikes, up to two days,
    // with a green "Connected" pill above a diff saying the record is missing.
    //
    // The wording changes with it. "I updated DNS records" is a claim about
    // something the merchant just did, which on a domain they have not touched
    // in months is a question they cannot answer.
    rows = rows.map((r) => (r.id === "dom_1" ? { ...r, status: "ACTIVE" } : r))
    configuration = config({
      dns_configured: true,
      dns_propagated: true,
      ownership_verified: true,
      routing_ready: true,
      tls: "READY",
    })
    renderPane("dom_1")
    expect(screen.queryByRole("button", { name: "I updated DNS records" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Check again" })).not.toBeNull()
  })

  // ─── the evidence behind "Domain is live" ─────────────────────────

  // Warnings in the merchant's own language.
  //
  // `code` exists so a locale can key off it; `message` is the server's English
  // and is the fallback, never the identity. The order is load-bearing in one
  // direction: `t()` renders a missing key as the key, so an unguarded lookup
  // would show a merchant the literal string `DNS_CAA_BLOCKED`.

  it("renders the local sentence for a known code, not the server's", () => {
    rows = rows.map((r) => (r.id === "dom_1" ? { ...r, status: "ACTIVE" } : r))
    configuration = {
      ...config({ dns_configured: true }),
      issues: [
        {
          code: "DNS_APEX_CNAME",
          severity: "WARNING",
          message: "SERVER ENGLISH THAT MUST NOT WIN",
          params: { value: "old-host.example" },
        },
      ],
    }
    renderPane("dom_1")

    expect(screen.queryByText(/SERVER ENGLISH/)).toBeNull()
    // The specifics come from `params`, so a catalogue entry can name them.
    expect(
      screen.queryByText(/A root domain cannot use a CNAME/),
    ).not.toBeNull()
    expect(screen.queryByText(/old-host\.example/)).not.toBeNull()
  })

  it("falls back to the server's sentence for a code it has never seen", () => {
    // A back-end that adds a code before this app learns it must degrade to a
    // correct English sentence, never to the code itself.
    rows = rows.map((r) => (r.id === "dom_1" ? { ...r, status: "ACTIVE" } : r))
    configuration = {
      ...config({ dns_configured: true }),
      issues: [
        {
          code: "DNS_SOMETHING_NEW",
          severity: "WARNING",
          message: "A problem this dashboard has not been taught about.",
          params: {},
        },
      ],
    }
    renderPane("dom_1")

    expect(screen.queryByText("DNS_SOMETHING_NEW")).toBeNull()
    expect(
      screen.queryByText("A problem this dashboard has not been taught about."),
    ).not.toBeNull()
  })

  it("names the resolver that is behind while propagation is what is awaited", () => {
    configuration = {
      ...config({ dns_configured: true }),
      propagation: {
        ...propagation,
        agreement: "PARTIAL",
        resolvers: [
          { ...propagation.resolvers[0], agrees: true },
          { ...propagation.resolvers[1], agrees: false },
        ],
      },
    }
    renderPane("dom_1")

    // Open without a click: propagation is the one state where naming the
    // resolver that is behind answers the question the merchant is asking.
    expect(screen.queryByText("What public resolvers see")).not.toBeNull()
    expect(screen.queryByText("Google (8.8.8.8)")).not.toBeNull()
    expect(screen.queryByText("Still sees the old records")).not.toBeNull()
  })

  it("calls a silent resolver silent rather than failing it", () => {
    // Silence is not disagreement, and the advice is opposite: wait, versus
    // nothing to do. A grid that paints a timeout as a conflict sends the
    // merchant back to a DNS editor that has nothing wrong with it.
    configuration = {
      ...config({ dns_configured: true }),
      propagation: {
        ...propagation,
        agreement: "UNKNOWN",
        resolvers: [
          { ...propagation.resolvers[0], agrees: null },
          { ...propagation.resolvers[1], responded: false, agrees: null },
        ],
      },
    }
    renderPane("dom_1")

    expect(screen.queryByText("Did not answer")).not.toBeNull()
    expect(screen.queryByText("Still sees the old records")).toBeNull()
  })

  it("names the provider in the first step and offers its login", () => {
    renderPane("dom_1")
    expect(
      screen.queryByText(/Log in to GoDaddy and open DNS management for/),
    ).not.toBeNull()
    // `Button` with `render={<a/>}` keeps `role="button"` on the anchor, so
    // it is found by its text rather than by the link role.
    const login = screen.getByText("Log in").closest("a")
    expect(login?.getAttribute("href")).toBe("https://dcc.godaddy.com/manage/dns")
    expect(login?.getAttribute("target")).toBe("_blank")
  })

  it("says the address serves alongside the primary while the platform address is primary", () => {
    // The storefront only redirects to a custom domain that is live, so with
    // the platform subdomain primary nothing redirects anywhere.
    renderPane("dom_1")
    expect(screen.queryByText("Online Store")).not.toBeNull()
    expect(screen.queryByText("Serves your store alongside the primary domain")).not.toBeNull()
    expect(screen.queryByText(/Redirects to/)).toBeNull()
    expect(screen.queryByRole("button", { name: "Change" })).not.toBeNull()
  })

  it("says the address redirects to a live custom primary", () => {
    rows = [
      { ...platform, is_primary: false },
      { ...rows[1] },
      {
        id: "dom_9",
        hostname: "acme.com",
        kind: "CUSTOM",
        status: "ACTIVE",
        is_primary: true,
      },
    ]
    rows[1] = { ...rows[1], hostname: "www.acme.com" }
    renderPane("dom_1")
    expect(screen.queryByText(/Redirects to/)).not.toBeNull()
    expect(screen.getAllByText("acme.com").length).toBeGreaterThan(0)
  })

  it("lets a primary custom domain be stepped back down", () => {
    // The option used to be drawn permanently disabled — "Make another domain
    // primary first" — because there was no mutation to demote a primary and
    // the only way back was deleting the domain, which a merchant staging a
    // migration or backing one out does not want to do. Promoting the platform
    // address is that mutation: `clearPrimaryShopDomain` takes no id, because
    // clearing every custom primary flag *is* promoting it.
    rows = [
      { ...platform, is_primary: false },
      { ...rows[1], status: "ACTIVE", is_primary: true },
    ]
    renderPane("dom_1")
    expect(screen.queryByText("Primary domain")).not.toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Change" }))
    expect(screen.queryByText(/Your store address becomes the primary domain/)).not.toBeNull()

    const confirm = screen.getByRole("button", { name: "Change domain type" }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    fireEvent.click(screen.getByRole("radio", { name: /^Redirecting domain/ }))
    expect(confirm.disabled).toBe(false)
  })

  it("lets a live, non-primary domain be promoted from the type dialog", () => {
    rows = rows.map((r) => (r.id === "dom_1" ? { ...r, status: "ACTIVE" } : r))
    renderPane("dom_1")
    fireEvent.click(screen.getByRole("button", { name: "Change" }))
    expect(screen.queryByText("(Current)")).not.toBeNull()
    const confirm = screen.getByRole("button", { name: "Change domain type" }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    fireEvent.click(screen.getByRole("radio", { name: /^Primary domain/ }))
    expect(confirm.disabled).toBe(false)
  })

  it("explains a failed reading and offers to try again", () => {
    configuration = null
    configError = new Error("boom")
    renderPane("dom_1")
    expect(screen.queryByText("We could not check this domain right now.")).not.toBeNull()
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeNull()
  })

  it("shows a parked apex as one instruction naming both addresses", () => {
    // End to end on the real reported zone: GoDaddy answered with two parking
    // addresses against one required address. The screen used to read "remove
    // 15.197.148.33" and "update 3.33.130.190" — two rows the merchant had no
    // way to act on, because that apex is a single managed setting there.
    configuration = {
      ...config(),
      dns_diff: [
        {
          action: "UPDATE",
          type: "A",
          name: "@",
          current_values: ["15.197.148.33", "3.33.130.190"],
          required_values: ["76.76.21.21"],
          current_value: "15.197.148.33",
          required_value: "76.76.21.21",
          reason:
            "This name answers with 2 values today and none of them reach your store.",
        },
      ],
    }
    renderPane("dom_1")

    expect(screen.queryByText("15.197.148.33")).not.toBeNull()
    expect(screen.queryByText("3.33.130.190")).not.toBeNull()
    expect(screen.queryByText("76.76.21.21")).not.toBeNull()
    // One instruction, so the "remove these" heading never appears.
    expect(screen.queryByText("Remove these existing records")).toBeNull()
    expect(screen.queryByText("Update these existing records")).not.toBeNull()
  })

  it("explains an unreadable zone and still prints the records it needs", () => {
    // The note used to render *instead of* the diff, which ended the screen on
    // a domain whose owner could act on it right now: a fresh registration is
    // unreadable for its first hour or so while the registry publishes the
    // delegation, and the records it needs are the same either way.
    configuration = {
      ...config(),
      zone_unreachable: true,
      dns_diff: [
        {
          action: "ADD",
          type: "A",
          name: "@",
          current_value: null,
          required_value: "76.76.21.21",
          reason: "Add this record at your DNS provider.",
        },
      ],
    }
    renderPane("dom_1")
    expect(screen.queryByText(/We could not read the DNS for/)).not.toBeNull()
    expect(screen.queryByText("76.76.21.21")).not.toBeNull()
  })

  it("answers 'not found' for a domain that is not this shop's", () => {
    renderPane("somebody-elses")
    expect(screen.queryByText("This domain is no longer connected to your store.")).not.toBeNull()
    expect(screen.getByText("Back to domains").closest("a")?.getAttribute("href")).toBe(
      "/store/acme/settings/domains",
    )
  })

  it("shows nothing conclusive while the list is still loading", () => {
    rows = []
    listLoading = true
    renderPane("dom_1")
    expect(screen.queryByText("This domain is no longer connected to your store.")).toBeNull()
  })
})
