import { beforeAll, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { useState } from "react"
import { getCoreRowModel, useReactTable } from "@tanstack/react-table"

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

vi.mock("@apollo/client/react", () => ({
  useApolloClient: () => ({
    query: vi.fn().mockResolvedValue({ data: { contacts: { data: [] } } }),
  }),
}))

const { AbandonedCartsToolbar } = await import("../abandoned-carts-toolbar")
type Filter = import("@/shared/components/filter-bar").Filter
type StatusCounts =
  import("@/features/abandoned-carts/lib/filters").AbandonedCartStatusCounts

beforeAll(() => {
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

function Harness({
  onFiltersChange,
  onExportOps,
  statusCounts,
}: {
  onFiltersChange?: (filters: Filter[]) => void
  onExportOps?: () => void
  statusCounts?: StatusCounts
}) {
  const [filters, setFilters] = useState<Filter[]>([])
  const [search, setSearch] = useState("")
  const table = useReactTable({
    data: [{ id: "1" }],
    columns: [{ id: "customer", header: "Customer" }],
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <AbandonedCartsToolbar
      search={search}
      filters={filters}
      onSearchChange={setSearch}
      onFiltersChange={(next) => {
        setFilters(next)
        onFiltersChange?.(next)
      }}
      onReset={() => {
        setFilters([])
        setSearch("")
      }}
      view="customer"
      onViewChange={() => {}}
      table={table}
      sortBy="LAST_ACTIVITY"
      sortDir="DESC"
      onSortChange={() => {}}
      columnLabels={{ customer: "Customer" }}
      onExport={() => {}}
      onExportOps={onExportOps}
      resultCount={12}
      statusCounts={statusCounts}
    />
  )
}

describe("AbandonedCartsToolbar", () => {
  it("keeps the add-filter funnel in the chrome until a chip exists", () => {
    render(<Harness />)
    expect(screen.getByRole("tab", { name: "Customer" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Product" })).toBeTruthy()
    expect(screen.getByLabelText("Add Filter…")).toBeTruthy()
    expect(screen.queryByText("Add filter")).toBeNull()
    expect(screen.queryByRole("toolbar", { name: "Filters" })).toBeNull()
  })

  it("applies a status value from the funnel as a Status is chip", () => {
    const onFiltersChange = vi.fn()
    render(<Harness onFiltersChange={onFiltersChange} />)

    fireEvent.click(screen.getByLabelText("Add Filter…"))
    fireEvent.click(screen.getByText("Status"))
    fireEvent.click(screen.getByText("Ready to remind"))

    expect(onFiltersChange).toHaveBeenCalled()
    const next = onFiltersChange.mock.calls.at(-1)?.[0] as Filter[]
    expect(next[0]).toMatchObject({
      field: "status",
      operator: "is",
      values: ["READY"],
    })
    expect(screen.getByRole("toolbar", { name: "Filters" })).toBeTruthy()
    expect(screen.getByText("is")).toBeTruthy()
    expect(screen.getByText("Clear")).toBeTruthy()
  })

  it("counts each status in the funnel, with no footnote to qualify them", () => {
    render(<Harness statusCounts={{ READY: 7, SENT: 2, COMPLETED: 0 }} />)

    fireEvent.click(screen.getByLabelText("Add Filter…"))
    fireEvent.click(screen.getByText("Status"))

    const hintOf = (label: string) =>
      screen
        .getByText(label)
        .closest("[role='menuitem']")
        ?.querySelector("[data-slot='filter-option-hint']")?.textContent
    expect(hintOf("Ready to remind")).toBe("7")
    expect(hintOf("Reminder sent")).toBe("2")
    expect(hintOf("Completed order")).toBe("0")
    // No reply for this status yet: nothing drawn, not a made-up zero.
    expect(hintOf("Failed to send")).toBeUndefined()
    // The counts are the list's own filter with each status picked, so the
    // note that used to say "other filters are not applied" is gone.
    expect(document.querySelector("[data-slot='filter-option-note']")).toBeNull()
  })

  it("draws no counts and no note before the counts answer", () => {
    render(<Harness />)

    fireEvent.click(screen.getByLabelText("Add Filter…"))
    fireEvent.click(screen.getByText("Status"))

    expect(screen.getByText("Ready to remind")).toBeTruthy()
    expect(
      document.querySelector("[data-slot='filter-option-hint']"),
    ).toBeNull()
    expect(document.querySelector("[data-slot='filter-option-note']")).toBeNull()
  })

  it("offers the activity-log export beside the list export", () => {
    const onExportOps = vi.fn()
    render(<Harness onExportOps={onExportOps} />)

    fireEvent.click(screen.getByLabelText("Display"))
    expect(screen.getByText("Export")).toBeTruthy()
    fireEvent.click(screen.getByText("Export activity log"))

    expect(onExportOps).toHaveBeenCalledTimes(1)
  })
})
