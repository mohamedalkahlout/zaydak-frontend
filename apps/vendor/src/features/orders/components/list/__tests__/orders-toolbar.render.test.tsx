import { beforeAll, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { useMemo, useState } from "react"
import {
  getCoreRowModel,
  useReactTable,
  type ColumnFiltersState,
} from "@tanstack/react-table"

// Every string resolves against the real `messages/en`. A stub that echoed
// its key would let a field, a status or a bar label whose message was never
// written pass here and then render as `orders.filter.payment_status` on the
// merchant's screen — which is exactly the bug this file exists to catch.
const realMessages = vi.hoisted(
  async () =>
    (await import("@/shared/messages/en")).default as Record<string, unknown>,
)

vi.mock("next-intl", async () => {
  const all = await realMessages
  return {
    useLocale: () => "en",
    useTranslations:
      (namespace?: string) =>
      (key: string, params?: Record<string, string | number>) => {
        const path = namespace ? `${namespace}.${key}` : key
        const value = path
          .split(".")
          .reduce<unknown>(
            (node, part) =>
              node && typeof node === "object"
                ? (node as Record<string, unknown>)[part]
                : undefined,
            all,
          )
        if (typeof value !== "string") return key
        return params
          ? value.replace(/\{(\w+)\}/g, (whole, name) =>
              name in params ? String(params[name]) : whole,
            )
          : value
      },
  }
})

const { OrdersToolbar } = await import("../orders-toolbar")
const { orderColumns } = await import("../orders-columns")
const { toQuery } = await import("@/features/orders/lib/list/filters")
type Filter = import("@/shared/components/filter-bar").Filter

beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
})

/**
 * The toolbar cannot be rendered on its own — it reads the search box out of a
 * TanStack table and hands Reset back to it — so the test stands up the same
 * wiring `orders-table` has, which is also what makes it a test of that wiring
 * rather than of the bar.
 */
function Harness({ onQuery }: { onQuery: (q: ColumnFiltersState) => void }) {
  const [filters, setFilters] = useState<Filter[]>([])
  const [globalFilter, setGlobalFilter] = useState("")
  const columnFilters = useMemo(() => toQuery(filters), [filters])

  onQuery(columnFilters)

  const table = useReactTable({
    data: [],
    columns: orderColumns,
    state: { columnFilters, globalFilter },
    manualFiltering: true,
    manualPagination: true,
    manualSorting: true,
    // No `onColumnFiltersChange`, as in `orders-table`: the chips are the
    // state and `columnFilters` is only ever derived from them.
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
  })

  // Mirrors `orders-table`'s own handleReset: the chips and the search box go
  // together, which is the whole reason the screen takes the bar's Clear over.
  const handleReset = () => {
    setFilters([])
    setGlobalFilter("")
  }

  return (
    <OrdersToolbar
      table={table}
      filters={filters}
      onFiltersChange={setFilters}
      onReset={handleReset}
    />
  )
}

describe("OrdersToolbar", () => {
  it("keeps the free-text search, which the bar does not do", () => {
    render(<Harness onQuery={() => {}} />)
    const input = screen.getByPlaceholderText("Search by tracking or customer")
    fireEvent.change(input, { target: { value: "TRK-1" } })
    expect(screen.getByDisplayValue("TRK-1")).toBeDefined()
  })

  it("turns a chosen status into the column filter the API mapping reads", async () => {
    let query: ColumnFiltersState = []
    render(
      <Harness
        onQuery={(next) => {
          query = next
        }}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /Add Filter/i }))
    fireEvent.click(await screen.findByText("Status"))
    fireEvent.click(await screen.findByText("Out for delivery"))

    await waitFor(() =>
      expect(query).toEqual([
        { id: "order_status", value: ["order-out-for-delivery"] },
      ]),
    )
  })

  it("turns a chosen channel into the comma-joined channel the API derives", async () => {
    let query: ColumnFiltersState = []
    render(
      <Harness
        onQuery={(next) => {
          query = next
        }}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /Add Filter/i }))
    fireEvent.click(await screen.findByText("Channel"))
    // The channel reads as the analytics page names it, not as its enum value.
    fireEvent.click(await screen.findByText("Manual orders"))

    await waitFor(() =>
      expect(query).toEqual([{ id: "channel", value: ["DRAFT_ORDER"] }]),
    )
    expect(screen.queryByText("DRAFT_ORDER")).toBeNull()
  })

  it("turns a chosen date window into the created chip the table reads", async () => {
    let query: ColumnFiltersState = []
    render(
      <Harness
        onQuery={(next) => {
          query = next
        }}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /Add Filter/i }))
    fireEvent.click(await screen.findByText("Date"))
    // The windows are the analytics page's own, under its own names.
    fireEvent.click(await screen.findByText("Last 30 days"))

    await waitFor(() =>
      expect(query).toEqual([{ id: "created", value: ["last_30_days"] }]),
    )
  })

  it("clears the chips and the search together, which the bar's own Clear does not", async () => {
    let query: ColumnFiltersState = []
    render(
      <Harness
        onQuery={(next) => {
          query = next
        }}
      />,
    )

    fireEvent.change(
      screen.getByPlaceholderText("Search by tracking or customer"),
      { target: { value: "ada" } },
    )
    fireEvent.click(screen.getByRole("button", { name: /Add Filter/i }))
    fireEvent.click(await screen.findByText("Payment"))
    fireEvent.click(await screen.findByText("Paid"))
    await waitFor(() => expect(query).toHaveLength(1))

    fireEvent.click(screen.getByText("Clear"))

    await waitFor(() => expect(query).toEqual([]))
    expect(screen.queryByDisplayValue("ada")).toBeNull()
  })
})
