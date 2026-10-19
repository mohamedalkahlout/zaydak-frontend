import { useTranslations } from "next-intl"
import { TrendingUpIcon } from "lucide-react"
import type { YearlySalesResult } from "@/features/ai/lib/types"
import { ResultCardShell } from "./result-card-shell"

interface Props {
  result: YearlySalesResult
  currency: string
  /** Names the months. */
  locale: "ar" | "en"
}

/** "Jan"…"Dec" in English, the month names in Arabic (CLDR's short form is
 * the full name there). */
function monthNames(locale: "ar" | "en"): string[] {
  const format = new Intl.DateTimeFormat(locale, { month: "short" })
  return Array.from({ length: 12 }, (_, i) => format.format(new Date(2000, i, 1)))
}

function formatMoney(amount: number, currency: string) {
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`
}

export function YearlySalesCard({ result, currency, locale }: Props) {
  const t = useTranslations("aiChat.toolCards.yearlySales")
  const months = monthNames(locale)

  // Normalize to 12 months so missing months show as 0.
  const byMonth = new Map(result.months.map((m) => [m.month, m.total]))
  const peak = Math.max(1, ...result.months.map((m) => m.total))

  return (
    <ResultCardShell
      icon={TrendingUpIcon}
      title={t("title", { year: result.year })}
      accent="emerald"
      trailing={t.rich("total", {
        amount: formatMoney(result.total, currency),
        strong: (chunks) => (
          <strong className="text-foreground">{chunks}</strong>
        ),
      })}
      className="p-4"
    >
      <div className="flex items-end gap-1 h-24">
          {Array.from({ length: 12 }, (_, i) => {
            const monthNum = i + 1
            const value = byMonth.get(monthNum) ?? 0
            const heightPct = Math.max(4, (value / peak) * 100)
            return (
              <div
                key={monthNum}
                className="flex-1 flex flex-col items-center gap-1 group"
                title={`${months[i]}: ${formatMoney(value, currency)}`}>
                <div
                  className="w-full rounded-t bg-emerald-500/60 group-hover:bg-emerald-500 transition"
                  style={{ height: `${heightPct}%` }}
                />
              </div>
            )
          })}
        </div>
        <div className="mt-1 flex gap-1 text-[9px] text-muted-foreground">
          {months.map((m) => (
            <div key={m} className="flex-1 text-center truncate">
              {m.slice(0, 3)}
            </div>
          ))}
        </div>
    </ResultCardShell>
  )
}
