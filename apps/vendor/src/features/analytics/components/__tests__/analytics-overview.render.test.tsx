import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { CombinedGraphQLErrors } from "@apollo/client/errors"
import type { SalesBreakdown } from "../../types"

/**
 * `salesByChannel` is its own request so that an API which does not know the
 * field cannot take the rest of the page down with it. That only holds while
 * nobody folds it back into `GET_ANALYTICS_OVERVIEW`, and while the page
 * treats the refusal as "not available" rather than as an error card whose
 * "try again" can never work. The dashboard ships before the API is rebuilt,
 * so these pin both.
 *
 * `useQuery` is answered per document; the widgets with queries of their own
 * (insights, targets) are stubbed, since they are not what is under test.
 */

const apollo = vi.hoisted(() => ({
  channelsResult: {} as Record<string, unknown>,
  docs: {} as Record<string, unknown>,
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)
vi.mock("next/navigation", () => ({
  useParams: () => ({ shopSlug: "entaj" }),
  usePathname: () => "/store/entaj/analytics",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("@apollo/client/react", () => ({
  useQuery: (doc: unknown) => {
    if (doc === apollo.docs.channels) return apollo.channelsResult
    // One stable result, as Apollo returns: the page stamps its clock when
    // `data` changes identity, so a fresh object per render never settles.
    if (doc === apollo.docs.overview) return OVERVIEW
    return { loading: false, data: undefined, refetch: vi.fn() }
  },
  useMutation: () => [vi.fn(), { loading: false }],
}))
vi.mock("@/features/insights", () => ({ InsightsCard: () => null }))
vi.mock("@/features/targets", () => ({ TargetCreateDialog: () => null }))
vi.mock("../analytics-targets-section", () => ({
  AnalyticsTargetsSection: () => null,
}))

const api = await import("../../api")
apollo.docs.channels = api.GET_SALES_BY_CHANNEL
apollo.docs.overview = api.GET_ANALYTICS_OVERVIEW
const { AnalyticsOverview } = await import("../analytics-overview")

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
})

afterEach(cleanup)

const CURRENT: SalesBreakdown = {
  gross_sales_cents: 111_030,
  discounts_cents: 0,
  returns_cents: 0,
  net_sales_cents: 111_030,
  shipping_cents: 0,
  taxes_cents: 0,
  total_sales_cents: 111_030,
  orders_count: 16,
  fulfilled_orders_count: 3,
  return_fees_cents: 0,
  average_order_value_cents: 6_939,
  returning_customer_rate_bps: 2_500,
  cogs_cents: 0,
  fees_cents: 0,
  gross_profit_cents: 111_030,
  net_profit_cents: 111_030,
  margin_bps: 10_000,
  units_missing_cost: 0,
  cost_coverage_bps: 10_000,
  is_estimated: false,
}

function overviewResult() {
  return {
    loading: false,
    refetch: vi.fn(),
    data: {
      salesReport: {
        success: true,
        data: {
          start: "2026-08-31T00:00:00.000Z",
          end: "2026-09-29T10:00:00.000Z",
          granularity: "day",
          currency: "SAR",
          timezone: "UTC",
          current: CURRENT,
          previous: null,
          series: [],
          previous_series: null,
        },
      },
      topProducts: { success: true, data: [] },
      sellThroughProducts: { success: true, data: [] },
      customerAnalytics: {
        success: true,
        data: { cohorts: [], top_customers: [], currency: "SAR" },
      },
      attributionReport: {
        success: true,
        data: {
          rows: [
            {
              key: "DIRECT",
              channel: "DIRECT",
              revenue_cents: 111_030,
              orders: 16,
              units: 16,
              aov_cents: 6_939,
              new_customers: 4,
              returning_customers: 1,
              conversion_rate_bps: null,
              cac_cents: null,
              roas_bps: null,
            },
          ],
          totals: {
            key: "TOTAL",
            channel: null,
            revenue_cents: 111_030,
            orders: 16,
            units: 16,
            aov_cents: 6_939,
            new_customers: 4,
            returning_customers: 1,
            conversion_rate_bps: null,
            cac_cents: null,
            roas_bps: null,
          },
          group_by: "CHANNEL",
          model: "LAST_TOUCH",
          currency: "SAR",
        },
      },
    },
  }
}

const OVERVIEW = overviewResult()

/** What the API behind dash.zaydak.com answered before its rebuild. */
const OLD_API = new CombinedGraphQLErrors({
  errors: [
    {
      message: 'Unknown type "SalesByChannelInput".',
      extensions: { error_code: "VALIDATION_ERROR" },
    },
    {
      message: 'Cannot query field "salesByChannel" on type "Query".',
      extensions: { error_code: "VALIDATION_ERROR" },
    },
  ],
})

function expectRestOfPage() {
  expect(screen.getAllByText("Total sales").length).toBeGreaterThan(0)
  expect(screen.getByText("Orders fulfilled")).toBeTruthy()
  expect(screen.getByText("Returning customer rate")).toBeTruthy()
  expect(screen.getByText("16")).toBeTruthy()
  expect(screen.getByText("Sales by traffic source")).toBeTruthy()
}

describe("AnalyticsOverview on an API without salesByChannel", () => {
  it("renders every other card and leaves the channel section out", () => {
    apollo.channelsResult = {
      loading: false,
      data: undefined,
      error: OLD_API,
      refetch: vi.fn(),
    }

    render(<AnalyticsOverview />)

    expectRestOfPage()
    expect(screen.queryByText("Sales by channel")).toBeNull()
    expect(
      screen.queryByText("Sales by channel could not be loaded"),
    ).toBeNull()
    expect(screen.queryByRole("button", { name: /Try again/ })).toBeNull()
  })

  it("still offers a retry when the failure is not a schema mismatch", () => {
    apollo.channelsResult = {
      loading: false,
      data: undefined,
      error: new Error("Failed to fetch"),
      refetch: vi.fn(),
    }

    render(<AnalyticsOverview />)

    expectRestOfPage()
    expect(
      screen.getByText("Sales by channel could not be loaded"),
    ).toBeTruthy()
    expect(screen.getByRole("button", { name: /Try again/ })).toBeTruthy()
  })
})
