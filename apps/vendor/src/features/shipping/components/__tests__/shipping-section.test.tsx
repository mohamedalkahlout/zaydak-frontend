import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { ShippingRule, ShippingZone } from "../../types"

/**
 * The pane's wiring of two guards that live in its children.
 *
 * `DeleteShippingDialog` refuses the last rate on a zone, but only the pane
 * knows which rate that is — the count comes from the zone the rate is listed
 * under, and a rate on the unzoned card must never be blocked. And the swap
 * to "delete the zone instead" is the pane replacing its own `deleting` state
 * in place, with the dialog kept open; done wrong it flashes shut between
 * the two confirmations.
 *
 * The second guard is `diagnose`'s `multipleCatchAlls`, pinned here only as
 * far as the pane rendering it — the rule itself is tested with the helper.
 *
 * Boundaries are mocked rather than provided (the repo's component-test
 * convention); translations return their key. No jest-dom — assertions use
 * plain DOM properties.
 */

function opName(doc: any): string {
  return doc?.definitions?.[0]?.name?.value ?? ""
}

/*
  Apollo hands back a STABLE data reference across renders and the pane's
  `useMemo`s key on it, so each result is built once per test and handed back
  unchanged — a fresh object per call would re-derive everything every render.
*/
let zonesResult: unknown
let rulesResult: unknown
let settingsResult: unknown

vi.mock("@apollo/client/react", () => ({
  useSuspenseQuery: (doc: any) => {
    switch (opName(doc)) {
      case "ShippingZones":
        return zonesResult
      case "ShippingRules":
        return rulesResult
      default:
        return settingsResult
    }
  },
  useQuery: () => ({
    data: { shopPackages: { data: [] } },
    loading: false,
  }),
  useMutation: () => [
    vi.fn(() => Promise.resolve({ data: {} })),
    { loading: false },
  ],
  useApolloClient: () => ({ refetchQueries: vi.fn() }),
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }))

/*
  The carrier half runs four queries of its own and has its own test file;
  the rate dialog and the countries picker are not under test either. All
  three are stubbed so this file is about ONE thing: what the pane hands its
  delete dialog, and which diagnostics it renders.
*/
vi.mock("../providers/shipping-providers-section", () => ({
  ShippingProvidersSection: () => <div data-testid="providers" />,
}))
vi.mock("../rate-form-dialog", () => ({ RateFormDialog: () => null }))
vi.mock("@/features/coupons/components/new/countries-picker-dialog", () => ({
  CountriesPickerDialog: () => null,
}))

const { ShippingSection } = await import("../shipping-section")

function rule(partial: Partial<ShippingRule> & { id: string }): ShippingRule {
  return {
    name: { en: partial.id },
    type: "fixed",
    amount_cents: 1500,
    amount_bps: 0,
    per_kg_cents: 0,
    min_order_cents: 0,
    zone_id: null,
    is_global: false,
    created_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  }
}

function zone(
  partial: Partial<ShippingZone> & { id: string; name: ShippingZone["name"] },
): ShippingZone {
  return {
    countries: [],
    states: [],
    priority: 0,
    is_global: false,
    shop_id: "shop_1",
    rules: [],
    ...partial,
  }
}

/** Freeze the fixtures into the stable results the mock returns. */
function commit(zones: ShippingZone[], unzoned: ShippingRule[] = []) {
  zonesResult = { data: { shippingZones: { success: true, data: zones } } }
  rulesResult = {
    data: {
      shippingRules: {
        success: true,
        data: unzoned,
        meta: { page: 1, limit: 100, total: unzoned.length, total_pages: 1 },
      },
    },
  }
  settingsResult = {
    data: {
      shopShippingSettings: {
        success: true,
        data: { offers_merchant_delivery: true, offers_carrier_delivery: false },
      },
    },
  }
}

/** Gulf carries one rate; the catch-all carries two. `orderZones` lists Gulf first. */
const gulfWithOneRate = () =>
  zone({
    id: "gulf",
    name: { en: "Gulf" },
    countries: ["SA"],
    rules: [rule({ id: "gulf-standard", zone_id: "gulf" })],
  })
const restWithTwoRates = () =>
  zone({
    id: "rest",
    name: { en: "Rest of world" },
    rules: [
      rule({
        id: "rest-old",
        zone_id: "rest",
        created_at: "2026-01-01T00:00:00.000Z",
      }),
      rule({
        id: "rest-new",
        zone_id: "rest",
        created_at: "2026-06-01T00:00:00.000Z",
      }),
    ],
  })

const deleteRateButtons = () =>
  screen.getAllByRole("button", { name: "Delete rate" })

beforeEach(() => {
  vi.clearAllMocks()
})

describe("ShippingSection — deleting a zone's only rate", () => {
  it("opens the refusal, then swaps to the zone confirmation in place", () => {
    commit([gulfWithOneRate(), restWithTwoRates()])
    render(<ShippingSection currency="SAR" />)

    // Gulf is listed first (most specific), so its rate's button is first.
    fireEvent.click(deleteRateButtons()[0] as HTMLElement)

    expect(
      screen.getByText("This is the zone’s only rate"),
    ).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull()

    fireEvent.click(
      screen.getByRole("button", {
        name: "Delete the zone instead",
      }),
    )

    expect(screen.getByText("Delete this zone?")).toBeTruthy()
    expect(
      screen.queryByText("This is the zone’s only rate"),
    ).toBeNull()
    expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy()
  })

  it("confirms normally for a rate that has a sibling on its zone", () => {
    commit([gulfWithOneRate(), restWithTwoRates()])
    render(<ShippingSection currency="SAR" />)

    // The catch-all's two rates follow Gulf's one.
    fireEvent.click(deleteRateButtons()[1] as HTMLElement)

    expect(screen.getByText("Delete this rate?")).toBeTruthy()
    expect(
      screen.queryByText("This is the zone’s only rate"),
    ).toBeNull()
  })

  // Removing the last flat rate leaves the shop `not_configured`, which
  // checkout lets through with a warning — nothing to stop, and the
  // `nothingConfigured` diagnostic already covers the result.
  it("never blocks an unzoned rate, even when it is the shop's only one", () => {
    commit([], [rule({ id: "flat" })])
    render(<ShippingSection currency="SAR" />)

    fireEvent.click(deleteRateButtons()[0] as HTMLElement)

    expect(screen.getByText("Delete this rate?")).toBeTruthy()
    expect(
      screen.queryByText("This is the zone’s only rate"),
    ).toBeNull()
  })
})

describe("ShippingSection — diagnostics", () => {
  it("names two catch-all zones", () => {
    commit([
      restWithTwoRates(),
      zone({
        id: "everywhere",
        name: { en: "Everywhere" },
        rules: [rule({ id: "e1", zone_id: "everywhere" })],
      }),
    ])
    render(<ShippingSection currency="SAR" />)

    expect(
      screen.getByText(/More than one catch-all zone/),
    ).toBeTruthy()
  })

  it("says nothing about catch-alls when there is exactly one", () => {
    commit([gulfWithOneRate(), restWithTwoRates()])
    render(<ShippingSection currency="SAR" />)

    expect(
      screen.queryByText(/More than one catch-all zone/),
    ).toBeNull()
    expect(
      screen.queryByText(/No catch-all zone/),
    ).toBeNull()
  })
})
