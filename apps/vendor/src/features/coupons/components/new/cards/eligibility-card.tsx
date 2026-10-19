"use client"

import { useEffect, useRef, useState } from "react"
import { Controller, useWatch } from "react-hook-form"
import { useTranslations } from "next-intl"
import { SearchIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import { Field, FieldError } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import { RadioGroup } from "@repo/ui/components/radio-group"
import type { CouponFormApi } from "@/features/coupons/validations/coupon"
import type { InitialCouponSnapshots } from "@/features/coupons/lib/new/from-coupon-entry"
import {
  useCouponDeepLinkOverrides,
  useCouponDeepLinkSegmentLabels,
} from "@/features/coupons/lib/new/deep-link-overrides"
import { CustomerPickerDialog } from "../customer-picker-dialog"
import { SegmentPickerDialog } from "../segment-picker-dialog"
import { RadioRow } from "../ui/radio-row"

interface EligibilityCardProps {
  form: CouponFormApi
  snapshots?: InitialCouponSnapshots
}

export function EligibilityCard({ form, snapshots }: EligibilityCardProps) {
  const t = useTranslations("coupons.eligibility")
  const tForm = useTranslations("coupons.form")
  const {
    control,
    setValue,
    formState: { errors },
  } = form
  const mode = useWatch({ control, name: "eligibility" })
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false)
  const [segmentPickerOpen, setSegmentPickerOpen] = useState(false)

  // ?segment=X deep-link from the segments editor's "Create discount" item.
  // Applied ONCE on first mount so we don't fight the vendor if they later
  // switch the eligibility mode away from "segment".
  const deepLink = useCouponDeepLinkOverrides()
  const deepLinkSegmentLabels = useCouponDeepLinkSegmentLabels()
  const appliedDeepLink = useRef(false)
  useEffect(() => {
    if (appliedDeepLink.current) return
    if (deepLink.eligibility) {
      setValue("eligibility", deepLink.eligibility, { shouldDirty: true })
    }
    if (deepLink.segment_ids?.length) {
      setValue("segment_ids", deepLink.segment_ids, {
        shouldValidate: true,
        shouldDirty: true,
      })
    }
    appliedDeepLink.current = true
  }, [deepLink, setValue])

  // Mutable overlays so freshly-picked customers / segments show names
  // without having to re-fetch the coupon. `snapshots` seeds the map from
  // the initial resolved entities on the edit page; the segments overlay
  // also seeds from the `?segment=X` deep-link landing on the create page.
  const [customerLabels, setCustomerLabels] = useState<
    Record<string, { name: string }>
  >(snapshots?.customers ?? {})
  const [segmentLabels, setSegmentLabels] = useState<
    Record<string, { name: string }>
  >({ ...deepLinkSegmentLabels, ...(snapshots?.segments ?? {}) })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("channels")}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Controller
          control={control}
          name="eligibility"
          render={({ field }) => (
            <RadioGroup
              value={field.value ?? "all_customers"}
              onValueChange={field.onChange}
            >
              <RadioRow
                value="all_customers"
                label={t("allCustomers")}
                selected={(field.value ?? "all_customers") === "all_customers"}
              />
              <RadioRow
                value="segment"
                label={t("specificSegments")}
                selected={field.value === "segment"}
              />
              <RadioRow
                value="specific_customers"
                label={t("specificCustomers")}
                selected={field.value === "specific_customers"}
              />
            </RadioGroup>
          )}
        />

        {mode === "segment" && (
          <Controller
            control={control}
            name="segment_ids"
            render={({ field }) => (
              <Field>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      className="pl-8 cursor-pointer"
                      placeholder={t("searchSegments")}
                      readOnly
                      onClick={() => setSegmentPickerOpen(true)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSegmentPickerOpen(true)}
                  >
                    {tForm("browse")}
                  </Button>
                </div>
                {Array.isArray(field.value) && field.value.length > 0 && (
                  <SelectedChips
                    items={field.value as string[]}
                    labels={segmentLabels}
                    removeLabel={(name) => t("remove", { name })}
                    onRemove={(id) =>
                      field.onChange(
                        (field.value as string[]).filter((i) => i !== id),
                      )
                    }
                  />
                )}
                <FieldError errors={[errors.segment_ids]} />

                <SegmentPickerDialog
                  open={segmentPickerOpen}
                  onOpenChange={setSegmentPickerOpen}
                  value={(field.value as string[]) ?? []}
                  onConfirm={(ids, picked) => {
                    setSegmentLabels((prev) => ({ ...prev, ...picked }))
                    setValue("segment_ids", ids, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }}
                />
              </Field>
            )}
          />
        )}

        {mode === "specific_customers" && (
          <Controller
            control={control}
            name="customer_ids"
            render={({ field }) => (
              <Field>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      className="pl-8 cursor-pointer"
                      placeholder={t("searchCustomers")}
                      readOnly
                      onClick={() => setCustomerPickerOpen(true)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCustomerPickerOpen(true)}
                  >
                    {tForm("browse")}
                  </Button>
                </div>
                {Array.isArray(field.value) && field.value.length > 0 && (
                  <SelectedChips
                    items={field.value as string[]}
                    labels={customerLabels}
                    removeLabel={(name) => t("remove", { name })}
                    onRemove={(id) =>
                      field.onChange(
                        (field.value as string[]).filter((i) => i !== id),
                      )
                    }
                  />
                )}
                <FieldError errors={[errors.customer_ids]} />

                <CustomerPickerDialog
                  open={customerPickerOpen}
                  onOpenChange={setCustomerPickerOpen}
                  value={(field.value as string[]) ?? []}
                  onConfirm={(ids, picked) => {
                    // Merge the new labels into the overlay so chips render
                    // names immediately — untouched ids keep their existing
                    // labels from `snapshots`.
                    setCustomerLabels((prev) => ({ ...prev, ...picked }))
                    setValue("customer_ids", ids, {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }}
                />
              </Field>
            )}
          />
        )}
      </CardContent>
    </Card>
  )
}

function SelectedChips({
  items,
  labels,
  removeLabel,
  onRemove,
}: {
  items: string[]
  labels?: Record<string, { name: string }>
  /** Accessible name of a chip's × button, already localized. */
  removeLabel: (name: string) => string
  onRemove: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {items.map((id) => {
        const label = labels?.[id]?.name ?? id
        return (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs"
            title={label !== id ? id : undefined}
          >
            {label}
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onRemove(id)}
              aria-label={removeLabel(label)}
            >
              ×
            </button>
          </span>
        )
      })}
    </div>
  )
}
