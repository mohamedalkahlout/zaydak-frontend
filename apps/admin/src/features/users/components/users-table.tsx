"use client"

import { useEffect, useMemo, useState } from "react"
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

import { FORGET_PASSWORD, ME } from "@/features/auth/api"
import { UserRole } from "@/shared/api/generated/graphql"
import { FilterBar, type Filter } from "@/shared/components/filter-bar"
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
import { formatDate } from "@/shared/lib/format"
import { headerState, keepVisible, toggleId } from "@/shared/lib/selection"

import {
  DELETE_USER,
  RESTORE_USERS,
  SET_USERS_ACTIVE,
  USERS,
} from "../api"
import {
  NO_USERS_FILTER,
  toFilters,
  toQuery,
  usersFilterFields,
} from "../lib/filters"
import {
  accountStatus,
  canManage,
  canSendPasswordReset,
  resetIdentifier,
  selectableUsers,
  statusBadgeVariant,
  usersEligibleFor,
  type BulkKind,
  type UserRow,
} from "../types"
import { UserFormDialog } from "./user-form-dialog"

const PAGE_SIZE = 25

/** The five actions the confirm dialog stands in front of. */
type ActionKind = BulkKind | "resetPassword"

/** Bar order: the reversible pair, then restore, then the destructive one. */
const BULK_KINDS: readonly BulkKind[] = [
  "suspend",
  "activate",
  "restore",
  "delete",
]

/**
 * What the confirm dialog is standing in front of.
 *
 * `users` is always the full set the action will hit — one row from the menu,
 * or the eligible subset of a selection — so `runPending` builds its `ids` the
 * same way either way and the dialog can count them.
 */
interface PendingAction {
  kind: ActionKind
  /** Set only for a row action; its absence is what makes the copy bulk. */
  user?: UserRow
  users: UserRow[]
}

export function UsersTable() {
  const t = useTranslations("users")
  // The chip's condition is chrome rather than this screen's own vocabulary —
  // it reads the same on every list — so it comes from the namespace the rest
  // of the bar is already translated in.
  const tFilterBar = useTranslations("filterBar")
  const locale = useLocale()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  // The chips are the state and the query arguments are derived from them, not
  // the other way round. A freshly added chip carries no value yet, so a bar
  // fed an array rebuilt from `applied` would drop that chip on the render that
  // introduced it and the add-then-pick flow would never reach a value menu.
  const [filters, setFilters] = useState<Filter[]>(() =>
    toFilters(NO_USERS_FILTER),
  )
  const [editing, setEditing] = useState<UserRow | null>(null)
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

  const applied = useMemo(() => toQuery(filters), [filters])
  const filterFields = useMemo(
    () => usersFilterFields(t, { is: tFilterBar("is") }),
    [t, tFilterBar],
  )

  const { data: meData } = useQuery(ME)
  const actor = {
    id: meData?.me.data?.id,
    role: meData?.me.data?.role,
  }
  const isSuperAdmin = actor.role === UserRole.SuperAdmin

  const { data, loading, error, refetch } = useQuery(USERS, {
    variables: {
      page,
      limit: PAGE_SIZE,
      search: query || undefined,
      role: applied.role,
      status: applied.status,
    },
  })

  const [setUsersActive, { loading: settingActive }] =
    useMutation(SET_USERS_ACTIVE)
  const [restoreUsers, { loading: restoring }] = useMutation(RESTORE_USERS)
  const [deleteUser, { loading: deleting }] = useMutation(DELETE_USER)
  // Reused rather than invented: `AdminUpdateUserInput` carries no password by
  // design, so the safe equivalent of "reset this account's password" is the
  // account's own reset flow, triggered on its behalf. The operator never sees
  // a credential — a one-time code goes to the address on the account.
  const [forgetPassword, { loading: resetting }] = useMutation(FORGET_PASSWORD)
  const busy = settingActive || restoring || deleting || resetting

  const rows = data?.users.data ?? []
  const meta = data?.users.meta

  // Derived, not stored. A refetch or a page change can replace every row while
  // the selection still holds the old ids, and a bar acting on rows nobody can
  // see is how a bulk action hits the wrong accounts. Narrowing during render
  // means the count on the bar always matches the boxes that are ticked.
  const selectedIds = keepVisible(
    selected,
    rows.map((row) => row.id),
  )
  const selectedRows = rows.filter((row) => selectedIds.includes(row.id))
  const selectableIds = selectableUsers(rows, actor).map((row) => row.id)
  const selectAllState = headerState(selectedIds, selectableIds)

  /** A narrower filter can leave the current page past the end of the list. */
  const onFiltersChange = (next: Filter[]) => {
    setFilters(next)
    setPage(1)
    setSelected([])
  }

  const runPending = async () => {
    if (!pending) return
    const ids = pending.users.map((user) => user.id)
    try {
      switch (pending.kind) {
        case "suspend":
          await setUsersActive({ variables: { ids, is_active: false } })
          break
        case "activate":
          await setUsersActive({ variables: { ids, is_active: true } })
          break
        case "restore":
          await restoreUsers({ variables: { ids } })
          break
        case "delete":
          await deleteUser({ variables: { ids } })
          break
        case "resetPassword": {
          // Row-only, so there is exactly one. `canSendPasswordReset` already
          // refused rows with neither an email nor a phone.
          const identifier = resetIdentifier(pending.users[0])
          if (!identifier) return
          await forgetPassword({ variables: { input: { identifier } } })
          break
        }
      }
      setPending(null)
      setSelected([])
      await refetch()
      sileo.success({ title: t(`done.${pending.kind}`) })
    } catch (err) {
      // `forgetPassword` is throttled per IP (2/min, 5/15min), so a run of
      // resets from one console starts failing — the server's message says so.
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
                aria-label={t("searchPlaceholder")}
                className="w-full ps-9 sm:w-64"
              />
            </div>

            {/* Beside the search box rather than inside the bar's `leading`
                slot: the bar owns ArrowLeft/ArrowRight to rove between chip
                segments and calls `preventDefault()` on them, which would take
                the caret keys away from any input nested under it. */}
            <FilterBar
              fields={filterFields}
              value={filters}
              onChange={onFiltersChange}
            />
          </div>

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
              {/* Each button names the rows it would actually change, not the
                  selection's size: the states are mixed by construction, and a
                  Suspend that silently skipped nine of twelve rows would be
                  read as a failure. A kind with nothing to do is not offered. */}
              {BULK_KINDS.map((kind) => {
                const eligible = usersEligibleFor(kind, selectedRows)
                if (eligible.length === 0) return null
                return (
                  <Button
                    key={kind}
                    size="sm"
                    variant={kind === "delete" ? "destructive" : "outline"}
                    onClick={() => setPending({ kind, users: eligible })}
                  >
                    {t(`action.${kind}`)} ({eligible.length})
                  </Button>
                )
              })}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelected([])}
              >
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
                setSelected(
                  selectAllState === "all" ? [] : [...selectableIds],
                )
              }
            />
            <DataTableHead>{t("column.name")}</DataTableHead>
            <DataTableHead>{t("column.email")}</DataTableHead>
            <DataTableHead>{t("column.phone")}</DataTableHead>
            <DataTableHead>{t("column.role")}</DataTableHead>
            <DataTableHead>{t("column.status")}</DataTableHead>
            <DataTableHead>{t("column.created")}</DataTableHead>
            <DataTableHead className="w-12" />
          </DataTableHeader>
          <TableBody>
            {loading ? (
              <DataTableSkeletonRows columns={8} />
            ) : (
              rows.map((row) => {
                const state = accountStatus(row)
                const manageable = canManage(row, actor)
                const picked = selectedIds.includes(row.id)
                return (
                  <DataTableRow
                    key={row.id}
                    data-state={picked ? "selected" : undefined}
                  >
                    <DataTableSelectCell
                      checked={picked}
                      // The same rule as the row menu: a row nobody may act on
                      // must not be tickable, or "select all" would hand the
                      // bar a request the server refuses.
                      disabled={!manageable}
                      label={t("selection.selectRow", { name: row.name })}
                      onToggle={() => setSelected(toggleId(selected, row.id))}
                    />
                    <DataTableCell className="font-medium">
                      {row.name}
                    </DataTableCell>
                    <DataTableCell className="text-muted-foreground" dir="ltr">
                      {row.email ?? "—"}
                    </DataTableCell>
                    <DataTableCell className="text-muted-foreground" dir="ltr">
                      {row.phone ?? "—"}
                    </DataTableCell>
                    <DataTableCell>
                      <Badge variant="secondary">{t(`role.${row.role}`)}</Badge>
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
                              disabled={!manageable}
                              className="size-8 opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100 max-sm:opacity-100"
                            >
                              <MoreHorizontalIcon className="size-4" />
                            </Button>
                          )}
                        />
                        <DropdownMenuContent align="end">
                          {state === "deleted" ? (
                            <DropdownMenuItem
                              onClick={() =>
                                setPending({
                                  kind: "restore",
                                  user: row,
                                  users: [row],
                                })
                              }
                            >
                              {t("action.restore")}
                            </DropdownMenuItem>
                          ) : (
                            <>
                              <DropdownMenuItem onClick={() => setEditing(row)}>
                                {t("action.edit")}
                              </DropdownMenuItem>
                              {/* Offered only where it would do something:
                                  `forgetPassword` answers success for a
                                  suspended or deleted account and sends
                                  nothing, and an account with neither an email
                                  nor a phone has nowhere to receive a code. */}
                              {canSendPasswordReset(row, actor) ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setPending({
                                      kind: "resetPassword",
                                      user: row,
                                      users: [row],
                                    })
                                  }
                                >
                                  {t("action.resetPassword")}
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem
                                onClick={() =>
                                  setPending({
                                    kind:
                                      state === "active"
                                        ? "suspend"
                                        : "activate",
                                    user: row,
                                    users: [row],
                                  })
                                }
                              >
                                {state === "active"
                                  ? t("action.suspend")
                                  : t("action.activate")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() =>
                                  setPending({
                                    kind: "delete",
                                    user: row,
                                    users: [row],
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

      {creating || editing ? (
        <UserFormDialog
          user={editing}
          canAssignPrivilegedRoles={isSuperAdmin}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={() => {
            void refetch()
            sileo.success({ title: t(editing ? "done.edit" : "done.create") })
          }}
        />
      ) : null}

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
      >
        <DialogContent>
          <DialogHeader>
            {/* One row names the account; a selection names the count. The
                bodies differ too — "they can no longer sign in" is wrong copy
                for eleven accounts at once. */}
            <DialogTitle>
              {!pending
                ? ""
                : pending.user
                  ? t(`confirm.${pending.kind}.title`, {
                      name: pending.user.name,
                      identifier: resetIdentifier(pending.user) ?? "",
                    })
                  : t(`confirmBulk.${pending.kind}.title`, {
                      count: pending.users.length,
                    })}
            </DialogTitle>
            <DialogDescription>
              {!pending
                ? ""
                : pending.user
                  ? t(`confirm.${pending.kind}.body`, {
                      name: pending.user.name,
                      identifier: resetIdentifier(pending.user) ?? "",
                    })
                  : t(`confirmBulk.${pending.kind}.body`, {
                      count: pending.users.length,
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
