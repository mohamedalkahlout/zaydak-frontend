import { z } from "zod"
import type { Translate } from "@/shared/i18n/translator"
import type { AttributionChannel } from "./types"
import { CHANNEL_OPTIONS } from "./lib/attribution"

const positiveNumber = (msg: string) =>
  z.string().refine((v) => Number.isFinite(Number(v)) && Number(v) > 0, {
    message: msg,
  })

// `spend`/`rate` stay strings in the form and convert at submit. `spend` is a
// major-unit money value; `rate` is a multiplier to the shop currency (1 = same).
//
// Built from the `adSpend.validation` translator: a zod message is fixed when
// the schema is built, so English literals here would stay English in Arabic.
export const adSpendFormSchema = (t: Translate) =>
  z.object({
    channel: z.enum(CHANNEL_OPTIONS as [AttributionChannel, ...AttributionChannel[]]),
    source: z.string().trim().min(1, t("sourceRequired")),
    campaign: z.string().trim().optional(),
    date: z.string().min(1, t("dateRequired")),
    spend: positiveNumber(t("spendPositive")),
    currency: z.string().trim().min(1).max(8),
    rate: positiveNumber(t("ratePositive")),
  })

export type AdSpendFormInput = z.infer<ReturnType<typeof adSpendFormSchema>>
