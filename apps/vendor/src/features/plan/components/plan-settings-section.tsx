"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useSuspenseQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { ChevronRight, Receipt } from "lucide-react"
import { Badge } from "@repo/ui/components/badge"
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
import { SettingsCard } from "@/features/settings/components/settings-card"
import { GET_MY_PLAN } from "../api/queries"
import { formatPrice, formatReset } from "../lib/format-unit"
import { pickLocale } from "../lib/localize"
import { planTabUrl, planUrl } from "../lib/routes"
import {
  daysUntil,
  subscriptionState,
  type SubscriptionState,
} from "../lib/status"
import { useBillingPortal } from "../lib/use-billing-portal"
import { useSubscriptionLifecycle } from "../lib/use-subscription-lifecycle"
import { PlanAlert } from "./plan-alert"
import type { MyPlanEntry } from "../types"

/**
 * How each subscription state colours its pill. Light-only on purpose: the
 * settings overlay paints its own `#f1f1f1` ground and does not theme.
 */
const STATE_BADGE: Record<
  SubscriptionState,
  { variant: "secondary" | "destructive" | "outline"; className?: string }
> = {
  trialing: { variant: "secondary", className: "bg-emerald-100 text-emerald-900" },
  current: { variant: "secondary", className: "bg-emerald-100 text-emerald-900" },
  ending: { variant: "secondary", className: "bg-amber-100 text-amber-900" },
  past_due: { variant: "destructive" },
  expired: { variant: "destructive" },
  free: { variant: "outline" },
}

/**
 * Plan, as a pane of the settings overlay.
 *
 * Settings is where a vendor goes looking for their plan — it is in the rail,
 * between General and Billing — and clicking it used to throw them out of the
 * overlay onto a full-viewport route. That route still exists and still owns
 * every long answer: the tier comparison, the usage ledger, the invoices. What
 * belongs *here* is the short one — "what am I on, and what can I do about it" —
 * and that is one row with two buttons.
 *
 * So this pane deliberately renders no comparison table and no meters. The
 * reason Plan was moved out in the first place was that a four-column pricing
 * grid does not fit a 640px pane; nothing here tries to.
 */
export function PlanSettingsSection() {
  const locale = useLocale()
  const t = useTranslations("plan")
  const tS = useTranslations("settings.plan")
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  // Suspense reader, so the server page's `PreloadQuery` streams the pane
  // with the plan in it rather than a loading card the client replaces.
  const { data, refetch } = useSuspenseQuery<{
    myPlan: { success: boolean; data?: MyPlanEntry }
  }>(GET_MY_PLAN)

  // Only `myPlan` is refetched. Cancelling and resuming move the date the
  // subscription ends and nothing else — the shop keeps every capability it had
  // until then — so `myEntitlements` cannot have changed and asking for it
  // again would be a request that can only return the same answer.
  const subscription = useSubscriptionLifecycle(() => void refetch())
  const portal = useBillingPortal()

  const my = data?.myPlan.data
  if (!my) {
    return (
      <div className="rounded-xl bg-card px-4 py-6 text-sm text-muted-foreground ring-1 ring-foreground/10">
        {t("unavailable")}
      </div>
    )
  }

  const state = subscriptionState(my)
  const planName = pickLocale(my.plan.name, my.plan.name_ar, locale)
  const periodEnd = formatReset(my.current_period_end, locale)
  // On a trial the date that matters is when the trial runs out, which is not
  // always the period end — a subscription an admin opened by hand can carry a
  // trial that ends inside its first period.
  const trialEnd = formatReset(my.trial_ends_at, locale) ?? periodEnd
  const cancelDate = state === "trialing" ? trialEnd : periodEnd

  const badge = {
    // Rounded up, so a trial with eighteen hours left reads as its last day
    // rather than as already expired.
    trialing: t("sidebarTrialDays", { days: daysUntil(my.trial_ends_at) }),
    past_due: t("sidebarPaymentFailed"),
    expired: t("sidebarExpired"),
    ending: periodEnd ? t("endsOn", { date: periodEnd }) : tS("ending"),
    free: t("free"),
    current: tS("active"),
  }[state]

  const pendingName = my.pending_plan
    ? pickLocale(my.pending_plan.name, my.pending_plan.name_ar, locale)
    : null
  const pendingDate = formatReset(my.pending_change_at, locale)

  // The one line under the plan name: what it costs, and what happens next.
  // A scheduled downgrade outranks both a renewal and a cancellation — it is
  // the most recent decision, and "renews" beside it would contradict it.
  const price = my.is_fallback
    ? null
    : `${formatPrice(
        my.interval === "YEARLY"
          ? my.plan.yearly_price_cents
          : my.plan.monthly_price_cents,
        my.plan.currency,
        locale,
      )} ${my.interval === "YEARLY" ? t("perYear") : t("perMonth")}`
  // Expired comes first for the same reason the scheduled change outranks a
  // renewal: the most recent truth wins, and a change scheduled for a window
  // that already closed is not going to happen on time either.
  const next =
    state === "expired"
      ? periodEnd && t("endedOn", { date: periodEnd })
      : pendingName && pendingDate
        ? t("changesOn", { name: pendingName, date: pendingDate })
        : my.cancel_at_period_end
          ? periodEnd && t("endsOn", { date: periodEnd })
          : state === "trialing"
            ? trialEnd && tS("trialEndsOn", { date: trialEnd })
            : periodEnd && t("renewsOn", { date: periodEnd })
  const subline = [price, next].filter(Boolean).join(" · ")

  return (
    <div className="flex flex-col gap-5">
      {/*
        Anything wrong, first, with its own way out: a failed card (Stripe
        retries for days while the store keeps working, so nothing else on
        screen would say so) and a scheduled end, whose undo lives here rather
        than being a second copy of the same button in the row below.
      */}
      <PlanAlert
        my={my}
        pending={subscription.pending}
        portalPending={portal.pending}
        onManageBilling={portal.open}
        onResume={() => void subscription.resume()}
        plansHref={shopSlug ? planTabUrl(shopSlug, "plans") : null}
      />

      <SettingsCard title={tS("detailsTitle")}>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-medium">{planName}</p>
              <Badge
                variant={STATE_BADGE[state].variant}
                className={STATE_BADGE[state].className}
              >
                {badge}
              </Badge>
            </div>
            {subline && (
              <p className="mt-0.5 text-xs text-muted-foreground">{subline}</p>
            )}
          </div>

          {my.billing_enabled ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {/*
                Cancelling is offered only while there is a subscription to
                cancel, and only while one is not already ending — the undo for
                that is in the alert above. A shop on the free fallback has
                nothing to leave, and an expired window has nothing left to
                cancel — on an admin-assigned row the mutation has no Stripe
                subscription to act on at all.
              */}
              {!my.is_fallback &&
                !my.cancel_at_period_end &&
                state !== "expired" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={subscription.pending}
                    onClick={() => setConfirmingCancel(true)}
                  >
                    {state === "trialing"
                      ? tS("cancelTrial")
                      : t("cancelSubscription")}
                  </Button>
                )}
              {shopSlug && (
                <Button
                  size="sm"
                  nativeButton={false}
                  render={<Link href={planTabUrl(shopSlug, "plans")} />}
                >
                  {my.is_fallback ||
                  state === "trialing" ||
                  state === "expired"
                    ? t("choosePlan")
                    : t("changePlan")}
                </Button>
              )}
            </div>
          ) : (
            /* Billing off on this deployment: an admin assigns plans by hand,
               so saying so beats a button that always errors. */
            <p className="max-w-xs text-xs text-muted-foreground">
              {t("changeNote")}
            </p>
          )}
        </div>

        {/* The long answers, on the routes that own them. */}
        {shopSlug && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-xs">
            <Link
              href={planUrl(shopSlug)}
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t("includesTitle")}
            </Link>
            <Link
              href={planTabUrl(shopSlug, "usage")}
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t("seeAllUsage")}
            </Link>
            <Link
              href={planTabUrl(shopSlug, "plans")}
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t("compareTitle")}
            </Link>
          </div>
        )}
      </SettingsCard>

      {/*
        Only with billing on. Without it there is no Stripe customer behind the
        billing tab, so the row would lead to a page whose only content is that
        it is not enabled.
      */}
      {my.billing_enabled && shopSlug && (
        <SettingsCard
          title={tS("subscriptionsTitle")}
          description={tS("subscriptionsDesc")}
        >
          <Link
            href={planTabUrl(shopSlug, "billing")}
            className="-mx-1 flex items-center gap-3 rounded-lg px-1 py-2.5 transition-colors hover:bg-muted/50"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Receipt className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {tS("viewAllSubscriptions")}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {t("billingPageHint")}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" />
          </Link>
        </SettingsCard>
      )}

      {/*
        Cancelling is confirmed; resuming is not. One ends a paid relationship,
        the other only undoes it. The trial wording is its own: nothing has been
        paid for yet, so "you already paid for it" would be false — what a
        vendor needs to hear is that no charge is coming.
      */}
      <Dialog
        open={confirmingCancel}
        onOpenChange={(open) => !open && setConfirmingCancel(false)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {state === "trialing"
                ? tS("confirmCancelTrialTitle")
                : t("confirmCancelTitle")}
            </DialogTitle>
            <DialogDescription>
              {state === "trialing"
                ? cancelDate
                  ? tS("confirmCancelTrialBody", { date: cancelDate })
                  : tS("confirmCancelTrialBodyNoDate")
                : cancelDate
                  ? t("confirmCancelBody", { date: cancelDate })
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
              {state === "trialing" ? tS("cancelTrial") : t("confirmCancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
