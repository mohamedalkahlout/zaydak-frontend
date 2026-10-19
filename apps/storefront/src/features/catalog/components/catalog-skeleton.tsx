import { ProductCardSkeleton } from "./product-grid"

/**
 * The catalogue's shape while its two queries stream in.
 *
 * It mirrors `CatalogPage`'s layout — heading block, filter rail at the same
 * width, grid at the same column counts — because this is what the browser
 * paints in the gap between the shop chrome and the products, and anything
 * whose size changes when the real content lands is a layout shift on the
 * page a shopper spends the most time on.
 *
 * The tiles are the grid's own `ProductCardSkeleton`, so the two can never
 * drift apart.
 */
export function CatalogSkeleton() {
  return (
    <div className="shop-container py-10 sm:py-12" aria-busy="true">
      <header className="mb-8 sm:mb-10">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-muted sm:h-9" />
        <div className="mt-3 h-4 w-28 animate-pulse rounded-full bg-muted" />
      </header>

      <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="flex flex-col gap-0 rounded-2xl bg-card p-5 ring-1 ring-shop-hairline">
            <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
            {Array.from({ length: 3 }, (_, index) => (
              <div
                key={index}
                className="mt-5 flex flex-col gap-2.5 border-t border-shop-hairline pt-5"
              >
                <div className="h-3 w-24 animate-pulse rounded-full bg-shop-accent-soft" />
                <div className="h-3.5 w-full animate-pulse rounded-full bg-muted" />
                <div className="h-3.5 w-4/5 animate-pulse rounded-full bg-muted" />
                <div className="h-3.5 w-2/3 animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-5 flex items-center gap-3">
            <div className="ms-auto h-9 w-48 animate-pulse rounded-md bg-card ring-1 ring-shop-hairline" />
          </div>
          <div className="grid grid-cols-2 gap-5 sm:gap-6 md:grid-cols-3 lg:grid-cols-3">
            {Array.from({ length: 8 }, (_, index) => (
              <ProductCardSkeleton key={index} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
