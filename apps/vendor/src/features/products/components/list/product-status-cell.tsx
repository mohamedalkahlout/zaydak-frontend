"use client"

import { useCallback, useState } from "react"
import { useTranslations } from "next-intl"
import { useMutation } from "@apollo/client/react"
import { LoaderCircleIcon } from "lucide-react"
import { sileo } from "sileo"
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { cn } from "@/shared/lib/utils"
import { BULK_UPDATE_PRODUCTS_STATUS } from "@/features/products/api"
import type { Product, ProductStatus } from "@/features/products/types"
import { STATUS_STYLE } from "@/features/products/lib/list/constants"
import { ProductStatusOptions } from "@/features/products/components/product-status-options"

interface BulkUpdateData {
  bulkUpdateProductsStatus: { success: boolean; updated: number }
}

/**
 * The status column, editable in place.
 *
 * It was a read-only pill, so changing one product's status meant opening its
 * edit page, changing a select, saving, and coming back — four navigations to
 * write one enum. The pill is now the trigger of a select carrying the same
 * three choices the form does, from the same component.
 *
 * **This writes immediately, and it is the one table cell that does.** The
 * dashboard's rule is that edit screens stage locally behind the save bar
 * (`AGENTS.md`); that rule is about forms, where a dozen fields are edited
 * together and a half-applied save is a real state. A status flip is one field
 * with three values and no partner field to be inconsistent with, so it writes
 * on pick and confirms with a toast.
 *
 * The pill carries no chevron and no status dot: a chevron on every row turns
 * a column of statuses into a column of dropdowns, and a dot inside a tinted
 * pill states the hue twice. What signals that it is a control is a ring on
 * hover, which costs nothing at rest — and while a write is in flight the
 * label is joined by a spinner, so the row says "working" rather than only
 * dimming.
 *
 * `optimistic` holds the value between the click and the refetch landing, so
 * the pill changes under the cursor instead of after a round trip.
 */
export function ProductStatusCell({ product }: { product: Product }) {
  const tList = useTranslations("products.list")
  const tStatus = useTranslations("products.status")
  const [optimistic, setOptimistic] = useState<ProductStatus | null>(null)
  const [bulkUpdate, { loading }] = useMutation<BulkUpdateData>(
    BULK_UPDATE_PRODUCTS_STATUS,
    { refetchQueries: "active" },
  )

  // Adjust-during-render rather than an effect: once the refetch has landed
  // and the row agrees with us, the local override has nothing left to say and
  // holding it would mask the next change made from anywhere else.
  if (optimistic !== null && optimistic === product.status) setOptimistic(null)

  const current = optimistic ?? product.status

  const change = useCallback(
    async (next: ProductStatus) => {
      setOptimistic(next)
      try {
        const { data } = await bulkUpdate({
          variables: { ids: [product.id], status: next },
        })
        if (!data?.bulkUpdateProductsStatus?.updated) {
          throw new Error(tList("notUpdated"))
        }
        sileo.success({
          title: tList("statusSetTo", { label: tStatus(next) }),
        })
      } catch (err) {
        setOptimistic(null)
        sileo.error({
          title: tList("changeFailed"),
          description:
            err instanceof Error ? err.message : tList("tryAgain"),
        })
      }
    },
    [bulkUpdate, product.id, tList, tStatus],
  )

  return (
    <Select
      value={current}
      onValueChange={(v) => {
        const next = v as ProductStatus
        if (next === current) return
        void change(next)
      }}
      disabled={loading}
    >
      <SelectTrigger
        aria-label={tList("column.status")}
        size="sm"
        className={cn(
          // Height and radius carry the `data-[size]` variant that
          // `SelectTrigger` sets its own defaults with. Written plain, they
          // lose to it on specificity and the pill silently renders at the
          // control height instead of the row height.
          "data-[size=sm]:h-6.5 data-[size=sm]:rounded-md",
          "border-0 px-2.5 py-0 text-xs font-medium shadow-none",
          // `SelectTrigger` always renders a chevron. This is the one place
          // that does not want one — see the note above the component.
          "[&>svg]:hidden",
          // A hairline ring that only appears on hover or while open: enough to
          // say "this is a control" under the cursor, quiet enough that a
          // column of twenty rows is not twenty outlined boxes.
          "ring-1 ring-transparent transition-[box-shadow,opacity] ring-inset",
          "hover:ring-foreground/15 data-[popup-open]:ring-foreground/25",
          // The spinner already says "busy"; the default disabled fade on top
          // of it just makes the row hard to read.
          "disabled:cursor-wait disabled:opacity-100",
          STATUS_STYLE[current],
        )}
      >
        <SelectValue>
          {(value: ProductStatus | null) => (
            <span className="flex items-center gap-1.5">
              {tStatus(value ?? "DRAFT")}
              {loading && (
                <LoaderCircleIcon className="size-2.5 animate-spin opacity-70" />
              )}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        // Anchored to the pill's leading edge rather than centred on it, so the
        // popup grows away from the columns beside it instead of over them.
        align="start"
        sideOffset={6}
        alignItemWithTrigger={false}
        className="w-80"
      >
        <ProductStatusOptions />
      </SelectContent>
    </Select>
  )
}
