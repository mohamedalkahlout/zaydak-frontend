"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { Clock, Sparkles } from "lucide-react"
import { useHydrated } from "@repo/ui/hooks/use-hydrated"
import { cn } from "@repo/ui/lib/utils"

function formatCountdown(targetDate: Date): { formatted: string; expired: boolean } {
  const diff = targetDate.getTime() - Date.now()
  if (diff <= 0) {
    return { formatted: "00:00", expired: true }
  }

  const totalSeconds = Math.floor(diff / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const pad = (n: number) => n.toString().padStart(2, "0")

  if (hours > 0) {
    return {
      formatted: `${hours}:${pad(minutes)}:${pad(seconds)}`,
      expired: false,
    }
  }

  return {
    formatted: `${pad(minutes)}:${pad(seconds)}`,
    expired: false,
  }
}

export function NegotiatedOfferBadge({
  expiresAt,
  className,
}: {
  expiresAt?: string | number | Date | null
  className?: string
}) {
  const t = useTranslations("cart")
  const hydrated = useHydrated()
  const targetDate = expiresAt ? new Date(expiresAt) : null
  const isValidDate = targetDate !== null && !isNaN(targetDate.getTime())

  const [, setTick] = useState(0)

  useEffect(() => {
    if (!hydrated || !isValidDate) return

    const interval = setInterval(() => {
      setTick((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [hydrated, isValidDate])

  const countdown = hydrated && isValidDate && targetDate ? formatCountdown(targetDate) : null

  return (
    <div className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      <span className="inline-flex items-center gap-1 rounded-md bg-shop-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-shop-accent">
        <Sparkles className="size-3 shrink-0" />
        <span>{t("negotiatedBadge")}</span>
      </span>

      {countdown && (
        countdown.expired ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive">
            <Clock className="size-3 shrink-0" />
            <span>{t("offerExpired")}</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
            <Clock className="size-3 shrink-0 text-shop-accent" />
            <span>{t("offerExpiresIn", { time: countdown.formatted })}</span>
          </span>
        )
      )}
    </div>
  )
}
