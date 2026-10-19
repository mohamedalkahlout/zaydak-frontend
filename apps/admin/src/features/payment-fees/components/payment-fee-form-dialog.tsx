"use client"

import { useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"

import { Button } from "@repo/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import { Input } from "@repo/ui/components/input"
import { Label } from "@repo/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { Switch } from "@repo/ui/components/switch"

import { UPSERT_PAYMENT_GATEWAY_FEE } from "../api"
import { findFee, MAX_FEE_PERCENT, type PaymentFeeRow } from "../types"
import {
  paymentFeeSchema,
  toFormValues,
  toUpsertInput,
  type PaymentFeeFormValues,
} from "../validations"

/** The currency a new fee starts in when the schedule has no row to copy. */
const DEFAULT_CURRENCY = "SAR"

/**
 * Add a fee, or change one.
 *
 * The parent mounts this only while it is open, so the form's defaults are
 * read once from the row it was opened on and there is no effect re-seeding it.
 *
 * A fee is named by its payment method and currency, so both are fixed when
 * editing: changing either would be a different fee, not a change to this one.
 * Adding a fee for a pair that already has one replaces it (the mutation is an
 * upsert), and the form says so before the admin saves rather than after.
 *
 * The dialog repeats what a change does. This is the one screen whose Save
 * moves a number on every shop at once, and the place to say so is beside the
 * button, not only on the page behind the overlay.
 */
export function PaymentFeeFormDialog({
  fee,
  rows,
  gateways,
  methodLabel,
  onClose,
  onSaved,
}: {
  /** `null` opens the form for a new fee. */
  fee: PaymentFeeRow | null
  /** The schedule as listed, to warn when a new fee would replace one. */
  rows: readonly PaymentFeeRow[]
  /** The payment methods the API accepts, from the list query. */
  gateways: readonly string[]
  methodLabel: (gateway: string) => string
  onClose: () => void
  onSaved: () => void
}) {
  const t = useTranslations("paymentFees")
  const editing = fee !== null
  const [error, setError] = useState<string | null>(null)
  const [upsert] = useMutation(UPSERT_PAYMENT_GATEWAY_FEE)

  const resolver = useMemo(() => zodResolver(paymentFeeSchema(t)), [t])
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFeeFormValues>({
    resolver,
    defaultValues: toFormValues(fee, {
      gateway: "",
      currency: rows[0]?.currency ?? DEFAULT_CURRENCY,
    }),
  })

  // `useWatch`, not the form's `watch()`: it is a hook, so the React Compiler
  // can still memoize this component.
  const [gateway, currency, active] = useWatch({
    control,
    name: ["gateway", "currency", "active"],
  })
  const replaces = editing ? undefined : findFee(rows, gateway, currency ?? "")
  const methods = gateways.map((value) => ({
    value,
    label: methodLabel(value),
  }))

  async function onSubmit(values: PaymentFeeFormValues) {
    setError(null)
    try {
      await upsert({ variables: { input: toUpsertInput(values) } })
      sileo.success({ title: t("saved") })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? t("form.editTitle", { method: methodLabel(fee.gateway) })
              : t("form.createTitle")}
          </DialogTitle>
          <DialogDescription>{t("impact.body")}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          {error ? (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {t("saveFailed")}: {error}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="fee-gateway"
              label={t("form.method")}
              error={errors.gateway?.message}
            >
              <Select
                items={methods}
                value={gateway || null}
                onValueChange={(value) =>
                  setValue("gateway", (value as string | null) ?? "", {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                disabled={editing}
              >
                <SelectTrigger id="fee-gateway" className="w-full">
                  <SelectValue placeholder={t("form.methodPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {methods.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              id="fee-currency"
              label={t("form.currency")}
              hint={t("form.currencyHint")}
              error={errors.currency?.message}
            >
              <Input
                id="fee-currency"
                {...register("currency")}
                disabled={editing}
                maxLength={3}
                autoComplete="off"
                dir="ltr"
                className="uppercase"
              />
            </Field>
          </div>

          {replaces ? (
            <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              {t("form.replaces")}
            </p>
          ) : null}

          <Field
            id="fee-percent"
            label={t("form.percent")}
            hint={t("form.percentHint", { max: MAX_FEE_PERCENT })}
            error={errors.percent?.message}
          >
            <Input
              id="fee-percent"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              dir="ltr"
              {...register("percent", { valueAsNumber: true })}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="fee-fixed"
              label={t("form.fixed")}
              hint={t("form.fixedHint")}
              error={errors.fixed?.message}
            >
              <Input
                id="fee-fixed"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                dir="ltr"
                {...register("fixed", { valueAsNumber: true })}
              />
            </Field>

            <Field
              id="fee-cap"
              label={t("form.cap")}
              hint={t("form.capHint")}
              error={errors.cap?.message}
            >
              <Input
                id="fee-cap"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                dir="ltr"
                placeholder={t("noCap")}
                // An empty field means "no cap", not a cap of zero.
                {...register("cap", {
                  setValueAs: (value) =>
                    value === "" || value === null || value === undefined
                      ? null
                      : Number(value),
                })}
              />
            </Field>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <Label htmlFor="fee-active" className="text-sm font-normal">
                {t("form.active")}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t("form.activeHint")}
              </p>
            </div>
            <Switch
              id="fee-active"
              checked={active}
              onCheckedChange={(value) =>
                setValue("active", value, { shouldDirty: true })
              }
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("saving") : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-normal">
        {label}
      </Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
