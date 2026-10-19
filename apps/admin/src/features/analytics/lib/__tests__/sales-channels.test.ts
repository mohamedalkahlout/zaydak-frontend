import { describe, expect, it } from "vitest"
import { CombinedGraphQLErrors, ServerError } from "@apollo/client/errors"
import {
  SALES_CHANNELS,
  channelShares,
  formatChange,
  formatShare,
  isIdleChannel,
  normalizeChannelRows,
  orderChannelRows,
  salesChange,
  type ChannelFigures,
} from "../sales-channels"
import { isSchemaMismatchError } from "../schema-mismatch"

function row(
  channel: string,
  over: Partial<Omit<ChannelFigures, "channel">> = {},
) {
  return {
    channel,
    total_sales_cents: 0,
    orders_count: 0,
    returns_cents: 0,
    customers_count: 0,
    previous_total_sales_cents: null as number | null | undefined,
    ...over,
  }
}

describe("sales channels", () => {
  it("normalizes to one row per known channel, in display order", () => {
    const rows = normalizeChannelRows([
      row("TELEGRAM", { total_sales_cents: 500 }),
      row("FAX", { total_sales_cents: 900 }),
      row("TELEGRAM", { total_sales_cents: 1 }),
    ])
    expect(rows.map((r) => r.channel)).toEqual([...SALES_CHANNELS])
    expect(rows[1].total_sales_cents).toBe(500)
    expect(rows[0]).toMatchObject({ total_sales_cents: 0, orders_count: 0 })
    expect(rows[0].previous_total_sales_cents).toBeNull()
  })

  it("orders by sales, zeros last in display order", () => {
    const rows = normalizeChannelRows([
      row("WHATSAPP", { total_sales_cents: 100 }),
      row("TELEGRAM", { total_sales_cents: 900 }),
    ])
    expect(orderChannelRows(rows).map((r) => r.channel)).toEqual([
      "TELEGRAM",
      "WHATSAPP",
      "ONLINE_STORE",
      "DRAFT_ORDER",
    ])
  })

  it("gives a refund-heavy channel no slice and shares the rest of what sold", () => {
    const rows = normalizeChannelRows([
      row("ONLINE_STORE", { total_sales_cents: 300 }),
      row("TELEGRAM", { total_sales_cents: 100 }),
      row("DRAFT_ORDER", { total_sales_cents: -250, returns_cents: 250 }),
    ])
    const shares = channelShares(rows)
    expect(shares.ONLINE_STORE).toBe(0.75)
    expect(shares.TELEGRAM).toBe(0.25)
    expect(shares.DRAFT_ORDER).toBe(0)
    expect(shares.WHATSAPP).toBe(0)
  })

  it("has no shares at all when nothing sold", () => {
    const shares = channelShares(normalizeChannelRows([]))
    expect(Object.values(shares).every((s) => s === 0)).toBe(true)
  })

  it("is idle only with no orders, no sales and no refunds", () => {
    expect(isIdleChannel(normalizeChannelRows([])[0])).toBe(true)
    expect(
      isIdleChannel(
        normalizeChannelRows([row("ONLINE_STORE", { returns_cents: 10 })])[0],
      ),
    ).toBe(false)
  })

  it("formats a share without claiming 0% or 100% it did not earn", () => {
    const below = (s: string) => `under ${s}`
    expect(formatShare(0.4, "en", below)).toBe("40%")
    expect(formatShare(0.003, "en", below)).toBe("under 1%")
    expect(formatShare(0.996, "en", below)).toBe("99%")
    expect(formatShare(1, "en", below)).toBe("100%")
    expect(formatShare(0, "en", below)).toBe("0%")
  })

  it("compares with the previous window only over a positive figure", () => {
    const [store] = normalizeChannelRows([
      row("ONLINE_STORE", {
        total_sales_cents: 1_200,
        previous_total_sales_cents: 1_000,
      }),
    ])
    expect(salesChange(store)).toBeCloseTo(0.2)
    expect(formatChange(0.2, "en")).toBe("+20%")
    expect(formatChange(-0.04, "en")).toBe("-4%")

    for (const previous of [null, 0, -500]) {
      const [r] = normalizeChannelRows([
        row("ONLINE_STORE", {
          total_sales_cents: 1_200,
          previous_total_sales_cents: previous,
        }),
      ])
      expect(salesChange(r)).toBeNull()
    }
  })
})

describe("isSchemaMismatchError", () => {
  it("is true only when every error says the schema lacks something", () => {
    expect(
      isSchemaMismatchError(
        new CombinedGraphQLErrors({
          errors: [
            {
              message: 'Cannot query field "salesByChannel" on type "Query".',
              extensions: { code: "VALIDATION_ERROR" },
            },
          ],
        }),
      ),
    ).toBe(true)
    expect(
      isSchemaMismatchError(
        new CombinedGraphQLErrors({
          errors: [
            {
              message: "Forbidden",
              extensions: { code: "FORBIDDEN" },
            },
          ],
        }),
      ),
    ).toBe(false)
  })

  it("reads a 400 body and leaves network failures alone", () => {
    const response = new Response("", { status: 400 })
    expect(
      isSchemaMismatchError(
        new ServerError("Response not successful", {
          response,
          bodyText: 'Unknown type "SalesByChannelInput".',
        }),
      ),
    ).toBe(true)
    expect(isSchemaMismatchError(new Error("Failed to fetch"))).toBe(false)
    expect(isSchemaMismatchError(undefined)).toBe(false)
  })
})
