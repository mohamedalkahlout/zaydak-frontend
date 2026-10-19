"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"
import { useTranslations } from "next-intl"
import { ArrowLeftIcon } from "lucide-react"
import { useFormState } from "react-hook-form"
import type { SubmitErrorHandler, SubmitHandler } from "react-hook-form"
import { Button } from "@repo/ui/components/button"
import type { ProductFormApi, ProductFormInput, ProductFormOutput } from "@/features/products/validations/product"
import { useLeaveGuard } from "@/shared/hooks/use-leave-guard"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import { LangTabsBar, LocaleProvider } from "./ui/lang-tabs"

interface ProductFormLayoutProps {
  title: string
  subtitle?: string
  saving?: boolean
  /** The save bar's own label. Localized by the caller — AGENTS.md keeps a
   *  feature's bar label in its own namespace (`products.unsaved*`) while the
   *  bar's Save/Discard/Saving stay global (`header.*`). */
  unsavedLabel?: string
  form: ProductFormApi
  onValid: SubmitHandler<ProductFormOutput>
  onInvalid?: SubmitErrorHandler<ProductFormInput>
  /** Right-sidebar slot (Status, Publishing, Organization cards). */
  sidebar: React.ReactNode
  /** Main column slot (Title, Pricing, Inventory, ...). */
  children: React.ReactNode
  headerAction?: React.ReactNode
  /**
   * Replaces the back-arrow + title row entirely. Edit mode passes
   * `ProductPageHeader`, which names the product rather than the screen and
   * carries its actions; create mode has no product to name and keeps the
   * default row.
   */
  header?: React.ReactNode
  /**
   * Treat the form as dirty while it is pristine. A form seeded from a
   * parked draft starts with `isDirty` false — the draft IS its defaults —
   * yet nothing about it has been saved, and hiding the bar would hide the
   * only Save.
   */
  forceDirty?: boolean
  /**
   * Runs when Discard is pressed, before the layout leaves for the list.
   * Create mode clears its parked draft here. Without it Discard is a plain
   * link, which is what edit mode wants — nothing there to clear first.
   */
  beforeDiscard?: () => void
}

/**
 * Shopify-style layout: back link + title, sticky unsaved bar wired up
 * via Zustand, two-column grid (main + sidebar), save button at the
 * bottom. The per-mode form (new/edit) only has to pass its cards in via
 * `children` + `sidebar`.
 */
export function ProductFormLayout({
  title,
  subtitle,
  saving,
  unsavedLabel,
  form,
  onValid,
  onInvalid,
  sidebar,
  children,
  headerAction,
  header,
  forceDirty = false,
  beforeDiscard,
}: ProductFormLayoutProps) {
  const t = useTranslations("products")
  const tHeader = useTranslations("header")
  const params = useParams<{ shopSlug: string }>()
  const router = useRouter()
  const backHref = `/store/${params?.shopSlug ?? ""}/products`
  const submit = form.handleSubmit(onValid, onInvalid)
  const { isDirty } = useFormState({ control: form.control })
  const showUnsavedBar = useUnsavedBarStore((s) => s.show)
  const hideUnsavedBar = useUnsavedBarStore((s) => s.hide)

  useEffect(() => {
    if (!isDirty && !forceDirty) {
      hideUnsavedBar()
      return
    }
    showUnsavedBar({
      label: unsavedLabel ?? t("unsavedProduct"),
      saving: !!saving,
      onSave: submit,
      // The bar navigates on `discardHref` and never calls `onDiscard` beside
      // it, so a discard with something to clear first gets the callback and
      // no href — the two are alternatives, not layers.
      ...(beforeDiscard
        ? {
            onDiscard: () => {
              beforeDiscard()
              router.push(backHref)
            },
          }
        : { discardHref: backHref }),
    })
  })

  useEffect(() => () => hideUnsavedBar(), [hideUnsavedBar])

  // Hold the vendor while the form holds a staged edit. The exits the guard
  // covers here are the ones that drop work silently: the back arrow and the
  // prev/next arrows (both `<Link>`s, caught by the hook's document listener)
  // and any rail / header link that would unmount the form. `onLeave` leaves
  // the screen clean before the navigation is re-issued — in create mode the
  // parked draft is cleared exactly as Discard clears it, so a confirmed exit
  // does not resurrect the work on the next "Add product".
  useLeaveGuard({
    when: isDirty || forceDirty,
    onLeave: () => {
      beforeDiscard?.()
      hideUnsavedBar()
    },
  })

  return (
    <LocaleProvider>
      <form onSubmit={submit} className="flex flex-col gap-6">
        {header ?? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={t("header.backToList")}
              nativeButton={false}
              render={<Link href={backHref} />}
            >
              <ArrowLeftIcon className="size-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {subtitle && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {subtitle}
                </p>
              )}
            </div>
            {headerAction && <div className="ml-auto">{headerAction}</div>}
          </div>
        )}

        <LangTabsBar />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-4">{children}</div>
          <aside className="flex flex-col gap-4">{sidebar}</aside>
        </div>

        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? tHeader("saving") : tHeader("save")}
          </Button>
        </div>
      </form>
    </LocaleProvider>
  )
}
