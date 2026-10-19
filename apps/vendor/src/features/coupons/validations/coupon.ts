import { z } from "zod"
import type { UseFormReturn } from "react-hook-form"
import type { Translate } from "@/shared/i18n/translator"

// A zod message is fixed when the schema is built, so every schema here is a
// factory over `t` — the `coupons.validation` translator — rather than a
// constant, which would stay English under an Arabic dashboard. Components
// build theirs with `useTranslations("coupons.validation")`; tests pass
// `enTranslator("coupons.validation")`.

// ── Enums for UI-only state ─────────────────────────
// These capture radio-group selections in the Shopify-style form. They
// are stripped before sending to the API — the API only receives the
// derived fields (e.g. minimum_cart_amount or minimum_quantity).

export const couponMethodSchema = z.enum(["code", "automatic"])
export type CouponMethod = z.infer<typeof couponMethodSchema>

export const couponEligibilitySchema = z.enum([
  "all_customers",
  "specific_customers",
  "segment",
])
export type CouponEligibilityUI = z.infer<typeof couponEligibilitySchema>

export const minimumModeSchema = z.enum(["none", "amount", "quantity"])
export type MinimumMode = z.infer<typeof minimumModeSchema>

export const appliesToSchema = z.enum(["all", "products", "collections"])
export type AppliesTo = z.infer<typeof appliesToSchema>

const timeLike = (t: Translate) =>
  z.string().regex(/^\d{2}:\d{2}$/i, t("invalidTime"))

/**
 * Optional numeric field that tolerates empty-string inputs from react-hook-form.
 * RHF keeps `""` in state after a number input is rendered+cleared, and Zod's
 * `.coerce.number()` turns `""` into `0` — which then fails `.positive()` /
 * `.min(1)` even when the field is supposed to be skipped. Preprocessing "" and
 * null to `undefined` lets `.optional()` do its job. The outer `.optional()`
 * keeps the field's key optional in the inferred `z.input` object type.
 */
function optionalNumber<T extends z.ZodType>(inner: T) {
  return z
    .preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      inner.optional(),
    )
    .optional()
}

/**
 * Shared across every coupon type. Wrapped in `.optional()` where the
 * API accepts `null`/omit so RHF can leave them empty without failing.
 */
const baseCouponShape = (t: Translate) => ({
  // Code / method
  // `code` required only when method === "code"; server auto-generates
  // `AUTO-XXXX` for automatic coupons. Pattern + length enforced in a refine.
  code: z.string().max(50, t("codeTooLong")).optional().or(z.literal("")),
  method: couponMethodSchema.default("code"),

  // Eligibility
  eligibility: couponEligibilitySchema.default("all_customers"),
  customer_ids: z.array(z.string()).optional(),
  segment_ids: z.array(z.string()).optional(),

  // Minimum purchase requirements
  minimum_mode: minimumModeSchema.default("none"),
  minimum_cart_amount: optionalNumber(z.coerce.number().min(0)),
  minimum_quantity: optionalNumber(z.coerce.number().int().min(1)),

  // Maximum uses
  limit_uses: z.boolean().default(false),
  max_uses: optionalNumber(z.coerce.number().int().positive()),
  limit_one_per_customer: z.boolean().default(false),

  // Combinations — flat fields match backend's CreateCouponInput shape.
  // `is_exclusive` wins over the three allow_* flags.
  is_exclusive: z.boolean().default(false),
  allow_product: z.boolean().default(false),
  allow_order: z.boolean().default(false),
  allow_shipping: z.boolean().default(false),

  // Active dates — split into date + time inputs in the UI, paired with an
  // IANA timezone so the backend converts to UTC against the merchant's
  // actual zone (otherwise sessions across DST / non-local zones silently
  // drift). Defaults to the browser's detected zone.
  active_from_date: z.string().min(1, t("required")),
  active_from_time: timeLike(t).default("00:00"),
  set_end_date: z.boolean().default(false),
  expire_at_date: z.string().optional().or(z.literal("")),
  expire_at_time: z.string().optional().or(z.literal("")),
  timezone: z.string().optional().or(z.literal("")),

  // Scope
  product_ids: z.array(z.string()).optional(),
  collection_ids: z.array(z.string()).optional(),

  // Language / campaign
  language: z.string().optional().or(z.literal("")),
  target: z.string().max(120, t("tooLong")).optional().or(z.literal("")),
  // `priority` orders automatic coupons when multiple apply. Integer only;
  // the backend treats higher numbers as "try this one first".
  priority: optionalNumber(z.coerce.number().int().min(0)),
})

/** Require end date fields when `set_end_date=true`, and validate window. */
function applyWindowRefines<
  T extends z.ZodObject<z.ZodRawShape>,
>(schema: T, t: Translate) {
  return schema
    .refine(
      (d) => {
        if (!d.set_end_date) return true
        return !!d.expire_at_date && !!d.expire_at_time
      },
      {
        message: t("required"),
        path: ["expire_at_date"],
      },
    )
    .refine(
      (d) => {
        if (!d.set_end_date) return true
        const start = Date.parse(`${d.active_from_date}T${d.active_from_time}`)
        const end = Date.parse(`${d.expire_at_date}T${d.expire_at_time}`)
        if (Number.isNaN(start) || Number.isNaN(end)) return false
        return end > start
      },
      {
        message: t("endAfterStart"),
        path: ["expire_at_date"],
      },
    )
    .refine(
      (d) => {
        if (d.minimum_mode !== "amount") return true
        const n = Number(d.minimum_cart_amount)
        return !Number.isNaN(n) && n > 0
      },
      {
        message: t("minimumAmount"),
        path: ["minimum_cart_amount"],
      },
    )
    .refine(
      (d) => {
        if (d.minimum_mode !== "quantity") return true
        const n = Number(d.minimum_quantity)
        return !Number.isNaN(n) && n > 0
      },
      {
        message: t("minimumQuantity"),
        path: ["minimum_quantity"],
      },
    )
    .refine(
      (d) => {
        if (!d.limit_uses) return true
        const n = Number(d.max_uses)
        return !Number.isNaN(n) && n > 0
      },
      {
        message: t("usageLimit"),
        path: ["max_uses"],
      },
    )
    .refine(
      (d) => {
        if (d.eligibility !== "specific_customers") return true
        return Array.isArray(d.customer_ids) && d.customer_ids.length > 0
      },
      {
        message: t("selectCustomer"),
        path: ["customer_ids"],
      },
    )
    .refine(
      (d) => {
        if (d.eligibility !== "segment") return true
        return Array.isArray(d.segment_ids) && d.segment_ids.length > 0
      },
      {
        message: t("selectSegment"),
        path: ["segment_ids"],
      },
    )
    .refine(
      (d) => {
        if (d.method !== "code") return true
        const code = typeof d.code === "string" ? d.code.trim() : ""
        return code.length >= 2
      },
      {
        message: t("codeTooShort"),
        path: ["code"],
      },
    )
    .refine(
      (d) => {
        if (d.method !== "code") return true
        const code = typeof d.code === "string" ? d.code : ""
        if (!code) return true
        return /^[A-Z0-9_-]+$/i.test(code)
      },
      {
        message: t("codeCharacters"),
        path: ["code"],
      },
    )
}

// ── Per-type schemas ─────────────────────────────────

/**
 * Shared amount-off shape: user picks value_type (fixed vs percentage)
 * then enters the amount (with percentage cap validation).
 */
const valueTypeSchema = z.enum(["fixed", "percentage"])
export type CouponValueType = z.infer<typeof valueTypeSchema>

const amountOffBase = (t: Translate) => ({
  ...baseCouponShape(t),
  value_type: valueTypeSchema.default("percentage"),
  amount: z.coerce.number().positive(t("greaterThanZero")),
  max_discount: optionalNumber(z.coerce.number().positive()),
})

function applyAmountOffRefines<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
  t: Translate,
) {
  return applyWindowRefines(schema, t).refine(
    (d) => {
      if (d.value_type !== "percentage") return true
      return typeof d.amount === "number" && d.amount <= 100
    },
    { message: t("maxPercent"), path: ["amount"] },
  )
}

export const amountOffProductsCouponSchema = (t: Translate) =>
  applyAmountOffRefines(
    z.object({
      ...amountOffBase(t),
      type: z.literal("amount_off_products"),
      applies_to: appliesToSchema.default("products"),
    }),
    t,
  ).refine(
    (d) =>
      (d.product_ids?.length ?? 0) > 0 || (d.collection_ids?.length ?? 0) > 0,
    {
      message: t("selectProductOrCollection"),
      path: ["product_ids"],
    },
  )

export const amountOffOrderCouponSchema = (t: Translate) =>
  applyAmountOffRefines(
    z.object({
      ...amountOffBase(t),
      type: z.literal("amount_off_order"),
    }),
    t,
  )

export const freeShippingCouponSchema = (t: Translate) =>
  applyWindowRefines(
    z.object({
      ...baseCouponShape(t),
      type: z.literal("free_shipping"),
      amount: z.coerce.number().min(0).default(0),
      // Free-shipping specific
      countries_mode: z.enum(["all", "selected"]).default("all"),
      countries: z.array(z.string()).optional(),
      exclude_shipping_rates: z.boolean().default(false),
      exclude_shipping_rates_over: optionalNumber(z.coerce.number().positive()),
    }),
    t,
  ).refine(
    (d) => {
      if (d.countries_mode !== "selected") return true
      return Array.isArray(d.countries) && d.countries.length > 0
    },
    {
      message: t("selectCountry"),
      path: ["countries"],
    },
  )

/** Customer-buys / customer-gets config for BOGO */
const bogoBuyModeSchema = z.enum(["quantity", "amount"])

/**
 * Scope mode for BOGO:
 *   - `shared`: one pool for both buys & gets (uses `product_ids`/`collection_ids` + `applies_to`).
 *   - `separate`: distinct pools for buys and gets (uses `buy_*` / `get_*` fields).
 * Backend falls back to the shared pool when both `buy_*_ids` are empty.
 */
const bogoScopeModeSchema = z.enum(["shared", "separate"])

export const buyXGetYCouponSchema = (t: Translate) =>
  applyWindowRefines(
    z.object({
      ...baseCouponShape(t),
      type: z.literal("buy_x_get_y"),
      amount: z.coerce.number().min(0).default(0),
      // Scope — `shared` matches the original single-pool flow.
      scope_mode: bogoScopeModeSchema.default("shared"),
      applies_to: appliesToSchema.default("all"),
      // Separate-pool fields (only relevant when scope_mode === "separate").
      buy_applies_to: appliesToSchema.default("all"),
      get_applies_to: appliesToSchema.default("all"),
      buy_product_ids: z.array(z.string()).optional(),
      buy_collection_ids: z.array(z.string()).optional(),
      get_product_ids: z.array(z.string()).optional(),
      get_collection_ids: z.array(z.string()).optional(),

      // Customer buys
      buy_mode: bogoBuyModeSchema.default("quantity"),
      buy_quantity: z.coerce.number().int().positive(t("atLeastOne")),
      buy_amount: optionalNumber(z.coerce.number().positive()),

      // Customer gets
      get_quantity: z.coerce.number().int().positive(t("atLeastOne")),
      get_discount_mode: z
        .enum(["percent", "amount", "free"])
        .default("percent"),
      get_discount_percent: z.coerce
        .number()
        .min(0)
        .max(100, t("maxPercent"))
        .default(100),
      get_discount_amount: optionalNumber(z.coerce.number().positive()),
      max_uses_per_order_enabled: z.boolean().default(false),
      max_uses_per_order: optionalNumber(z.coerce.number().int().positive()),
    }),
    t,
  )
    .refine(
      (d) => {
        if (d.buy_mode !== "amount") return true
        const n = Number(d.buy_amount)
        return !Number.isNaN(n) && n > 0
      },
      { message: t("purchaseAmount"), path: ["buy_amount"] },
    )
    .refine(
      (d) => {
        if (d.get_discount_mode !== "amount") return true
        const n = Number(d.get_discount_amount)
        return !Number.isNaN(n) && n > 0
      },
      { message: t("amountOffEach"), path: ["get_discount_amount"] },
    )
    .refine(
      (d) => {
        if (d.scope_mode !== "separate" || d.buy_applies_to !== "products")
          return true
        return (d.buy_product_ids?.length ?? 0) > 0
      },
      {
        message: t("selectBuyProduct"),
        path: ["buy_product_ids"],
      },
    )
    .refine(
      (d) => {
        if (d.scope_mode !== "separate" || d.buy_applies_to !== "collections")
          return true
        return (d.buy_collection_ids?.length ?? 0) > 0
      },
      {
        message: t("selectBuyCollection"),
        path: ["buy_collection_ids"],
      },
    )
    .refine(
      (d) => {
        if (d.scope_mode !== "separate" || d.get_applies_to !== "products")
          return true
        return (d.get_product_ids?.length ?? 0) > 0
      },
      {
        message: t("selectGetProduct"),
        path: ["get_product_ids"],
      },
    )
    .refine(
      (d) => {
        if (d.scope_mode !== "separate" || d.get_applies_to !== "collections")
          return true
        return (d.get_collection_ids?.length ?? 0) > 0
      },
      {
        message: t("selectGetCollection"),
        path: ["get_collection_ids"],
      },
    )

// ── Inferred types ───────────────────────────────────

type AmountOffProductsCouponSchema = ReturnType<
  typeof amountOffProductsCouponSchema
>
type AmountOffOrderCouponSchema = ReturnType<typeof amountOffOrderCouponSchema>
type FreeShippingCouponSchema = ReturnType<typeof freeShippingCouponSchema>
type BuyXGetYCouponSchema = ReturnType<typeof buyXGetYCouponSchema>

export type AmountOffProductsCouponInput = z.input<AmountOffProductsCouponSchema>
export type AmountOffProductsCouponOutput =
  z.output<AmountOffProductsCouponSchema>
export type AmountOffOrderCouponInput = z.input<AmountOffOrderCouponSchema>
export type AmountOffOrderCouponOutput = z.output<AmountOffOrderCouponSchema>
export type FreeShippingCouponInput = z.input<FreeShippingCouponSchema>
export type FreeShippingCouponOutput = z.output<FreeShippingCouponSchema>
export type BuyXGetYCouponInput = z.input<BuyXGetYCouponSchema>
export type BuyXGetYCouponOutput = z.output<BuyXGetYCouponSchema>

export type AnyCouponOutput =
  | AmountOffProductsCouponOutput
  | AmountOffOrderCouponOutput
  | FreeShippingCouponOutput
  | BuyXGetYCouponOutput

export type AnyCouponInput =
  | AmountOffProductsCouponInput
  | AmountOffOrderCouponInput
  | FreeShippingCouponInput
  | BuyXGetYCouponInput

/**
 * Single typed form alias used by every shared coupon card. The shape is
 * intentionally the union of all coupon inputs — react-hook-form's path
 * inference accepts any field that exists on at least one branch, which
 * covers every shared field plus all per-type extras.
 */
export type CouponFormApi = UseFormReturn<
  AnyCouponInput,
  unknown,
  AnyCouponOutput
>

/** Helper: the browser's IANA timezone (safe fallback to UTC). */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

/** Helper: today as YYYY-MM-DD in the user's local zone. */
export function todayLocalISODate(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Helper: current local time as HH:mm rounded to the next 5 minutes. */
export function nowLocalTime(): string {
  const d = new Date()
  const minutes = Math.ceil(d.getMinutes() / 5) * 5
  d.setMinutes(minutes, 0, 0)
  const h = String(d.getHours()).padStart(2, "0")
  const m = String(d.getMinutes()).padStart(2, "0")
  return `${h}:${m}`
}
