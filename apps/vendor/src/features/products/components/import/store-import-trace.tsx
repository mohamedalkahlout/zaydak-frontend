"use client"

import { useTranslations } from "next-intl"
import type { StoreImportStrategyStep } from "@/features/products/api"
import {
  strategyLabelKey,
  strategyReasonKey,
} from "@/features/products/lib/store-import"

/**
 * "What we tried" — the strategy trace of a scan that FAILED before it
 * produced anything.
 *
 * The failure line above it says *that* the scan stopped; this says *how far
 * it got*: which ways of reading the store were tried, in order, and what each
 * one answered. "The product feed was blocked, the sitemap had no products,
 * paid page reading is not available" is something a merchant can act on (or
 * send to support) where "this import stopped" is not.
 *
 * Every reason is a translated key from the server's closed vocabulary — the
 * server never sends an error message here, so there is no raw text to show.
 * Information only: nothing on this panel is a control.
 */
export function StoreImportTrace({
  steps,
}: {
  steps: StoreImportStrategyStep[]
}) {
  const t = useTranslations("products.import.progress.trace")

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">{t("title")}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t("body")}</p>
      <ol className="mt-3 divide-y divide-border">
        {steps.map((step, index) => {
          const labelKey = strategyLabelKey(step.name)
          return (
            <li
              key={`${index}:${step.name}`}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 text-sm"
            >
              <span className="min-w-0 font-medium">
                {labelKey ? (
                  t(`strategies.${labelKey}`)
                ) : (
                  <span dir="ltr">{step.name}</span>
                )}
              </span>
              <span className="text-muted-foreground">
                {t(`reasons.${strategyReasonKey(step)}`, {
                  count: step.products,
                })}
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
