"use client"

import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import type { Segment } from "@/features/segments/types"
import type { Translate } from "@/shared/i18n/translator"
import { Badge } from "@repo/ui/components/badge"
import { Checkbox } from "@repo/ui/components/checkbox"
import { formatRelativeTime, segmentQueryText } from "@/features/segments/lib/helpers"
import { SegmentsRowActions } from "./segments-row-actions"

/**
 * `t` is the `segments.table` translator, `tRelative` the
 * `segments.relativeTime` one (the updated-at cell).
 */
export function buildSegmentColumns({
  shopSlug,
  t,
  tRelative,
}: {
  shopSlug: string
  t: Translate
  tRelative: Translate
}): ColumnDef<Segment>[] {
  return [
    {
      id: "select",
      header: ({ table }) => {
        const allChecked = table.getIsAllPageRowsSelected()
        // We render the "indeterminate" visual via opacity since the local
        // Checkbox UI doesn't accept the third state.
        const someChecked = !allChecked && table.getIsSomePageRowsSelected()
        return (
          <Checkbox
            checked={allChecked}
            className={someChecked ? "opacity-60" : undefined}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label={t("selectAll")}
          />
        )
      },
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label={t("selectRow")}
          // Stop propagation so clicking the checkbox doesn't follow the
          // row's name-link.
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 32,
    },
    {
      accessorKey: "name",
      header: t("columns.name"),
      cell: ({ row }) => {
        const s = row.original
        return (
          <Link
            href={`/store/${shopSlug}/segments/${s.id}`}
            className="flex flex-col gap-0.5 hover:underline"
          >
            <span className="font-medium leading-tight">{s.name}</span>
            {s.description && (
              <span className="line-clamp-1 text-xs text-muted-foreground">
                {s.description}
              </span>
            )}
          </Link>
        )
      },
    },
    {
      id: "query",
      header: t("columns.query"),
      cell: ({ row }) => {
        const q = segmentQueryText(row.original)
        if (!q) {
          return <span className="text-xs text-muted-foreground">—</span>
        }
        return (
          <code className="line-clamp-1 max-w-md rounded-md bg-muted px-2 py-1 font-mono text-xs">
            {q}
          </code>
        )
      },
    },
    {
      accessorKey: "coupons_count",
      header: t("columns.coupons"),
      cell: ({ row }) => {
        const n = row.original.coupons_count
        if (n === 0) {
          return <span className="text-xs text-muted-foreground">—</span>
        }
        return (
          <Badge variant="secondary" className="font-normal">
            {n}
          </Badge>
        )
      },
    },
    {
      accessorKey: "updated_at",
      header: t("columns.updated"),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {formatRelativeTime(row.original.updated_at, tRelative)}
        </span>
      ),
    },
    {
      id: "actions",
      header: () => null,
      cell: ({ row }) => <SegmentsRowActions segment={row.original} />,
      enableSorting: false,
    },
  ]
}
