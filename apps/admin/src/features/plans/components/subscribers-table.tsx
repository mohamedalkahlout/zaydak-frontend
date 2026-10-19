"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import { Badge } from "@repo/ui/components/badge"
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
  DataTableSkeletonRows,
  DataTableToolbar,
} from "@/shared/components/data-table/data-table"
import { DataTablePagination } from "@/shared/components/data-table/data-table-pagination"
import { FilterBar, type Filter } from "@/shared/components/filter-bar"
import { centsToMajor, formatDate } from "@/shared/lib/format"
import { ADMIN_PLANS, ADMIN_SHOP_SUBSCRIPTIONS } from "../api"
import {
  DEFAULT_STATUS,
  subscriberFilterFields,
  toFilters,
  toQuery,
} from "../lib/subscriber-filters"
import { subscriberHref } from "../nav"
import type { SubscriptionRow } from "../types"

const PAGE_SIZE = 20

const STATUS_TONE: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  ACTIVE: "default",
  TRIALING: "outline",
  PAST_DUE: "destructive",
  CANCELED: "secondary",
  EXPIRED: "secondary",
}

interface Props {
  /**
   * Pins the list to one plan and hides the plan filter. Set when this renders
   * inside a plan's own detail screen, where "any plan" would be a control that
   * navigates away from the record you are looking at.
   */
  planId?: string
  title?: string
  subtitle?: string
}

/**
 * Which stores are on which plan.
 *
 * Separate from the plans table because the two answer different questions —
 * that one is "what does this tier sell", this one is "who is paying for it".
 *
 * **Every row says who bills it.** A Stripe-billed subscription renews by
 * charging a card, so renewal is not the admin's to grant and cancelling has to
 * reach Stripe; a hand-assigned one is ours end to end. The badge is what
 * explains why the actions differ on the detail screen.
 */
export function SubscribersTable({ planId, title, subtitle }: Props) {
  const t = useTranslations("plans")
  // The chip's condition is chrome rather than this screen's own vocabulary —
  // it reads the same on every list — so it comes from the namespace the rest
  // of the bar is already translated in.
  const tFilterBar = useTranslations("filterBar")
  const locale = useLocale()
  // Captured once per mount: "days left" needs day precision, and reading the
  // clock during render makes the component impure — it would also drift
  // between the server render and hydration.
  const [now] = useState(() => Date.now())
  /**
   * The applied chips are the filter state itself, not a projection of it: a
   * chip that has just been added holds no value yet, so an array derived from
   * the query arguments would drop it in the frame it appeared in.
   */
  const [filters, setFilters] = useState<Filter[]>(() =>
    toFilters({ status: DEFAULT_STATUS }),
  )
  const applied = useMemo(() => toQuery(filters), [filters])
  // Applied on submit, not per keystroke — this is a server query over every
  // shop, and re-running it on each character is a request per letter typed.
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)

  const { data: plansData } = useQuery(ADMIN_PLANS)

  // The rows are read inside the memo rather than through a local: `?? []`
  // mints a new array on every render, which as a dependency would rebuild the
  // fields — and with them every option object — on each one.
  const fields = useMemo(
    () =>
      subscriberFilterFields({
        labels: {
          status: t("col.status"),
          plan: t("col.plan"),
          is: tFilterBar("is"),
          statusOption: (key) => t(`statusFilter.${key}`),
        },
        plans: planId ? null : (plansData?.allPlans.data ?? []),
      }),
    [t, tFilterBar, planId, plansData],
  )

  const { data, loading } = useQuery(ADMIN_SHOP_SUBSCRIPTIONS, {
    variables: {
      statuses: applied.statuses,
      // The prop still wins inside a plan's own screen, where the plan field is
      // never offered and so no chip can disagree with it.
      plan_id: planId ?? applied.plan_id,
      search: search || undefined,
      page,
      limit: PAGE_SIZE,
    },
    // Two admins on the same shop is exactly when a stale list turns into an
    // action taken against a subscription that already moved.
    fetchPolicy: "cache-and-network",
  })

  const rows = data?.shopSubscriptions.data ?? []
  const meta = data?.shopSubscriptions.meta

  /**
   * Any filter change invalidates the page number it was paired with — page 4
   * of "live" is not page 4 of "canceled". That holds for a chip that has only
   * been added and not yet given a value, which widens the list the same way.
   */
  function applyFilters(next: Filter[]) {
    setFilters(next)
    setPage(1)
  }

  function applySearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  /** Days left in the period, or how long ago it lapsed. */
  const periodLabel = (row: SubscriptionRow): string => {
    const end = new Date(row.current_period_end).getTime()
    const days = Math.round((end - now) / 86_400_000)
    if (days < 0) return t("lapsedAgo", { days: Math.abs(days) })
    if (days === 0) return t("endsToday")
    return t("daysLeft", { days })
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl font-semibold">
          {title ?? t("subscribersTitle")}
        </h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          {subtitle ?? t("subscribersSubtitle")}
        </p>
      </div>

      <DataTableCard>
        <DataTableToolbar>
          {/* The search box stays a sibling of the bar rather than riding in
              its `leading` slot: the bar moves focus between its segments on
              the arrow keys, and a text input inside it would hand the caret to
              that on every left or right press. */}
          <div className="flex flex-wrap items-center gap-2">
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                applySearch(searchInput.trim())
              }}
            >
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder={t("searchStores")}
                className="w-56"
              />
              <Button type="submit" variant="outline" size="sm">
                {t("search")}
              </Button>
              {search && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchInput("")
                    applySearch("")
                  }}
                >
                  {t("clear")}
                </Button>
              )}
            </form>

            <FilterBar fields={fields} value={filters} onChange={applyFilters} />
          </div>

          {meta && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {t("subscriptionCount", { count: meta.total })}
            </span>
          )}
        </DataTableToolbar>

        <Table>
          <DataTableHeader>
            <DataTableHead>{t("col.store")}</DataTableHead>
            <DataTableHead>{t("col.plan")}</DataTableHead>
            <DataTableHead>{t("col.status")}</DataTableHead>
            <DataTableHead>{t("col.billing")}</DataTableHead>
            <DataTableHead className="text-end">{t("col.price")}</DataTableHead>
            <DataTableHead>{t("col.periodEnds")}</DataTableHead>
            <DataTableHead className="text-end">{t("col.actions")}</DataTableHead>
          </DataTableHeader>
          <TableBody>
            {loading && !rows.length ? (
              <DataTableSkeletonRows columns={7} />
            ) : (
              rows.map((row) => (
                <DataTableRow key={row.id}>
                  <DataTableCell>
                    <Link
                      href={subscriberHref(row.shop_id)}
                      className="font-medium hover:underline focus-visible:underline focus-visible:outline-none"
                    >
                      {row.shop_name ?? row.shop_slug}
                    </Link>
                    <code className="block text-xs text-muted-foreground">
                      {row.shop_slug}
                    </code>
                  </DataTableCell>
                  <DataTableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {row.plan_code}
                    </code>
                    {/* A queued downgrade. The shop is still on `plan_code` and
                        keeps its capabilities until this date. */}
                    {row.pending_plan_code && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        → {row.pending_plan_code}{" "}
                        {formatDate(row.pending_change_at, locale)}
                      </div>
                    )}
                  </DataTableCell>
                  <DataTableCell>
                    <Badge variant={STATUS_TONE[row.status] ?? "secondary"}>
                      {t(`statusFilter.${row.status.toLowerCase()}`)}
                    </Badge>
                    {row.cancel_at_period_end && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {t("willNotRenew")}
                      </div>
                    )}
                  </DataTableCell>
                  <DataTableCell>
                    {row.is_stripe_billed ? (
                      <Badge variant="outline">{t("stripeBilled")}</Badge>
                    ) : (
                      <Badge variant="secondary">{t("assigned")}</Badge>
                    )}
                  </DataTableCell>
                  <DataTableCell className="text-end tabular-nums">
                    {centsToMajor(row.price_cents_snapshot).toFixed(2)}
                    <div className="text-xs text-muted-foreground">
                      {row.interval === "YEARLY" ? t("yearly") : t("monthly")}
                    </div>
                  </DataTableCell>
                  <DataTableCell>
                    <div>{formatDate(row.current_period_end, locale)}</div>
                    <div className="text-xs text-muted-foreground">
                      {periodLabel(row)}
                    </div>
                  </DataTableCell>
                  <DataTableCell className="text-end">
                    <Button
                      size="sm"
                      variant="outline"
                      render={<Link href={subscriberHref(row.shop_id)} />}
                    >
                      {t("manage")}
                    </Button>
                  </DataTableCell>
                </DataTableRow>
              ))
            )}
            {!loading && !rows.length && (
              <DataTableEmpty colSpan={7}>
                {t("noSubscriptions")}
              </DataTableEmpty>
            )}
          </TableBody>
        </Table>

        {meta && meta.total_pages > 1 && (
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
            />
          </DataTableFooter>
        )}
      </DataTableCard>
    </div>
  )
}
