import type { CsvRow } from "@/shared/lib/csv"
import { formatDateTime } from "@/shared/lib/format"

import { attemptsLabel, type OtpLogRow } from "./types"

/**
 * The CSV shape of the log.
 *
 * Cells are the display strings the table itself shows — localized enum labels,
 * formatted timestamps — because the file is opened by the same person who was
 * just looking at the screen, and a column reading `RESET_PASSWORD` next to one
 * reading "Password reset" is a file they have to translate back.
 *
 * `delivery_error` gets a column of its own even though the table hides it in a
 * tooltip: the export exists to answer a delivery complaint, and the gateway's
 * own words are the answer.
 */
export interface OtpLogCsvLabels {
  /** Column headers, in file order. */
  columns: {
    sent: string
    identifier: string
    account: string
    purpose: string
    status: string
    attempts: string
    delivery: string
    deliveryError: string
    verified: string
    expires: string
  }
  purpose: (purpose: string) => string
  status: (status: string) => string
  delivery: (state: "delivered" | "failed" | "pending") => string
  /** What an absent value reads as. The table's em dash. */
  none: string
}

/** Same three-way answer the Delivery column renders, as a word. */
function deliveryState(row: OtpLogRow): "delivered" | "failed" | "pending" {
  if (row.delivery_error) return "failed"
  return row.delivered_at ? "delivered" : "pending"
}

export function otpLogCsvRows(
  rows: readonly OtpLogRow[],
  labels: OtpLogCsvLabels,
  locale: string,
): CsvRow[] {
  const c = labels.columns
  return rows.map((row) => ({
    [c.sent]: formatDateTime(row.created_at, locale),
    [c.identifier]: row.identifier,
    [c.account]: row.user_name ?? labels.none,
    [c.purpose]: labels.purpose(row.purpose),
    [c.status]: labels.status(row.status),
    [c.attempts]: attemptsLabel(row),
    [c.delivery]: labels.delivery(deliveryState(row)),
    [c.deliveryError]: row.delivery_error ?? labels.none,
    [c.verified]: formatDateTime(row.verified_at, locale),
    [c.expires]: formatDateTime(row.expires_at, locale),
  }))
}

/**
 * `otp-logs-2026-08-01_2026-08-14.csv`, or the day it was taken when the range
 * is open-ended. The filename carries the window because the file does not —
 * two exports of "the last fortnight" taken a week apart are otherwise
 * indistinguishable in a downloads folder.
 */
export function otpLogsFileName(from: string, to: string, now: Date): string {
  const stamp = now.toISOString().slice(0, 10)
  if (from && to) return `otp-logs-${from}_${to}.csv`
  if (from) return `otp-logs-from-${from}.csv`
  if (to) return `otp-logs-to-${to}.csv`
  return `otp-logs-${stamp}.csv`
}
