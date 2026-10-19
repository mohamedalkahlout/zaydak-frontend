"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Controller, useWatch } from "react-hook-form"
import { PencilIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import { Textarea } from "@repo/ui/components/textarea"
import { slugify } from "@/features/collections/lib/rules"
import { useFormLocale } from "@/features/products/components/form/ui/lang-tabs"
import type { CollectionFormApi } from "@/features/collections/validations/shop-collection"
import { AiFilledMark } from "@/features/ai/components/ai-filled-mark"

const STOREFRONT_URL =
  process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3003"

type Translatable = { en?: string; ar?: string } | undefined

/**
 * Shopify's "Search engine listing": the result as a search engine would
 * render it, with the overrides folded away behind Edit. The preview falls
 * back to the title and description, which is exactly what the storefront
 * does when the SEO fields are empty.
 *
 * Both the overrides and the preview follow the form's EN/AR pill: the
 * inputs edit the active locale, and the preview reads it first with the
 * other locale as the fallback — the order the storefront's own metadata
 * uses — so switching to AR shows the listing an Arabic visitor would get.
 */
export function SeoCard({ form }: { form: CollectionFormApi }) {
  const t = useTranslations("collections")
  const params = useParams<{ shopSlug: string }>()
  const [editing, setEditing] = useState(false)
  const locale = useFormLocale()
  const other = locale === "ar" ? "en" : "ar"
  const dir = locale === "ar" ? "rtl" : "ltr"

  const name = useWatch({ control: form.control, name: "name" })
  const description = useWatch({ control: form.control, name: "description" })
  const seoTitle = useWatch({ control: form.control, name: "seo_title" })
  const seoDescription = useWatch({
    control: form.control,
    name: "seo_description",
  })
  const slug = useWatch({ control: form.control, name: "slug" })

  const inLocale = (value: Translatable) =>
    value?.[locale]?.trim() || value?.[other]?.trim()

  const title = inLocale(seoTitle) || inLocale(name)
  const body = inLocale(seoDescription) || inLocale(description)
  // Empty is legitimate: the API transliterates the title into a handle when
  // one is not sent, which is the only way an Arabic-only title gets a URL.
  // Derived from the English title whichever locale is being edited — the
  // handle is one URL, not one per language.
  const handle = slug?.trim() || slugify(name?.en ?? "")
  // A full URL on the storefront origin, the way a search engine would show
  // it — the same origin the header's View and Copy link build from.
  const url = `${STOREFRONT_URL}/${params?.shopSlug ?? ""}/collections/${handle}`

  return (
    <div className="rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-medium">{t("seo.title")}</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground"
          aria-label={editing ? t("seo.done") : t("seo.edit")}
          onClick={() => setEditing((value) => !value)}
        >
          <PencilIcon className="size-3.5" />
        </Button>
      </div>

      {editing ? (
        <div className="mt-3 flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor="seo_title">
              {t("seo.pageTitle")}
              <AiFilledMark name="seo_title" />
            </FieldLabel>
            <Controller
              control={form.control}
              name={`seo_title.${locale}` as const}
              render={({ field }) => (
                <Input
                  key={locale}
                  id="seo_title"
                  dir={dir}
                  {...field}
                  value={field.value ?? ""}
                />
              )}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="seo_description">
              {t("seo.description")}
              <AiFilledMark name="seo_description" />
            </FieldLabel>
            <Controller
              control={form.control}
              name={`seo_description.${locale}` as const}
              render={({ field }) => (
                <Textarea
                  key={locale}
                  id="seo_description"
                  dir={dir}
                  rows={3}
                  {...field}
                  value={field.value ?? ""}
                />
              )}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="slug">
              {t("seo.handle")}
              <AiFilledMark name="slug" />
            </FieldLabel>
            <div className="flex items-center rounded-md border border-input bg-transparent ps-3 text-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
              <span className="text-muted-foreground">collections/</span>
              <Input
                id="slug"
                className="border-0 shadow-none focus-visible:ring-0"
                placeholder={slugify(name?.en ?? "") || "summer-sale"}
                {...form.register("slug")}
                onInput={(event) => {
                  // Nudge toward the allowed charset while typing, so the
                  // validator does not scold over a space.
                  const element = event.currentTarget
                  element.value = element.value
                    .toLowerCase()
                    .replace(/\s+/g, "-")
                }}
              />
            </div>
            <FieldError errors={[form.formState.errors.slug]} />
            <p className="text-xs text-muted-foreground">
              {t("seo.handleHint")}
            </p>
          </Field>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-0.5">
          <p className="truncate text-sm text-[#1a0dab] dark:text-[#8ab4f8]">
            {title || t("details.addTitle")}
          </p>
          <p dir="ltr" className="truncate text-xs text-muted-foreground">
            {url}
          </p>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {body || t("seo.fallbackHint")}
          </p>
        </div>
      )}
    </div>
  )
}
