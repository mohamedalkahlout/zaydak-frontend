"use client"

import { useEffect } from "react"
import { useTranslations } from "next-intl"
import { AlertTriangleIcon, RotateCwIcon } from "lucide-react"
import { Button } from "@repo/ui/components/button"

export default function SegmentsError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  const t = useTranslations("errorPages")

  useEffect(() => {
    console.error("[segments/error.tsx] caught render failure", {
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    })
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card px-6 py-16 text-center">
      <AlertTriangleIcon className="size-8 text-destructive" />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t("failedToLoad.segments")}</h2>
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
