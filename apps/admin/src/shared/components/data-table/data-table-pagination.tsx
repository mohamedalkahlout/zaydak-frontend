"use client"

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@repo/ui/components/pagination"

interface DataTablePaginationProps {
  /** 1-indexed, the way the API and the user both count. */
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  /** Held while a page is in flight, so a double click cannot skip a page. */
  disabled?: boolean
  previousLabel?: string
  nextLabel?: string
}

/**
 * Numbered pagination for a server-paged list.
 *
 * The vendor dashboard's version reads its state off a TanStack table; admin
 * lists page on the server, so this takes the page numbers directly. The
 * rendering — and `buildPageNumbers` — is deliberately identical.
 */
export function DataTablePagination({
  page,
  totalPages,
  onPageChange,
  disabled = false,
  previousLabel,
  nextLabel,
}: DataTablePaginationProps) {
  const pages = buildPageNumbers(page, totalPages)
  const prevDisabled = disabled || page <= 1
  const nextDisabled = disabled || page >= totalPages

  const goto = (target: number) => (e: React.MouseEvent) => {
    e.preventDefault()
    if (disabled || target < 1 || target > totalPages || target === page) return
    onPageChange(target)
  }

  return (
    <Pagination className="mx-0 w-auto justify-end">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            text={previousLabel}
            onClick={goto(page - 1)}
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
              <PaginationLink href="#" isActive={p === page} onClick={goto(p)}>
                {p}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            href="#"
            text={nextLabel}
            onClick={goto(page + 1)}
            aria-disabled={nextDisabled}
            className={nextDisabled ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

/** Compact page list like [1, "…", 4, 5, 6, "…", 20]. */
function buildPageNumbers(current: number, total: number): (number | "…")[] {
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
