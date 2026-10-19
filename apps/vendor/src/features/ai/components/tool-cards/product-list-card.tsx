import { useTranslations } from "next-intl"
import { SearchIcon } from "lucide-react"
import { Badge } from "@repo/ui/components/badge"
import type { SearchProductsResult } from "@/features/ai/lib/types"
import { useProductStatusLabel } from "./labels"
import { ResultCardShell } from "./result-card-shell"

interface Props {
  result: SearchProductsResult
  currency: string
  /** Picks the vendor's language out of each product's bilingual name. */
  locale: "ar" | "en"
}

function formatMoney(cents: number | null, currency: string) {
  if (cents === null || cents === undefined) return "—"
  return `${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`
}

export function ProductListCard({ result, currency, locale }: Props) {
  const t = useTranslations("aiChat.toolCards.productList")
  const statusLabel = useProductStatusLabel()

  return (
    <ResultCardShell
      icon={SearchIcon}
      title={t("title")}
      trailing={`${result.count} / ${result.total}`}
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
              const isOnSale =
                p.sale_price_cents !== null &&
                p.price_cents !== null &&
                p.sale_price_cents < p.price_cents
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 px-2 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{name}</div>
                    <div className="text-xs text-muted-foreground font-mono">
                      /{p.slug}
                    </div>
                  </div>
                  <div className="flex flex-col items-end text-xs gap-1">
                    <div className="flex items-baseline gap-1.5">
                      {isOnSale && (
                        <span className="text-muted-foreground line-through">
                          {formatMoney(p.price_cents, currency)}
                        </span>
                      )}
                      <span className="font-semibold">
                        {formatMoney(
                          isOnSale ? p.sale_price_cents : p.price_cents,
                          currency,
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 capitalize">
                        {statusLabel(p.status)}
                      </Badge>
                      <span className="text-muted-foreground">
                        {t("quantity", { count: p.quantity })}
                      </span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
    </ResultCardShell>
  )
}
