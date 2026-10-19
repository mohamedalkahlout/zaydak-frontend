"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useMutation, useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { MoreHorizontalIcon, PlusIcon, SearchIcon } from "lucide-react"
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
import { Input } from "@repo/ui/components/input"
import { Table, TableBody } from "@repo/ui/components/table"

import {
  DataTableCard,
  DataTableCell,
  DataTableEmpty,
  DataTableFooter,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
  DataTableSelectCell,
  DataTableSelectHead,
  DataTableSelectionBar,
  DataTableSkeletonRows,
  DataTableToolbar,
} from "@/shared/components/data-table/data-table"
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination"
import { FilterBar, type Filter } from "@/shared/components/filter-bar"
import { formatDate } from "@/shared/lib/format"
import { headerState, keepVisible, toggleId } from "@/shared/lib/selection"

import {
  APPROVE_SHOP,
  DELETE_SHOP,
  DISAPPROVE_SHOP,
  RESTORE_SHOPS,
  SET_SHOPS_ACTIVE,
  SHOPS,
} from "../api"
import { shopFilterFields, toFilters, toQuery } from "../lib/filters"
import {
  shopStatus,
  shopsEligibleFor,
  statusBadgeVariant,
  type ShopBulkKind,
  type ShopRow,
} from "../types"
import { ShopFormDialog } from "./shop-form-dialog"

const PAGE_SIZE = 25

/** The six actions the confirm dialog stands in front of. */
type ActionKind =
  | "approve"
  | "disapprove"
  | "suspend"
  | "activate"
  | "delete"
  | "restore"

/**
 * What the selection bar offers — and what it deliberately does not.
 *
 * Approve, disapprove and delete take a single `slug`, not an id list, so a
 * bulk button behind them would be a loop of mutations with no transaction and
 * a half-applied outcome the moment one fails. They stay row actions.
 */
const BULK_KINDS: readonly ShopBulkKind[] = ["suspend", "activate", "restore"]

interface PendingAction {
  kind: ActionKind
  /** Set only for a row action; its absence is what makes the copy bulk. */
  shop?: ShopRow
  shops: ShopRow[]
}

export function ShopsTable() {
  const t = useTranslations("shops")
  // The chip's condition is chrome rather than this screen's own vocabulary —
  // it reads the same on every list — so it comes from the namespace the rest
  // of the bar is already translated in.
  const tFilterBar = useTranslations("filterBar")
  const locale = useLocale()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  // The chips are the state, and the query is derived from them — never the
  // other way round. A chip is added before it has a value, so a `value` read
  // back out of the query would drop it in the frame it appeared in and the
  // add-then-pick flow would never get as far as the pick.
  const [filters, setFilters] = useState<Filter[]>(() => toFilters({}))
  const [creating, setCreating] = useState(false)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [selected, setSelected] = useState<string[]>([])

  // Typing filters the list, but not on every keystroke — the query is a
  // server round trip with a `contains` scan behind it.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const fields = useMemo(
    () => shopFilterFields(t, { is: tFilterBar("is") }),
    [t, tFilterBar],
  )
  const applied = useMemo(() => toQuery(filters), [filters])

  const { data, loading, error, refetch } = useQuery(SHOPS, {
    variables: {
      page,
      limit: PAGE_SIZE,
      search: query || undefined,
      status: applied.status,
    },
  })

  const [setShopsActive, { loading: settingActive }] =
    useMutation(SET_SHOPS_ACTIVE)
  const [restoreShops, { loading: restoring }] = useMutation(RESTORE_SHOPS)
  const [approveShop, { loading: approving }] = useMutation(APPROVE_SHOP)
  const [disapproveShop, { loading: disapproving }] =
    useMutation(DISAPPROVE_SHOP)
  const [deleteShop, { loading: deleting }] = useMutation(DELETE_SHOP)
  const busy =
    settingActive || restoring || approving || disapproving || deleting

  const rows = data?.shops.data ?? []
  const meta = data?.shops.meta

  // Derived, not stored: a refetch or a page change can replace every row while
  // the selection still holds the old ids, and a bar acting on rows nobody can
  // see is how a bulk action hits the wrong shops.
  const selectedIds = keepVisible(
    selected,
    rows.map((row) => row.id),
  )
  const selectedRows = rows.filter((row) => selectedIds.includes(row.id))
  // Every row is selectable here: unlike `/users`, there is no "your own
  // account" rule and no privileged row a plain admin may not touch.
  const selectableIds = rows.map((row) => row.id)
  const selectAllState = headerState(selectedIds, selectableIds)

  /**
   * A narrower filter can leave the current page past the end of the list, and
   * a selection made under the old one acts on rows nobody can see any more.
   *
   * Both reset only when the query behind the bar actually moved. Every edit
   * on a chip comes through here — adding one, changing its field, removing an
   * unfinished one — and none of those narrows anything on its own; resetting
   * on each would throw an admin back to page one for opening a menu.
   */
  const onFiltersChange = (next: Filter[]) => {
    const narrowed = toQuery(next).status !== applied.status
    setFilters(next)
    if (narrowed) {
      setPage(1)
      setSelected([])
    }
  }

  const runPending = async () => {
    if (!pending) return
    const ids = pending.shops.map((shop) => shop.id)
    // The slug-keyed mutations are row actions only, so there is exactly one.
    const slug = pending.shop?.slug ?? ""
    try {
      switch (pending.kind) {
        case "approve":
          await approveShop({ variables: { slug } })
          break
        case "disapprove":
          await disapproveShop({ variables: { slug } })
          break
        case "suspend":
          await setShopsActive({ variables: { ids, is_active: false } })
          break
        case "activate":
          await setShopsActive({ variables: { ids, is_active: true } })
          break
        case "restore":
          await restoreShops({ variables: { ids } })
          break
        case "delete":
          await deleteShop({ variables: { slug } })
          break
      }
      setPending(null)
      setSelected([])
      await refetch()
      sileo.success({ title: t(`done.${pending.kind}`) })
    } catch (err) {
      sileo.error({
        title: t(`failed.${pending.kind}`),
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <PlusIcon className="size-4" />
          {t("new")}
        </Button>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      ) : null}

      <DataTableCard>
        <DataTableToolbar>
          {/* The search rides inside the bar rather than beside it: it is the
              other half of one question, and the bar wraps its chips onto a
              second line, which a sibling flex row would not follow. */}
          <FilterBar
            fields={fields}
            value={filters}
            onChange={onFiltersChange}
            className="gap-2"
            leading={
              <div className="relative w-full sm:w-auto">
                <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  aria-label={t("searchPlaceholder")}
                  className="w-full ps-9 sm:w-64"
                />
              </div>
            }
          />

          {meta ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              {t("total", { count: meta.total })}
            </p>
          ) : null}
        </DataTableToolbar>

        {selectedIds.length > 0 ? (
          <DataTableSelectionBar>
            <p className="text-xs font-medium tabular-nums">
              {t("selection.selected", { count: selectedIds.length })}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {/* Each button names the shops it would actually change: a
                  selection mixes live, suspended and deleted rows, and Suspend
                  on an already-suspended shop is a no-op the server would
                  perform without complaint. */}
              {BULK_KINDS.map((kind) => {
                const eligible = shopsEligibleFor(kind, selectedRows)
                if (eligible.length === 0) return null
                return (
                  <Button
                    key={kind}
                    size="sm"
                    variant="outline"
                    onClick={() => setPending({ kind, shops: eligible })}
                  >
                    {t(`action.${kind}`)} ({eligible.length})
                  </Button>
                )
              })}
              <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                {t("selection.clear")}
              </Button>
            </div>
          </DataTableSelectionBar>
        ) : null}

        <Table>
          <DataTableHeader>
            <DataTableSelectHead
              state={selectAllState}
              disabled={selectableIds.length === 0}
              label={t("selection.selectAll")}
              onToggle={() =>
                setSelected(selectAllState === "all" ? [] : [...selectableIds])
              }
            />
            <DataTableHead>{t("column.name")}</DataTableHead>
            <DataTableHead>{t("column.owner")}</DataTableHead>
            <DataTableHead>{t("column.products")}</DataTableHead>
            <DataTableHead>{t("column.orders")}</DataTableHead>
            <DataTableHead>{t("column.status")}</DataTableHead>
            <DataTableHead>{t("column.created")}</DataTableHead>
            <DataTableHead className="w-12" />
          </DataTableHeader>
          <TableBody>
            {loading ? (
              <DataTableSkeletonRows columns={8} />
            ) : (
              rows.map((row) => {
                const state = shopStatus(row)
                const picked = selectedIds.includes(row.id)
                return (
                  <DataTableRow
                    key={row.id}
                    data-state={picked ? "selected" : undefined}
                  >
                    <DataTableSelectCell
                      checked={picked}
                      label={t("selection.selectRow", { name: row.name })}
                      onToggle={() => setSelected(toggleId(selected, row.id))}
                    />
                    <DataTableCell>
                      <span className="font-medium">{row.name}</span>
                      <span
                        className="block text-xs text-muted-foreground"
                        dir="ltr"
                      >
                        {row.slug}
                      </span>
                    </DataTableCell>
                    <DataTableCell>
                      {row.owner ? (
                        <>
                          <span>{row.owner.name}</span>
                          <span
                            className="block text-xs text-muted-foreground"
                            dir="ltr"
                          >
                            {row.owner.email ?? "—"}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </DataTableCell>
                    {/* Counts are nullable Ints — the list omits them for a
                        caller the resolver will not count for. */}
                    <DataTableCell className="tabular-nums">
                      {row.products_count ?? "—"}
                    </DataTableCell>
                    <DataTableCell className="tabular-nums">
                      {row.orders_count ?? "—"}
                    </DataTableCell>
                    <DataTableCell>
                      <Badge variant={statusBadgeVariant(state)}>
                        {t(`status.${state}`)}
                      </Badge>
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
                              className="size-8 opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100 max-sm:opacity-100"
                            >
                              <MoreHorizontalIcon className="size-4" />
                            </Button>
                          )}
                        />
                        <DropdownMenuContent align="end">
                          {/* Read-only, and the only row action that is: the
                              addresses a shop answers at belong to the
                              merchant, so this looks and never writes. */}
                          <DropdownMenuItem
                            render={<Link href={`/shops/${row.id}/domains`} />}
                          >
                            {t("domains.action")}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {/* No Edit: there is no `adminUpdateShop`. A shop's
                              own settings are edited by its owner in the
                              vendor dashboard. */}
                          {state === "deleted" ? (
                            <DropdownMenuItem
                              onClick={() =>
                                setPending({
                                  kind: "restore",
                                  shop: row,
                                  shops: [row],
                                })
                              }
                            >
                              {t("action.restore")}
                            </DropdownMenuItem>
                          ) : (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  setPending({
                                    kind:
                                      state === "pending"
                                        ? "approve"
                                        : "disapprove",
                                    shop: row,
                                    shops: [row],
                                  })
                                }
                              >
                                {state === "pending"
                                  ? t("action.approve")
                                  : t("action.disapprove")}
                              </DropdownMenuItem>
                              {/* `is_active`, not the label: a pending shop
                                  reads as "pending" whichever way its switch
                                  is set, so the status cannot answer this. */}
                              <DropdownMenuItem
                                onClick={() =>
                                  setPending({
                                    kind: row.is_active
                                      ? "suspend"
                                      : "activate",
                                    shop: row,
                                    shops: [row],
                                  })
                                }
                              >
                                {row.is_active
                                  ? t("action.suspend")
                                  : t("action.activate")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() =>
                                  setPending({
                                    kind: "delete",
                                    shop: row,
                                    shops: [row],
                                  })
                                }
                              >
                                {t("action.delete")}
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </DataTableCell>
                  </DataTableRow>
                )
              })
            )}

            {!loading && !error && rows.length === 0 ? (
              <DataTableEmpty colSpan={8}>{t("empty")}</DataTableEmpty>
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
              onPageChange={(next) => {
                setPage(next)
                setSelected([])
              }}
              disabled={loading}
              previousLabel={t("previous")}
              nextLabel={t("next")}
            />
          </DataTableFooter>
        ) : null}
      </DataTableCard>

      {/* Always mounted (open toggles) so the drawer can play its open/close
          slide animation — base-ui only transitions a mounted popup. */}
      <ShopFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={() => {
          void refetch()
          sileo.success({ title: t("done.create") })
        }}
      />

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <DialogContent>
          <DialogHeader>
            {/* One row names the shop; a selection names the count. */}
            <DialogTitle>
              {!pending
                ? ""
                : pending.shop
                  ? t(`confirm.${pending.kind}.title`, {
                      name: pending.shop.name,
                    })
                  : t(`confirmBulk.${pending.kind}.title`, {
                      count: pending.shops.length,
                    })}
            </DialogTitle>
            <DialogDescription>
              {!pending
                ? ""
                : pending.shop
                  ? t(`confirm.${pending.kind}.body`)
                  : t(`confirmBulk.${pending.kind}.body`, {
                      count: pending.shops.length,
                    })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              {t("cancel")}
            </Button>
            <Button
              variant={pending?.kind === "delete" ? "destructive" : "default"}
              onClick={runPending}
              disabled={busy}
            >
              {busy ? t("saving") : t("confirmAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
