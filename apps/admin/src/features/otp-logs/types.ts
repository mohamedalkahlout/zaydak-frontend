import type { AdminOtpLogsQuery } from "@/shared/api/generated/graphql"
import { OtpLogStatus, OtpPurpose } from "@/shared/api/generated/graphql"

/** One row of the `otpLogs` list. */
export type OtpLogRow = NonNullable<AdminOtpLogsQuery["otpLogs"]["data"]>[number]

/** Filter order: the two outcomes an operator opens this screen for, then the rest. */
export const OTP_LOG_STATUSES = [
  OtpLogStatus.Verified,
  OtpLogStatus.Locked,
  OtpLogStatus.Expired,
  OtpLogStatus.Pending,
  OtpLogStatus.Superseded,
] as const

export const OTP_PURPOSES = [
  OtpPurpose.Login,
  OtpPurpose.CustomerSignIn,
  OtpPurpose.Signup,
  OtpPurpose.ResetPassword,
  OtpPurpose.VerifyEmail,
] as const

/**
 * `LOCKED` is the only status that reads as a fault — attempts spent, and the
 * account locked with it. `SUPERSEDED` and `EXPIRED` are routine (a resend, a
 * code nobody used), so they stay quiet rather than painting a normal log red.
 */
export function statusBadgeVariant(
  status: OtpLogStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case OtpLogStatus.Verified:
      return "secondary"
    case OtpLogStatus.Locked:
      return "destructive"
    case OtpLogStatus.Pending:
      return "default"
    default:
      return "outline"
  }
}

/**
 * Whether the row's code can still be shown.
 *
 * Mirrors `OtpLogsService.reveal`, which refuses anything but `PENDING`: a code
 * already used, locked, replaced or expired opens nothing, so there is nothing
 * worth showing. The server is the enforcement — this only decides whether the
 * console offers the button, so the rule is visible before the click.
 *
 * A code the SMS provider generated (`verifier`, e.g. Twilio Verify) is never
 * revealable either: it never existed on the server, so there is nothing to
 * recover — the row says who issued it instead.
 */
export function isRevealable(
  row: Pick<OtpLogRow, "status" | "verifier">
): boolean {
  return row.status === OtpLogStatus.Pending && !row.verifier
}

/** The provider name shown for a code it issued, or null for our own codes. */
export function verifierLabel(verifier: string | null | undefined): string | null {
  if (!verifier) return null
  if (verifier === "twilio") return "Twilio Verify"
  if (verifier === "msegat") return "Msegat OTP"
  return verifier
}

/**
 * `2 / 5`, and an em dash when nothing was typed at all.
 *
 * The denominator is the row's own budget, stamped when the code was sent — a
 * code issued under an older `max_attempts` keeps showing the allowance it was
 * actually verified against, not today's setting.
 */
export function attemptsLabel(row: Pick<OtpLogRow, "attempts" | "max_attempts">): string {
  if (row.attempts === 0) return "—"
  return `${row.attempts} / ${row.max_attempts}`
}
