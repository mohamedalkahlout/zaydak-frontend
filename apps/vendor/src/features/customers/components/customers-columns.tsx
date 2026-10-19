"use client"

import Link from "next/link"
import type { Column, ColumnDef } from "@tanstack/react-table"
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  LinkIcon,
  MailIcon,
} from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Checkbox } from "@repo/ui/components/checkbox"
import { formatDate } from "@/shared/lib/format"
import type { Translate } from "@/shared/i18n/translator"
import type { Contact } from "@/features/customers/types"
import {
  averageScore,
  contactAcceptsMarketing,
  contactEmail,
  customerInitials,
  contactTags,
  formatLocation,
  contactAddress,
  hasLinkedCustomer,
} from "@/features/customers/lib/helpers"
import { CustomerStatusBadge } from "./customer-status-badge"
import { CustomersRowActions } from "./customers-row-actions"

interface CustomerColumnContext {
  shopSlug: string
  /** The `customers` translator: the columns are built outside a component. */
  t: Translate
}

export function buildCustomerColumns({
  shopSlug,
  t,
}: CustomerColumnContext): ColumnDef<Contact>[] {
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
          aria-label={t("columns.selectRow", { name: row.original.name })}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <SortableHeader column={column} label={t("columns.name")} />
      ),
      cell: ({ row }) => {
        const c = row.original
        const email = contactEmail(c)
        const href = `/store/${shopSlug}/customers/${c.id}`
        return (
          <Link
            href={href}
            className="flex items-center gap-2.5 outline-none hover:text-primary focus-visible:text-primary"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
              {customerInitials(c.name)}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-sm font-medium">{c.name}</p>
                {hasLinkedCustomer(c) && (
                  <span
                    title={t("columns.linkedCustomer")}
                    className="inline-flex size-4 items-center justify-center rounded-full bg-sky-100 text-sky-800"
                  >
                    <LinkIcon className="size-2.5" />
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {email || c.phone_number || c.description || "—"}
              </p>
            </div>
          </Link>
        )
      },
      sortingFn: "alphanumeric",
    },
    {
      id: "subscription",
      accessorFn: (row) => (contactAcceptsMarketing(row) ? "subscribed" : "not"),
      header: t("columns.subscription"),
      cell: ({ row }) => {
        const subscribed = contactAcceptsMarketing(row.original)
        return (
          <span
            className={
              subscribed
                ? "inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900"
                : "inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600"
            }
          >
            <MailIcon className="size-3" />
            {subscribed
              ? t("columns.subscribed")
              : t("columns.notSubscribed")}
          </span>
        )
      },
      filterFn: (row, _id, value: string[]) => {
        if (!value?.length) return true
        const v = contactAcceptsMarketing(row.original) ? "subscribed" : "not"
        return value.includes(v)
      },
    },
    {
      id: "location",
      accessorFn: (row) => formatLocation(contactAddress(row)),
      header: t("columns.location"),
      cell: ({ row }) => {
        const loc = formatLocation(contactAddress(row.original))
        return (
          <span className="text-sm text-muted-foreground">{loc || "—"}</span>
        )
      },
    },
    {
      id: "status",
      accessorFn: (row) => row.status,
      header: t("columns.status"),
      cell: ({ row }) => <CustomerStatusBadge status={row.original.status} />,
      filterFn: (row, id, value: string[]) => {
        if (!value?.length) return true
        return value.includes(row.getValue(id) as string)
      },
    },
    {
      id: "score",
      accessorFn: (row) => averageScore(row.overall_score) ?? -1,
      header: ({ column }) => (
        <div className="flex justify-end">
          <SortableHeader
            column={column}
            label={t("columns.score")}
            align="right"
          />
        </div>
      ),
      cell: ({ row }) => {
        const pct = averageScore(row.original.overall_score)
        if (pct == null) {
          return (
            <div className="text-right text-sm text-muted-foreground">—</div>
          )
        }
        return (
          <div className="flex items-center justify-end gap-2">
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
              {pct}%
            </span>
          </div>
        )
      },
      sortingFn: "basic",
    },
    {
      id: "tags",
      accessorFn: (row) => contactTags(row).join(", "),
      header: t("columns.tags"),
      cell: ({ row }) => {
        const tags = contactTags(row.original)
        if (tags.length === 0) {
          return <span className="text-sm text-muted-foreground">—</span>
        }
        const visible = tags.slice(0, 2)
        const extra = tags.length - visible.length
        return (
          <div className="flex flex-wrap items-center gap-1">
            {visible.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
              >
                {tag}
              </span>
            ))}
            {extra > 0 && (
              <span className="text-xs text-muted-foreground">+{extra}</span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <SortableHeader column={column} label={t("columns.added")} />
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.original.created_at)}
        </span>
      ),
      sortingFn: "datetime",
    },
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => <CustomersRowActions contact={row.original} />,
      size: 40,
    },
  ]
}

function SortableHeader<T>({
  column,
  label,
  align = "left",
}: {
  column: Column<T, unknown>
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
