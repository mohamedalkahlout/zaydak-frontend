'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { useLocale, useTranslations } from 'next-intl'
import { MoreHorizontalIcon, PlusIcon } from 'lucide-react'
import { sileo } from 'sileo'

import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/dropdown-menu'
import { Table, TableBody } from '@repo/ui/components/table'

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
} from '@/shared/components/data-table/data-table'
import { DataTablePagination } from '@/shared/components/data-table/data-table-pagination'
import {
  bpsOf,
  toCents,
  formatAmountCents,
  formatBps,
} from '@/shared/lib/format'
import {
  COMMISSIONS,
  CREATE_COMMISSION,
  DELETE_COMMISSION,
  UPDATE_COMMISSION,
} from '../api'
import type { CommissionRow } from '../types'
import type { CommissionInput } from '../validations'
import { CommissionFormDialog } from './commission-form-dialog'

const PAGE_SIZE = 25

export function CommissionsTable() {
  const t = useTranslations('commissions')
  const locale = useLocale()

  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CommissionRow | null>(null)
  const [deleting, setDeleting] = useState<CommissionRow | null>(null)

  const { data, loading, error, refetch } = useQuery(COMMISSIONS, {
    variables: { page, limit: PAGE_SIZE },
  })

  const [createCommission, { loading: creating }] =
    useMutation(CREATE_COMMISSION)
  const [updateCommission, { loading: updating }] =
    useMutation(UPDATE_COMMISSION)
  const [deleteCommission, { loading: removing }] =
    useMutation(DELETE_COMMISSION)

  const rows = data?.commissions.data ?? []
  const meta = data?.commissions.meta

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (row: CommissionRow) => {
    setEditing(row)
    setFormOpen(true)
  }

  const onSubmit = async (values: CommissionInput) => {
    // The form collects human units — dollars and a percent. The API speaks
    // integer cents and basis points, so the conversion happens HERE, once, at
    // the network boundary. `toCents` / `bpsOf` round the way the server does, so a stray third decimal is snapped
    // to the nearest cent/bp rather than sent as a fraction the server rejects.
    //
    // `sub_level` and `description` are nullable on the back-end; an empty text
    // input must clear them, not write "".
    const shared = {
      level: values.level,
      sub_level: values.sub_level || null,
      description: values.description || null,
      language: values.language,
      min_balance_cents: toCents(values.min_balance),
      max_balance_cents:
        values.max_balance == null ? null : toCents(values.max_balance),
      commission_bps: bpsOf(values.commission),
    }

    try {
      if (editing) {
        await updateCommission({
          variables: { input: { id: editing.id, ...shared } },
        })
      } else {
        await createCommission({ variables: { input: shared } })
      }
      setFormOpen(false)
      await refetch()
      sileo.success({ title: editing ? t('updated') : t('created') })
    } catch (err) {
      sileo.error({
        title: t('saveFailed'),
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await deleteCommission({ variables: { id: deleting.id } })
      setDeleting(null)
      await refetch()
      sileo.success({ title: t('deleted') })
    } catch (err) {
      sileo.error({
        title: t('deleteFailed'),
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Button onClick={openCreate}>
          <PlusIcon className="size-4" />
          {t('create')}
        </Button>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      ) : null}

      <DataTableCard>
        {meta ? (
          <DataTableToolbar>
            <p className="text-xs text-muted-foreground tabular-nums">
              {t('total', { count: meta.total })}
            </p>
          </DataTableToolbar>
        ) : null}

        <Table>
          <DataTableHeader>
            <DataTableHead>{t('column.level')}</DataTableHead>
            <DataTableHead>{t('column.subLevel')}</DataTableHead>
            <DataTableHead className="text-end">
              {t('column.minBalance')}
            </DataTableHead>
            <DataTableHead className="text-end">
              {t('column.maxBalance')}
            </DataTableHead>
            <DataTableHead className="text-end">
              {t('column.commission')}
            </DataTableHead>
            <DataTableHead>{t('column.language')}</DataTableHead>
            <DataTableHead className="w-12" />
          </DataTableHeader>
          <TableBody>
            {loading ? (
              <DataTableSkeletonRows columns={7} />
            ) : (
              rows.map((row) => (
                <DataTableRow key={row.id}>
                  <DataTableCell className="font-medium">
                    {row.level}
                  </DataTableCell>
                  <DataTableCell className="text-muted-foreground">
                    {row.sub_level ?? '—'}
                  </DataTableCell>
                  <DataTableCell className="text-end tabular-nums">
                    {formatAmountCents(row.min_balance_cents, locale)}
                  </DataTableCell>
                  <DataTableCell className="text-end tabular-nums">
                    {row.max_balance_cents == null ? (
                      <span className="text-muted-foreground">
                        {t('noCeiling')}
                      </span>
                    ) : (
                      formatAmountCents(row.max_balance_cents, locale)
                    )}
                  </DataTableCell>
                  <DataTableCell className="text-end font-medium tabular-nums">
                    {t('percent', {
                      value: formatBps(row.commission_bps, locale),
                    })}
                  </DataTableCell>
                  <DataTableCell className="uppercase text-muted-foreground">
                    {row.language}
                  </DataTableCell>
                  <DataTableCell className="text-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={(triggerProps) => (
                          <Button
                            {...triggerProps}
                            variant="ghost"
                            size="icon"
                            aria-label={t('rowActions')}
                            className="size-8 opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100 max-sm:opacity-100"
                          >
                            <MoreHorizontalIcon className="size-4" />
                          </Button>
                        )}
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(row)}>
                          {t('edit')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleting(row)}
                        >
                          {t('delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </DataTableCell>
                </DataTableRow>
              ))
            )}

            {!loading && !error && rows.length === 0 ? (
              <DataTableEmpty colSpan={7}>{t('empty')}</DataTableEmpty>
            ) : null}
          </TableBody>
        </Table>

        {meta && meta.total_pages > 1 ? (
          <DataTableFooter>
            <p className="text-xs text-muted-foreground">
              {t('showing', {
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
              previousLabel={t('previous')}
              nextLabel={t('next')}
            />
          </DataTableFooter>
        ) : null}
      </DataTableCard>

      <CommissionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        commission={editing}
        saving={creating || updating}
        onSubmit={onSubmit}
      />

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirmDelete.title')}</DialogTitle>
            <DialogDescription>
              {deleting
                ? t('confirmDelete.body', { level: deleting.level })
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={removing}
            >
              {removing ? t('deleting') : t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
