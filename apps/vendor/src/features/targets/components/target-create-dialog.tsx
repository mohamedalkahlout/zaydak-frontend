"use client"

import { useCallback, useEffect, useRef } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useLocale, useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@repo/ui/components/drawer"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import { Switch } from "@repo/ui/components/switch"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import type { Target } from "../types"
import { metricUnit } from "../lib/targets"
import { targetFormSchema, type TargetFormInput } from "../validations"
import { defaultsFor } from "./target-form"
import { useTargetSubmit } from "./use-target-submit"
import { TargetMetricPicker } from "./target-metric-picker"
import { TargetPeriodPicker } from "./target-period-picker"
import { TargetPreviewCard } from "./target-preview-card"

/**
 * Shopify-style create/edit target surface: a bottom drawer (slides up, with a
 * swipe handle) holding a two-column layout — the goal form on the (logical)
 * start side and a live preview gauge on the end side. Same schema and submit
 * pipeline as the full-page TargetForm. "Save to dashboard" persists via a
 * single mutation; "Add to dashboard" maps to the target's active/draft state.
 */
export function TargetCreateDialog({
  target,
  currency = "SAR",
  suggestion,
  open,
  onOpenChange,
  onDone,
}: {
  target?: Target
  /** Shop currency for the amount suffix + preview on create. */
  currency?: string
  /** Optional prefilled amount for the "Suggested targets" entry point. */
  suggestion?: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}) {
  const t = useTranslations("targets")
  const tv = useTranslations("targets.validation")
  const locale = useLocale()

  const makeDefaults = useCallback(
    (): TargetFormInput =>
      target
        ? defaultsFor(target)
        : {
            ...defaultsFor(undefined),
            name: t("create.defaultName", {
              month: new Date().toLocaleDateString(locale, { month: "short" }),
            }),
            value: suggestion != null ? String(suggestion) : "",
          },
    [target, suggestion, t, locale],
  )

  const form = useForm<TargetFormInput>({
    resolver: zodResolver(targetFormSchema(tv)),
    mode: "onChange",
    defaultValues: makeDefaults(),
  })
  const { submit, loading } = useTargetSubmit(form, target, onDone)
  const {
    formState: { errors },
  } = form

  // The drawer stays mounted so its open/close animation can play, so useForm's
  // one-time defaults would go stale across opens (for different targets). Reset
  // to fresh defaults on each rising edge of `open`.
  const prevOpen = useRef(false)
  useEffect(() => {
    if (open && !prevOpen.current) form.reset(makeDefaults())
    prevOpen.current = open
  }, [open, makeDefaults, form])

  // The submit hook reports failures to the (hidden) unsaved bar too; clear
  // that on unmount so a later save-bar screen doesn't inherit a stale error.
  const setBarError = useUnsavedBarStore((s) => s.setError)
  useEffect(() => () => setBarError(null), [setBarError])

  const values = useWatch({ control: form.control })
  const metric = values.metric ?? "TOTAL_SALES"
  const period = values.period ?? "MONTH"
  const unit = metricUnit(metric)
  // Prefer the edited target's own snapshot currency (its amount was prefilled
  // in that currency), matching the preview card + full-page form.
  const suffix =
    unit === "money"
      ? (target?.currency ?? currency)
      : unit === "rate"
        ? "%"
        : t("form.unitOrders")

  // Gate "Save" on the values directly rather than RHF's `isValid`, which only
  // settles after the first validation pass — this keeps the button correct on
  // the very first render (empty amount → disabled, like Shopify).
  const canSave =
    (values.name?.trim().length ?? 0) > 0 &&
    (values.value ?? "").trim() !== "" &&
    Number(values.value) > 0 &&
    (period !== "CUSTOM" || (!!values.start && !!values.end))

  const submitForm = form.handleSubmit(submit)

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      swipeDirection="down"
      showSwipeHandle
    >
      <DrawerContent className="mx-auto max-w-4xl max-h-[calc(100dvh-1.5rem)]">
        <div className="mx-auto flex min-h-0 w-full flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 pt-4 pb-3">
            <DrawerTitle className="flex items-center gap-2">
              {target ? t("create.editTitle") : t("create.title")}
            </DrawerTitle>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => onOpenChange(false)}
              >
                {t("create.discard")}
              </Button>
              <Button type="button" onClick={submitForm} disabled={loading || !canSave}>
                {loading ? t("saving") : t("create.save")}
              </Button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-4 pb-4 lg:grid-cols-2">
          {/* Form card */}
          <div className="flex h-full flex-col gap-5 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <div className="flex flex-col gap-1.5">
              <Label id="target-metric-label">{t("create.metric")}</Label>
              <TargetMetricPicker
                value={metric}
                labelId="target-metric-label"
                onChange={(m) =>
                  form.setValue("metric", m, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="target-amount">{t("create.amount")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="target-amount"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="0"
                  aria-invalid={!!errors.value}
                  {...form.register("value")}
                />
                <span className="shrink-0 text-sm text-muted-foreground">
                  {suffix}
                </span>
              </div>
              {errors.value ? (
                <p className="text-xs text-destructive">{errors.value.message}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("create.amountHint")}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label id="target-period-label">{t("create.timePeriod")}</Label>
              <TargetPeriodPicker
                period={period}
                labelId="target-period-label"
                onPeriodChange={(p) =>
                  form.setValue("period", p, {
                    shouldValidate: true,
                    shouldDirty: true,
                  })
                }
                start={values.start ?? ""}
                end={values.end ?? ""}
                onStartChange={(v) =>
                  form.setValue("start", v, { shouldValidate: true, shouldDirty: true })
                }
                onEndChange={(v) =>
                  form.setValue("end", v, { shouldValidate: true, shouldDirty: true })
                }
                endError={errors.end?.message}
              />
              {period !== "CUSTOM" ? (
                <p className="text-xs text-muted-foreground">
                  {t("create.timePeriodHint")}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="target-name">{t("create.name")}</Label>
              <Input
                id="target-name"
                placeholder={t("create.namePlaceholder")}
                aria-invalid={!!errors.name}
                {...form.register("name")}
              />
              {errors.name ? (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              ) : null}
            </div>
          </div>

          {/* Preview */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{t("create.preview")}</span>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                {t("create.addToDashboard")}
                <Switch
                  checked={values.activate ?? true}
                  onCheckedChange={(checked) =>
                    form.setValue("activate", checked, { shouldDirty: true })
                  }
                />
              </label>
            </div>
            <TargetPreviewCard
              name={values.name ?? ""}
              metric={metric}
              value={values.value ?? ""}
              period={period}
              start={values.start ?? ""}
              end={values.end ?? ""}
              currency={target?.currency ?? currency}
            />
          </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
