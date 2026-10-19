"use client"

import { useCallback, useSyncExternalStore } from "react"

type BreakpointMode = "min" | "max"

/**
 * Hook to detect whether the current viewport matches a given breakpoint rule.
 * Example:
 *   useIsBreakpoint("max", 768)   // true when width < 768
 *   useIsBreakpoint("min", 1024)  // true when width >= 1024
 *
 * The viewport is an external store, so it is read with `useSyncExternalStore`
 * rather than mirrored into `useState` from an effect. The mirrored version
 * rendered one frame at the wrong breakpoint before correcting itself, and
 * could tear during a concurrent render.
 */
export function useIsBreakpoint(
  mode: BreakpointMode = "max",
  breakpoint = 768,
) {
  const query =
    mode === "min"
      ? `(min-width: ${breakpoint}px)`
      : `(max-width: ${breakpoint - 1}px)`

  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    },
    [query],
  )

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query])

  // No viewport on the server. `false` is what the old `useState(undefined)`
  // rendered before its effect ran, so nothing downstream changes.
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
