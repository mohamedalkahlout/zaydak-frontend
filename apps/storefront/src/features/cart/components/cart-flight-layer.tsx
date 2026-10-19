"use client"

import { AnimatePresence, LazyMotion, domAnimation, m } from "motion/react"

import { FLIGHT_MS, useCartFlightStore } from "@/shared/stores/cart-flight"

/**
 * The photo that leaps into the bag when something is added.
 *
 * Mounted once by `ShopShell`. It renders nothing at all until a flight is in
 * the air, so the cost on a normal page is one subscription.
 *
 * **Only `transform` and `opacity` are animated.** The element is pinned at the
 * source photo's measured rectangle through plain inline `top`/`left`/`width`/
 * `height`, and everything that moves is a transform — so the whole flight runs
 * on the compositor and never asks the browser to re-lay-out a catalogue grid
 * mid-scroll. Animating `top`/`left` instead, which is the obvious way to write
 * this, would do exactly that once per frame.
 *
 * The photo is a **background image on an `aria-hidden` div**, not an `<img>`.
 * It is decoration duplicating a picture already on screen, so it wants no
 * alt text and no `next/image` machinery — the URL is in cache by definition,
 * since the thing being animated is the copy the shopper just clicked.
 *
 * `LazyMotion` + `domAnimation` is what keeps this from costing the whole
 * animation library: it loads the DOM feature set only, roughly half of the
 * full bundle, and `strict` makes the cheap `m` components the only ones that
 * compile — a stray `motion.div` becomes an error rather than a silent
 * re-import of everything.
 */
export function CartFlightLayer() {
  const flights = useCartFlightStore((state) => state.flights)
  const land = useCartFlightStore((state) => state.land)

  return (
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence>
        {flights.map((flight) => {
          // Both rects are viewport coordinates, so the delta is the distance
          // between the two *centres* — which is what has to be travelled for
          // a shrinking square to end up over the bag rather than beside it.
          const dx = flight.to.x - (flight.from.left + flight.from.width / 2)
          const dy = flight.to.y - (flight.from.top + flight.from.height / 2)

          return (
            <m.div
              key={flight.id}
              aria-hidden
              className="pointer-events-none fixed z-50 rounded-2xl bg-secondary bg-cover bg-center shadow-lg ring-1 ring-shop-hairline"
              style={{
                top: flight.from.top,
                left: flight.from.left,
                width: flight.from.width,
                height: flight.from.height,
                backgroundImage: flight.image
                  ? `url("${flight.image}")`
                  : undefined,
              }}
              initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
              // A three-stop arc rather than a straight line. The midpoint is
              // lifted by a fixed 56px on top of its share of the vertical
              // travel, so the photo is *tossed* into the bag — the same shape
              // whether the cart is above the tile (scrolled down a grid) or
              // below it (a product page near the top).
              animate={{
                x: [0, dx * 0.62, dx],
                y: [0, dy * 0.3 - 56, dy],
                scale: [1, 0.5, 0.14],
                opacity: [1, 1, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: FLIGHT_MS / 1000,
                times: [0, 0.55, 1],
                ease: [0.32, 0, 0.3, 1],
              }}
              onAnimationComplete={() => land(flight.id)}
            />
          )
        })}
      </AnimatePresence>
    </LazyMotion>
  )
}
