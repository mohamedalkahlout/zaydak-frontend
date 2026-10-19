"use client"

import { useState } from "react"
import { gql } from "@apollo/client"
import { useMutation, useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { Input } from "@repo/ui/components/input"
import { Button } from "@repo/ui/components/button"
import { sileo } from "sileo"
import { SettingsCard } from "./settings-card"

const SHEIN_SETTINGS = gql`
  query MySheinIntegration {
    mySheinIntegration {
      business_model
      shop_currency
      enabled
      profit_mode
      fixed_profit_cents
      profit_bps
      exchange_rate_bps
      source_currency
      example_source_cents
      example_charged_cents
    }
  }
`

const SAVE_SHEIN = gql`
  mutation SaveSheinIntegration($input: SaveSheinIntegrationInput!) {
    saveSheinIntegration(input: $input) {
      enabled
      profit_mode
      fixed_profit_cents
      profit_bps
      exchange_rate_bps
      source_currency
      example_charged_cents
      shop_currency
    }
  }
`

const SET_MODEL = gql`
  mutation SetShopBusinessModel($business_model: String!) {
    setShopBusinessModel(business_model: $business_model) {
      business_model
    }
  }
`

type Settings = {
  mySheinIntegration: {
    business_model: string
    shop_currency: string
    enabled: boolean
    profit_mode: "FIXED_PER_ITEM" | "PERCENTAGE"
    fixed_profit_cents: number | null
    profit_bps: number | null
    exchange_rate_bps: number
    source_currency: string
    example_charged_cents: number
  }
}

const MODELS = ["OWN_PRODUCTS", "SHOPPING_AGENT", "HYBRID"] as const

export function SheinPane() {
  const t = useTranslations("settings.shein")
  const { data, loading, refetch } = useQuery<Settings>(SHEIN_SETTINGS)
  const [save, saveState] = useMutation(SAVE_SHEIN)
  const [setModel, modelState] = useMutation(SET_MODEL)
  const row = data?.mySheinIntegration
  const [profitMode, setProfitMode] = useState<"FIXED_PER_ITEM" | "PERCENTAGE">(
    "PERCENTAGE",
  )
  const [profit, setProfit] = useState("")
  const [fixedMajor, setFixedMajor] = useState("5")
  const [rate, setRate] = useState("")
  const [currency, setCurrency] = useState("")
  const [enabled, setEnabled] = useState(false)
  const [seeded, setSeeded] = useState(false)
  if (row && !seeded) {
    setSeeded(true)
    setProfitMode(row.profit_mode)
    setProfit(row.profit_bps == null ? "20" : String(row.profit_bps / 100))
    setFixedMajor(
      row.fixed_profit_cents == null ? "5" : String(row.fixed_profit_cents / 100),
    )
    setRate(String(row.exchange_rate_bps / 10000))
    setCurrency(row.source_currency)
    setEnabled(row.enabled)
  }

  const sourceCode = (currency || row?.source_currency || "").toUpperCase()
  const sameCurrency = sourceCode === row?.shop_currency
  const profitBps = Math.round(Number(profit) * 100)
  const fixedCents = Math.round(Number(fixedMajor) * 100)
  const rateBps = Math.round(Number(rate) * 10000)

  function preview(sourceMajor: number): string {
    const sourceCents = Math.round(sourceMajor * 100)
    const converted =
      sameCurrency || !Number.isFinite(rateBps) || rateBps <= 0
        ? sourceCents
        : Math.round((sourceCents * rateBps) / 10000)
    const unit =
      profitMode === "FIXED_PER_ITEM"
        ? converted + (Number.isFinite(fixedCents) ? fixedCents : 0)
        : Math.round((converted * (10000 + (Number.isFinite(profitBps) ? profitBps : 0))) / 10000)
    return (unit / 100).toFixed(2)
  }

  async function onSave() {
    try {
      await save({
        variables: {
          input: {
            enabled,
            profit_mode: profitMode,
            fixed_profit_cents: profitMode === "FIXED_PER_ITEM" ? fixedCents : null,
            profit_bps: profitMode === "PERCENTAGE" ? profitBps : null,
            exchange_rate_bps: rateBps,
            source_currency: sourceCode,
          },
        },
      })
      await refetch()
      sileo.success({ title: t("saved") })
    } catch {
      sileo.error({ title: t("failed") })
    }
  }

  if (loading || !row) return null

  return (
    <SettingsCard title={t("title")} description={t("description")}>
      <label className="mb-4 flex flex-col gap-1 text-sm">
        {t("model")}
        <select
          className="h-9 rounded-md border border-input bg-background px-2"
          value={row.business_model}
          disabled={modelState.loading}
          onChange={(event) => {
            void setModel({
              variables: { business_model: event.target.value },
            }).then(() => refetch())
          }}
        >
          {MODELS.map((model) => (
            <option key={model} value={model}>
              {model === "OWN_PRODUCTS"
                ? t("own")
                : model === "SHOPPING_AGENT"
                  ? t("agent")
                  : t("hybrid")}
            </option>
          ))}
        </select>
      </label>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
        />
        {t("enabled")}
      </label>
      <fieldset className="mb-3 flex flex-col gap-2 text-sm">
        <legend>{t("profitMode")}</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="shein-profit"
            checked={profitMode === "FIXED_PER_ITEM"}
            onChange={() => setProfitMode("FIXED_PER_ITEM")}
          />
          {t("profitFixed")}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="shein-profit"
            checked={profitMode === "PERCENTAGE"}
            onChange={() => setProfitMode("PERCENTAGE")}
          />
          {t("profitPercent")}
        </label>
      </fieldset>
      {profitMode === "FIXED_PER_ITEM" ? (
        <label className="mb-3 flex flex-col gap-1 text-sm">
          {t("fixedAmount")}
          <Input value={fixedMajor} onChange={(event) => setFixedMajor(event.target.value)} inputMode="decimal" />
          <span className="text-xs text-muted-foreground">
            {t("fixedHint", { currency: row.shop_currency })}
          </span>
        </label>
      ) : (
        <label className="mb-3 flex flex-col gap-1 text-sm">
          {t("profit")}
          <Input value={profit} onChange={(event) => setProfit(event.target.value)} inputMode="decimal" />
        </label>
      )}
      <label className="mb-3 flex flex-col gap-1 text-sm">
        {t("sourceCurrency")}
        <Input value={currency} onChange={(event) => setCurrency(event.target.value)} maxLength={3} />
      </label>
      {!sameCurrency && (
      <label className="mb-3 flex flex-col gap-1 text-sm">
        {t("rate")}
        <Input value={rate} onChange={(event) => setRate(event.target.value)} inputMode="decimal" />
        <span className="text-xs text-muted-foreground">
          {t("rateHint", { currency: row.shop_currency, source: currency || row.source_currency })}
        </span>
      </label>
      )}
      <ul className="mb-4 space-y-1 text-sm">
        {profitMode === "FIXED_PER_ITEM" && sameCurrency
          ? [20, 50, 100].map((amount) => (
              <li key={amount}>
                {t("exampleFixed", {
                  sourceAmount: amount.toFixed(2),
                  currency: row.shop_currency,
                  markup: (fixedCents / 100).toFixed(2),
                  charged: preview(amount),
                })}
              </li>
            ))
          : (
              <li>
                {t("example", {
                  sourceAmount: "50.00",
                  source: sourceCode,
                  currency: row.shop_currency,
                  charged: preview(50),
                })}
              </li>
            )}
      </ul>
      <Button type="button" onClick={() => void onSave()} disabled={saveState.loading}>
        {t("save")}
      </Button>
    </SettingsCard>
  )
}
