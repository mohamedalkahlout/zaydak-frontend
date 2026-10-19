import { z } from "zod"
import type { Translate } from "@/shared/i18n/translator"

/**
 * A factory rather than a constant: a zod message is fixed when the schema is
 * built, so the messages come from `t` (`tags.validation`) to be in the
 * dashboard's language.
 */
export const tagFormSchema = (t: Translate) =>
  z.object({
    name_en: z.string().trim().min(1, t("nameEnRequired")),
    name_ar: z.string().trim().min(1, t("nameArRequired")),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]*$/i, t("slugFormat"))
      .optional()
      .or(z.literal("")),
    icon: z.string().trim().optional().or(z.literal("")),
    details_en: z.string().trim().optional().or(z.literal("")),
    details_ar: z.string().trim().optional().or(z.literal("")),
  })

export type TagFormInput = z.infer<ReturnType<typeof tagFormSchema>>
