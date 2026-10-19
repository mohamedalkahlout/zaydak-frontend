"use client"

import { useEffect } from "react"
import { useForm, useFormState } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeftIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import type { Target } from "../types"
import { fromWireValue } from "../lib/targets"
import { targetFormSchema, type TargetFormInput } from "../validations"
import { TargetFormFields } from "./target-form-fields"
import { useTargetSubmit } from "./use-target-submit"

export function defaultsFor(target: Target | undefined): TargetFormInput {
  if (!target) {
    return {
      name: "",
      metric: "TOTAL_SALES",
      period: "MONTH",
      value: "",
      start: "",
      end: "",
      activate: true,
    }
  }
  return {
    name: target.name,
    metric: target.metric,
    period: target.period,
    value: String(fromWireValue(target.targetValue, target.unit)),
    start: target.period === "CUSTOM" ? target.periodStart.slice(0, 10) : "",
    end: target.period === "CUSTOM" ? target.periodEnd.slice(0, 10) : "",
    activate: target.status !== "DRAFT",
  }
}

export function TargetForm({
  target,
  onDone,
  onCancel,
}: {
  target?: Target
  onDone: () => void
  onCancel: () => void
}) {
  const t = useTranslations("targets")
  const tv = useTranslations("targets.validation")

  const form = useForm<TargetFormInput>({
    resolver: zodResolver(targetFormSchema(tv)),
    defaultValues: defaultsFor(target),
  })

  const { submit, loading } = useTargetSubmit(form, target, onDone)
  const handleSubmit = form.handleSubmit(submit)

  const { isDirty } = useFormState({ control: form.control })
  const showBar = useUnsavedBarStore((s) => s.show)
  const hideBar = useUnsavedBarStore((s) => s.hide)

  useEffect(() => {
    if (!isDirty) {
      hideBar()
      return
    }
    showBar({
      label: target ? t("unsavedEdit") : t("unsavedNew"),
      saving: loading,
      onSave: handleSubmit,
      onDiscard: () => form.reset(),
    })
  })
  useEffect(() => () => hideBar(), [hideBar])

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t("back")}
          onClick={onCancel}
        >
          <ArrowLeftIcon className="size-4" />
        </Button>
        <h1 className="font-heading text-xl font-semibold">
          {target ? t("editTitle") : t("newTitle")}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Card className="gap-3">
          <CardHeader>
            <CardTitle>{t("form.section")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <TargetFormFields form={form} currency={target?.currency} />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? t("saving") : t("save")}
          </Button>
        </div>
      </form>
    </div>
  )
}
