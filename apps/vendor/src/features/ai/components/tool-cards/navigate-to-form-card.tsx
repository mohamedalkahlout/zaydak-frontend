"use client"

import { useState } from "react"
import { useParams, usePathname, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { ArrowRightIcon, ClipboardCheckIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import type { Translate } from "@/shared/i18n/translator"
import {
  stashPrefill,
  type PrefillTarget,
} from "@/features/ai/store-prefill"
import { navigateGuarded } from "@/shared/stores/leave-guard"
import { readConversationId } from "@/features/ai/lib/conversation-key"
import { isLiveFormFor } from "@/features/ai/lib/live-form"
import type {
  NavigateToFormResult,
  NavigateTarget,
} from "@/features/ai/lib/types"
import { useProductStatusLabel } from "./labels"

interface Props {
  result: NavigateToFormResult
  /** Picks the vendor's language out of the bilingual names the prefill and
   * the entity carry. */
  locale: "ar" | "en"
}

function isSupportedTarget(t: NavigateTarget): t is PrefillTarget {
  return (
    t === "product_create" ||
    t === "product_edit" ||
    t === "collection_create" ||
    t === "coupon_create" ||
    t === "coupon_edit"
  )
}

/** Which `navigateToForm` message the button carries. */
function buttonLabelKey(target: NavigateTarget): string {
  // Not a form and not an edit: the scan is already running, so the button
  // goes to a screen rather than to something waiting to be filled in.
  if (target === "store_import") return "openImport"
  return target === "product_edit" || target === "coupon_edit"
    ? "openEdit"
    : "openForm"
}

export function NavigateToFormCard({ result, locale }: Props) {
  const t = useTranslations("aiChat.toolCards.navigateToForm")
  const statusLabel = useProductStatusLabel()
  const router = useRouter()
  const params = useParams<{ shopSlug: string }>()
  const pathname = usePathname()
  const intent = result.navigate_to_form
  const [alreadyOpen, setAlreadyOpen] = useState(false)

  const handleOpen = () => {
    // The form this card would open is the one already on screen — an older
    // card in the thread, pressed while the assistant's form is open beside
    // it. Pushing the URL the vendor is on does not remount the form, so the
    // new ticket would never reach it: it would only replace the ticket the
    // form registered under, ending the live channel, and hand the mounted
    // form's save this card's follow-up step, warehouse and receipt. A dirty
    // form would also put up the leave dialog for the page it is on. So the
    // card says so instead, and the vendor changes that form from the chat or
    // saves or discards it first.
    if (
      isLiveFormFor(intent.target, intent.entity?.id) &&
      pathname === intent.url.split(/[?#]/)[0]
    ) {
      setAlreadyOpen(true)
      return
    }
    // One ticket carries the whole handoff: the values, the warehouse the
    // vendor named in chat, and the step to run after they save. They used
    // to be split across two stores, which is how the `/ai` page's
    // auto-navigation managed to stash the values and drop the step.
    if (isSupportedTarget(intent.target)) {
      stashPrefill({
        target: intent.target,
        values: intent.prefill,
        entityId: intent.entity?.id,
        nextStep: intent.next_step ?? undefined,
        // Captured now, not at save time: the receipt belongs in the thread
        // that asked for this, and by the time the form saves the vendor may
        // have switched conversations.
        conversationId: readConversationId(params?.shopSlug ?? null) ?? undefined,
        placeStockAt: intent.place_stock_at,
      })
    }
    // Every other programmatic push in the dashboard asks the leave guard
    // first (AGENTS.md); this one did not, so a handoff away from a screen
    // with unsaved work was the one navigation that skipped the prompt.
    navigateGuarded(intent.url, () => router.push(intent.url))
  }

  const summaryRows = buildSummary(
    intent.prefill,
    locale,
    (key, values) => t(`summary.${key}`, values),
    statusLabel,
  )
  if (intent.place_stock_at) {
    summaryRows.push({
      label: t("summary.warehouse"),
      value: intent.place_stock_at.name,
    })
  }
  const entityName = intent.entity
    ? (intent.entity.name[locale] ??
      intent.entity.name.en ??
      intent.entity.name.ar ??
      intent.entity.slug)
    : null

  return (
    <div className="border rounded-xl bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-b text-xs font-medium">
        <ClipboardCheckIcon className="size-3.5" />
        {t(`title.${intent.target}`)}
      </div>
      <div className="p-4 space-y-3">
        {entityName && (
          <div className="text-sm font-medium">{entityName}</div>
        )}
        {/* Every description used to promise an automatic open ("جاري فتح
            النموذج تلقائياً" / "Opening the form now"), unconditionally, on a
            card whose only route has always been the button underneath it.
            The claim was true on exactly one of the two chat surfaces and only
            for three of the six targets, and it is true on neither now. The
            copy describes the button. */}
        <p className="text-xs text-muted-foreground">
          {t(`description.${intent.target}`)}
        </p>

        {summaryRows.length > 0 && (
          <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
            {summaryRows.map((row) => (
              <div key={row.label} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-medium text-end truncate max-w-[70%]">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        )}

        <Button onClick={handleOpen} className="w-full" size="sm">
          {t(buttonLabelKey(intent.target))}
          <ArrowRightIcon className="size-4 ms-2 rtl:rotate-180" />
        </Button>
        {alreadyOpen && (
          <p role="status" className="text-xs text-muted-foreground">
            {t("alreadyOpen")}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Renders a short, readable summary of the staged prefill so the vendor
 * sees what the AI extracted BEFORE clicking through. Only surfaces a
 * handful of high-signal fields — full inspection happens on the form.
 *
 * @param t A translator scoped to `navigateToForm.summary`.
 */
function buildSummary(
  prefill: Record<string, unknown>,
  locale: "ar" | "en",
  t: Translate,
  statusLabel: (status: string) => string,
): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = []

  const name = prefill.name as Record<string, string> | undefined
  if (name) {
    const v = name[locale] ?? name.en ?? name.ar
    if (v) rows.push({ label: t("name"), value: v })
  }

  if (typeof prefill.slug === "string" && prefill.slug) {
    rows.push({ label: t("slug"), value: String(prefill.slug) })
  }

  if (typeof prefill.price === "number") {
    rows.push({ label: t("price"), value: String(prefill.price) })
  }
  if (typeof prefill.sale_price === "number") {
    rows.push({ label: t("salePrice"), value: String(prefill.sale_price) })
  }
  if (typeof prefill.quantity === "number") {
    rows.push({ label: t("quantity"), value: String(prefill.quantity) })
  }
  if (typeof prefill.status === "string") {
    rows.push({ label: t("status"), value: statusLabel(prefill.status) })
  }
  if (typeof prefill.sku === "string" && prefill.sku) {
    rows.push({ label: t("sku"), value: String(prefill.sku) })
  }

  // Coupon-shaped prefills (code + discount) — the product fields above
  // don't apply, so surface the high-signal coupon values instead.
  if (typeof prefill.code === "string" && prefill.code) {
    rows.push({ label: t("code"), value: String(prefill.code) })
  }
  const couponType = typeof prefill.type === "string" ? prefill.type : null
  if (couponType === "free_shipping") {
    rows.push({ label: t("discount"), value: t("freeShipping") })
  } else if (couponType === "buy_x_get_y") {
    const buy = prefill.buy_quantity
    const get = prefill.get_quantity
    if (typeof buy === "number" && typeof get === "number") {
      rows.push({ label: t("discount"), value: t("buyGet", { buy, get }) })
    }
  } else if (couponType && typeof prefill.amount === "number") {
    const isPercent = prefill.value_type !== "fixed"
    rows.push({
      label: t("discount"),
      value: isPercent ? `${prefill.amount}%` : String(prefill.amount),
    })
  }

  return rows
}
