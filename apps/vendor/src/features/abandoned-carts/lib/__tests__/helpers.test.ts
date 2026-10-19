import { describe, expect, it } from "vitest"
import {
  defaultReminderBody,
  defaultReminderTitle,
  insertMergeTag,
  substituteMergeTags,
} from "../message"
import {
  daysSince,
  formatStepMinutes,
  marketingStatusOf,
  parseCadence,
  reminderStatusOf,
  statusTimeline,
} from "../status"
import {
  abandonedCartSelectionScope,
  formatRangeLabel,
  parseAbandonedCartsQueryState,
  rangeForCustom,
  rangeForPreset,
  toAbandonedCartIdsVariables,
  toAbandonedCartStatusCountVariables,
  toAbandonedCartsFilterVariables,
  toAbandonedCartsSummaryVariables,
  toAbandonedCartsVariables,
  toIsoDate,
} from "../query-state"
import {
  abandonedCartFilterFields,
  toAbandonedCartFilterQuery,
  toAbandonedCartFilters,
  toAbandonedCartStatusCounts,
  upsertAbandonedCartFilter,
} from "../filters"
import { abandonedCartOpsCsvRows, toCsv } from "../export-csv"
import { enTranslator } from "@/shared/test/next-intl"

// The helpers only look keys up; resolve each to itself so assertions can name them.
const keyT = ((key: string) => key) as unknown as Parameters<
  typeof abandonedCartFilterFields
>[0]

describe("abandoned cart reminder helpers", () => {
  it("substitutes merge tags and leaves unknown ones", () => {
    expect(
      substituteMergeTags("Hi {name} {nope}", { name: "Ada" }),
    ).toBe("Hi Ada {nope}")
  })

  it("inserts a tag once", () => {
    expect(insertMergeTag("Hello", "name")).toBe("Hello {name}")
    expect(insertMergeTag("Hello {name}", "name")).toBe("Hello {name}")
  })

  it("seeds a recovery body with name, discount and date tags", () => {
    expect(defaultReminderBody("en", true)).toContain("{name}")
    expect(defaultReminderBody("en", true)).toContain("{discount_amount}")
    expect(defaultReminderBody("en", true)).toContain("{date}")
    expect(defaultReminderBody("en")).not.toContain("{discount_amount}")
    expect(defaultReminderTitle("ar")).toContain("السلة")
  })

  it("maps a reminder stamp to SENT", () => {
    expect(reminderStatusOf(null)).toBe("READY")
    expect(reminderStatusOf("2026-09-17T00:00:00.000Z")).toBe("SENT")
  })

  it("derives returned, failed and completed from persisted stamps", () => {
    expect(
      marketingStatusOf({
        status: "abandoned",
        last_reminder_at: "2026-09-10T00:00:00.000Z",
        last_activity_at: "2026-09-12T00:00:00.000Z",
      }),
    ).toBe("RETURNED")
    expect(
      marketingStatusOf({
        status: "abandoned",
        last_reminder_failed_at: "2026-09-12T00:00:00.000Z",
      }),
    ).toBe("FAILED")
    expect(
      marketingStatusOf({
        status: "converted",
        last_reminder_at: "2026-09-10T00:00:00.000Z",
      }),
    ).toBe("COMPLETED")
  })

  it("only lists timeline events that have a stamp", () => {
    const events = statusTimeline({
      id: "c1",
      status: "abandoned",
      reminder_status: "SENT",
      hidden: false,
      items: [],
      item_count: 0,
      currency: "SAR",
      channels: { email: true, sms: false, whatsapp: false },
      created_at: "2026-09-01T00:00:00.000Z",
      last_reminder_at: "2026-09-10T00:00:00.000Z",
    })
    expect(events.map((e) => e.key)).toEqual(["abandoned", "sent"])
  })

  it("counts whole days since last activity", () => {
    const now = new Date("2026-09-17T12:00:00.000Z")
    expect(daysSince("2026-09-14T12:00:00.000Z", now)).toBe(3)
  })

  it("treats a missing abandoned_checkout row as the default cadence, switched on", () => {
    expect(parseCadence(null)).toEqual({
      enabled: true,
      steps: [60, 1440, 4320],
    })
    expect(parseCadence({ enabled: false, steps: [120] })).toEqual({
      enabled: false,
      steps: [120],
    })
  })

  it("formats cadence steps in hours or days", () => {
    const t = enTranslator("abandonedCarts.step")
    expect(formatStepMinutes(60, t)).toBe("1h")
    expect(formatStepMinutes(1440, t)).toBe("1d")
    expect(formatStepMinutes(90, t)).toBe("90m")
  })

  it("defaults both queries to all time when the URL has no range", () => {
    const state = parseAbandonedCartsQueryState({})
    expect(state.range).toBe("all_time")
    expect(state.page).toBe(1)
    expect(toAbandonedCartsVariables(state)).not.toHaveProperty("start")
    expect(toAbandonedCartsVariables(state)).not.toHaveProperty("end")
    expect(toAbandonedCartsSummaryVariables(state)).toEqual({})
  })

  it("sends the same start/end on the list and the KPI query", () => {
    const now = new Date(2026, 8, 17, 15, 0, 0)
    const state = parseAbandonedCartsQueryState({ range: "last_7_days" })
    const window = rangeForPreset("last_7_days", now)
    const list = toAbandonedCartsVariables(state, now)
    const summary = toAbandonedCartsSummaryVariables(state, now)
    expect(state.range).toBe("last_7_days")
    expect(list.start).toBe(summary.start)
    expect(list.end).toBe(summary.end)
    expect(list.start).toBe(window.start.toISOString())
    expect(list.end).toBe(window.end.toISOString())
  })

  it("windows last 30 days and this month on both queries", () => {
    const now = new Date(2026, 8, 17, 15, 0, 0)
    for (const range of ["last_30_days", "this_month"] as const) {
      const state = parseAbandonedCartsQueryState({ range })
      const list = toAbandonedCartsVariables(state, now)
      const summary = toAbandonedCartsSummaryVariables(state, now)
      expect(list.start).toBe(summary.start)
      expect(list.end).toBe(summary.end)
      expect(list.start).toBe(rangeForPreset(range, now).start.toISOString())
    }
  })

  it("windows a custom calendar range on both queries", () => {
    const now = new Date(2026, 8, 17, 15, 0, 0)
    const state = parseAbandonedCartsQueryState({
      range: "custom",
      from: "2026-09-01",
      to: "2026-09-17",
    })
    const window = rangeForCustom("2026-09-01", "2026-09-17", now)
    const list = toAbandonedCartsVariables(state, now)
    const summary = toAbandonedCartsSummaryVariables(state, now)
    expect(list.start).toBe(summary.start)
    expect(list.end).toBe(summary.end)
    expect(list.start).toBe(window.start.toISOString())
    expect(list.end).toBe(window.end.toISOString())
  })

  it("omits dates on both queries when the merchant picks all time", () => {
    const state = parseAbandonedCartsQueryState({ range: "all_time" })
    expect(state.range).toBe("all_time")
    expect(toAbandonedCartsVariables(state)).not.toHaveProperty("start")
    expect(toAbandonedCartsVariables(state)).not.toHaveProperty("end")
    expect(toAbandonedCartsSummaryVariables(state)).toEqual({})
  })

  it("ignores a leftover tab query and keeps reminder status from the URL", () => {
    const state = parseAbandonedCartsQueryState({
      tab: "cadence",
      status: "SENT",
      hidden: "1",
    })
    expect(state).not.toHaveProperty("tab")
    expect(state.reminderStatus).toBe("SENT")
    expect(state.includeHidden).toBe(true)
  })

  it("reads view, value, created date, sort and page size from the URL", () => {
    const state = parseAbandonedCartsQueryState({
      view: "product",
      value: "lt_100",
      created: "last_7_days",
      sort: "TOTAL",
      dir: "ASC",
      limit: "25",
    })
    expect(state.view).toBe("product")
    expect(state.valueBand).toBe("lt_100")
    expect(state.created).toBe("last_7_days")
    expect(state.sortBy).toBe("TOTAL")
    expect(state.sortDir).toBe("ASC")
    expect(state.limit).toBe(25)
    const vars = toAbandonedCartsVariables(state)
    expect(vars.max_total_cents).toBe(10_000)
    expect(vars.sort_by).toBe("TOTAL")
    expect(vars.created_start).toBeTruthy()
  })

  it("anchors last-7-days at local midnight six days before today", () => {
    const now = new Date(2026, 8, 17, 15, 0, 0)
    const { start, end } = rangeForPreset("last_7_days", now)
    expect(end).toBe(now)
    expect(start.getFullYear()).toBe(2026)
    expect(start.getMonth()).toBe(8)
    expect(start.getDate()).toBe(11)
  })

  it("parses an inclusive custom calendar range from the URL", () => {
    const state = parseAbandonedCartsQueryState({
      range: "custom",
      from: "2026-09-01",
      to: "2026-09-17",
    })
    expect(state.range).toBe("custom")
    expect(state.from).toBe("2026-09-01")
    expect(state.to).toBe("2026-09-17")
  })

  it("turns inclusive custom days into a half-open window", () => {
    const now = new Date(2026, 8, 17, 15, 0, 0)
    const { start, end } = rangeForCustom("2026-09-01", "2026-09-17", now)
    expect(toIsoDate(start)).toBe("2026-09-01")
    expect(end).toBe(now)
  })

  it("labels a this-month window with latin digits", () => {
    const now = new Date(2026, 8, 17, 15, 0, 0)
    const label = formatRangeLabel(rangeForPreset("this_month", now), "en")
    expect(label).toContain("17")
    expect(label).toContain("2026")
  })
})

describe("abandoned cart filter chips", () => {
  it("writes a single-value is operator that the list query can send", () => {
    const filters = toAbandonedCartFilters({
      page: 1,
      limit: 15,
      range: "all_time",
      view: "customer",
      sortBy: "LAST_ACTIVITY",
      sortDir: "DESC",
      reminderStatus: "READY",
      valueBand: "gte_1000",
    })
    expect(filters.map((f) => f.operator)).toEqual(["is", "is"])
    expect(toAbandonedCartFilterQuery(filters)).toEqual({
      reminderStatus: "READY",
      includeHidden: undefined,
      customer: undefined,
      valueBand: "gte_1000",
      created: undefined,
    })
  })

  it("replaces an existing field instead of stacking a second chip", () => {
    const first = upsertAbandonedCartFilter([], "status", ["READY"])
    const next = upsertAbandonedCartFilter(first, "status", ["SENT"])
    expect(next).toHaveLength(1)
    expect(next[0]?.values).toEqual(["SENT"])
  })
})

describe("abandoned cart list filter, counted and selected", () => {
  const now = new Date(2026, 8, 17, 15, 0, 0)
  const state = parseAbandonedCartsQueryState({
    search: "ada",
    status: "SENT",
    hidden: "1",
    range: "last_7_days",
    value: "100_500",
    created: "this_month",
    sort: "TOTAL",
    dir: "ASC",
    page: "3",
    limit: "25",
  })

  it("counts with the list's whole filter except the status", () => {
    const filter = toAbandonedCartsFilterVariables(state, now)
    const counts = toAbandonedCartStatusCountVariables(state, now)

    // Every other chip, the search and the date range reach the counts...
    expect(counts).toEqual({
      search: "ada",
      include_hidden: true,
      start: filter.start,
      end: filter.end,
      created_start: filter.created_start,
      created_end: filter.created_end,
      min_total_cents: 10_000,
      max_total_cents: 50_000,
    })
    expect(counts.start).toBeTruthy()
    expect(counts.created_start).toBeTruthy()
    // ...and the status that is picked does not: a count is what picking
    // that status would show, so it cannot be narrowed by another one.
    expect(counts).not.toHaveProperty("reminder_status")
    expect(counts).not.toHaveProperty("page")
    expect(counts).not.toHaveProperty("sort_by")
    expect(filter).toEqual({ ...counts, reminder_status: "SENT" })
  })

  it("selects with the list's filter and order, and no paging", () => {
    const list = toAbandonedCartsVariables(state, now)
    const ids = toAbandonedCartIdsVariables(state, now)

    expect(ids).toEqual({
      ...toAbandonedCartsFilterVariables(state, now),
      sort_by: "TOTAL",
      sort_dir: "ASC",
    })
    expect(list).toEqual({ ...ids, page: 3, limit: 25 })
  })

  it("holds a rolling window still while the anchor is the same instant", () => {
    // The table keeps `now` in state. Left to the default, each call stamps
    // its own instant and Apollo reads the moved `end` as new variables.
    expect(toAbandonedCartsVariables(state, now)).toEqual(
      toAbandonedCartsVariables(state, now),
    )
    expect(toAbandonedCartsVariables(state, now).end).toBe(now.toISOString())
    expect(toAbandonedCartsVariables(state, now).created_end).toBe(
      now.toISOString(),
    )
  })

  it("scopes a selection to the filter and the view, not to the page or the sort", () => {
    const scope = abandonedCartSelectionScope(state)
    const same = (patch: Record<string, string | undefined>) =>
      abandonedCartSelectionScope(
        parseAbandonedCartsQueryState({
          search: "ada",
          status: "SENT",
          hidden: "1",
          range: "last_7_days",
          value: "100_500",
          created: "this_month",
          sort: "TOTAL",
          dir: "ASC",
          page: "3",
          limit: "25",
          ...patch,
        }),
      ) === scope

    // Paging and sorting move rows around; they do not change which rows.
    expect(same({ page: "1" })).toBe(true)
    expect(same({ limit: "50" })).toBe(true)
    expect(same({ sort: "CREATED_AT", dir: "DESC" })).toBe(true)
    // Anything that changes which carts the list holds ends the selection.
    expect(same({ search: "grace" })).toBe(false)
    expect(same({ status: "READY" })).toBe(false)
    expect(same({ hidden: undefined })).toBe(false)
    expect(same({ range: "last_30_days" })).toBe(false)
    expect(same({ range: "custom", from: "2026-09-01", to: "2026-09-10" })).toBe(
      false,
    )
    expect(same({ value: "lt_100" })).toBe(false)
    expect(same({ created: "last_7_days" })).toBe(false)
    expect(same({ view: "product" })).toBe(false)
  })
})

describe("abandoned cart status counts", () => {
  it("reads the counts into a lookup and ignores a status the client does not know", () => {
    expect(
      toAbandonedCartStatusCounts([
        { status: "READY", count: 3 },
        { status: "COMPLETED", count: 0 },
        { status: "ARCHIVED" as never, count: 9 },
      ]),
    ).toEqual({ READY: 3, COMPLETED: 0 })
  })

  it("stays undefined until the counts answer, so no zeros are drawn", () => {
    expect(toAbandonedCartStatusCounts(undefined)).toBeUndefined()
    expect(toAbandonedCartStatusCounts(null)).toBeUndefined()
  })

  it("puts each count on its status option, with no footnote", () => {
    const fields = abandonedCartFilterFields(keyT, "is", undefined, {
      READY: 3,
      SENT: 0,
    })
    const status = fields.find((field) => field.id === "status")!
    const hints = Object.fromEntries(
      (status.options ?? []).map((option) => [option.value, option.hint]),
    )
    // Zero is a count; a status missing from the reply draws nothing.
    expect(hints).toEqual({
      READY: "3",
      SENT: "0",
      RETURNED: undefined,
      FAILED: undefined,
      COMPLETED: undefined,
    })
    // The counts follow every other filter now, so there is nothing for a
    // note to explain — on this field or any other.
    expect(fields.map((field) => field.hintNote)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ])
  })

  it("draws no hints and no note without counts", () => {
    const status = abandonedCartFilterFields(keyT, "is").find(
      (field) => field.id === "status",
    )!
    expect(status.options?.every((option) => option.hint == null)).toBe(true)
    expect(status.hintNote).toBeUndefined()
  })
})

describe("abandoned cart activity-log export", () => {
  it("writes one row per entry with every cart a bulk op touched", () => {
    const rows = abandonedCartOpsCsvRows([
      {
        id: "log-1",
        op: "SEND",
        cart_id: "cart-1",
        actor_name: "Vera, owner",
        actor_email: "vera@acme.test",
        channels: ["EMAIL", "WHATSAPP"],
        failed_channels: ["SMS"],
        coupon_code: "CARTAB12CD",
        created_at: "2026-09-20T10:00:00.000Z",
      },
      {
        id: "log-2",
        op: "BULK_HIDE",
        cart_id: "cart-1",
        cart_ids: ["cart-1", "cart-2"],
        created_at: "2026-09-19T10:00:00.000Z",
      },
      {
        id: "log-3",
        op: "BULK_UNHIDE",
        created_at: "2026-09-18T10:00:00.000Z",
      },
    ])

    expect(rows[0]).toEqual([
      "created_at",
      "op",
      "cart_ids",
      "cart_count",
      "actor_name",
      "actor_email",
      "channels",
      "failed_channels",
      "coupon_code",
    ])
    expect(rows[1]).toEqual([
      "2026-09-20T10:00:00.000Z",
      "SEND",
      "cart-1",
      "1",
      "Vera, owner",
      "vera@acme.test",
      "EMAIL; WHATSAPP",
      "SMS",
      "CARTAB12CD",
    ])
    expect(rows[2]?.slice(0, 4)).toEqual([
      "2026-09-19T10:00:00.000Z",
      "BULK_HIDE",
      "cart-1; cart-2",
      "2",
    ])
    // A bulk op stamped with the shop id still exports, with no carts named.
    expect(rows[3]).toEqual([
      "2026-09-18T10:00:00.000Z",
      "BULK_UNHIDE",
      "",
      "0",
      "",
      "",
      "",
      "",
      "",
    ])
    // A comma in an actor name is quoted rather than splitting the column.
    expect(toCsv(rows).split("\n")[1]).toContain('"Vera, owner"')
  })
})
