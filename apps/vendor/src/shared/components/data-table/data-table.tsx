"use client"

import * as React from "react"
import { type Table as TanStackTable, flexRender } from "@tanstack/react-table"
import { useTranslations } from "next-intl"

import { cn } from "@/shared/lib/utils"

import "./column-meta"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table"

/**
 * The last-resort empty row, for a list that passes no `emptyState` of its own.
 * Its own component so that only an empty table reads the message catalogue.
 */
function NoResults() {
  const t = useTranslations("dataTable")
  return <>{t("noResults")}</>
}

interface DataTableProps<TData> {
  table: TanStackTable<TData>
  /** Rendered in place of the rows when `table.getRowModel().rows` is empty. */
  emptyState?: React.ReactNode
  /**
   * Compact row padding. On `plain` lists the default is compact (Linear);
   * pass `false` for Comfortable (`py-3`). A missing value follows `variant`.
   */
  dense?: boolean
  /**
   * `plain` is Linear density on the white card: hairline rows, stronger
   * sentence-case headers. That is the default every vendor list inherits.
   * `default` is the older uppercase muted sheet — keep it only if a screen
   * still wants that look.
   */
  variant?: "default" | "plain"
}

/**
 * Marks the horizontal scroll position on the `<table>` as `data-scroll-end`,
 * so a pinned column can drop its leading edge once there is nothing left
 * underneath it -- scrolled to the far end, or not scrollable at all.
 *
 * It writes the attribute straight to the DOM instead of holding it in state:
 * this fires on every scroll frame, and re-rendering every row of the table to
 * move one box-shadow would be the expensive way to do it. Nothing renders
 * `data-scroll-end` in JSX, so React has no opinion about the attribute and
 * will not overwrite it.
 */
function useScrollEndAttr(ref: React.RefObject<HTMLTableElement | null>) {
  React.useEffect(() => {
    const el = ref.current
    const container = el?.parentElement
    if (!el || !container) return

    const measure = () => {
      const max = container.scrollWidth - container.clientWidth
      // `scrollLeft` counts down from 0 in RTL, so compare on its magnitude.
      const atEnd = max <= 1 || Math.abs(container.scrollLeft) >= max - 1
      el.dataset.scrollEnd = atEnd ? "true" : "false"
    }

    measure()
    container.addEventListener("scroll", measure, { passive: true })
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    observer.observe(el)

    return () => {
      container.removeEventListener("scroll", measure)
      observer.disconnect()
    }
  }, [ref])
}

export function DataTable<TData>({
  table,
  emptyState,
  dense,
  variant = "plain",
}: DataTableProps<TData>) {
  const rows = table.getRowModel().rows
  const tableRef = React.useRef<HTMLTableElement>(null)
  useScrollEndAttr(tableRef)
  const plain = variant === "plain"
  // `plain` is Linear density. The products Compact-rows switch has to be able
  // to opt out of that (`dense={false}` → Comfortable) without every other
  // list growing overnight — so an omitted `dense` still follows `variant`.
  const compact = dense ?? plain

  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>
  }

  return (
    <Table ref={tableRef} className="group/table">
      <TableHeader className={plain ? "bg-transparent" : "bg-muted"}>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow
            key={headerGroup.id}
            className="border-border hover:bg-transparent"
          >
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                className={cn(
                  plain
                    ? "h-8 px-3 text-xs font-medium tracking-normal text-foreground/70"
                    : "h-10 px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground",
                  header.column.columnDef.meta?.headClassName,
                )}
                style={
                  header.column.columnDef.size
                    ? { width: header.column.columnDef.size }
                    : undefined
                }
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={table.getAllLeafColumns().length}
              className="h-24 text-center text-sm text-muted-foreground"
            >
              <NoResults />
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() ? "selected" : undefined}
              className={cn(
                "group/row border-border data-[state=selected]:bg-muted",
                plain
                  ? "border-border hover:bg-muted/50"
                  : "hover:bg-muted/60",
              )}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={cn(
                    plain ? "px-3" : "px-4",
                    compact ? "py-1.5" : "py-3",
                    cell.column.columnDef.meta?.cellClassName,
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
