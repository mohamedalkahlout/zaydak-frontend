"use client"

import { useState } from "react"
import { useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import {
  GET_MY_ENTITLEMENTS,
  GET_MY_USAGE,
  GET_MY_USAGE_EVENTS,
  GET_MY_USAGE_SUMMARY,
} from "../api/queries"
import { formatQuantity } from "../lib/format-unit"
import { pickLocale } from "../lib/localize"
import { AiSpendersCard } from "./spenders-card"
import { UsageMeter } from "./usage-meter"
import type {
  EntitlementEntry,
  PageMeta,
  UsageEntry,
  UsageEventEntry,
  UsageSummaryEntry,
} from "../types"

const PAGE_SIZE = 20

/** The windows the screen offers, in days. The server defaults to 30. */
const WINDOWS = [7, 30, 90] as const

/**
 * What this store has consumed, and what each call was for.
 *
 * Three layers, most actionable first. The **meters** are the current period
 * and the only thing that can stop a capability working. The **totals** are the
 * chosen window, which is what makes "we used a lot of images last month"
 * answerable. The **activity** is the ledger — one row per call — which is the
 * only layer that can answer "who did that" and "why did it not count".
 *
 * A vendor arriving from a quota wall lands here. On the old single-page screen
 * this was the fifth of six sections; the whole reason the plan screen is four
 * routes now is that this one deserved to be reachable in one click.
 */
/** Start of a rolling window, N days back from now. */
const isoDaysAgo = (days: number): string =>
  new Date(Date.now() - days * 86_400_000).toISOString()

export function UsagePage() {
  const locale = useLocale()
  const t = useTranslations("plan")

  const [days, setDays] = useState<number>(30)
  // Anchored when the range is picked, not read during render. `Date.now()` in
  // the render body is impure AND moved `from` on every single render, so the
  // query variables changed identity constantly and Apollo could never serve
  // the window from cache. Mirrors the admin console's `ShopUsage`.
  const [from, setFrom] = useState(() => isoDaysAgo(30))
  const [featureKey, setFeatureKey] = useState<string>("all")
  const [page, setPage] = useState(1)


  const { data: entData } = useQuery<{
    myEntitlements: { success: boolean; data?: EntitlementEntry[] }
  }>(GET_MY_ENTITLEMENTS)
  const { data: usageData } = useQuery<{
    myUsage: { success: boolean; data?: UsageEntry[] }
  }>(GET_MY_USAGE, { fetchPolicy: "cache-and-network" })

  const { data: summaryData } = useQuery<{
    myUsageSummary: { success: boolean; data?: UsageSummaryEntry[] }
  }>(GET_MY_USAGE_SUMMARY, { variables: { from } })

  const { data: eventsData, loading: eventsLoading } = useQuery<{
    myUsageEvents: {
      success: boolean
      data?: UsageEventEntry[]
      meta?: PageMeta
    }
  }>(GET_MY_USAGE_EVENTS, {
    variables: {
      from,
      page,
      limit: PAGE_SIZE,
      feature_key: featureKey === "all" ? undefined : featureKey,
    },
  })

  const entitlements = entData?.myEntitlements.data ?? []
  const usage = usageData?.myUsage.data ?? []
  const summary = summaryData?.myUsageSummary.data ?? []
  const events = eventsData?.myUsageEvents.data ?? []
  const meta = eventsData?.myUsageEvents.meta

  const metered = usage.filter((u) =>
    entitlements.some((e) => e.key === u.key && e.enabled),
  )
  const nameFor = (key: string) => {
    const entitlement = entitlements.find((e) => e.key === key)
    return entitlement
      ? pickLocale(entitlement.name, entitlement.name_ar, locale)
      : key
  }

  /** A window change invalidates the page it was paired with. */
  const changeWindow = (next: number) => {
    setDays(next)
    setFrom(isoDaysAgo(next))
    setPage(1)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold">
            {t("tab.usage")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("usagePageHint")}
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg border p-0.5">
          {WINDOWS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => changeWindow(value)}
              aria-pressed={days === value}
              className={
                days === value
                  ? "rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                  : "rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              }
            >
              {t("lastDays", { days: value })}
            </button>
          ))}
        </div>
      </div>

      {/* ─── This period's allowances ─────────────────────────────────── */}
      {metered.length > 0 && (
        <section className="space-y-4 rounded-xl border bg-card p-5">
          <div>
            <h2 className="font-medium">{t("allowancesTitle")}</h2>
            <p className="text-xs text-muted-foreground">{t("usageHint")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {metered.map((u) => (
              <UsageMeter
                key={u.key}
                usage={u}
                label={nameFor(u.key)}
                locale={locale}
              />
            ))}
          </div>
        </section>
      )}

      {/* ─── Who is spending the customer-AI allowance ─────────────────── */}
      {/*
        Its own query, on the ENTITLEMENT period rather than the rolling window
        this screen's other panels use — handing it `from` is the one thing that
        would make two numbers in one column disagree. Placed here on purpose:
        the meters, then who is spending them, then the totals.
      */}
      <AiSpendersCard />

      {/* ─── Totals over the chosen window ────────────────────────────── */}
      <section className="rounded-xl border bg-card">
        <header className="border-b px-5 py-3">
          <h2 className="font-medium">{t("consumedTitle")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("consumedHint", { days })}
          </p>
        </header>

        {summary.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            {t("usageEmpty")}
          </p>
        ) : (
          <ul className="divide-y">
            {summary.map((row) => (
              <li
                key={row.feature_key}
                className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {nameFor(row.feature_key)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("callCount", { count: row.events })}
                  </p>
                </div>
                <p className="shrink-0 text-sm tabular-nums">
                  {formatQuantity(
                    row.quantity,
                    unitOf(row.feature_key, entitlements),
                    locale,
                  )}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ─── The ledger itself ────────────────────────────────────────── */}
      <section className="rounded-xl border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
          <div>
            <h2 className="font-medium">{t("activityTitle")}</h2>
            <p className="text-xs text-muted-foreground">{t("activityHint")}</p>
          </div>

          <Select
            value={featureKey}
            onValueChange={(value) => {
              if (value === null) return
              setFeatureKey(value)
              setPage(1)
            }}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allCapabilities")}</SelectItem>
              {summary.map((row) => (
                <SelectItem key={row.feature_key} value={row.feature_key}>
                  {nameFor(row.feature_key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </header>

        {events.length === 0 && !eventsLoading ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            {t("activityEmpty")}
          </p>
        ) : (
          <ul className="divide-y">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm">
                    {event.feature_name}
                    {/*
                      A zero-quantity row is a refund, not a mystery: the work
                      failed and the allowance went back. Without this label the
                      vendor sees an entry that consumed nothing and reads it as
                      a bug.
                    */}
                    {event.released && (
                      <span className="ms-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {t("refunded")}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.created_at).toLocaleString(locale, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
                  {event.released
                    ? "—"
                    : formatQuantity(
                        event.quantity,
                        event.billing_unit,
                        locale,
                      )}
                </p>
              </li>
            ))}
          </ul>
        )}

        {meta && meta.total_pages > 1 && (
          <footer className="flex items-center justify-between gap-3 border-t px-5 py-3">
            <p className="text-xs text-muted-foreground tabular-nums">
              {t("pageOf", { page: meta.page, total: meta.total_pages })}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={meta.page <= 1 || eventsLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t("previous")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={meta.page >= meta.total_pages || eventsLoading}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("next")}
              </Button>
            </div>
          </footer>
        )}
      </section>
    </div>
  )
}

/**
 * The unit a capability counts in, from the resolved map.
 *
 * The summary rows do not carry it — they are grouped totals, and a group has
 * one unit by construction — so it is looked up rather than sent twice.
 */
function unitOf(key: string, entitlements: EntitlementEntry[]): string {
  return entitlements.find((e) => e.key === key)?.billing_unit ?? "none"
}
