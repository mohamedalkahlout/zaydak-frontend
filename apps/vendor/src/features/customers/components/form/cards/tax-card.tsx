"use client"

import { useTranslations } from "next-intl"
import { Controller } from "react-hook-form"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import { Field, FieldLabel } from "@repo/ui/components/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { taxSettingKey } from "@/features/customers/lib/constants"
import { TAX_SETTING_VALUES } from "@/features/customers/validations/customer"
import type { TaxSetting } from "@/features/customers/types"
import type { CustomerFormApi } from "../customer-form-layout"

/**
 * "Tax details" card matching Shopify's customer Tax settings block —
 * a single dropdown, no extra fields.
 */
export function TaxCard({ form }: { form: CustomerFormApi }) {
  const t = useTranslations("customers")
  const { control } = form
  // Handed to the root as `items` so the trigger shows the selected setting's
  // words rather than its raw id.
  const options = TAX_SETTING_VALUES.map((value) => ({
    value,
    label: t(taxSettingKey(value)),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("tax.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Field>
          <FieldLabel htmlFor="tax-setting">{t("tax.label")}</FieldLabel>
          <Controller
            control={control}
            name="tax_setting"
            render={({ field }) => (
              <Select
                items={options}
                value={field.value || "collect"}
                onValueChange={(v) => field.onChange(v as TaxSetting)}
              >
                <SelectTrigger id="tax-setting" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
      </CardContent>
    </Card>
  )
}
