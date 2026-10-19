"use client"

import { useTranslations } from "next-intl"
import { Card, CardContent } from "@repo/ui/components/card"
import { Field, FieldError, FieldLabel } from "@repo/ui/components/field"
import { AiFilledMark } from "@/features/ai/components/ai-filled-mark"
import type { ProductFormApi } from "@/features/products/validations/product"
import type { InitialProductSnapshots } from "@/features/products/lib/form/from-product-entry"
import { MediaManager } from "../ui/media-manager"
import { TranslatableField } from "../ui/lang-tabs"
import { TranslatableInput } from "../ui/translatable-input"
import { SystemCategoryPicker } from "../pickers/system-category-picker"

/**
 * First card on the add-product page — Shopify-style single block with
 * Title, Description, Media, and Category. Media (primary image + gallery)
 * is handled entirely by `MediaManager`; the metafield-count badge on the
 * Category row is driven by the picker itself so this card stays
 * schema-agnostic.
 */
export function BasicsCard({
  form,
  snapshots,
  locale,
}: {
  form: ProductFormApi
  snapshots?: InitialProductSnapshots
  /** Passed straight to the category picker — `systemCategoriesFlat` takes a
      locale and defaults to English, so without it the Arabic dashboard picks
      a category out of an English taxonomy. */
  locale?: string
}) {
  const t = useTranslations("products.basicsCard")
  const {
    formState: { errors },
  } = form

  const nameError = errors.name as { message?: string } | undefined

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 pt-6">
        <TranslatableField>
          <FieldLabel>
            {t("title")}
            <AiFilledMark name="name" />
          </FieldLabel>
          <TranslatableInput
            form={form}
            name="name"
            placeholder={t("titlePlaceholder")}
          />
          {nameError?.message && (
            <FieldError errors={[{ message: nameError.message }]} />
          )}
        </TranslatableField>

        <TranslatableField>
          <FieldLabel>
            {t("description")}
            <AiFilledMark name="description" />
          </FieldLabel>
          <TranslatableInput
            form={form}
            name="description"
            placeholder={t("descriptionPlaceholder")}
            richText
          />
        </TranslatableField>

        <Field>
          <MediaManager form={form} />
        </Field>

        <SystemCategoryPicker
          form={form}
          snapshots={snapshots?.systemCategory}
          locale={locale}
        />
      </CardContent>
    </Card>
  )
}
