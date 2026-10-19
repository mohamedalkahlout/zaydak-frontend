import { z } from "zod"
import type { Translate } from "@/shared/i18n/translator"
import type { TargetMetric, TargetPeriod } from "./types"
import { METRIC_OPTIONS, PERIOD_OPTIONS } from "./lib/targets"

// `value` stays a string in the form (avoids NaN/coerce churn); it's parsed and
// converted to the wire integer at submit, in the metric's unit.
//
// Built from the `targets.validation` translator: a zod message is fixed when
// the schema is built, so English literals here would stay English in Arabic.
export const targetFormSchema = (t: Translate) =>
  z
    .object({
      name: z.string().trim().min(1, t("nameRequired")),
      metric: z.enum(METRIC_OPTIONS as [TargetMetric, ...TargetMetric[]]),
      period: z.enum(PERIOD_OPTIONS as [TargetPeriod, ...TargetPeriod[]]),
      value: z
        .string()
        .refine((v) => Number.isFinite(Number(v)) && Number(v) > 0, {
          message: t("positiveNumber"),
        }),
      start: z.string().optional(),
      end: z.string().optional(),
      activate: z.boolean(),
    })
    .refine((d) => d.period !== "CUSTOM" || (!!d.start && !!d.end), {
      path: ["end"],
      message: t("rangeRequired"),
    })
    .refine(
      (d) =>
        d.period !== "CUSTOM" ||
        !d.start ||
        !d.end ||
        new Date(d.end) > new Date(d.start),
      { path: ["end"], message: t("endAfterStart") },
    )
    .refine(
      (d) => d.metric !== "RETURNING_CUSTOMER_RATE" || Number(d.value) <= 100,
      { path: ["value"], message: t("rateMax") },
    )

export type TargetFormInput = z.infer<ReturnType<typeof targetFormSchema>>
