"use client"

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table"
import { Checkbox } from "@repo/ui/components/checkbox"
import { cn } from "@/shared/lib/utils"
import type { FileEntry } from "@/features/files/types"
import type { FileSortKey } from "@/features/files/lib/list/constants"
import {
  formatFileDate,
  humanFileSize,
  mimeLabel,
} from "@/features/files/lib/list/helpers"
import { FilePreview } from "./file-preview"
import { FileRowActions } from "./file-row-actions"
import { useTranslations } from "next-intl"

type SortColumn = "name" | "date" | "size"

/** Next sort key when a column header is clicked (toggles asc/desc). */
function nextSortKey(column: SortColumn, current: FileSortKey): FileSortKey {
  const desc = `${column}-desc` as FileSortKey
  const asc = `${column}-asc` as FileSortKey
  // Name starts A→Z; date and size start with the "largest/newest first".
  const primary = column === "name" ? asc : desc
  const secondary = column === "name" ? desc : asc
  return current === primary ? secondary : primary
}

/**
 * Module scope, not nested inside `FilesListView`. A component declared during
 * render is a new type on every render, so React remounts these header cells
 * instead of updating them — which drops focus in the middle of sorting. What
 * kept it inside was closing over `sortKey`/`onSortChange`; they are props now.
 */
function SortableHead({
  column,
  sortKey,
  onSortChange,
  children,
  className,
}: {
  column: SortColumn
  sortKey: FileSortKey
  onSortChange: (value: FileSortKey) => void
  children: React.ReactNode
  className?: string
}) {
  const active = sortKey.startsWith(column)
  const ascending = sortKey.endsWith("asc")
  const Arrow = active && ascending ? ArrowUpIcon : ArrowDownIcon
  return (
    <TableHead
      aria-sort={active ? (ascending ? "ascending" : "descending") : "none"}
      className={cn(
        "h-8 px-3 text-xs font-medium text-foreground/70",
        className,
      )}
    >
      <button
        type="button"
        className="group/sort inline-flex items-center gap-1 rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onSortChange(nextSortKey(column, sortKey))}
      >
        {children}
        {/* The arrow is always mounted so the header never shifts width when
            sorting moves between columns — it just fades in. */}
        <Arrow
          aria-hidden
          className={cn(
            "size-3.5 transition-opacity",
            active
              ? "opacity-100"
              : "opacity-0 group-hover/sort:opacity-40 group-focus-visible/sort:opacity-40",
          )}
        />
      </button>
    </TableHead>
  )
}

/**
 * Shopify-style list view: a thumbnail + name/type cell, alt text, date, size,
 * and a references column. Column headers are clickable to sort; the active
 * column shows an ↑/↓ arrow. Per-row Replace / Copy-link actions surface on
 * hover at the right edge.
 */
export function FilesListView({
  files,
  selected,
  sortKey,
  replacingId,
  onToggle,
  onToggleAll,
  onOpen,
  onReplace,
  onEnhance,
  onSortChange,
}: {
  files: FileEntry[]
  selected: Set<string>
  sortKey: FileSortKey
  replacingId: string | null
  onToggle: (id: string) => void
  onToggleAll: (checked: boolean) => void
  onOpen: (id: string) => void
  onReplace: (file: FileEntry, picked: File) => void
  onEnhance: (file: FileEntry) => void
  onSortChange: (value: FileSortKey) => void
}) {
  const t = useTranslations("files")
  const allSelected = files.length > 0 && files.every((f) => selected.has(f.id))
  const someSelected = files.some((f) => selected.has(f.id))

  const sortProps = { sortKey, onSortChange }

  return (
    <Table>
      <TableHeader className="bg-transparent">
        <TableRow className="border-border hover:bg-transparent">
          <TableHead className="h-8 w-10 px-3">
            <Checkbox
              checked={allSelected}
              indeterminate={!allSelected && someSelected}
              onCheckedChange={(v) => onToggleAll(v === true)}
              aria-label={t("list.selectAll")}
            />
          </TableHead>
          <SortableHead column="name" {...sortProps} className="px-2">
            {t("list.fileName")}
          </SortableHead>
          <TableHead className="h-8 px-3 text-xs font-medium text-foreground/70">
            {t("list.altText")}
          </TableHead>
          <SortableHead column="date" {...sortProps}>{t("list.dateAdded")}</SortableHead>
          <SortableHead column="size" {...sortProps}>{t("list.size")}</SortableHead>
          {/* Actions column — labelled for screen readers only, since the
              buttons themselves are revealed on row hover. */}
          <TableHead className="h-8 w-24 px-3">
            <span className="sr-only">{t("list.actions")}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {files.map((file) => {
          const isSelected = selected.has(file.id)
          return (
            <TableRow
              key={file.id}
              data-state={isSelected ? "selected" : undefined}
              className={cn(
                "group/row cursor-pointer border-border hover:bg-muted/50 data-[state=selected]:bg-muted",
              )}
              onClick={() => onOpen(file.id)}
            >
              <TableCell
                className="px-3 py-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggle(file.id)}
                  aria-label={t("list.selectFile", { name: file.original_name })}
                />
              </TableCell>
              <TableCell className="px-2 py-2">
                <div className="flex items-center gap-3">
                  <div className="size-11 shrink-0 overflow-hidden rounded-md ring-1 ring-border ring-inset">
                    <FilePreview file={file} iconClassName="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p
                      className="max-w-70 truncate text-sm font-medium"
                      title={file.original_name}
                    >
                      {file.original_name}
                    </p>
                    <p className="text-xs tracking-wide text-muted-foreground">
                      {mimeLabel(file.mime_type)}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="max-w-56 px-3 py-1.5 text-sm text-muted-foreground">
                <span className="block truncate" title={file.alt ?? undefined}>
                  {file.alt || (
                    <>
                      <span aria-hidden>—</span>
                      <span className="sr-only">{t("list.noAltText")}</span>
                    </>
                  )}
                </span>
              </TableCell>
              <TableCell className="px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground">
                {formatFileDate(file.created_at)}
              </TableCell>
              <TableCell className="px-3 py-1.5 text-sm tabular-nums whitespace-nowrap text-muted-foreground">
                {humanFileSize(file.size)}
              </TableCell>
              <TableCell className="px-3 py-1.5">
                <FileRowActions
                  file={file}
                  replacing={replacingId === file.id}
                  onReplace={onReplace}
                  onEnhance={onEnhance}
                />
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
