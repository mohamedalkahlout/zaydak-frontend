import type { useTranslations } from "next-intl"

import { getErrorCode, getErrorDetail } from "@/shared/auth/graphql-errors"
import { AssistantTurnError } from "./stream"

/**
 * A turn the shop's assistant refused for now, as opposed to one that broke.
 *
 * Every ceiling in front of this panel — the per-IP throttle, the visitor's
 * own share of the shop's allowance, their origin's, the shop's quota, the
 * platform budget — answers with the same `TOO_MANY_REQUESTS`, on purpose: the
 * shopper is not told which of the shop's meters ran out. What some of them do
 * say is when the window rolls, and that is the one thing worth passing on,
 * because "try again" is exactly the wrong advice for the next hour.
 */
export interface AssistantRefusal {
  /** Null when the refusal named no window (the shop's quota, say). */
  retryAfterSeconds: number | null
}

const REFUSED = "TOO_MANY_REQUESTS"

/**
 * Read a failed turn as a refusal, from either transport, or null when it was
 * any other failure.
 *
 * The stream says it with its `error` frame (`AssistantTurnError`); the
 * mutation with `error_code` and a `retry_after_seconds=<n>` detail.
 */
export function refusalOf(err: unknown): AssistantRefusal | null {
  if (err instanceof AssistantTurnError) {
    return err.code === REFUSED
      ? { retryAfterSeconds: err.retryAfterSeconds }
      : null
  }
  if (getErrorCode(err) !== REFUSED) return null
  const seconds = Number(
    /^retry_after_seconds=(\d+)$/.exec(getErrorDetail(err) ?? "")?.[1],
  )
  return {
    retryAfterSeconds: Number.isFinite(seconds) && seconds > 0 ? seconds : null,
  }
}

export type WaitUnit = "seconds" | "minutes" | "hours" | "days"

/**
 * A wait in the largest unit that reads naturally, rounded up — "in 9
 * minutes", never "in 540 seconds", and never a minute shorter than the truth.
 *
 * Days exist because the visitor's monthly share is one of the windows: the
 * back-end points at the end of the current window, which can be weeks out.
 */
export function waitOf(
  seconds: number | null,
): { unit: WaitUnit; count: number } | null {
  if (!seconds || !Number.isFinite(seconds) || seconds <= 0) return null
  if (seconds < 60) return { unit: "seconds", count: Math.ceil(seconds) }
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return { unit: "minutes", count: minutes }
  const hours = Math.ceil(seconds / 3600)
  if (hours < 24) return { unit: "hours", count: hours }
  return { unit: "days", count: Math.ceil(seconds / 86_400) }
}

/**
 * What a failed turn's bubble says.
 *
 * A refusal is not a breakage, and "try asking again" is the wrong advice for
 * it: the next question is refused too until the window rolls. So a refusal
 * that names its window says when, and one that does not says "later".
 */
export function failureLabel(
  refused: AssistantRefusal | undefined,
  t: ReturnType<typeof useTranslations<"assistant">>,
): string {
  if (!refused) return t("failed")
  const wait = waitOf(refused.retryAfterSeconds)
  if (!wait) return t("refused")
  return t("refusedWait", {
    wait: t(`wait.${wait.unit}`, { count: wait.count }),
  })
}
