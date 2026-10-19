import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import type {
  AttributionReport,
  AttributionRow,
} from "@/features/attribution/types"

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

const { SalesByChannelCard } = await import("../sales-by-channel-card")

beforeAll(() => {
  // boneyard observes its box; jsdom has no observer.
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
  // boneyard reads the colour scheme through matchMedia; jsdom has none.
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

function group(
  key: AttributionRow["channel"] & string,
  revenue_cents: number,
  orders: number,
): AttributionRow {
  return {
    key,
    channel: key,
    revenue_cents,
    orders,
    units: orders,
    aov_cents: orders ? Math.round(revenue_cents / orders) : 0,
    new_customers: 0,
    returning_customers: 0,
    conversion_rate_bps: null,
    cac_cents: null,
    roas_bps: null,
  }
}

function report(rows: AttributionRow[]): AttributionReport {
  const revenue = rows.reduce((s, r) => s + r.revenue_cents, 0)
  const orders = rows.reduce((s, r) => s + r.orders, 0)
  return {
    rows,
    totals: { ...group("DIRECT", revenue, orders), key: "TOTAL" },
    group_by: "CHANNEL",
    model: "LAST_TOUCH",
    currency: "SAR",
  }
}

const barWidth = (container: HTMLElement, key: string) =>
  (
    container.querySelector(
      `[data-group="${key}"] [data-bar]`,
    ) as HTMLElement | null
  )?.style.width

describe("SalesByChannelCard", () => {
  it("is titled by traffic source, not by channel", () => {
    render(
      <SalesByChannelCard
        report={report([group("DIRECT", 10_000, 2)])}
        viewHref="/store/entaj/analytics/attribution"
      />,
    )
    expect(screen.getByText("Sales by traffic source")).toBeTruthy()
  })

  // A refund settled in the window against an order placed before it makes
  // a group with no orders and negative revenue. A negative CSS width is
  // dropped by the browser, which then draws the bar across the whole track.
  it("draws no bar for a group whose refunds outweigh its sales", () => {
    const { container } = render(
      <SalesByChannelCard
        report={report([
          group("DIRECT", 10_000, 2),
          group("SOCIAL", 5_000, 1),
          group("EMAIL", -3_000, 0),
        ])}
        viewHref="/store/entaj/analytics/attribution"
      />,
    )

    expect(barWidth(container, "EMAIL")).toBe("0%")
    // Shares of the 150.00 actually sold, not of the net 120.00, which
    // would have stretched these to 83% and 42%.
    expect(parseFloat(barWidth(container, "DIRECT")!)).toBeCloseTo(66.67, 1)
    expect(parseFloat(barWidth(container, "SOCIAL")!)).toBeCloseTo(33.33, 1)
    // The figure itself is still shown, signed.
    const email = container.querySelector('[data-group="EMAIL"]')!
    expect(email.textContent).toContain("-")
    expect(email.textContent).toContain("30.00")
  })

  it("draws empty bars when nothing positive happened", () => {
    const { container } = render(
      <SalesByChannelCard
        report={report([group("DIRECT", -2_000, 0)])}
        viewHref="/store/entaj/analytics/attribution"
      />,
    )
    expect(barWidth(container, "DIRECT")).toBe("0%")
  })
})
