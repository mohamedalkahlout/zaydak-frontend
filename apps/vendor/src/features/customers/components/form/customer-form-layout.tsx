"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect } from "react"
import { useTranslations } from "next-intl"
import { ArrowLeftIcon } from "lucide-react"
import { useFormState, type UseFormReturn } from "react-hook-form"
import type { SubmitErrorHandler, SubmitHandler } from "react-hook-form"
import { Button } from "@repo/ui/components/button"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import type {
  CustomerFormInput,
  CustomerFormOutput,
} from "@/features/customers/validations/customer"

type CustomerFormApi = UseFormReturn<CustomerFormInput, unknown, CustomerFormOutput>

interface CustomerFormLayoutProps {
  title: string
  subtitle?: string
  saving?: boolean
  /** The unsaved bar's label; "Unsaved customer" when omitted. */
  unsavedLabel?: string
  form: CustomerFormApi
  onValid: SubmitHandler<CustomerFormOutput>
  onInvalid?: SubmitErrorHandler<CustomerFormInput>
  sidebar: React.ReactNode
  children: React.ReactNode
  headerAction?: React.ReactNode
  /** Override the default back URL (defaults to /store/[shopSlug]/customers). */
  backHref?: string
}

/**
 * Shopify-style two-column form scaffold for the customer create / edit
 * page. Wires the sticky unsaved-bar to the form's dirty state so save
 * is reachable from anywhere on the page without scrolling.
 */
export function CustomerFormLayout({
  title,
  subtitle,
  saving,
  unsavedLabel: unsavedLabelProp,
  form,
  onValid,
  onInvalid,
  sidebar,
  children,
  headerAction,
  backHref,
}: CustomerFormLayoutProps) {
  const t = useTranslations("customers.form")
  const tCommon = useTranslations("common")
  const unsavedLabel = unsavedLabelProp ?? t("unsavedNew")
  const params = useParams<{ shopSlug: string }>()
  const resolvedBackHref =
    backHref ?? `/store/${params?.shopSlug ?? ""}/customers`
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
      discardHref: resolvedBackHref,
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
          render={<Link href={resolvedBackHref} />}
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
        <aside className="flex flex-col gap-4">{sidebar}</aside>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? t("saving") : tCommon("save")}
        </Button>
      </div>
    </form>
  )
}

export type { CustomerFormApi }
