"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import { Switch } from "@repo/ui/components/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { centsToMajor } from "@/shared/lib/format"
import { ADMIN_CREATE_PLAN, ADMIN_UPDATE_PLAN } from "../api"
import { planSchema, toCents, type PlanFormValues } from "../validations"
import type { PlanRow } from "../types"

/**
 * Create or edit a plan.
 *
 * Prices are entered in major units and converted to integer cents **here, at
 * the network boundary** — the same rule the commissions form follows. Nothing
 * downstream converts, so there is exactly one place a rounding bug could live.
 */
export function PlanFormDialog({
  plan,
  onClose,
  onSaved,
}: {
  plan: PlanRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const editing = Boolean(plan)
  const [create] = useMutation(ADMIN_CREATE_PLAN)
  const [update] = useMutation(ADMIN_UPDATE_PLAN)
  const t = useTranslations("plans")
  const [error, setError] = useState<string | null>(null)

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      code: plan?.code ?? "",
      name: plan?.name ?? "",
      name_ar: plan?.name_ar ?? "",
      description: plan?.description ?? "",
      monthly_price: plan ? centsToMajor(plan.monthly_price_cents) : 0,
      yearly_price: plan ? centsToMajor(plan.yearly_price_cents) : 0,
      currency: plan?.currency ?? "SAR",
      trial_days: plan?.trial_days ?? 0,
      is_public: plan?.is_public ?? true,
    },
  })

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = form

  async function onSubmit(values: PlanFormValues) {
    setError(null)
    try {
      if (plan) {
        // `code` is absent from UpdatePlanInput by design — it is the stable
        // handle the seed and the fallback lookup key on, so the server refuses
        // to rename it and the field is read-only above.
        await update({
          variables: {
            input: {
              id: plan.id,
              name: values.name,
              name_ar: values.name_ar || undefined,
              description: values.description || undefined,
              monthly_price_cents: toCents(values.monthly_price),
              yearly_price_cents: toCents(values.yearly_price),
              currency: values.currency,
              trial_days: values.trial_days,
              is_public: values.is_public,
            },
          },
        })
      } else {
        await create({
          variables: {
            input: {
              code: values.code,
              name: values.name,
              name_ar: values.name_ar || undefined,
              description: values.description || undefined,
              monthly_price_cents: toCents(values.monthly_price),
              yearly_price_cents: toCents(values.yearly_price),
              currency: values.currency,
              trial_days: values.trial_days,
              is_public: values.is_public,
            },
          },
        })
      }
      onSaved()
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? t("form.editTitle", { name: plan!.name }) : t("form.newTitle")}</DialogTitle>
          <DialogDescription>
            {editing ? t("form.editHint") : t("form.newHint")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Field label={t("form.code")} error={errors.code?.message}>
            <Input {...register("code")} disabled={editing} placeholder="grow" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("form.name")} error={errors.name?.message}>
              <Input {...register("name")} />
            </Field>
            <Field label={t("form.nameAr")} error={errors.name_ar?.message}>
              <Input {...register("name_ar")} dir="rtl" />
            </Field>
          </div>

          <Field label={t("form.description")} error={errors.description?.message}>
            <Input {...register("description")} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("col.monthly")} error={errors.monthly_price?.message}>
              <Input
                type="number"
                step="0.01"
                {...register("monthly_price", { valueAsNumber: true })}
              />
            </Field>
            <Field label={t("col.yearly")} error={errors.yearly_price?.message}>
              <Input
                type="number"
                step="0.01"
                {...register("yearly_price", { valueAsNumber: true })}
              />
            </Field>
            <Field label={t("form.currency")} error={errors.currency?.message}>
              <Input {...register("currency")} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("form.trialDaysLabel")} error={errors.trial_days?.message}>
              <Input
                type="number"
                {...register("trial_days", { valueAsNumber: true })}
              />
            </Field>
            <div className="flex items-end justify-between gap-3 pb-1">
              <Label htmlFor="is_public" className="text-sm font-normal">
                {t("form.isPublic")}
              </Label>
              <Switch
                id="is_public"
                checked={watch("is_public")}
                onCheckedChange={(v) => setValue("is_public", v, { shouldDirty: true })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("form.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("saving") : editing ? t("save") : t("form.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-normal">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
