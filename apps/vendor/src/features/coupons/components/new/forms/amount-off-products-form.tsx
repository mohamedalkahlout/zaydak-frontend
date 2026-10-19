"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Controller, useForm, useWatch, type DefaultValues } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useVendorAgentHandoff } from "@/features/ai/lib/use-prefill"
import { useCouponLiveForm } from "@/features/coupons/lib/live-form"
import { LayersIcon, PackageIcon, TagIcon } from "lucide-react"
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import {
  MoneyOrPercentSuffix,
  MoneySuffix,
} from "@/shared/components/money-suffix"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import {
  amountOffProductsCouponSchema,
  type AmountOffProductsCouponInput,
  type AmountOffProductsCouponOutput,
  type CouponFormApi,
} from "@/features/coupons/validations/coupon"
import { CategoryPickerDialog } from "../category-picker-dialog"
import { CouponBaseFields } from "../coupon-base-fields"
import { CouponFormLayout } from "../coupon-form-layout"
import { CouponHeaderCard } from "../cards/coupon-header-card"
import { ProductPickerDialog } from "../product-picker-dialog"
import { SectionCard } from "../ui/section-card"
import { ScopePreview } from "../ui/scope-preview"
import { SegmentedToggle } from "../ui/segmented-toggle"
import { useCouponSubmit } from "../use-coupon-submit"
import { baseCouponDefaults } from "@/features/coupons/lib/new/form-defaults"
import type { InitialCouponSnapshots } from "@/features/coupons/lib/new/from-coupon-entry"
import { pickPreviewNames } from "@/features/coupons/lib/new/preview-names"

interface Props {
  mode?: "create" | "edit"
  couponId?: string
  initialValues?: AmountOffProductsCouponInput
  initialSnapshots?: InitialCouponSnapshots
  headerAction?: React.ReactNode
}

export function AmountOffProductsCouponForm({
  mode = "create",
  couponId,
  initialValues,
  initialSnapshots,
  headerAction,
}: Props = {}) {
  const t = useTranslations("coupons")
  const tv = useTranslations("coupons.validation")
  const [pickerOpen, setPickerOpen] = useState(false)
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false)
  const handoff = useVendorAgentHandoff(
    mode === "edit" ? "coupon_edit" : "coupon_create",
    couponId,
  )
  const aiPrefill = handoff?.values
  const mergedDefaults = useMemo(() => {
    const base =
      initialValues ??
      ({
        ...baseCouponDefaults(),
        type: "amount_off_products",
        value_type: "percentage",
        allow_order: true,
        allow_shipping: true,
        applies_to: "products",
        product_ids: [],
        collection_ids: [],
      } satisfies DefaultValues<AmountOffProductsCouponInput>)
    return aiPrefill
      ? { ...base, ...(aiPrefill as Partial<AmountOffProductsCouponInput>) }
      : base
  }, [initialValues, aiPrefill])

  const form = useForm<
    AmountOffProductsCouponInput,
    unknown,
    AmountOffProductsCouponOutput
  >({
    resolver: zodResolver(amountOffProductsCouponSchema(tv)),
    defaultValues: mergedDefaults,
  })
  const sharedForm = form as unknown as CouponFormApi
  // While this form is one the assistant prepared it is the live form: each
  // chat message carries its values, and a `patch_form` result is staged
  // into it — dirty, save bar showing, nothing saved until Save.
  useCouponLiveForm({
    form: sharedForm,
    handoffId: handoff?.handoffId,
    mode,
    couponId,
    label: initialValues?.code,
  })
  const { submit, onInvalid, loading } = useCouponSubmit(
    mode === "edit" && couponId
      ? { kind: "edit", id: couponId }
      : { kind: "create" },
    sharedForm,
  )
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = form

  const valueType = useWatch({ control, name: "value_type" }) ?? "percentage"
  const appliesTo = useWatch({ control, name: "applies_to" }) ?? "products"
  const productIds = useWatch({ control, name: "product_ids" }) ?? []
  const collectionIds = useWatch({ control, name: "collection_ids" }) ?? []
  const isPercent = valueType === "percentage"

  return (
    <>
      <CouponFormLayout
        title={
          mode === "edit"
            ? t("amountOffProductsForm.editTitle")
            : t("kinds.amount_off_products.label")
        }
        subtitle={t("amountOffProductsForm.subtitle")}
        saving={loading}
        form={sharedForm}
        onValid={submit}
        onInvalid={onInvalid}
        typeLabel={t("kinds.amount_off_products.label")}
        typeSubLabel={t("form.productDiscount")}
        TypeIcon={TagIcon}
        unsavedLabel={
          mode === "edit" ? t("form.unsavedChanges") : t("form.unsavedDiscount")
        }
        headerAction={headerAction}
      >
        <CouponHeaderCard
          form={sharedForm}
          title={t("kinds.amount_off_products.label")}
        />

        <SectionCard
          icon={TagIcon}
          tone="primary"
          title={t("form.discountValue")}
          subtitle={t("amountOffProductsForm.discountValueHint")}
        >
          <SegmentedToggle
            ariaLabel={t("form.valueType")}
            value={valueType}
            onChange={(next) =>
              setValue("value_type", next, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
            options={[
              { value: "percentage", label: t("form.percentage") },
              { value: "fixed", label: t("form.fixedAmount") },
            ]}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="amount">
                {isPercent ? t("form.percentage") : t("form.amount")}
              </FieldLabel>
              <div className="relative">
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min={0}
                  max={isPercent ? 100 : undefined}
                  placeholder={isPercent ? "15" : "20"}
                  className={isPercent ? "pe-8" : "pe-12"}
                  {...register("amount")}
                />
                <MoneyOrPercentSuffix percent={isPercent} className="text-xs" />
              </div>
              <FieldError errors={[errors.amount]} />
            </Field>

            {isPercent && (
              <Field>
                <FieldLabel htmlFor="max_discount">
                  {t("form.maxDiscount")}
                </FieldLabel>
                <div className="relative">
                  <Input
                    id="max_discount"
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="50"
                    className="pe-12"
                    {...register("max_discount")}
                  />
                  <MoneySuffix />
                </div>
                <FieldError errors={[errors.max_discount]} />
              </Field>
            )}
          </div>
        </SectionCard>

        <SectionCard
          icon={PackageIcon}
          tone="sky"
          title={t("amountOffProductsForm.appliesTo")}
          subtitle={t("amountOffProductsForm.appliesToHint")}
        >
          <Field>
            <FieldLabel>{t("amountOffProductsForm.scope")}</FieldLabel>
            <Controller
              control={control}
              name="applies_to"
              render={({ field }) => (
                <Select
                  value={field.value ?? "products"}
                  onValueChange={(next) => {
                    field.onChange(next)
                    if (next === "collections") {
                      setValue("product_ids", [], {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    } else {
                      setValue("collection_ids", [], {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                  }}
                >
                  <SelectTrigger className="w-full sm:max-w-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="products">
                      {t("form.specificProducts")}
                    </SelectItem>
                    <SelectItem value="collections">
                      {t("form.specificCollections")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          {appliesTo === "products" ? (
            <ScopePreview
              icon={PackageIcon}
              count={productIds.length}
              kind="products"
              onBrowse={() => setPickerOpen(true)}
              previewNames={pickPreviewNames(productIds, initialSnapshots?.products)}
              onClear={() =>
                setValue("product_ids", [], {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
            />
          ) : (
            <ScopePreview
              icon={LayersIcon}
              count={collectionIds.length}
              kind="collections"
              onBrowse={() => setCategoryPickerOpen(true)}
              previewNames={pickPreviewNames(collectionIds, initialSnapshots?.collections)}
              onClear={() =>
                setValue("collection_ids", [], {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
            />
          )}

          <FieldError errors={[errors.product_ids, errors.collection_ids]} />
        </SectionCard>

        <CouponBaseFields form={sharedForm} snapshots={initialSnapshots} />
      </CouponFormLayout>

      <ProductPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        value={productIds}
        onConfirm={(ids) =>
          setValue("product_ids", ids, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      />

      <CategoryPickerDialog
        open={categoryPickerOpen}
        onOpenChange={setCategoryPickerOpen}
        value={collectionIds}
        onConfirm={(ids) =>
          setValue("collection_ids", ids, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      />
    </>
  )
}
