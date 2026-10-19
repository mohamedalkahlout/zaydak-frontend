"use client"

import { useCallback, useMemo, useRef, useState, useTransition } from "react"
import { useSuspenseQuery } from "@apollo/client/react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Loader2, SlidersHorizontal } from "lucide-react"
import InfiniteScroll from "react-infinite-scroll-component"

import { Button } from "@repo/ui/components/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/components/sheet"

import { STOREFRONT_PRODUCTS } from "../api"
import {
  SORT_OPTIONS,
  activeFilterCount,
  catalogHasMore,
  readFilters,
  toProductFilterInput,
  writeFilters,
  type CatalogFilters as Filters,
  type SortOption,
} from "../lib/filters"
import { CatalogFilters } from "./catalog-filters"
import { ProductGrid } from "./product-grid"

/**
 * The catalogue.
 *
 * All filter state is the URL. `readFilters(useSearchParams())` is the only
 * source, and every control writes back through `router.replace`, so there is
 * nothing to keep in sync and nothing that can disagree with the address bar.
 * `replace` rather than `push` — ticking four boxes should not cost four
 * presses of the back button. Page number is not in the URL: the grid scrolls
 * infinitely via `react-infinite-scroll-component` and later pages arrive
 * through Apollo `fetchMore`.
 *
 * That the filters live in the URL is also what lets the **server** render this
 * page: `app/[shopSlug]/products/page.tsx` reads the same query string through
 * the same `readFilters`, preloads the first page of products, and
 * `useSuspenseQuery` here resolves against it. A shared filtered link therefore
 * arrives as finished HTML rather than as a grid of skeletons.
 *
 * **The grid no longer collapses between filter changes, and no `loading` flag
 * says so.** Changing a filter navigates, and an App Router navigation is a
 * React transition — so when the new variables suspend, React keeps the
 * previous page on screen until the next one is ready.
 */
export function CatalogPage() {
  const t = useTranslations("catalog")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [, startTransition] = useTransition()
  const inFlightRef = useRef(false)

  const filters = useMemo(
    () => readFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  )

  // Reset the "no more pages" latch whenever the filter URL changes so a new
  // query can scroll again; adjust-during-render avoids a set-state-in-effect.
  const filterKey = writeFilters(filters)
  const [exhaustedKey, setExhaustedKey] = useState(filterKey)
  const [exhausted, setExhausted] = useState(false)
  if (exhaustedKey !== filterKey) {
    setExhaustedKey(filterKey)
    setExhausted(false)
  }

  const navigate = useCallback(
    (next: Filters) => {
      const url = `${pathname}${writeFilters(next)}`
      router.replace(url, { scroll: false })
    },
    [pathname, router],
  )

  const update = useCallback(
    (patch: Partial<Filters>) => navigate({ ...filters, ...patch }),
    [filters, navigate],
  )

  const variables = useMemo(
    () => ({ filters: toProductFilterInput(filters, 1) }),
    [filters],
  )

  const { data, error, fetchMore } = useSuspenseQuery(STOREFRONT_PRODUCTS, {
    variables,
    // Return a failed read instead of throwing it: the catalogue renders its
    // own "could not load" panel below, and an empty shop is not an error
    // boundary's business.
    errorPolicy: "all",
  })

  const products = data?.storefrontProducts.data ?? []
  const meta = data?.storefrontProducts.meta
  const active = activeFilterCount(filters)
  const hasMore =
    !exhausted && catalogHasMore(meta ?? undefined, products.length)

  const loadMore = useCallback(() => {
    if (
      !meta ||
      inFlightRef.current ||
      exhausted ||
      !catalogHasMore(meta, products.length)
    ) {
      return
    }
    inFlightRef.current = true
    const previousLength = products.length
    const nextPage = meta.page + 1
    startTransition(() => {
      void fetchMore({
        variables: { filters: toProductFilterInput(filters, nextPage) },
      })
        .then((result) => {
          const nextMeta = result.data?.storefrontProducts?.meta
          const nextLength =
            result.data?.storefrontProducts?.data?.length ?? previousLength
          // Stop when the server says we are on the last page, or when a
          // fetch added nothing (empty page / full dedupe). Without this, a
          // short list that never leaves the viewport keeps requesting the
          // same next page while `meta.page` fails to advance.
          if (
            !nextMeta ||
            nextMeta.page >= nextMeta.total_pages ||
            nextLength <= previousLength
          ) {
            setExhausted(true)
          }
        })
        .catch(() => {
          // Keep what is already on screen; the shopper can scroll again.
        })
        .finally(() => {
          inFlightRef.current = false
        })
    })
  }, [
    exhausted,
    fetchMore,
    filters,
    meta,
    products.length,
    startTransition,
  ])

  const clearFilters = useCallback(
    () =>
      update({
        minPrice: null,
        maxPrice: null,
        inStockOnly: false,
        tagIds: [],
        collectionIds: [],
      }),
    [update],
  )

  return (
    <div className="shop-container py-10 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <h1 className="font-heading text-shop-title font-semibold tracking-tight text-balance">
          {filters.search || t("title")}
        </h1>
        <p className="mt-2 text-shop-body text-muted-foreground">
          {t("resultCount", { count: meta?.total ?? 0 })}
        </p>
      </header>

      <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-24 rounded-2xl bg-card p-5 ring-1 ring-shop-hairline">
            <CatalogFilters
              filters={filters}
              onChange={update}
              onClear={clearFilters}
            />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-5 flex items-center gap-3">
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-shop-hairline bg-card lg:hidden"
                  >
                    <SlidersHorizontal />
                    {t("filters")}
                    {active > 0 && (
                      <span className="ms-1 rounded-full bg-shop-accent px-1.5 text-[0.625rem] font-semibold text-shop-accent-foreground tabular-nums">
                        {active}
                      </span>
                    )}
                  </Button>
                }
              />
              <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>{t("filters")}</SheetTitle>
                </SheetHeader>
                <div className="px-4 pb-6">
                  <CatalogFilters
                    filters={filters}
                    onChange={update}
                    onClear={clearFilters}
                  />
                  <Button
                    className="mt-6 w-full bg-shop-accent text-shop-accent-foreground hover:bg-shop-accent/90"
                    onClick={() => setFiltersOpen(false)}
                  >
                    {t("applyFilters")}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <div className="ms-auto">
              <Select
                value={filters.sort}
                onValueChange={(value) => {
                  // `Select` hands back `string | null` (null when cleared);
                  // a null here would ask the API to sort by nothing.
                  if (value) update({ sort: value as SortOption })
                }}
              >
                <SelectTrigger
                  className="w-48 border-shop-hairline bg-card"
                  aria-label={t("sort")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(SORT_LABEL_KEY[option])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error ? (
            <div className="rounded-3xl bg-card px-6 py-16 text-center ring-1 ring-shop-hairline">
              <p className="text-shop-body text-muted-foreground">
                {t("loadError")}
              </p>
            </div>
          ) : (
            <InfiniteScroll
              dataLength={products.length}
              next={loadMore}
              hasMore={hasMore}
              // Single child (`ProductGrid`), not an array of tiles.
              hasChildren
              loader={
                <div
                  className="mt-10 flex min-h-10 items-center justify-center"
                  aria-busy
                  aria-live="polite"
                >
                  <Loader2
                    className="size-5 animate-spin text-muted-foreground"
                    aria-hidden
                  />
                  <span className="sr-only">{t("loadingMore")}</span>
                </div>
              }
              endMessage={
                products.length > 0 ? (
                  <p className="mt-10 text-center text-sm text-muted-foreground">
                    {t("endOfList")}
                  </p>
                ) : null
              }
            >
              <ProductGrid
                products={products}
                className="gap-5 sm:gap-6 lg:grid-cols-3"
              />
            </InfiniteScroll>
          )}
        </div>
      </div>
    </div>
  )
}

const SORT_LABEL_KEY = {
  NEWEST: "sortNewest",
  OLDEST: "sortOldest",
  PRICE_LOW: "sortPriceLow",
  PRICE_HIGH: "sortPriceHigh",
  MOST_VIEWED: "sortPopular",
} as const satisfies Record<SortOption, string>
