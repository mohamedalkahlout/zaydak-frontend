"use client"

import { useState } from "react"
import { useQuery } from "@apollo/client/react"
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
import { GET_MY_ENTITLEMENTS, GET_MY_PLAN } from "../api/queries"
import { formatReset } from "../lib/format-unit"
import { useBillingPortal } from "../lib/use-billing-portal"
import { useSubscriptionLifecycle } from "../lib/use-subscription-lifecycle"
import { BillingHistory } from "./billing-history"
import type { MyPlanEntry } from "../types"

/**
 * Money: the card, the receipts, and the way out.
 *
 * All three were previously spread across the plan screen — the portal button
 * next to the plan name, cancellation beside it, and the invoice table at the
 * bottom past the comparison grid. They belong together because they are the
 * same decision surface: everything here changes what gets charged.
 *
 * We host none of it. Cards and receipts live in Stripe's portal, because
 * rebuilding SCA, dunning and PDF receipts here would be a second, worse copy
 * of something that already works.
 */
export function BillingPage() {
  const locale = useLocale()
  const t = useTranslations("plan")
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const { data, refetch } = useQuery<{
    myPlan: { success: boolean; data?: MyPlanEntry }
  }>(GET_MY_PLAN)
  const { refetch: refetchEntitlements } = useQuery<{
    myEntitlements: { success: boolean; data?: unknown[] }
  }>(GET_MY_ENTITLEMENTS)

  const portal = useBillingPortal()
  // Cancel and resume both land immediately at Stripe, so one refetch after
  // each is enough — unlike checkout, there is no webhook race to poll through.
  const subscription = useSubscriptionLifecycle(() => {
    void refetch()
    void refetchEntitlements()
  })

  const my = data?.myPlan.data
  if (!my) return null

  const renews = formatReset(my.current_period_end, locale)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold">
          {t("tab.billing")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("billingPageHint")}
        </p>
      </div>

      {/*
        Billing off on this deployment: an admin assigns plans by hand, so
        saying so beats a button that always errors.
      */}
      {!my.billing_enabled && (
        <p className="rounded-xl border bg-card px-5 py-4 text-sm text-muted-foreground">
          {t("changeNote")}
        </p>
      )}

      {/*
        No Stripe customer: a shop an admin put on a plan by hand has no card
        on file and no invoices. An empty portal button and an empty table
        would both read as faults rather than as the truth.
      */}
      {my.billing_enabled && !my.has_billing_account && (
        <p className="rounded-xl border bg-card px-5 py-4 text-sm text-muted-foreground">
          {t("noBillingAccount")}
        </p>
      )}

      {my.billing_enabled && my.has_billing_account && (
        <>
          <section className="rounded-xl border bg-card p-5">
            <h2 className="font-medium">{t("paymentMethodTitle")}</h2>
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">
              {t("manageBillingHint")}
            </p>
            <Button
              className="mt-4"
              size="sm"
              variant="outline"
              disabled={portal.pending}
              onClick={portal.open}
            >
              {portal.pending ? t("redirecting") : t("manageBilling")}
            </Button>
          </section>

          <BillingHistory />

          {/*
            Cancellation last, and in its own card. It is the one irreversible-
            feeling action on the screen, and putting it beside "manage cards"
            is how it gets clicked by someone looking for the other thing.
          */}
          {!my.is_fallback && (
            <section className="rounded-xl border bg-card p-5">
              <h2 className="font-medium">
                {my.cancel_at_period_end
                  ? t("resumeSubscription")
                  : t("cancelSubscription")}
              </h2>
              <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                {my.cancel_at_period_end
                  ? renews
                    ? t("cancelScheduled", { date: renews })
                    : t("alertEndingBodyNoDate")
                  : t("cancelHint")}
              </p>
              {/*
                Cancel and resume are ours, not Stripe's portal: leaving the app
                in Arabic for an English page to stop paying is the worst moment
                to hand a vendor off. The portal keeps cards, which we
                deliberately never touch.
              */}
              <Button
                className="mt-4"
                size="sm"
                variant={my.cancel_at_period_end ? "default" : "outline"}
                disabled={subscription.pending}
                onClick={() =>
                  my.cancel_at_period_end
                    ? void subscription.resume()
                    : setConfirmingCancel(true)
                }
              >
                {my.cancel_at_period_end
                  ? t("resumeSubscription")
                  : t("cancelSubscription")}
              </Button>
            </section>
          )}
        </>
      )}

      {/*
        Cancelling is confirmed, resuming is not. One ends a paid relationship;
        the other only undoes it, and a dialog in front of "keep my plan" is
        friction for no one's benefit.
      */}
      <Dialog
        open={confirmingCancel}
        onOpenChange={(open) => !open && setConfirmingCancel(false)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("confirmCancelTitle")}</DialogTitle>
            <DialogDescription>
              {renews
                ? t("confirmCancelBody", { date: renews })
                : t("confirmCancelBodyNoDate")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={
                <Button
                  variant="outline"
                  size="sm"
                  disabled={subscription.pending}
                >
                  {t("keepPlan")}
                </Button>
              }
            />
            <Button
              variant="destructive"
              size="sm"
              disabled={subscription.pending}
              onClick={() => {
                setConfirmingCancel(false)
                void subscription.cancel()
              }}
            >
              {t("confirmCancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
