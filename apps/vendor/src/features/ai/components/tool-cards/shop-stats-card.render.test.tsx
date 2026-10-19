import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"

import { ShopStatsCard } from "./shop-stats-card"
import { ToolEventRenderer } from "./tool-event-renderer"
import { formatCalendarRange, formatMoney } from "./stats-format"
import { SALES_CHANNEL_META } from "@/shared/lib/sales-channels"
import type {
  ShopStatsResultV1,
  ShopStatsResultV2,
} from "@/features/ai/lib/types"

// The renderer pulls in the form-handoff card, which routes.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ shopSlug: "shop" }),
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

/**
 * The card has to read two payloads: the v2 one, where every figure covers
 * one window, and the v1 one still stored in every conversation from before —
 * where the period badge sat over a lifetime revenue total and a merchant was
 * told 22.70 SAR was "this week's" sales. The v1 half of this file pins that
 * the old tiles now say what they are.
 */

const STATUS = {
  pending: 1,
  processing: 6,
  completed: 1,
  cancelled: 0,
  refunded: 0,
  failed: 1,
  at_local_facility: 0,
  out_for_delivery: 7,
}

const V2: ShopStatsResultV2 = {
  ok: true,
  version: 2,
  period: "weekly",
  currency: "SAR",
  window: {
    start: "2026-09-23T00:00:00.000Z",
    end: "2026-09-29T12:00:00.000Z",
    from_date: "2026-09-23",
    to_date: "2026-09-29",
    days: 7,
    timezone: "UTC",
  },
  sales_basis:
    "Orders placed in the window except cancelled and failed, minus settled refunds.",
  revenue: {
    period_sales: 1110.3,
    period_returns: 0,
    average_order_value: 74.02,
    today_sales: 120.5,
    lifetime_sales: 1210.8,
  },
  orders: {
    placed: 16,
    counted_as_sales: 15,
    lifetime_placed: 17,
    by_status: STATUS,
  },
  new_customers: 9,
  by_channel: [
    { channel: "TELEGRAM", sales: 1020.3, orders: 12, share_pct: 91.9 },
    { channel: "ONLINE_STORE", sales: 70, orders: 2, share_pct: 6.3 },
    { channel: "DRAFT_ORDER", sales: 20, orders: 1, share_pct: 1.8 },
  ],
}

const V1: ShopStatsResultV1 = {
  ok: true,
  period: "weekly",
  revenue: { total: 22.7, today: 0, refunds: 0 },
  orders: { total: 16, by_status: STATUS },
  new_customers: 34,
}

const money = (n: number) => formatMoney(n, "SAR")

/** `#0284c7` as jsdom reports an inline colour, `rgb(2, 132, 199)`. Read
 * from the shared palette so a palette change does not fail this file. */
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`
}

function card(result: ShopStatsResultV1 | ShopStatsResultV2, currency = "SAR") {
  return render(<ShopStatsCard result={result} currency={currency} locale="en" />)
}

describe("<ShopStatsCard /> — v2", () => {
  it("puts the real window in the header: the period's name and its dates", () => {
    card(V2)
    expect(screen.getByText("Last 7 days")).toBeTruthy()
    // ICU puts thin spaces around the dash, and the DOM side of the match is
    // whitespace-collapsed while the expected string is not.
    const dates = formatCalendarRange("2026-09-23", "2026-09-29", "en")!
    expect(screen.getByText(dates.replace(/\s+/g, " "))).toBeTruthy()
    expect(screen.queryByText("This week")).toBeNull()
  })

  it("scopes every tile to the window", () => {
    card(V2)
    expect(screen.getByText("Sales")).toBeTruthy()
    expect(screen.getByText(money(1110.3))).toBeTruthy()
    // 15 counted as sales out of 16 placed — the failed one is not a sale.
    expect(screen.getByText("15")).toBeTruthy()
    expect(screen.getByText("of 16 placed")).toBeTruthy()
    expect(screen.getByText("Average order")).toBeTruthy()
    expect(screen.getByText(money(74.02))).toBeTruthy()
    expect(screen.getByText("New customers")).toBeTruthy()
    expect(screen.getByText("9")).toBeTruthy()
    // None of the v1 lifetime labels.
    expect(screen.queryByText("Lifetime revenue")).toBeNull()
    expect(screen.queryByText("Lifetime orders")).toBeNull()
  })

  it("shows returns under the sales figure only when there were any", () => {
    card(V2)
    expect(screen.queryByText(/in returns/)).toBeNull()

    card({ ...V2, revenue: { ...V2.revenue, period_returns: 45.5 } })
    expect(screen.getByText(`After ${money(45.5)} in returns`)).toBeTruthy()
  })

  it("drops the 'of N placed' hint when every placed order counted", () => {
    card({ ...V2, orders: { ...V2.orders, placed: 15 } })
    expect(screen.queryByText(/^of \d+ placed$/)).toBeNull()
  })

  it("breaks the sales down by channel, in the channels' own names and colours", () => {
    card(V2)
    const breakdown = screen.getByTestId("channel-breakdown")
    const scope = within(breakdown)

    expect(scope.getByText("Sales by channel")).toBeTruthy()
    expect(scope.getByText("Telegram")).toBeTruthy()
    expect(scope.getByText("Online store")).toBeTruthy()
    expect(scope.getByText("Manual orders")).toBeTruthy()
    expect(scope.getByText("12 orders")).toBeTruthy()
    expect(scope.getByText("1 order")).toBeTruthy()
    expect(scope.getByText(money(1020.3))).toBeTruthy()
    expect(scope.getByText("91.9%")).toBeTruthy()

    // The stacked bar: one segment per channel, in the tool's order, painted
    // with the shared channel colour and weighted by sales.
    const segments = breakdown.querySelectorAll<HTMLElement>("[data-channel]")
    expect(Array.from(segments, (s) => s.dataset.channel)).toEqual([
      "TELEGRAM",
      "ONLINE_STORE",
      "DRAFT_ORDER",
    ])
    expect(segments[0].style.backgroundColor).toBe(
      rgb(SALES_CHANNEL_META.TELEGRAM.color),
    )
    expect(parseFloat(segments[0].style.width)).toBeCloseTo(
      (1020.3 / 1110.3) * 100,
      1,
    )
  })

  it("weights the bar by orders when nothing has sales yet", () => {
    card({
      ...V2,
      by_channel: [
        { channel: "WHATSAPP", sales: 0, orders: 3, share_pct: 0 },
        { channel: "ONLINE_STORE", sales: 0, orders: 1, share_pct: 0 },
      ],
    })
    const segments = screen
      .getByTestId("channel-breakdown")
      .querySelectorAll<HTMLElement>("[data-channel]")
    expect(parseFloat(segments[0].style.width)).toBeCloseTo(75, 5)
    expect(screen.getByText("WhatsApp")).toBeTruthy()
  })

  it("still lists a channel the dashboard does not know, under the server's name", () => {
    card({
      ...V2,
      by_channel: [{ channel: "POS_TERMINAL", sales: 10, orders: 1, share_pct: 100 }],
    })
    expect(screen.getByText("pos terminal")).toBeTruthy()
  })

  it("leaves the breakdown out when no channel took an order", () => {
    card({ ...V2, by_channel: [] })
    expect(screen.queryByTestId("channel-breakdown")).toBeNull()
  })

  it("keeps the status chips", () => {
    card(V2)
    expect(screen.getByText("Orders by status")).toBeTruthy()
    expect(screen.getByText("Out for delivery")).toBeTruthy()
  })

  it("names the lifetime totals and the sales basis in the small print", () => {
    card(V2)
    expect(
      screen.getByText(`All time: ${money(1210.8)} · 17 orders`),
    ).toBeTruthy()
    const basis = screen.getByText(/except cancelled and failed ones/)
    // The server's own sentence is kept as the hover title.
    expect(basis.getAttribute("title")).toBe(V2.sales_basis)
  })

  it("prints amounts in the currency the payload names", () => {
    card(V2, "USD")
    expect(screen.getByText(money(1110.3))).toBeTruthy()
  })
})

describe("<ShopStatsCard /> — v1 from history", () => {
  it("labels the old tiles with their real scope", () => {
    card(V1)
    expect(screen.getByText("Lifetime revenue")).toBeTruthy()
    expect(screen.getByText(money(22.7))).toBeTruthy()
    expect(screen.getByText("Today's revenue")).toBeTruthy()
    expect(screen.getByText("Lifetime orders")).toBeTruthy()
    expect(screen.getByText("16")).toBeTruthy()
    expect(screen.getByText("New customers (30 days)")).toBeTruthy()
    expect(screen.getByText("34")).toBeTruthy()
    expect(
      screen.getByText(/earlier version of Sidekick: revenue here counts completed orders only/),
    ).toBeTruthy()
  })

  it("puts the period on the status chips alone, not over the lifetime tiles", () => {
    const { container } = card(V1)
    const labels = screen.getAllByText("Last 7 days")
    expect(labels).toHaveLength(1)
    expect(labels[0].parentElement?.textContent).toContain("Orders by status")

    // The header carries the title and nothing else.
    const header = container.firstElementChild?.firstElementChild
    expect(header?.textContent).toBe("Shop stats")
  })

  it("has no channel breakdown to show", () => {
    card(V1)
    expect(screen.queryByTestId("channel-breakdown")).toBeNull()
  })
})

describe("<ToolEventRenderer /> — get_shop_stats", () => {
  it.each([
    ["v1", V1],
    ["v2", V2],
  ])("routes a %s payload to the stats card", (_label, result) => {
    render(
      <ToolEventRenderer
        event={{ name: "get_shop_stats", args: {}, ok: true, result }}
        currency="SAR"
        locale="en"
      />,
    )
    expect(screen.getByText("Shop stats")).toBeTruthy()
    expect(screen.queryByText("get_shop_stats")).toBeNull()
  })
})
