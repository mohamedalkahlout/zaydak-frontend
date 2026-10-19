"use client"

import { useEffect, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Input } from "@repo/ui/components/input"
import { Textarea } from "@repo/ui/components/textarea"
import { Label } from "@repo/ui/components/label"
import { CREATE_TAG, UPDATE_TAG } from "@/features/tags/api"
import { GET_TAGS } from "@/features/tags/api"
import type { TranslatedText } from "@/shared/types/api"
import type { CreateTagResponse, Tag, UpdateTagResponse } from "@/features/tags/types"
import { tagFormSchema, type TagFormInput } from "@/features/tags/validations/tag"
import { translatable } from "@/shared/lib/format"

interface TagFormDialogProps {
  tag?: Tag
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TagFormDialog({
  tag,
  open,
  onOpenChange,
}: TagFormDialogProps) {
  const t = useTranslations("tags.form")
  const tValidation = useTranslations("tags.validation")
  const tCommon = useTranslations("common")
  const isEdit = Boolean(tag)

  const defaultValues = useMemo<TagFormInput>(() => {
    const name = tag?.name
    const details = tag?.details
    const nameObj: TranslatedText =
      name && typeof name === "object" ? name : {}
    const detailsObj: TranslatedText =
      details && typeof details === "object" ? details : {}
    return {
      name_en: typeof name === "string" ? name : (nameObj.en ?? ""),
      name_ar: nameObj.ar ?? "",
      slug: tag?.slug ?? "",
      icon: tag?.icon ?? "",
      details_en:
        typeof details === "string" ? details : (detailsObj.en ?? ""),
      details_ar: detailsObj.ar ?? "",
    }
  }, [tag])

  const schema = useMemo(() => tagFormSchema(tValidation), [tValidation])
  const form = useForm<TagFormInput>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  useEffect(() => {
    if (open) form.reset(defaultValues)
  }, [open, defaultValues, form])

  const refetchList = {
    refetchQueries: [{ query: GET_TAGS, variables: { page: 1, limit: 100 } }],
    awaitRefetchQueries: true,
  }

  const [createTag, createState] = useMutation<CreateTagResponse>(
    CREATE_TAG,
    refetchList,
  )
  const [updateTag, updateState] = useMutation<UpdateTagResponse>(
    UPDATE_TAG,
    refetchList,
  )
  const loading = createState.loading || updateState.loading

  const close = () => onOpenChange(false)

  const onSubmit = async (values: TagFormInput) => {
    const nameJson = { en: values.name_en, ar: values.name_ar }
    const hasDetails = Boolean(values.details_en || values.details_ar)
    const detailsJson = hasDetails
      ? { en: values.details_en, ar: values.details_ar }
      : null

    try {
      if (isEdit && tag) {
        const res = await updateTag({
          variables: {
            input: {
              id: tag.id,
              name: nameJson,
              slug: values.slug || undefined,
              icon: values.icon || undefined,
              details: detailsJson,
            },
          },
        })
        if (res.data?.updateTag?.success) {
          sileo.success({
            title: t("updated"),
            description: translatable(res.data.updateTag.data.name),
          })
          close()
        } else {
          sileo.error({ title: t("updateFailed") })
        }
        return
      }

      const res = await createTag({
        variables: {
          input: {
            name: nameJson,
            slug: values.slug || undefined,
            icon: values.icon || undefined,
            details: hasDetails ? detailsJson : undefined,
          },
        },
      })
      if (res.data?.createTag?.success) {
        sileo.success({
          title: t("created"),
          description: translatable(res.data.createTag.data.name),
        })
        form.reset()
        close()
      } else {
        sileo.error({ title: t("createFailed") })
      }
    } catch (err) {
      sileo.error({
        title: isEdit ? t("updateFailed") : t("createFailed"),
        description: err instanceof Error ? err.message : t("tryAgain"),
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("editTitle") : t("createTitle")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form
          id="tag-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
        >
          {/* The placeholders are sample values in each field's own language
              (an English name, an Arabic name, a Latin slug, an icon id), so
              they read the same in either locale. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FieldRow
              label={t("nameEn")}
              error={form.formState.errors.name_en?.message}
            >
              <Input
                {...form.register("name_en")}
                placeholder="Summer"
                aria-invalid={!!form.formState.errors.name_en}
              />
            </FieldRow>
            <FieldRow
              label={t("nameAr")}
              error={form.formState.errors.name_ar?.message}
            >
              <Input
                {...form.register("name_ar")}
                placeholder="صيف"
                dir="rtl"
                aria-invalid={!!form.formState.errors.name_ar}
              />
            </FieldRow>
          </div>

          <FieldRow
            label={t("slug")}
            hint={isEdit ? t("slugHintEdit") : t("slugHintNew")}
            error={form.formState.errors.slug?.message}
          >
            <Input
              {...form.register("slug")}
              placeholder="summer"
              aria-invalid={!!form.formState.errors.slug}
            />
          </FieldRow>

          <FieldRow label={t("icon")}>
            <Input {...form.register("icon")} placeholder="sun" />
          </FieldRow>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FieldRow label={t("detailsEn")}>
              <Textarea {...form.register("details_en")} rows={3} />
            </FieldRow>
            <FieldRow label={t("detailsAr")}>
              <Textarea
                {...form.register("details_ar")}
                rows={3}
                dir="rtl"
              />
            </FieldRow>
          </div>
        </form>

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="outline" size="sm" disabled={loading}>
                {tCommon("cancel")}
              </Button>
            }
          />
          <Button type="submit" form="tag-form" size="sm" disabled={loading}>
            {loading
              ? isEdit
                ? t("saving")
                : t("creating")
              : isEdit
                ? t("save")
                : t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FieldRow({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
