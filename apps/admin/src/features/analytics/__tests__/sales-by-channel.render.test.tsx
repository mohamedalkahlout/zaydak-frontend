import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import { CombinedGraphQLErrors } from "@apollo/client/errors"

import en from "@/shared/messages/en.json"
import { SalesChannel } from "@/shared/api/generated/graphql"
import type { SalesByChannelData } from "../types"

/**
 * The platform-wide "Sales by channel" panel. `salesByChannel` answers
 * without `X-SHOP` across every shop; the panel draws it in CSS (the console
 * ships no chart library), keeps a refund-heavy channel from breaking the
 * shares, and — because the console ships before the API is rebuilt — is
 * left out entirely when the API does not know the field, while every other
 * card on the page still renders.
 */

const apollo = vi.hoisted(() => ({
  channelsDoc: null as unknown,
  channels: {} as Record<string, unknown>,
}))

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>()
  return {
    ...actual,
    useTranslations: (namespace?: string) =>
      actual.createTranslator({
        locale: "en",
        messages: en as never,
        namespace: namespace as never,
      }),
    useLocale: () => "en",
  }
})

vi.mock("@apollo/client/react", () => ({
  useQuery: (doc: unknown) =>
    doc === apollo.channelsDoc
      ? apollo.channels
      : { data: undefined, loading: false, error: undefined },
}))

const api = await import("../api")
apollo.channelsDoc = api.ADMIN_PLATFORM_SALES_BY_CHANNEL
const { SalesByChannelCard } = await import(
  "../components/sales-by-channel-card"
)
const { PlatformAnalytics } = await import("../components/analytics-page")

beforeAll(() => {
  // boneyard observes its box and reads the colour scheme on mount.
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

const t = en.analytics.salesByChannel

function channelRow(
  channel: SalesChannel,
  over: Partial<SalesByChannelData["rows"][number]> = {},
): SalesByChannelData["rows"][number] {
  return {
    __typename: "SalesChannelRow",
    channel,
    total_sales_cents: 0,
    orders_count: 0,
    returns_cents: 0,
    customers_count: 0,
    previous_total_sales_cents: null,
    ...over,
  }
}

const REPORT: SalesByChannelData = {
  __typename: "SalesByChannelReport",
  total_sales_cents: 107_000,
  orders_count: 15,
  rows: [
    channelRow(SalesChannel.OnlineStore, {
      total_sales_cents: 30_000,
      orders_count: 3,
      customers_count: 3,
      previous_total_sales_cents: 60_000,
    }),
    channelRow(SalesChannel.Telegram, {
      total_sales_cents: 80_000,
      orders_count: 12,
      customers_count: 9,
      previous_total_sales_cents: 40_000,
    }),
    channelRow(SalesChannel.Whatsapp),
    // Refunds this window on orders placed before it.
    channelRow(SalesChannel.DraftOrder, {
      total_sales_cents: -3_000,
      returns_cents: 3_000,
    }),
  ],
}

function renderCard(
  over: Partial<Parameters<typeof SalesByChannelCard>[0]> = {},
) {
  return render(
    <SalesByChannelCard
      report={REPORT}
      loading={false}
      refreshing={false}
      error={false}
      onRetry={() => {}}
      days={30}
      windows={[7, 30, 90]}
      onDaysChange={() => {}}
      {...over}
    />,
  )
}

function rowOf(channel: string): HTMLElement {
  const li = document.querySelector<HTMLElement>(`li[data-channel="${channel}"]`)
  if (!li) throw new Error(`no row for ${channel}`)
  return li
}

describe("SalesByChannelCard", () => {
  it("lists every channel, largest first, with sales, share and orders", () => {
    renderCard()

    expect(screen.getByText(t.title)).toBeTruthy()
    const order = [...document.querySelectorAll("li[data-channel]")].map(
      (li) => li.getAttribute("data-channel"),
    )
    expect(order).toEqual(["TELEGRAM", "ONLINE_STORE", "DRAFT_ORDER", "WHATSAPP"])

    const telegram = within(rowOf("TELEGRAM"))
    expect(telegram.getByText(t.channels.TELEGRAM)).toBeTruthy()
    expect(telegram.getByText("800.00")).toBeTruthy()
    // 80,000 of the 110,000 actually sold, not of the 107,000 net.
    expect(telegram.getByText("73%")).toBeTruthy()
    expect(telegram.getByText(/12 orders/)).toBeTruthy()
    expect(telegram.getByText("+100% on the previous window")).toBeTruthy()

    expect(
      within(rowOf("ONLINE_STORE")).getByText("-50% on the previous window"),
    ).toBeTruthy()
  })

  it("gives a refund-heavy channel no slice and no nonsense", () => {
    renderCard()

    const drafts = within(rowOf("DRAFT_ORDER"))
    expect(drafts.getByText("-30.00")).toBeTruthy()
    expect(drafts.getByText("0%")).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/)
    // The ribbon draws only what sold.
    const segments = document.querySelectorAll('[role="img"] [data-channel]')
    expect([...segments].map((s) => s.getAttribute("data-channel"))).toEqual([
      "TELEGRAM",
      "ONLINE_STORE",
    ])
  })

  it("says so when the window has no orders", () => {
    renderCard({
      report: {
        ...REPORT,
        total_sales_cents: 0,
        orders_count: 0,
        rows: REPORT.rows.map((r) => channelRow(r.channel)),
      },
    })
    expect(screen.getByText(t.empty)).toBeTruthy()
  })

  it("offers a retry for a failure that is not a schema mismatch", () => {
    const onRetry = vi.fn()
    renderCard({ report: undefined, error: true, onRetry })
    expect(screen.getByText(t.error)).toBeTruthy()
    screen.getByRole("button", { name: t.retry }).click()
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})

describe("PlatformAnalytics and an API without salesByChannel", () => {
  it("renders the panel when the API answers", () => {
    apollo.channels = {
      data: { salesByChannel: { success: true, data: REPORT } },
      loading: false,
      error: undefined,
      refetch: vi.fn(),
    }
    render(<PlatformAnalytics />)
    expect(screen.getByText(t.title)).toBeTruthy()
  })

  it("leaves the panel out, and only the panel", () => {
    apollo.channels = {
      data: undefined,
      loading: false,
      error: new CombinedGraphQLErrors({
        errors: [
          {
            message: 'Cannot query field "salesByChannel" on type "Query".',
            extensions: { error_code: "VALIDATION_ERROR" },
          },
        ],
      }),
      refetch: vi.fn(),
    }
    render(<PlatformAnalytics />)
    expect(screen.queryByText(t.title)).toBeNull()
    expect(screen.queryByText(t.error)).toBeNull()
    expect(screen.getByText(en.analytics.revenueByMonth.title)).toBeTruthy()
    expect(screen.getByText(en.analytics.ordersByStatus.title)).toBeTruthy()
  })
})
