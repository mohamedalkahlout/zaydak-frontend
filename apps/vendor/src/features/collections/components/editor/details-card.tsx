"use client"

import { useState } from "react"
import Image from "@/shared/components/app-image"
import { useTranslations } from "next-intl"
import { Controller, useWatch } from "react-hook-form"
import { ImageUpIcon, XIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Textarea } from "@repo/ui/components/textarea"
import { MediaLibraryPicker } from "@/features/files/components/media-library-picker"
import { useFormLocale } from "@/features/products/components/form/ui/lang-tabs"
import type { CollectionFormApi } from "@/features/collections/validations/shop-collection"
import { cn } from "@/shared/lib/utils"
import { AiFilledMark } from "@/features/ai/components/ai-filled-mark"

/**
 * Title, description and cover, laid out the way the storefront card reads
 * them. The inputs are borderless on purpose: this block is the collection as
 * a customer meets it, not a form about it.
 *
 * The title and description edit one locale at a time, the one the form's
 * EN/AR pill is on, rather than stacking an Arabic pair under the English —
 * the card is meant to look like the storefront card, and that card shows one
 * language. Each control is keyed on the locale so switching remounts it:
 * a reused `<input>` would keep its caret and selection from the other
 * language's text, and its `dir` would flip under a value it was not typed in.
 *
 * Publishing is deliberately not here — it is a state of the page, not a
 * field of the collection, so it lives in the page header's actions (and in
 * the list table's row actions). All that survives is the one-line hint,
 * which is the only part a vendor reads while writing the copy.
 */
export function DetailsCard({ form }: { form: CollectionFormApi }) {
  const t = useTranslations("collections")
  const [libraryOpen, setLibraryOpen] = useState(false)
  const locale = useFormLocale()
  const dir = locale === "ar" ? "rtl" : "ltr"

  const imageUrl = useWatch({ control: form.control, name: "image_url" })
  const imageAlt = useWatch({ control: form.control, name: "image_alt" })
  const published = useWatch({ control: form.control, name: "is_published" })
  // The required rule sits on the `name` object (either locale satisfies it),
  // so the error is read there and shown under whichever locale is on screen.
  const titleError = form.formState.errors.name

  return (
    <div className="rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex shrink-0 flex-col gap-2">
          {imageUrl ? (
            <>
              <div className="group relative size-40 overflow-hidden rounded-lg border bg-muted">
                <Image
                  src={imageUrl}
                  alt={imageAlt || ""}
                  fill
                  sizes="160px"
                  className="object-cover"
                  unoptimized
                />
                <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 transition group-hover:opacity-100">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs"
                    onClick={() => setLibraryOpen(true)}
                  >
                    {t("details.changeImage")}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    className="size-7"
                    aria-label={t("details.removeImage")}
                    onClick={() => {
                      form.setValue("image_url", "", { shouldDirty: true })
                      form.setValue("image_alt", "", { shouldDirty: true })
                    }}
                  >
                    <XIcon className="size-3.5" />
                  </Button>
                </div>
              </div>
              {/* Only with a cover: `formToInput` drops the alt text when there
                  is no URL to attach it to, so an input here without an image
                  would stage a value that never reaches the API. */}
              <Input
                {...form.register("image_alt")}
                placeholder={t("details.imageAlt")}
                aria-label={t("details.imageAlt")}
                className="h-8 w-40 text-xs md:text-xs"
              />
            </>
          ) : (
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              className="flex size-40 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-muted-foreground transition hover:border-foreground/30 hover:text-foreground"
            >
              <ImageUpIcon className="size-5" />
              <span className="text-xs">{t("details.addImage")}</span>
            </button>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-w-[10rem] flex-col gap-1">
            <AiFilledMark name="name" />
            <Controller
              control={form.control}
              name={`name.${locale}` as const}
              render={({ field }) => (
                <input
                  key={locale}
                  dir={dir}
                  {...field}
                  value={field.value ?? ""}
                  placeholder={t("details.addTitle")}
                  aria-invalid={!!titleError}
                  className={cn(
                    "w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/60",
                    titleError && "placeholder:text-destructive/70",
                  )}
                />
              )}
            />
            {titleError && (
              <p className="text-xs text-destructive">
                {t("validation.titleRequired")}
              </p>
            )}
          </div>

          <AiFilledMark name="description" />
          <Controller
            control={form.control}
            name={`description.${locale}` as const}
            render={({ field }) => (
              <Textarea
                key={locale}
                dir={dir}
                {...field}
                value={field.value ?? ""}
                placeholder={t("details.addDescription")}
                rows={3}
                className="resize-none border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
              />
            )}
          />
          {!published && (
            <p className="text-xs text-muted-foreground">{t("channel.hint")}</p>
          )}
        </div>
      </div>

      <MediaLibraryPicker
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        onPick={(file) => {
          form.setValue("image_url", file.url, { shouldDirty: true })
          // The library's own alt text is a sane default, but never overwrites
          // the one already saved on this collection.
          if (file.alt && !imageAlt) {
            form.setValue("image_alt", file.alt, { shouldDirty: true })
          }
          setLibraryOpen(false)
        }}
      />
    </div>
  )
}
