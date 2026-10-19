"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Checkbox } from "@repo/ui/components/checkbox"
import { useShopCurrency } from "@/shared/hooks/use-shop-currency"
import { formatDate, formatMoneyCents } from "@/shared/lib/format"
import type { Translate } from "@/shared/i18n/translator"
import type { Coupon } from "@/features/coupons/types"
import {
  couponScope,
  couponScopeLabel,
  couponStatus,
  couponValue,
  normalizeCouponType,
} from "@/features/coupons/lib/list/helpers"
import { CouponStatusBadge, CouponTypeBadge } from "./coupon-badges"
import { CouponsRowActions } from "./coupons-row-actions"
import { CouponCodeCell } from "./coupon-code-cell"

function CouponValueCell({
  coupon,
  t,
}: {
  coupon: Coupon
  t: Translate
}) {
  const currency = useShopCurrency()
  return (
    <span className="text-sm font-medium">
      {couponValue(coupon, t, currency)}
    </span>
  )
}

function CouponMinCell({ cents }: { cents: number }) {
  const currency = useShopCurrency()
  return (
    <div className="text-right text-sm tabular-nums text-muted-foreground">
      {cents > 0 ? formatMoneyCents(cents, currency) : "—"}
    </div>
  )
}

/**
 * The list's columns. A function rather than a constant because every header
 * and every derived cell ("3 products", "Unlimited", "Never") is a message:
 * `t` is the `coupons` translator and `locale` joins the scope summary, and a
 * module evaluated at import time has neither.
 */
export function couponColumns(t: Translate, locale: string): ColumnDef<Coupon>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onCheckedChange={(c) => table.toggleAllPageRowsSelected(c === true)}
          aria-label={t("columns.selectAll")}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(c) => row.toggleSelected(c === true)}
          aria-label={t("columns.selectRow", { code: row.original.code })}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      accessorKey: "code",
      header: ({ column }) => (
        <SortableHeader column={column} label={t("columns.code")} />
      ),
      cell: ({ row }) => <CouponCodeCell coupon={row.original} />,
      sortingFn: "alphanumeric",
    },
    {
      id: "type",
      accessorFn: (row) => normalizeCouponType(row.type),
      header: t("columns.type"),
      cell: ({ row }) => <CouponTypeBadge type={row.original.type} />,
      filterFn: (row, id, value: string[]) => {
        if (!value?.length) return true
        return value.includes(row.getValue(id) as string)
      },
    },
    {
      id: "value",
      accessorFn: (row) => row.amount_cents ?? row.percent_bps ?? 0,
      header: ({ column }) => (
        <SortableHeader column={column} label={t("columns.value")} />
      ),
      cell: ({ row }) => <CouponValueCell coupon={row.original} t={t} />,
      sortingFn: "basic",
    },
    {
      id: "minimum_cart_amount",
      accessorFn: (row) => row.minimum_cart_amount_cents ?? 0,
      header: ({ column }) => (
        <div className="flex justify-end">
          <SortableHeader
            column={column}
            label={t("columns.minCart")}
            align="right"
          />
        </div>
      ),
      cell: ({ row }) => (
        <CouponMinCell cents={row.original.minimum_cart_amount_cents ?? 0} />
      ),
      sortingFn: "basic",
    },
    {
      id: "scope",
      accessorFn: (row) => couponScope(row),
      header: t("columns.scope"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {couponScopeLabel(row.original, t, locale)}
        </span>
      ),
      filterFn: (row, id, value: string[]) => {
        if (!value?.length) return true
        return value.includes(row.getValue(id) as string)
      },
    },
    {
      id: "status",
      accessorFn: (row) => couponStatus(row),
      header: t("columns.status"),
      cell: ({ row }) => (
        <CouponStatusBadge status={couponStatus(row.original)} />
      ),
      filterFn: (row, id, value: string[]) => {
        if (!value?.length) return true
        return value.includes(row.getValue(id) as string)
      },
    },
    {
      id: "uses",
      accessorFn: (row) => row.max_uses ?? Number.POSITIVE_INFINITY,
      header: ({ column }) => (
        <div className="flex justify-end">
          <SortableHeader
            column={column}
            label={t("columns.maxUses")}
            align="right"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right text-sm tabular-nums text-muted-foreground">
          {row.original.max_uses ?? t("columns.unlimited")}
        </div>
      ),
      sortingFn: "basic",
    },
    {
      accessorKey: "expire_at",
      header: ({ column }) => (
        <SortableHeader column={column} label={t("columns.expires")} />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.expire_at
            ? formatDate(row.original.expire_at)
            : t("columns.never")}
        </span>
      ),
      sortingFn: "datetime",
    },
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => <CouponsRowActions coupon={row.original} />,
      size: 40,
    },
  ]
}

function SortableHeader<T>({
  column,
  label,
  align = "left",
}: {
  column: import("@tanstack/react-table").Column<T, unknown>
  label: string
  align?: "left" | "right"
}) {
  const sorted = column.getIsSorted()
  const Icon =
    sorted === "asc" ? ArrowUpIcon : sorted === "desc" ? ArrowDownIcon : ArrowUpDownIcon
  return (
    <Button
      variant="ghost"
      size="sm"
      className={`-ml-2 h-8 px-2 ${align === "right" ? "-mr-2 ml-0" : ""}`}
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      {label}
      <Icon className="ml-1.5 size-3.5 opacity-60" />
    </Button>
  )
}
