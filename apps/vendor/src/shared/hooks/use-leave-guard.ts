"use client"

import { useEffect, useRef } from "react"
import { useLeaveGuardStore, type LeaveGuard } from "@/shared/stores/leave-guard"

export interface UseLeaveGuardOptions {
  /** Arm while true — normally the form's value-based `dirty`. */
  when: boolean
  /**
   * Destinations to let through silently (a full `pathname + search`). A form
   * that spans several URLs answers true for the ones it is mounted on.
   */
  allow?: (path: string) => boolean
  /** Discard the staged edit and hide the save bar; runs before the exit. */
  onLeave: () => void
}

/**
 * Whether a click on `anchor` is one the browser would turn into a same-tab,
 * same-origin navigation. Anything else — a modified click, a new tab, a
 * download, another site — is the browser's to handle and is left alone.
 */
function inAppNavigation(e: MouseEvent, anchor: HTMLAnchorElement): string | null {
  if (e.button !== 0) return null
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null
  if (anchor.target && anchor.target !== "_self") return null
  if (anchor.hasAttribute("download")) return null
  let url: URL
  try {
    url = new URL(anchor.href, window.location.href)
  } catch {
    return null
  }
  if (url.origin !== window.location.origin) return null
  const path = url.pathname + url.search
  // A hash link, or a link to the page already on screen, moves nothing.
  if (path === window.location.pathname + window.location.search) return null
  return path
}

const SENTINEL_KEY = "__leave_guard_sentinel"

function isSentinelActive(): boolean {
  if (typeof window === "undefined" || !window.history?.state) return false
  return Boolean(window.history.state[SENTINEL_KEY])
}

function pushSentinel() {
  if (typeof window === "undefined" || !window.history) return
  if (!isSentinelActive()) {
    window.history.pushState(
      { ...window.history.state, [SENTINEL_KEY]: true },
      "",
      window.location.href,
    )
  }
}

/**
 * Hold the vendor on a screen with a staged edit until they say otherwise.
 *
 * Four exits are covered while `when` is true. A **link click** anywhere in
 * the document is seen by a capture-phase listener, which cancels it and
 * parks the destination in `useLeaveGuardStore.pending` for `LeaveGuardDialog`
 * to ask about — Next's `Link` checks `e.defaultPrevented` before it navigates
 * (`app-dir/link.js`), and a listener on `document` runs before React's root
 * listener, so the click never reaches the router. A **programmatic push**
 * (the overlay's X, Escape, the header menu) has no click to intercept; those
 * call sites go through `navigateGuarded` and are answered by the same store.
 * A **reload or closed tab** gets the browser's own `beforeunload` prompt —
 * the only one the platform allows there, and its text is not ours to write.
 * The browser's **Back and Forward** buttons are trapped via a sentinel history
 * state and a `popstate` listener that holds the exit and restores the sentinel
 * if the user chooses to stay.
 *
 * `allow`/`onLeave` are read through a ref written from an effect (the
 * latest-callback shape `react-hooks/refs` accepts), so the listener effect
 * depends on `when` alone and the guard stays armed across renders — being
 * re-armed per keystroke would drop a `pending` mid-prompt.
 */
export function useLeaveGuard({ when, allow, onLeave }: UseLeaveGuardOptions) {
  const latest = useRef({ allow, onLeave })
  useEffect(() => {
    latest.current = { allow, onLeave }
  })

  useEffect(() => {
    if (!when) return

    const guard: LeaveGuard = {
      allow: (path) => latest.current.allow?.(path) ?? false,
      onLeave: () => latest.current.onLeave(),
    }
    useLeaveGuardStore.getState().arm(guard)
    pushSentinel()

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return
      const anchor = (e.target as Element | null)?.closest?.("a[href]")
      if (!(anchor instanceof HTMLAnchorElement)) return
      const path = inAppNavigation(e, anchor)
      if (path === null) return
      if (useLeaveGuardStore.getState().request(path)) e.preventDefault()
    }

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // Older engines key the prompt on a set `returnValue`; the string itself
      // is never shown.
      e.returnValue = ""
    }

    const onPopState = () => {
      const path = window.location.pathname + window.location.search
      useLeaveGuardStore.getState().request(
        path,
        () => {
          if (typeof window !== "undefined" && window.history) {
            window.history.back()
          }
        },
        () => {
          pushSentinel()
        },
      )
    }

    document.addEventListener("click", onClick, true)
    window.addEventListener("beforeunload", onBeforeUnload)
    window.addEventListener("popstate", onPopState)

    return () => {
      document.removeEventListener("click", onClick, true)
      window.removeEventListener("beforeunload", onBeforeUnload)
      window.removeEventListener("popstate", onPopState)
      useLeaveGuardStore.getState().disarm(guard)

      if (isSentinelActive()) {
        window.history.back()
      }
    }
  }, [when])
}
