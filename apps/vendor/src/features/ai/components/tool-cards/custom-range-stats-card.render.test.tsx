import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"

import { CustomRangeStatsCard } from "./custom-range-stats-card"
import { ToolEventRenderer } from "./tool-event-renderer"
import {
  formatCalendarDate,
  formatCalendarRange,
  formatMoney,
} from "./stats-format"
import type {
  CustomRangeStatsResultV1,
  CustomRangeStatsResultV2,
} from "@/features/ai/lib/types"

// The renderer pulls in the form-handoff card, which routes.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ shopSlug: "shop" }),
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

const V2: CustomRangeStatsResultV2 = {
  ok: true,
  version: 2,
  currency: "SAR",
  range: { start_date: "2026-09-22", end_date: "2026-09-28", timezone: "UTC" },
  sales_basis:
    "Orders placed in the range except cancelled and failed, minus settled refunds.",
  total_revenue: 990.3,
  returns: 0,
  average_order_value: 76.18,
  total_orders: 14,
  sale_orders: 13,
  completed_orders: 1,
  cancelled_orders: 0,
  failed_orders: 1,
  by_channel: [
    { channel: "TELEGRAM", sales: 900.3, orders: 11, share_pct: 90.9 },
    { channel: "ONLINE_STORE", sales: 90, orders: 2, share_pct: 9.1 },
  ],
}

const V1: CustomRangeStatsResultV1 = {
  ok: true,
  range: { start_date: "2026-09-22", end_date: "2026-09-28" },
  total_orders: 10,
  total_revenue: 22.7,
  completed_orders: 1,
  cancelled_orders: 0,
}

const money = (n: number) => formatMoney(n, "SAR")

function card(result: CustomRangeStatsResultV1 | CustomRangeStatsResultV2) {
  return render(
    <CustomRangeStatsCard result={result} currency="SAR" locale="en" />,
  )
}

describe("<CustomRangeStatsCard /> — v2", () => {
  it("shows the range as the shop's calendar dates", () => {
    card(V2)
    // ICU puts thin spaces around the dash, and the DOM side of the match is
    // whitespace-collapsed while the expected string is not.
    const dates = formatCalendarRange("2026-09-22", "2026-09-28", "en", true)!
    expect(screen.getByText(dates.replace(/\s+/g, " "))).toBeTruthy()
  })

  it("reads an open end as 'since' the start date", () => {
    card({ ...V2, range: { ...V2.range, end_date: null } })
    const start = formatCalendarDate("2026-09-22", "en", true)!
    expect(screen.getByText(`Since ${start}`)).toBeTruthy()
  })

  it("leads with sales, the orders that counted and the average order", () => {
    card(V2)
    expect(screen.getByText("Sales")).toBeTruthy()
    expect(screen.getByText(money(990.3))).toBeTruthy()
    expect(screen.getByText("13")).toBeTruthy()
    expect(screen.getByText("of 14 placed")).toBeTruthy()
    expect(screen.getByText("Average order")).toBeTruthy()
    expect(screen.getByText(money(76.18))).toBeTruthy()
    // The v1 completed-only label is gone.
    expect(screen.queryByText("Revenue (completed orders)")).toBeNull()
  })

  it("shows returns only when there were any", () => {
    card(V2)
    expect(screen.queryByText(/in returns/)).toBeNull()

    card({ ...V2, returns: 12.5 })
    expect(screen.getByText(`After ${money(12.5)} in returns`)).toBeTruthy()
  })

  it("keeps completed, cancelled and failed as small counts", () => {
    card(V2)
    const completed = screen.getByText("Completed").parentElement!
    expect(completed.textContent).toBe("Completed1")
    expect(screen.getByText("Cancelled").parentElement!.textContent).toBe(
      "Cancelled0",
    )
    expect(screen.getByText("Failed").parentElement!.textContent).toBe(
      "Failed1",
    )
  })

  it("breaks the range's sales down by channel", () => {
    card(V2)
    const breakdown = within(screen.getByTestId("channel-breakdown"))
    expect(breakdown.getByText("Telegram")).toBeTruthy()
    expect(breakdown.getByText("Online store")).toBeTruthy()
    expect(breakdown.getByText("11 orders")).toBeTruthy()
    expect(breakdown.getByText("90.9%")).toBeTruthy()
  })

  it("carries the sales basis, with the server's sentence as the hover title", () => {
    card(V2)
    const basis = screen.getByText(/except cancelled and failed ones/)
    expect(basis.getAttribute("title")).toBe(V2.sales_basis)
  })
})

describe("<CustomRangeStatsCard /> — v1 from history", () => {
  it("keeps the old tiles, with the revenue named for what it counted", () => {
    card(V1)
    expect(screen.getByText("Revenue (completed orders)")).toBeTruthy()
    expect(screen.getByText(money(22.7))).toBeTruthy()
    expect(screen.getByText("Total orders")).toBeTruthy()
    expect(screen.getByText("10")).toBeTruthy()
    expect(screen.getByText("Completed")).toBeTruthy()
    expect(screen.getByText("Cancelled")).toBeTruthy()
    expect(
      screen.getByText(/earlier version of Sidekick: revenue here counts completed orders only/),
    ).toBeTruthy()
    expect(screen.queryByTestId("channel-breakdown")).toBeNull()
  })

  it("prints a range it cannot parse as it arrived", () => {
    card({ ...V1, range: { start_date: "last week", end_date: "yesterday" } })
    expect(screen.getByText("last week – yesterday")).toBeTruthy()
  })
})

describe("<ToolEventRenderer /> — get_custom_range_stats", () => {
  it.each([
    ["v1", V1],
    ["v2", V2],
  ])("routes a %s payload to the range card", (_label, result) => {
    render(
      <ToolEventRenderer
        event={{ name: "get_custom_range_stats", args: {}, ok: true, result }}
        currency="SAR"
        locale="en"
      />,
    )
    expect(screen.getByText("Range stats")).toBeTruthy()
    expect(screen.queryByText("get_custom_range_stats")).toBeNull()
  })
})
