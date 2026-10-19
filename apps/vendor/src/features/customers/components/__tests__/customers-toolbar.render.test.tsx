import { beforeAll, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { useState } from "react"
import {
  getCoreRowModel,
  useReactTable,
  type ColumnFiltersState,
} from "@tanstack/react-table"

// Every string resolves against the real `messages/en`. A stub that echoed
// its key would let a field or an option whose message was never written pass
// here and then render as `customers.filter.status` on the merchant's screen.
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

const { CustomersToolbar } = await import("../customers-toolbar")
const { toColumnFilters } = await import("@/features/customers/lib/filters")
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
 * yet — so the add-then-pick flow could never complete.
 *
 * It also pins the Reset the screen owns. The bar can only see chips, so its
 * own Clear can only drop chips; this screen takes the button over so one
 * control empties the search box with them.
 */
function Harness({ onQuery }: { onQuery: (q: ColumnFiltersState) => void }) {
  const [filters, setFilters] = useState<Filter[]>([])
  const [globalFilter, setGlobalFilter] = useState("")

  onQuery(toColumnFilters(filters))

  const table = useReactTable({
    data: [],
    columns: [],
    state: { globalFilter },
    manualFiltering: true,
    manualPagination: true,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <CustomersToolbar
      table={table}
      filters={filters}
      onFiltersChange={setFilters}
      onReset={() => {
        setFilters([])
        setGlobalFilter("")
      }}
    />
  )
}

describe("CustomersToolbar", () => {
  it("keeps the free-text search, which the bar does not do", () => {
    render(<Harness onQuery={() => {}} />)
    const input = screen.getByPlaceholderText("Search name, email, phone, location")
    fireEvent.change(input, { target: { value: "ada" } })
    expect(screen.getByDisplayValue("ada")).toBeDefined()
  })

  it("survives the add-then-pick flow and derives the query from the chip", async () => {
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
    fireEvent.click(await screen.findByText("Active"))

    await waitFor(() => expect(query).toHaveLength(1))
    expect(query[0]?.value).toEqual(["active"])
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

    fireEvent.change(screen.getByPlaceholderText("Search name, email, phone, location"), {
      target: { value: "ada" },
    })
    fireEvent.click(screen.getByRole("button", { name: /Add Filter/i }))
    fireEvent.click(await screen.findByText("Status"))
    fireEvent.click(await screen.findByText("Active"))
    await waitFor(() => expect(query).toHaveLength(1))

    fireEvent.click(screen.getByText("Clear"))

    await waitFor(() => expect(query).toEqual([]))
    expect(screen.queryByDisplayValue("ada")).toBeNull()
  })
})
