"use client"

import { useFormatter, useTranslations } from "next-intl"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover"
import { cn } from "@/shared/lib/utils"
import type { AbandonedCart } from "@/features/abandoned-carts/types"
import {
  REMINDER_STATUS_DOT,
  statusTimeline,
} from "@/features/abandoned-carts/lib/status"

const STATUS_TONE: Record<AbandonedCart["reminder_status"], string> = {
  READY: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  SENT: "bg-muted text-muted-foreground",
  RETURNED: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  FAILED: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
  COMPLETED:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
}

export function AbandonedCartsStatusPopover({ cart }: { cart: AbandonedCart }) {
  const t = useTranslations("abandonedCarts")
  const format = useFormatter()
  const channels = cart.last_reminder_channels
  const sent = channels?.sent ?? []
  const failed = channels?.failed ?? []
  const events = statusTimeline(cart)

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium",
              STATUS_TONE[cart.reminder_status],
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                REMINDER_STATUS_DOT[cart.reminder_status],
              )}
            />
            {t(`status.${cart.reminder_status}`)}
          </button>
        }
      />
      <PopoverContent align="start" className="w-72 p-3">
        <p className="text-sm font-medium">{t("statusDetail.title")}</p>
        {sent.length > 0 || failed.length > 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            {sent.length > 0
              ? t("statusDetail.sentOn", {
                  channels: sent.map((c) => t(`channels.${c}`)).join(", "),
                })
              : null}
            {failed.length > 0
              ? ` ${t("statusDetail.failedOn", {
                  channels: failed.map((c) => t(`channels.${c}`)).join(", "),
                })}`
              : null}
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            {t("statusDetail.noSend")}
          </p>
        )}
        <ol className="mt-3 space-y-2">
          {events.map((event) => (
            <li key={`${event.key}-${event.at}`} className="flex gap-2 text-xs">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-foreground/40" />
              <div>
                <div className="font-medium">{t(`timeline.${event.key}`)}</div>
                <div className="text-muted-foreground">
                  {format.dateTime(new Date(event.at), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </PopoverContent>
    </Popover>
  )
}
