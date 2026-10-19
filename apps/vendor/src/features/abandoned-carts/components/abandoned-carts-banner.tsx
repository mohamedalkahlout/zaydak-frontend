"use client"

import { useCallback, useState, useSyncExternalStore } from "react"
import { useTranslations } from "next-intl"
import { XIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { cn } from "@/shared/lib/utils"

const STORAGE_KEY = "vendor.abandoned-carts.promo-dismissed"
const EVENT = "vendor:abandoned-carts-promo"

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange)
  window.addEventListener(EVENT, onStoreChange)
  return () => {
    window.removeEventListener("storage", onStoreChange)
    window.removeEventListener(EVENT, onStoreChange)
  }
}

function getSnapshot() {
  return window.localStorage.getItem(STORAGE_KEY) === "1"
}

function getServerSnapshot() {
  return false
}

export function AbandonedCartsBanner() {
  const t = useTranslations("abandonedCarts")
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [expanded, setExpanded] = useState(false)

  const dismiss = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, "1")
    window.dispatchEvent(new Event(EVENT))
  }, [])

  if (dismissed) return null

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card",
        "grid gap-4 p-4 sm:grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_auto] sm:items-center sm:p-5",
      )}
    >
      <BasketArt className="mx-auto size-24 sm:mx-0 sm:size-[7.5rem]" />
      <div className="min-w-0">
        <h2 className="font-heading text-base font-semibold tracking-tight">
          {t("banner.title")}
        </h2>
        <p className="mt-1 text-sm font-medium text-foreground">
          {t("banner.headline")}
        </p>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {t("banner.body")}
        </p>
        {expanded ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t("banner.more")}
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setExpanded((open) => !open)}
        >
          {expanded ? t("banner.less") : t("banner.learnMore")}
        </Button>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute top-3 end-3 sm:static sm:self-start"
        onClick={dismiss}
        aria-label={t("banner.dismiss")}
      >
        <XIcon className="size-4" />
      </Button>
    </section>
  )
}

function BasketArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true">
      <rect width="120" height="120" rx="24" className="fill-muted" />
      <ellipse cx="60" cy="92" rx="34" ry="8" className="fill-foreground/10" />
      <path
        d="M28 48h64l-6 38a10 10 0 0 1-10 8H44a10 10 0 0 1-10-8L28 48Z"
        className="fill-background stroke-foreground/20"
        strokeWidth="1.5"
      />
      <path
        d="M36 48c0-14 10-24 24-24s24 10 24 24"
        className="fill-none stroke-foreground/35"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <rect
        x="44"
        y="58"
        width="18"
        height="22"
        rx="3"
        className="fill-primary/25 stroke-primary/40"
        strokeWidth="1"
      />
      <rect
        x="64"
        y="54"
        width="16"
        height="26"
        rx="3"
        className="fill-amber-400/40 stroke-amber-700/30"
        strokeWidth="1"
      />
    </svg>
  )
}
