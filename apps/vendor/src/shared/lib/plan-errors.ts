"use client"

import { useCallback } from "react"
import { useTranslations } from "next-intl"
import { getValidationErrors } from "@/shared/lib/auth/graphql-errors"

/**
 * Turn a caught plan/quota GraphQL error into copy the vendor can act on.
 *
 * Generalized from the AI-image-only translator this replaces — the
 * entitlements platform raises the same *shape* of rejection for every metered
 * capability now, not just images, so the mapping belongs in one place.
 * `ai-image-errors.ts` re-exports from here; its two call sites are unchanged.
 *
 * Why it exists at all: both AI-image surfaces used to regex `err.message` for
 * `/BUDGET|MONTHLY|RATE_LIMIT/`, but `AppException.validation` hardcodes the
 * top-level message to `'Validation failed'` — the regex could never match, so
 * every quota rejection reached the vendor as "please try again". That is the
 * one piece of advice guaranteed not to work: retrying an exhausted quota
 * spends nothing and fixes nothing, and once a run can fire several images at
 * once the retry actively costs money.
 *
 * The real code lives in `extensions.validation_errors[0].code`.
 *
 * **Copy is owned here, never echoed from the server.** Two independent
 * reasons, both still true after the platform landed:
 *
 *   - `AI_BUDGET_EXCEEDED` reports the *platform's* daily spend against its cap
 *     ("Platform AI budget exhausted for today (12.50$ / 20.00$)"). That is an
 *     internal operations figure and no vendor's business.
 *   - The backend's plan messages are deliberately generic for the same reason
 *     (`src/i18n/{en,ar}/common.json`), and the AI ones are still hardcoded
 *     English template literals. Echoing either would render English inside
 *     Arabic chrome — the exact defect this module was localized to remove.
 */

/** What a backend validation code means for the vendor. */
interface PlanErrorSpec {
  /** Key under the `aiImage.errors` namespace. */
  key: string
  /**
   * True when capacity, not correctness, is the problem — retrying cannot
   * succeed until it frees up. Callers use it to suppress a retry affordance.
   */
  quota: boolean
  /**
   * True when only a bigger plan fixes it. Distinct from `quota`: an exhausted
   * monthly allowance frees up on its own at the period roll, but a capability
   * the plan excludes never will, and telling a vendor to "wait" for that is
   * worse than saying nothing.
   */
  upgrade: boolean
}

const ERROR_CODES: Record<string, PlanErrorSpec> = {
  // ─── Entitlements platform ─────────────────────────────────────────────────
  PLAN_QUOTA_EXCEEDED: { key: "planQuota", quota: true, upgrade: true },
  PLAN_LIMIT_REACHED: { key: "planLimit", quota: true, upgrade: true },
  PLAN_BATCH_EXCEEDED: { key: "planBatch", quota: false, upgrade: true },
  PLAN_OPTION_NOT_ALLOWED: { key: "planOption", quota: false, upgrade: true },
  PLAN_TOOL_NOT_AVAILABLE: { key: "notAvailable", quota: false, upgrade: true },
  FEATURE_NOT_AVAILABLE: { key: "notAvailable", quota: false, upgrade: true },

  // ─── Self-serve billing ────────────────────────────────────────────────────
  // None of these are `upgrade: true`. A bigger plan is exactly what the vendor
  // was trying to buy when they hit one — telling them to upgrade is the one
  // piece of advice that cannot help.
  billing_disabled: { key: "billingDisabled", quota: false, upgrade: false },
  plan_not_purchasable: {
    key: "planNotPurchasable",
    quota: false,
    upgrade: false,
  },
  no_billing_account: { key: "noBillingAccount", quota: false, upgrade: false },
  no_live_subscription: {
    key: "noLiveSubscription",
    quota: false,
    upgrade: false,
  },
  subscription_exists: {
    key: "subscriptionExists",
    quota: false,
    upgrade: false,
  },
  already_on_plan: { key: "alreadyOnPlan", quota: false, upgrade: false },
  PLAN_NOT_FOUND: { key: "notFound", quota: false, upgrade: false },

  // ─── AI infrastructure (platform-wide, not the shop's plan) ────────────────
  AI_IMAGE_MONTHLY_CAP_EXCEEDED: { key: "monthlyCap", quota: true, upgrade: true },
  AI_BUDGET_EXCEEDED: { key: "budget", quota: true, upgrade: false },
  AI_RATE_LIMIT_EXCEEDED: { key: "rateLimit", quota: true, upgrade: false },

  // ─── Correctness ───────────────────────────────────────────────────────────
  AI_IMAGE_PROMPT_REJECTED: { key: "promptRejected", quota: false, upgrade: false },
  not_an_image: { key: "notAnImage", quota: false, upgrade: false },
  not_found: { key: "notFound", quota: false, upgrade: false },
}

function specFor(err: unknown): PlanErrorSpec | undefined {
  const code = getValidationErrors(err)[0]?.code
  return code ? ERROR_CODES[code] : undefined
}

export interface PlanFailure {
  message: string
  quota: boolean
  /** True when the fix is a bigger plan, not waiting. */
  upgrade: boolean
}

/**
 * Quota check on its own, for surfaces that own localized copy and only need
 * the branch (`t("quotaExhausted")` vs `t("failed")`) rather than a message.
 * Pure, so it stays callable outside a component.
 */
export function isQuotaError(err: unknown): boolean {
  return specFor(err)?.quota ?? false
}

/**
 * True when a bigger plan is the only fix.
 *
 * Kept separate from `isQuotaError` because the two lead to different advice:
 * an exhausted monthly allowance comes back at the period roll, a capability
 * the plan excludes does not.
 */
export function isUpgradeError(err: unknown): boolean {
  return specFor(err)?.upgrade ?? false
}

/**
 * Localized description of a plan or quota failure. A hook because the copy is
 * translated; `fallback` is the caller's own already-localized wording for a
 * code this module does not recognize.
 */
export function usePlanError() {
  const t = useTranslations("aiImage.errors")

  return useCallback(
    (err: unknown, fallback: string): PlanFailure => {
      const spec = specFor(err)
      if (!spec) return { message: fallback, quota: false, upgrade: false }
      return { message: t(spec.key), quota: spec.quota, upgrade: spec.upgrade }
    },
    [t],
  )
}
