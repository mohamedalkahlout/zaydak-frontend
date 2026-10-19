import type { OtpChannel } from "@/shared/api/generated/graphql"

export interface OtpSettingsDraft {
  code_length: number
  ttl_seconds: number
  cooldown_seconds: number
  max_attempts: number
  daily_limit: number
  shop_hourly_limit: number
  lockout_minutes: number
  channel: OtpChannel
}

/**
 * The bounds `UpdateOtpSettingsInput` enforces, mirrored so the form can stop a
 * bad value at the input rather than at the mutation.
 *
 * **The server's copy is the real one.** These exist so the admin gets a
 * spinner's worth of feedback instead of a round trip, not as the guard — a
 * one-digit code is a way to switch verification off by accident, and that
 * decision cannot live in a field anyone can bypass by posting the mutation
 * directly.
 */
export const OTP_LIMITS = {
  code_length: { min: 4, max: 8 },
  ttl_seconds: { min: 60, max: 3600 },
  cooldown_seconds: { min: 0, max: 600 },
  max_attempts: { min: 1, max: 10 },
  daily_limit: { min: 1, max: 100 },
  shop_hourly_limit: { min: 1, max: 1000 },
  lockout_minutes: { min: 0, max: 1440 },
} as const

/**
 * The code lengths `revealOtpCode` can still read a live code back for.
 *
 * Mirrors `RECOVERABLE_OTP_LENGTHS` in `back-end/src/otp/otp.utils.ts`. The
 * reveal has no stored plaintext — it walks the keyspace until a candidate
 * hashes to the stored hash — so six digits is a million candidates and lands
 * in seconds, seven is ten times that and eight a hundred, which is no longer
 * something to do inside a request. The server refuses those with
 * `OTP_UNRECOVERABLE`.
 *
 * `OTP_LIMITS.code_length` still allows 7 and 8, deliberately: a longer code is
 * a legitimate policy. It just costs the support path on `/otp-logs`, which is
 * a trade an admin should make on purpose rather than discover later.
 */
export const RECOVERABLE_CODE_LENGTHS = [4, 5, 6] as const

export function isRevealSupported(codeLength: number): boolean {
  return (RECOVERABLE_CODE_LENGTHS as readonly number[]).includes(codeLength)
}

export type OtpNumericField = keyof typeof OTP_LIMITS

export const OTP_NUMERIC_FIELDS = Object.keys(OTP_LIMITS) as OtpNumericField[]

export const OTP_CHANNELS = ["EMAIL", "SMS", "BOTH"] as const

export function clampToLimits(field: OtpNumericField, value: number): number {
  const { min, max } = OTP_LIMITS[field]
  return Math.min(Math.max(Math.trunc(value), min), max)
}

/**
 * Value-based dirty, per the save rules: a field typed and then typed back
 * collapses the change rather than leaving the screen looking unsaved.
 */
export function changedKeys(
  draft: OtpSettingsDraft,
  server: OtpSettingsDraft,
): Array<keyof OtpSettingsDraft> {
  return (Object.keys(draft) as Array<keyof OtpSettingsDraft>).filter(
    (key) => draft[key] !== server[key],
  )
}

/** `300` -> `5 min`, `90` -> `1 min 30 s`. Purely for the hint under a field. */
export function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`
}
