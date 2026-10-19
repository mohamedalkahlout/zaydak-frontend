import { beforeAll, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { useState } from "react"
import { getCoreRowModel, useReactTable } from "@tanstack/react-table"

// Every string resolves against the real `messages/en`. A stub that echoed
// its key would let a field or a status whose message was never written pass
// here and then render as `coupons.filter.statuses` on the merchant's screen.
const realMessages = vi.hoisted(
  async () =>
    (await import("@/shared/messages/en")).default as Record<
      string,
      unknown
    >,
)

vi.mock("next-intl", async () => {
  const all = await realMessages
  return {
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

const { CouponsToolbar } = await import("../coupons-toolbar")
const { toCouponFilterQuery } = await import(
  "@/features/coupons/lib/list/filters"
)
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
 * The chips are the state and the query is derived from them. The trap this
 * pins is the reverse: a `value` derived from the screen's existing filter
 * state drops a chip the instant it is added — a new chip carries no values
 * yet — so the add-then-pick flow can never complete.
 */
function Harness({
  onQuery,
}: {
  onQuery: (q: ReturnType<typeof toCouponFilterQuery>) => void
}) {
  const [filters, setFilters] = useState<Filter[]>([])
  const [search, setSearch] = useState("")

  onQuery(toCouponFilterQuery(filters))

  const table = useReactTable({
    data: [],
    columns: [],
    manualFiltering: true,
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <CouponsToolbar
      table={table}
      search={search}
      filters={filters}
      onSearchChange={setSearch}
      onFiltersChange={setFilters}
      onReset={() => {
        setFilters([])
        setSearch("")
      }}
    />
  )
}

describe("CouponsToolbar", () => {
  it("keeps the free-text code search, which the bar does not do", () => {
    render(<Harness onQuery={() => {}} />)
    const input = screen.getByPlaceholderText("Search by code")
    fireEvent.change(input, { target: { value: "SALE20" } })
    expect(screen.getByDisplayValue("SALE20")).toBeDefined()
  })

  it("survives the add-then-pick flow and derives the query from the chip", async () => {
    let query: ReturnType<typeof toCouponFilterQuery> = {}
    render(
      <Harness
        onQuery={(next) => {
          query = next
        }}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Add Filter…" }))
    fireEvent.click(await screen.findByText("Status"))
    fireEvent.click(await screen.findByText("Active"))

    await waitFor(() => expect(query.statuses).toEqual(["active"]))
  })

  it("clears the chips and the search together, which the bar's own Clear does not", async () => {
    let query: ReturnType<typeof toCouponFilterQuery> = {}
    render(
      <Harness
        onQuery={(next) => {
          query = next
        }}
      />,
    )

    fireEvent.change(screen.getByPlaceholderText("Search by code"), {
      target: { value: "SALE20" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add Filter…" }))
    fireEvent.click(await screen.findByText("Status"))
    fireEvent.click(await screen.findByText("Active"))
    await waitFor(() => expect(query.statuses).toEqual(["active"]))

    fireEvent.click(screen.getByText("Clear"))

    await waitFor(() => expect(query.statuses).toBeUndefined())
    expect(screen.queryByDisplayValue("SALE20")).toBeNull()
  })
})
