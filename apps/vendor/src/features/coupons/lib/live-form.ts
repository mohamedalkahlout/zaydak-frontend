"use client"

import {
  cap,
  stagePatch,
  toNumber,
  useLiveForm,
  type PatchSpec,
} from "@/features/ai/lib/live-form"
import type { CouponFormApi } from "@/features/coupons/validations/coupon"

/**
 * The coupon forms as a live form: what an open coupon form tells the
 * assistant on each message, and how a `patch_form` result is staged back
 * into it. All four coupon forms share one `CouponFormApi`, so they share
 * this.
 *
 * The lists below MIRROR the back-end's (`sanitizeCouponValues` in
 * `back-end/src/vendor-agent/tools/lib/live-form.ts`, and the form fields
 * `buildCouponPrefill` writes). The back-end is not a workspace, so the two
 * cannot share an import; the server re-checks everything this side sends.
 *
 * Scalars only. Who and what a coupon applies to — products, collections,
 * customers, countries — are id lists the assistant could not read, and
 * `patch_form` does not write them: the vendor changes those on the form.
 */

/** Read-only context beside the patchable fields: which of the four forms. */
const CONTEXT_FIELDS = ["type"] as const

const ENUM_FIELDS = [
  "method",
  "value_type",
  "minimum_mode",
  "get_discount_mode",
] as const
const NUMBER_FIELDS = [
  "amount",
  "max_discount",
  "minimum_cart_amount",
  "minimum_quantity",
  "max_uses",
  "priority",
  "exclude_shipping_rates_over",
  "buy_quantity",
  "get_quantity",
  "get_discount_percent",
  "get_discount_amount",
] as const
const BOOLEAN_FIELDS = [
  "limit_uses",
  "limit_one_per_customer",
  "is_exclusive",
  "allow_product",
  "allow_order",
  "allow_shipping",
  "set_end_date",
  "exclude_shipping_rates",
] as const
/** Dates and times stay the strings the form's own inputs hold. */
const STRING_FIELDS = [
  "code",
  "target",
  "active_from_date",
  "active_from_time",
  "expire_at_date",
  "expire_at_time",
] as const

const CAPS: Record<string, number> = { code: 50, target: 120 }

/** Coupon form fields `patch_form` may write: every one above but `type`. */
export const COUPON_PATCH_FIELDS: readonly string[] = [
  ...ENUM_FIELDS,
  ...NUMBER_FIELDS,
  ...BOOLEAN_FIELDS,
  ...STRING_FIELDS,
]

/**
 * The blank each field the server may empty is written as. Numbers go to
 * `null`, which the form's schema reads as empty and the ticket's JSON keeps
 * (an `undefined` would be dropped, and a reload would bring the value back).
 * The switches that go with them — `limit_uses`, `minimum_mode`,
 * `set_end_date`, `exclude_shipping_rates` — arrive as ordinary values in the
 * same patch.
 */
export const COUPON_CLEARED_VALUE: Readonly<Record<string, unknown>> = {
  max_discount: null,
  minimum_cart_amount: null,
  minimum_quantity: null,
  max_uses: null,
  exclude_shipping_rates_over: null,
  expire_at_date: "",
  expire_at_time: "",
  target: "",
}

const COUPON_PATCH_SPEC: PatchSpec = {
  fields: new Set(COUPON_PATCH_FIELDS),
  translatable: new Set<string>(),
  blanks: COUPON_CLEARED_VALUE,
}

/**
 * The coupon form's values, reduced to what the assistant is told: the scalar
 * fields, numbers as numbers (an input holds the string that was typed), and
 * empty fields left out.
 */
export function couponSnapshot(
  values: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of [...CONTEXT_FIELDS, ...ENUM_FIELDS]) {
    const v = values[key]
    if (typeof v === "string" && v) out[key] = v
  }
  for (const key of NUMBER_FIELDS) {
    const n = toNumber(values[key])
    if (n !== undefined) out[key] = n
  }
  for (const key of BOOLEAN_FIELDS) {
    if (typeof values[key] === "boolean") out[key] = values[key]
  }
  for (const key of STRING_FIELDS) {
    const v = values[key]
    if (typeof v === "string" && v.trim()) {
      out[key] = CAPS[key] ? cap(v.trim(), CAPS[key]) : v.trim()
    }
  }
  return out
}

/**
 * Stage a patch into the coupon form: `setValue` with `shouldDirty`, so the
 * save bar shows and nothing is saved until the vendor presses Save. The
 * form's own schema then validates what was written, so a rule the patch
 * breaks (an end before the start, a code with a space in it) shows under its
 * field straight away.
 */
export function applyCouponPatch(
  form: Pick<CouponFormApi, "getValues" | "setValue" | "trigger">,
  values: Record<string, unknown>,
): Record<string, unknown> {
  return stagePatch(form as never, values, COUPON_PATCH_SPEC)
}

/**
 * Register a mounted coupon form as the live form while it is the one the
 * assistant prepared. A form the vendor opened themselves has no handoff id
 * and never registers.
 *
 * @param label the coupon's saved code, on an edit — what the chat's
 *   composer chip calls the form.
 */
export function useCouponLiveForm(options: {
  form: CouponFormApi
  handoffId: string | undefined
  mode: "create" | "edit"
  couponId?: string
  label?: string
}) {
  const { form, handoffId, mode, couponId, label } = options
  useLiveForm({
    formId: handoffId,
    target: mode === "edit" ? "coupon_edit" : "coupon_create",
    entityId: mode === "edit" ? couponId : undefined,
    label: mode === "edit" ? label?.trim() || undefined : undefined,
    snapshot: () => couponSnapshot(form.getValues() as Record<string, unknown>),
    apply: (values) => applyCouponPatch(form, values),
  })
}
