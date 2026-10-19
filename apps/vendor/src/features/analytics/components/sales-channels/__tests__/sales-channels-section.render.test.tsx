import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { SalesChannel } from "@/shared/lib/sales-channels"
import type { SalesByChannelReport, SalesChannelRow } from "../../../types"

// The real catalogues, in either language. `nextIntlMock()` is English-only,
// and this section's Arabic copy (six plural forms, a sentence built around
// the share rather than the channel) is worth rendering for real too.
const intl = vi.hoisted(() => ({ locale: "en" as "en" | "ar" }))

vi.mock("next-intl", async () => {
  const actual = await vi.importActual<typeof import("next-intl")>("next-intl")
  const { default: en } = await import("@/shared/messages/en")
  const { default: ar } = await import("@/shared/messages/ar")
  return {
    ...actual,
    useLocale: () => intl.locale,
    useTranslations: (namespace?: string) =>
      actual.createTranslator({
        locale: intl.locale,
        messages: (intl.locale === "ar" ? ar : en) as Parameters<
          typeof actual.createTranslator
        >[0]["messages"],
        namespace: namespace as never,
      }),
  }
})

const { SalesChannelsSection } = await import("../sales-channels-section")

beforeAll(() => {
  // recharts' ResponsiveContainer observes its box; jsdom has no observer.
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

afterEach(() => {
  cleanup()
  intl.locale = "en"
})

function row(
  channel: SalesChannel,
  overrides: Partial<SalesChannelRow> = {},
): SalesChannelRow {
  return {
    channel,
    orders_count: 0,
    total_sales_cents: 0,
    returns_cents: 0,
    average_order_value_cents: 0,
    customers_count: 0,
    share_bps: 0,
    previous_total_sales_cents: 0,
    previous_orders_count: 0,
    connected: true,
    series: [],
    ...overrides,
  }
}

function report(rows: SalesChannelRow[]): SalesByChannelReport {
  return {
    start: "2026-08-31T00:00:00.000Z",
    end: "2026-09-29T08:56:10.562Z",
    granularity: "day",
    currency: "SAR",
    timezone: "UTC",
    total_sales_cents: rows.reduce((s, r) => s + r.total_sales_cents, 0),
    orders_count: rows.reduce((s, r) => s + r.orders_count, 0),
    rows,
  }
}

// entaj over the last 30 days: most sales through the Telegram assistant,
// WhatsApp not connected.
const ENTAJ = report([
  row("ONLINE_STORE", {
    orders_count: 2,
    total_sales_cents: 6810,
    average_order_value_cents: 3405,
    customers_count: 1,
    series: [{ date: "2026-09-25", total_sales_cents: 6810, orders_count: 2 }],
  }),
  row("TELEGRAM", {
    orders_count: 11,
    total_sales_cents: 101950,
    average_order_value_cents: 9268,
    customers_count: 3,
    previous_total_sales_cents: 50975,
    previous_orders_count: 11,
    series: [
      { date: "2026-09-26", total_sales_cents: 11350, orders_count: 4 },
      { date: "2026-09-27", total_sales_cents: 37510, orders_count: 3 },
      { date: "2026-09-28", total_sales_cents: 53090, orders_count: 4 },
    ],
  }),
  row("WHATSAPP", { connected: false }),
  row("DRAFT_ORDER", {
    orders_count: 2,
    total_sales_cents: 11350,
    average_order_value_cents: 5675,
    series: [{ date: "2026-09-19", total_sales_cents: 9080, orders_count: 1 }],
  }),
])

function renderSection(
  props: Partial<Parameters<typeof SalesChannelsSection>[0]> = {},
) {
  const onRetry = vi.fn()
  const utils = render(
    <SalesChannelsSection
      report={ENTAJ}
      loading={false}
      refreshing={false}
      error={false}
      onRetry={onRetry}
      compare
      shopSlug="entaj"
      {...props}
    />,
  )
  return { ...utils, onRetry }
}

const tileOrder = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("li[data-channel]")).map((el) =>
    el.getAttribute("data-channel"),
  )

describe("SalesChannelsSection", () => {
  it("names the leading channel and its share of sales", () => {
    const { container } = renderSection()
    expect(screen.getByText("Sales by channel")).toBeTruthy()
    const headline = container.querySelector("p[aria-live]")
    expect(headline?.textContent).toBe(
      "Telegram brought 85% of your sales in this period",
    )
    expect(
      screen.getByRole("img", {
        name: "Share of sales by channel: Telegram 85%, Manual orders 9%, Online store 6%, WhatsApp 0%",
      }),
    ).toBeTruthy()
  })

  it("sorts the tiles by sales, with the idle channel last", () => {
    const { container } = renderSection()
    expect(tileOrder(container)).toEqual([
      "TELEGRAM",
      "DRAFT_ORDER",
      "ONLINE_STORE",
      "WHATSAPP",
    ])
    const telegram = container.querySelector('li[data-channel="TELEGRAM"]')!
    expect(telegram.textContent).toContain("85% of sales")
    expect(telegram.textContent).toContain("11 orders")
    expect(telegram.textContent).toContain("3 customers")
    // Compared with 509.75 SAR in the previous period: doubled.
    expect(telegram.textContent).toContain("+100.0%")
  })

  it("offers to connect an idle chat channel that is not live", () => {
    const { container } = renderSection()
    const whatsapp = container.querySelector('li[data-channel="WHATSAPP"]')!
    expect(whatsapp.hasAttribute("data-idle")).toBe(true)
    expect(whatsapp.textContent).toContain(
      "Orders your assistant took on WhatsApp",
    )
    const link = screen.getByRole("link", { name: /Connect WhatsApp/ })
    expect(link.getAttribute("href")).toBe("/store/entaj/settings/whatsapp")
  })

  it("links an idle manual-orders tile to the drafts screen", () => {
    const rows = ENTAJ.rows.map((r) =>
      r.channel === "DRAFT_ORDER" ? row("DRAFT_ORDER") : r,
    )
    renderSection({ report: report(rows) })
    const link = screen.getByRole("link", { name: /Open draft orders/ })
    expect(link.getAttribute("href")).toBe("/store/entaj/orders/drafts")
  })

  it("re-sorts and re-words everything for Orders", () => {
    const { container } = renderSection()
    fireEvent.click(screen.getByRole("radio", { name: "Orders" }))
    expect(
      screen
        .getByRole("radio", { name: "Orders" })
        .getAttribute("aria-checked"),
    ).toBe("true")
    expect(container.querySelector("p[aria-live]")?.textContent).toBe(
      "Telegram brought 73% of your orders in this period",
    )
    // Online store and manual orders tie on 2 orders: display order decides.
    expect(tileOrder(container)).toEqual([
      "TELEGRAM",
      "ONLINE_STORE",
      "DRAFT_ORDER",
      "WHATSAPP",
    ])
  })

  it("hides the comparison when compare is off", () => {
    const { container } = renderSection({ compare: false })
    const telegram = container.querySelector('li[data-channel="TELEGRAM"]')!
    expect(telegram.textContent).not.toContain("+100.0%")
  })

  it("says so when one channel took every sale", () => {
    const rows = [
      row("ONLINE_STORE"),
      row("TELEGRAM", { orders_count: 1, total_sales_cents: 5000 }),
      row("WHATSAPP"),
      row("DRAFT_ORDER"),
    ]
    const { container } = renderSection({ report: report(rows) })
    expect(container.querySelector("p[aria-live]")?.textContent).toBe(
      "All of your sales in this period came from Telegram",
    )
  })

  // A refund settled in the window against an order placed before it, with no
  // sale on that channel since: its total is negative and its orders 0.
  it("gives a refund-heavy channel no slice, but still shows its figure", () => {
    const rows = [
      row("ONLINE_STORE", {
        total_sales_cents: -2000,
        returns_cents: 2000,
        series: [
          { date: "2026-09-20", total_sales_cents: -2000, orders_count: 0 },
          { date: "2026-09-21", total_sales_cents: 0, orders_count: 0 },
        ],
      }),
      row("TELEGRAM", {
        orders_count: 2,
        total_sales_cents: 10000,
        average_order_value_cents: 5000,
        series: [
          { date: "2026-09-20", total_sales_cents: 4000, orders_count: 1 },
          { date: "2026-09-21", total_sales_cents: 6000, orders_count: 1 },
        ],
      }),
      row("WHATSAPP"),
      row("DRAFT_ORDER"),
    ]
    const { container } = renderSection({ report: report(rows) })

    // Shares are of what was sold (100.00), so Telegram took all of it.
    expect(container.querySelector("p[aria-live]")?.textContent).toBe(
      "All of your sales in this period came from Telegram",
    )
    // After the positive channel, before the idle ones.
    expect(tileOrder(container)).toEqual([
      "TELEGRAM",
      "ONLINE_STORE",
      "WHATSAPP",
      "DRAFT_ORDER",
    ])
    const store = container.querySelector('li[data-channel="ONLINE_STORE"]')!
    expect(store.hasAttribute("data-idle")).toBe(false)
    expect(store.textContent).toContain("0% of sales")
    expect(store.textContent).toContain("-SAR")
    expect(store.textContent).toContain("20.00")
    // The ribbon draws the positive channel alone.
    const ribbon = screen.getByRole("img", {
      name: /Share of sales by channel/,
    })
    expect(
      Array.from(ribbon.querySelectorAll("[data-channel]")).map((el) =>
        el.getAttribute("data-channel"),
      ),
    ).toEqual(["TELEGRAM"])
    // The chart's table twin carries the negative bucket as it is.
    const table = container.querySelector(".sr-only table")!
    const firstDay = Array.from(table.querySelectorAll("tbody tr"))[0]!
    expect(firstDay.textContent).toContain("-SAR")
  })

  it("shows the empty state when nothing happened in the window", () => {
    renderSection({
      report: report([
        row("ONLINE_STORE"),
        row("TELEGRAM"),
        row("WHATSAPP"),
        row("DRAFT_ORDER"),
      ]),
    })
    expect(screen.getByText(/No orders in this period/)).toBeTruthy()
    expect(screen.queryByRole("radiogroup")).toBeNull()
  })

  it("shows an inline error with a working retry", () => {
    const { onRetry } = renderSection({ report: undefined, error: true })
    expect(
      screen.getByText("Sales by channel could not be loaded"),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }))
    expect(onRetry).toHaveBeenCalledOnce()
    expect(screen.queryByRole("radiogroup")).toBeNull()
  })

  it("disables retry while the retry is in flight", () => {
    renderSection({ report: undefined, error: true, loading: true })
    expect(
      (screen.getByRole("button", { name: /Try again/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
  })

  it("renders skeleton containers, busy, before the first report", () => {
    const { container } = renderSection({ report: undefined, loading: true })
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy()
    for (const name of ["headline", "tiles", "chart"]) {
      expect(
        container.querySelector(
          `[data-boneyard="analytics-sales-channels-${name}"]`,
        ),
      ).toBeTruthy()
    }
    expect(screen.queryByText(/brought/)).toBeNull()
  })

  it("holds the previous report, dimmed, while a new one loads", () => {
    const { container } = renderSection({ loading: true, refreshing: true })
    expect(container.querySelector('[aria-busy="true"]')?.className).toContain(
      "opacity-60",
    )
    expect(container.querySelector("p[aria-live]")?.textContent).toContain(
      "Telegram",
    )
  })

  it("reads naturally in Arabic", () => {
    intl.locale = "ar"
    const { container } = renderSection()
    expect(screen.getByText("المبيعات حسب القناة")).toBeTruthy()
    const headline = container.querySelector("p[aria-live]")?.textContent ?? ""
    expect(headline).toContain("من مبيعاتك في هذه الفترة جاءت عبر")
    expect(headline).toContain("تيليجرام")
    const drafts = container.querySelector('li[data-channel="DRAFT_ORDER"]')!
    // Two orders is the dual form, not "2 طلبات".
    expect(drafts.textContent).toContain("طلبان")
    expect(screen.getByRole("link", { name: /ربط واتساب/ })).toBeTruthy()
  })
})
