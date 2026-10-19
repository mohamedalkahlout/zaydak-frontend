"use client"

import { useEffect, useState } from "react"
import { useApolloClient, useMutation } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { Input } from "@repo/ui/components/input"
import { sileo } from "sileo"
import { GET_MY_SHOPS, UPDATE_SHOP } from "@/features/shops/api"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import { useLeaveGuard } from "@/shared/hooks/use-leave-guard"
import { SettingsCard } from "./settings-card"
import { useSettingsShop } from "./settings-shell"
import { parseSettingsPath } from "../lib/routes"

const MAX_BPS = 10_000

/** Display percent from basis points (1500 → "15"). */
export function bpsToPercentString(bps: number): string {
  const pct = bps / 100
  return Number.isInteger(pct) ? String(pct) : String(pct)
}

/**
 * Parse a merchant-entered percent into bps.
 * Returns null when the string is empty or not a finite number.
 */
export function percentStringToBps(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const pct = Number(trimmed)
  if (!Number.isFinite(pct)) return null
  return Math.round(pct * 100)
}

function clampBps(bps: number): number {
  return Math.min(MAX_BPS, Math.max(0, bps))
}

/**
 * Settings → Taxes: shop-wide sales-tax fallback (`Shop.tax_bps`).
 *
 * Stages locally and commits through the contextual save bar — one field, one
 * `updateShop({ tax_bps })`. Existing orders keep the tax cents they stored at
 * create time; changing this rate only affects new quotes.
 */
export function TaxesPane() {
  const shop = useSettingsShop()
  const t = useTranslations("settings")
  const tTax = useTranslations("settings.taxes")
  const apollo = useApolloClient()
  const showBar = useUnsavedBarStore((s) => s.show)
  const hideBar = useUnsavedBarStore((s) => s.hide)
  const setBarError = useUnsavedBarStore((s) => s.setError)

  const serverBps = shop?.tax_bps ?? 0
  const serverPercent = bpsToPercentString(serverBps)

  const [percent, setPercent] = useState(serverPercent)
  const seedKey = shop ? `${shop.slug}:${serverBps}` : null
  const [seededFrom, setSeededFrom] = useState<string | null>(seedKey)

  if (seededFrom !== seedKey) {
    setSeededFrom(seedKey)
    setPercent(serverPercent)
  }

  const parsed = percentStringToBps(percent)
  const nextBps = parsed == null ? null : clampBps(parsed)
  const invalid =
    percent.trim() !== "" &&
    (parsed == null || parsed < 0 || parsed > MAX_BPS)
  const dirty =
    !invalid && nextBps != null && nextBps !== serverBps

  const [update, { loading: saving }] = useMutation(UPDATE_SHOP, {
    onCompleted: () => {
      sileo.success({ title: tTax("saved") })
      void apollo.refetchQueries({ include: [GET_MY_SHOPS] })
    },
    onError: (err) => {
      sileo.error({ title: err.message })
      setBarError(err.message)
    },
  })

  const onSave = () => {
    if (!shop || nextBps == null || invalid) {
      const msg = tTax("invalidRate")
      sileo.error({ title: msg })
      setBarError(msg)
      return
    }
    setBarError(null)
    void update({
      variables: { slug: shop.slug, input: { tax_bps: nextBps } },
    })
  }

  const onDiscard = () => {
    setPercent(serverPercent)
    setBarError(null)
  }

  useEffect(() => {
    if (!dirty) {
      hideBar()
      return
    }
    showBar({ label: t("unsavedChanges"), saving, onSave, onDiscard })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, saving, percent])
  useEffect(() => () => hideBar(), [hideBar])

  useLeaveGuard({
    when: dirty,
    allow: (path) => parseSettingsPath(path).section === "taxes",
    onLeave: () => {
      setPercent(serverPercent)
      setBarError(null)
      hideBar()
    },
  })

  if (!shop) return null

  return (
    <div className="flex flex-col gap-5">
      <SettingsCard title={tTax("title")} description={tTax("description")}>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{tTax("rateLabel")}</span>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              inputMode="decimal"
              dir="ltr"
              className="max-w-40"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              aria-invalid={invalid || undefined}
              aria-describedby="tax-rate-hint"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          <p id="tax-rate-hint" className="text-sm text-muted-foreground">
            {tTax("rateHint")}
          </p>
          {invalid ? (
            <p className="text-sm text-destructive">{tTax("invalidRate")}</p>
          ) : null}
        </label>
      </SettingsCard>
      <p className="text-sm text-muted-foreground">{tTax("historicalNote")}</p>
    </div>
  )
}
