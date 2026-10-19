/**
 * The date-range filter's arithmetic, kept out of the component so it can be
 * tested and so the retention bound lives in one place.
 *
 * The two `<input type="date">` controls hold plain `yyyy-mm-dd` strings. The
 * query wants instants, and "the 3rd" means the whole of the 3rd in the admin's
 * own timezone — so a bound is widened to the start or end of that local day
 * before it is sent, never to midnight UTC, which would clip or overreach by
 * however far the browser sits from Greenwich.
 */

/**
 * How far back the log actually goes.
 *
 * Mirrors `OTP_ROW_RETENTION_DAYS` in `back-end/src/common/constants/defaults.ts`:
 * the hourly cleanup job deletes `otps` rows older than this, so a wider window
 * does not return more rows, it returns the same ones with a misleading label
 * over them. The pickers are bounded to it and the screen says why.
 */
export const OTP_RETENTION_DAYS = 14

const DAY_MS = 86_400_000

/** A `Date` as the `yyyy-mm-dd` an `<input type="date">` holds, in local time. */
export function toDateInputValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

/** The `min` of both pickers: nothing older than retention survives to be found. */
export function earliestSelectableDate(now: Date): string {
  return toDateInputValue(new Date(now.getTime() - OTP_RETENTION_DAYS * DAY_MS))
}

/** The `max` of both pickers. There are no codes from tomorrow. */
export function latestSelectableDate(now: Date): string {
  return toDateInputValue(now)
}

/**
 * Whether the pair can be sent.
 *
 * A half-filled range is valid — either bound stands on its own, and the server
 * treats them independently. Only an inverted pair is refused, and it is
 * refused here rather than server-side: the query would answer it with an empty
 * list, which reads as "no codes were sent" instead of "you typed it backwards".
 */
export function isValidRange(from: string, to: string): boolean {
  if (!from || !to) return true
  return from <= to
}

/** `2026-08-03` -> the first instant of that local day, as ISO. */
export function startOfDayIso(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  return d.toISOString()
}

/** `2026-08-03` -> the last instant of that local day, as ISO. Inclusive, per the server. */
export function endOfDayIso(date: string): string {
  const d = new Date(`${date}T23:59:59.999`)
  return d.toISOString()
}
