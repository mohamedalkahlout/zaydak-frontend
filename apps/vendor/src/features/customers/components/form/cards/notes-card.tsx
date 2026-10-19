"use client"

import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import { Textarea } from "@repo/ui/components/textarea"
import type { CustomerFormApi } from "../customer-form-layout"

/**
 * Private notes — visible to staff only, never sent to the customer.
 * Lives in the sidebar like Shopify's notes block.
 */
export function NotesCard({ form }: { form: CustomerFormApi }) {
  const t = useTranslations("customers.notes")
  const { register } = form

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </CardHeader>
      <CardContent>
        <Textarea
          id="customer-notes"
          rows={4}
          placeholder={t("placeholder")}
          {...register("notes")}
        />
      </CardContent>
    </Card>
  )
}
