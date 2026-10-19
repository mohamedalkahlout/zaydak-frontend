"use client"

import { useEffect, useRef } from "react"
import { useTranslations } from "next-intl"
import { AlertTriangleIcon, RotateCwIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"
import { isStoreResetError } from "@/shared/lib/apollo/store-reset-error"

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  // Switching shops drops the Apollo cache, and Apollo cancels whatever was
  // still in the link chain with "Store reset while query was in flight". That
  // rejection reaches a page's `useSuspenseQuery` as a throw at render, so it
  // arrives here looking like a page failure when it is really the app's own
  // housekeeping. Retry once: by now the store holds the new slug, so the
  // segment's queries run again correctly scoped.
  const t = useTranslations("errorPages")
  const storeReset = isStoreResetError(error)
  const retried = useRef(false)

  useEffect(() => {
    if (!storeReset || retried.current) return
    retried.current = true
    unstable_retry()
  }, [storeReset, unstable_retry])

  useEffect(() => {
    if (storeReset) return
    console.error("[dashboard/error.tsx] caught render failure", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    })
  }, [error, storeReset])

  // No message for a cancelled fetch — the retry is already on its way, and a
  // flash of "Something went wrong" for a switch that worked is a lie.
  if (storeReset) {
    return (
      <div className="flex flex-1 items-center justify-center py-16">
        <div className="size-8 animate-spin rounded-full border-4 border-muted border-t-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <AlertTriangleIcon className="size-8 text-destructive" />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t("boundary.title")}</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {error.message || t("boundary.unknown")}
        </p>
        {error.digest ? (
          <p className="text-xs text-muted-foreground/70">
            {t("boundary.digest", { digest: error.digest })}
          </p>
        ) : null}
      </div>
      <Button onClick={() => unstable_retry()}>
        <RotateCwIcon className="size-4" />
        {t("boundary.tryAgain")}
      </Button>
    </div>
  )
}
