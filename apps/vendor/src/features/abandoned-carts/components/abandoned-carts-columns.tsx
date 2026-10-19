"use client"

import { useState } from "react"
import Link from "next/link"
import { useFormatter } from "next-intl"
import type { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@repo/ui/components/checkbox"
import { formatMoneyCents, initials } from "@/shared/lib/format"
import Image from "@/shared/components/app-image"
import { ImageIcon, MessageCircleIcon } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import type { AbandonedCart } from "@/features/abandoned-carts/types"
import { daysSince } from "@/features/abandoned-carts/lib/status"
import { AbandonedCartsRowActions } from "./abandoned-carts-row-actions"
import { AbandonedCartsStatusPopover } from "./abandoned-carts-status-popover"

export function abandonedCartColumns(args: {
  shopSlug: string
  labels: {
    customer: string
    guest: string
    products: string
    total: string
    updated: string
    status: string
    country: string
    created: string
    actions: string
    daysAgo: (days: number) => string
    remind: string
    chatWhatsApp: string
    selectAll: string
    selectRow: string
  }
  onRemind: (cart: AbandonedCart) => void
  onOpenItems: (cart: AbandonedCart) => void
}): ColumnDef<AbandonedCart>[] {
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
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      id: "customer",
      accessorFn: (row) => row.customer?.name ?? row.customer?.email ?? "",
      header: args.labels.customer,
      cell: ({ row }) => {
        const cart = row.original
        const name =
          cart.customer?.name || cart.customer?.email || args.labels.guest
        const idleFrom = cart.abandoned_at ?? cart.last_activity_at ?? cart.created_at
        const days = daysSince(idleFrom)
        const phone = cart.customer?.phone?.replace(/\D/g, "")
        const href = cart.customer?.id
          ? `/store/${args.shopSlug}/customers/${cart.customer.id}`
          : null
        return (
          <div className="flex min-w-40 items-center gap-2.5">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                avatarTone(name),
              )}
            >
              {initials(name)}
            </span>
            <div className="min-w-0">
              {href ? (
                <Link
                  href={href}
                  className="truncate text-sm font-medium hover:underline"
                >
                  {name}
                </Link>
              ) : (
                <div className="truncate text-sm font-medium">{name}</div>
              )}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {days != null ? <span>{args.labels.daysAgo(days)}</span> : null}
                {phone ? (
                  <a
                    href={`https://wa.me/${phone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={args.labels.chatWhatsApp}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MessageCircleIcon className="size-3.5" />
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        )
      },
    },
    {
      id: "products",
      accessorFn: (row) => row.item_count,
      header: args.labels.products,
      cell: ({ row }) => (
        <button
          type="button"
          className="flex items-center -space-x-2 rtl:space-x-reverse"
          onClick={() => args.onOpenItems(row.original)}
        >
          {row.original.items.slice(0, 3).map((item) => (
            <ProductThumb
              key={item.id}
              src={item.image?.thumbnail ?? item.image?.original}
              name={item.name}
            />
          ))}
          {row.original.items.length > 3 ? (
            <span className="ps-3 text-xs text-muted-foreground">
              +{row.original.items.length - 3}
            </span>
          ) : null}
        </button>
      ),
    },
    {
      id: "total",
      accessorFn: (row) => row.total_cents,
      header: args.labels.total,
      cell: ({ row }) => (
        <div className="text-end text-sm tabular-nums">
          {formatMoneyCents(row.original.total_cents, row.original.currency)}
        </div>
      ),
      meta: { headClassName: "text-end", cellClassName: "text-end" },
    },
    {
      id: "updated",
      accessorFn: (row) =>
        row.last_activity_at ?? row.abandoned_at ?? row.created_at,
      header: args.labels.updated,
      cell: ({ row }) => {
        const iso =
          row.original.last_activity_at ??
          row.original.abandoned_at ??
          row.original.created_at
        return <RelativeTime iso={iso} />
      },
    },
    {
      id: "country",
      accessorFn: (row) => row.customer?.country ?? "",
      header: args.labels.country,
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.customer?.country || "—"}
        </span>
      ),
    },
    {
      id: "created",
      accessorFn: (row) => row.created_at,
      header: args.labels.created,
      cell: ({ row }) => <RelativeTime iso={row.original.created_at} />,
    },
    {
      id: "status",
      accessorFn: (row) => row.reminder_status,
      header: args.labels.status,
      cell: ({ row }) => <AbandonedCartsStatusPopover cart={row.original} />,
    },
    {
      id: "actions",
      header: args.labels.actions,
      cell: ({ row }) => (
        <AbandonedCartsRowActions
          cart={row.original}
          remindLabel={args.labels.remind}
          onRemind={args.onRemind}
        />
      ),
      enableHiding: false,
      meta: { headClassName: "text-end", cellClassName: "text-end" },
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

const AVATAR_TONES = [
  "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
]

function avatarTone(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash += name.charCodeAt(i)
  return AVATAR_TONES[hash % AVATAR_TONES.length]
}

function ProductThumb({ src, name }: { src?: string | null; name: string }) {
  if (!src) {
    return (
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
        <ImageIcon className="size-3.5" />
      </div>
    )
  }
  return (
    <Image
      src={src}
      alt={name}
      width={28}
      height={28}
      className="size-7 shrink-0 rounded-md object-cover ring-2 ring-background"
    />
  )
}
