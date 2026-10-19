"use client"

import { useSuspenseQuery } from "@apollo/client/react"
import { useLocale, useTranslations } from "next-intl"

import {
  STOREFRONT_PRODUCTS,
  STOREFRONT_RECOMMENDATIONS,
} from "@/features/catalog/api"
import { ProductGrid } from "@/features/catalog/components/product-grid"
import {
  HOME_FACETS,
  HOME_POPULAR_VARIABLES,
  HOME_RECENT_VARIABLES,
  HOME_TRENDING_VARIABLES,
} from "../api"
import { useShop } from "../shop-context"
import { CollectionBento } from "./home/collection-bento"
import { CollectionTicker } from "./home/collection-ticker"
import { HomeEmpty } from "./home/home-empty"
import { HomeFacets } from "./home/home-facets"
import { HomeHero } from "./home/home-hero"
import { HomeStory, hasStory } from "./home/home-story"
import { HomeValues } from "./home/home-values"
import { MIN_DEALS, markdowns } from "./home/lib/deals"
import { buildHeroShowcase } from "./home/lib/hero-showcase"
import { ProductRail } from "./home/product-rail"
import { SectionHeading } from "./home/section-heading"

/**
 * The shop's front page.
 *
 * It is **composed from what the shop actually has**, not a fixed template with
 * holes in it. Every section below the hero asks the same question — is there
 * enough here to be worth a heading? — and removes itself when the answer is
 * no. That is what lets one component serve a shop with four products and no
 * collections and a shop with six hundred and twelve collections, without
 * either one looking like a half-filled form.
 *
 * The section indices are therefore **derived from which sections survived**
 * rather than hard-coded. A numbered page that jumps from 01 to 03 because the
 * shop has no collections advertises the gap; numbering what is actually on
 * screen is the whole reason `order` exists.
 *
 * **Two** product queries serve three sections. `MOST_VIEWED` and `NEWEST` are
 * genuinely different questions and need their own round trips; the markdown
 * row does not, because the API has no "on sale" predicate at all (see
 * `home/lib/deals.ts`) and has to be selected on the client anyway. So the
 * newest query asks for a wide page, the grid renders its first `NEWEST_COUNT`
 * and the markdown rail is picked out of the same rows — a third request for
 * products this component already has in memory would buy nothing.
 *
 * **All three queries are preloaded by the page** (`app/[shopSlug]/page.tsx`)
 * and read back here with `useSuspenseQuery`, so this component never renders a
 * loading state at all — there is no `loading` branch below because by the time
 * it runs the rows exist. That is also why the section list can be computed
 * from what the shop actually has: with `useQuery` the first render had no
 * products yet, so every "is there enough here for a heading?" test had to
 * treat "still loading" as "yes" and the page rearranged itself once the data
 * landed.
 */

const NEWEST_COUNT = 8
const DEALS_SHOWN = 10

export function ShopHome() {
  const t = useTranslations("home")
  const tShop = useTranslations("shop")
  const locale = useLocale()
  const { base, shop } = useShop()

  // `errorPolicy: "all"` on all four, for the same reason it is on
  // `ShopProvider` and the catalogue: every rail below already treats an empty
  // list as a real answer and removes itself, so a failed read should cost this
  // page that one section and nothing else. Without it a single failing query
  // throws during the RSC pass, and because these are preloaded the throw
  // reaches the browser as Apollo's contentless "Error from event stream"
  // marker — React drops the whole home page to client rendering over one rail.
  const facets = useSuspenseQuery(HOME_FACETS, {
    fetchPolicy: "cache-first",
    errorPolicy: "all",
  })

  const popular = useSuspenseQuery(STOREFRONT_PRODUCTS, {
    variables: HOME_POPULAR_VARIABLES,
    errorPolicy: "all",
  })

  const recent = useSuspenseQuery(STOREFRONT_PRODUCTS, {
    variables: HOME_RECENT_VARIABLES,
    errorPolicy: "all",
  })

  const trending = useSuspenseQuery(STOREFRONT_RECOMMENDATIONS, {
    variables: HOME_TRENDING_VARIABLES,
    errorPolicy: "all",
  })

  const collections = facets.data?.collections.data ?? []
  const tags = facets.data?.tags.data ?? []
  // Cap to the requested limit: the catalogue's infinite-scroll merge writes
  // into the same `storefrontProducts` cache entry when filters match (empty
  // catalogue ≡ newest-24), and a rail that drew every appended page would
  // quietly grow past its design.
  const popularProducts = (
    popular.data?.storefrontProducts.data ?? []
  ).slice(0, HOME_POPULAR_VARIABLES.filters.limit)
  const recentProducts = (
    recent.data?.storefrontProducts.data ?? []
  ).slice(0, HOME_RECENT_VARIABLES.filters.limit)
  const trendingProducts =
    trending.data?.storefrontRecommendations.data ?? []
  const newestProducts = recentProducts.slice(0, NEWEST_COUNT)
  const deals = markdowns(recentProducts, DEALS_SHOWN)

  const hasCatalog = popularProducts.length > 0 || newestProducts.length > 0

  const showPopular = popularProducts.length > 0
  // Empty is a real answer here rather than a failure: a shop with no traffic
  // in the last seven days has nothing trending, and the server deliberately
  // does not top this rail up from the newest products. So the section removes
  // itself exactly like every other one on this page.
  const showTrending = trendingProducts.length > 0
  const showCollections = collections.length > 0
  const showDeals = deals.length >= MIN_DEALS
  const showStory = hasStory(shop)

  // Sections are numbered in the order they *survive*, so the sequence is
  // always unbroken — a page that jumped from 01 to 03 because the shop has no
  // collections would advertise the gap.
  //
  // It is a derived list rather than a counter incremented down the markup:
  // a `let` reassigned inside render is exactly what the React Compiler's
  // `immutability` rule refuses, and rightly so — the closure can outlive the
  // render that made it. This way the numbering is a pure function of which
  // sections are visible.
  const order = [
    showTrending && "trending",
    showPopular && "popular",
    showCollections && "collections",
    showDeals && "deals",
    "newest",
    "values",
    showStory && "story",
  ].filter(Boolean) as string[]

  const indexOf = (key: string) => order.indexOf(key) + 1

  // Popular first, then newest — the marquee is the shop's face, and what
  // shoppers already open is a better face than what landed yesterday. Built
  // here rather than inside the hero so the hero stays a presentational shell
  // over data this orchestrator already paid for.
  const showcase = buildHeroShowcase(
    [...popularProducts, ...recentProducts],
    {
      base,
      locale,
      cover: shop?.cover_image?.original ?? null,
    },
  )

  return (
    <>
      <HomeHero
        // `meta.total`, not `Shop.products_count` — see the prop's note.
        productCount={recent.data?.storefrontProducts.meta.total ?? 0}
        collectionCount={facets.data?.collections.meta.total ?? 0}
        tagCount={facets.data?.tags.meta.total ?? 0}
        showcase={showcase}
      />

      <HomeFacets collections={collections} tags={tags} />

      {!hasCatalog ? (
        <div className="shop-container py-14">
          <HomeEmpty />
        </div>
      ) : (
        <>
          <div className="shop-container flex flex-col gap-16 py-14 sm:gap-20">
            {showTrending && (
              // First, and above "most looked at", because the two answer
              // different questions and this is the more perishable one:
              // `MOST_VIEWED` is a lifetime counter on the product row, so a
              // product that did well a year ago outranks one everybody is
              // opening today, forever. This reads seven days of behaviour
              // events, so it moves.
              //
              // No `href`: there is no catalogue sort that reproduces it, and a
              // "view all" landing on something else is worse than none.
              <section>
                <SectionHeading
                  index={indexOf("trending")}
                  title={t("sectionTrending")}
                  note={t("sectionTrendingNote")}
                />
                <ProductRail className="mt-8" products={trendingProducts} />
              </section>
            )}

            {showPopular && (
              <section>
                <SectionHeading
                  index={indexOf("popular")}
                  title={t("sectionMostLoved")}
                  note={t("sectionMostLovedNote")}
                  href={`${base}/products?sort=MOST_VIEWED`}
                  actionLabel={tShop("viewAll")}
                />
                <ProductRail className="mt-8" products={popularProducts} />
              </section>
            )}

            {showCollections && (
              <section>
                <SectionHeading
                  index={indexOf("collections")}
                  title={t("sectionCollections")}
                  note={t("sectionCollectionsNote")}
                />
                <div className="mt-8">
                  <CollectionBento collections={collections} />
                </div>
              </section>
            )}
          </div>

          {/* Full-bleed, so it breaks the column and marks the halfway point of
              the page rather than sitting inside it as another block. */}
          <CollectionTicker collections={collections} tags={tags} />

          <div className="shop-container flex flex-col gap-16 py-14 sm:gap-20">
            {showDeals && (
              <section>
                <SectionHeading
                  index={indexOf("deals")}
                  title={t("sectionDeals")}
                  note={t("sectionDealsNote")}
                />
                <ProductRail className="mt-8" products={deals} />
              </section>
            )}

            <section>
              <SectionHeading
                index={indexOf("newest")}
                title={t("sectionNew")}
                note={t("sectionNewNote")}
                href={`${base}/products`}
                actionLabel={tShop("viewAll")}
              />
              {/* Wrapped rather than passed `mt-8`: `ProductGrid` puts its
                  `className` on the grid element, which the empty and loading
                  branches do not render. */}
              <div className="mt-8">
                <ProductGrid
                  products={newestProducts}
                  emptyTitle={t("emptyTitle")}
                  emptyBody=""
                />
              </div>
            </section>

            <section>
              <SectionHeading index={indexOf("values")} title={t("valuesTitle")} />
              <div className="mt-8">
                <HomeValues />
              </div>
            </section>

            {showStory && (
              <section>
                <SectionHeading index={indexOf("story")} title={t("sectionStory")} />
                <div className="mt-8">
                  <HomeStory />
                </div>
              </section>
            )}
          </div>
        </>
      )}
    </>
  )
}
