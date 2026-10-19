"use client"

import { useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { ShieldAlertIcon } from "lucide-react"

import { Badge } from "@repo/ui/components/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { Table, TableBody } from "@repo/ui/components/table"

import {
  DataTableCard,
  DataTableCell,
  DataTableEmpty,
  DataTableFooter,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  DataTableSkeletonRows,
  DataTableToolbar,
} from "@/shared/components/data-table/data-table"
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination"
import { formatDate } from "@/shared/lib/format"

import { ABUSIVE_REPORTS } from "../api"
import { REPORT_MODEL_TYPES, type AbusiveReportRow } from "../types"

const PAGE_SIZE = 15

export function AbusiveReportsView() {
  const t = useTranslations("moderation.reports")
  const locale = useLocale()
  const [page, setPage] = useState(1)
  const [modelType, setModelType] = useState<string>("all")

  const { data, loading, refetch } = useQuery(ABUSIVE_REPORTS, {
    variables: {
      model_type: modelType === "all" ? undefined : modelType,
      page,
      limit: PAGE_SIZE,
    },
    fetchPolicy: "cache-and-network",
  })

  const reports: AbusiveReportRow[] = data?.abusiveReports?.data ?? []
  const meta = data?.abusiveReports?.meta

  return (
    <div className="space-y-4">
      <DataTableToolbar>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t("filterModel")}:</span>
            <Select
              value={modelType}
              onValueChange={(val) => {
                if (val) {
                  setModelType(val)
                  setPage(1)
                }
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_MODEL_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`models.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          {meta?.total ? t("total", { count: meta.total }) : null}
        </div>
      </DataTableToolbar>

      <DataTableCard>
        <Table>
          <DataTableHeader>
            <DataTableHead>{t("column.type")}</DataTableHead>
            <DataTableHead>{t("column.targetId")}</DataTableHead>
            <DataTableHead>{t("column.reporter")}</DataTableHead>
            <DataTableHead className="max-w-md">{t("column.message")}</DataTableHead>
            <DataTableHead>{t("column.created")}</DataTableHead>
          </DataTableHeader>

          <TableBody>
            {loading && reports.length === 0 ? (
              <DataTableSkeletonRows columns={5} rows={6} />
            ) : reports.length === 0 ? (
              <DataTableEmpty colSpan={5}>{t("empty")}</DataTableEmpty>
            ) : (
              reports.map((report) => (
                <DataTableRow key={report.id}>
                  <DataTableCell>
                    <Badge variant="outline">{report.model_type}</Badge>
                  </DataTableCell>
                  <DataTableCell className="font-mono text-xs text-muted-foreground">
                    {report.model_id}
                  </DataTableCell>
                  <DataTableCell className="font-mono text-xs text-muted-foreground">
                    {report.user_id}
                  </DataTableCell>
                  <DataTableCell className="max-w-md truncate text-sm">
                    {report.message || <span className="text-muted-foreground italic">—</span>}
                  </DataTableCell>
                  <DataTableCell className="text-xs text-muted-foreground">
                    {formatDate(report.created_at, locale)}
                  </DataTableCell>
                </DataTableRow>
              ))
            )}
          </TableBody>
        </Table>

        {meta && meta.total_pages > 1 ? (
          <DataTableFooter>
            <DataTablePagination
              page={meta.page}
              totalPages={meta.total_pages}
              onPageChange={setPage}
            />
          </DataTableFooter>
        ) : null}
      </DataTableCard>
    </div>
  )
}
