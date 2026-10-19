import { describe, it, expect, vi } from "vitest"
import { useState } from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import {
  type ColumnDef,
  type ColumnOrderState,
  type VisibilityState,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"

// The view panel is the only way to reach a hidden column or change the order,
// so what it has to get right is narrow and worth pinning: it must never offer
// the two chrome columns (`select`, `actions`) as movable, it must keep them
// pinned to the ends of whatever order it writes back, and it must be usable
// without a mouse — a drag-only list cannot be reordered from a keyboard.

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [vi.fn(), { loading: false }],
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

import { ProductsViewOptions } from "../list/products-view-options"
import { productColumns } from "../list/products-columns"
import {
  PRODUCT_COLUMN_ORDER,
  PRODUCT_COLUMN_VISIBILITY,
  PRODUCT_REORDERABLE_COLUMNS,
} from "@/features/products/lib/list/constants"
import type { Product } from "@/features/products/types"
import en from "@/shared/messages/en"

/** A column's English header, as the panel and the table both read it. */
const COLUMN_LABELS: Record<string, string | undefined> =
  en.products.list.column

const columns = PRODUCT_REORDERABLE_COLUMNS.map<ColumnDef<Product>>((id) => ({
  id,
  accessorFn: () => "",
  header: id,
  cell: () => null,
})).concat(
  { id: "select", header: "", cell: () => null, enableHiding: false },
  { id: "actions", header: "", cell: () => null, enableHiding: false },
)

let order: ColumnOrderState = []

function Harness() {
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([
    ...PRODUCT_COLUMN_ORDER,
  ])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    PRODUCT_COLUMN_VISIBILITY,
  )
  order = columnOrder

  const table = useReactTable({
    data: [],
    columns,
    state: { columnOrder, columnVisibility },
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <ProductsViewOptions
      table={table}
      sortBy="NEWEST"
      onSortByChange={vi.fn()}
      dense={false}
      onDenseChange={vi.fn()}
    />
  )
}

function openPanel() {
  render(<Harness />)
  fireEvent.click(screen.getByRole("button", { name: "Sort and columns" }))
}

describe("ProductsViewOptions", () => {
  it("offers every data column and neither chrome column", () => {
    openPanel()

    for (const id of PRODUCT_REORDERABLE_COLUMNS) {
      expect(
        screen.getByRole("button", { name: `Move ${COLUMN_LABELS[id]}` }),
      ).toBeTruthy()
    }
    expect(screen.queryByRole("button", { name: /Move select/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /Move actions/ })).toBeNull()
  })

  it("shows a hidden column as hidden, and reveals it on click", () => {
    openPanel()

    // Brand ships hidden — the eye offers to show it, not to hide it.
    const show = screen.getByRole("button", { name: "Show Brand" })
    expect(show.getAttribute("aria-pressed")).toBe("false")

    fireEvent.click(show)
    expect(
      screen.getByRole("button", { name: "Hide Brand" }).getAttribute("aria-pressed"),
    ).toBe("true")
  })

  it("moves a column with the arrow keys and keeps the chrome columns pinned", () => {
    openPanel()

    // Status sits second among the data columns; one press up puts it first.
    fireEvent.keyDown(screen.getByRole("button", { name: "Move Status" }), {
      key: "ArrowUp",
    })

    expect(order[0]).toBe("select")
    expect(order[1]).toBe("status")
    expect(order[2]).toBe("name")
    expect(order[order.length - 1]).toBe("actions")
  })

  it("will not move a column past the ends of the list", () => {
    openPanel()

    fireEvent.keyDown(screen.getByRole("button", { name: "Move Product" }), {
      key: "ArrowUp",
    })

    expect(order).toEqual([...PRODUCT_COLUMN_ORDER])
  })

  it("names every column the table actually renders", () => {
    // A column missing from PRODUCT_COLUMN_ORDER is appended by TanStack at the
    // far right, past `actions`; one with no `products.list.column.<id>`
    // message shows its raw id in the panel. Both are silent, so they are
    // asserted here.
    // TanStack derives an `accessorKey` column's id from the key, so read it
    // the same way rather than only off `id`.
    const ids = productColumns.map(
      (c) => c.id ?? ("accessorKey" in c ? String(c.accessorKey) : ""),
    )
    expect(new Set(ids)).toEqual(new Set(PRODUCT_COLUMN_ORDER))
    for (const id of PRODUCT_REORDERABLE_COLUMNS) {
      expect(COLUMN_LABELS[id]).toBeTruthy()
    }
  })
})
