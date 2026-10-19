"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import type { Table } from "@tanstack/react-table"
import {
  ArrowUpDownIcon,
  Columns3Icon,
  EyeIcon,
  EyeOffIcon,
  GripVerticalIcon,
  LayoutListIcon,
} from "lucide-react"
import { Button } from "@repo/ui/components/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { Separator } from "@repo/ui/components/separator"
import { Switch } from "@repo/ui/components/switch"
import { cn } from "@/shared/lib/utils"
import type { Product, ProductSortBy } from "@/features/products/types"
import { PRODUCT_SORT_OPTIONS } from "@/features/products/lib/list/constants"

interface ProductsViewOptionsProps {
  table: Table<Product>
  sortBy: ProductSortBy
  onSortByChange: (value: ProductSortBy) => void
  dense: boolean
  onDenseChange: (value: boolean) => void
}

/**
 * The one control over how the list looks: what it is sorted by, how tall its
 * rows are, and which columns it carries in which order.
 *
 * It replaces the shared `DataTableViewOptions` for this screen only, and the
 * reason is sort. Sorting used to be a button in every sortable header driving
 * TanStack's client sort model — which reordered the rows on the current page
 * and nothing else, so on a paginated list "sort by price" meant "sort these
 * six". The sort that works is the back-end's, it is a single value, and a
 * single value belongs in one control rather than spread across seven headers.
 * Once sort lives here, columns may as well: both are answers to "what am I
 * looking at", and Shopify puts them in the same popover for that reason.
 *
 * Order is dragged, and also moved with the arrow keys while the grip has
 * focus — a list that can only be reordered by dragging cannot be reordered at
 * all without a mouse.
 */
export function ProductsViewOptions({
  table,
  sortBy,
  onSortByChange,
  dense,
  onDenseChange,
}: ProductsViewOptionsProps) {
  const t = useTranslations("products.list")
  const [dragging, setDragging] = useState<string | null>(null)

  // `select` (the checkbox) and `actions` (the row menu) are the fixed ends of
  // every row — they are chrome, not data — so they are filtered out here and
  // pinned back on in `setOrder`.
  const columns = table
    .getState()
    .columnOrder.filter((id) => id !== "select" && id !== "actions")
    .flatMap((id) => {
      const column = table.getColumn(id)
      return column && column.getCanHide() ? [column] : []
    })

  const setOrder = (ids: string[]) =>
    table.setColumnOrder(["select", ...ids, "actions"])

  const move = (id: string, toIndex: number) => {
    const ids = columns.map((c) => c.id)
    const from = ids.indexOf(id)
    if (from < 0 || toIndex < 0 || toIndex >= ids.length || from === toIndex) {
      return
    }
    ids.splice(toIndex, 0, ids.splice(from, 1)[0]!)
    setOrder(ids)
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("sortAndColumns")}
          >
            <Columns3Icon className="size-4" />
          </Button>
        }
      />
      <PopoverContent align="end" className="w-[290px] p-0">
        <div className="p-1.5">
          <PanelRow icon={ArrowUpDownIcon} label={t("sortBy")}>
            <Select
              value={sortBy}
              onValueChange={(v) => onSortByChange(v as ProductSortBy)}
            >
              <SelectTrigger
                size="sm"
                aria-label={t("sortBy")}
                className="h-7 border-0 bg-transparent px-2 text-sm font-medium shadow-none hover:bg-muted"
              >
                {/* Base UI renders the raw value unless given a child —
                    without this the row reads "NEWEST". */}
                <SelectValue>
                  {(value: ProductSortBy | null) =>
                    value ? t(`sort.${value}`) : ""
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent align="end" alignItemWithTrigger={false}>
                {PRODUCT_SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(`sort.${option.value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PanelRow>

          <PanelRow icon={LayoutListIcon} label={t("compactRows")}>
            <Switch
              checked={dense}
              onCheckedChange={onDenseChange}
              aria-label={t("compactRows")}
            />
          </PanelRow>
        </div>

        <Separator />

        <div className="px-3 pt-2.5 pb-1 text-xs font-medium text-muted-foreground">
          {t("columns")}
        </div>
        <ul className="p-1.5 pt-0">
          {columns.map((column, index) => {
            // A column with no message shows its raw id rather than a
            // missing-message warning — the test pins that none is missing.
            const label = t.has(`column.${column.id}`)
              ? t(`column.${column.id}`)
              : column.id
            const visible = column.getIsVisible()
            return (
              <li
                key={column.id}
                draggable
                onDragStart={(e) => {
                  setDragging(column.id)
                  e.dataTransfer.effectAllowed = "move"
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (dragging && dragging !== column.id) move(dragging, index)
                }}
                onDragEnd={() => setDragging(null)}
                className={cn(
                  "flex items-center gap-1 rounded-md pr-1 transition-colors",
                  dragging === column.id ? "bg-muted" : "hover:bg-muted/60",
                )}
              >
                <button
                  type="button"
                  aria-label={t("moveColumn", { label })}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp") {
                      e.preventDefault()
                      move(column.id, index - 1)
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault()
                      move(column.id, index + 1)
                    }
                  }}
                  className="flex h-8 cursor-grab items-center px-1.5 text-muted-foreground outline-none focus-visible:text-foreground"
                >
                  <GripVerticalIcon className="size-4" />
                </button>

                <span
                  className={cn(
                    "flex-1 truncate py-1.5 text-sm",
                    !visible && "text-muted-foreground",
                  )}
                >
                  {label}
                </span>

                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  aria-label={
                    visible
                      ? t("hideColumn", { label })
                      : t("showColumn", { label })
                  }
                  aria-pressed={visible}
                  onClick={() => column.toggleVisibility(!visible)}
                >
                  {visible ? (
                    <EyeIcon className="size-4" />
                  ) : (
                    <EyeOffIcon className="size-4 opacity-60" />
                  )}
                </Button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

function PanelRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 rounded-md py-1 pr-1 pl-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 text-sm">{label}</span>
      {children}
    </div>
  )
}
