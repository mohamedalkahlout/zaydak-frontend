import { useTranslations } from "next-intl"
import { TicketPercentIcon } from "lucide-react"
import { formatDate, formatMoneyCents } from "@/shared/lib/format"
import type { GetCouponResult } from "@/features/ai/lib/types"
import {
  couponDiscountText,
  couponStatusMeta,
  couponTypeLabel,
} from "./coupon-card-helpers"
import { ResultCardShell } from "./result-card-shell"

interface Props {
  result: GetCouponResult
}

export function CouponDetailsCard({ result }: Props) {
  const t = useTranslations("aiChat.toolCards.coupons")
  const c = result.coupon
  const status = couponStatusMeta(c.status, t)
  const code = c.code ?? t("automatic")

  const rows: Array<{ label: string; value: string }> = [
    { label: t("details.type"), value: couponTypeLabel(c.type, t) },
    { label: t("details.discount"), value: couponDiscountText(c, t) },
  ]
  if (c.type === "buy_x_get_y" && c.buy_quantity != null && c.get_quantity != null) {
    rows.push({
      label: t("details.rule"),
      value: t("details.ruleValue", {
        buy: c.buy_quantity,
        get: c.get_quantity,
      }),
    })
  }
  if (c.minimum_cart_amount_cents > 0) {
    rows.push({
      label: t("details.minCart"),
      value: formatMoneyCents(c.minimum_cart_amount_cents, c.currency),
    })
  }
  if (c.max_discount_cents != null) {
    rows.push({
      label: t("details.maxDiscount"),
      value: formatMoneyCents(c.max_discount_cents, c.currency),
    })
  }
  rows.push({
    label: t("details.usage"),
    value: `${c.times_used}${c.max_uses != null ? ` / ${c.max_uses}` : ""}`,
  })
  rows.push({ label: t("details.starts"), value: formatDate(c.active_from) })
  if (c.expire_at) {
    rows.push({ label: t("details.expires"), value: formatDate(c.expire_at) })
  }
  if (c.is_exclusive) {
    rows.push({
      label: t("details.combines"),
      value: t("details.exclusive"),
    })
  }

  return (
    <ResultCardShell
      icon={TicketPercentIcon}
      title={code}
      accent="violet"
      trailing={
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${status.className}`}>
          {status.label}
        </span>
      }
    >
      <dl className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="font-medium text-end">{r.value}</dd>
          </div>
        ))}
      </dl>
    </ResultCardShell>
  )
}
