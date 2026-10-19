"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"
import { centsToMajor } from "@/shared/lib/format"
import { ADMIN_PLANS, ADMIN_PLAN_ENTITLEMENTS } from "../api"
import { PLAN_TABS, planHref, tabFromPath, type PlanTab } from "../nav"
import type { PlanRow } from "../types"
import { DetailShell, buildTabs } from "./detail-shell"
import { EntitlementMatrix } from "./entitlement-matrix"
import { PlanFormDialog } from "./plan-form-dialog"
import { SubscribersTable } from "./subscribers-table"

/**
 * One plan, on three tabs: what it costs, what it grants, and who is on it.
 *
 * The three were previously a table row, an accordion under that row, and a
 * filter on a different screen. They are the same record, and an admin editing
 * a tier's matrix almost always wants to know how many stores that lands on.
 */
export function PlanDetail({ planId }: { planId: string }) {
  const t = useTranslations("plans")
  const pathname = usePathname() ?? ""
  const tab = tabFromPath<PlanTab>(pathname, PLAN_TABS, "overview")

  // Read from the list query rather than a plan-by-id operation: there is no
  // such query on the server, the list is small and already cached from the
  // screen the admin arrived from, so this renders without a round trip.
  const { data, loading, refetch } = useQuery(ADMIN_PLANS)
  const plan = data?.allPlans.data?.find((p) => p.id === planId)

  if (loading && !plan) {
    return <p className="text-sm text-muted-foreground">{t("loadingCapabilities")}</p>
  }
  if (!plan) {
    return <p className="text-sm text-muted-foreground">{t("planNotFound")}</p>
  }

  return (
    <DetailShell
      backHref="/plans"
      backLabel={t("backToPlans")}
      title={plan.name}
      meta={
        <>
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {plan.code}
          </code>
          {plan.is_public ? (
            <Badge variant="outline">{t("visibility.public")}</Badge>
          ) : (
            <Badge variant="secondary">{t("visibility.hidden")}</Badge>
          )}
        </>
      }
      subtitle={plan.description}
      tabs={buildTabs(
        PLAN_TABS,
        tab,
        (value) => planHref(planId, value),
        (value) => t(`planTab.${value}`),
      )}
    >
      {tab === "overview" && (
        <PlanOverview plan={plan} onSaved={() => void refetch()} />
      )}
      {tab === "capabilities" && (
        <PlanCapabilities planId={planId} planCode={plan.code} />
      )}
      {tab === "subscribers" && (
        <SubscribersTable
          planId={planId}
          title={t("planTab.subscribers")}
          subtitle={t("planSubscribersHint")}
        />
      )}
    </DetailShell>
  )
}

/** Price, trial and visibility — the fields the create form also owns. */
function PlanOverview({
  plan,
  onSaved,
}: {
  plan: PlanRow
  onSaved: () => void
}) {
  const t = useTranslations("plans")
  const [editing, setEditing] = useState(false)

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-medium">{t("pricing")}</h2>
            <dl className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
              <Row label={t("col.monthly")}>
                {centsToMajor(plan.monthly_price_cents).toFixed(2)} {plan.currency}
              </Row>
              <Row label={t("col.yearly")}>
                {centsToMajor(plan.yearly_price_cents).toFixed(2)} {plan.currency}
              </Row>
              <Row label={t("col.trial")}>
                {plan.trial_days
                  ? t("trialDays", { days: plan.trial_days })
                  : t("noTrial")}
              </Row>
              <Row label={t("col.visibility")}>
                {plan.is_public
                  ? t("visibility.public")
                  : t("visibility.hidden")}
              </Row>
            </dl>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            {t("edit")}
          </Button>
        </div>
      </section>

      {editing && (
        <PlanFormDialog
          plan={plan}
          onClose={() => setEditing(false)}
          onSaved={onSaved}
        />
      )}
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

/**
 * The matrix for one plan.
 *
 * Loads the plan's own rows first and only renders once they are in. Opening a
 * matrix that shows every capability off while the read is in flight invites an
 * admin to "fix" a switch that was never wrong, and `setPlanEntitlements` would
 * dutifully write it.
 */
function PlanCapabilities({
  planId,
  planCode,
}: {
  planId: string
  planCode: string
}) {
  const t = useTranslations("plans")
  const { data, loading } = useQuery(ADMIN_PLAN_ENTITLEMENTS, {
    variables: { plan_id: planId },
    // The console is the only writer, but two admins on the same plan is
    // exactly when a stale cache turns into a lost edit.
    fetchPolicy: "cache-and-network",
  })

  if (loading && !data) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("loadingCapabilities")}
      </p>
    )
  }

  const initial = Object.fromEntries(
    (data?.planEntitlements.data ?? []).map((row) => [
      row.feature_key,
      {
        enabled: row.enabled,
        limit_value: row.limit_value,
        config: (row.config ?? {}) as Record<string, unknown>,
      },
    ]),
  )

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-medium">{t("capabilitiesTitle")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("capabilitiesHint", { code: planCode })}
        </p>
      </div>
      <EntitlementMatrix planId={planId} planCode={planCode} initial={initial} />
    </div>
  )
}
