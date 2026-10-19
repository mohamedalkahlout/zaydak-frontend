"use client"

import { useTranslations } from "next-intl"
import { type Table } from "@tanstack/react-table"
import type { Segment } from "@/features/segments/types"
import { DataTableToolbar } from "@/shared/components/data-table/data-table-card"
import { DataTableSearch } from "@/shared/components/data-table/data-table-search"

export function SegmentsToolbar({ table }: { table: Table<Segment> }) {
  const t = useTranslations("segments.table")
  const search = (table.getState().globalFilter as string) ?? ""

  return (
    <DataTableToolbar
      search={
        <DataTableSearch
          value={search}
          onChange={(value) => table.setGlobalFilter(value)}
          placeholder={t("searchPlaceholder")}
        />
      }
    />
  )
}
