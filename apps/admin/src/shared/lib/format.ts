/**
 * Display formatters for the admin console.
 *
 * **Money crosses the API as integer cents, never as a float.** The scaling to
 * major units happens here, at the last possible moment, and nowhere else — a
 * component that divides by 100 inline is how a rounding bug gets in.
 * `CommissionEntry` exposes `commission_bps` — basis points, not a percent
 * float and not a `commission` field. Use `formatBps` / `bpsToPercent` below;
 * they are the only places bps become a percent.
 */

/**
 * Render integer cents as a major-unit amount: `12345` → `123.45`.
 *
 * Deliberately currency-less: `WithdrawalEntry` and `CommissionEntry` expose no
 * currency field, and stamping a symbol here would assert a currency the API
 * never sent. Withdrawals settle in the shop's currency, which the admin list
 * query cannot see.
 */
export function formatAmountCents(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

/** `2.5` renders as `2.5%`. The back-end stores this as 250 bps. */
export function formatPercent(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

/**
 * Basis points as a percent string: `250` renders as `2.5`.
 *
 * The rate crosses the API as `commission_bps: Int!`, so every screen that
 * shows it has to divide by 100 somewhere. That somewhere is here — the same
 * rule `formatAmountCents` exists for, and for the same reason.
 */
export function formatBps(bps: number, locale: string): string {
  return formatPercent(bpsToPercent(bps), locale)
}

/**
 * The two conversions a *form* needs, as opposed to a display string: an
 * editable input holds a percent and major units, while the API holds bps and
 * cents. Named rather than inline so the boundary is greppable and the
 * rounding on the way back (`Math.round(x * 100)`) has an obvious partner.
 */
export function bpsToPercent(bps: number): number {
  return bps / 100
}

/**
 * The app's only `cents / 100`. The plans feature kept a second one called
 * `fromCents` for its own screens, which is how one of the two quietly acquires
 * a rounding rule the other does not have. The write direction is not here: it
 * sits with the schema that justifies its rounding — `toCents` in
 * `features/plans/validations.ts`, and inline at the commissions mutation.
 */
export function centsToMajor(cents: number): number {
  return cents / 100
}

/**
 * A third decimal place is silently rounded away by the write conversions, so
 * every money form rejects it rather than saving a number the admin did not
 * type. One copy: the plans and commissions modules each carried an identical
 * one, and a shared rule that lives in two files is a rule that will one day
 * be two rules.
 *
 * The `* 100` is compared with an epsilon because `2.55 * 100` is
 * `254.99999999999997` in binary floating point, not `255`.
 */
export function hasAtMostTwoDecimals(value: number): boolean {
  if (!Number.isFinite(value)) return false
  const scaled = value * 100
  return Math.abs(scaled - Math.round(scaled)) < 1e-9
}

/**
 * The write half of the money boundary: major units in, integer cents out.
 *
 * The epsilon nudge mirrors the back-end's `toCents` (`money.helper.ts`)
 * exactly, and that is the whole point of it being here. A bare
 * `Math.round(major * 100)` disagrees with the server on `1.005`, whose
 * float product is `100.49999999999999` — 100 client-side against 101
 * server-side. Unreachable while `hasAtMostTwoDecimals` rejects a third
 * decimal first, but two answers to one money question is not a thing to
 * leave standing on a guard somewhere else.
 */
const ROUNDING_EPSILON = 1e-6

export function toCents(major: number): number {
  if (!Number.isFinite(major)) return 0
  const scaled = major * 100
  return Math.round(scaled + Math.sign(scaled) * ROUNDING_EPSILON)
}

/** Percent to basis points: `2.5` becomes `250`. Same rounding as `toCents`. */
export function bpsOf(percent: number): number {
  return toCents(percent)
}

/** Renders an ISO-8601 timestamp; returns an em dash for null/undefined/invalid. */
export function formatDate(
  iso: string | null | undefined,
  locale: string,
): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
  }).format(date)
}

/**
 * Date *and* time, for logs. `formatDate` above is deliberately date-only —
 * on a screen where several codes can be issued to one address inside a minute,
 * a row stamped with the day alone says nothing about the order they happened in.
 */
export function formatDateTime(
  iso: string | null | undefined,
  locale: string,
): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

/** Shortens an opaque UUID for table display: `a1b2c3d4…`. */
export function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}
