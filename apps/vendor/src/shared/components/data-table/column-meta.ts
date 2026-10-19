import type { RowData } from "@tanstack/react-table"

/**
 * Per-column classes the table chrome applies to the header and body cells.
 *
 * This exists for one thing the column definition cannot otherwise say: a
 * column that has to stay put while the table scrolls sideways. A pinned cell
 * needs `sticky` plus its own background — a transparent one shows the rows
 * sliding under it — and both are properties of that column, not of the table.
 */
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    headClassName?: string
    cellClassName?: string
  }
}

export {}
