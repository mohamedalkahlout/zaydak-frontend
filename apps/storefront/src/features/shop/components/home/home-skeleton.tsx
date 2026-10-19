import { ProductCardSkeleton } from "@/features/catalog/components/product-grid"

/**
 * What the front page looks like while its three queries are still streaming.
 *
 * Shaped like the live home: centred hero copy over a product marquee strip,
 * then the facets search row, a rail of catalogue tiles, and the newest grid.
 * Matching the settled proportions is what keeps the stream from layout-shifting
 * when the real sections arrive.
 */
export function HomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="">
      <section className="relative flex min-h-[calc(100svh-0.5rem)] w-full flex-col items-center justify-center overflow-hidden px-4 pb-[min(42vh,22rem)] pt-24">
        <div className="flex w-full max-w-3xl flex-col items-center">
          <div className="h-7 w-36 animate-pulse rounded-full bg-shop-accent-soft" />
          <div className="mt-6 h-12 w-2/3 max-w-md animate-pulse rounded-lg bg-muted sm:h-14" />
          <div className="mt-3 h-12 w-1/3 max-w-xs animate-pulse rounded-lg bg-muted sm:h-14" />
          <div className="mt-6 h-4 w-full max-w-md animate-pulse rounded-full bg-muted" />
          <div className="mt-2 h-4 w-2/3 max-w-md animate-pulse rounded-full bg-muted" />
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <div className="h-12 w-36 animate-pulse rounded-full bg-muted" />
            <div className="h-12 w-32 animate-pulse rounded-full bg-muted" />
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-6 flex justify-center gap-3 overflow-hidden px-4 sm:bottom-8">
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              className="aspect-[3/4] h-40 shrink-0 animate-pulse rounded-2xl bg-muted sm:h-52"
              style={{ rotate: `${index % 2 === 0 ? -2 : 4}deg` }}
            />
          ))}
        </div>
      </section>

      <section className="shop-container pt-10 sm:pt-14">
        <div className="h-14 w-full max-w-md animate-pulse rounded-full bg-card ring-1 ring-shop-hairline" />
      </section>

      <div className="shop-container flex flex-col gap-16 py-14 sm:gap-20">
        <section>
          <div className="flex items-center gap-4">
            <div className="h-3 w-6 animate-pulse rounded-full bg-shop-accent-soft" />
            <div className="h-7 w-44 animate-pulse rounded-lg bg-muted" />
            <span aria-hidden className="rule-line" />
          </div>
          <div className="mt-8 flex gap-5 overflow-hidden sm:gap-6">
            {Array.from({ length: 5 }, (_, index) => (
              <div
                key={index}
                className="w-[15rem] shrink-0 sm:w-[16rem] lg:w-[17rem]"
              >
                <ProductCardSkeleton />
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-4">
            <div className="h-3 w-6 animate-pulse rounded-full bg-shop-accent-soft" />
            <div className="h-7 w-44 animate-pulse rounded-lg bg-muted" />
            <span aria-hidden className="rule-line" />
          </div>
          <div className="mt-8 grid grid-cols-2 gap-5 sm:gap-6 lg:grid-cols-4 md:grid-cols-3">
            {Array.from({ length: 8 }, (_, index) => (
              <ProductCardSkeleton key={index} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
