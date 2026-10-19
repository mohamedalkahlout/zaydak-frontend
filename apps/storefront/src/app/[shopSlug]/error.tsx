"use client"

import { useEffect } from "react"
import Link from "next/link"
import * as Sentry from "@sentry/nextjs"
import { AlertTriangle, Home, RotateCcw } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@repo/ui/components/button"
import { useShop } from "@/features/shop/shop-context"
import { shopHomeHref } from "@/shared/lib/tenant"

export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("error")
  const { base, shop, slug } = useShop()

  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: "shop-error", shop: slug },
    })
  }, [error, slug])

  return (
    <div className="shop-container flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <div className="w-full max-w-md">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-7" />
        </div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("description")}</p>
        {error.digest ? (
          <p className="mt-1 font-mono text-xs text-muted-foreground/60">
            {t("errorId", { digest: error.digest })}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            onClick={() => reset()}
            className="w-full gap-2 rounded-full bg-shop-accent px-6 text-shop-accent-foreground hover:bg-shop-accent/90 sm:w-auto"
            size="lg"
          >
            <RotateCcw className="size-4" />
            {t("tryAgain")}
          </Button>
          <Button
            variant="outline"
            render={<Link href={shopHomeHref(base)} />}
            className="w-full gap-2 rounded-full border-shop-hairline px-6 sm:w-auto"
            size="lg"
          >
            <Home className="size-4" />
            {t("returnHome")}
          </Button>
        </div>

        {shop?.name ? (
          <p className="mt-8 text-xs text-muted-foreground/50">{shop.name}</p>
        ) : null}
      </div>
    </div>
  )
}
