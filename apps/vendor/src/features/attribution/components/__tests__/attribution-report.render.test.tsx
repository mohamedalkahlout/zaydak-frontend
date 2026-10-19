import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import en from "@/shared/messages/en"
import type { AttributionReportResponse, AttributionRow } from "../../types"

/**
 * A refund settled in the window for an order placed before it lands on a
 * group with no orders and negative revenue. The breakdown must print that
 * revenue as it is and leave every ratio over it blank: no "NaN", no
 * "Infinity", no negative ROAS, and no "SAR 0.00" average for zero orders.
 */

const apollo = vi.hoisted(() => ({
  data: undefined as AttributionReportResponse | undefined,
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)
vi.mock("next/navigation", () => ({
  useParams: () => ({ shopSlug: "entaj" }),
}))
vi.mock("@apollo/client/react", () => ({
  useQuery: () => ({ data: apollo.data, loading: false }),
}))

const { AttributionReport } = await import("../attribution-report")

beforeAll(() => {
  // recharts' ResponsiveContainer observes its box; jsdom has no observer.
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
  // boneyard reads the colour scheme on mount.
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

function row(over: Partial<AttributionRow>): AttributionRow {
  return {
    key: "DIRECT",
    channel: "DIRECT",
    revenue_cents: 0,
    orders: 0,
    units: 0,
    aov_cents: 0,
    new_customers: 0,
    returning_customers: 0,
    conversion_rate_bps: null,
    cac_cents: null,
    roas_bps: null,
    ...over,
  }
}

function respond(rows: AttributionRow[], totals: AttributionRow) {
  apollo.data = {
    attributionReport: {
      success: true,
      data: {
        rows,
        totals,
        group_by: "CHANNEL",
        model: "LAST_TOUCH",
        currency: "SAR",
      },
    },
  }
}

function cellsOf(label: string): string[] {
  const tr = screen.getByText(label).closest("tr")
  if (!tr) throw new Error(`no row for ${label}`)
  return within(tr)
    .getAllByRole("cell")
    .map((cell) => cell.textContent ?? "")
}

describe("AttributionReport with a negative group", () => {
  it("prints the negative revenue and leaves its ratios blank", () => {
    respond(
      [
        row({
          key: "PAID_SOCIAL",
          channel: "PAID_SOCIAL",
          revenue_cents: 90_000,
          orders: 3,
          aov_cents: 30_000,
          new_customers: 2,
          cac_cents: 5_000,
          roas_bps: 90_000,
        }),
        // Refund-only: what an API older than the null rule still sends.
        row({
          key: "PAID_SEARCH",
          channel: "PAID_SEARCH",
          revenue_cents: -4_500,
          orders: 0,
          aov_cents: 0,
          cac_cents: null,
          roas_bps: -4_500,
        }),
      ],
      row({
        key: "TOTAL",
        channel: null,
        revenue_cents: 85_500,
        orders: 3,
        aov_cents: 28_500,
        new_customers: 2,
        cac_cents: 7_500,
        roas_bps: 57_000,
      }),
    )
    render(<AttributionReport />)

    const paidSearch = cellsOf(en.attribution.channels.PAID_SEARCH)
    // [label, revenue, orders, aov, new, returning, cac, roas]
    expect(paidSearch[1]).toMatch(/-/)
    expect(paidSearch[1]).toMatch(/45/)
    expect(paidSearch[3]).toBe("—")
    expect(paidSearch[6]).toBe("—")
    expect(paidSearch[7]).toBe("—")

    const paidSocial = cellsOf(en.attribution.channels.PAID_SOCIAL)
    expect(paidSocial[7]).toBe("9.00x")

    const all = document.body.textContent ?? ""
    expect(all).not.toMatch(/NaN|Infinity/)
    expect(screen.getByText(en.attribution.negativeHint)).toBeTruthy()
  })

  it("reads a campaign that spent and sold nothing as 0.00x, not a dash", () => {
    respond(
      [
        row({
          key: "PAID_SOCIAL",
          channel: "PAID_SOCIAL",
          revenue_cents: 0,
          orders: 0,
          roas_bps: 0,
        }),
      ],
      row({ key: "TOTAL", channel: null, revenue_cents: 0, roas_bps: 0 }),
    )
    render(<AttributionReport />)

    expect(cellsOf(en.attribution.channels.PAID_SOCIAL)[7]).toBe("0.00x")
    expect(screen.queryByText(en.attribution.negativeHint)).toBeNull()
  })

  it("says nothing about negative revenue when there is none", () => {
    respond(
      [row({ revenue_cents: 12_000, orders: 1, aov_cents: 12_000 })],
      row({ key: "TOTAL", channel: null, revenue_cents: 12_000, orders: 1, aov_cents: 12_000 }),
    )
    render(<AttributionReport />)

    expect(screen.queryByText(en.attribution.negativeHint)).toBeNull()
    // No spend recorded: CAC and ROAS are blank, not zero.
    const direct = cellsOf(en.attribution.channels.DIRECT)
    expect(direct[6]).toBe("—")
    expect(direct[7]).toBe("—")
  })
})
