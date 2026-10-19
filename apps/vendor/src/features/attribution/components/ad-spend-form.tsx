"use client"

import { useEffect } from "react"
import { Controller, useForm, useFormState } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeftIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { centsToMajor } from "@/shared/lib/format"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import type { AdSpend } from "../types"
import { CHANNEL_OPTIONS } from "../lib/attribution"
import { adSpendFormSchema, type AdSpendFormInput } from "../validations"
import { useAdSpendSubmit } from "./use-ad-spend-submit"

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function defaultsFor(
  spend: AdSpend | undefined,
  defaultCurrency: string,
): AdSpendFormInput {
  if (!spend) {
    return {
      channel: "PAID_SEARCH",
      source: "",
      campaign: "",
      date: today(),
      spend: "",
      currency: defaultCurrency,
      rate: "1",
    }
  }
  return {
    channel: spend.channel,
    source: spend.source,
    campaign: spend.campaign ?? "",
    date: spend.date.slice(0, 10),
    spend: String(centsToMajor(spend.spend_cents)),
    currency: spend.currency,
    rate: String(spend.exchange_rate_bps / 10000),
  }
}

export function AdSpendForm({
  spend,
  defaultCurrency = "SAR",
  onDone,
  onCancel,
}: {
  spend?: AdSpend
  defaultCurrency?: string
  onDone: () => void
  onCancel: () => void
}) {
  const t = useTranslations("adSpend")
  const tv = useTranslations("adSpend.validation")

  const form = useForm<AdSpendFormInput>({
    resolver: zodResolver(adSpendFormSchema(tv)),
    defaultValues: defaultsFor(spend, defaultCurrency),
  })

  const { submit, loading } = useAdSpendSubmit(form, spend, onDone)
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
      label: spend ? t("unsavedEdit") : t("unsavedNew"),
      saving: loading,
      onSave: handleSubmit,
      onDiscard: () => form.reset(),
    })
  })
  useEffect(() => () => hideBar(), [hideBar])

  const errors = form.formState.errors

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
          {spend ? t("editTitle") : t("newTitle")}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Card className="gap-3">
          <CardHeader>
            <CardTitle>{t("form.section")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label>{t("form.channel")}</Label>
                <Controller
                  control={form.control}
                  name="channel"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHANNEL_OPTIONS.map((c) => (
                          <SelectItem key={c} value={c}>
                            {t(`channels.${c}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ad-date">{t("form.date")}</Label>
                <Input id="ad-date" type="date" {...form.register("date")} />
                {errors.date ? (
                  <p className="text-xs text-destructive">{errors.date.message}</p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ad-source">{t("form.source")}</Label>
                <Input
                  id="ad-source"
                  placeholder={t("form.sourcePlaceholder")}
                  {...form.register("source")}
                />
                {errors.source ? (
                  <p className="text-xs text-destructive">
                    {errors.source.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ad-campaign">{t("form.campaign")}</Label>
                <Input
                  id="ad-campaign"
                  placeholder={t("form.campaignPlaceholder")}
                  {...form.register("campaign")}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ad-spend">{t("form.spend")}</Label>
                <Input
                  id="ad-spend"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="0"
                  {...form.register("spend")}
                />
                {errors.spend ? (
                  <p className="text-xs text-destructive">
                    {errors.spend.message}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ad-currency">{t("form.currency")}</Label>
                <Input id="ad-currency" {...form.register("currency")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ad-rate">{t("form.rate")}</Label>
                <Input
                  id="ad-rate"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  {...form.register("rate")}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t("form.rateHint")}</p>
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
