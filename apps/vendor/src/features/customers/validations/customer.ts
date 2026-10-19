import { z } from "zod"
import type { Translate } from "@/shared/i18n/translator"

export const TAX_SETTING_VALUES = ["collect", "dont_collect", "exempt"] as const

export const addressSchema = z.object({
  address_1: z.string().trim().optional().or(z.literal("")),
  address_2: z.string().trim().optional().or(z.literal("")),
  city: z.string().trim().optional().or(z.literal("")),
  region: z.string().trim().optional().or(z.literal("")),
  country: z.string().trim().optional().or(z.literal("")),
  postal_code: z.string().trim().optional().or(z.literal("")),
  company: z.string().trim().optional().or(z.literal("")),
})

/**
 * A factory rather than a constant: a zod message is fixed when the schema is
 * built, so the messages come from `t` (`customers.validation`) to be in the
 * dashboard's language.
 */
export const customerFormSchema = (t: Translate) =>
  z
    .object({
      first_name: z.string().trim().optional().or(z.literal("")),
      last_name: z.string().trim().optional().or(z.literal("")),
      email: z
        .string()
        .trim()
        .email(t("email"))
        .optional()
        .or(z.literal("")),
      phone_number: z.string().trim().optional().or(z.literal("")),
      language: z.string().trim().optional().or(z.literal("")),
      accepts_marketing: z.boolean().default(false),
      accepts_sms_marketing: z.boolean().default(false),
      address: addressSchema.optional(),
      tax_setting: z.enum(TAX_SETTING_VALUES).default("collect"),
      tags: z.array(z.string().trim().min(1)).default([]),
      description: z.string().trim().optional().or(z.literal("")),
      notes: z.string().trim().optional().or(z.literal("")),
      status: z.enum(["active", "inactive"]).default("active"),
    })
    .refine(
      (v) =>
        (v.first_name && v.first_name.length > 0) ||
        (v.last_name && v.last_name.length > 0) ||
        (v.email && v.email.length > 0) ||
        (v.phone_number && v.phone_number.length > 0),
      {
        message: t("identityRequired"),
        path: ["first_name"],
      },
    )

type CustomerFormSchema = ReturnType<typeof customerFormSchema>

export type CustomerFormInput = z.input<CustomerFormSchema>
export type CustomerFormOutput = z.output<CustomerFormSchema>
