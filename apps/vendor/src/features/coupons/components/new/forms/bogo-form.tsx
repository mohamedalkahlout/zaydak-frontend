"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Controller, useForm, useWatch, type DefaultValues } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useVendorAgentHandoff } from "@/features/ai/lib/use-prefill"
import { useCouponLiveForm } from "@/features/coupons/lib/live-form"
import {
  ArrowRightIcon,
  GiftIcon,
  LayersIcon,
  PackageIcon,
  PercentIcon,
  ShoppingBagIcon,
  SparklesIcon,
  TagIcon,
  WalletIcon,
} from "lucide-react"
import { Checkbox } from "@repo/ui/components/checkbox"
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import { MoneySuffix } from "@/shared/components/money-suffix"
import { Label } from "@repo/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import {
  buyXGetYCouponSchema,
  type BuyXGetYCouponInput,
  type BuyXGetYCouponOutput,
  type CouponFormApi,
} from "@/features/coupons/validations/coupon"
import { cn } from "@/shared/lib/utils"
import { CategoryPickerDialog } from "../category-picker-dialog"
import { CouponBaseFields } from "../coupon-base-fields"
import { CouponFormLayout } from "../coupon-form-layout"
import { CouponHeaderCard } from "../cards/coupon-header-card"
import { ProductPickerDialog } from "../product-picker-dialog"
import { ChoiceCard } from "../ui/choice-card"
import { ScopePreview } from "../ui/scope-preview"
import { SectionCard } from "../ui/section-card"
import { SegmentedToggle } from "../ui/segmented-toggle"
import { useCouponSubmit } from "../use-coupon-submit"
import { baseCouponDefaults } from "@/features/coupons/lib/new/form-defaults"
import type { InitialCouponSnapshots } from "@/features/coupons/lib/new/from-coupon-entry"
import { pickPreviewNames } from "@/features/coupons/lib/new/preview-names"
import type { Translate } from "@/shared/i18n/translator"

interface Props {
  mode?: "create" | "edit"
  couponId?: string
  initialValues?: BuyXGetYCouponInput
  initialSnapshots?: InitialCouponSnapshots
  headerAction?: React.ReactNode
}

export function BuyXGetYCouponForm({
  mode = "create",
  couponId,
  initialValues,
  initialSnapshots,
  headerAction,
}: Props = {}) {
  const t = useTranslations("coupons")
  const tv = useTranslations("coupons.validation")
  const [pickerOpen, setPickerOpen] = useState(false)
  const [collectionPickerOpen, setCollectionPickerOpen] = useState(false)
  const [buyPickerOpen, setBuyPickerOpen] = useState(false)
  const [buyCollectionPickerOpen, setBuyCollectionPickerOpen] = useState(false)
  const [getPickerOpen, setGetPickerOpen] = useState(false)
  const [getCollectionPickerOpen, setGetCollectionPickerOpen] = useState(false)
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
        type: "buy_x_get_y",
        amount: 0,
        scope_mode: "shared",
        applies_to: "all",
        buy_applies_to: "all",
        get_applies_to: "all",
        buy_product_ids: [],
        buy_collection_ids: [],
        get_product_ids: [],
        get_collection_ids: [],
        buy_mode: "quantity",
        buy_quantity: 1,
        get_quantity: 1,
        get_discount_mode: "percent",
        get_discount_percent: 100,
        max_uses_per_order_enabled: false,
        allow_order: true,
        allow_shipping: true,
        product_ids: [],
        collection_ids: [],
      } satisfies DefaultValues<BuyXGetYCouponInput>)
    return aiPrefill
      ? { ...base, ...(aiPrefill as Partial<BuyXGetYCouponInput>) }
      : base
  }, [initialValues, aiPrefill])

  const form = useForm<BuyXGetYCouponInput, unknown, BuyXGetYCouponOutput>({
    resolver: zodResolver(buyXGetYCouponSchema(tv)),
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

  const scopeMode = useWatch({ control, name: "scope_mode" }) ?? "shared"
  const appliesTo = useWatch({ control, name: "applies_to" }) ?? "all"
  const buyAppliesTo = useWatch({ control, name: "buy_applies_to" }) ?? "all"
  const getAppliesTo = useWatch({ control, name: "get_applies_to" }) ?? "all"
  const productIds = useWatch({ control, name: "product_ids" }) ?? []
  const collectionIds = useWatch({ control, name: "collection_ids" }) ?? []
  const buyProductIds = useWatch({ control, name: "buy_product_ids" }) ?? []
  const buyCategoryIds = useWatch({ control, name: "buy_collection_ids" }) ?? []
  const getProductIds = useWatch({ control, name: "get_product_ids" }) ?? []
  const getCategoryIds = useWatch({ control, name: "get_collection_ids" }) ?? []
  const buyMode = useWatch({ control, name: "buy_mode" }) ?? "quantity"
  const discountMode =
    useWatch({ control, name: "get_discount_mode" }) ?? "percent"
  const perOrderEnabled = !!useWatch({
    control,
    name: "max_uses_per_order_enabled",
  })
  const buyQty = Number(useWatch({ control, name: "buy_quantity" })) || 0
  const getQty = Number(useWatch({ control, name: "get_quantity" })) || 0
  const pctValue =
    Number(useWatch({ control, name: "get_discount_percent" })) || 0
  const amountValue =
    Number(useWatch({ control, name: "get_discount_amount" })) || 0

  return (
    <>
      <CouponFormLayout
        title={
          mode === "edit"
            ? t("bogoForm.editTitle")
            : t("kinds.buy_x_get_y.label")
        }
        subtitle={t("bogoForm.subtitle")}
        saving={loading}
        form={sharedForm}
        onValid={submit}
        onInvalid={onInvalid}
        typeLabel={t("kinds.buy_x_get_y.label")}
        typeSubLabel={t("form.productDiscount")}
        TypeIcon={GiftIcon}
        unsavedLabel={
          mode === "edit" ? t("form.unsavedChanges") : t("form.unsavedDiscount")
        }
        headerAction={headerAction}
      >
        <CouponHeaderCard
          form={sharedForm}
          title={t("kinds.buy_x_get_y.label")}
        />

        <SectionCard
          icon={LayersIcon}
          tone="primary"
          title={t("bogoForm.eligibleItems")}
          subtitle={t("bogoForm.eligibleItemsHint")}
        >
          <SegmentedToggle
            ariaLabel={t("bogoForm.scopeMode")}
            value={scopeMode}
            onChange={(next) => {
              setValue("scope_mode", next, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }}
            options={[
              { value: "shared", label: t("bogoForm.sameItems") },
              { value: "separate", label: t("bogoForm.differentItems") },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            {scopeMode === "shared"
              ? t("bogoForm.sameItemsHint")
              : t("bogoForm.differentItemsHint")}
          </p>
        </SectionCard>

        <SectionCard
          icon={ShoppingBagIcon}
          tone="sky"
          title={t("bogoForm.customerBuys")}
          subtitle={t("bogoForm.customerBuysHint")}
        >
          <SegmentedToggle
            ariaLabel={t("bogoForm.purchaseRequirement")}
            value={buyMode}
            onChange={(next) =>
              setValue("buy_mode", next, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
            options={[
              { value: "quantity", label: t("bogoForm.minimumQuantity") },
              { value: "amount", label: t("bogoForm.minimumAmount") },
            ]}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            {buyMode === "quantity" ? (
              <Field>
                <FieldLabel htmlFor="buy_quantity">
                  {t("bogoForm.quantity")}
                </FieldLabel>
                <Input
                  id="buy_quantity"
                  type="number"
                  min={1}
                  placeholder="2"
                  {...register("buy_quantity")}
                />
                <FieldError errors={[errors.buy_quantity]} />
              </Field>
            ) : (
              <Field>
                <FieldLabel htmlFor="buy_amount">{t("form.amount")}</FieldLabel>
                <div className="relative">
                  <Input
                    id="buy_amount"
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="100"
                    className="pe-12"
                    {...register("buy_amount")}
                  />
                  <MoneySuffix />
                </div>
                <FieldError errors={[errors.buy_amount]} />
              </Field>
            )}

            <Field>
              <FieldLabel>{t("bogoForm.eligibleItems")}</FieldLabel>
              {scopeMode === "shared" ? (
                <Controller
                  control={control}
                  name="applies_to"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? "all"}
                      onValueChange={(next) => {
                        field.onChange(next)
                        if (next !== "products") {
                          setValue("product_ids", [], {
                            shouldValidate: true,
                            shouldDirty: true,
                          })
                        }
                        if (next !== "collections") {
                          setValue("collection_ids", [], {
                            shouldValidate: true,
                            shouldDirty: true,
                          })
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("form.allProducts")}
                        </SelectItem>
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
              ) : (
                <Controller
                  control={control}
                  name="buy_applies_to"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? "all"}
                      onValueChange={(next) => {
                        field.onChange(next)
                        if (next !== "products") {
                          setValue("buy_product_ids", [], {
                            shouldValidate: true,
                            shouldDirty: true,
                          })
                        }
                        if (next !== "collections") {
                          setValue("buy_collection_ids", [], {
                            shouldValidate: true,
                            shouldDirty: true,
                          })
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("form.allProducts")}
                        </SelectItem>
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
              )}
            </Field>
          </div>

          {scopeMode === "shared" ? (
            <>
              {appliesTo === "products" && (
                <ScopePreview
                  icon={PackageIcon}
                  count={productIds.length}
                  kind="products"
                  onBrowse={() => setPickerOpen(true)}
                  previewNames={pickPreviewNames(
                    productIds,
                    initialSnapshots?.products,
                  )}
                  onClear={() =>
                    setValue("product_ids", [], {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
              )}
              {appliesTo === "collections" && (
                <ScopePreview
                  icon={LayersIcon}
                  count={collectionIds.length}
                  kind="collections"
                  onBrowse={() => setCollectionPickerOpen(true)}
                  previewNames={pickPreviewNames(
                    collectionIds,
                    initialSnapshots?.collections,
                  )}
                  onClear={() =>
                    setValue("collection_ids", [], {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
              )}
              {appliesTo === "all" && (
                <p className="text-xs text-muted-foreground">
                  {t("bogoForm.anyProductQualifies")}
                </p>
              )}
            </>
          ) : (
            <>
              {buyAppliesTo === "products" && (
                <ScopePreview
                  icon={PackageIcon}
                  count={buyProductIds.length}
                  kind="products"
                  onBrowse={() => setBuyPickerOpen(true)}
                  previewNames={pickPreviewNames(
                    buyProductIds,
                    initialSnapshots?.products,
                  )}
                  onClear={() =>
                    setValue("buy_product_ids", [], {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
              )}
              {buyAppliesTo === "collections" && (
                <ScopePreview
                  icon={LayersIcon}
                  count={buyCategoryIds.length}
                  kind="collections"
                  onBrowse={() => setBuyCollectionPickerOpen(true)}
                  previewNames={pickPreviewNames(
                    buyCategoryIds,
                    initialSnapshots?.collections,
                  )}
                  onClear={() =>
                    setValue("buy_collection_ids", [], {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
              )}
              {buyAppliesTo === "all" && (
                <p className="text-xs text-muted-foreground">
                  {t("bogoForm.anyProductTriggers")}
                </p>
              )}
              <FieldError
                errors={[errors.buy_product_ids, errors.buy_collection_ids]}
              />
            </>
          )}
        </SectionCard>

        {/* Flow connector between buys & gets */}
        <div className="relative flex justify-center py-1">
          <div
            className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border"
            aria-hidden
          />
          <div className="relative flex size-8 items-center justify-center rounded-full border bg-background text-muted-foreground">
            <ArrowRightIcon className="size-4 rotate-90" />
          </div>
        </div>

        <SectionCard
          icon={GiftIcon}
          tone="emerald"
          title={t("bogoForm.customerGets")}
          subtitle={t("bogoForm.customerGetsHint")}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="get_quantity">
                {t("bogoForm.quantity")}
              </FieldLabel>
              <Input
                id="get_quantity"
                type="number"
                min={1}
                placeholder="1"
                {...register("get_quantity")}
              />
              <FieldError errors={[errors.get_quantity]} />
            </Field>
            <Field>
              <FieldLabel>{t("bogoForm.eligibleItems")}</FieldLabel>
              {scopeMode === "shared" ? (
                <>
                  <div className="flex h-9 items-center gap-2 rounded-md border bg-muted/30 px-3">
                    <EligibleMirrorIcon appliesTo={appliesTo} />
                    <span className="truncate text-sm text-muted-foreground">
                      {bogoGetsMirror(
                        appliesTo,
                        productIds.length,
                        collectionIds.length,
                        t,
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("bogoForm.sameScopeAsBuys")}
                  </p>
                </>
              ) : (
                <Controller
                  control={control}
                  name="get_applies_to"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? "all"}
                      onValueChange={(next) => {
                        field.onChange(next)
                        if (next !== "products") {
                          setValue("get_product_ids", [], {
                            shouldValidate: true,
                            shouldDirty: true,
                          })
                        }
                        if (next !== "collections") {
                          setValue("get_collection_ids", [], {
                            shouldValidate: true,
                            shouldDirty: true,
                          })
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {t("form.allProducts")}
                        </SelectItem>
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
              )}
            </Field>
          </div>

          {scopeMode === "separate" && (
            <>
              {getAppliesTo === "products" && (
                <ScopePreview
                  icon={PackageIcon}
                  count={getProductIds.length}
                  kind="products"
                  onBrowse={() => setGetPickerOpen(true)}
                  previewNames={pickPreviewNames(
                    getProductIds,
                    initialSnapshots?.products,
                  )}
                  onClear={() =>
                    setValue("get_product_ids", [], {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
              )}
              {getAppliesTo === "collections" && (
                <ScopePreview
                  icon={LayersIcon}
                  count={getCategoryIds.length}
                  kind="collections"
                  onBrowse={() => setGetCollectionPickerOpen(true)}
                  previewNames={pickPreviewNames(
                    getCategoryIds,
                    initialSnapshots?.collections,
                  )}
                  onClear={() =>
                    setValue("get_collection_ids", [], {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                />
              )}
              {getAppliesTo === "all" && (
                <p className="text-xs text-muted-foreground">
                  {t("bogoForm.anyProductReward")}
                </p>
              )}
              <FieldError
                errors={[errors.get_product_ids, errors.get_collection_ids]}
              />
            </>
          )}

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">
              {t("bogoForm.discountedValue")}
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <ChoiceCard
                active={discountMode === "percent"}
                onClick={() =>
                  setValue("get_discount_mode", "percent", {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                icon={PercentIcon}
                title={t("form.percentage")}
                description={t("bogoForm.percentageHint")}
              />
              <ChoiceCard
                active={discountMode === "amount"}
                onClick={() =>
                  setValue("get_discount_mode", "amount", {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                icon={WalletIcon}
                title={t("bogoForm.amountOff")}
                description={t("bogoForm.amountOffHint")}
              />
              <ChoiceCard
                active={discountMode === "free"}
                onClick={() =>
                  setValue("get_discount_mode", "free", {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                icon={SparklesIcon}
                title={t("bogoForm.free")}
                description={t("bogoForm.freeHint")}
              />
            </div>

            {discountMode === "percent" && (
              <Field className="max-w-xs">
                <FieldLabel htmlFor="get_discount_percent">
                  {t("bogoForm.percentOff")}
                </FieldLabel>
                <div className="relative">
                  <Input
                    id="get_discount_percent"
                    type="number"
                    min={0}
                    max={100}
                    step="1"
                    className="pr-8"
                    placeholder="100"
                    {...register("get_discount_percent")}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    %
                  </span>
                </div>
                <FieldError errors={[errors.get_discount_percent]} />
              </Field>
            )}
            {discountMode === "amount" && (
              <Field className="max-w-xs">
                <FieldLabel htmlFor="get_discount_amount">
                  {t("bogoForm.amountOffEach")}
                </FieldLabel>
                <div className="relative">
                  <Input
                    id="get_discount_amount"
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="5.00"
                    className="pe-12"
                    {...register("get_discount_amount")}
                  />
                  <MoneySuffix />
                </div>
                <FieldError errors={[errors.get_discount_amount]} />
              </Field>
            )}
          </div>

          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-start gap-2">
              <Controller
                control={control}
                name="max_uses_per_order_enabled"
                render={({ field }) => (
                  <Checkbox
                    id="max_uses_per_order_enabled"
                    checked={!!field.value}
                    onCheckedChange={(v) => field.onChange(!!v)}
                    className="mt-0.5"
                  />
                )}
              />
              <div className="flex flex-1 flex-col gap-1">
                <Label
                  htmlFor="max_uses_per_order_enabled"
                  className="text-sm font-medium leading-snug"
                >
                  {t("bogoForm.maxUsesPerOrder")}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t("bogoForm.maxUsesPerOrderHint")}
                </p>
              </div>
            </div>
            {perOrderEnabled && (
              <div className="mt-3 ml-6 max-w-40">
                <Input
                  type="number"
                  min={1}
                  placeholder="3"
                  {...register("max_uses_per_order")}
                />
                <FieldError errors={[errors.max_uses_per_order]} />
              </div>
            )}
          </div>

          <DealPreview
            buyQty={buyQty}
            getQty={getQty}
            discountMode={discountMode}
            percent={pctValue}
            amount={amountValue}
          />
        </SectionCard>

        <CouponBaseFields
          form={sharedForm}
          snapshots={initialSnapshots}
          hide={{ minimumPurchase: true }}
        />
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
        open={collectionPickerOpen}
        onOpenChange={setCollectionPickerOpen}
        value={collectionIds}
        onConfirm={(ids) =>
          setValue("collection_ids", ids, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      />

      <ProductPickerDialog
        open={buyPickerOpen}
        onOpenChange={setBuyPickerOpen}
        value={buyProductIds}
        onConfirm={(ids) =>
          setValue("buy_product_ids", ids, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      />

      <CategoryPickerDialog
        open={buyCollectionPickerOpen}
        onOpenChange={setBuyCollectionPickerOpen}
        value={buyCategoryIds}
        onConfirm={(ids) =>
          setValue("buy_collection_ids", ids, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      />

      <ProductPickerDialog
        open={getPickerOpen}
        onOpenChange={setGetPickerOpen}
        value={getProductIds}
        onConfirm={(ids) =>
          setValue("get_product_ids", ids, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      />

      <CategoryPickerDialog
        open={getCollectionPickerOpen}
        onOpenChange={setGetCollectionPickerOpen}
        value={getCategoryIds}
        onConfirm={(ids) =>
          setValue("get_collection_ids", ids, {
            shouldValidate: true,
            shouldDirty: true,
          })
        }
      />
    </>
  )
}

function EligibleMirrorIcon({ appliesTo }: { appliesTo: string }) {
  if (appliesTo === "products") {
    return <PackageIcon className="size-4 shrink-0 text-muted-foreground" />
  }
  if (appliesTo === "collections") {
    return <LayersIcon className="size-4 shrink-0 text-muted-foreground" />
  }
  return <TagIcon className="size-4 shrink-0 text-muted-foreground" />
}

function DealPreview({
  buyQty,
  getQty,
  discountMode,
  percent,
  amount,
}: {
  buyQty: number
  getQty: number
  discountMode: string
  percent: number
  amount: number
}) {
  const t = useTranslations("coupons.bogoForm")
  const ready = buyQty > 0 && getQty > 0
  if (!ready) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        {t("previewEmpty")}
      </div>
    )
  }

  const rewardLabel =
    discountMode === "free"
      ? t("previewFree")
      : discountMode === "amount"
        ? t("previewAmountOff", { amount: amount || 0 })
        : t("previewPercentOff", { percent: percent || 0 })

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-linear-to-r from-primary/5 via-background to-emerald-500/5 px-4 py-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t("previewTitle")}
      </span>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 font-medium">
          <ShoppingBagIcon className="size-3.5" />{" "}
          {t("previewBuy", { count: buyQty })}
        </span>
        <ArrowRightIcon className="size-4 text-muted-foreground" />
        <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 font-medium">
          <GiftIcon className="size-3.5" /> {t("previewGet", { count: getQty })}
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
            discountMode === "free"
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
              : "bg-primary/15 text-primary",
          )}
        >
          {rewardLabel}
        </span>
      </div>
    </div>
  )
}

/** The gets side's read-only echo of the shared scope. `t` is the `coupons` translator. */
function bogoGetsMirror(
  appliesTo: string,
  productCount: number,
  collectionCount: number,
  t: Translate,
): string {
  if (appliesTo === "products") {
    if (productCount > 0) {
      return t("bogoForm.mirrorProducts", { count: productCount })
    }
    return t("scopePreview.productsNone")
  }
  if (appliesTo === "collections") {
    if (collectionCount > 0) {
      return t("bogoForm.mirrorCollections", { count: collectionCount })
    }
    return t("scopePreview.collectionsNone")
  }
  return t("form.allProducts")
}
