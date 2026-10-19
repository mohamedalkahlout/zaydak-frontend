"use client"

import { LayoutGridIcon, Columns3Icon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import type { FileTypeFacet, FilesView } from "@/features/files/types"
import { FILE_TYPE_FACETS } from "@/features/files/lib/list/constants"
import { useTranslations } from "next-intl"
import { DataTableToolbar } from "@/shared/components/data-table/data-table-card"
import { DataTableSearch } from "@/shared/components/data-table/data-table-search"
import {
  DataTableViewTab,
  DataTableViewTabs,
} from "@/shared/components/data-table/data-table-view-tabs"

interface FilesToolbarProps {
  search: string
  types?: FileTypeFacet[]
  view: FilesView
  onSearchChange: (value: string) => void
  onTypesChange: (value: FileTypeFacet[] | undefined) => void
  onViewChange: (value: FilesView) => void
}

/**
 * Same chrome as the other vendor lists: type views on the start edge, search
 * packed on the end, list/grid as the display control. Sorting stays on the
 * column headers.
 */
export function FilesToolbar({
  search,
  types,
  view,
  onSearchChange,
  onTypesChange,
  onViewChange,
}: FilesToolbarProps) {
  const t = useTranslations("files")
  const activeType = types?.[0] ?? "all"

  return (
    <DataTableToolbar
      leading={
        <DataTableViewTabs aria-label={t("toolbar.all")}>
          <DataTableViewTab
            selected={activeType === "all"}
            onClick={() => onTypesChange(undefined)}
          >
            {t("toolbar.all")}
          </DataTableViewTab>
          {FILE_TYPE_FACETS.map((facet) => (
            <DataTableViewTab
              key={facet.value}
              selected={activeType === facet.value}
              onClick={() => onTypesChange([facet.value])}
            >
              {t(facet.labelKey)}
            </DataTableViewTab>
          ))}
        </DataTableViewTabs>
      }
      search={
        <DataTableSearch
          value={search}
          onChange={onSearchChange}
          placeholder={t("toolbar.searchPlaceholder")}
        />
      }
      trailing={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onViewChange(view === "list" ? "grid" : "list")}
          aria-label={
            view === "list" ? t("toolbar.toGridView") : t("toolbar.toListView")
          }
          title={view === "list" ? t("toolbar.gridView") : t("toolbar.listView")}
        >
          {view === "list" ? (
            <LayoutGridIcon className="size-4" />
          ) : (
            <Columns3Icon className="size-4" />
          )}
        </Button>
      }
    />
  )
}
