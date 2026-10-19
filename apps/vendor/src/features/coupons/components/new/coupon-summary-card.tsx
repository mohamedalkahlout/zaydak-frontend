"use client"

import { useWatch } from "react-hook-form"
import { useLocale, useTranslations } from "next-intl"
import type { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@repo/ui/components/card"
import { Checkbox } from "@repo/ui/components/checkbox"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import type { Translate } from "@/shared/i18n/translator"
import type { CouponFormApi } from "@/features/coupons/validations/coupon"
import { formatList } from "@/features/coupons/lib/format-list"

interface SummaryCardProps {
  /** The running form. We read its state via `useWatch` to keep the
   *  preview in sync without re-rendering everything. */
  form: CouponFormApi
  /** Human label shown in the "Type" block, e.g. "Free shipping". */
  typeLabel: string
  /** Short caption under the type label, e.g. "Shipping discount". */
  typeSubLabel: string
  TypeIcon: LucideIcon
  /** Extra details rendered after the "generic" list — type-specific
   *  (e.g. "For all countries"). Already localized by the caller. */
  extraDetails?: string[]
}

export function CouponSummaryCard({
  form,
  typeLabel,
  typeSubLabel,
  TypeIcon,
  extraDetails,
}: SummaryCardProps) {
  const t = useTranslations("coupons.summary")
  const locale = useLocale()
  const values = useWatch({ control: form.control }) as Record<string, unknown>
  const code = (values.code as string | undefined)?.trim() ?? ""

  const details = buildDetails(values, extraDetails, t, locale)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="space-y-6 py-5">
          <section>
            <h2 className="text-base font-semibold">{code || t("noCode")}</h2>
            <p className="text-xs text-muted-foreground">{t("code")}</p>
          </section>

          <section>
            <h3 className="text-sm font-semibold">{t("type")}</h3>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-foreground">
              <TypeIcon className="size-4 text-muted-foreground" />
              <span>{typeLabel}</span>
            </div>
            <p className="ml-5.5 text-xs text-muted-foreground">{typeSubLabel}</p>
          </section>

          <section>
            <h3 className="text-sm font-semibold">{t("details")}</h3>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
              {details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 py-5">
          <h3 className="text-sm font-semibold">{t("salesChannels")}</h3>
          <div className="flex items-start gap-2">
            <Checkbox id="channel-access" disabled className="mt-0.5" />
            <Label
              htmlFor="channel-access"
              className="text-sm font-normal leading-snug text-muted-foreground"
            >
              {t("salesChannelsFeatured")}
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">{t("comingSoon")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 py-5">
          <h3 className="text-sm font-semibold">{t("tags")}</h3>
          <Input placeholder={t("addTags")} disabled />
          <p className="text-xs text-muted-foreground">{t("tagsHint")}</p>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * The "Details" bullets. `t` is the `coupons.summary` translator; `locale`
 * joins the "Combines with …" list.
 */
function buildDetails(
  v: Record<string, unknown>,
  extras: string[] | undefined,
  t: Translate,
  locale: string,
): string[] {
  const out: string[] = []

  // Eligibility
  const eligibility = (v.eligibility as string) ?? "all_customers"
  if (eligibility === "specific_customers") {
    const ids = (v.customer_ids as string[] | undefined)?.length ?? 0
    out.push(
      ids > 0
        ? t("specificCustomersCount", { count: ids })
        : t("specificCustomers"),
    )
  } else if (eligibility === "segment") {
    const ids = (v.segment_ids as string[] | undefined)?.length ?? 0
    out.push(
      ids > 0 ? t("segmentsCount", { count: ids }) : t("specificSegments"),
    )
  } else {
    out.push(t("allCustomers"))
  }

  // Type-specific bullets injected before generic ones
  if (extras?.length) out.push(...extras)

  // Minimum purchase
  const mode = (v.minimum_mode as string) ?? "none"
  if (mode === "amount" && v.minimum_cart_amount) {
    out.push(t("minimumAmount", { amount: String(v.minimum_cart_amount) }))
  } else if (mode === "quantity" && v.minimum_quantity) {
    out.push(t("minimumQuantity", { count: Number(v.minimum_quantity) }))
  } else {
    out.push(t("noMinimum"))
  }

  // Usage limits
  if (v.limit_uses && v.max_uses) {
    out.push(t("usageLimit", { count: Number(v.max_uses) }))
  } else if (v.limit_one_per_customer) {
    out.push(t("oncePerCustomer"))
  } else {
    out.push(t("noUsageLimits"))
  }

  // Combinations
  if (v.is_exclusive) {
    out.push(t("exclusive"))
  } else {
    const combines: string[] = []
    if (v.allow_product) combines.push(t("productDiscounts"))
    if (v.allow_order) combines.push(t("orderDiscounts"))
    if (v.allow_shipping) combines.push(t("shippingDiscounts"))
    out.push(
      combines.length === 0
        ? t("noCombinations")
        : t("combinesWith", { list: formatList(combines, locale) }),
    )
  }

  // Active window
  const startDate = v.active_from_date as string | undefined
  if (startDate) {
    const today = new Date().toISOString().slice(0, 10)
    out.push(
      startDate === today
        ? t("activeFromToday")
        : t("activeFrom", { date: startDate }),
    )
  }
  if (v.set_end_date && v.expire_at_date) {
    out.push(t("endsOn", { date: v.expire_at_date as string }))
  } else {
    out.push(t("neverExpires"))
  }

  return out
}
