"use client"

import { useState } from "react"
import { useApolloClient, useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import { Button } from "@repo/ui/components/button"
import { Input } from "@repo/ui/components/input"
import { Field, FieldLabel } from "@repo/ui/components/field"

import { bpsToPercent, majorToCents, centsToMajor } from "@/shared/lib/format"
import {
  CREATE_SHIPPING_RULE,
  GET_SHIPPING_RULES,
  GET_SHIPPING_ZONES,
  UPDATE_SHIPPING_RULE,
} from "../api"
import { rateColumns, rateFields, textOf } from "../lib/zones"
import { RATE_TYPES, type ShippingRule } from "../types"

/**
 * Create or edit one rate band.
 *
 * The inputs shown are driven by `rateFields(type)`, and the columns written by
 * `rateColumns` — which zeroes the ones the chosen type does not use. That
 * matters on an *edit*: the fee engine reads whichever column `type` names, so
 * a rule switched from fixed to percentage keeps charging the stale
 * `amount_cents` unless it is cleared.
 */
export function RateFormDialog({
  open,
  zoneId,
  rule,
  currency,
  onOpenChange,
}: {
  open: boolean
  /** The zone this rate belongs to, or null for an unzoned (legacy) rate. */
  zoneId: string | null
  rule?: ShippingRule
  currency?: string | null
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("settings.shipping")
  const tCommon = useTranslations("common")
  const tHeader = useTranslations("header")
  const apollo = useApolloClient()

  const [name, setName] = useState("")
  const [type, setType] = useState<string>("fixed")
  const [amount, setAmount] = useState("0")
  const [percent, setPercent] = useState("0")
  const [perKg, setPerKg] = useState("0")
  const [freeOver, setFreeOver] = useState("")
  // Delivery estimate in days. "" = no promise made — checkout shows nothing.
  const [etaMin, setEtaMin] = useState("")
  const [etaMax, setEtaMax] = useState("")

  const [seededFrom, setSeededFrom] = useState<{
    open: boolean
    rule?: ShippingRule
    zoneId: string | null
  } | null>(null)
  if (
    !seededFrom ||
    seededFrom.open !== open ||
    seededFrom.rule !== rule ||
    seededFrom.zoneId !== zoneId
  ) {
    setSeededFrom({ open, rule, zoneId })
    if (open) {
      setName(rule ? textOf(rule.name) : "")
      setType(rule?.type ?? "fixed")
      setAmount(String(centsToMajor(rule?.amount_cents)))
      setPercent(String(bpsToPercent(rule?.amount_bps)))
      setPerKg(String(centsToMajor(rule?.per_kg_cents)))
      setFreeOver(
        rule?.min_order_cents ? String(centsToMajor(rule.min_order_cents)) : "",
      )
      setEtaMin(
        rule?.min_delivery_days != null ? String(rule.min_delivery_days) : "",
      )
      setEtaMax(
        rule?.max_delivery_days != null ? String(rule.max_delivery_days) : "",
      )
    }
  }

  const done = () => {
    void apollo.refetchQueries({
      include: [GET_SHIPPING_ZONES, GET_SHIPPING_RULES],
    })
    onOpenChange(false)
  }
  const onError = (error: Error) => sileo.error({ title: error.message })

  const [create, createState] = useMutation(CREATE_SHIPPING_RULE, {
    onCompleted: () => {
      sileo.success({ title: t("rateCreated") })
      done()
    },
    onError,
  })
  const [update, updateState] = useMutation(UPDATE_SHIPPING_RULE, {
    onCompleted: () => {
      sileo.success({ title: t("rateUpdated") })
      done()
    },
    onError,
  })

  const saving = createState.loading || updateState.loading
  const shown = rateFields(type)
  const trimmed = name.trim()

  const num = (value: string) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!trimmed) return

    const columns = rateColumns({
      type,
      amountCents: majorToCents(num(amount)),
      amountBps: Math.round(num(percent) * 100),
      perKgCents: majorToCents(num(perKg)),
    })

    const shared = {
      name: { en: trimmed, ar: trimmed },
      type,
      ...columns,
      min_order_cents: freeOver.trim() ? majorToCents(num(freeOver)) : 0,
      // Empty clears the promise (null), a number makes one. Whole days.
      min_delivery_days: etaMin.trim() ? Math.round(num(etaMin)) : null,
      max_delivery_days: etaMax.trim() ? Math.round(num(etaMax)) : null,
    }

    if (rule) {
      void update({ variables: { input: { id: rule.id, ...shared } } })
    } else {
      void create({
        variables: {
          input: { ...shared, ...(zoneId ? { zone_id: zoneId } : {}) },
        },
      })
    }
  }

  const unit = currency ?? "SAR"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>
              {rule ? t("editRateTitle") : t("newRateTitle")}
            </DialogTitle>
            <DialogDescription>
              {zoneId ? t("rateDialogHint") : t("unzonedRateHint")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <Field>
              <FieldLabel htmlFor="rate-name">{t("rateName")}</FieldLabel>
              <Input
                id="rate-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("rateNamePlaceholder")}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                {t("rateNameHint")}
              </p>
            </Field>

            <Field>
              <FieldLabel>{t("rateType")}</FieldLabel>
              <Select
                value={type}
                onValueChange={(value) => {
                  // `Select` hands back `string | null` (null when cleared);
                  // a null would blank the type and the engine falls to fixed.
                  if (value) setType(value)
                }}
              >
                <SelectTrigger aria-label={t("rateType")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RATE_TYPES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(`rateTypes.${option}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              {shown.amount_cents && (
                <Field>
                  <FieldLabel htmlFor="rate-amount">
                    {type === "weight_based"
                      ? t("baseAmount", { currency: unit })
                      : t("amount", { currency: unit })}
                  </FieldLabel>
                  <Input
                    id="rate-amount"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </Field>
              )}

              {shown.amount_bps && (
                <Field>
                  <FieldLabel htmlFor="rate-percent">
                    {t("percentOfOrder")}
                  </FieldLabel>
                  <Input
                    id="rate-percent"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.1"
                    value={percent}
                    onChange={(event) => setPercent(event.target.value)}
                  />
                </Field>
              )}

              {shown.per_kg_cents && (
                <Field>
                  <FieldLabel htmlFor="rate-perkg">
                    {t("perKilo", { currency: unit })}
                  </FieldLabel>
                  <Input
                    id="rate-perkg"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={perKg}
                    onChange={(event) => setPerKg(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t("perKiloHint")}
                  </p>
                </Field>
              )}

              <Field>
                <FieldLabel htmlFor="rate-free-over">
                  {t("freeOverLabel", { currency: unit })}
                </FieldLabel>
                <Input
                  id="rate-free-over"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={freeOver}
                  onChange={(event) => setFreeOver(event.target.value)}
                  placeholder={t("freeOverPlaceholder")}
                />
                <p className="text-xs text-muted-foreground">
                  {t("freeOverHint")}
                </p>
              </Field>

              <Field>
                <FieldLabel htmlFor="rate-eta-min">
                  {t("etaMinLabel")}
                </FieldLabel>
                <Input
                  id="rate-eta-min"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step="1"
                  value={etaMin}
                  onChange={(event) => setEtaMin(event.target.value)}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="rate-eta-max">
                  {t("etaMaxLabel")}
                </FieldLabel>
                <Input
                  id="rate-eta-max"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step="1"
                  value={etaMax}
                  onChange={(event) => setEtaMax(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">{t("etaHint")}</p>
              </Field>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={saving || !trimmed}>
              {saving ? tHeader("saving") : tHeader("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
