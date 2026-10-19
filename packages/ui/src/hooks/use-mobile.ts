import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * The viewport is an external store, not React state, so it is read with
 * `useSyncExternalStore` rather than mirrored into `useState` from an effect.
 * The effect version rendered one frame at the wrong width before correcting
 * itself — visible as a sidebar that flashed desktop-wide on a phone — and it
 * could tear during a concurrent render.
 */
const subscribe = (onChange: () => void) => {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

const getSnapshot = () => window.innerWidth < MOBILE_BREAKPOINT

/** There is no viewport on the server; desktop is the safe assumption, and it
 *  matches what the previous `useState(undefined)` rendered before hydration. */
const getServerSnapshot = () => false

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
