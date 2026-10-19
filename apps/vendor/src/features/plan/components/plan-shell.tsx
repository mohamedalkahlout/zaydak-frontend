"use client"

import { useEffect, useRef } from "react"
import { useParams, usePathname } from "next/navigation"
import Link from "next/link"
import { useMutation, useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { sileo } from "sileo"
import { cn } from "@repo/ui/lib/utils"
import { GET_MY_ENTITLEMENTS, GET_MY_PLAN } from "../api/queries"
import { SYNC_MY_SUBSCRIPTION } from "../api/mutations"
import { pickLocale } from "../lib/localize"
import { PLAN_TABS, planTabFromPath, planTabUrl } from "../lib/routes"
import { isPeriodExpired } from "../lib/status"
import { useBillingPortal } from "../lib/use-billing-portal"
import { useSubscriptionLifecycle } from "../lib/use-subscription-lifecycle"
import { PlanAlert } from "./plan-alert"
import { PlanPageHeader } from "./plan-page-header"
import type { MyPlanEntry } from "../types"

/**
 * How long to keep re-asking the server after a successful checkout.
 *
 * Stripe's webhook is what opens the subscription, and it races the browser's
 * redirect back here. Usually it wins by well under a second; this bounds the
 * case where it does not, so the vendor sees their new plan appear instead of
 * the old one plus a success message that contradicts it.
 */
const RETURN_POLL_ATTEMPTS = 6
const RETURN_POLL_MS = 1500

/**
 * Everything the four plan routes have in common: the way back, what the store
 * is on, the tabs, and anything that has gone wrong.
 *
 * It lives in the **layout** rather than in each page for two reasons. The
 * alert is the one thing that must be visible from every tab — a failed card is
 * not news that belongs only on the billing page — and the return from Stripe
 * lands on whichever URL the session was opened from, so the poll that waits
 * for the webhook has to run above all of them.
 *
 * `myPlan` is queried here and again by the pages that need it. That is one
 * network request: Apollo dedupes the identical document, and the alternative —
 * threading the plan down through a layout to a page — is not something the App
 * Router lets you do without a context provider nobody else would use.
 */
export function PlanShell({ children }: { children: React.ReactNode }) {
  const locale = useLocale()
  const t = useTranslations("plan")
  const pathname = usePathname()
  const params = useParams<{ shopSlug?: string }>()
  const shopSlug = params?.shopSlug ?? null

  const { data, loading, refetch } = useQuery<{
    myPlan: { success: boolean; data?: MyPlanEntry }
  }>(GET_MY_PLAN)
  const { refetch: refetchEntitlements } = useQuery<{
    myEntitlements: { success: boolean; data?: unknown[] }
  }>(GET_MY_ENTITLEMENTS)

  const portal = useBillingPortal()
  const subscription = useSubscriptionLifecycle(() => {
    void refetch()
    void refetchEntitlements()
  })

  useCheckoutReturn(() => {
    void refetch()
    void refetchEntitlements()
  })

  const my = data?.myPlan.data
  const tab = planTabFromPath(pathname ?? "")
  const storeHref = shopSlug ? `/store/${shopSlug}` : "/store"

  if (loading && !my) {
    return <p className="p-6 text-sm text-muted-foreground">{t("loading")}</p>
  }
  if (!my) {
    return (
      <p className="p-6 text-sm text-muted-foreground">{t("unavailable")}</p>
    )
  }

  return (
    <>
      <PlanPageHeader
        backHref={storeHref}
        planName={pickLocale(my.plan.name, my.plan.name_ar, locale)}
        badge={
          // Expired first. Without it the loudest "where do I stand" line on
          // every plan tab stays silent for a closed window — the status is
          // still ACTIVE and `is_fallback` is still false — while the alert
          // right below it says the plan is gone.
          isPeriodExpired(my)
            ? t("sidebarExpired")
            : my.status === "TRIALING"
              ? t("trial")
              : my.is_fallback
                ? t("free")
                : null
        }
      />

      {/*
        The tabs sit under the header rather than in it: the header states where
        the vendor stands, and that fact must not scroll away or move when the
        tab does. Sticky under it so the switch is always one click from
        anywhere on a long comparison table.
      */}
      <nav
        aria-label={t("sectionsLabel")}
        className="sticky top-14 z-10 border-b bg-background/85 backdrop-blur"
      >
        <div className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4">
          {PLAN_TABS.map((value) => {
            const active = tab === value
            return (
              <Link
                key={value}
                href={shopSlug ? planTabUrl(shopSlug, value) : "#"}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`tab.${value}`)}
              </Link>
            )
          })}
        </div>
      </nav>

      <main className="mx-auto w-full max-w-6xl space-y-8 px-4 pt-6 pb-20">
        {/* Anything wrong, first, on every tab. */}
        <PlanAlert
          my={my}
          pending={subscription.pending}
          portalPending={portal.pending}
          onManageBilling={portal.open}
          onResume={() => void subscription.resume()}
          plansHref={shopSlug ? planTabUrl(shopSlug, "plans") : null}
        />

        {children}

        <p className="text-xs text-muted-foreground">{t("supportNote")}</p>
      </main>
    </>
  )
}

/**
 * Coming back from Stripe Checkout.
 *
 * The poll asks `syncMySubscription`, not `myPlan`. `myPlan` reads a row only
 * the webhook writes, so if the event is never delivered — an endpoint that was
 * down, a tunnel that was not running — every attempt re-reads the same stale
 * row and the vendor watches a spinner resolve to "no plan" after paying. Sync
 * re-reads Stripe itself, so a lost webhook costs a few seconds here instead of
 * a support ticket.
 *
 * `useSearchParams` is deliberately not used: it opts the whole subtree into a
 * Suspense boundary in the App Router, and this reads one parameter once on
 * arrival. `window.location.search` is the same value without the constraint.
 */
function useCheckoutReturn(onSettled: () => void) {
  const t = useTranslations("plan")
  const handled = useRef(false)
  // Latest-callback ref, updated from an effect rather than during render: a
  // render-phase ref write is unsafe once React discards a speculative render.
  // Declared before the effect that reads it, so it is already fresh by the
  // time that one runs on the same commit.
  const settled = useRef(onSettled)
  useEffect(() => {
    settled.current = onSettled
  })

  const [syncSubscription] = useMutation<{
    // A narrower selection than `myPlan` on purpose — the poll only needs to
    // know whether a real subscription exists yet.
    syncMySubscription: { success: boolean; data?: { is_fallback: boolean } }
  }>(SYNC_MY_SUBSCRIPTION)

  useEffect(() => {
    // Once per arrival. Without the ref this re-fires on every render that
    // touches the query string, re-toasting a payment already acknowledged.
    if (handled.current) return
    const result = new URLSearchParams(window.location.search).get("billing")
    if (!result) return
    handled.current = true

    if (result === "canceled") {
      // Nothing was charged and nothing was written. Say so plainly rather
      // than treating a deliberate back-out as a failure.
      sileo.info({ title: t("checkoutCanceled") })
      return
    }
    if (result !== "success") return

    sileo.success({ title: t("checkoutSuccess") })

    let attempts = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false

    const poll = async () => {
      attempts += 1
      const res = await syncSubscription()
      const fresh = res.data?.syncMySubscription.data
      if (stopped) return
      if (fresh && !fresh.is_fallback) {
        settled.current()
        return
      }
      if (attempts < RETURN_POLL_ATTEMPTS) {
        timer = setTimeout(() => void poll(), RETURN_POLL_MS)
      }
    }
    void poll()

    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
  }, [syncSubscription, t])
}
