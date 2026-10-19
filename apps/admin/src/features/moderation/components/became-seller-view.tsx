"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { CheckIcon, ExternalLinkIcon, XIcon } from "lucide-react"
import { sileo } from "sileo"

import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
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

import {
  APPROVE_BECAME_SELLER,
  BECAME_SELLER_REQUESTS,
  REJECT_BECAME_SELLER,
} from "../api"
import {
  SELLER_STATUS_FILTERS,
  becameSellerBadgeVariant,
  type BecameSellerRow,
} from "../types"

const PAGE_SIZE = 15

export function BecameSellerView() {
  const t = useTranslations("moderation.sellerRequests")
  const locale = useLocale()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [actingRow, setActingRow] = useState<{
    row: BecameSellerRow
    action: "approve" | "reject"
  } | null>(null)

  const { data, loading, refetch } = useQuery(BECAME_SELLER_REQUESTS, {
    variables: {
      status: statusFilter === "all" ? undefined : statusFilter,
      page,
      limit: PAGE_SIZE,
    },
    fetchPolicy: "cache-and-network",
  })

  const [approveSeller, { loading: approving }] = useMutation(APPROVE_BECAME_SELLER)
  const [rejectSeller, { loading: rejecting }] = useMutation(REJECT_BECAME_SELLER)

  const requests: BecameSellerRow[] = data?.becameSellerRequests?.data ?? []
  const meta = data?.becameSellerRequests?.meta

  async function handleConfirmAction() {
    if (!actingRow) return
    const { row, action } = actingRow
    try {
      if (action === "approve") {
        await approveSeller({ variables: { id: row.id } })
        sileo.success({ title: t("toast.approved", { name: row.name || row.id }) })
      } else {
        await rejectSeller({ variables: { id: row.id } })
        sileo.success({ title: t("toast.rejected", { name: row.name || row.id }) })
      }
      setActingRow(null)
      refetch()
    } catch (err) {
      sileo.error({ title: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <div className="space-y-4">
      <DataTableToolbar>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t("filterStatus")}:</span>
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                if (val) {
                  setStatusFilter(val)
                  setPage(1)
                }
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SELLER_STATUS_FILTERS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`status.${s}`)}
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
            <DataTableHead>{t("column.applicant")}</DataTableHead>
            <DataTableHead>{t("column.phone")}</DataTableHead>
            <DataTableHead>{t("column.storeUrl")}</DataTableHead>
            <DataTableHead className="max-w-xs">{t("column.message")}</DataTableHead>
            <DataTableHead>{t("column.status")}</DataTableHead>
            <DataTableHead>{t("column.created")}</DataTableHead>
            <DataTableHead className="text-end">{t("column.actions")}</DataTableHead>
          </DataTableHeader>

          <TableBody>
            {loading && requests.length === 0 ? (
              <DataTableSkeletonRows columns={7} rows={6} />
            ) : requests.length === 0 ? (
              <DataTableEmpty colSpan={7}>{t("empty")}</DataTableEmpty>
            ) : (
              requests.map((item) => (
                <DataTableRow key={item.id}>
                  <DataTableCell>
                    <div className="font-medium text-sm">
                      {item.name || <span className="text-muted-foreground italic">—</span>}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {item.user_id}
                    </div>
                  </DataTableCell>
                  <DataTableCell className="text-xs" dir="ltr">
                    {item.phone || <span className="text-muted-foreground italic">—</span>}
                  </DataTableCell>
                  <DataTableCell className="text-xs">
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline font-mono"
                      >
                        {item.url}
                        <ExternalLinkIcon className="size-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground italic">—</span>
                    )}
                  </DataTableCell>
                  <DataTableCell className="max-w-xs truncate text-xs">
                    {item.message || <span className="text-muted-foreground italic">—</span>}
                  </DataTableCell>
                  <DataTableCell>
                    <Badge variant={becameSellerBadgeVariant(item.status)}>
                      {t(`status.${item.status.toLowerCase()}`)}
                    </Badge>
                  </DataTableCell>
                  <DataTableCell className="text-xs text-muted-foreground">
                    {formatDate(item.created_at, locale)}
                  </DataTableCell>
                  <DataTableCell className="text-end">
                    {item.status.toLowerCase() === "pending" ? (
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          onClick={() => setActingRow({ row: item, action: "approve" })}
                        >
                          <CheckIcon className="size-3.5" />
                          <span>{t("action.approve")}</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setActingRow({ row: item, action: "reject" })}
                        >
                          <XIcon className="size-3.5" />
                          <span>{t("action.reject")}</span>
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        {t("action.processed")}
                      </span>
                    )}
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

      {actingRow ? (
        <Dialog open onOpenChange={(open) => !open && setActingRow(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {actingRow.action === "approve"
                  ? t("confirm.approveTitle", { name: actingRow.row.name || actingRow.row.id })
                  : t("confirm.rejectTitle", { name: actingRow.row.name || actingRow.row.id })}
              </DialogTitle>
              <DialogDescription>
                {actingRow.action === "approve"
                  ? t("confirm.approveBody")
                  : t("confirm.rejectBody")}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setActingRow(null)}
                disabled={approving || rejecting}
              >
                {t("cancel")}
              </Button>
              <Button
                variant={actingRow.action === "approve" ? "default" : "destructive"}
                onClick={handleConfirmAction}
                disabled={approving || rejecting}
              >
                {approving || rejecting
                  ? t("processing")
                  : actingRow.action === "approve"
                    ? t("action.approve")
                    : t("action.reject")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}
