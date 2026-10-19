"use client"

import { useTranslations } from "next-intl"
import { PencilIcon } from "lucide-react"
import { useLiveFormStore } from "@/features/ai/store-live-form"
import type { FormPatchResult } from "@/features/ai/lib/types"
import { useProductStatusLabel } from "./labels"

interface Props {
  result: FormPatchResult
  /** Picks the vendor's language out of a translatable change. */
  locale: "ar" | "en"
}

/** `aiChat.toolCards.formPatch.fields.*` per form field. */
const FIELD_LABEL: Record<string, string> = {
  name: "name",
  description: "description",
  price: "price",
  sale_price: "salePrice",
  cost_per_item: "costPerItem",
  quantity: "quantity",
  sku: "sku",
  barcode: "barcode",
  status: "status",
  track_quantity: "trackQuantity",
  continue_selling_when_out_of_stock: "continueSelling",
  requires_shipping: "requiresShipping",
  weight_grams: "weight",
  system_category_id: "category",
  seo_title: "seoTitle",
  seo_description: "seoDescription",
  // The collection form (its title, description and SEO pair are above).
  slug: "slug",
  // The coupon forms, in the form's own field names.
  code: "code",
  method: "method",
  value_type: "valueType",
  amount: "amount",
  max_discount: "maxDiscount",
  minimum_mode: "minimumMode",
  minimum_cart_amount: "minimumCartAmount",
  minimum_quantity: "minimumQuantity",
  limit_uses: "limitUses",
  max_uses: "maxUses",
  limit_one_per_customer: "limitOnePerCustomer",
  is_exclusive: "isExclusive",
  allow_product: "allowProduct",
  allow_order: "allowOrder",
  allow_shipping: "allowShipping",
  active_from_date: "activeFromDate",
  active_from_time: "activeFromTime",
  set_end_date: "setEndDate",
  expire_at_date: "expireAtDate",
  expire_at_time: "expireAtTime",
  target: "campaignTag",
  priority: "priority",
  exclude_shipping_rates: "excludeShippingRates",
  exclude_shipping_rates_over: "maxShippingRate",
  buy_quantity: "buyQuantity",
  get_quantity: "getQuantity",
  get_discount_mode: "getDiscountMode",
  get_discount_percent: "getDiscountPercent",
  get_discount_amount: "getDiscountAmount",
}

/**
 * `aiChat.toolCards.formPatch.values.*` for the coupon fields that hold one
 * of a fixed set. The form shows these as a labelled choice, so the card does
 * too rather than printing `percentage` or `none`.
 */
const VALUE_LABEL: Record<string, Record<string, string>> = {
  method: { code: "methodCode", automatic: "methodAutomatic" },
  value_type: { percentage: "percentage", fixed: "fixedAmount" },
  minimum_mode: {
    none: "none",
    amount: "minimumAmount",
    quantity: "minimumQuantity",
  },
  get_discount_mode: { percent: "percentOff", amount: "amountOff", free: "free" },
}

/**
 * "Changed on the open form" — a `patch_form` result.
 *
 * A change the assistant staged into the product form the vendor already has
 * open, rather than a new card to click: the form is on screen, so there is
 * nothing to open. What the card owes the vendor is what changed, and that it
 * is not saved. One row per field, the old value struck through beside the
 * new one — no arrow, which would point the wrong way in Arabic.
 *
 * Whether the patch actually reached the form is session memory
 * (`useLiveFormStore.outcomes`): `stale` when the form had closed before the
 * result arrived, so the card does not claim a change that never happened. A
 * thread reloaded from history, or the shared view, has no outcome, and the
 * card then says only what any patch means — nothing saved until Save.
 */
export function FormPatchCard({ result, locale }: Props) {
  const t = useTranslations("aiChat.toolCards.formPatch")
  const statusLabel = useProductStatusLabel()
  const patch = result.form_patch
  const outcome = useLiveFormStore((s) => s.outcomes[patch.patch_id])
  const stale = outcome === "stale"

  const show = (field: string, value: unknown): string => {
    if (value === null || value === undefined || value === "") return "—"
    if (typeof value === "boolean") return value ? t("on") : t("off")
    if (field === "status" && typeof value === "string") {
      return statusLabel(value)
    }
    const named =
      typeof value === "string" ? VALUE_LABEL[field]?.[value] : undefined
    if (named) return t(`values.${named}`)
    // An id means nothing to the vendor; the form shows the category's name.
    if (field === "system_category_id") return t("updated")
    if (typeof value === "object") {
      const text = value as Record<string, unknown>
      const picked = text[locale] ?? text.en ?? text.ar
      return typeof picked === "string" && picked ? picked : "—"
    }
    return String(value)
  }

  const rows = (patch.changed ?? []).map((change) => ({
    key: change.field,
    label: FIELD_LABEL[change.field]
      ? t(`fields.${FIELD_LABEL[change.field]}`)
      : change.field,
    from: show(change.field, change.from),
    to: show(change.field, change.to),
  }))

  return (
    <div
      className="border rounded-xl bg-card overflow-hidden"
      data-outcome={outcome ?? "unknown"}
    >
      <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-b text-xs font-medium">
        <PencilIcon className="size-3.5" aria-hidden="true" />
        {t("title")}
      </div>
      <div className="p-4 space-y-3">
        {rows.length > 0 && (
          <div
            className={
              stale
                ? "rounded-lg bg-muted/40 p-3 text-xs space-y-1 opacity-60"
                : "rounded-lg bg-muted/40 p-3 text-xs space-y-1"
            }
          >
            {rows.map((row) => (
              <div key={row.key} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="flex min-w-0 max-w-[70%] items-baseline gap-1.5">
                  {row.from !== "—" && row.key !== "system_category_id" && (
                    <span className="truncate text-muted-foreground line-through">
                      {row.from}
                    </span>
                  )}
                  <span className="truncate font-medium">{row.to}</span>
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {stale ? t("stale") : t("footer")}
        </p>
      </div>
    </div>
  )
}
