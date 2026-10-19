"use client"

import { useEffect, useMemo, useState } from "react"
import { useApolloClient, useMutation, useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import {
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  Loader2Icon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react"
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
import { Input } from "@repo/ui/components/input"
import { Table, TableBody } from "@repo/ui/components/table"

import { ME } from "@/features/auth/api"
import { UserRole } from "@/shared/api/generated/graphql"
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
import { downloadCsv, toCsv } from "@/shared/lib/csv"
import { formatDateTime } from "@/shared/lib/format"

import { OTP_LOGS, REVEAL_OTP_CODE } from "../api"
import { otpLogCsvRows, otpLogsFileName } from "../export"
import {
  oneChipPerField,
  otpLogFilterFields,
  toOtpLogFilters,
  toOtpLogQuery,
} from "../lib/filters"
import {
  OTP_RETENTION_DAYS,
  earliestSelectableDate,
  endOfDayIso,
  isValidRange,
  latestSelectableDate,
  startOfDayIso,
} from "../range"
import {
  attemptsLabel,
  isRevealable,
  statusBadgeVariant,
  verifierLabel,
  type OtpLogRow,
} from "../types"

const PAGE_SIZE = 25

/** `clampLimit` refuses anything above this, so asking for more just wastes a round trip. */
const EXPORT_PAGE_SIZE = 100

/**
 * The export's ceiling, in pages — 5,000 rows.
 *
 * A whole-set export is N/100 round trips, and this screen is filtered by an
 * operator chasing one complaint, not by a reporting job. Past this the button
 * stops and says so rather than holding the tab open for a minute; narrowing
 * the date range is the answer, which is why the range control landed with it.
 */
const EXPORT_MAX_PAGES = 50

/**
 * Every one-time code the platform has issued, newest first.
 *
 * Read-only by construction: there is no action to offer on a code that has
 * already been sent — revoking one would mean deleting the row the log exists to
 * show. What an operator does here is answer "did the code reach them, and what
 * happened to it", so the screen is a filter and a timestamp.
 *
 * `cache-and-network` because this is a log: a cached page from two minutes ago
 * is exactly the wrong answer to "did the code they just asked for go out".
 *
 * The one thing it can do is **show a live code to a `super_admin`** — the
 * support path for "the code never reached me". The button is offered only on
 * `PENDING` rows and only to that role, mirroring what the server enforces, and
 * every reveal lands in the audit log with the caller's name on it.
 */
export function OtpLogsTable() {
  const t = useTranslations("otpLogs")
  // The chip's condition is chrome rather than this screen's own vocabulary —
  // it reads the same on every list — so it comes from the namespace the rest
  // of the bar is already translated in.
  const tFilterBar = useTranslations("filterBar")
  const locale = useLocale()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [query, setQuery] = useState("")
  // The bar owns the two enum filters, and its array is the state rather than
  // something derived from a `purpose`/`status` pair on every render: a chip
  // that has just been added holds no value yet, so a derived array would drop
  // it the instant it appeared and there would be nothing left to pick a value
  // on. The screen starts unfiltered — no filter is read from the URL — so this
  // is empty today, built through `toOtpLogFilters` so that seeding the bar
  // from a link stays a one-line change.
  const [filterChips, setFilterChips] = useState<Filter[]>(() =>
    toOtpLogFilters({ purpose: undefined, status: undefined }),
  )
  const applied = useMemo(() => toOtpLogQuery(filterChips), [filterChips])
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [exporting, setExporting] = useState(false)
  const [revealed, setRevealed] = useState<{
    row: OtpLogRow
    code: string
  } | null>(null)

  // Anchored in state rather than read during render: `new Date()` in a render
  // body is impure, and these two bound the pickers on every keystroke.
  const [now] = useState(() => new Date())
  const rangeValid = isValidRange(from, to)

  // Typing filters the list, but not on every keystroke — the query is a
  // server round trip with a `contains` scan behind it.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  // Only a `super_admin` may reveal, so the button is not rendered for anyone
  // else. `me` is the only place the console knows its own role from — the auth
  // store holds tokens and nothing else.
  const { data: meData } = useQuery(ME)
  const isSuperAdmin = meData?.me.data?.role === UserRole.SuperAdmin

  // Everything but `page` and `limit`, so the export can re-run the exact
  // filter the screen is showing without restating it.
  const filters = {
    search: query || undefined,
    purpose: applied.purpose,
    status: applied.status,
    // A date-only input means the whole of that local day, both ends inclusive.
    from: rangeValid && from ? startOfDayIso(from) : undefined,
    to: rangeValid && to ? endOfDayIso(to) : undefined,
  }

  const { data, loading, error, refetch } = useQuery(OTP_LOGS, {
    variables: { page, limit: PAGE_SIZE, ...filters },
    fetchPolicy: "cache-and-network",
    skip: !rangeValid,
  })

  // The id is tracked here rather than read off the mutation result: the
  // recovery can take a couple of seconds, and only the row that was clicked
  // should show the spinner.
  const [revealingId, setRevealingId] = useState<string | null>(null)
  const [revealOtpCode] = useMutation(REVEAL_OTP_CODE)

  // The export runs the same document page by page, outside the hook's own
  // subscription — the screen must keep showing page 1 while it does.
  const client = useApolloClient()

  const rows = rangeValid ? (data?.otpLogs.data ?? []) : []
  const meta = rangeValid ? data?.otpLogs.meta : undefined
  const deliveryErrors = rangeValid ? (data?.otpDeliveryErrorGroups ?? []) : []
  const columnCount = isSuperAdmin ? 9 : 8

  /** A narrower filter can leave the current page past the end of the list. */
  const onFilterChange = (apply: () => void) => {
    apply()
    setPage(1)
  }

  const filterFields = useMemo(
    () =>
      otpLogFilterFields({
        // The table's own column headers, so a chip names the column it narrows
        // rather than introducing a second word for the same thing.
        field: { purpose: t("column.purpose"), status: t("column.status") },
        is: tFilterBar("is"),
        purpose: (p) => t(`purpose.${p}`),
        status: (s) => t(`status.${s}`),
      }),
    [t, tFilterBar],
  )

  /**
   * The bar hands back its whole array on every edit.
   *
   * The page is reset only when the derived query actually moves, unlike
   * `onFilterChange` above: adding a chip or reopening its menu narrows
   * nothing until a value is picked, and jumping back to page 1 on a click
   * that changed no rows would lose the operator's place for nothing.
   */
  const onFiltersChange = (next: Filter[]) => {
    const kept = oneChipPerField(next)
    const nextQuery = toOtpLogQuery(kept)
    setFilterChips(kept)
    if (
      nextQuery.purpose !== applied.purpose ||
      nextQuery.status !== applied.status
    ) {
      setPage(1)
    }
  }

  const reveal = async (row: OtpLogRow) => {
    setRevealingId(row.id)
    try {
      const { data } = await revealOtpCode({ variables: { id: row.id } })
      const code = data?.revealOtpCode.data?.code
      if (code) setRevealed({ row, code })
    } catch (err) {
      // The row may have been used or expired between the render and the click,
      // which the server refuses — the message says which.
      sileo.error({
        title: t("revealFailed"),
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setRevealingId(null)
    }
  }

  const copyCode = async () => {
    if (!revealed) return
    await navigator.clipboard.writeText(revealed.code)
    sileo.success({ title: t("copied") })
  }

  /**
   * Exports the **whole filtered set**, not the page on screen.
   *
   * That is the decision this button is built around, and the label carries it:
   * it reads "Export all 4,132 rows", from `meta.total`, so nobody clicks it
   * expecting the twenty-five rows in front of them. The server clamps `limit`
   * at 100, so the whole set is `total_pages` round trips at that size, capped
   * at `EXPORT_MAX_PAGES`; past the cap the file still downloads, with a toast
   * saying it was cut short and to narrow the dates.
   *
   * `no-cache` because thousands of log rows have no business landing in the
   * Apollo cache — they would evict the pages the screen is actually using.
   */
  const runExport = async () => {
    setExporting(true)
    try {
      const collected: OtpLogRow[] = []
      let pages = 1
      let capped = false

      for (let p = 1; p <= EXPORT_MAX_PAGES && p <= pages; p++) {
        const { data: pageData } = await client.query({
          query: OTP_LOGS,
          variables: {
            page: p,
            limit: EXPORT_PAGE_SIZE,
            ...filters,
            includeDeliveryErrors: false,
          },
          fetchPolicy: "no-cache",
        })
        if (!pageData?.otpLogs.success || !pageData.otpLogs.meta) {
          throw new Error(t("exportFailed"))
        }
        collected.push(...(pageData?.otpLogs.data ?? []))
        pages = pageData?.otpLogs.meta?.total_pages ?? 1
        if (p === EXPORT_MAX_PAGES && pages > EXPORT_MAX_PAGES) capped = true
      }

      if (collected.length === 0) {
        sileo.error({ title: t("exportEmpty") })
        return
      }

      const rows = otpLogCsvRows(
        collected,
        {
          columns: {
            sent: t("column.sent"),
            identifier: t("column.identifier"),
            account: t("column.account"),
            purpose: t("column.purpose"),
            status: t("column.status"),
            attempts: t("column.attempts"),
            delivery: t("column.delivery"),
            deliveryError: t("column.deliveryError"),
            verified: t("column.verified"),
            expires: t("column.expires"),
          },
          purpose: (p) => t(`purpose.${p}`),
          status: (s) => t(`status.${s}`),
          delivery: (state) => t(`delivery.${state}`),
          none: t("noAccount"),
        },
        locale,
      )

      downloadCsv(otpLogsFileName(from, to, now), toCsv(rows))
      sileo.success({ title: t("exported", { count: collected.length }) })
      if (capped) {
        sileo.error({ title: t("exportCapped", { count: collected.length }) })
      }
    } catch (err) {
      sileo.error({
        title: t("exportFailed"),
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* The count is on the button, not in a tooltip: a button that
              silently exported 25 of 4,132 rows would be worse than none. */}
          <Button
            variant="outline"
            onClick={() => void runExport()}
            disabled={
              exporting ||
              loading ||
              !!error ||
              search.trim() !== query ||
              !rangeValid ||
              !meta ||
              meta.total === 0
            }
          >
            {exporting ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <DownloadIcon className="size-4" />
            )}
            {exporting
              ? t("exporting")
              : t("export", { count: meta?.total ?? 0 })}
          </Button>
          <Button
            variant="outline"
            onClick={() => void refetch()}
            disabled={loading || !rangeValid}
          >
            <RefreshCwIcon className="size-4" />
            {t("refresh")}
          </Button>
        </div>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      ) : null}

      <DataTableCard>
        <DataTableToolbar>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
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

              {/* Purpose and status are chips rather than two always-present
                selects: an unfiltered log now says so by showing nothing, where
                a pair of "All purposes" / "All statuses" boxes read as settings
                that had been chosen. */}
              <FilterBar
                fields={filterFields}
                value={filterChips}
                onChange={onFiltersChange}
              />

              {/* Native date inputs, not a calendar popover: the only dependency
                that would add is `react-day-picker`, which nothing else in this
                console uses, and `min`/`max` are exactly the bound we need. */}
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={from}
                  min={earliestSelectableDate(now)}
                  max={latestSelectableDate(now)}
                  onChange={(e) =>
                    onFilterChange(() => setFrom(e.target.value))
                  }
                  aria-label={t("range.from")}
                  title={t("range.from")}
                  className="w-40"
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="date"
                  value={to}
                  min={earliestSelectableDate(now)}
                  max={latestSelectableDate(now)}
                  onChange={(e) => onFilterChange(() => setTo(e.target.value))}
                  aria-label={t("range.to")}
                  title={t("range.to")}
                  className="w-40"
                />
                {from || to ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onFilterChange(() => {
                        setFrom("")
                        setTo("")
                      })
                    }
                  >
                    {t("range.clear")}
                  </Button>
                ) : null}
              </div>
            </div>

            {/* The pickers are already bounded to the retention window, but a
              disabled date says nothing about why — this does. */}
            <p className="text-xs text-muted-foreground">
              {t("retentionNote", { days: OTP_RETENTION_DAYS })}
            </p>
            {!rangeValid ? (
              <p role="alert" className="text-xs text-destructive">
                {t("range.invalid")}
              </p>
            ) : null}
          </div>

          {meta ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              {t("total", { count: meta.total })}
            </p>
          ) : null}
        </DataTableToolbar>

        {rangeValid ? (
          <details className="border-b px-4 py-3" open>
            <summary className="cursor-pointer text-sm font-medium">
              {t("errors.title")}
            </summary>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("errors.description")}
            </p>
            {loading ? (
              <p role="status" className="mt-2 text-sm text-muted-foreground">
                {t("errors.loading")}
              </p>
            ) : error ? (
              <p className="mt-2 text-sm text-destructive">
                {t("errors.failed")}
              </p>
            ) : deliveryErrors.length ? (
              <dl className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {deliveryErrors.map((group) => (
                  <div
                    key={group.reason}
                    className="flex items-start justify-between gap-4"
                  >
                    <dt className="min-w-0 break-words text-sm" dir="auto">
                      {group.reason}
                    </dt>
                    <dd className="shrink-0 text-sm tabular-nums">
                      {t("errors.count", { count: group.count })}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("errors.empty")}
              </p>
            )}
          </details>
        ) : null}

        <Table>
          <DataTableHeader>
            <DataTableHead>{t("column.identifier")}</DataTableHead>
            <DataTableHead>{t("column.account")}</DataTableHead>
            <DataTableHead>{t("column.purpose")}</DataTableHead>
            <DataTableHead>{t("column.status")}</DataTableHead>
            <DataTableHead>{t("column.attempts")}</DataTableHead>
            <DataTableHead>{t("column.sent")}</DataTableHead>
            <DataTableHead>{t("column.delivery")}</DataTableHead>
            <DataTableHead>{t("column.verified")}</DataTableHead>
            {isSuperAdmin ? <DataTableHead className="w-12" /> : null}
          </DataTableHeader>
          <TableBody>
            {loading && rows.length === 0 ? (
              <DataTableSkeletonRows columns={columnCount} />
            ) : (
              rows.map((row) => (
                <DataTableRow key={row.id}>
                  <DataTableCell className="font-medium" dir="ltr">
                    {row.identifier}
                  </DataTableCell>
                  <DataTableCell className="text-muted-foreground">
                    {/* Null for SIGNUP — the code goes out before the account
                        exists, so there is nobody to name yet — and for
                        CUSTOMER_SIGN_IN, whose shop customer is no account. */}
                    {row.user_name ?? t("noAccount")}
                  </DataTableCell>
                  <DataTableCell>
                    <Badge variant="outline">
                      {t(`purpose.${row.purpose}`)}
                    </Badge>
                  </DataTableCell>
                  <DataTableCell>
                    <Badge variant={statusBadgeVariant(row.status)}>
                      {t(`status.${row.status}`)}
                    </Badge>
                  </DataTableCell>
                  <DataTableCell className="text-muted-foreground tabular-nums">
                    {attemptsLabel(row)}
                  </DataTableCell>
                  <DataTableCell className="text-muted-foreground">
                    {formatDateTime(row.created_at, locale)}
                  </DataTableCell>
                  <DataTableCell>
                    {row.delivery_error ? (
                      // The gateway's own words ride in the title so a delivery
                      // complaint can be answered from this row alone.
                      <Badge variant="destructive" title={row.delivery_error}>
                        {t("delivery.failed")}
                      </Badge>
                    ) : row.delivered_at ? (
                      <Badge
                        variant="outline"
                        title={formatDateTime(row.delivered_at, locale)}
                      >
                        {t("delivery.delivered")}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">
                        {t("delivery.pending")}
                      </span>
                    )}
                    {/* A provider-issued code (Twilio Verify) has no reveal
                        button; this is what says why. */}
                    {verifierLabel(row.verifier) ? (
                      <Badge
                        variant="secondary"
                        className="ms-1.5"
                        title={t("issuedBy", {
                          provider: verifierLabel(row.verifier) ?? "",
                        })}
                      >
                        {verifierLabel(row.verifier)}
                      </Badge>
                    ) : null}
                  </DataTableCell>
                  <DataTableCell className="text-muted-foreground">
                    {formatDateTime(row.verified_at, locale)}
                  </DataTableCell>
                  {isSuperAdmin ? (
                    <DataTableCell className="text-end">
                      {isRevealable(row) ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("reveal")}
                          title={t("reveal")}
                          disabled={revealingId !== null}
                          onClick={() => void reveal(row)}
                          className="size-8 opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 max-sm:opacity-100"
                        >
                          {revealingId === row.id ? (
                            <Loader2Icon className="size-4 animate-spin" />
                          ) : (
                            <EyeIcon className="size-4" />
                          )}
                        </Button>
                      ) : null}
                    </DataTableCell>
                  ) : null}
                </DataTableRow>
              ))
            )}

            {!loading && !error && rows.length === 0 ? (
              <DataTableEmpty colSpan={columnCount}>
                {t("empty")}
              </DataTableEmpty>
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
        open={revealed !== null}
        onOpenChange={(open) => !open && setRevealed(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("revealDialog.title")}</DialogTitle>
            <DialogDescription>
              {revealed
                ? t("revealDialog.body", {
                    identifier: revealed.row.identifier,
                    expires: formatDateTime(revealed.row.expires_at, locale),
                  })
                : ""}
            </DialogDescription>
          </DialogHeader>

          <p
            dir="ltr"
            className="rounded-lg bg-muted py-6 text-center font-mono text-4xl font-semibold tracking-[0.3em] tabular-nums"
          >
            {revealed?.code}
          </p>

          {/* Said out loud rather than left to the audit table: whoever opens
              this should know their name is on it. */}
          <p className="text-xs text-muted-foreground">
            {t("revealDialog.audited")}
          </p>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRevealed(null)}>
              {t("revealDialog.close")}
            </Button>
            <Button onClick={() => void copyCode()}>
              <CopyIcon className="size-4" />
              {t("revealDialog.copy")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
