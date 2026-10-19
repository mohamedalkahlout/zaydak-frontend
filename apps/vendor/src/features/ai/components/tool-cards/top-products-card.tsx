import { useTranslations } from "next-intl"
import { TrophyIcon } from "lucide-react"
import type { TopProductsResult } from "@/features/ai/lib/types"
import { ResultCardShell } from "./result-card-shell"
import {
  formatCalendarDate,
  formatCalendarRange,
  formatMoney,
} from "./stats-format"

interface Props {
  result: TopProductsResult
  currency: string
  /** Picks the vendor's language out of each product's bilingual name. */
  locale: "ar" | "en"
}

export function TopProductsCard({ result, currency, locale }: Props) {
  const t = useTranslations("aiChat.toolCards.topProducts")

  // The window the list covers. A "this month" list and an all-time one used
  // to look identical, so the header says which this is. A turn persisted
  // before the tool took dates has no `range` and was all time.
  const range = result.range ?? null
  let label: string
  if (!range) {
    label = t("allTime")
  } else if (range.start_date && range.end_date) {
    label =
      formatCalendarRange(range.start_date, range.end_date, locale, true) ??
      t("range", { start: range.start_date, end: range.end_date })
  } else if (range.start_date) {
    label = t("since", {
      date:
        formatCalendarDate(range.start_date, locale, true) ?? range.start_date,
    })
  } else {
    label = t("until", {
      date:
        formatCalendarDate(range.end_date, locale, true) ??
        range.end_date ??
        "",
    })
  }

  return (
    <ResultCardShell
      icon={TrophyIcon}
      title={t("title")}
      accent="amber"
      className="p-2"
      trailing={<span className="tabular-nums">{label}</span>}
    >
      {result.products.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {range ? t("emptyInRange") : t("empty")}
          </p>
        ) : (
          <ol className="divide-y">
            {result.products.map((p, i) => {
              const name = p.name[locale] ?? p.name.en ?? p.name.ar ?? p.slug
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-3 px-2 py-2">
                  <span className="size-6 shrink-0 rounded-full bg-muted flex items-center justify-center text-[11px] font-semibold">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      /{p.slug}
                    </div>
                  </div>
                  <div className="text-end">
                    <div className="text-sm font-semibold">
                      {formatMoney(p.total_sales, currency)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {t("orders", { count: p.orders_count })}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
    </ResultCardShell>
  )
}
