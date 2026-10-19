"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { useMutation, useQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"
import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { centsToMajor, formatDate } from "@/shared/lib/format"
import {
  SubscriptionInterval,
  SubscriptionStatus,
} from "@/shared/api/generated/graphql"
import {
  ADMIN_ASSIGN_SHOP_PLAN,
  ADMIN_CANCEL_SHOP_SUBSCRIPTION,
  ADMIN_FEATURE_CATALOG,
  ADMIN_PLANS,
  ADMIN_RECONCILE_SHOP_SUBSCRIPTION,
  ADMIN_RENEW_SHOP_SUBSCRIPTION,
  ADMIN_RESET_SHOP_USAGE,
  ADMIN_SHOP_SUBSCRIPTIONS,
} from "../api"
import {
  SUBSCRIBER_TABS,
  subscriberHref,
  tabFromPath,
  type SubscriberTab,
} from "../nav"
import type { PlanRow, SubscriptionRow } from "../types"
import { ActionResult, DetailShell, buildTabs } from "./detail-shell"
import { SubscriptionOverrides } from "./subscription-overrides"
import { ShopUsage } from "./shop-usage"

/**
 * One store's subscription: where it stands, what it has been granted on top,
 * and what it has consumed.
 *
 * This replaces a four-tab dialog. Everything an admin can do to a subscription
 * lived inside it — assign, renew, reset usage, cancel — stacked behind a
 * `Manage` button on a table row, with no URL of its own and no room for the
 * two things the console could not show at all: the store's overrides, and what
 * it has actually used.
 *
 * **What Stripe bills, this screen does not pretend to own.** For a
 * Stripe-billed row, renewal is refused and says why: the date comes from a
 * card being charged, and moving it here would be a promise nothing collects
 * on. Cancel still works — the server ends it at Stripe too.
 */
export function SubscriberDetail({ shopId }: { shopId: string }) {
  const t = useTranslations("plans")
  const locale = useLocale()
  const pathname = usePathname() ?? ""
  const tab = tabFromPath<SubscriberTab>(
    pathname,
    SUBSCRIBER_TABS,
    "overview",
  )

  // The newest row for this shop, live or not. `shopSubscriptions` returns
  // history, and the first page ordered as the server orders it is the current
  // one — there is no subscription-by-shop query, and adding one to render a
  // detail screen would be a second way to ask the same question.
  const { data, loading, refetch } = useQuery(ADMIN_SHOP_SUBSCRIPTIONS, {
    variables: { shop_id: shopId, page: 1, limit: 1 },
    fetchPolicy: "cache-and-network",
  })
  const { data: plansData } = useQuery(ADMIN_PLANS)

  const row = data?.shopSubscriptions.data?.[0]
  const plans = plansData?.allPlans.data ?? []

  if (loading && !row) {
    return <p className="text-sm text-muted-foreground">{t("loadingCapabilities")}</p>
  }
  if (!row) {
    return (
      <p className="text-sm text-muted-foreground">{t("subscriberNotFound")}</p>
    )
  }

  return (
    <DetailShell
      backHref="/subscribers"
      backLabel={t("backToSubscribers")}
      title={row.shop_name ?? slugOf(row)}
      meta={
        <>
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {slugOf(row)}
          </code>
          <Badge
            variant={
              row.status === SubscriptionStatus.PastDue
                ? "destructive"
                : row.status === SubscriptionStatus.Active
                  ? "default"
                  : "secondary"
            }
          >
            {t(`statusFilter.${row.status.toLowerCase()}`)}
          </Badge>
          {row.is_stripe_billed ? (
            <Badge variant="outline">{t("stripeBilled")}</Badge>
          ) : (
            <Badge variant="secondary">{t("assigned")}</Badge>
          )}
        </>
      }
      subtitle={t("onPlan", {
        code: row.plan_code,
        status: t(`statusFilter.${row.status.toLowerCase()}`),
        billing: row.is_stripe_billed
          ? t("billedByStripe")
          : t("assignedByAdmin"),
      })}
      tabs={buildTabs(
        SUBSCRIBER_TABS,
        tab,
        (value) => subscriberHref(shopId, value),
        (value) => t(`subscriberTab.${value}`),
      )}
    >
      {tab === "overview" && (
        <SubscriptionActions
          row={row}
          plans={plans}
          locale={locale}
          onDone={() => void refetch()}
        />
      )}
      {tab === "overrides" && <SubscriptionOverrides shopId={shopId} />}
      {tab === "usage" && (
        <ShopUsage shopId={shopId} shopSlug={slugOf(row)} />
      )}
    </DetailShell>
  )
}

type Run = (action: () => Promise<unknown>, success: string) => Promise<void>

/**
 * What to call this store.
 *
 * `shop_slug` is nullable on the wire — the subscription outlives the shop, and
 * a hard-deleted one leaves rows with no slug to join. The id is never pretty
 * but it is always there, and a confirm dialog that says "Cancel undefined's
 * plan" is worse than one that says an id.
 */
function slugOf(row: SubscriptionRow): string {
  return row.shop_slug ?? row.shop_id
}

/**
 * The four things an admin can do to a subscription, as sections rather than
 * tabs-in-a-dialog.
 *
 * They are not variations of a single edit: changing the plan takes over
 * billing, renewing extends a period, resetting usage hands back allowance,
 * cancelling ends the plan. Each has its own consequence, so each states it
 * next to its own button rather than behind a tab the admin has to open to find
 * out.
 */
function SubscriptionActions({
  row,
  plans,
  locale,
  onDone,
}: {
  row: SubscriptionRow
  plans: PlanRow[]
  locale: string
  onDone: () => void
}) {
  const t = useTranslations("plans")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  /** Runs a mutation, surfacing its message either way. Never throws. */
  const run: Run = async (action, success) => {
    setError(null)
    setNotice(null)
    try {
      await action()
      setNotice(success)
      onDone()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <ActionResult error={error} notice={notice} />

      <section className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <dl className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
          <Row label={t("col.plan")}>{row.plan_code}</Row>
          <Row label={t("col.price")}>
            {centsToMajor(row.price_cents_snapshot).toFixed(2)}{" "}
            {row.interval === "YEARLY" ? t("yearly") : t("monthly")}
          </Row>
          <Row label={t("col.periodEnds")}>
            {formatDate(row.current_period_end, locale)}
          </Row>
          <Row label={t("col.trial")}>
            {row.trial_ends_at ? formatDate(row.trial_ends_at, locale) : "—"}
          </Row>
        </dl>
      </section>

      <SyncFromStripe row={row} run={run} />
      <ChangePlan row={row} plans={plans} run={run} />
      <Renew row={row} run={run} />
      <ResetQuota row={row} run={run} />
      <CancelSubscription row={row} run={run} />
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed py-1.5 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{children}</dd>
    </div>
  )
}

function Card({
  title,
  hint,
  children,
}: {
  title: string
  hint?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      <div>
        <h2 className="font-medium">{title}</h2>
        {hint && (
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
      {children}
    </section>
  )
}

/**
 * Re-read this shop's subscription from Stripe.
 *
 * Not a fifth action on the subscription — it is the answer to "the row on this
 * screen may be wrong". Our row is written by webhooks alone, so a delivery
 * that never landed leaves it stale forever and no refresh can help; this asks
 * Stripe.
 */
function SyncFromStripe({ row, run }: { row: SubscriptionRow; run: Run }) {
  const t = useTranslations("plans")
  const [reconcile, { loading }] = useMutation(
    ADMIN_RECONCILE_SHOP_SUBSCRIPTION,
  )

  return (
    <Card title={t("syncTitle")} hint={t("syncHint")}>
      <Button
        size="sm"
        variant="outline"
        disabled={loading}
        onClick={() =>
          void run(
            () => reconcile({ variables: { shop_id: row.shop_id } }),
            t("syncedOk"),
          )
        }
      >
        {loading ? t("syncing") : t("sync")}
      </Button>
    </Card>
  )
}

/**
 * Move the shop to another tier.
 *
 * This is `assignShopPlan` — a hand-assigned row with no Stripe subscription
 * behind it. For a shop that pays by card that is a takeover, not an upgrade:
 * the server cancels the Stripe subscription, so the shop stops being charged
 * and starts being granted. Said plainly here, because it cannot be undone from
 * this console — getting back onto Stripe means the vendor going through
 * Checkout again.
 */
function ChangePlan({
  row,
  plans,
  run,
}: {
  row: SubscriptionRow
  plans: PlanRow[]
  run: Run
}) {
  const t = useTranslations("plans")
  const [planId, setPlanId] = useState(row.plan_id)
  const [interval, setInterval] = useState<SubscriptionInterval>(
    row.interval as SubscriptionInterval,
  )
  const [note, setNote] = useState("")
  const [assign, { loading }] = useMutation(ADMIN_ASSIGN_SHOP_PLAN)

  const target = plans.find((p) => p.id === planId)
  const unchanged = planId === row.plan_id && interval === row.interval

  return (
    <Card title={t("changePlanTitle")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("plan")}</Label>
          {/* `null` is the Select's clear signal; there is no "no plan" here,
              so it is ignored rather than blanking a required choice. */}
          <Select value={planId} onValueChange={(v) => v && setPlanId(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {plans.map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>
                  {plan.name} ({plan.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>{t("interval")}</Label>
          <Select
            value={interval}
            onValueChange={(v) => v && setInterval(v as SubscriptionInterval)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SubscriptionInterval.Monthly}>
                {t("monthly")}
              </SelectItem>
              <SelectItem value={SubscriptionInterval.Yearly}>
                {t("yearly")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label>{t("col.note")}</Label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("noteWhy")}
          />
        </div>
      </div>

      {row.is_stripe_billed && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("stripeTakeoverWarning")}
        </p>
      )}

      <Button
        size="sm"
        disabled={loading || unchanged || !target}
        onClick={() =>
          void run(
            () =>
              assign({
                variables: {
                  input: {
                    shop_id: row.shop_id,
                    plan_id: planId,
                    interval,
                    note: note || undefined,
                  },
                },
              }),
            t("assignedOk", { code: target?.code ?? "" }),
          )
        }
      >
        {unchanged
          ? t("alreadyOnPlan")
          : t("assignPlan", { code: target?.code ?? "" })}
      </Button>
    </Card>
  )
}

/**
 * Extend a hand-assigned subscription by another period.
 *
 * The window is measured from the current period end when that is still in the
 * future, so renewing early adds days rather than throwing away the remainder.
 */
function Renew({ row, run }: { row: SubscriptionRow; run: Run }) {
  const t = useTranslations("plans")
  const [days, setDays] = useState("")
  const [note, setNote] = useState("")
  const [renew, { loading }] = useMutation(ADMIN_RENEW_SHOP_SUBSCRIPTION)

  if (row.is_stripe_billed) {
    return <Card title={t("renewTitle")} hint={t("renewBlocked")}>{null}</Card>
  }

  const parsed = days.trim() ? Number(days) : undefined
  const invalid =
    parsed !== undefined && (!Number.isInteger(parsed) || parsed < 1)
  const anchor =
    new Date(row.current_period_end) > new Date()
      ? t("anchorFuture")
      : t("anchorPast")

  return (
    <Card title={t("renewTitle")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("periodLength")}</Label>
          <Input
            value={days}
            onChange={(e) => setDays(e.target.value)}
            inputMode="numeric"
            placeholder={row.interval === "YEARLY" ? "365" : "30"}
          />
          <p className="text-xs text-muted-foreground">
            {t("periodLengthHint", { anchor })}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>{t("col.note")}</Label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("noteWhy")}
          />
        </div>
      </div>

      <Button
        size="sm"
        disabled={loading || invalid}
        onClick={() =>
          void run(
            () =>
              renew({
                variables: {
                  input: {
                    shop_id: row.shop_id,
                    period_days: parsed,
                    note: note || undefined,
                  },
                },
              }),
            t("renewedOk"),
          )
        }
      >
        {t("renew")}
      </Button>
    </Card>
  )
}

/**
 * Hand back consumed allowance.
 *
 * Distinct from an override, which moves the ceiling: a shop that has spent
 * 200 of 200 images is not helped by a limit of 300 if what went wrong is that
 * the 200 should never have been charged. This is the counter itself.
 */
function ResetQuota({ row, run }: { row: SubscriptionRow; run: Run }) {
  const t = useTranslations("plans")
  const [featureKey, setFeatureKey] = useState("all")
  const [note, setNote] = useState("")
  const { data } = useQuery(ADMIN_FEATURE_CATALOG)
  const [reset, { loading }] = useMutation(ADMIN_RESET_SHOP_USAGE)

  // Boolean capabilities have no counter to reset — offering them would be an
  // action that always reports zero rows cleared.
  const metered = (data?.featureCatalog.data ?? []).filter(
    (f) => f.kind !== "BOOLEAN",
  )

  return (
    <Card title={t("quotaTitle")} hint={t("resetHint")}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("col.capability")}</Label>
          <Select value={featureKey} onValueChange={(v) => v && setFeatureKey(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("everything")}</SelectItem>
              {metered.map((f) => (
                <SelectItem key={f.key} value={f.key}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>{t("col.note")}</Label>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("noteWhy")}
          />
        </div>
      </div>

      <Button
        size="sm"
        disabled={loading}
        onClick={() => {
          const scope =
            featureKey === "all"
              ? t("everyCounter")
              : t("oneCounter", { key: featureKey })
          if (
            !window.confirm(t("resetConfirm", { scope, slug: slugOf(row) }))
          ) {
            return
          }
          void run(
            () =>
              reset({
                variables: {
                  input: {
                    shop_id: row.shop_id,
                    feature_key: featureKey === "all" ? undefined : featureKey,
                    note: note || undefined,
                  },
                },
              }),
            t("usageResetOk"),
          )
        }}
      >
        {t("resetUsage")}
      </Button>
    </Card>
  )
}

/**
 * End the plan now.
 *
 * Immediate, not at the period end — this is the admin action, not the
 * vendor's own scheduled cancellation. The shop drops to FREE and the server
 * cancels the Stripe subscription too, so it stops being charged.
 */
function CancelSubscription({ row, run }: { row: SubscriptionRow; run: Run }) {
  const t = useTranslations("plans")
  const [cancel, { loading }] = useMutation(ADMIN_CANCEL_SHOP_SUBSCRIPTION)

  return (
    <Card
      title={t("cancelTitle")}
      hint={
        <span className="text-destructive">
          {t("cancelWarning")}
          {row.is_stripe_billed ? ` ${t("cancelWarningStripe")}` : ""}
        </span>
      }
    >
      <Button
        variant="destructive"
        size="sm"
        disabled={loading}
        onClick={() => {
          if (
            !window.confirm(
              t("cancelConfirm", {
                slug: slugOf(row),
                code: row.plan_code,
              }),
            )
          ) {
            return
          }
          void run(
            () => cancel({ variables: { shop_id: row.shop_id } }),
            t("canceledOk"),
          )
        }}
      >
        {t("cancelSubscription")}
      </Button>
    </Card>
  )
}
