"use client"

import { useCallback, useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { m } from "motion/react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { LOCALE_DIRECTIONS, resolveLocale } from "@/shared/i18n/config"
import { AssistantProductCard } from "./assistant-product-card"
import type { AssistantProduct } from "../types"

/**
 * What the assistant surfaced, as a titled, pageable row of product cards.
 *
 * **The reason this exists at all is that a phone cannot draw and a browser
 * can.** On WhatsApp the model's sentence *is* the answer; in a panel on the
 * shop's own site, "here are five things" should be five photographs with
 * prices, and prose naming them instead is a worse version of a feature the web
 * has had for thirty years.
 *
 * The cards come from the **tools' own record** of what they returned, not from
 * parsing the reply — reading product names back out of a model's prose is
 * guesswork that fails on the day it matters.
 *
 * ## The heading is the terms that were searched
 *
 * A bare row of cards under a sentence reads as an attachment; the same row
 * under "Jackets · Shorts · Trainers" reads as an answer with a shape. But the
 * heading cannot come from the reply, for exactly the reason the products do
 * not: parsing prose for a title is the same guess.
 *
 * So it is `searched_for` — the arguments the model passed to `search_products`,
 * recorded server-side as it passed them, and only for searches that found
 * something. It cannot describe a product that is not in the row, and it cannot
 * name a term that returned nothing. When the turn surfaced products without
 * searching there is nothing honest to say, so the generic label is used
 * instead of inventing one.
 *
 * ## Why the arrows are the rail's arrows
 *
 * Under `dir="rtl"` the modern scroll model puts `scrollLeft` at 0 on the
 * *right* edge and counts **negative** going left, so every naive
 * `scrollLeft > 0` check reports "at the start" forever and every
 * `scrollLeft += x` scrolls backwards. `ProductRail` exists as a component
 * largely because of that, and this row repeats its two rules rather than
 * rediscovering them: position is read through `Math.abs`, and `scrollBy`'s
 * sign is flipped for RTL because its `left` is physical, not logical.
 *
 * It does not simply *use* `ProductRail`: that one renders full catalogue tiles
 * at 15rem and lays a progress hairline under them, which is the right shape
 * for a front page and two cards wide in a panel.
 *
 * There is **no `useEffect`**. Measuring on mount and on resize happens in a
 * ref callback — it runs at commit with the node in hand and returns its own
 * cleanup, so it does not trip the `set-state-in-effect` rule the repo
 * enforces.
 */

interface RowMetrics {
  atStart: boolean
  atEnd: boolean
  /** False when everything fits — the arrows then have nothing to do. */
  scrollable: boolean
}

const SETTLED: RowMetrics = { atStart: true, atEnd: true, scrollable: false }

export function AssistantProducts({
  products,
  searchedFor,
}: {
  products: AssistantProduct[]
  searchedFor?: string[]
}) {
  const t = useTranslations("assistant")
  const rtl = LOCALE_DIRECTIONS[resolveLocale(useLocale())] === "rtl"

  const rowRef = useRef<HTMLDivElement | null>(null)
  const [metrics, setMetrics] = useState<RowMetrics>(SETTLED)

  const measure = useCallback((el: HTMLDivElement) => {
    const max = el.scrollWidth - el.clientWidth
    if (max <= 1) {
      setMetrics(SETTLED)
      return
    }
    // Negative under RTL — see the component note.
    const pos = Math.abs(el.scrollLeft)
    setMetrics({
      atStart: pos <= 1,
      atEnd: pos >= max - 1,
      scrollable: true,
    })
  }, [])

  const attach = useCallback(
    (el: HTMLDivElement | null) => {
      rowRef.current = el
      if (!el) return

      measure(el)
      const observer = new ResizeObserver(() => measure(el))
      observer.observe(el)

      // React 19 calls this on detach. Without it the observer would outlive
      // the panel closing, which unmounts the whole transcript.
      return () => {
        observer.disconnect()
        rowRef.current = null
      }
    },
    [measure],
  )

  const page = useCallback(
    (direction: "prev" | "next") => {
      const el = rowRef.current
      if (!el) return
      // A little under a full viewport, so the card the shopper was looking at
      // stays partly visible and the row reads as continuous.
      const step = el.clientWidth * 0.8
      const forward = direction === "next"
      el.scrollBy({ left: (forward !== rtl ? 1 : -1) * step, behavior: "smooth" })
    },
    [rtl],
  )

  if (products.length === 0) return null

  const heading = searchedFor?.length
    ? searchedFor.join(" · ")
    : t("productsFallbackTitle")

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium first-letter:uppercase">
          {heading}
        </p>

        {metrics.scrollable && (
          <div className="flex shrink-0 items-center gap-1">
            <RowButton
              label={t("prev")}
              disabled={metrics.atStart}
              onClick={() => page("prev")}
            >
              <ChevronLeft className="size-3.5 rtl:-scale-x-100" />
            </RowButton>
            <RowButton
              label={t("next")}
              disabled={metrics.atEnd}
              onClick={() => page("next")}
            >
              <ChevronRight className="size-3.5 rtl:-scale-x-100" />
            </RowButton>
          </div>
        )}
      </div>

      <div
        ref={attach}
        onScroll={(event) => measure(event.currentTarget)}
        role="region"
        aria-label={heading}
        // A scroll container is only reachable by keyboard when it is
        // focusable; without this the arrow keys never get to it.
        tabIndex={0}
        // Its own scroll container, so a long row never widens the panel — the
        // house rule for any wide content in this repo. The negative margin
        // lets a card bleed to the panel's edge while the padding keeps the
        // first one clear of it.
        className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 outline-none [scrollbar-width:none] focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-scrollbar]:hidden"
      >
        {products.map((product, i) => (
          <m.div
            key={product.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            // Staggered, so a row of five reads as arriving rather than
            // appearing. Capped: past the sixth card the delay is longer than
            // anyone waits, and the tail would land after the eye has moved on.
            transition={{
              delay: Math.min(i, 6) * 0.05,
              duration: 0.3,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <AssistantProductCard product={product} />
          </m.div>
        ))}
      </div>
    </div>
  )
}

function RowButton({
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
      className="grid size-6 place-items-center rounded-full border border-shop-hairline text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  )
}
