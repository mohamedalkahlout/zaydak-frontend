"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { LoaderCircleIcon } from "lucide-react"
import { sileo } from "sileo"
import { cn } from "@/shared/lib/utils"
import type { Product } from "@/features/products/types"
import {
  PRODUCT_NEGOTIATION_STATUSES,
  UPSERT_NEGOTIATION_POLICY,
} from "@/features/negotiation/api"

interface StatusItem {
  product_id: string
  enabled: boolean
  enabled_variant_count: number
  total_variant_count: number
  label: string
}

interface ProductNegotiationStatusesData {
  productNegotiationStatuses: {
    success: boolean
    data: StatusItem[] | null
  }
}

interface UpsertPolicyData {
  upsertNegotiationPolicy: {
    success: boolean
  }
}

/**
 * Product negotiation status cell with a quick-toggle.
 *
 * For fixed-price / auction items, displays an em-dash.
 * For negotiable products, displays the current policy state (e.g. "Enabled",
 * "2 of 4 variants", or "Disabled") and allows immediate one-click
 * enable/disable toggle.
 *
 * The state is worded here from the counts rather than printed from the
 * server's `label`, which is English and built from the same two numbers
 * (`NegotiationService.productNegotiationStatuses`) — so the rule below has to
 * stay the server's rule.
 */
export function ProductNegotiationCell({ product }: { product: Product }) {
  const t = useTranslations("products.negotiationCell")
  const isNegotiable = product.sale_type === "NEGOTIABLE"

  const { data } = useQuery<ProductNegotiationStatusesData>(
    PRODUCT_NEGOTIATION_STATUSES,
    {
      variables: { product_ids: [product.id] },
      skip: !isNegotiable,
    },
  )

  const [upsertPolicy, { loading: mutating }] = useMutation<UpsertPolicyData>(
    UPSERT_NEGOTIATION_POLICY,
    { refetchQueries: ["ProductNegotiationStatuses"] },
  )

  const [optimistic, setOptimistic] = useState<boolean | null>(null)

  if (!isNegotiable) {
    return <span className="text-sm text-muted-foreground">—</span>
  }

  const serverStatus = data?.productNegotiationStatuses?.data?.[0]
  if (optimistic !== null && serverStatus && serverStatus.enabled === optimistic) {
    setOptimistic(null)
  }

  const isEnabled = optimistic !== null ? optimistic : (serverStatus?.enabled ?? true)
  const statusLabel = (status: StatusItem): string => {
    const { enabled_variant_count: on, total_variant_count: total } = status
    if (total === 0) return status.enabled ? t("enabled") : t("disabled")
    if (on === 0) return t("disabled")
    if (on === total) return t("enabled")
    return t("partial", { enabled: on, total })
  }
  const label = serverStatus
    ? statusLabel(serverStatus)
    : isEnabled
      ? t("enabled")
      : t("disabled")

  const toggle = async () => {
    const next = !isEnabled
    setOptimistic(next)
    try {
      const res = await upsertPolicy({
        variables: {
          input: {
            product_id: product.id,
            enabled: next,
          },
        },
      })
      if (!res.data?.upsertNegotiationPolicy?.success) {
        throw new Error(t("updateFailed"))
      }
      sileo.success({
        title: next ? t("enabledToast") : t("disabledToast"),
      })
    } catch (err) {
      setOptimistic(null)
      sileo.error({
        title: t("toggleFailed"),
        description: err instanceof Error ? err.message : t("tryAgain"),
      })
    }
  }

  return (
    <button
      type="button"
      disabled={mutating}
      onClick={() => void toggle()}
      title={isEnabled ? t("clickToDisable") : t("clickToEnable")}
      aria-label={t("toggle", {
        name: typeof product.name === "string" ? product.name : product.slug,
      })}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        isEnabled
          ? "bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-400/15 dark:text-emerald-300"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400",
        mutating && "opacity-70 cursor-wait",
      )}
    >
      {mutating ? (
        <LoaderCircleIcon className="size-3 animate-spin" />
      ) : (
        <span
          className={cn(
            "size-1.5 rounded-full",
            isEnabled ? "bg-emerald-500" : "bg-zinc-400",
          )}
        />
      )}
      <span>{label}</span>
    </button>
  )
}
