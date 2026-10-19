"use client"

import { useState } from "react"
import { useFormatter } from "next-intl"
import type { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@repo/ui/components/checkbox"
import { formatMoneyCents } from "@/shared/lib/format"
import Image from "@/shared/components/app-image"
import { ImageIcon } from "lucide-react"
import type { AbandonedCartProductRow } from "@/features/abandoned-carts/types"

export function abandonedCartProductColumns(args: {
  labels: {
    product: string
    carts: string
    lost: string
    lastLeft: string
    selectAll: string
    selectRow: string
  }
}): ColumnDef<AbandonedCartProductRow>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onCheckedChange={(c) => table.toggleAllPageRowsSelected(c === true)}
          aria-label={args.labels.selectAll}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(c) => row.toggleSelected(c === true)}
          aria-label={args.labels.selectRow}
        />
      ),
      enableHiding: false,
      size: 40,
    },
    {
      id: "product",
      accessorFn: (row) => row.name,
      header: args.labels.product,
      cell: ({ row }) => (
      <div className="flex min-w-40 items-center gap-2.5">
          {row.original.image?.thumbnail || row.original.image?.original ? (
            <Image
              src={
                row.original.image?.thumbnail ??
                row.original.image?.original ??
                ""
              }
              alt={row.original.name}
              width={28}
              height={28}
              className="size-7 shrink-0 rounded-md object-cover"
            />
          ) : (
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
              <ImageIcon className="size-3.5" />
            </div>
          )}
          <span className="truncate text-sm font-medium">{row.original.name}</span>
        </div>
      ),
    },
    {
      id: "carts",
      accessorFn: (row) => row.cart_count,
      header: args.labels.carts,
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">{row.original.cart_count}</span>
      ),
    },
    {
      id: "lost",
      accessorFn: (row) => row.lost_revenue_cents,
      header: args.labels.lost,
      cell: ({ row }) => (
        <div className="text-end text-sm tabular-nums">
          {formatMoneyCents(
            row.original.lost_revenue_cents,
            row.original.currency,
          )}
        </div>
      ),
      meta: { headClassName: "text-end", cellClassName: "text-end" },
    },
    {
      id: "lastLeft",
      accessorFn: (row) => row.last_left_at,
      header: args.labels.lastLeft,
      cell: ({ row }) => <RelativeTime iso={row.original.last_left_at} />,
    },
  ]
}

function RelativeTime({ iso }: { iso?: string | null }) {
  const format = useFormatter()
  const [now] = useState(() => new Date())
  if (!iso) return <span className="text-sm text-muted-foreground">—</span>
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) {
    return <span className="text-sm text-muted-foreground">—</span>
  }
  return (
    <span className="text-sm text-muted-foreground">
      {format.relativeTime(then, now)}
    </span>
  )
}
