"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { sileo } from "sileo"
import type { OrderFilters } from "@/features/orders/types"
import { exportFilters } from "@/features/orders/lib/list/filters"
import { downloadCsv } from "@/shared/lib/csv"
import { useAuthStore } from "@/shared/stores/auth"
import { useActiveShopStore } from "@/shared/stores/active-shop"
import { tunnelHeaders } from "@/shared/lib/apollo/tunnel-headers"
import { documentLocale } from "@/shared/i18n/outside-react"

/**
 * "Export orders": the list on screen as a CSV file.
 *
 * It sends the list's own filters and sort to
 * `GET /api/v1/orders/export.csv`, which streams every matching order. The
 * inline GraphQL export stops at 10,000 because its body is one string;
 * this download does not.
 */
function ordersExportUrl(filters: OrderFilters | undefined): string {
  const base = (
    process.env.NEXT_PUBLIC_GRAPHQL_URL ?? "http://localhost:3000/graphql"
  ).replace(/\/graphql\/?$/, "")
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(exportFilters(filters ?? {}))) {
    if (value == null || value === "") continue
    params.set(key, String(value))
  }
  const query = params.toString()
  return `${base}/api/v1/orders/export.csv${query ? `?${query}` : ""}`
}

export function useOrdersExport(filters: OrderFilters | undefined) {
  const t = useTranslations("orders.list")
  const [exporting, setExporting] = useState(false)

  const exportOrders = async () => {
    const token = useAuthStore.getState().accessToken
    const shopSlug = useActiveShopStore.getState().slug
    if (!token || !shopSlug) {
      sileo.error({
        title: t("exportFailed"),
        description: t("exportTryAgain"),
      })
      return
    }
    setExporting(true)
    try {
      const res = await fetch(ordersExportUrl(filters), {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-SHOP": shopSlug,
          "accept-language": documentLocale(),
          ...tunnelHeaders(),
        },
      })
      if (!res.ok) throw new Error(t("exportFailed"))
      const csv = await res.text()
      if (!csv) return
      const stamp = new Date().toISOString().slice(0, 10)
      downloadCsv(`orders-${stamp}.csv`, csv)
    } catch (err) {
      sileo.error({
        title: t("exportFailed"),
        description: err instanceof Error ? err.message : t("exportTryAgain"),
      })
    } finally {
      setExporting(false)
    }
  }

  return { exportOrders, exporting }
}
