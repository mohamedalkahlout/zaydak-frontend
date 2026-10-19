import type { Translate } from "@/shared/i18n/translator"
import type { Segment } from "../types"

/** Best-effort identity: prefer `query`, fall back to a one-line JSON dump of rules. */
export function segmentQueryText(s: Pick<Segment, "query" | "rules">): string {
  if (s.query) return s.query
  if (!s.rules || !s.rules.conditions?.length) return ""
  return JSON.stringify(s.rules)
}

/** Returns whether the segment's expression is empty (no query, no conditions). */
export function isSegmentEmpty(
  s: Pick<Segment, "query" | "rules"> | null | undefined,
): boolean {
  if (!s) return true
  if (s.query && s.query.trim()) return false
  return !s.rules?.conditions?.length
}

/**
 * Short relative-time display for the table updated-at column.
 * `t` is the `segments.relativeTime` translator.
 */
export function formatRelativeTime(
  iso: string,
  t: Translate,
  now = new Date(),
): string {
  const d = new Date(iso)
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return t("justNow")
  if (diffMin < 60) return t("minutesAgo", { count: diffMin })
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return t("hoursAgo", { count: diffH })
  const diffD = Math.floor(diffH / 24)
  if (diffD < 30) return t("daysAgo", { count: diffD })
  const diffMo = Math.floor(diffD / 30)
  if (diffMo < 12) return t("monthsAgo", { count: diffMo })
  return t("yearsAgo", { count: Math.floor(diffMo / 12) })
}

/**
 * Format a contact sample row for the preview panel — show name plus a
 * single most-identifying secondary line (email / phone / city).
 */
export function formatSampleSecondary(
  contact: {
    phone_number?: string | null
    email?: string | null
    meta?: Record<string, unknown> | null
  },
): string | null {
  const meta = contact.meta ?? {}
  if (contact.email) return contact.email
  if (contact.phone_number) return contact.phone_number
  const addr = (meta.default_address as { city?: string } | undefined) ?? null
  if (addr?.city) return addr.city
  return null
}
