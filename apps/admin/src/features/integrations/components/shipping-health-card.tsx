"use client"

import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import {
  ActivityIcon,
  CheckCircle2Icon,
  GlobeIcon,
  MapPinIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  TruckIcon,
  XCircleIcon,
} from "lucide-react"
import { sileo } from "sileo"

import { Badge } from "@repo/ui/components/badge"
import { Button } from "@repo/ui/components/button"
import { Skeleton } from "@repo/ui/components/skeleton"
import { PLATFORM_SHIPPING_HEALTH } from "../api"

/**
 * Operator Health Panel for the Platform SHIPPING integration.
 *
 * Provides real-time health diagnostics for:
 * 1. OTO API connection (token exchange / authentication).
 * 2. Saudi National Address lookup probe (testing SPL / short code resolution).
 * 3. Webhook callback origin configuration.
 */
export function ShippingHealthCard() {
  const t = useTranslations("integrations.shippingHealth")

  const { data, loading, error, refetch } = useQuery(PLATFORM_SHIPPING_HEALTH, {
    fetchPolicy: "network-only",
  })

  const health = data?.platformShippingHealth?.data

  const handleRefresh = async () => {
    try {
      await refetch()
      sileo.success({ title: t("refreshed") })
    } catch (err) {
      sileo.error({ title: (err as Error).message })
    }
  }

  if (loading && !health) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-xs">
        <div className="flex items-center justify-between pb-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive">
        <p className="font-medium">{t("errorLoading")}</p>
        <p className="text-xs text-muted-foreground">{error.message}</p>
      </div>
    )
  }

  const allOperational =
    health?.configured &&
    health.is_enabled &&
    health.oto_connected &&
    health.national_address_ok

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ActivityIcon className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{t("title")}</h3>
            <p className="text-xs text-muted-foreground">{t("description")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {allOperational ? (
            <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2Icon className="size-3.5" />
              {t("operational")}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400">
              <XCircleIcon className="size-3.5" />
              {t("attentionNeeded")}
            </Badge>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCwIcon className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            {t("recheck")}
          </Button>
        </div>
      </div>

      {/* Grid of health probe items */}
      <div className="grid gap-3 sm:grid-cols-3">
        {/* 1. OTO Carrier Connection */}
        <div className="flex flex-col gap-1.5 rounded-lg border p-3.5 bg-muted/20">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <TruckIcon className="size-3.5" />
              {t("otoConnection")}
            </span>
            {health?.oto_connected ? (
              <span className="flex size-2 rounded-full bg-emerald-500" />
            ) : (
              <span className="flex size-2 rounded-full bg-rose-500" />
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">
              {health?.oto_connected ? t("connected") : t("disconnected")}
            </span>
            {health?.provider && (
              <span className="text-xs uppercase text-muted-foreground">
                ({health.provider})
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {health?.oto_connected
              ? t("otoConnectedDesc")
              : health?.last_verify_error || t("otoDisconnectedDesc")}
          </p>
        </div>

        {/* 2. Saudi National Address Lookup */}
        <div className="flex flex-col gap-1.5 rounded-lg border p-3.5 bg-muted/20">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <MapPinIcon className="size-3.5" />
              {t("nationalAddress")}
            </span>
            {health?.national_address_ok ? (
              <span className="flex size-2 rounded-full bg-emerald-500" />
            ) : (
              <span className="flex size-2 rounded-full bg-rose-500" />
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold">
              {health?.national_address_ok ? t("resolving") : t("unreachable")}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground" title={health?.national_address_sample ?? undefined}>
            {health?.national_address_ok
              ? health?.national_address_sample || t("nationalAddressOkDesc")
              : t("nationalAddressFailDesc")}
          </p>
        </div>

        {/* 3. Callback Origin */}
        <div className="flex flex-col gap-1.5 rounded-lg border p-3.5 bg-muted/20">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <GlobeIcon className="size-3.5" />
              {t("callbackOrigin")}
            </span>
            {health?.callback_origin ? (
              <span className="flex size-2 rounded-full bg-emerald-500" />
            ) : (
              <span className="flex size-2 rounded-full bg-amber-500" />
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-semibold" title={health?.callback_origin ?? undefined}>
              {health?.callback_origin ? t("configured") : t("notConfigured")}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground" title={health?.callback_origin ?? undefined}>
            {health?.callback_origin || t("callbackOriginDesc")}
          </p>
        </div>
      </div>

      {/* Diagnostics summary & last verified */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground pt-1">
        <span className="flex items-center gap-1.5">
          <ShieldCheckIcon className="size-3.5" />
          {health?.details || t("diagnosticsReady")}
        </span>
        {health?.last_verified_at && (
          <span>
            {t("lastVerified")}: {new Date(health.last_verified_at).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  )
}
