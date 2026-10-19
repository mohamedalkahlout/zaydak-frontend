"use client"

import { useCallback } from "react"

import { useCartDrawerStore } from "@/shared/stores/cart-drawer"
import { FLIGHT_MS, useCartFlightStore } from "@/shared/stores/cart-flight"

/**
 * What an "add to cart" click *looks* like, in one place.
 *
 * Every add-to-cart control in the app calls this and none of them decide the
 * choreography themselves, because there is exactly one thing to get right and
 * it is easy to get wrong differently at each call site.
 *
 * **The drawer waits for the flight, and that is the whole reason this exists.**
 * Opening it on the click — which is what every caller used to do — puts the
 * panel over the top-right corner of the screen, which is precisely where the
 * bag button is and therefore where the photo is flying to. The shopper would
 * watch a picture sail into a panel that had already covered its destination.
 * So a flight, when one starts, *is* the confirmation for its own duration and
 * the drawer arrives behind it.
 *
 * **When no flight starts, the drawer opens immediately** — the old behaviour,
 * unchanged. That is the reduced-motion path, and it is also what happens
 * before the header has mounted or when the source has no laid-out photo to
 * launch. Nothing is ever delayed for an animation that is not playing.
 *
 * **`reveal: false` keeps the panel out of it entirely.** A catalogue tile is
 * used in a run — a shopper fills a basket from the grid — and a panel over
 * the page after each one has to be dismissed before the next tile can be
 * reached, which turns adding three things into six clicks. The flight and the
 * badge are the confirmation there; the drawer stays for the deliberate adds
 * (a product page, a saved item), where the shopper has finished choosing.
 * The return value says whether a flight actually started, so a caller that
 * shows nothing else can fall back to a word when nothing moved.
 *
 * **The wait itself belongs to the drawer, not to this hook.** It used to be a
 * `setTimeout` id in a ref here, cleared on unmount — and this hook is called
 * from a catalogue tile, so the pending open died with the tile that armed it.
 * A filter, a sort or a page change replaces every tile with a skeleton, which
 * meant a perfectly ordinary click was accepted and then quietly dropped. The
 * store owns it now; see `openDrawerAfter` in `shared/stores/cart-drawer.ts`.
 *
 * The pending mutation is untouched by any of this: `addToCart` is optimistic
 * about the item count, so the badge has already moved before the photo lands.
 */
export function useAddToCartGesture({ reveal = true }: { reveal?: boolean } = {}) {
  const launch = useCartFlightStore((state) => state.launch)
  const openDrawer = useCartDrawerStore((state) => state.openDrawer)
  const openDrawerAfter = useCartDrawerStore((state) => state.openDrawerAfter)

  return useCallback(
    /**
     * @param origin  The clicked control. The nearest `[data-flight-source]`
     *                photo around it is what actually flies; see the store.
     * @param image   The photo's URL, taken from the product rather than from
     *                the DOM — the element is only ever measured, never read.
     * @returns       Whether a photo is in the air. False means nothing on
     *                screen moved, so a caller that suppressed the drawer has
     *                to confirm the add some other way.
     */
    (origin: Element | null, image: string | null): boolean => {
      const flying = launch(origin, image)

      if (!reveal) return flying

      if (!flying) {
        openDrawer()
        return false
      }

      openDrawerAfter(FLIGHT_MS)
      return true
    },
    [launch, openDrawer, openDrawerAfter, reveal],
  )
}
