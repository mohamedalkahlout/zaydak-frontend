"use client"

import Image from "@/shared/components/app-image"
import Link from "next/link"
import { Suspense, useDeferredValue, useState } from "react"
import { useSuspenseQuery } from "@apollo/client/react"
import { useTranslations } from "next-intl"
import { Search, Store } from "lucide-react"

import { Input } from "@repo/ui/components/input"

import { PUBLIC_SHOPS, directoryVariables } from "../api"
import { CloudShaderHeroDemo } from "./cloud-shader-hero"
import { CommunityOrbitSection } from "./community-orbit-section"
import { DirectoryHeader } from "./directory-header"

/**
 * The root `/` — every open storefront.
 *
 * The one route in the app with **no shop scope**, and it needs no code to say
 * so: `currentShopSlug()` derives `X-SHOP` from the first path segment, and `/`
 * has none, so the shop link sends no header and `shops` returns the whole
 * directory. That is also why `shops` is the only list query this app calls
 * that is not behind `RequireShopGuard` — and the one preload that passes no
 * slug to `storefrontContext`.
 *
 * The list is preloaded on the server and read back with `useSuspenseQuery`, so
 * the marketplace's front door arrives as a page of shops rather than as six
 * grey rectangles. Search is the only thing that moves after that, and it is
 * **deferred rather than transitioned**: `search` drives the input so typing
 * stays immediate, `deferredSearch` drives the query, and React keeps the
 * previous results on screen while the next set resolves. Wrapping `setSearch`
 * in a transition instead would have made the input itself lag a keystroke
 * behind the typing, which is the one thing a search box may not do.
 *
 * `CloudShaderHeroDemo` opens the page. It moved here from the shop home,
 * where it was the same picture on all of them and said nothing about the one
 * a visitor had already chosen; the front door is the one screen with no shop
 * to describe, so a generic sky is the right thing on it. It carries the
 * page's `h1`, which is why the directory's own title below it is an `h2` — the
 * two are one hero and the label on the list under it, not two competing page
 * titles. Layout and sky colours match the Aceternity demo; copy and CTAs are
 * Zaydak / `#shops`.
 *
 * `CommunityOrbitSection` sits on white paper directly under the sky — shop
 * logos and live directory counts in an orbit band, then the searchable list.
 * It reuses `PUBLIC_SHOPS` rather than inventing marks.
 *
 * `DirectoryHeader` is `fixed`, and **nothing here reserves its height**: the
 * hero is the first thing in the document and the sky is drawn behind the slabs
 * on purpose, which is the arrangement the hero was built for and the reason
 * its headline carries `pt-28`. Anything put above the hero has to take that
 * padding over, or the bar lands on the headline.
 *
 * The two anchor ids the bar's entries point at — `top` and `shops` — are here
 * rather than in the header, because the header is a bar and these are the
 * page's own landmarks. `scroll-mt-16` on the list clears the fixed bar; a hash
 * jump without it puts the heading underneath the slabs.
 */
export function ShopDirectory() {
  const t = useTranslations("landing")
  const [search, setSearch] = useState("")
  const deferredSearch = useDeferredValue(search)

  return (
    <main className="flex-1">
      <DirectoryHeader />

      <div id="top">
        <CloudShaderHeroDemo />
      </div>

      <CommunityOrbitSection />

      <div id="shops" className="shop-container scroll-mt-16 py-14">
        <h2 className="font-heading text-4xl font-semibold tracking-tight text-balance">
          {t("title")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("subtitle")}</p>

        <div className="relative mt-6 max-w-md">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-muted-foreground start-3"
          />
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            className="h-11 ps-9"
          />
        </div>

        <div className="mt-10">
          <Suspense fallback={<DirectoryGridSkeleton />}>
            <ShopList search={deferredSearch} />
          </Suspense>
        </div>
      </div>
    </main>
  )
}

/**
 * The grid itself, split out for one reason: it is the only part of the page
 * that waits on data.
 *
 * With the query in `ShopDirectory` the whole route suspended, which meant the
 * `Suspense` fallback had to redraw the heading and the search box as grey
 * boxes — the two things that were ready to paint immediately and that a
 * visitor reaches for first. Here the chrome renders straight away and only the
 * results stream in behind the boundary.
 */
function ShopList({ search }: { search: string }) {
  const t = useTranslations("landing")

  const { data, error } = useSuspenseQuery(PUBLIC_SHOPS, {
    variables: directoryVariables(search),
    // Hand the failure back rather than throwing it, exactly as the catalogue
    // does. This read is preloaded, so a throw during the RSC pass reaches the
    // browser as Apollo's contentless "Error from event stream" marker and
    // React re-renders the entire landing page on the client — the heading and
    // the search box included, which are the two things that were ready to
    // paint and that this component was split out to keep out of the boundary.
    errorPolicy: "all",
  })

  const shops = data?.shops.data ?? []

  return (
    <>
      {error ? (
        // Deliberately not `empty`: that string says "no shops match that
        // search", which is a statement about the search rather than about the
        // marketplace, and reads as an empty platform when the API is down.
        <p className="shop-panel px-6 py-16 text-center text-sm text-muted-foreground">
          {t("loadError")}
        </p>
      ) : shops.length === 0 ? (
        <p className="shop-panel px-6 py-16 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((shop) => (
            <li key={shop.id}>
              <Link
                href={`/${shop.slug}`}
                className="shop-panel group block overflow-hidden transition-shadow hover:shadow-[0_1px_2px_rgba(22,19,15,0.06),0_8px_24px_-12px_rgba(22,19,15,0.25)]"
              >
                <div className="relative h-24 bg-secondary">
                  {shop.cover_image?.original ? (
                    <Image
                      src={shop.cover_image.original}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 100vw, 33vw"
                      className="object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex items-start gap-3 p-4">
                  {shop.logo?.thumbnail ?? shop.logo?.original ? (
                    <Image
                      src={
                        (shop.logo?.thumbnail ?? shop.logo?.original) as string
                      }
                      alt=""
                      width={40}
                      height={40}
                      className="-mt-8 size-10 shrink-0 rounded-lg object-cover ring-2 ring-card"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="-mt-8 grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground ring-2 ring-card"
                    >
                      <Store className="size-4" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium">{shop.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("productsCount", { count: shop.products_count ?? 0 })}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/**
 * Six cards' worth of ground, at the height a real card settles at, so the
 * page below the search box does not jump when the shops arrive.
 */
function DirectoryGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="h-40 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  )
}
