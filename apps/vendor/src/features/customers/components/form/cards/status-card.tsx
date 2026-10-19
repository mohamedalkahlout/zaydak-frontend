"use client"

import { useTranslations } from "next-intl"
import { Controller } from "react-hook-form"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import {
  CONTACT_STATUS_OPTIONS,
  contactStatusKey,
} from "@/features/customers/lib/constants"
import type { CustomerFormApi } from "../customer-form-layout"

/**
 * Sidebar Status card — mirrors Shopify's account-status indicator.
 * Inactive customers stay in the list but are excluded from default
 * segments and any "active customers" counts.
 */
export function StatusCard({ form }: { form: CustomerFormApi }) {
  const t = useTranslations("customers")
  // The same words the list's badge and status filter read. Handed to the root
  // as `items` so the trigger shows them rather than the raw status id.
  const options = CONTACT_STATUS_OPTIONS.map(({ value }) => ({
    value,
    label: t(contactStatusKey(value)),
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("statusCard.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Controller
          control={form.control}
          name="status"
          render={({ field }) => (
            <Select
              items={options}
              value={field.value || "active"}
              onValueChange={(v) =>
                field.onChange((v as "active" | "inactive") ?? "active")
              }
            >
              <SelectTrigger className="w-full">
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
        <p className="mt-2 text-xs text-muted-foreground">
          {t("statusCard.hint")}
        </p>
      </CardContent>
    </Card>
  )
}
