"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { ChevronDownIcon, TagIcon } from "lucide-react"
import { sileo } from "sileo"
import { Button } from "@repo/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import {
  EXPORT_PRODUCTS_CSV,
  type ExportProductsCsvData,
} from "@/features/products/api"
import { downloadCsv } from "@/shared/lib/csv"
import { StoreImportBanner } from "@/features/products/components/import/store-import-banner"
import { AddProductButton } from "./add-product-button"

interface ProductsHeaderProps {
  totalCount: number
  /** Opens the import dialog, which `ProductsTable` mounts once. */
  onImportClick: () => void
  /**
   * The action cluster. Off on an empty catalogue, where the empty state
   * carries Add product and Import itself and the rest — a disabled Export, a
   * bulk edit with nothing to edit — would be furniture.
   */
  showActions?: boolean
}

/**
 * Export and Import are buttons rather than menu items.
 *
 * Both were behind "More actions", which is where an action goes when it is
 * rare or needs qualifying — and a catalogue's CSV round trip is neither. What
 * stays in the menu is bulk edit, which leaves this screen for another one.
 */
export function ProductsHeader({
  totalCount,
  onImportClick,
  showActions = true,
}: ProductsHeaderProps) {
  const t = useTranslations("products")
  const params = useParams<{ shopSlug: string }>()

  // The mutation returns the whole file inline rather than a signed URL —
  // see `ProductsCsvResolver`. That keeps the auth model to the same Bearer
  // token every other call uses, at the cost of holding the body in memory.
  const [exportCsv, { loading: exporting }] =
    useMutation<ExportProductsCsvData>(EXPORT_PRODUCTS_CSV)

  const handleExport = async () => {
    try {
      const { data } = await exportCsv({ variables: { input: {} } })
      const csv = data?.exportProductsCsv?.csv
      if (!csv) return
      const stamp = new Date().toISOString().slice(0, 10)
      downloadCsv(`products-${stamp}.csv`, csv)
    } catch (err) {
      sileo.error({
        title: t("list.exportFailed"),
        description: err instanceof Error ? err.message : t("list.tryAgain"),
      })
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TagIcon className="size-5 -rotate-90 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
        </div>
        {showActions && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={exporting || totalCount === 0}
              onClick={handleExport}
            >
              {t("list.export")}
            </Button>
            <Button variant="outline" size="sm" onClick={onImportClick}>
              {t("list.import")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={(triggerProps) => (
                  <Button variant="outline" size="sm" {...triggerProps}>
                    {t("list.moreActions")}
                    <ChevronDownIcon className="ms-1 size-3.5 opacity-60" />
                  </Button>
                )}
              />
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  render={
                    <Link
                      href={`/store/${params?.shopSlug ?? ""}/products/inventory/bulk`}
                    />
                  }
                >
                  {t("list.bulkEditInventory")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <AddProductButton />
          </div>
        )}
      </div>

      {/* A store import outlives this tab, so the list is where the way back
          to a running one lives. Renders nothing when there is none. */}
      <StoreImportBanner shopSlug={params?.shopSlug ?? ""} />
    </div>
  )
}
