"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"
import { AlertCircle, RotateCcw } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@repo/ui/components/button"

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("error")

  useEffect(() => {
    Sentry.captureException(error, { tags: { boundary: "root-error" } })
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="size-6" />
      </div>
      <h2 className="font-heading text-xl font-semibold tracking-tight">
        {t("title")}
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {t("description")}
      </p>
      {error.digest ? (
        <p className="mt-1 font-mono text-xs text-muted-foreground/60">
          {t("errorId", { digest: error.digest })}
        </p>
      ) : null}
      <Button
        onClick={() => reset()}
        className="mt-6 gap-2 rounded-full px-6"
        size="lg"
      >
        <RotateCcw className="size-4" />
        {t("tryAgain")}
      </Button>
    </div>
  )
}
