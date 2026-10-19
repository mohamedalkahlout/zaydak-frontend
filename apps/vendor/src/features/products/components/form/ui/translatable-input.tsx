"use client"

import dynamic from "next/dynamic"
import { Controller } from "react-hook-form"
import type { FieldPath } from "react-hook-form"
import { Input } from "@repo/ui/components/input"
import { Textarea } from "@repo/ui/components/textarea"
import type { ProductFormApi, ProductFormInput } from "@/features/products/validations/product"
import { useFormLocale } from "./lang-tabs"

// The rich-text editor drags in TipTap + ~25 extensions. It only renders for the
// few `richText` fields, so load it on demand instead of shipping it in the
// product-form route bundle. `ssr: false` because TipTap needs the DOM.
const SimpleEditor = dynamic(
  () =>
    import("@/shared/components/tiptap-templates/simple/simple-editor").then(
      (m) => m.SimpleEditor,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden
        className="min-h-48 animate-pulse rounded-md border border-input bg-muted/30"
      />
    ),
  },
)

type TranslatableFieldName =
  | "name"
  | "description"
  | "seo_title"
  | "seo_description"

interface TranslatableInputProps {
  form: ProductFormApi
  name: TranslatableFieldName
  placeholder?: string
  multiline?: boolean
  richText?: boolean
}

/**
 * Editor for `{ en, ar }` JSON fields. Reads the active locale from the
 * shared `LocaleProvider` at the top of the form, so a single tab bar
 * switches every translatable input at once. Only one control is mounted
 * at a time so focus/selection don't jump.
 */
export function TranslatableInput({
  form,
  name,
  placeholder,
  multiline,
  richText,
}: TranslatableInputProps) {
  const locale = useFormLocale()
  const path = `${name}.${locale}` as FieldPath<ProductFormInput>
  const dir = locale === "ar" ? "rtl" : "ltr"
  return (
    <Controller
      control={form.control}
      name={path}
      render={({ field }) => {
        if (richText) {
          return (
            <SimpleEditor
              key={locale}
              value={(field.value as string | undefined) ?? ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder={placeholder}
              dir={dir}
              enableAiMenu={name === "description"}
            />
          )
        }
        return multiline ? (
          <Textarea
            key={locale}
            dir={dir}
            placeholder={placeholder}
            rows={4}
            {...field}
            value={(field.value as string | undefined) ?? ""}
          />
        ) : (
          <Input
            key={locale}
            dir={dir}
            placeholder={placeholder}
            {...field}
            value={(field.value as string | undefined) ?? ""}
          />
        )
      }}
    />
  )
}
