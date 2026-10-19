import type * as React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import type {
  NegotiationOutcomeFigures,
  NegotiationOutcomeRollupsResponse,
  NegotiationOutcomesResponse,
} from "../../types"
import {
  NEGOTIATION_OUTCOME_ROLLUPS,
  NEGOTIATION_OUTCOMES,
} from "../../api-outcomes"
import { NegotiationOutcomesPage } from "../negotiation-outcomes-page"

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("next/navigation", () => ({
  useParams: () => ({ shopSlug: "acme" }),
}))

// The measured skeleton is not what this test is about; render its content.
vi.mock("@/shared/components/bones", () => ({
  Bones: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const mockFeature = { allowed: true, loading: false }
vi.mock("@/features/plan/lib/use-feature", () => ({
  useFeature: () => mockFeature,
}))

// jsdom gives `ResponsiveContainer` no box, so the real chart draws nothing;
// the stub lists each bucket so the trend is still readable.
vi.mock("recharts", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  )
  return {
    ResponsiveContainer: Passthrough,
    BarChart: ({
      data,
      children,
    }: {
      data: Array<{ date: string; sessions: number; redeemed: number }>
      children?: React.ReactNode
    }) => (
      <div>
        <ul>
          {data.map((p) => (
            <li key={p.date} data-testid="trend-bucket">
              {`${p.date}:${p.sessions}/${p.redeemed}`}
            </li>
          ))}
        </ul>
        {children}
      </div>
    ),
    Bar: () => null,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
  }
})

const response: NegotiationOutcomesResponse = {
  negotiationOutcomes: {
    success: true,
    data: [
      {
        session_id: "sess_1",
        created_at: "2026-09-20T10:00:00.000Z",
        product_id: "prod_1",
        variation_option_id: null,
        product_title: "Olive oil 1L",
        variation_title: null,
        channel: "WEB",
        session_status: "ACCEPTED",
        rounds: 3,
        max_rounds: 5,
        customer_label: "··a1b2",
        is_guest: true,
        list_price_cents: 10000,
        last_offer_cents: 8500,
        final_price_cents: 8500,
        quantity: 2,
        offer_status: "USED",
        offer_expires_at: "2026-09-20T10:30:00.000Z",
        redeemed_at: "2026-09-20T10:10:00.000Z",
        order_id: "order_1",
        order_unwound: false,
        discount_cents: 3000,
        margin_cents: 5000,
        currency: "SAR",
      },
      {
        session_id: "sess_2",
        created_at: "2026-09-21T10:00:00.000Z",
        product_id: "prod_2",
        variation_option_id: null,
        product_title: "Dates box",
        variation_title: "Large",
        channel: "WHATSAPP",
        session_status: "EXPIRED",
        rounds: 5,
        max_rounds: 5,
        customer_label: "+97********56",
        is_guest: true,
        list_price_cents: 5000,
        last_offer_cents: 4400,
        final_price_cents: null,
        quantity: null,
        offer_status: null,
        offer_expires_at: null,
        redeemed_at: null,
        order_id: null,
        order_unwound: false,
        discount_cents: null,
        margin_cents: null,
        currency: "SAR",
      },
    ],
    meta: { total: 2, page: 1, limit: 20, total_pages: 1 },
    summary: {
      sessions: 2,
      accepted: 1,
      redeemed: 1,
      acceptance_bps: 5000,
      conversion_bps: 5000,
      revenue_cents: 17000,
      discount_cents: 3000,
      margin_cents: 5000,
      redeemed_without_cost: 2,
      currency: "SAR",
    },
  },
}

const figures = (
  overrides: Partial<NegotiationOutcomeFigures> = {},
): NegotiationOutcomeFigures => ({
  sessions: 1,
  accepted: 1,
  redeemed: 1,
  acceptance_bps: 10000,
  conversion_bps: 10000,
  revenue_cents: 17000,
  discount_cents: 3000,
  avg_discount_bps: 1500,
  margin_cents: 5000,
  margin_bps: 2941,
  redeemed_without_cost: 0,
  floor_reached: 0,
  floor_reached_bps: 0,
  avg_rounds_to_close: 3,
  ...overrides,
})

/** A session with no deal: every average has nothing under it. */
const noDeal = figures({
  accepted: 0,
  redeemed: 0,
  acceptance_bps: 0,
  conversion_bps: 0,
  revenue_cents: 0,
  discount_cents: 0,
  avg_discount_bps: null,
  margin_cents: null,
  margin_bps: null,
  floor_reached_bps: null,
  avg_rounds_to_close: null,
})

const rollupsResponse: NegotiationOutcomeRollupsResponse = {
  negotiationOutcomeRollups: {
    success: true,
    data: {
      granularity: "day",
      timezone: "Asia/Riyadh",
      currency: "SAR",
      products_total: 2,
      total: figures({
        sessions: 2,
        acceptance_bps: 5000,
        conversion_bps: 5000,
        floor_reached: 1,
        floor_reached_bps: 10000,
      }),
      products: [
        {
          product_id: "prod_1",
          product_title: "Olive oil 1L",
          figures: figures({ floor_reached: 1, floor_reached_bps: 10000 }),
        },
        { product_id: "prod_2", product_title: "Dates box", figures: noDeal },
      ],
      strategies: [
        { strategy: "conservative", figures: noDeal },
        {
          strategy: "aggressive",
          figures: figures({
            margin_cents: -500,
            margin_bps: -294,
            avg_rounds_to_close: 2.5,
          }),
        },
      ],
      trend: [
        { date: "2026-09-20", figures: figures() },
        { date: "2026-09-21", figures: noDeal },
      ],
    },
  },
}

const useQueryMock = vi.fn()
const clientQuery = vi.fn()
vi.mock("@apollo/client/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useApolloClient: () => ({ query: clientQuery }),
}))

const downloadCsv = vi.fn()
vi.mock("@/shared/lib/csv", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/shared/lib/csv")>()),
  downloadCsv: (...args: unknown[]) => downloadCsv(...args),
}))

/** What each document's `useQuery` answers; a test replaces either. */
let outcomesResult: Record<string, unknown>
let rollupsResult: Record<string, unknown>

function lastOptionsFor(document: unknown) {
  const calls = useQueryMock.mock.calls.filter(([doc]) => doc === document)
  return calls[calls.length - 1][1] as {
    variables: Record<string, unknown> & {
      filter: Record<string, unknown>
    }
    skip: boolean
  }
}

function lastQueryOptions() {
  return lastOptionsFor(NEGOTIATION_OUTCOMES) as {
    variables: { filter: Record<string, unknown>; page: number; limit: number }
    skip: boolean
  }
}

const lastRollupsOptions = () => lastOptionsFor(NEGOTIATION_OUTCOME_ROLLUPS)

/** The outcomes table — the rollup cards are tables too. */
function outcomesTable() {
  return screen
    .getAllByRole("table")
    .find((table) =>
      within(table).queryByRole("columnheader", { name: "Margin over cost" }),
    )!
}

/** A card by its title. */
function card(title: string) {
  return screen
    .getByText(title, { selector: '[data-slot="card-title"]' })
    .closest('[data-slot="card"]') as HTMLElement
}

describe("NegotiationOutcomesPage", () => {
  beforeEach(() => {
    // The table chrome measures its scroll container; jsdom has no observer.
    if (!("ResizeObserver" in globalThis)) {
      globalThis.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      } as unknown as typeof ResizeObserver
    }
    outcomesResult = {
      data: response,
      previousData: undefined,
      loading: false,
      error: undefined,
    }
    rollupsResult = {
      data: rollupsResponse,
      previousData: undefined,
      loading: false,
      error: undefined,
    }
    useQueryMock.mockReset()
    useQueryMock.mockImplementation((document: unknown) =>
      document === NEGOTIATION_OUTCOME_ROLLUPS ? rollupsResult : outcomesResult,
    )
    mockFeature.allowed = true
    mockFeature.loading = false
  })

  it("shows each session's outcome with discount and margin as separate columns", () => {
    render(<NegotiationOutcomesPage />)

    // Both money-cost columns are there, under names that cannot be confused.
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent)
    expect(headers).toContain("Discount from list")
    expect(headers).toContain("Margin over cost")

    const redeemedRow = within(outcomesTable())
      .getByText("Olive oil 1L")
      .closest("tr")!
    expect(within(redeemedRow).getByText("Redeemed")).toBeTruthy()
    expect(within(redeemedRow).getByText("··a1b2")).toBeTruthy()
    expect(within(redeemedRow).getByText("Guest")).toBeTruthy()
    expect(within(redeemedRow).getByText(/30\.00/)).toBeTruthy()
    expect(within(redeemedRow).getByText(/50\.00/)).toBeTruthy()
    expect(
      within(redeemedRow).getByRole("link", { name: "View order" }).getAttribute("href"),
    ).toBe("/store/acme/orders/order_1")

    // No deal: the last price on the table, never a "final" nobody agreed to.
    const noDealRow = within(outcomesTable()).getByText("Dates box").closest("tr")!
    expect(within(noDealRow).getByText("No deal")).toBeTruthy()
    expect(within(noDealRow).getByText(/Last offer .*44\.00/)).toBeTruthy()
    expect(within(noDealRow).getByText("WhatsApp")).toBeTruthy()
  })

  // Spent on an order that was since cancelled or refunded: the offer still
  // reads USED, and "Redeemed" would claim a sale that did not stand.
  it("marks a deal whose order unwound, and strikes its money through", () => {
    const unwound = structuredClone(response)
    unwound.negotiationOutcomes.data[0].order_unwound = true
    outcomesResult = { ...outcomesResult, data: unwound }
    render(<NegotiationOutcomesPage />)

    const row = within(outcomesTable()).getByText("Olive oil 1L").closest("tr")!
    expect(within(row).getByText("Order cancelled or refunded")).toBeTruthy()
    expect(within(row).queryByText("Redeemed")).toBeNull()
    expect(within(row).getByText(/30\.00/).className).toContain("line-through")
  })

  it("reads the KPI row from the summary and flags redeemed deals with no cost", () => {
    render(<NegotiationOutcomesPage />)

    // The breakdown's footers carry the same total; the KPI card is this one.
    const revenueKpi = screen
      .getByText("Revenue on redeemed deals", {
        selector: '[data-slot="card-description"]',
      })
      .closest('[data-slot="card"]') as HTMLElement
    expect(within(revenueKpi).getByText(/170\.00/)).toBeTruthy()
    expect(screen.getByText("1 reached a deal (50%)")).toBeTruthy()
    expect(screen.getByText("50% became orders")).toBeTruthy()
    expect(
      screen.getByText("2 redeemed deals have no cost and are left out"),
    ).toBeTruthy()
  })

  it("sends the window and narrows to redeemed deals from the toolbar", () => {
    render(<NegotiationOutcomesPage />)

    const first = lastQueryOptions()
    expect(first.skip).toBe(false)
    expect(first.variables.page).toBe(1)
    expect(first.variables.filter.start).toEqual(expect.any(String))
    expect(first.variables.filter.end).toEqual(expect.any(String))
    expect(first.variables.filter).not.toHaveProperty("redeemed_only")

    fireEvent.click(screen.getByRole("switch"))

    expect(lastQueryOptions().variables.filter.redeemed_only).toBe(true)
  })

  // The API has always taken a product id; the page did not offer it.
  it("drills into one product from its row, and back out", () => {
    render(<NegotiationOutcomesPage />)

    fireEvent.click(
      within(outcomesTable()).getByRole("button", { name: "Olive oil 1L" }),
    )
    expect(lastQueryOptions().variables.filter.product_id).toBe("prod_1")
    expect(screen.getByText("Product: Olive oil 1L")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Show every product" }))
    expect(lastQueryOptions().variables.filter).not.toHaveProperty("product_id")
  })

  // Every row the filter matches, not the page on screen.
  it("exports every page of the filtered report as one CSV", async () => {
    downloadCsv.mockReset()
    clientQuery.mockReset()
    const page = (n: number) => ({
      data: {
        negotiationOutcomes: {
          ...response.negotiationOutcomes,
          data: [response.negotiationOutcomes.data[n - 1]],
          meta: { total: 2, page: n, limit: 100, total_pages: 2 },
        },
      },
    })
    clientQuery.mockResolvedValueOnce(page(1)).mockResolvedValueOnce(page(2))
    render(<NegotiationOutcomesPage />)

    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }))

    await vi.waitFor(() => expect(downloadCsv).toHaveBeenCalledTimes(1))
    expect(clientQuery).toHaveBeenCalledTimes(2)
    expect(clientQuery.mock.calls[1][0].variables).toMatchObject({
      page: 2,
      limit: 100,
    })
    const [filename, csv] = downloadCsv.mock.calls[0] as [string, string]
    expect(filename).toMatch(/^negotiations-.*\.csv$/)
    const lines = csv.split("\r\n")
    expect(lines[0]).toContain("discount_from_list")
    expect(lines).toHaveLength(3)
    expect(lines[1]).toContain("Olive oil 1L")
    expect(lines[1]).toContain("30.00")
  })

  it("stays quiet and asks nothing when the plan excludes negotiation", () => {
    mockFeature.allowed = false
    outcomesResult = { data: undefined, loading: false }
    rollupsResult = { data: undefined, loading: false }

    render(<NegotiationOutcomesPage />)

    expect(
      screen.getByText("AI price negotiation is not included in this shop's plan."),
    ).toBeTruthy()
    expect(lastQueryOptions().skip).toBe(true)
    expect(lastRollupsOptions().skip).toBe(true)
    expect(screen.queryByRole("table")).toBeNull()
    expect(screen.queryByText("Negotiations over time")).toBeNull()
  })

  // ─── Rollups ──────────────────────────────────────────────────────────────

  it("groups the report over time, by product and by strategy", () => {
    render(<NegotiationOutcomesPage />)

    expect(
      within(card("Negotiations over time"))
        .getAllByTestId("trend-bucket")
        .map((li) => li.textContent),
    ).toEqual(["2026-09-20:1/1", "2026-09-21:1/0"])

    const products = card("By product")
    const oil = within(products)
      .getByRole("button", { name: "Olive oil 1L" })
      .closest("tr")!
    expect(within(oil).getByText("15%")).toBeTruthy()
    expect(within(oil).getByText("29.4%")).toBeTruthy()
    // A product with no deal has no average to show — a dash, never "0%".
    const dates = within(products).getByText("Dates box").closest("tr")!
    expect(within(dates).getAllByText("—")).toHaveLength(2)
    // The footer is the report's total, the figure the KPI row reads.
    const footer = within(products).getByText("All negotiations").closest("tr")!
    expect(within(footer).getByText(/170\.00/)).toBeTruthy()

    const strategies = card("By strategy")
    expect(within(strategies).getByText("Conservative")).toBeTruthy()
    expect(within(strategies).getByText("Aggressive")).toBeTruthy()
    // Only the strategies that ran.
    expect(within(strategies).queryByText("Balanced")).toBeNull()
    const aggressive = within(strategies).getByText("Aggressive").closest("tr")!
    expect(within(aggressive).getByText("2.5")).toBeTruthy()
    // Below cost reads red.
    expect(within(aggressive).getByText("-2.9%").className).toContain(
      "text-destructive",
    )
  })

  it("asks for the rollups with the table's filter, never its page", () => {
    render(<NegotiationOutcomesPage />)

    const rollups = lastRollupsOptions()
    expect(rollups.skip).toBe(false)
    expect(rollups.variables.filter).toEqual(lastQueryOptions().variables.filter)
    expect(rollups.variables).not.toHaveProperty("page")
    expect(rollups.variables).not.toHaveProperty("limit")
    expect(rollups.variables.product_limit).toBe(10)

    fireEvent.click(screen.getByRole("switch"))

    expect(lastRollupsOptions().variables.filter.redeemed_only).toBe(true)
  })

  it("drills into a product from the breakdown, as from its row", () => {
    render(<NegotiationOutcomesPage />)

    fireEvent.click(
      within(card("By product")).getByRole("button", { name: "Olive oil 1L" }),
    )

    expect(lastQueryOptions().variables.filter.product_id).toBe("prod_1")
    expect(lastRollupsOptions().variables.filter.product_id).toBe("prod_1")
    expect(screen.getByText("Product: Olive oil 1L")).toBeTruthy()
  })

  it("says so in the breakdown, not the table, when the rollups fail", () => {
    rollupsResult = {
      data: undefined,
      previousData: undefined,
      loading: false,
      error: new Error("Failed to fetch"),
    }
    render(<NegotiationOutcomesPage />)

    expect(screen.getAllByText("Could not load the breakdown.")).toHaveLength(3)
    expect(lastRollupsOptions().skip).toBe(false)
    expect(
      within(outcomesTable()).getByText("Olive oil 1L").closest("tr"),
    ).toBeTruthy()
    expect(screen.queryByText("Could not load negotiation outcomes.")).toBeNull()
  })
})
