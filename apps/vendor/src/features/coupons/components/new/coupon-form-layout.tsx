"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect } from "react"
import { useTranslations } from "next-intl"
import { ArrowLeftIcon } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useFormState } from "react-hook-form"
import type { SubmitErrorHandler, SubmitHandler } from "react-hook-form"
import { Button } from "@repo/ui/components/button"
import type {
  AnyCouponInput,
  AnyCouponOutput,
  CouponFormApi,
} from "@/features/coupons/validations/coupon"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import { CouponSummaryCard } from "./coupon-summary-card"

interface CouponFormLayoutProps {
  title: string
  subtitle?: string
  saving?: boolean
  /**
   * Top banner label — "Unsaved discount" in Shopify's UI. Already
   * localized; defaults to `coupons.form.unsavedDiscount`.
   */
  unsavedLabel?: string

  /** Form used for the summary panel and submission. */
  form: CouponFormApi
  onValid: SubmitHandler<AnyCouponOutput>
  onInvalid?: SubmitErrorHandler<AnyCouponInput>

  typeLabel: string
  typeSubLabel: string
  TypeIcon: LucideIcon
  extraDetails?: string[]

  /** Optional slot rendered on the far right of the header row. */
  headerAction?: React.ReactNode

  children: React.ReactNode
}

/**
 * Shopify-style layout: sticky top strip (Discard / Save), a back-link
 * header, then a two-column grid (main content + summary sidebar).
 *
 * Owns the `<form>` element so type-specific form components only need to
 * render their cards inside `children`. Submission goes through
 * `form.handleSubmit(onValid, onInvalid)`.
 */
export function CouponFormLayout({
  title,
  subtitle,
  saving,
  unsavedLabel: unsavedLabelProp,
  form,
  onValid,
  onInvalid,
  typeLabel,
  typeSubLabel,
  TypeIcon,
  extraDetails,
  headerAction,
  children,
}: CouponFormLayoutProps) {
  const t = useTranslations("coupons.form")
  const tCommon = useTranslations("common")
  const unsavedLabel = unsavedLabelProp ?? t("unsavedDiscount")
  const params = useParams<{ shopSlug: string }>()
  const backHref = `/store/${params?.shopSlug ?? ""}/coupons`
  const submit = form.handleSubmit(onValid, onInvalid)
  const { isDirty } = useFormState({ control: form.control })
  const showUnsavedBar = useUnsavedBarStore((s) => s.show)
  const hideUnsavedBar = useUnsavedBarStore((s) => s.hide)

  useEffect(() => {
    if (!isDirty) {
      hideUnsavedBar()
      return
    }
    showUnsavedBar({
      label: unsavedLabel,
      saving: !!saving,
      discardHref: backHref,
      onSave: submit,
    })
  })

  useEffect(() => () => hideUnsavedBar(), [hideUnsavedBar])

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t("back")}
          nativeButton={false}
          render={<Link href={backHref} />}
        >
          <ArrowLeftIcon className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {headerAction && <div className="ml-auto">{headerAction}</div>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">{children}</div>
        <aside className="flex flex-col gap-4">
          <CouponSummaryCard
            form={form}
            typeLabel={typeLabel}
            typeSubLabel={typeSubLabel}
            TypeIcon={TypeIcon}
            extraDetails={extraDetails}
          />
        </aside>
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? t("saving") : tCommon("save")}
        </Button>
      </div>
    </form>
  )
}
