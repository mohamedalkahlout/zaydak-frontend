import type { Translate } from "@/shared/i18n/translator"
import type { AbandonedCart, AbandonedCartReminderStatus } from "../types"
import { clampRecoverySteps, DEFAULT_RECOVERY_STEPS_MINUTES } from "./cadence"

export const REMINDER_STATUS_DOT: Record<AbandonedCartReminderStatus, string> = {
  READY: "bg-amber-500",
  SENT: "bg-muted-foreground/50",
  RETURNED: "bg-sky-500",
  FAILED: "bg-rose-500",
  COMPLETED: "bg-emerald-500",
}

export function reminderStatusOf(
  lastReminderAt: string | null | undefined,
): AbandonedCartReminderStatus {
  return lastReminderAt ? "SENT" : "READY"
}

export function marketingStatusOf(
  cart: Pick<
    AbandonedCart,
    | "status"
    | "last_reminder_at"
    | "last_reminder_failed_at"
    | "last_activity_at"
    | "marketing_draft_order_id"
    | "reminder_link_opened_at"
  >,
): AbandonedCartReminderStatus {
  if (cart.status === "converted" || cart.marketing_draft_order_id) {
    return "COMPLETED"
  }
  const failed = cart.last_reminder_failed_at
    ? Date.parse(cart.last_reminder_failed_at)
    : NaN
  const sent = cart.last_reminder_at ? Date.parse(cart.last_reminder_at) : NaN
  if (Number.isFinite(failed) && (!Number.isFinite(sent) || failed > sent)) {
    return "FAILED"
  }
  if (Number.isFinite(sent)) {
    // Mirrors the back-end's `marketingReminderStatus`: activity or an opened
    // reminder link after the send each mean RETURNED.
    const activity = cart.last_activity_at
      ? Date.parse(cart.last_activity_at)
      : NaN
    if (Number.isFinite(activity) && activity > sent) return "RETURNED"
    const opened = cart.reminder_link_opened_at
      ? Date.parse(cart.reminder_link_opened_at)
      : NaN
    if (Number.isFinite(opened) && opened > sent) return "RETURNED"
    return "SENT"
  }
  return "READY"
}

export interface StatusTimelineEvent {
  key: "abandoned" | "sent" | "failed" | "opened" | "returned" | "completed"
  at: string
}

/**
 * Only events we actually stored — no invented pixels. "opened" is a click on
 * the reminder's signed cart link, reported by the storefront; there is no
 * email-open tracking to show.
 */
export function statusTimeline(cart: AbandonedCart): StatusTimelineEvent[] {
  const events: StatusTimelineEvent[] = []
  const abandonedAt = cart.abandoned_at ?? cart.last_activity_at ?? cart.created_at
  events.push({ key: "abandoned", at: abandonedAt })
  if (cart.last_reminder_at) {
    events.push({ key: "sent", at: cart.last_reminder_at })
  }
  if (cart.last_reminder_failed_at) {
    events.push({ key: "failed", at: cart.last_reminder_failed_at })
  }
  if (
    cart.last_reminder_at &&
    cart.reminder_link_opened_at &&
    Date.parse(cart.reminder_link_opened_at) > Date.parse(cart.last_reminder_at)
  ) {
    events.push({ key: "opened", at: cart.reminder_link_opened_at })
  }
  if (
    cart.last_reminder_at &&
    cart.last_activity_at &&
    Date.parse(cart.last_activity_at) > Date.parse(cart.last_reminder_at)
  ) {
    events.push({ key: "returned", at: cart.last_activity_at })
  }
  if (cart.status === "converted" || cart.marketing_draft_order_id) {
    events.push({
      key: "completed",
      at: cart.last_activity_at ?? cart.abandoned_at ?? cart.created_at,
    })
  }
  return events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}

/** Relative idle label from an ISO timestamp, in days (list column). */
export function daysSince(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return null
  const ms = now.getTime() - then.getTime()
  return Math.max(0, Math.floor(ms / 86_400_000))
}

export function parseCadence(value: unknown): { enabled: boolean; steps: number[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { enabled: true, steps: [...DEFAULT_RECOVERY_STEPS_MINUTES] }
  }
  const row = value as { enabled?: unknown; steps?: unknown }
  return {
    enabled: typeof row.enabled === "boolean" ? row.enabled : true,
    steps: clampRecoverySteps(row.steps),
  }
}

/**
 * A cadence step in its largest whole unit ("1h", "3d"). `t` is scoped to
 * `abandonedCarts.step`, where each unit's words — and Arabic's plural forms —
 * live.
 */
export function formatStepMinutes(minutes: number, t: Translate): string {
  if (minutes % 1440 === 0) return t("days", { count: minutes / 1440 })
  if (minutes % 60 === 0) return t("hours", { count: minutes / 60 })
  return t("minutes", { count: minutes })
}
