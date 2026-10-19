import { z } from "zod"

import type { UpsertPaymentGatewayFeeInput } from "@/shared/api/generated/graphql"
import {
  bpsOf,
  bpsToPercent,
  centsToMajor,
  hasAtMostTwoDecimals,
  toCents,
} from "@/shared/lib/format"
import { MAX_FEE_PERCENT, type PaymentFeeRow } from "./types"

/** The `paymentFees` translator, as much of it as the schema needs. */
export type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string

/**
 * Mirrors `UpsertPaymentGatewayFeeInput`, in the units a person types: the
 * percentage as a percent and the fixed part and the cap in major units. The
 * API holds basis points and cents; `toUpsertInput` below is the one place
 * they are converted.
 *
 * Takes the translator, so every message follows the console's language.
 *
 * The number fields are plain `z.number()` rather than `z.coerce.number()`: the
 * inputs register with `valueAsNumber`, so react-hook-form hands zod a number
 * already, and coercion would erase the schema's input type for `zodResolver`.
 *
 * `cap` is nullable: a cleared field means the fee has no cap, not a cap of
 * zero. A cap below the fixed part is refused, as the server refuses it: the
 * fee is `min(percentage + fixed, cap)`, so such a cap would always apply and
 * turn the row into a flat fee nobody meant to set.
 */
export function paymentFeeSchema(t: Translate) {
  const amount = (label: string) =>
    z
      .number(t("validation.number", { field: label }))
      .min(0, t("validation.negative", { field: label }))
      .refine(hasAtMostTwoDecimals, t("validation.decimals", { field: label }))

  return z
    .object({
      gateway: z.string().min(1, t("validation.gateway")),
      currency: z
        .string()
        .trim()
        .regex(/^[A-Za-z]{3}$/, t("validation.currency")),
      percent: amount(t("column.percent")).max(
        MAX_FEE_PERCENT,
        t("validation.percentMax", { max: MAX_FEE_PERCENT }),
      ),
      fixed: amount(t("column.fixed")),
      cap: amount(t("column.cap")).nullable(),
      active: z.boolean(),
    })
    .refine((fee) => fee.cap === null || fee.cap >= fee.fixed, {
      message: t("validation.capBelowFixed"),
      path: ["cap"],
    })
}

export type PaymentFeeFormValues = z.infer<ReturnType<typeof paymentFeeSchema>>

/**
 * What the form opens with: the row's own terms, or an empty fee for a new
 * one. The read half of the money boundary — cents and basis points become
 * major units and a percent here and nowhere else in the feature.
 */
export function toFormValues(
  fee: PaymentFeeRow | null,
  defaults: { gateway: string; currency: string },
): PaymentFeeFormValues {
  if (!fee) {
    return { ...defaults, percent: 0, fixed: 0, cap: null, active: true }
  }
  return {
    gateway: fee.gateway,
    currency: fee.currency,
    percent: bpsToPercent(fee.fee_bps),
    fixed: centsToMajor(fee.fee_fixed_cents),
    cap: fee.fee_cap_cents == null ? null : centsToMajor(fee.fee_cap_cents),
    active: fee.active,
  }
}

/**
 * The write half: a percent and major units in, basis points and integer cents
 * out. `bpsOf` and `toCents` round the way the server does. The currency goes
 * out in upper case, the only form the API takes.
 */
export function toUpsertInput(
  values: PaymentFeeFormValues,
): UpsertPaymentGatewayFeeInput {
  return {
    gateway: values.gateway,
    currency: values.currency.trim().toUpperCase(),
    fee_bps: bpsOf(values.percent),
    fee_fixed_cents: toCents(values.fixed),
    fee_cap_cents: values.cap === null ? null : toCents(values.cap),
    active: values.active,
  }
}
