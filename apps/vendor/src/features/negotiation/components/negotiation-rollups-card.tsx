"use client"

import type { ReactNode } from "react"
import { useLocale, useTranslations } from "next-intl"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table"
import type { Translate } from "@/shared/i18n/translator"
import { cn } from "@/shared/lib/utils"
import { formatMoneyCents } from "@/shared/lib/format"
import { formatRate, formatRounds } from "../lib/outcomes"
import type {
  NegotiationOutcomeFigures,
  NegotiationOutcomeRollups,
} from "../types"

/**
 * The outcomes report grouped — by product, and by the strategy each
 * negotiation ran under. Each table's footer is the report's own total, the
 * figure the KPI row above reads, so the groups visibly add up to it.
 *
 * The averages are money-weighted on the bases a merchant configures a policy
 * in: discount as a share of list price (`max_discount_bps`), margin as a
 * share of selling price (`minimum_margin_bps`). A rate with nothing under it
 * reads "—", never "0%".
 */

interface RollupCardProps {
  rollups: NegotiationOutcomeRollups | undefined
  loading: boolean
  failed: boolean
}

/** The message a card shows instead of its table, or null to show the table. */
function rollupNotice(
  { rollups, loading, failed }: RollupCardProps,
  t: Translate,
): ReactNode {
  if (failed && !rollups) {
    return (
      <p className="py-6 text-center text-sm text-destructive">
        {t("rollups.error")}
      </p>
    )
  }
  if (!rollups) {
    return loading ? (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {t("loading")}
      </p>
    ) : null
  }
  if (rollups.total.sessions === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {t("rollups.empty")}
      </p>
    )
  }
  return null
}

function useCells(currency: string | undefined) {
  const locale = useLocale()
  const count = (n: number) => n.toLocaleString(locale)
  const num = "text-end tabular-nums"
  return {
    count,
    num,
    /** A count with its rate beside it, muted: "3 · 50%". */
    countWithRate: (n: number, bps: number | null) => (
      <>
        {count(n)}
        <span className="text-muted-foreground"> · {formatRate(bps, locale)}</span>
      </>
    ),
    rate: (bps: number | null) => formatRate(bps, locale),
    rounds: (n: number | null) => formatRounds(n, locale),
    money: (cents: number) => formatMoneyCents(cents, currency, locale),
    /** Below cost reads red: a deal that lost money must not look like one that made it. */
    marginClass: (f: NegotiationOutcomeFigures) =>
      cn(num, f.margin_bps != null && f.margin_bps < 0 && "text-destructive"),
  }
}

export function NegotiationProductRollupsCard({
  onProduct,
  ...props
}: RollupCardProps & {
  /** Drill into one product: the same as clicking its name in a row. */
  onProduct: (product: { id: string; title: string }) => void
}) {
  const t = useTranslations("negotiationOutcomes")
  const { rollups } = props
  const notice = rollupNotice(props, t)
  const c = useCells(rollups?.currency)

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>{t("rollups.byProduct")}</CardTitle>
      </CardHeader>
      <CardContent>
        {notice ?? (rollups ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("rollups.columns.product")}</TableHead>
                  <TableHead className="text-end">
                    {t("rollups.columns.sessions")}
                  </TableHead>
                  <TableHead className="text-end">
                    {t("rollups.columns.dealRate")}
                  </TableHead>
                  <TableHead className="text-end">
                    {t("rollups.columns.redeemed")}
                  </TableHead>
                  <TableHead className="text-end">
                    <span title={t("rollups.columns.avgDiscountHint")}>
                      {t("rollups.columns.avgDiscount")}
                    </span>
                  </TableHead>
                  <TableHead className="text-end">
                    <span title={t("rollups.columns.avgMarginHint")}>
                      {t("rollups.columns.avgMargin")}
                    </span>
                  </TableHead>
                  <TableHead className="text-end">
                    {t("rollups.columns.revenue")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rollups.products.map((p) => (
                  <TableRow key={p.product_id}>
                    <TableCell>
                      <button
                        type="button"
                        title={t("filters.onlyThisProduct")}
                        className="text-start font-medium underline-offset-4 hover:underline"
                        onClick={() =>
                          onProduct({ id: p.product_id, title: p.product_title })
                        }
                      >
                        {p.product_title}
                      </button>
                    </TableCell>
                    <ProductFigures figures={p.figures} c={c} />
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-medium">
                    {t("rollups.total")}
                  </TableCell>
                  <ProductFigures figures={rollups.total} c={c} />
                </TableRow>
              </TableFooter>
            </Table>
            {rollups.products_total > rollups.products.length ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("rollups.shown", {
                  shown: rollups.products.length,
                  total: rollups.products_total,
                })}
              </p>
            ) : null}
          </>
        ) : null)}
      </CardContent>
    </Card>
  )
}

function ProductFigures({
  figures: f,
  c,
}: {
  figures: NegotiationOutcomeFigures
  c: ReturnType<typeof useCells>
}) {
  return (
    <>
      <TableCell className={c.num}>{c.count(f.sessions)}</TableCell>
      <TableCell className={c.num}>{c.rate(f.acceptance_bps)}</TableCell>
      <TableCell className={c.num}>
        {c.countWithRate(f.redeemed, f.conversion_bps)}
      </TableCell>
      <TableCell className={c.num}>{c.rate(f.avg_discount_bps)}</TableCell>
      <TableCell className={c.marginClass(f)}>{c.rate(f.margin_bps)}</TableCell>
      <TableCell className={c.num}>{c.money(f.revenue_cents)}</TableCell>
    </>
  )
}

export function NegotiationStrategyRollupsCard(props: RollupCardProps) {
  const t = useTranslations("negotiationOutcomes")
  const { rollups } = props
  const notice = rollupNotice(props, t)
  const c = useCells(rollups?.currency)

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>{t("rollups.byStrategy")}</CardTitle>
      </CardHeader>
      <CardContent>
        {notice ?? (rollups ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("rollups.columns.strategy")}</TableHead>
                <TableHead className="text-end">
                  {t("rollups.columns.sessions")}
                </TableHead>
                <TableHead className="text-end">
                  {t("rollups.columns.dealRate")}
                </TableHead>
                <TableHead className="text-end">
                  {t("rollups.columns.rounds")}
                </TableHead>
                <TableHead className="text-end">
                  {t("rollups.columns.floorReached")}
                </TableHead>
                <TableHead className="text-end">
                  <span title={t("rollups.columns.avgDiscountHint")}>
                    {t("rollups.columns.avgDiscount")}
                  </span>
                </TableHead>
                <TableHead className="text-end">
                  <span title={t("rollups.columns.avgMarginHint")}>
                    {t("rollups.columns.avgMargin")}
                  </span>
                </TableHead>
                <TableHead className="text-end">
                  {t("rollups.columns.revenue")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rollups.strategies.map((s) => (
                <TableRow key={s.strategy}>
                  <TableCell className="font-medium">
                    {t(`rollups.strategy.${s.strategy}`)}
                  </TableCell>
                  <StrategyFigures figures={s.figures} c={c} />
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-medium">
                  {t("rollups.total")}
                </TableCell>
                <StrategyFigures figures={rollups.total} c={c} />
              </TableRow>
            </TableFooter>
          </Table>
        ) : null)}
      </CardContent>
    </Card>
  )
}

function StrategyFigures({
  figures: f,
  c,
}: {
  figures: NegotiationOutcomeFigures
  c: ReturnType<typeof useCells>
}) {
  return (
    <>
      <TableCell className={c.num}>{c.count(f.sessions)}</TableCell>
      <TableCell className={c.num}>{c.rate(f.acceptance_bps)}</TableCell>
      <TableCell className={c.num}>{c.rounds(f.avg_rounds_to_close)}</TableCell>
      <TableCell className={c.num}>
        {c.countWithRate(f.floor_reached, f.floor_reached_bps)}
      </TableCell>
      <TableCell className={c.num}>{c.rate(f.avg_discount_bps)}</TableCell>
      <TableCell className={c.marginClass(f)}>{c.rate(f.margin_bps)}</TableCell>
      <TableCell className={c.num}>{c.money(f.revenue_cents)}</TableCell>
    </>
  )
}
