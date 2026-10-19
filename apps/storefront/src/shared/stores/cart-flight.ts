import { create } from "zustand"

/**
 * The product images currently flying from a tile to the cart button.
 *
 * A store rather than a context for the same reason `useCartDrawerStore` is
 * one: the things that launch a flight — a catalogue tile, the product page's
 * buy bar, a wishlist row — are nowhere near the layer that draws it, which is
 * mounted once by `ShopShell`.
 *
 * **Both rectangles are measured at launch, never cached.** The header is
 * sticky and the page scrolls under it, so a cart position read once on mount
 * is wrong by the time a shopper has scrolled to the tile they want. Reading
 * `getBoundingClientRect()` on the click is the only measurement that is true
 * at the moment the animation starts, and it costs one layout read per add.
 *
 * Viewport coordinates also make RTL free: `left`/`top` describe where things
 * actually are, so nothing here needs to know which edge the cart sits on.
 */

export interface FlightRect {
  top: number
  left: number
  width: number
  height: number
}

export interface CartFlight {
  id: number
  /** Null when the product has no image; the layer draws a plain chip instead. */
  image: string | null
  from: FlightRect
  /** Centre of the cart button, in viewport coordinates. */
  to: { x: number; y: number }
}

/**
 * How long a flight lasts, in milliseconds.
 *
 * Exported because the add gesture holds the drawer back for exactly this long
 * — the two have to agree or the drawer opens over a photo still in the air.
 */
export const FLIGHT_MS = 620

/** The header's bag button marks itself with this so a flight can find it. */
const CART_ANCHOR = "[data-cart-anchor]"

/** The photo a flight should launch from, when the clicked control is not it. */
const FLIGHT_SOURCE = "[data-flight-source]"

/**
 * How far up the tree to look for that photo before giving up.
 *
 * The walk stops at the *first* ancestor containing one, which on a catalogue
 * grid is the tile's own `<article>` and on the product page is the column
 * holding the gallery — so a related-products grid further up can never be
 * matched by mistake. The cap is only a guard against scanning the document.
 */
const MAX_ANCESTORS = 8

let nextId = 0

function toRect(el: Element): FlightRect {
  const { top, left, width, height } = el.getBoundingClientRect()
  return { top, left, width, height }
}

/**
 * The product photo nearest the control that was clicked.
 *
 * Walks up from the control rather than down from a known root, because the
 * two call sites put the photo in different places: a tile has it above the
 * button inside one `<article>`, the product page has it in a sibling column.
 * Falls back to the control itself, so a layout this does not recognise still
 * animates from somewhere sensible instead of not animating at all.
 */
function originRect(origin: Element | null): FlightRect | null {
  if (!origin) return null

  let node: Element | null = origin
  for (let depth = 0; node && depth < MAX_ANCESTORS; depth += 1) {
    const found = node.querySelector(FLIGHT_SOURCE)
    if (found) return toRect(found)
    node = node.parentElement
  }

  return toRect(origin)
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

interface CartFlightState {
  flights: CartFlight[]
  /**
   * How many flights have landed. The bag button replays its ring pulse when
   * this changes — a counter rather than a boolean because two adds in a row
   * have to produce two pulses, and a boolean that is already `true` produces
   * none.
   */
  landings: number
  /**
   * Start a flight. Returns whether one actually began, which is what lets the
   * caller fall back to opening the drawer immediately — under reduced motion,
   * or before the header has mounted, there is nothing to wait for.
   */
  launch: (origin: Element | null, image: string | null) => boolean
  land: (id: number) => void
}

export const useCartFlightStore = create<CartFlightState>((set) => ({
  flights: [],
  landings: 0,

  launch: (origin, image) => {
    if (prefersReducedMotion()) return false

    const anchor = document.querySelector(CART_ANCHOR)
    if (!anchor) return false

    const from = originRect(origin)
    // A zero-width rect means the source is display:none or not laid out yet;
    // animating from it produces a flash at the top-left corner of the screen.
    if (!from || from.width === 0 || from.height === 0) return false

    const target = anchor.getBoundingClientRect()
    nextId += 1

    set((state) => ({
      flights: [
        ...state.flights,
        {
          id: nextId,
          image,
          from,
          to: {
            x: target.left + target.width / 2,
            y: target.top + target.height / 2,
          },
        },
      ],
    }))

    return true
  },

  land: (id) =>
    set((state) => ({
      flights: state.flights.filter((flight) => flight.id !== id),
      landings: state.landings + 1,
    })),
}))
