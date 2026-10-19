"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import { useForm, useWatch, type DefaultValues } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useVendorAgentHandoff } from "@/features/ai/lib/use-prefill"
import { useCouponLiveForm } from "@/features/coupons/lib/live-form"
import { InboxIcon, PercentIcon, WalletIcon } from "lucide-react"
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import {
  MoneyOrPercentSuffix,
  MoneySuffix,
} from "@/shared/components/money-suffix"
import {
  amountOffOrderCouponSchema,
  type AmountOffOrderCouponInput,
  type AmountOffOrderCouponOutput,
  type CouponFormApi,
} from "@/features/coupons/validations/coupon"
import { CouponBaseFields } from "../coupon-base-fields"
import { CouponFormLayout } from "../coupon-form-layout"
import { CouponHeaderCard } from "../cards/coupon-header-card"
import { SectionCard } from "../ui/section-card"
import { SegmentedToggle } from "../ui/segmented-toggle"
import { useCouponSubmit } from "../use-coupon-submit"
import { baseCouponDefaults } from "@/features/coupons/lib/new/form-defaults"
import type { InitialCouponSnapshots } from "@/features/coupons/lib/new/from-coupon-entry"

interface Props {
  mode?: "create" | "edit"
  couponId?: string
  initialValues?: AmountOffOrderCouponInput
  initialSnapshots?: InitialCouponSnapshots
  headerAction?: React.ReactNode
}

export function AmountOffOrderCouponForm({
  mode = "create",
  couponId,
  initialValues,
  initialSnapshots,
  headerAction,
}: Props = {}) {
  const t = useTranslations("coupons")
  const tv = useTranslations("coupons.validation")
  // AI-prefill from a recent create_coupon / update_coupon chat call.
  // Consumed-on-read (a second mount won't re-apply). Create: merged over
  // defaults; edit: merged over the coupon's current values.
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
        type: "amount_off_order",
        value_type: "percentage",
        allow_product: true,
        allow_shipping: true,
      } satisfies DefaultValues<AmountOffOrderCouponInput>)
    return aiPrefill
      ? { ...base, ...(aiPrefill as Partial<AmountOffOrderCouponInput>) }
      : base
  }, [initialValues, aiPrefill])

  const form = useForm<
    AmountOffOrderCouponInput,
    unknown,
    AmountOffOrderCouponOutput
  >({
    resolver: zodResolver(amountOffOrderCouponSchema(tv)),
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
  const isPercent = valueType === "percentage"

  return (
    <CouponFormLayout
      title={
        mode === "edit"
          ? t("amountOffOrderForm.editTitle")
          : t("kinds.amount_off_order.label")
      }
      subtitle={t("kinds.amount_off_order.description")}
      saving={loading}
      form={sharedForm}
      onValid={submit}
      onInvalid={onInvalid}
      typeLabel={t("kinds.amount_off_order.label")}
      typeSubLabel={t("form.orderDiscount")}
      TypeIcon={InboxIcon}
      unsavedLabel={
        mode === "edit" ? t("form.unsavedChanges") : t("form.unsavedDiscount")
      }
      headerAction={headerAction}
    >
      <CouponHeaderCard
        form={sharedForm}
        title={t("kinds.amount_off_order.label")}
      />

      <SectionCard
        icon={isPercent ? PercentIcon : WalletIcon}
        tone="primary"
        title={t("form.discountValue")}
        subtitle={t("amountOffOrderForm.discountValueHint")}
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
                placeholder={isPercent ? "10" : "20"}
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

      <CouponBaseFields form={sharedForm} snapshots={initialSnapshots} />
    </CouponFormLayout>
  )
}
