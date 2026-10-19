"use client"

import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import type { ColumnDef, Row, Table } from "@tanstack/react-table"
import { ImageIcon } from "lucide-react"
import { Checkbox } from "@repo/ui/components/checkbox"
import { cn } from "@/shared/lib/utils"
import type { Product, ProductType } from "@/features/products/types"
import { useShopCurrency } from "@/shared/hooks/use-shop-currency"
import { formatDate, formatMoneyCents, translatable } from "@/shared/lib/format"
import type { ProductColumnId } from "@/features/products/lib/list/constants"
import {
  priceDisplay,
  productEditHref,
  productName,
  stockBucket,
  totalStock,
  variantCount,
} from "@/features/products/lib/list/helpers"
import { ProductStatusCell } from "./product-status-cell"
import { ProductNegotiationCell } from "./product-negotiation-cell"
import { ProductsRowActions } from "./products-row-actions"

/**
 * Column headers are plain text, and that is the point.
 *
 * They used to be sort buttons wired to TanStack's `getSortedRowModel`, which
 * sorted the rows already on screen — one page of six out of however many the
 * shop has. Clicking "Price" therefore reordered six rows and called it sorted.
 * Sorting is now one control in the view panel writing `sort_by` to the URL,
 * where the back-end applies it across the whole list.
 */
function ProductNameCell({ product }: { product: Product }) {
  const params = useParams<{ shopSlug: string }>()
  const searchParams = useSearchParams()
  const href = productEditHref(
    params?.shopSlug ?? "",
    product.slug,
    searchParams.toString(),
  )
  return (
    <div className="flex items-center gap-3">
      <ProductThumbnail src={product.image?.thumbnail} />
      <Link
        href={href}
        className="truncate text-sm font-medium hover:underline"
      >
        {productName(product.name)}
      </Link>
    </div>
  )
}

/** "5 in stock for 2 variants" — Shopify's phrasing, and its untracked case. */
function InventoryCell({ product }: { product: Product }) {
  const t = useTranslations("products.columns")
  if (product.track_quantity === false) {
    return (
      <span className="text-sm text-muted-foreground">{t("notTracked")}</span>
    )
  }

  const total = totalStock(product)
  const variants = variantCount(product)
  const bucket = stockBucket(product)
  const tone =
    bucket === "OUT_OF_STOCK"
      ? "text-rose-600"
      : bucket === "LOW_STOCK"
        ? "text-amber-600"
        : "text-foreground"

  return (
    <span className="text-sm">
      <span className={`tabular-nums ${tone}`}>
        {total === 0 ? t("outOfStock") : t("inStock", { count: total })}
      </span>
      {variants > 0 && (
        <span className="text-muted-foreground">
          {" "}
          {t("forVariants", { count: variants })}
        </span>
      )}
    </span>
  )
}

/**
 * A data column's header, read from `products.list.column.<id>` — the same
 * key the view panel lists the column under, so the two cannot disagree.
 * A component rather than a string because the column table is built once at
 * module scope, where there is no translator; TanStack renders a function
 * header as a component, so the hook runs where it belongs.
 */
function ColumnHeader({ id }: { id: ProductColumnId }) {
  const t = useTranslations("products.list.column")
  return <>{t(id)}</>
}

function SelectAllHeader({ table }: { table: Table<Product> }) {
  const t = useTranslations("products.columns")
  return (
    <Checkbox
      checked={table.getIsAllPageRowsSelected()}
      indeterminate={table.getIsSomePageRowsSelected()}
      onCheckedChange={(c) => table.toggleAllPageRowsSelected(c === true)}
      aria-label={t("selectAll")}
    />
  )
}

function SelectRowCell({ row }: { row: Row<Product> }) {
  const t = useTranslations("products.columns")
  return (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={(c) => row.toggleSelected(c === true)}
      aria-label={t("selectRow", { name: productName(row.original.name) })}
    />
  )
}

function ProductTypeCell({ type }: { type: ProductType }) {
  const t = useTranslations("products.productTypes")
  return <span className="text-sm">{t(type)}</span>
}

function CollectionsCell({ product }: { product: Product }) {
  const names = (product.collections ?? []).map((c) => translatable(c.name))
  if (names.length === 0) return <Muted />
  return (
    <span className="text-sm" title={names.join(", ")}>
      {names[0]}
      {names.length > 1 && (
        <span className="text-muted-foreground"> +{names.length - 1}</span>
      )}
    </span>
  )
}

function ProductPriceCell({ product }: { product: Product }) {
  const currency = useShopCurrency()
  return (
    <div className="text-right text-sm font-medium tabular-nums">
      {priceDisplay(product, (cents) => formatMoneyCents(cents, currency))}
    </div>
  )
}

function Muted() {
  return <span className="text-sm text-muted-foreground">—</span>
}

export const productColumns: ColumnDef<Product>[] = [
  {
    id: "select",
    header: ({ table }) => <SelectAllHeader table={table} />,
    cell: ({ row }) => <SelectRowCell row={row} />,
    enableSorting: false,
    enableHiding: false,
    size: 40,
  },
  {
    id: "name",
    accessorFn: (row) => productName(row.name),
    header: () => <ColumnHeader id="name" />,
    cell: ({ row }) => <ProductNameCell product={row.original} />,
    enableHiding: false,
  },
  {
    accessorKey: "status",
    header: () => <ColumnHeader id="status" />,
    // Editable in place — see `ProductStatusCell` for why this one cell writes
    // immediately instead of staging behind the save bar.
    cell: ({ row }) => <ProductStatusCell product={row.original} />,
  },
  {
    id: "inventory",
    accessorFn: (row) => totalStock(row),
    header: () => <ColumnHeader id="inventory" />,
    cell: ({ row }) => <InventoryCell product={row.original} />,
  },
  {
    id: "category",
    accessorFn: (row) => row.system_category?.name ?? "",
    header: () => <ColumnHeader id="category" />,
    cell: ({ row }) => {
      const category = row.original.system_category
      if (!category) return <Muted />
      return (
        <span className="text-sm" title={category.path}>
          {category.name}
        </span>
      )
    },
  },
  {
    id: "collections",
    accessorFn: (row) => row.collections?.length ?? 0,
    header: () => <ColumnHeader id="collections" />,
    cell: ({ row }) => <CollectionsCell product={row.original} />,
  },
  {
    accessorKey: "product_type",
    header: () => <ColumnHeader id="product_type" />,
    cell: ({ row }) => <ProductTypeCell type={row.original.product_type} />,
  },
  {
    id: "price",
    accessorFn: (row) =>
      row.product_type === "VARIABLE"
        ? (row.min_price_cents ?? row.price_cents ?? 0)
        : (row.sale_price_cents ?? row.price_cents ?? 0),
    header: () => (
      <div className="text-right">
        <ColumnHeader id="price" />
      </div>
    ),
    cell: ({ row }) => <ProductPriceCell product={row.original} />,
  },
  {
    id: "negotiation",
    header: () => <ColumnHeader id="negotiation" />,
    cell: ({ row }) => <ProductNegotiationCell product={row.original} />,
  },
  {
    accessorKey: "brand",
    header: () => <ColumnHeader id="brand" />,
    cell: ({ row }) =>
      row.original.brand ? (
        <span className="text-sm">{row.original.brand}</span>
      ) : (
        <Muted />
      ),
  },
  {
    accessorKey: "created_at",
    header: () => <ColumnHeader id="created_at" />,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(row.original.created_at)}
      </span>
    ),
  },
  {
    accessorKey: "updated_at",
    header: () => <ColumnHeader id="updated_at" />,
    cell: ({ row }) =>
      row.original.updated_at ? (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.original.updated_at)}
        </span>
      ) : (
        <Muted />
      ),
  },
  {
    id: "actions",
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => <ProductsRowActions product={row.original} />,
    size: 88,
    // Pinned to the right edge. With every column shown the row is wider than
    // the screen, and the actions are the one cell that must not be the thing
    // you have to scroll to find.
    //
    // It has to be opaque, or the columns slide visibly under it — and the
    // row's own hover tint is `bg-muted/60`, which is not. So the cell keeps
    // the opaque `bg-card` and the tint goes on a pseudo-element stacked over
    // it, which is the same colour the rest of the row lands on rather than an
    // opaque approximation of it.
    //
    // The leading edge only means something while a column is passing beneath
    // it, so it is dropped once `DataTable` reports the scroll is at its end
    // (or that there is nothing to scroll). Held there it reads as a seam down
    // a table that has nothing hidden.
    meta: {
      headClassName: cn(
        "sticky right-0 z-10 bg-muted shadow-[inset_1px_0_0_var(--border)]",
        "group-data-[scroll-end=true]/table:shadow-none",
      ),
      cellClassName: cn(
        "sticky right-0 z-10 bg-card shadow-[inset_1px_0_0_var(--border)]",
        "group-data-[scroll-end=true]/table:shadow-none",
        "after:pointer-events-none after:absolute after:inset-0 after:-z-10",
        "group-hover/row:after:bg-muted/60",
        "group-data-[state=selected]/row:after:bg-muted",
      ),
    },
  },
]

function ProductThumbnail({ src }: { src?: string | null }) {
  if (!src) {
    return (
      <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
        <ImageIcon className="size-4" />
      </div>
    )
  }
  // Plain <img> to avoid configuring remotePatterns for arbitrary backend URLs.
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
