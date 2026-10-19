"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"

/** Codes the back-end sends that no retry can fix — the platform has to act.
 *
 * `PROVIDER_DAILY_QUOTA` is here rather than with the retryable faults on
 * purpose: it arrives as an ordinary 429, but it is a spent daily allowance
 * that clears tomorrow, so a Try again button would be a button that cannot
 * work.
 *
 * `PLATFORM_BUDGET_EXCEEDED` joined it when the back-end stopped collapsing
 * three different ceilings into one `QUOTA_EXCEEDED`. It belongs here and the
 * other two deliberately do not: this one is our spending cap, and the
 * merchant is owed "we know" rather than an action. */
const PLATFORM_CODES = new Set([
  "PROVIDER_CREDITS",
  "PROVIDER_DAILY_QUOTA",
  "MODEL_NOT_FOUND",
  "NOT_CONFIGURED",
  "PLATFORM_BUDGET_EXCEEDED",
])

/** The shop's own plan allowance is spent — the one ceiling with a way out. */
const PLAN_QUOTA_CODE = "QUOTA_EXCEEDED"

/** This user sent too many turns this hour. Clears on its own, shortly. */
const RATE_LIMITED_CODE = "RATE_LIMITED"

interface Props {
  code: string
  message: string
  retryable: boolean
  /** Absent on historical turns and in the read-only shared view. */
  onRetry?: () => void
  retrying?: boolean
  /**
   * Where the plan screen lives, for the one refusal the merchant can act on.
   *
   * Optional because the shared read-only view renders these cards for someone
   * who is not the shop's owner and has nothing to upgrade.
   */
  planHref?: string
}

/**
 * A turn that died, rendered inside the turn instead of in a banner beside it.
 *
 * The failure used to be a detached red box under the transcript with no link
 * to the turn it belonged to and no way to act on it, so a provider blip that
 * one click would have fixed and a credits outage that no click can fix looked
 * identical — "صار خطأ غير متوقع. حاول بعد شوي." in both cases. This card takes
 * the back-end's `code`/`retryable` and splits them: a retryable failure gets a
 * button, a platform one gets a sentence saying the team has been notified and
 * no button to press pointlessly.
 *
 * **Three refusals, not one.** The back-end used to answer every ceiling with
 * `QUOTA_EXCEEDED`, so a merchant whose plan allowance was spent read "the
 * platform team has been notified — nothing is needed from you" (untrue, and
 * it hid the upgrade), while one who had simply asked sixty questions in an
 * hour read the same. Each now has its own title, and only the plan one offers
 * a way out.
 *
 * It sits in the work log, so whatever the turn managed before it failed — the
 * narration, the lookups — stays above it, and a reload shows the same thing.
 */
export function TurnErrorCard({
  code,
  message,
  retryable,
  onRetry,
  retrying = false,
  planHref,
}: Props) {
  const t = useTranslations("aiChat.toolCards.turnError")
  const isPlatform = PLATFORM_CODES.has(code)
  const isPlanQuota = code === PLAN_QUOTA_CODE
  const isRateLimited = code === RATE_LIMITED_CODE

  const title = isPlatform
    ? t("platformTitle")
    : isPlanQuota
      ? t("planQuotaTitle")
      : isRateLimited
        ? t("rateLimitedTitle")
        : t("genericTitle")

  return (
    <div
      role="alert"
      className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm"
    >
      <div className="flex items-center gap-2 font-medium text-amber-700 dark:text-amber-400">
        <AlertTriangleIcon className="size-4 shrink-0" />
        <span>{title}</span>
      </div>
      <p
        dir="auto"
        className="mt-1 text-xs break-words text-muted-foreground [overflow-wrap:anywhere]"
      >
        {message}
      </p>
      {retryable && onRetry && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={onRetry}
          disabled={retrying}
        >
          <RefreshCwIcon className={retrying ? "animate-spin" : undefined} />
          {t("retry")}
        </Button>
      )}
      {isPlanQuota && planHref && (
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          nativeButton={false}
          render={<Link href={planHref} />}
        >
          {t("viewPlan")}
        </Button>
      )}
      {isPlatform && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {t("platformNote")}
        </p>
      )}
      {isRateLimited && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {t("rateLimitNote")}
        </p>
      )}
    </div>
  )
}
