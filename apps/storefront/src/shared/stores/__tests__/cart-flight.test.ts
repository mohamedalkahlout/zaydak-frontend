import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { useCartFlightStore } from "../cart-flight"

/**
 * The add-to-cart flight, and the four things that decide whether one happens.
 *
 * `launch` returning `false` is not a detail — `useAddToCartGesture` reads it
 * to decide whether the cart drawer opens now or waits behind a photo still in
 * the air. Every refusal covered here is therefore also a test that the drawer
 * still opens immediately in that case, which is the behaviour the app had
 * before any of this existed.
 *
 * The measurement tests exist because the source photo and the destination are
 * found by two different mechanisms — a walk up the tree for one, a document
 * query for the other — and neither is visible from the call site that asked
 * for the animation.
 */

const realMatchMedia = window.matchMedia

function setReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

interface Box {
  top: number
  left: number
  width: number
  height: number
}

/** jsdom lays nothing out, so every rect in these tests is stated outright. */
function measure(el: Element, box: Box) {
  el.getBoundingClientRect = () =>
    ({
      ...box,
      x: box.left,
      y: box.top,
      right: box.left + box.width,
      bottom: box.top + box.height,
      toJSON: () => ({}),
    }) as DOMRect
}

function build(sourceBox: Box | null) {
  document.body.innerHTML = `
    <header><button data-cart-anchor id="bag"></button></header>
    <article id="tile">
      <div id="photo" data-flight-source></div>
      <button id="add"></button>
    </article>
  `

  const bag = document.querySelector<HTMLElement>("#bag")!
  const photo = document.querySelector<HTMLElement>("#photo")!
  const add = document.querySelector<HTMLElement>("#add")!

  measure(bag, { top: 10, left: 900, width: 40, height: 40 })
  measure(add, { top: 400, left: 100, width: 200, height: 32 })
  if (sourceBox) measure(photo, sourceBox)
  else photo.remove()

  return { bag, photo, add }
}

describe("useCartFlightStore", () => {
  beforeEach(() => {
    setReducedMotion(false)
    useCartFlightStore.setState({ flights: [], landings: 0 })
  })

  afterEach(() => {
    window.matchMedia = realMatchMedia
    document.body.innerHTML = ""
  })

  it("measures from the nearest marked photo, not from the button", () => {
    const { add } = build({ top: 200, left: 120, width: 160, height: 160 })

    const flew = useCartFlightStore.getState().launch(add, "photo.jpg")

    expect(flew).toBe(true)
    const [flight] = useCartFlightStore.getState().flights
    expect(flight?.from).toEqual({
      top: 200,
      left: 120,
      width: 160,
      height: 160,
    })
    expect(flight?.image).toBe("photo.jpg")
  })

  it("aims at the centre of the cart anchor", () => {
    const { add } = build({ top: 200, left: 120, width: 160, height: 160 })

    useCartFlightStore.getState().launch(add, "photo.jpg")

    // The bag is 40×40 at (900, 10), so its centre is (920, 30).
    expect(useCartFlightStore.getState().flights[0]?.to).toEqual({
      x: 920,
      y: 30,
    })
  })

  it("falls back to the clicked control when nothing is marked", () => {
    const { add } = build(null)

    expect(useCartFlightStore.getState().launch(add, null)).toBe(true)
    expect(useCartFlightStore.getState().flights[0]?.from).toEqual({
      top: 400,
      left: 100,
      width: 200,
      height: 32,
    })
  })

  it("refuses under reduced motion, so the drawer opens immediately", () => {
    const { add } = build({ top: 200, left: 120, width: 160, height: 160 })
    setReducedMotion(true)

    expect(useCartFlightStore.getState().launch(add, "photo.jpg")).toBe(false)
    expect(useCartFlightStore.getState().flights).toHaveLength(0)
  })

  it("refuses when the header has not mounted a cart anchor", () => {
    const { add, bag } = build({ top: 200, left: 120, width: 160, height: 160 })
    bag.remove()

    expect(useCartFlightStore.getState().launch(add, "photo.jpg")).toBe(false)
    expect(useCartFlightStore.getState().flights).toHaveLength(0)
  })

  it("refuses an unlaid-out source rather than flying from the corner", () => {
    const { add } = build({ top: 0, left: 0, width: 0, height: 0 })

    expect(useCartFlightStore.getState().launch(add, "photo.jpg")).toBe(false)
    expect(useCartFlightStore.getState().flights).toHaveLength(0)
  })

  it("keeps concurrent flights apart and counts each landing once", () => {
    const { add } = build({ top: 200, left: 120, width: 160, height: 160 })

    useCartFlightStore.getState().launch(add, "a.jpg")
    useCartFlightStore.getState().launch(add, "b.jpg")

    const [first, second] = useCartFlightStore.getState().flights
    expect(first!.id).not.toBe(second!.id)

    useCartFlightStore.getState().land(first!.id)
    expect(useCartFlightStore.getState().flights.map((f) => f.id)).toEqual([
      second!.id,
    ])
    expect(useCartFlightStore.getState().landings).toBe(1)

    useCartFlightStore.getState().land(second!.id)
    expect(useCartFlightStore.getState().flights).toHaveLength(0)
    // Two adds, two pulses — the reason this is a counter and not a boolean.
    expect(useCartFlightStore.getState().landings).toBe(2)
  })
})
