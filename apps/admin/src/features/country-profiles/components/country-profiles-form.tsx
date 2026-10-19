"use client"

import { useMutation, useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"

import { Badge } from "@repo/ui/components/badge"
import { Skeleton } from "@repo/ui/components/skeleton"
import { Switch } from "@repo/ui/components/switch"
import { Button } from "@repo/ui/components/button"

import { COUNTRY_PROFILES, UPDATE_COUNTRY_PROFILE } from "../api"

type Profile = {
  country_code: string
  enabled: boolean
  default_currency: string
  allowed_currencies: string[]
  allowed_payments: string[]
  allowed_delivery_channels: string[]
  shipping_match: string
  bank_account_mode: string
}

type ProfilesResult = {
  countryProfiles: { success: boolean; data: Profile[] }
}

export function CountryProfilesForm() {
  const t = useTranslations("countryProfiles")
  const { data, loading, error, refetch } = useQuery<ProfilesResult>(
    COUNTRY_PROFILES,
    { fetchPolicy: "network-only" },
  )
  const [update, { loading: saving }] = useMutation(UPDATE_COUNTRY_PROFILE)

  const rows = data?.countryProfiles?.data ?? []

  async function toggle(row: Profile, enabled: boolean) {
    try {
      await update({
        variables: {
          input: { country_code: row.country_code, enabled },
        },
      })
      await refetch()
      sileo.success({
        title: enabled ? t("enabledToast") : t("disabledToast"),
        description: row.country_code,
      })
    } catch {
      // Error link surfaces the message.
    }
  }

  if (loading && rows.length === 0) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="space-y-3 text-sm">
        <p>{error.message}</p>
        <Button variant="outline" onClick={() => void refetch()}>
          {t("retry")}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <ul className="divide-y divide-border rounded-xl bg-card ring-1 ring-foreground/10">
        {rows.map((row) => (
          <li
            key={row.country_code}
            className="flex flex-wrap items-start justify-between gap-4 px-4 py-4"
          >
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{row.country_code}</p>
                <Badge variant={row.enabled ? "secondary" : "outline"}>
                  {t(row.enabled ? "enabled" : "disabled")}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("currencyLine", {
                  currency: row.default_currency,
                  currencies: row.allowed_currencies.join(", "),
                })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("capsLine", {
                  payments: row.allowed_payments.join(", "),
                  delivery: row.allowed_delivery_channels.join(", "),
                  match: row.shipping_match,
                  bank: row.bank_account_mode,
                })}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label
                htmlFor={`profile-${row.country_code}`}
                className="text-sm text-muted-foreground"
              >
                {t("openForCreate")}
              </label>
              <Switch
                id={`profile-${row.country_code}`}
                checked={row.enabled}
                disabled={saving}
                onCheckedChange={(checked) => void toggle(row, checked)}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
