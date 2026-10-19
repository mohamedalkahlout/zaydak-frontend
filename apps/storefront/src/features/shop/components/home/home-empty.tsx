"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { PackageOpen } from "lucide-react"

import { Button } from "@repo/ui/components/button"

import { useShop } from "../../shop-context"
import { marketplaceHref } from "@/shared/lib/site-url"

/**
 * What a shop that has published nothing yet shows below its hero.
 *
 * It replaces the merchandising sections rather than letting each of them
 * render its own "nothing here" panel — four empty states stacked down a page
 * is how a working store looks broken. The hero stays, because the shop is
 * genuinely open and its name, description and contact details are still worth
 * showing.
 */
export function HomeEmpty() {
  const t = useTranslations("home")
  const { slug, shop, mode } = useShop()

  return (
    <div className="relative overflow-hidden rounded-3xl bg-card px-6 py-16 text-center ring-1 ring-shop-hairline sm:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,var(--shop-accent-soft)_0%,transparent_58%)]"
      />

      <span
        aria-hidden
        className="relative mx-auto grid size-14 place-items-center rounded-full bg-shop-accent-soft text-shop-accent"
      >
        <PackageOpen className="size-6" strokeWidth={1.5} />
      </span>

      <h2 className="relative mt-6 font-heading text-shop-title font-semibold tracking-tight">
        {t("emptyTitle")}
      </h2>

      <p className="relative mx-auto mt-3 max-w-md text-shop-body leading-relaxed text-muted-foreground">
        {t("emptyBody", { shop: shop?.name ?? slug })}
      </p>

      <Button
        variant="outline"
        className="relative mt-8 border-shop-hairline bg-card hover:border-shop-accent hover:text-shop-accent"
        nativeButton={false}
        render={<Link href={marketplaceHref(mode)} />}
      >
        {t("emptyAction")}
      </Button>
    </div>
  )
}
