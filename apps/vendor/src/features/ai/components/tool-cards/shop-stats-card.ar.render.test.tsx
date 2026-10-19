import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"

import { ShopStatsCard } from "./shop-stats-card"
import { formatMoney } from "./stats-format"
import { setTestLocale } from "@/features/ai/test-utils/next-intl"
import type {
  ShopStatsResultV1,
  ShopStatsResultV2,
} from "@/features/ai/lib/types"

vi.mock("next-intl", async () =>
  (await import("@/features/ai/test-utils/next-intl")).bilingualNextIntlMock(),
)

/**
 * The Arabic side of the stats card, against the real `ar` catalogue: the
 * v1 orders tile used to read "الطلبات الكاملة" ("completed orders") over a
 * lifetime count of every order, and the channel legend's order counts are
 * the six-form plural rather than "2 طلبات".
 */

const STATUS = {
  pending: 0,
  processing: 0,
  completed: 0,
  cancelled: 0,
  refunded: 0,
  failed: 0,
  at_local_facility: 0,
  out_for_delivery: 0,
}

const V1: ShopStatsResultV1 = {
  ok: true,
  period: "monthly",
  revenue: { total: 22.7, today: 0, refunds: 0 },
  orders: { total: 16, by_status: STATUS },
  new_customers: 34,
}

const V2: ShopStatsResultV2 = {
  ok: true,
  version: 2,
  period: "monthly",
  currency: "SAR",
  window: {
    start: "2026-08-31T00:00:00.000Z",
    end: "2026-09-29T12:00:00.000Z",
    from_date: "2026-08-31",
    to_date: "2026-09-29",
    days: 30,
    timezone: "UTC",
  },
  sales_basis: "basis",
  revenue: {
    period_sales: 300,
    period_returns: 0,
    average_order_value: 18.75,
    today_sales: 0,
    lifetime_sales: 300,
  },
  orders: {
    placed: 16,
    counted_as_sales: 16,
    lifetime_placed: 2,
    by_status: STATUS,
  },
  new_customers: 3,
  by_channel: [
    { channel: "TELEGRAM", sales: 200, orders: 11, share_pct: 66.7 },
    { channel: "WHATSAPP", sales: 60, orders: 3, share_pct: 20 },
    { channel: "ONLINE_STORE", sales: 30, orders: 2, share_pct: 10 },
    { channel: "DRAFT_ORDER", sales: 10, orders: 1, share_pct: 3.3 },
  ],
}

describe("<ShopStatsCard /> in Arabic", () => {
  beforeEach(() => setTestLocale("ar"))

  it("names the v1 tiles' real scope", () => {
    render(<ShopStatsCard result={V1} currency="SAR" locale="ar" />)
    expect(screen.getByText("إجمالي الطلبات منذ البداية")).toBeTruthy()
    expect(screen.queryByText("الطلبات الكاملة")).toBeNull()
    expect(screen.getByText("إجمالي الإيرادات منذ البداية")).toBeTruthy()
    expect(screen.getByText("عملاء جدد (آخر 30 يوماً)")).toBeTruthy()
    // The period sits on the chips, not over the tiles.
    expect(screen.getByText("آخر 30 يوماً")).toBeTruthy()
  })

  it("counts each channel's orders with the right plural form", () => {
    render(<ShopStatsCard result={V2} currency="SAR" locale="ar" />)
    const legend = within(screen.getByTestId("channel-breakdown"))
    expect(legend.getByText("المبيعات حسب القناة")).toBeTruthy()
    expect(legend.getByText("تيليجرام")).toBeTruthy()
    expect(legend.getByText("11 طلباً")).toBeTruthy()
    expect(legend.getByText("3 طلبات")).toBeTruthy()
    expect(legend.getByText("طلبان")).toBeTruthy()
    expect(legend.getByText("طلب واحد")).toBeTruthy()
    expect(
      screen.getByText(`منذ البداية: ${formatMoney(300, "SAR")} · طلبان`),
    ).toBeTruthy()
  })
})
