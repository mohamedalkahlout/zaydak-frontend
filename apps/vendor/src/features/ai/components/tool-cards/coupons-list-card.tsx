import { useTranslations } from "next-intl"
import { TicketPercentIcon } from "lucide-react"
import { formatMoneyCents } from "@/shared/lib/format"
import type { ListCouponsResult } from "@/features/ai/lib/types"
import {
  couponDiscountText,
  couponStatusMeta,
  couponTypeLabel,
} from "./coupon-card-helpers"
import { ResultCardShell } from "./result-card-shell"

interface Props {
  result: ListCouponsResult
}

export function CouponsListCard({ result }: Props) {
  const t = useTranslations("aiChat.toolCards.coupons")

  // No results → render nothing. The assistant's own text already says
  // "no coupon named X" in context, so an empty card is pure noise
  // (and it read oddly next to the sentence). Let the text speak.
  if (result.coupons.length === 0) return null

  return (
    <ResultCardShell
      icon={TicketPercentIcon}
      title={t("listTitle")}
      accent="violet"
      trailing={`${result.count}${result.total > result.count ? ` / ${result.total}` : ""}`}
      className="p-2"
    >
      <ul className="divide-y">
          {result.coupons.map((c) => {
              const status = couponStatusMeta(c.status, t)
              const code = c.code ?? t("automatic")
              return (
                <li key={c.id} className="flex items-center gap-3 px-2 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold truncate">
                        {code}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {couponTypeLabel(c.type, t)}
                      {c.minimum_cart_amount_cents > 0 && (
                        <>
                          {" · "}
                          {t("min", {
                            amount: formatMoneyCents(
                              c.minimum_cart_amount_cents,
                              c.currency,
                            ),
                          })}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-end shrink-0">
                    <div className="text-sm font-semibold">
                      {couponDiscountText(c, t)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {t("used", {
                        usage: `${c.times_used}${c.max_uses != null ? `/${c.max_uses}` : ""}`,
                      })}
                    </div>
                  </div>
                </li>
              )
            })}
        </ul>
    </ResultCardShell>
  )
}
