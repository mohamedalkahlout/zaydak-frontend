"use client"

import type * as React from "react"

import { Checkbox } from "@repo/ui/components/checkbox"
import { Skeleton } from "@repo/ui/components/skeleton"
import {
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table"
import { cn } from "@repo/ui/lib/utils"

import type { HeaderState } from "@/shared/lib/selection"

/**
 * The table chrome the admin console shares with the vendor dashboard.
 *
 * The vendor side gets this look from `shared/components/data-table` on top of
 * TanStack Table. Admin lists are server-paginated and hand-rolled — there is
 * no client row model to drive — so this is the same chrome without the engine:
 * one white card with a quiet ring, with the toolbar and the pagination bar
 * as rows *inside* it rather than floating above and below. Headers are
 * sentence-case on that white surface, matching the vendor dashboard.
 */

/** The card everything sits in. `overflow-hidden` is what clips the header to the radius. */
export function DataTableCard({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="data-table-card"
      className={cn(
        "overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10",
        className,
      )}
      {...props}
    />
  )
}

/** Filters and search — the bar above the header row, inside the card. */
export function DataTableToolbar({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="data-table-toolbar"
      className={cn(
        "flex flex-col gap-2 border-b border-border px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between",
        className,
      )}
      {...props}
    />
  )
}

/**
 * The bulk-action bar — a row *between* the toolbar and the header, inside the
 * card, shown only while something is selected.
 *
 * It sits inside the card for the same reason the toolbar does: a floating bar
 * over the list would cover the rows the count refers to. `count` is stated
 * rather than left to the ticked boxes, because the boxes for a bulk action can
 * be scrolled off screen by the time the button is clicked.
 */
export function DataTableSelectionBar({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="data-table-selection-bar"
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5 sm:flex-row",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * The header checkbox. Tri-state: `"some"` renders indeterminate, so "three of
 * the twelve eligible rows" cannot read as "all twelve".
 */
export function DataTableSelectHead({
  state,
  onToggle,
  disabled,
  label,
}: {
  state: HeaderState
  onToggle: () => void
  disabled?: boolean
  label: string
}) {
  return (
    <TableHead className="w-10 px-3">
      <Checkbox
        checked={state === "all"}
        indeterminate={state === "some"}
        disabled={disabled}
        onCheckedChange={onToggle}
        aria-label={label}
      />
    </TableHead>
  )
}

/**
 * One row's checkbox.
 *
 * The click is stopped here rather than on the row: several of these lists put
 * a menu or a link in the first data column, and a checkbox that also triggered
 * the row would make ticking a box mean two things.
 */
export function DataTableSelectCell({
  checked,
  onToggle,
  disabled,
  label,
}: {
  checked: boolean
  onToggle: () => void
  disabled?: boolean
  label: string
}) {
  return (
    <TableCell className="w-10 px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={onToggle}
        aria-label={label}
      />
    </TableCell>
  )
}

/** The range label and pagination — the bar below the last row, inside the card. */
export function DataTableFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="data-table-footer"
      className={cn(
        "flex flex-col gap-2 border-t border-border px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      {...props}
    />
  )
}

/** `<thead>` plus its single row — column heads are passed as children. */
export function DataTableHeader({
  className,
  children,
  ...props
}: React.ComponentProps<"tr">) {
  return (
    <TableHeader className="bg-transparent">
      <TableRow
        className={cn("border-border hover:bg-transparent", className)}
        {...props}
      >
        {children}
      </TableRow>
    </TableHeader>
  )
}

export function DataTableHead({
  className,
  ...props
}: React.ComponentProps<typeof TableHead>) {
  return (
    <TableHead
      // `text-start` spelled out rather than inherited: this console is
      // bilingual and the alignment is the one thing on this row that must
      // follow the script.
      className={cn(
        "h-8 px-3 text-start text-xs font-medium tracking-normal text-foreground/70",
        className,
      )}
      {...props}
    />
  )
}

export function DataTableRow({
  className,
  ...props
}: React.ComponentProps<typeof TableRow>) {
  return (
    <TableRow
      className={cn(
        "group/row border-border hover:bg-muted/50 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  )
}

export function DataTableCell({
  className,
  ...props
}: React.ComponentProps<typeof TableCell>) {
  return <TableCell className={cn("px-3 py-1.5", className)} {...props} />
}

/** The "nothing here" row. Fixed height so an empty list still looks like a table. */
export function DataTableEmpty({
  colSpan,
  children,
}: {
  colSpan: number
  children: React.ReactNode
}) {
  return (
    <TableRow className="border-border hover:bg-transparent">
      <TableCell
        colSpan={colSpan}
        className="h-24 px-3 text-center text-sm text-muted-foreground"
      >
        {children}
      </TableCell>
    </TableRow>
  )
}

/**
 * Placeholder rows for the first load.
 *
 * They keep the card at its settled height, so the page does not jump when the
 * real rows arrive.
 */
export function DataTableSkeletonRows({
  rows = 5,
  columns,
}: {
  rows?: number
  columns: number
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <DataTableRow key={i} className="hover:bg-transparent">
          {Array.from({ length: columns }, (_, j) => (
            <DataTableCell key={j}>
              <Skeleton className="h-4 w-24" />
            </DataTableCell>
          ))}
        </DataTableRow>
      ))}
    </>
  )
}
