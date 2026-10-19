import { z } from "zod"

import type { Translate } from "@/shared/i18n/translator"

/**
 * A segment requires a name and a non-empty ShopifyQL query. The actual
 * ShopifyQL is parsed server-side; we only check non-empty here so the
 * editor surfaces the real parser errors via the preview query.
 *
 * A factory over the `segments.validation` translator: a zod message is fixed
 * when the schema is built, so English literals here would stay English under
 * an Arabic dashboard.
 */
export const segmentFormSchema = (t: Translate) =>
  z.object({
    name: z.string().min(1, t("nameRequired")).max(255, t("nameTooLong")),
    description: z
      .string()
      .max(500, t("descriptionTooLong"))
      .optional()
      .or(z.literal("")),
    query: z.string().min(1, t("queryRequired")),
  })

export type SegmentFormInput = z.input<ReturnType<typeof segmentFormSchema>>
export type SegmentFormOutput = z.output<ReturnType<typeof segmentFormSchema>>
