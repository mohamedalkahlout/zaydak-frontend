"use client"

import type * as React from "react"
import { useTranslations } from "next-intl"

import { cn } from "@/shared/lib/utils"

/**
 * The white list card every vendor table sits on.
 *
 * `--background` is the gray dashboard; `--card` is white. A quiet ring is
 * what makes the block read as a table without the old border+shadow sheet.
 * `overflow-hidden` clips the header/toolbar to the radius.
 */
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

/**
 * Linear list chrome *inside* the card.
 *
 * Row 1: optional leading (view tabs) on the start edge, then search + funnel
 * + display packed on the end. Row 2 exists only while there are chips, with
 * Clear on the end. Do not put FilterBar on row 1 — that is the fat spreadsheet
 * toolbar this layout replaced.
 */
export function DataTableToolbar({
  leading,
  search,
  addFilter,
  trailing,
  filters,
  onClear,
  isFiltered,
  className,
}: {
  leading?: React.ReactNode
  search?: React.ReactNode
  addFilter?: React.ReactNode
  trailing?: React.ReactNode
  /** Chip row. Pass nothing (or null) while the bar is empty. */
  filters?: React.ReactNode
  onClear?: () => void
  /** Show Clear on the chip row — chips and/or search. */
  isFiltered?: boolean
  className?: string
}) {
  const t = useTranslations("filterBar")
  const hasChrome = Boolean(leading || search || addFilter || trailing)

  return (
    <div
      data-slot="data-table-toolbar"
      className={cn("flex flex-col gap-2 border-b border-border px-3 py-2.5", className)}
    >
      {hasChrome ? (
        <div className="flex flex-wrap items-center gap-2">
          {leading}
          <div className="ms-auto flex min-w-0 items-center gap-1">
            {search}
            {addFilter}
            {trailing}
          </div>
        </div>
      ) : null}
      {filters ? (
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">{filters}</div>
          {isFiltered && onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="ms-auto rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {t("clear")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/**
 * The bulk-action bar — a row *between* the toolbar and the header, shown
 * only while something is selected.
 */
export function DataTableSelectionBar({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="data-table-selection-bar"
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5 text-sm",
        className,
      )}
      {...props}
    />
  )
}

/** The range label and pagination — a row *inside* the card, below the last row. */
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

/** Compact search field on the white card — muted fill, no heavy box. */
export const dataTableSearchClassName =
  "h-7 border-transparent bg-muted/60 shadow-none hover:bg-muted focus-visible:border-input focus-visible:bg-card"

export const dataTableSearchIconClassName =
  "pointer-events-none absolute start-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
