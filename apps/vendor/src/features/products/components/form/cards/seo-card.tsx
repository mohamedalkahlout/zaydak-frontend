"use client"

import { useWatch } from "react-hook-form"
import { useTranslations } from "next-intl"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card"
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field"
import { Input } from "@repo/ui/components/input"
import type { ProductFormApi } from "@/features/products/validations/product"
import { TranslatableField } from "../ui/lang-tabs"
import { TranslatableInput } from "../ui/translatable-input"

/**
 * Shopify "Search engine listing" card. Slug + the SEO `<title>` and meta
 * description overrides. Both overrides are multilang `{ en, ar }`; when
 * blank the storefront falls back to the product's `name` /truncated
 * `description` (server-side fallback — we don't pre-compute here).
 */
export function SeoCard({ form }: { form: ProductFormApi }) {
  const t = useTranslations("products.seoCard")
  const {
    register,
    control,
    formState: { errors },
  } = form
  const slug = useWatch({ control, name: "slug" })
  const seoTitle = useWatch({ control, name: "seo_title" })
  const seoDescription = useWatch({ control, name: "seo_description" })
  const titlePreview =
    seoTitle?.en?.trim() ||
    seoTitle?.ar?.trim() ||
    t("previewTitle")
  const descriptionPreview =
    seoDescription?.en?.trim() ||
    seoDescription?.ar?.trim() ||
    t("previewDescription")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Live Google-style preview, mirrors Shopify exactly. */}
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="truncate text-xs text-muted-foreground">
            example.com/products/{slug || "your-product"}
          </p>
          <p className="mt-1 truncate text-sm font-medium text-blue-700 dark:text-blue-400">
            {titlePreview}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {descriptionPreview}
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor="slug">{t("urlHandle")}</FieldLabel>
          <div className="flex items-center rounded-md border border-input bg-transparent pl-3 text-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
            <span className="text-muted-foreground">products/</span>
            <Input
              id="slug"
              className="border-0 shadow-none focus-visible:ring-0"
              placeholder={t("handlePlaceholder")}
              {...register("slug")}
            />
          </div>
          <FieldError errors={[errors.slug]} />
        </Field>

        <TranslatableField>
          <FieldLabel>{t("pageTitle")}</FieldLabel>
          <TranslatableInput
            form={form}
            name="seo_title"
            // The tag goes in as a value: `<title>` written into the message
            // would be read by ICU as a rich-text tag with no handler.
            placeholder={t("pageTitlePlaceholder", { tag: "<title>" })}
          />
          <p className="text-xs text-muted-foreground">{t("pageTitleHint")}</p>
        </TranslatableField>

        <TranslatableField>
          <FieldLabel>{t("metaDescription")}</FieldLabel>
          <TranslatableInput
            form={form}
            name="seo_description"
            placeholder={t("metaDescriptionPlaceholder")}
            multiline
          />
          <p className="text-xs text-muted-foreground">
            {t("metaDescriptionHint")}
          </p>
        </TranslatableField>
      </CardContent>
    </Card>
  )
}
