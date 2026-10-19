import { describe, expect, it } from "vitest"

import {
  CREATED_FIELD,
  createdWindow,
  encodeCustomRange,
  exportFilters,
  msUntilNextLocalMidnight,
  orderFilterFields,
  parseCustomRange,
  todayAnchorStale,
  toQuery,
} from "@/features/orders/lib/list/filters"
import {
  CHANNEL_OPTIONS,
  ORDER_STATUS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
} from "@/features/orders/lib/list/constants"
import {
  RANGE_PRESETS,
  formatRangeLabel,
  rangeForPreset,
} from "@/features/analytics/lib/date-ranges"
import messages from "@/shared/messages/en"
import { SALES_CHANNELS } from "@/shared/lib/sales-channels"

/**
 * The fields are built from `messages/en` rather than from a stub that
 * echoes its key: a field or a status whose message was never written would
 * otherwise pass here and render as `orders.orderStatus.order-failed` on the
 * merchant's screen.
 */
const t = ((key: string) =>
  key
    .split(".")
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[part]
          : undefined,
      messages.orders,
    )) as unknown as Parameters<typeof orderFilterFields>[0]

const FIELDS = orderFilterFields(t, {
  isAnyOf: "is any of",
  // The same names the analytics page shows, from the same catalogue.
  channelName: (channel) =>
    (messages.salesChannels.names as Record<string, string>)[channel],
  is: "is",
  rangeName: (preset) =>
    (messages.analytics.ranges as Record<string, string>)[preset],
})
const [STATUS, PAYMENT, CHANNEL, CREATED] = FIELDS

describe("orders filter fields", () => {
  it("names each field after the OrderFilters key it fills", () => {
    expect(FIELDS.map((f) => f.id)).toEqual([
      "order_status",
      "payment_status",
      "channel",
      "created",
    ])
    expect(CREATED_FIELD).toBe("created")
  })

  it("labels every field and every value from the message catalogue", () => {
    expect(FIELDS.map((f) => f.label)).toEqual([
      "Status",
      "Payment",
      "Channel",
      "Date",
    ])
    for (const field of FIELDS) {
      for (const option of field.options ?? []) {
        expect(typeof option.label).toBe("string")
        expect(option.label).not.toBe("")
        // A missing message resolves to `undefined` through the reducer above,
        // which is what this is really asserting did not happen.
        expect(option.label).not.toContain("orderStatus.")
        expect(option.label).not.toContain("paymentStatus.")
        expect(option.label).not.toContain("names.")
        expect(option.label).not.toContain("ranges.")
      }
    }
  })

  it("offers every status the badges can render", () => {
    expect(STATUS.options?.map((o) => o.value)).toEqual(
      ORDER_STATUS_OPTIONS.map((o) => o.value),
    )
    expect(PAYMENT.options?.map((o) => o.value)).toEqual(
      PAYMENT_STATUS_OPTIONS.map((o) => o.value),
    )
  })

  it("offers the four sales channels the report splits by, in its order", () => {
    expect(CHANNEL.options?.map((o) => o.value)).toEqual([...SALES_CHANNELS])
    expect(CHANNEL_OPTIONS.map((o) => o.value)).toEqual([...SALES_CHANNELS])
    expect(CHANNEL.options?.map((o) => o.label)).toEqual([
      "Online store",
      "Telegram",
      "WhatsApp",
      "Manual orders",
    ])
  })

  it("offers the analytics page's own date windows, under its names", () => {
    expect(CREATED.options?.map((o) => o.value)).toEqual([...RANGE_PRESETS])
    expect(CREATED.options?.map((o) => o.label)).toEqual([
      "Today",
      "Yesterday",
      "Last 7 days",
      "Last 30 days",
      "Last 90 days",
      "This month",
      "Last month",
      "This year",
    ])
  })

  it("holds several values per status, payment and channel, which is what the comma-joined query means", () => {
    for (const field of [STATUS, PAYMENT, CHANNEL]) {
      expect(field.operators).toHaveLength(1)
      expect(field.operators[0].multi).toBe(true)
      expect(field.operators[0].label).toBe("is any of")
    }
  })

  it("holds one date window at a time", () => {
    expect(CREATED.operators).toHaveLength(1)
    expect(CREATED.operators[0].multi).toBeFalsy()
    expect(CREATED.operators[0].label).toBe("is")
  })
})

describe("toQuery", () => {
  it("projects chips onto the ids the backend mapping reads", () => {
    expect(
      toQuery([
        {
          id: "order_status",
          field: "order_status",
          operator: "is_any_of",
          values: ["order-pending", "order-completed"],
        },
      ]),
    ).toEqual([
      { id: "order_status", value: ["order-pending", "order-completed"] },
    ])
  })

  it("leaves out a chip that has no values yet", () => {
    expect(
      toQuery([
        {
          id: "order_status",
          field: "order_status",
          operator: "is_any_of",
          values: [],
        },
      ]),
    ).toEqual([])
  })

  it("merges two chips on one field rather than letting the later overwrite the earlier", () => {
    expect(
      toQuery([
        {
          id: "a",
          field: "order_status",
          operator: "is_any_of",
          values: ["order-pending"],
        },
        {
          id: "b",
          field: "order_status",
          operator: "is_any_of",
          values: ["order-pending", "order-failed"],
        },
      ]),
    ).toEqual([
      { id: "order_status", value: ["order-pending", "order-failed"] },
    ])
  })

  it("returns nothing for a cleared bar, which is what Reset leaves behind", () => {
    expect(toQuery([])).toEqual([])
  })
})

describe("createdWindow", () => {
  // A Wednesday afternoon, local time: every expectation below is computed on
  // the same clock, so the test holds in any timezone.
  const now = new Date(2026, 8, 30, 15, 45, 12)

  it("cuts the window the analytics page cuts for the same preset", () => {
    for (const preset of RANGE_PRESETS) {
      const window = createdWindow(preset, now)
      expect(window.created_from).toBe(
        rangeForPreset(preset, now).start.toISOString(),
      )
    }
  })

  it("leaves a window that runs to now open at its end", () => {
    // `now` is when the chip was picked; a closed end there would hide every
    // order placed while the list stayed on screen.
    for (const preset of [
      "today",
      "last_7_days",
      "last_30_days",
      "last_90_days",
      "this_month",
      "this_year",
    ]) {
      const window = createdWindow(preset, now)
      expect(window.created_from).toBeDefined()
      expect("created_to" in window).toBe(false)
    }
    expect(createdWindow("last_30_days", now).created_from).toBe(
      new Date(2026, 8, 1).toISOString(),
    )
  })

  it("closes a window that has already ended", () => {
    expect(createdWindow("yesterday", now)).toEqual({
      created_from: new Date(2026, 8, 29).toISOString(),
      created_to: new Date(2026, 8, 30).toISOString(),
    })
    expect(createdWindow("last_month", now)).toEqual({
      created_from: new Date(2026, 7, 1).toISOString(),
      created_to: new Date(2026, 8, 1).toISOString(),
    })
  })

  it("filters nothing for a missing or unknown preset", () => {
    expect(createdWindow(undefined, now)).toEqual({})
    expect(createdWindow("last_century", now)).toEqual({})
    expect(createdWindow("custom", now)).toEqual({})
    expect(createdWindow("custom:2026-02-31:2026-03-01", now)).toEqual({})
  })

  it("cuts a hand-picked pair as inclusive local days", () => {
    expect(createdWindow("custom:2026-09-01:2026-09-15", now)).toEqual({
      created_from: new Date(2026, 8, 1).toISOString(),
      created_to: new Date(2026, 8, 16).toISOString(),
    })
  })

  it("swaps a reversed pair and leaves a range that ends today open", () => {
    expect(createdWindow("custom:2026-09-15:2026-09-01", now)).toEqual({
      created_from: new Date(2026, 8, 1).toISOString(),
      created_to: new Date(2026, 8, 16).toISOString(),
    })
    expect(createdWindow("custom:2026-09-28:2026-09-30", now)).toEqual({
      created_from: new Date(2026, 8, 28).toISOString(),
    })
  })

  it("names the inclusive days on the chip", () => {
    expect(CREATED.labelForValue?.("custom:2026-09-01:2026-09-15")).toBe(
      formatRangeLabel({
        start: new Date(2026, 8, 1),
        end: new Date(2026, 8, 16),
      }),
    )
    expect(CREATED.labelForValue?.("today")).toBeUndefined()
  })
})

describe("today's window across midnight", () => {
  const afternoon = new Date(2026, 8, 30, 15, 45, 12)

  it("treats an anchor from a previous local day as stale", () => {
    expect(todayAnchorStale(afternoon, afternoon)).toBe(false)
    expect(
      todayAnchorStale(afternoon, new Date(2026, 9, 1, 0, 0, 1)),
    ).toBe(true)
  })

  it("waits until the next local midnight", () => {
    expect(msUntilNextLocalMidnight(afternoon)).toBe(
      new Date(2026, 9, 1).getTime() - afternoon.getTime(),
    )
    expect(msUntilNextLocalMidnight(new Date(2026, 9, 1))).toBe(
      24 * 60 * 60 * 1000,
    )
  })

  it("round-trips the days the calendar commits", () => {
    const encoded = encodeCustomRange(
      new Date(2026, 8, 1),
      new Date(2026, 8, 15),
    )
    expect(encoded).toBe("custom:2026-09-01:2026-09-15")
    expect(parseCustomRange(encoded)).toEqual({
      start: new Date(2026, 8, 1),
      end: new Date(2026, 8, 15),
    })
  })
})

describe("exportFilters", () => {
  it("keeps what decides the list and its order, and drops the page", () => {
    expect(
      exportFilters({
        order_status: "order-completed",
        channel: "TELEGRAM,WHATSAPP",
        created_from: "2026-09-01T00:00:00.000Z",
        customer_name: "ada",
        sort_by: "total",
        sort_order: "asc",
        page: 4,
        limit: 15,
      }),
    ).toEqual({
      order_status: "order-completed",
      channel: "TELEGRAM,WHATSAPP",
      created_from: "2026-09-01T00:00:00.000Z",
      customer_name: "ada",
      sort_by: "total",
      sort_order: "asc",
    })
  })

  it("does not change the object the table holds", () => {
    const filters = { page: 2, limit: 15, channel: "TELEGRAM" }
    exportFilters(filters)
    expect(filters).toEqual({ page: 2, limit: 15, channel: "TELEGRAM" })
  })
})
