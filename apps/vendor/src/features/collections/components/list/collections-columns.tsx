"use client"

import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  FolderIcon,
} from "lucide-react"
import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"
import { Checkbox } from "@repo/ui/components/checkbox"
import type { ShopCollection } from "@/features/collections/types"
import type { Translate } from "@/shared/i18n/translator"
import { cn } from "@/shared/lib/utils"
import { formatDate } from "@/shared/lib/format"
import {
  PUBLISHED_BADGE_STYLE,
  collectionTypeKey,
} from "@/features/collections/lib/list/constants"
import { collectionName } from "@/features/collections/lib/list/helpers"
import { CollectionsRowActions } from "./collections-row-actions"

/** `t` is the `collections` translator; headers are built with the columns. */
export function buildCollectionColumns(
  shopSlug: string,
  t: Translate,
): ColumnDef<ShopCollection>[] {
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
          aria-label={t("columns.selectRow", {
            name: collectionName(row.original.name),
          })}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      id: "name",
      accessorFn: (row) => collectionName(row.name),
      header: ({ column }) => (
        <SortableHeader column={column} label={t("columns.name")} />
      ),
      cell: ({ row }) => (
        <Link
          href={`/store/${shopSlug}/products/collections/${row.original.id}`}
          className="flex items-center gap-3"
        >
          <CollectionThumb src={row.original.image?.url} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium hover:underline">
              {collectionName(row.original.name)}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              /{row.original.slug}
            </p>
          </div>
        </Link>
      ),
      sortingFn: "alphanumeric",
    },
    {
      id: "is_published",
      // A sort/filter token, never drawn: the cell below renders the words.
      accessorFn: (row) => (row.is_published ? "published" : "hidden"),
      header: t("columns.status"),
      cell: ({ row }) => (
        <Badge
          className={cn(
            "h-6 rounded-md px-2.5",
            PUBLISHED_BADGE_STYLE[
              row.original.is_published ? "published" : "hidden"
            ],
          )}
        >
          {row.original.is_published
            ? t("channel.published")
            : t("channel.hidden")}
        </Badge>
      ),
    },
    {
      id: "type",
      accessorKey: "type",
      header: t("columns.type"),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {t(collectionTypeKey(row.original.type))}
        </span>
      ),
    },
    {
      id: "product_count",
      accessorFn: (row) => row.product_count ?? 0,
      header: ({ column }) => (
        <div className="flex justify-end">
          <SortableHeader
            column={column}
            label={t("columns.products")}
            align="right"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right text-sm tabular-nums">
          {row.original.product_count ?? 0}
        </div>
      ),
      sortingFn: "basic",
    },
    {
      accessorKey: "updated_at",
      header: ({ column }) => (
        <SortableHeader column={column} label={t("columns.updated")} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDate(row.original.updated_at)}
        </span>
      ),
      sortingFn: "datetime",
    },
    {
      id: "actions",
      enableSorting: false,
      enableHiding: false,
      cell: ({ row }) => (
        <CollectionsRowActions collection={row.original} />
      ),
      size: 40,
    },
  ]
}

function CollectionThumb({ src }: { src?: string | null }) {
  if (!src) {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
        <FolderIcon className="size-4" />
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={40}
      height={40}
      className="size-10 shrink-0 rounded-md object-cover ring-1 ring-border"
    />
  )
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
