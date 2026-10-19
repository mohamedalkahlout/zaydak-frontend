import { useTranslations } from "next-intl"
import { LayersIcon } from "lucide-react"
import type { CategorySalesResult } from "@/features/ai/lib/types"
import { ResultCardShell } from "./result-card-shell"

interface Props {
  result: CategorySalesResult
}

export function CategorySalesCard({ result }: Props) {
  const t = useTranslations("aiChat.toolCards.categorySales")

  // Peak unit-count drives the bar width so the top seller fills the row.
  const peak = Math.max(
    1,
    ...result.categories.map((c) => c.total_quantity_sold),
  )

  return (
    <ResultCardShell
      icon={LayersIcon}
      title={t("title")}
      accent="violet"
      className="p-2"
    >
      {result.categories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t("empty")}
          </p>
        ) : (
          <ul className="space-y-2 p-2">
            {result.categories.map((c) => {
              const widthPct = (c.total_quantity_sold / peak) * 100
              return (
                <li key={c.category_id}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium truncate">{c.name}</span>
                    <span className="text-muted-foreground">
                      {t("sold", { count: c.total_quantity_sold })}
                      {" · "}
                      {t("products", { count: c.product_count })}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-purple-500/70"
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
    </ResultCardShell>
  )
}
