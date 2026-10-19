"use client"

import type { Column, ColumnDef, Row, Table } from "@tanstack/react-table"
import { useTranslations } from "next-intl"
import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Checkbox } from "@repo/ui/components/checkbox"
import type { Order } from "@/features/orders/types"
import {
  customerInitials,
  formatDate,
  formatMoneyCents,
  itemCount,
} from "@/features/orders/lib/list/format"
import { OrderStatusBadge, PaymentStatusBadge } from "./order-status-badge"
import { OrdersRowActions } from "./orders-row-actions"
import { useShopCurrency } from "@/shared/hooks/use-shop-currency"
import { PlacedViaMark } from "./placed-via-mark"

/**
 * The column labels, as keys under `orders.columns`. The definitions below are
 * a module constant — TanStack wants a stable array — so the words are drawn by
 * small components that read the active locale when they render, rather than
 * being fixed into the array when the module is first evaluated.
 */
type ColumnLabelKey =
  | "order"
  | "date"
  | "customer"
  | "total"
  | "payment"
  | "status"
  | "items"

export const orderColumns: ColumnDef<Order>[] = [
  {
    id: "select",
    header: ({ table }) => <SelectAllCheckbox table={table} />,
    cell: ({ row }) => <SelectOrderCheckbox row={row} />,
    enableSorting: false,
    enableHiding: false,
    size: 40,
  },
  {
    accessorKey: "tracking_number",
    header: () => <ColumnLabel id="order" />,
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1.5">
        <span className="font-medium">#{row.original.tracking_number}</span>
        <PlacedViaMark placedVia={row.original.placed_via} />
      </span>
    ),
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => <SortableHeader column={column} labelKey="date" />,
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDate(row.original.created_at)}
      </span>
    ),
    sortingFn: "datetime",
  },
  {
    id: "customer",
    header: () => <ColumnLabel id="customer" />,
    accessorFn: (row) => row.customer?.name ?? "",
    cell: ({ row }) => <CustomerCell order={row.original} />,
    // Participates in global (search) filter.
    filterFn: (row, _id, value: string) => {
      const v = value.trim().toLowerCase()
      if (!v) return true
      return (
        (row.original.customer?.name ?? "").toLowerCase().includes(v) ||
        (row.original.customer?.email ?? "").toLowerCase().includes(v)
      )
    },
  },
  {
    id: "total",
    accessorFn: (row) => row.pricing.total_cents,
    header: ({ column }) => (
      <div className="flex justify-end">
        <SortableHeader column={column} labelKey="total" align="right" />
      </div>
    ),
    cell: ({ row }) => (
      <OrderTotalCell cents={row.original.pricing.total_cents} />
    ),
    sortingFn: "basic",
  },
  {
    id: "payment_status",
    accessorFn: (row) => row.payment.status,
    header: () => <ColumnLabel id="payment" />,
    cell: ({ row }) => <PaymentStatusBadge status={row.original.payment.status} />,
    filterFn: (row, _id, value: string[]) => {
      if (!value?.length) return true
      return value.includes(row.original.payment.status)
    },
  },
  {
    accessorKey: "order_status",
    header: () => <ColumnLabel id="status" />,
    cell: ({ row }) => <OrderStatusBadge status={row.original.order_status} />,
    // Multi-value filter driven by the toolbar filter bar.
    filterFn: (row, id, value: string[]) => {
      if (!value?.length) return true
      return value.includes(row.getValue(id) as string)
    },
  },
  {
    id: "items",
    accessorFn: (row) => itemCount(row),
    header: ({ column }) => (
      <div className="flex justify-end">
        <SortableHeader column={column} labelKey="items" align="right" />
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-right text-sm text-muted-foreground tabular-nums">
        {itemCount(row.original)}
      </div>
    ),
    sortingFn: "basic",
  },
  {
    id: "actions",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => <OrdersRowActions order={row.original} />,
    size: 40,
  },
]

function OrderTotalCell({
  cents,
}: {
  cents: number | null | undefined
}) {
  const currency = useShopCurrency()
  return (
    <div className="text-right font-medium tabular-nums">
      {formatMoneyCents(cents, currency)}
    </div>
  )
}

function ColumnLabel({ id }: { id: ColumnLabelKey }) {
  const t = useTranslations("orders.columns")
  return <>{t(id)}</>
}

function SelectAllCheckbox({ table }: { table: Table<Order> }) {
  const t = useTranslations("orders.columns")
  return (
    <Checkbox
      checked={table.getIsAllPageRowsSelected()}
      indeterminate={table.getIsSomePageRowsSelected()}
      onCheckedChange={(c) => table.toggleAllPageRowsSelected(c === true)}
      aria-label={t("selectAll")}
    />
  )
}

function SelectOrderCheckbox({ row }: { row: Row<Order> }) {
  const t = useTranslations("orders.columns")
  return (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={(c) => row.toggleSelected(c === true)}
      aria-label={t("selectOrder", { number: row.original.tracking_number })}
    />
  )
}

function CustomerCell({ order }: { order: Order }) {
  const t = useTranslations("orders.columns")
  if (!order.customer?.name) {
    return <span className="text-sm text-muted-foreground">{t("guest")}</span>
  }
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
        {customerInitials(order)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{order.customer.name}</p>
        {order.customer.email && (
          <p className="truncate text-xs text-muted-foreground">
            {order.customer.email}
          </p>
        )}
      </div>
    </div>
  )
}

function SortableHeader<T>({
  column,
  labelKey,
  align = "left",
}: {
  column: Column<T, unknown>
  labelKey: ColumnLabelKey
  align?: "left" | "right"
}) {
  const t = useTranslations("orders.columns")
  const sorted = column.getIsSorted()
  const Icon =
    sorted === "asc" ? ArrowUpIcon : sorted === "desc" ? ArrowDownIcon : ArrowUpDownIcon

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`-ml-2 h-8 px-2 data-[state=active]:bg-muted ${
        align === "right" ? "-mr-2 ml-0" : ""
      }`}
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {t(labelKey)}
      <Icon className="ml-1.5 size-3.5 opacity-60" />
    </Button>
  )
}
