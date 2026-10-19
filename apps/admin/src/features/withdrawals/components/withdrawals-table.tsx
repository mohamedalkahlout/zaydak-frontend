"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { MoreHorizontalIcon } from "lucide-react"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu"
import { Table, TableBody } from "@repo/ui/components/table"

import type { WithdrawalStatus } from "@/shared/api/generated/graphql"

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
import { FilterBar, type Filter } from "@/shared/components/filter-bar"
import { formatAmountCents, formatDate, shortId } from "@/shared/lib/format"
import {
  DELETE_WITHDRAWAL,
  UPDATE_WITHDRAWAL_STATUS,
  WITHDRAWALS,
} from "../api"
import { toFilters, toQuery, withdrawalFilterFields } from "../lib/filters"
import {
  availableTransitions,
  canDelete,
  moneyEffect,
  statusBadgeVariant,
} from "../status"

const PAGE_SIZE = 25

/** A status change staged for confirmation — money moves, so never one-click. */
interface PendingTransition {
  id: string
  from: WithdrawalStatus
  to: WithdrawalStatus
  amount_cents: number
}

export function WithdrawalsTable() {
  const t = useTranslations("withdrawals")
  // The chip's condition is chrome rather than this screen's own vocabulary —
  // it reads the same on every list — so it comes from the namespace the rest
  // of the bar is already translated in.
  const tFilterBar = useTranslations("filterBar")
  const locale = useLocale()

  // The chips are the filter state and the query variables are derived from
  // them, never the other way round: a chip is added before it has a value, so
  // a `value` rebuilt from the applied status would drop it in the same frame
  // it appeared and there would be nothing left to pick a status on. The list
  // opens unfiltered, which is the query with no `status` at all.
  const [filters, setFilters] = useState<Filter[]>(() => toFilters({}))
  const [page, setPage] = useState(1)
  const [transition, setTransition] = useState<PendingTransition | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const applied = useMemo(() => toQuery(filters), [filters])

  const fields = useMemo(
    () =>
      withdrawalFilterFields({
        field: t("column.status"),
        is: tFilterBar("is"),
        status: (value) => t(`status.${value}`),
      }),
    [t, tFilterBar],
  )

  const { data, loading, error, refetch } = useQuery(WITHDRAWALS, {
    variables: {
      page,
      limit: PAGE_SIZE,
      status: applied.status,
    },
  })

  const [updateStatus, { loading: updating }] = useMutation(
    UPDATE_WITHDRAWAL_STATUS,
  )
  const [deleteWithdrawal, { loading: removing }] = useMutation(DELETE_WITHDRAWAL)

  const rows = data?.withdrawals.data ?? []
  const meta = data?.withdrawals.meta

  const onFiltersChange = (next: Filter[]) => {
    setFilters(next)
    // The page reset the old `Select` did, kept: a narrower filter can leave
    // the current page past the end. It is the derived query that is compared
    // rather than the chips themselves, because most edits on the bar — adding
    // a chip, opening its menu, changing its field — narrow nothing until a
    // value is picked, and sending the reader back to page one for an edit the
    // server never sees would lose their place for nothing.
    if (toQuery(next).status !== applied.status) setPage(1)
  }

  const confirmTransition = async () => {
    if (!transition) return
    try {
      await updateStatus({
        variables: { input: { id: transition.id, status: transition.to } },
      })
      setTransition(null)
      await refetch()
      sileo.success({ title: t("statusUpdated") })
    } catch (err) {
      sileo.error({
        title: t("statusUpdateFailed"),
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await deleteWithdrawal({ variables: { id: deleting } })
      setDeleting(null)
      await refetch()
      sileo.success({ title: t("deleted") })
    } catch (err) {
      sileo.error({
        title: t("deleteFailed"),
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h1 className="font-heading text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      ) : null}

      <DataTableCard>
        <DataTableToolbar>
          <FilterBar
            fields={fields}
            value={filters}
            onChange={onFiltersChange}
          />

          {meta ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              {t("total", { count: meta.total })}
            </p>
          ) : null}
        </DataTableToolbar>

        <Table>
          <DataTableHeader>
            <DataTableHead>{t("column.amount")}</DataTableHead>
            <DataTableHead>{t("column.status")}</DataTableHead>
            <DataTableHead>{t("column.paymentMethod")}</DataTableHead>
            <DataTableHead>{t("column.shop")}</DataTableHead>
            <DataTableHead>{t("column.requested")}</DataTableHead>
            <DataTableHead className="w-12" />
          </DataTableHeader>
          <TableBody>
            {loading ? (
              <DataTableSkeletonRows columns={6} />
            ) : (
              rows.map((row) => (
                <DataTableRow key={row.id}>
                  <DataTableCell className="font-medium tabular-nums">
                    {formatAmountCents(row.amount_cents, locale)}
                  </DataTableCell>
                  <DataTableCell>
                    <Badge variant={statusBadgeVariant(row.status)}>
                      {t(`status.${row.status}`)}
                    </Badge>
                  </DataTableCell>
                  <DataTableCell>{row.payment_method ?? "—"}</DataTableCell>
                  <DataTableCell className="font-mono text-xs text-muted-foreground">
                    {row.shop_id ? shortId(row.shop_id) : "—"}
                  </DataTableCell>
                  <DataTableCell className="text-muted-foreground">
                    {formatDate(row.created_at, locale)}
                  </DataTableCell>
                  <DataTableCell className="text-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={(triggerProps) => (
                          <Button
                            {...triggerProps}
                            variant="ghost"
                            size="icon"
                            aria-label={t("rowActions")}
                            // Revealed on row hover, like the vendor lists —
                            // always visible on touch, where there is no hover.
                            className="size-8 opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100 max-sm:opacity-100"
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </Button>
                        )}
                      />
                      <DropdownMenuContent align="end">
                        {availableTransitions(row.status).map((next) => (
                          <DropdownMenuItem
                            key={next}
                            onClick={() =>
                              setTransition({
                                id: row.id,
                                from: row.status,
                                to: next,
                                amount_cents: row.amount_cents,
                              })
                            }
                          >
                            {t("markAs", { status: t(`status.${next}`) })}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={!canDelete(row.status)}
                          onClick={() => setDeleting(row.id)}
                        >
                          {t("delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </DataTableCell>
                </DataTableRow>
              ))
            )}

            {!loading && !error && rows.length === 0 ? (
              <DataTableEmpty colSpan={6}>{t("empty")}</DataTableEmpty>
            ) : null}
          </TableBody>
        </Table>

        {meta && meta.total_pages > 1 ? (
          <DataTableFooter>
            <p className="text-xs text-muted-foreground">
              {t("showing", {
                from: (meta.page - 1) * meta.limit + 1,
                to: Math.min(meta.page * meta.limit, meta.total),
                total: meta.total,
              })}
            </p>
            <DataTablePagination
              page={meta.page}
              totalPages={meta.total_pages}
              onPageChange={setPage}
              disabled={loading}
              previousLabel={t("previous")}
              nextLabel={t("next")}
            />
          </DataTableFooter>
        ) : null}
      </DataTableCard>

      <Dialog
        open={transition !== null}
        onOpenChange={(open) => !open && setTransition(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {transition
                ? t("confirmStatus.title", {
                    status: t(`status.${transition.to}`),
                  })
                : ""}
            </DialogTitle>
            <DialogDescription>
              {transition
                ? t(`confirmStatus.${moneyEffect(transition.from, transition.to)}`, {
                    amount: formatAmountCents(transition.amount_cents, locale),
                  })
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransition(null)}>
              {t("cancel")}
            </Button>
            <Button onClick={confirmTransition} disabled={updating}>
              {updating ? t("saving") : t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirmDelete.title")}</DialogTitle>
            <DialogDescription>{t("confirmDelete.body")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={removing}
            >
              {removing ? t("deleting") : t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
