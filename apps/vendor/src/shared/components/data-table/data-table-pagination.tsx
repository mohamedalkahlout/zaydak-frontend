"use client"

import type { Table } from "@tanstack/react-table"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@repo/ui/components/pagination"

export function DataTablePagination<TData>({
  table,
}: {
  table: Table<TData>
}) {
  const totalPages = table.getPageCount()
  const currentPage = table.getState().pagination.pageIndex + 1 // 1-indexed for UI

  const pages = buildPageNumbers(currentPage, totalPages)
  const prevDisabled = !table.getCanPreviousPage()
  const nextDisabled = !table.getCanNextPage()

  const goto = (target: number) => (e: React.MouseEvent) => {
    e.preventDefault()
    if (target < 1 || target > totalPages || target === currentPage) return
    table.setPageIndex(target - 1)
  }

  return (
    <Pagination className="mx-0 w-auto justify-end">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            onClick={goto(currentPage - 1)}
            aria-disabled={prevDisabled}
            className={prevDisabled ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>
        {pages.map((p, i) =>
          p === "…" ? (
            <PaginationItem key={`ellipsis-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationLink
                href="#"
                isActive={p === currentPage}
                onClick={goto(p)}
              >
                {p}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            href="#"
            onClick={goto(currentPage + 1)}
            aria-disabled={nextDisabled}
            className={nextDisabled ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

/** Compact page list like [1, "…", 4, 5, 6, "…", 20]. */
function buildPageNumbers(
  current: number,
  total: number,
): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | "…")[] = [1]
  const left = Math.max(2, current - 1)
  const right = Math.min(total - 1, current + 1)
  if (left > 2) pages.push("…")
  for (let i = left; i <= right; i++) pages.push(i)
  if (right < total - 1) pages.push("…")
  pages.push(total)
  return pages
}
