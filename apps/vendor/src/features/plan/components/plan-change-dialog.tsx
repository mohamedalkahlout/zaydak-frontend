"use client"

import { useLocale, useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { formatPrice } from "../lib/format-unit"
import { pickLocale } from "../lib/localize"
import type { PendingChange } from "../lib/use-plan-change"

interface Props {
  change: PendingChange | null
  confirming: boolean
  onConfirm: () => void
  onDismiss: () => void
}

/**
 * The money, before the change.
 *
 * A prorated amount is one the vendor did not choose and cannot work out from
 * the two prices on the cards — it depends on how far into the billing period
 * they are. So the dialog does not just say "confirm": it shows the credit for
 * time already paid for, the charge for the rest of the period, and what the
 * next invoice becomes. Every figure comes from Stripe's own proration engine
 * through `previewPlanChange`, so the number here is the number charged.
 *
 * A downgrade shows no amount at all, because none is taken — it says when the
 * new tier starts instead, which is the only thing that actually changes.
 */
export function PlanChangeDialog({
  change,
  confirming,
  onConfirm,
  onDismiss,
}: Props) {
  const locale = useLocale()
  const t = useTranslations("plan")
  const quote = change?.quote ?? null

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    })

  return (
    <Dialog
      open={Boolean(quote)}
      onOpenChange={(open) => !open && onDismiss()}
    >
      <DialogContent className="sm:max-w-md">
        {quote && change && (
          <>
            <DialogHeader>
              <DialogTitle>
                {quote.is_upgrade
                  ? t("confirmUpgradeTitle", {
                      name: pickLocale(
                        change.plan.name,
                        change.plan.name_ar,
                        locale,
                      ),
                    })
                  : t("confirmDowngradeTitle", {
                      name: pickLocale(
                        change.plan.name,
                        change.plan.name_ar,
                        locale,
                      ),
                    })}
              </DialogTitle>
              <DialogDescription>
                {quote.is_upgrade
                  ? t("confirmUpgradeBody")
                  : t("confirmDowngradeBody", {
                      date: formatDate(quote.effective_at),
                    })}
              </DialogDescription>
            </DialogHeader>

            {/*
              A trial makes every proration zero, so this is the one change
              where the amount jumps from nothing to the full price. Saying
              why, before the total, is the difference between a decision and
              a surprise on the statement.
            */}
            {quote.ends_trial && (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
                {t("endsTrialWarning", { plan: quote.to_plan_name })}
              </p>
            )}

            {quote.is_upgrade && (
              <dl className="space-y-2 rounded-lg border bg-muted/40 p-4 text-sm">
                {quote.credit_cents > 0 && (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted-foreground">
                      {t("unusedCredit", { plan: quote.from_plan_code })}
                    </dt>
                    <dd className="tabular-nums text-emerald-600 dark:text-emerald-500">
                      {"−"}
                      {formatPrice(quote.credit_cents, quote.currency, locale)}
                    </dd>
                  </div>
                )}
                {quote.charge_cents > 0 && (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-muted-foreground">
                      {t("remainderCharge", { plan: quote.to_plan_code })}
                    </dt>
                    <dd className="tabular-nums">
                      {formatPrice(quote.charge_cents, quote.currency, locale)}
                    </dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-4 border-t pt-2 font-medium">
                  <dt>{t("dueNow")}</dt>
                  <dd className="font-heading text-lg tabular-nums">
                    {formatPrice(
                      quote.amount_due_now_cents,
                      quote.currency,
                      locale,
                    )}
                  </dd>
                </div>
              </dl>
            )}

            <p className="text-xs text-muted-foreground">
              {t("nextInvoiceNote", {
                amount: formatPrice(
                  quote.next_invoice_cents,
                  quote.currency,
                  locale,
                ),
                date: formatDate(quote.next_invoice_at),
              })}
            </p>

            <DialogFooter>
              <DialogClose
                render={
                  <Button variant="outline" size="sm" disabled={confirming}>
                    {t("cancel")}
                  </Button>
                }
              />
              <Button size="sm" onClick={onConfirm} disabled={confirming}>
                {confirming
                  ? t("confirming")
                  : quote.is_upgrade
                    ? t("payAndSwitch", {
                        amount: formatPrice(
                          quote.amount_due_now_cents,
                          quote.currency,
                          locale,
                        ),
                      })
                    : t("scheduleChange")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
