"use client"

import { useCallback, useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@repo/ui/lib/utils"

import { LOCALE_DIRECTIONS, resolveLocale } from "@/shared/i18n/config"
import { ProductCard } from "@/features/catalog/components/product-card"
import { ProductCardSkeleton } from "@/features/catalog/components/product-grid"
import type { ProductCard as ProductCardData } from "@/features/catalog/lib/product"

/**
 * A horizontal shelf of products.
 *
 * A rail rather than a grid for the two sections where the *order* is the
 * message — "most looked at" and "marked down" are rankings, and a grid that
 * wraps turns a ranking into a blob. It also lets the front page show eight
 * products in the vertical space a grid spends on four.
 *
 * **The RTL detail is the whole reason this is a component and not a `div`.**
 * Under `dir="rtl"` the modern scroll model puts `scrollLeft` at 0 on the
 * *right* edge and counts **negative** going left, so every naive
 * `scrollLeft > 0` check reports "at the start" forever and every
 * `scrollLeft += x` scrolls backwards. Two rules keep it honest: position is
 * always read through `Math.abs`, and paging is done with `scrollBy`, whose
 * sign is flipped for RTL because its `left` is physical, not logical.
 *
 * There is **no `useEffect`**. Measuring on mount and on resize happens in a
 * ref callback — it runs at commit with the node in hand, returns its own
 * cleanup, and so does not trip the `set-state-in-effect` rule the repo
 * enforces. The ref is written there and read only inside event handlers, never
 * during render.
 */

interface RailMetrics {
  /** 0-1 through the scrollable distance. */
  progress: number
  /** Visible fraction of the track, for the thumb's width. */
  ratio: number
  atStart: boolean
  atEnd: boolean
  /** False when everything fits — the controls then have nothing to do. */
  scrollable: boolean
}

const INITIAL: RailMetrics = {
  progress: 0,
  ratio: 1,
  atStart: true,
  atEnd: true,
  scrollable: false,
}

export function ProductRail({
  products,
  loading,
  skeletonCount = 6,
  className,
}: {
  products: ProductCardData[]
  loading?: boolean
  skeletonCount?: number
  className?: string
}) {
  const t = useTranslations("home")
  const rtl = LOCALE_DIRECTIONS[resolveLocale(useLocale())] === "rtl"

  const railRef = useRef<HTMLDivElement | null>(null)
  const [metrics, setMetrics] = useState<RailMetrics>(INITIAL)

  const measure = useCallback((el: HTMLDivElement) => {
    const max = el.scrollWidth - el.clientWidth
    if (max <= 1) {
      setMetrics(INITIAL)
      return
    }
    // Negative under RTL — see the component note.
    const pos = Math.abs(el.scrollLeft)
    setMetrics({
      progress: Math.min(1, Math.max(0, pos / max)),
      ratio: Math.min(1, el.clientWidth / el.scrollWidth),
      atStart: pos <= 1,
      atEnd: pos >= max - 1,
      scrollable: true,
    })
  }, [])

  const attach = useCallback(
    (el: HTMLDivElement | null) => {
      railRef.current = el
      if (!el) return

      measure(el)
      const observer = new ResizeObserver(() => measure(el))
      observer.observe(el)

      // React 19 calls this on detach. Without it the observer would outlive
      // a locale switch, which remounts the whole subtree.
      return () => {
        observer.disconnect()
        railRef.current = null
      }
    },
    [measure],
  )

  const page = useCallback(
    (direction: "prev" | "next") => {
      const el = railRef.current
      if (!el) return
      // A little under a full viewport, so the card the shopper was looking at
      // stays partly visible and the rail reads as continuous.
      const step = el.clientWidth * 0.85
      const forward = direction === "next"
      el.scrollBy({ left: (forward !== rtl ? 1 : -1) * step, behavior: "smooth" })
    },
    [rtl],
  )

  const showControls = metrics.scrollable && !loading

  return (
    <div className={cn("relative", className)}>
      <div
        ref={attach}
        onScroll={(event) => measure(event.currentTarget)}
        role="region"
        aria-label={t("railScroll")}
        // A scroll container is only reachable by keyboard when it is
        // focusable; without this the arrow keys never get to it.
        tabIndex={0}
        className="snap-rail no-scrollbar -mx-4 gap-5 px-4 pb-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:-mx-6 sm:gap-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        {loading && products.length === 0
          ? Array.from({ length: skeletonCount }, (_, index) => (
              <RailSkeleton key={index} />
            ))
          : products.map((product) => (
              <div
                key={product.id}
                className="snap-rail-item w-[15rem] sm:w-[16rem] lg:w-[17rem]"
              >
                <ProductCard product={product} className="h-full" />
              </div>
            ))}
      </div>

      {showControls && (
        <div className="mt-6 flex items-center gap-4">
          {/* The progress hairline replaces the usual dot row. Dots claim the
              rail has N discrete pages, which a free-scrolling snap rail does
              not — a bar is the honest shape for "how far along am I". */}
          <div
            aria-hidden
            className="h-px flex-1 overflow-hidden bg-shop-hairline"
          >
            <div
              className="h-full bg-shop-accent transition-[width,margin] duration-150"
              style={{
                width: `${Math.max(metrics.ratio, 0.12) * 100}%`,
                marginInlineStart: `${metrics.progress * (1 - Math.max(metrics.ratio, 0.12)) * 100}%`,
              }}
            />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <RailButton
              label={t("railPrev")}
              disabled={metrics.atStart}
              onClick={() => page("prev")}
            >
              <ChevronLeft className="size-4 rtl:-scale-x-100" />
            </RailButton>
            <RailButton
              label={t("railNext")}
              disabled={metrics.atEnd}
              onClick={() => page("next")}
            >
              <ChevronRight className="size-4 rtl:-scale-x-100" />
            </RailButton>
          </div>
        </div>
      )}
    </div>
  )
}

function RailButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-9 place-items-center rounded-full border border-shop-hairline bg-card text-foreground transition-colors hover:border-shop-accent hover:text-shop-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  )
}

/**
 * The catalogue's own tile skeleton in a rail slot, so nothing shifts when the
 * data lands — and so the rail cannot keep drawing last season's tile after
 * the card changes shape.
 */
function RailSkeleton() {
  return (
    <div className="snap-rail-item w-[15rem] sm:w-[16rem] lg:w-[17rem]">
      <ProductCardSkeleton />
    </div>
  )
}
