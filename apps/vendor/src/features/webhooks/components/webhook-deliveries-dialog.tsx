"use client"

import { useQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { GET_WEBHOOK_DELIVERIES } from "../api"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@repo/ui/components/dialog"
import { Badge } from "@repo/ui/components/badge"
import { Skeleton } from "@repo/ui/components/skeleton"
import { cn } from "@/shared/lib/utils"

type Delivery = {
  id: string
  event: string
  status: string
  attempts: number
  response_status: number | null
  error_message: string | null
  next_attempt_at: string | null
  succeeded_at: string | null
  created_at: string
}

type DeliveriesResp = {
  webhookDeliveries: { success: boolean; data: Delivery[] }
}

/** How many recent deliveries are fetched — and what the description promises. */
const DELIVERY_LIMIT = 50

// The badge skin per status; the words live under `webhooks.deliveryStatus`.
const STATUS_VARIANTS: Record<
  string,
  "secondary" | "outline" | "destructive" | "default"
> = {
  PENDING: "outline",
  SUCCEEDED: "secondary",
  FAILED: "destructive",
  ABANDONED: "destructive",
}

/**
 * Recent delivery history for one subscription. Read-only — vendors who
 * want to "retry now" can wait for the reaper (15min cadence) or rotate
 * the secret which re-fires any future deliveries with the new sig.
 */
export function WebhookDeliveriesDialog({
  subscription,
  open,
  onOpenChange,
}: {
  subscription: { id: string; url: string }
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations("webhooks")
  const { data, loading, error } = useQuery<DeliveriesResp>(
    GET_WEBHOOK_DELIVERIES,
    {
      variables: { subscription_id: subscription.id, limit: DELIVERY_LIMIT },
      skip: !open,
      fetchPolicy: "cache-and-network",
    },
  )

  const rows = data?.webhookDeliveries?.data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("deliveries.title")}</DialogTitle>
          <DialogDescription className="truncate">
            {t.rich("deliveries.description", {
              count: DELIVERY_LIMIT,
              url: subscription.url,
              mono: (chunks) => (
                <span className="font-mono text-xs">{chunks}</span>
              ),
            })}
          </DialogDescription>
        </DialogHeader>

        {loading && rows.length === 0 && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{error.message}</p>
        )}

        {!loading && rows.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("deliveries.empty")}
          </p>
        )}

        {rows.length > 0 && (
          <div className="max-h-[60vh] overflow-auto rounded-lg ring-1 ring-foreground/10">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-start">{t("deliveries.when")}</th>
                  <th className="px-3 py-2 text-start">{t("deliveries.event")}</th>
                  <th className="px-3 py-2 text-start">{t("deliveries.status")}</th>
                  <th className="px-3 py-2 text-end">{t("deliveries.http")}</th>
                  <th className="px-3 py-2 text-end">{t("deliveries.attempts")}</th>
                  <th className="px-3 py-2 text-start">{t("deliveries.note")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const variant = STATUS_VARIANTS[d.status] ?? "outline"
                  // An unknown status still reads as itself rather than as a key.
                  const statusLabel = t.has(`deliveryStatus.${d.status}`)
                    ? t(`deliveryStatus.${d.status}`)
                    : d.status
                  return (
                    <tr
                      key={d.id}
                      className="border-t border-foreground/5 transition-colors hover:bg-muted/30"
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                        {new Date(d.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-xs" title={d.event}>
                        {t.has(`events.${d.event}`)
                          ? t(`events.${d.event}`)
                          : d.event.toLowerCase()}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={variant}>{statusLabel}</Badge>
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-end font-mono text-xs tabular-nums",
                          d.response_status &&
                            d.response_status >= 200 &&
                            d.response_status < 300
                            ? "text-emerald-700 dark:text-emerald-400"
                            : d.response_status
                              ? "text-destructive"
                              : "text-muted-foreground",
                        )}
                      >
                        {d.response_status ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-end tabular-nums">
                        {d.attempts}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {d.error_message
                          ? d.error_message.slice(0, 80)
                          : d.succeeded_at
                            ? t("deliveries.delivered")
                            : d.next_attempt_at
                              ? t("deliveries.retryAt", {
                                  time: new Date(
                                    d.next_attempt_at,
                                  ).toLocaleTimeString(),
                                })
                              : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
