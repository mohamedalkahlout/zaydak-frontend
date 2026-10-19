"use client"

import { useEffect, useState } from "react"

/**
 * Visibility gate — never hold a GL context off-screen.
 *
 * WebGL contexts are a scarce, browser-wide resource (~16 of them), so anything
 * that mounts a canvas as decoration should only do so while it is actually
 * being looked at. A widget near the bottom of a long page is off-screen on
 * most visits; mounting only in view means the common case costs no context at
 * all, and scrolling away hands the slot back.
 *
 * The hide is delayed so a scroll that flicks past the section does not tear
 * the scene down and rebuild it, and `rootMargin` starts it slightly early so
 * the first frame has landed by the time it is on screen.
 *
 * No `IntersectionObserver` means no render — every browser this ships to has
 * it, so the only environment that takes that branch is a test DOM, where a
 * WebGL canvas would fail anyway.
 */
export function useOnScreen(ref: React.RefObject<HTMLElement | null>) {
  const [onScreen, setOnScreen] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === "undefined") return

    let hideTimer: ReturnType<typeof setTimeout> | undefined
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          clearTimeout(hideTimer)
          setOnScreen(true)
        } else {
          hideTimer = setTimeout(() => setOnScreen(false), 1500)
        }
      },
      { rootMargin: "150px" },
    )
    io.observe(el)
    return () => {
      clearTimeout(hideTimer)
      io.disconnect()
    }
  }, [ref])

  return onScreen
}
