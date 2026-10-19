"use client"

import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import type { Table } from "@tanstack/react-table"
import { ChevronDownIcon } from "lucide-react"
import { sileo } from "sileo"
import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { BULK_UPDATE_PRODUCTS_STATUS } from "@/features/products/api"
import type { Product, ProductStatus } from "@/features/products/types"
import { PRODUCT_STATUS_CHOICES } from "@/features/products/validations/product"

interface BulkUpdateData {
  bulkUpdateProductsStatus: { success: boolean; updated: number }
}

/**
 * Selection bar that appears once any rows are checked. Mirrors Shopify's
 * "X selected" affordance: a count + dropdown of safe bulk actions.
 *
 * Restricted to status flips — bulk edits to price / qty / etc. raise
 * validation questions that deserve their own dedicated mutations and UI
 * surface. The three items are the three statuses, same order and same labels
 * as the status cell and the product form.
 */
export function ProductsBulkActions({
  table,
  selectedRows,
}: {
  table: Table<Product>
  selectedRows: Product[]
}) {
  const t = useTranslations("products.bulkActions")
  const tStatus = useTranslations("products.status")
  const [bulkUpdate, { loading }] = useMutation<BulkUpdateData>(
    BULK_UPDATE_PRODUCTS_STATUS,
    { refetchQueries: "active" },
  )

  const ids = selectedRows.map((p) => p.id)

  const apply = async (status: ProductStatus) => {
    try {
      const { data } = await bulkUpdate({ variables: { ids, status } })
      const updated = data?.bulkUpdateProductsStatus?.updated ?? 0
      sileo.success({
        title: t("setTo", { status: tStatus(status) }),
        description:
          updated === ids.length
            ? t("updated", { count: updated })
            : t("partial", { updated, total: ids.length }),
      })
      table.resetRowSelection()
    } catch (err) {
      sileo.error({
        title: t("failed"),
        description: err instanceof Error ? err.message : t("tryAgain"),
      })
    }
  }

  return (
    <div className="flex items-center justify-between border-b border-border px-3 py-2.5 text-sm">
      <span>
        {t.rich("selected", {
          count: selectedRows.length,
          b: (chunks) => <span className="font-medium">{chunks}</span>,
        })}
      </span>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(p) => (
              <Button
                {...p}
                variant="outline"
                size="sm"
                className="h-8"
                disabled={loading || ids.length === 0}
              >
                {t("open")}
                <ChevronDownIcon className="ml-1 size-3.5 opacity-60" />
              </Button>
            )}
          />
          <DropdownMenuContent align="end" className="w-48">
            {PRODUCT_STATUS_CHOICES.map((choice) => (
              <DropdownMenuItem
                key={choice.value}
                onClick={() => apply(choice.value)}
              >
                {t(`setAs.${choice.value}`)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => table.resetRowSelection()}
        >
          {t("clearSelection")}
        </Button>
      </div>
    </div>
  )
}
