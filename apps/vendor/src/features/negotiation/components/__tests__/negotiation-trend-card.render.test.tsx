import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import type {
  NegotiationOutcomeFigures,
  NegotiationOutcomeRollups,
} from "../../types"

/**
 * The negotiation trend: two bars per bucket in the theme's grid and ticks,
 * labelled in the dashboard's language, with a table twin a screen reader can
 * walk. recharts is stubbed to echo the props under test: jsdom gives
 * `ResponsiveContainer` no box, so the real one draws nothing to read.
 */

const intl = vi.hoisted(() => ({ locale: "en" }))

vi.mock("next-intl", async () => ({
  ...(await (await import("@/shared/test/next-intl")).nextIntlMock()),
  useLocale: () => intl.locale,
}))

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  BarChart: ({
    data,
    children,
  }: {
    data: Array<{ date: string }>
    children?: ReactNode
  }) => (
    <div data-testid="chart" data-points={data.length}>
      {children}
    </div>
  ),
  Bar: ({ dataKey, fill }: { dataKey: string; fill: string }) => (
    <div data-testid="bar" data-key={dataKey} data-fill={fill} />
  ),
  CartesianGrid: ({ stroke }: { stroke?: string }) => (
    <div data-testid="grid" data-stroke={stroke} />
  ),
  XAxis: ({
    tick,
    tickFormatter,
  }: {
    tick?: { fill?: string }
    tickFormatter?: (value: string) => string
  }) => (
    <div data-testid="x-axis" data-fill={tick?.fill}>
      {tickFormatter?.("2026-09-01")}
    </div>
  ),
  YAxis: ({ allowDecimals }: { allowDecimals?: boolean }) => (
    <div data-testid="y-axis" data-decimals={String(allowDecimals)} />
  ),
  Tooltip: () => null,
}))

const { NegotiationTrendCard } = await import("../negotiation-trend-card")

afterEach(() => {
  cleanup()
  intl.locale = "en"
})

const figures = (
  overrides: Partial<NegotiationOutcomeFigures> = {},
): NegotiationOutcomeFigures => ({
  sessions: 0,
  accepted: 0,
  redeemed: 0,
  acceptance_bps: 0,
  conversion_bps: 0,
  revenue_cents: 0,
  discount_cents: 0,
  avg_discount_bps: null,
  margin_cents: null,
  margin_bps: null,
  redeemed_without_cost: 0,
  floor_reached: 0,
  floor_reached_bps: null,
  avg_rounds_to_close: null,
  ...overrides,
})

function rollups(
  trend: NegotiationOutcomeRollups["trend"],
  granularity = "day",
): NegotiationOutcomeRollups {
  return {
    granularity,
    timezone: "Asia/Riyadh",
    currency: "SAR",
    products_total: 0,
    total: figures(),
    products: [],
    strategies: [],
    trend,
  }
}

const week = rollups([
  {
    date: "2026-09-01",
    figures: figures({
      sessions: 3,
      accepted: 2,
      redeemed: 1,
      revenue_cents: 8500,
      discount_cents: 1500,
    }),
  },
  { date: "2026-09-02", figures: figures() },
])

describe("NegotiationTrendCard", () => {
  it("draws negotiations beside the ones that became orders, in the theme's grid", () => {
    render(<NegotiationTrendCard rollups={week} loading={false} failed={false} />)

    expect(screen.getByText("Negotiations over time")).toBeTruthy()
    expect(
      screen.getByText(/Grouped by the day each negotiation started/),
    ).toBeTruthy()
    expect(screen.getByTestId("chart").dataset.points).toBe("2")
    expect(
      screen.getAllByTestId("bar").map((b) => [b.dataset.key, b.dataset.fill]),
    ).toEqual([
      ["sessions", "#94a3b8"],
      ["redeemed", "#0d9488"],
    ])
    expect(screen.getByTestId("grid").dataset.stroke).toBe("var(--border)")
    expect(screen.getByTestId("x-axis").dataset.fill).toBe(
      "var(--muted-foreground)",
    )
    expect(screen.getByTestId("y-axis").dataset.decimals).toBe("false")
  })

  it("names the buckets in the dashboard's language", () => {
    intl.locale = "ar"
    render(<NegotiationTrendCard rollups={week} loading={false} failed={false} />)
    expect(screen.getByTestId("x-axis").textContent).toBe(
      new Date("2026-09-01T00:00:00Z").toLocaleDateString("ar", {
        timeZone: "UTC",
        month: "short",
        day: "numeric",
      }),
    )
  })

  it("gives a screen reader every bucket as a table", () => {
    render(<NegotiationTrendCard rollups={week} loading={false} failed={false} />)

    const table = screen.getByRole("table", { name: "Negotiations per period" })
    const first = within(table).getByRole("rowheader", { name: "Sep 1" })
      .closest("tr")!
    const cells = within(first)
      .getAllByRole("cell")
      .map((c) => c.textContent)
    expect(cells.slice(0, 3)).toEqual(["3", "2", "1"])
    expect(cells[3]).toMatch(/85\.00/)
    expect(cells[4]).toMatch(/15\.00/)
  })

  it("says the period was empty rather than drawing a row of zero bars", () => {
    render(
      <NegotiationTrendCard
        rollups={rollups([{ date: "2026-09-01", figures: figures() }])}
        loading={false}
        failed={false}
      />,
    )
    expect(screen.getByText("No negotiations in this period")).toBeTruthy()
    expect(screen.queryByTestId("chart")).toBeNull()
  })

  it("waits, and fails, inside its own card", () => {
    const { rerender } = render(
      <NegotiationTrendCard rollups={undefined} loading failed={false} />,
    )
    expect(screen.getByText("Loading negotiations…")).toBeTruthy()

    rerender(
      <NegotiationTrendCard rollups={undefined} loading={false} failed />,
    )
    expect(screen.getByText("Could not load the breakdown.")).toBeTruthy()
    expect(screen.queryByTestId("chart")).toBeNull()
  })
})
