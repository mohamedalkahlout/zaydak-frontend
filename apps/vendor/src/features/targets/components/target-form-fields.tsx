"use client"

import {
  Controller,
  useFormState,
  useWatch,
  type UseFormReturn,
} from "react-hook-form"
import { useTranslations } from "next-intl"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import { Switch } from "@repo/ui/components/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { METRIC_OPTIONS, PERIOD_OPTIONS, metricUnit } from "../lib/targets"
import type { TargetFormInput } from "../validations"

/**
 * The goal-definition fields (name, metric, period, value, custom dates,
 * activate) for the full-page `TargetForm`. The analytics overview's
 * `TargetCreateDialog` is a separate Shopify-style two-column layout (metric
 * combobox + period picker + live preview) that shares only the zod schema and
 * `useTargetSubmit` pipeline, not this field UI.
 */
export function TargetFormFields({
  form,
  currency,
}: {
  form: UseFormReturn<TargetFormInput>
  currency?: string
}) {
  const t = useTranslations("targets")

  const { errors } = useFormState({ control: form.control })
  const period = useWatch({ control: form.control, name: "period" })
  const metric = useWatch({ control: form.control, name: "metric" })
  const unit = metricUnit(metric)
  const valueSuffix =
    unit === "money"
      ? (currency ?? "SAR")
      : unit === "rate"
        ? "%"
        : t("form.unitOrders")

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="target-name">{t("form.name")}</Label>
        <Input
          id="target-name"
          placeholder={t("form.namePlaceholder")}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "target-name-error" : undefined}
          {...form.register("name")}
        />
        {errors.name ? (
          <p id="target-name-error" className="text-xs text-destructive">
            {errors.name.message}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="target-metric">{t("form.metric")}</Label>
          <Controller
            control={form.control}
            name="metric"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="target-metric">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METRIC_OPTIONS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {t(`metrics.${m}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="target-period">{t("form.period")}</Label>
          <Controller
            control={form.control}
            name="period"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="target-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(`periods.${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="target-value">{t("form.value")}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="target-value"
            type="number"
            step="any"
            inputMode="decimal"
            placeholder="0"
            aria-invalid={!!errors.value}
            aria-describedby={errors.value ? "target-value-error" : undefined}
            {...form.register("value")}
          />
          <span className="shrink-0 text-sm text-muted-foreground">
            {valueSuffix}
          </span>
        </div>
        {errors.value ? (
          <p id="target-value-error" className="text-xs text-destructive">
            {errors.value.message}
          </p>
        ) : null}
      </div>

      {period === "CUSTOM" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="target-start">{t("form.start")}</Label>
            <Input id="target-start" type="date" {...form.register("start")} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="target-end">{t("form.end")}</Label>
            <Input
              id="target-end"
              type="date"
              aria-invalid={!!errors.end}
              aria-describedby={errors.end ? "target-end-error" : undefined}
              {...form.register("end")}
            />
            {errors.end ? (
              <p id="target-end-error" className="text-xs text-destructive">
                {errors.end.message}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t("form.currentPeriodHint")}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
        <div>
          <Label htmlFor="target-activate">{t("form.activate")}</Label>
          <p className="text-xs text-muted-foreground">
            {t("form.activateHint")}
          </p>
        </div>
        <Controller
          control={form.control}
          name="activate"
          render={({ field }) => (
            <Switch
              id="target-activate"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </div>
    </>
  )
}
