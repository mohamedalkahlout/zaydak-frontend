import { useTranslations } from "next-intl"
import { AlertCircleIcon } from "lucide-react"
import type { LowStockProductsResult } from "@/features/ai/lib/types"
import { ResultCardShell } from "./result-card-shell"

interface Props {
  result: LowStockProductsResult
  /** Picks the vendor's language out of each product's bilingual name. */
  locale: "ar" | "en"
}

export function LowStockCard({ result, locale }: Props) {
  const t = useTranslations("aiChat.toolCards.lowStock")

  return (
    <ResultCardShell
      icon={AlertCircleIcon}
      title={t("title")}
      accent="amber"
      trailing={t("threshold", { count: result.threshold })}
      className="p-2"
    >
      {result.products.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t("empty")}
          </p>
        ) : (
          <ul className="divide-y">
            {result.products.map((p) => {
              const name = p.name[locale] ?? p.name.en ?? p.name.ar ?? p.slug
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between px-2 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      /{p.slug}
                    </div>
                  </div>
                  <div
                    className={
                      p.quantity === 0
                        ? "text-sm font-bold text-destructive"
                        : "text-sm font-semibold text-amber-700 dark:text-amber-400"
                    }>
                    {t("left", { count: p.quantity })}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
    </ResultCardShell>
  )
}
