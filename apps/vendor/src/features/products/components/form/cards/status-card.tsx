"use client"

import { useTranslations } from "next-intl"
import { Controller } from "react-hook-form"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import {
  type ProductFormApi,
  type ProductStatus,
} from "@/features/products/validations/product"
import { ProductStatusOptions } from "@/features/products/components/product-status-options"
import { AiFilledMark } from "@/features/ai/components/ai-filled-mark"

/**
 * Status card — the three statuses, always all three.
 *
 * It used to compute its options from a transition map over a six-state enum,
 * so what the vendor could pick depended on where the product already was and
 * half the options were approval states nobody drove. All three are now one
 * write from each other, so there is nothing to compute.
 *
 * The options come from `ProductStatusOptions`, the same component the list's
 * status cell renders, so the two screens cannot describe a status
 * differently. `SelectValue` takes a render function rather than echoing the
 * item's own text: the item carries a description under its label, and the
 * trigger wants the label alone.
 */
export function StatusCard({ form }: { form: ProductFormApi }) {
  const tList = useTranslations("products.list")
  const tStatus = useTranslations("products.status")
  const { control } = form

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {tList("statusCard")}
          <AiFilledMark name="status" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Select
              value={(field.value as ProductStatus) ?? "DRAFT"}
              onValueChange={(v) => field.onChange(v)}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue>
                  {(value: ProductStatus | null) =>
                    tStatus(value ?? "DRAFT")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} sideOffset={6}>
                <ProductStatusOptions />
              </SelectContent>
            </Select>
          )}
        />
      </CardContent>
    </Card>
  )
}
