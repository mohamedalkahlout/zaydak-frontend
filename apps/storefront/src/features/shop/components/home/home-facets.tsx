"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { ArrowRight, Search } from "lucide-react"

import { text } from "@/shared/lib/multilang"
import { useShop } from "../../shop-context"
import type { HomeCollection, HomeTag } from "./types"

/**
 * The search line and the shop's own vocabulary, directly under the hero.
 *
 * Every chip is a **real tag or collection belonging to this shop**, so the row
 * can never offer a category that matches nothing — the failure mode of a
 * hard-coded "Running / Basketball / Training" strip on a marketplace where one
 * shop sells shoes and the next sells honey.
 *
 * Chips are `Link`s to `/[shopSlug]/products?...`, not client-side filters. The
 * catalogue already owns filter state in the URL (`catalog/lib/filters.ts`), so
 * a chip is a shareable address rather than a second, parallel filter model
 * that would drift from it.
 *
 * The search box navigates rather than filtering in place, for the same reason
 * the header's does, and it is repeated here deliberately: the header's is
 * hidden below `lg`, and on a phone the front page would otherwise have no
 * search at all until the shopper opened the drawer.
 */
export function HomeFacets({
  collections,
  tags,
}: {
  collections: HomeCollection[]
  tags: HomeTag[]
}) {
  const t = useTranslations("home")
  const tCatalog = useTranslations("catalog")
  const locale = useLocale()
  const router = useRouter()
  const { base } = useShop()

  const [value, setValue] = useState("")

  const productsBase = `${base}/products`
  const hasChips = collections.length > 0 || tags.length > 0

  return (
    <section className="shop-container pt-10 sm:pt-14">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
        <form
          role="search"
          className="relative w-full lg:max-w-md"
          onSubmit={(event) => {
            event.preventDefault()
            const trimmed = value.trim()
            router.push(
              trimmed
                ? `${productsBase}?search=${encodeURIComponent(trimmed)}`
                : productsBase,
            )
          }}
        >
          <label htmlFor="home-search" className="sr-only">
            {tCatalog("searchPlaceholder")}
          </label>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-muted-foreground start-5"
          />
          <input
            id="home-search"
            type="search"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={tCatalog("searchPlaceholder")}
            className="h-14 w-full rounded-full border border-shop-hairline bg-card ps-12 pe-28 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-shop-accent focus-visible:ring-3 focus-visible:ring-ring/30"
          />
          <button
            type="submit"
            className="absolute top-1/2 h-10 -translate-y-1/2 rounded-full bg-shop-accent px-5 text-xs font-medium text-shop-accent-foreground transition-colors hover:bg-shop-accent/90 focus-visible:ring-3 focus-visible:ring-ring/50 end-2"
          >
            {t("searchAction")}
          </button>
        </form>

        {hasChips && (
          <nav
            aria-label={t("chipsLabel")}
            className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-1 lg:flex-wrap lg:justify-end lg:overflow-visible lg:px-0"
          >
            {collections.map((collection) => (
              <Chip
                key={collection.id}
                href={`${productsBase}?collections=${collection.id}`}
                label={text(collection.name, locale, collection.slug)}
              />
            ))}
            {tags.map((tag) => (
              <Chip
                key={tag.id}
                href={`${productsBase}?tags=${tag.id}`}
                label={text(tag.name, locale, tag.slug)}
              />
            ))}
            <Chip href={productsBase} label={t("chipAll")} trailing />
          </nav>
        )}
      </div>
    </section>
  )
}

function Chip({
  href,
  label,
  trailing,
}: {
  href: string
  label: string
  trailing?: boolean
}) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-shop-hairline bg-card px-4 py-2.5 text-sm whitespace-nowrap transition-colors hover:border-shop-accent hover:text-shop-accent focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {label}
      {trailing && <ArrowRight className="size-3.5 rtl:-scale-x-100" />}
    </Link>
  )
}
