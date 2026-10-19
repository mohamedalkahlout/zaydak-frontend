import { create } from "zustand"

/**
 * What an editing screen registers while it holds a staged edit.
 *
 * `allow` is asked about every same-origin destination before it is blocked;
 * it is how a screen whose form spans several URLs (the General group in
 * settings) keeps its own in-group moves silent. `onLeave` runs when the
 * vendor confirms leaving — discard the draft, hide the save bar — and must
 * leave the screen clean, because the navigation is re-issued right after it.
 */
export interface LeaveGuard {
  allow: (path: string) => boolean
  onLeave: () => void
}

/**
 * A navigation the guard has held back, waiting on the vendor's answer.
 *
 * `proceed` is the exact action that was interrupted, when the caller had one
 * (the header's shop switch writes the active-shop store *and* pushes; a bare
 * `router.push` of the href would leave the store on the old shop). A blocked
 * link click has no `proceed` — the dialog pushes `href` itself.
 */
export interface PendingNavigation {
  href: string
  proceed?: () => void
  cancel?: () => void
}

export interface LeaveGuardState {
  guard: LeaveGuard | null
  pending: PendingNavigation | null
  arm: (guard: LeaveGuard) => void
  /**
   * Clears the guard. Given the guard it was armed with, it is a no-op when a
   * different one is now in place — a screen's unmount cleanup must not disarm
   * the screen that replaced it.
   */
  disarm: (guard?: LeaveGuard) => void
  /**
   * Ask whether `href` may be navigated to right now. Returns `true` when the
   * guard has taken the navigation over (the caller must stop), `false` when
   * the caller should go ahead.
   */
  request: (
    href: string,
    proceed?: () => void,
    cancel?: () => void,
  ) => boolean
  /** The vendor chose to leave: run `onLeave` and hand back what was held. */
  confirm: () => PendingNavigation | null
  /** The vendor chose to stay. */
  cancel: () => void
}

/**
 * The app's one navigation guard.
 *
 * The contextual save bar (`useUnsavedBarStore`) says an edit is staged; this
 * store is what stops the vendor walking away from it. It is deliberately not
 * folded into the save-bar store: the bar is about *showing* the edit and this
 * is about *interrupting* an exit, and a screen can want one without the
 * other. Only one guard is armed at a time, for the same reason there is one
 * save bar — two would make "you have unsaved changes" ambiguous.
 *
 * Written from handlers and effects only, never during render.
 */
export const useLeaveGuardStore = create<LeaveGuardState>((set, get) => ({
  guard: null,
  pending: null,
  arm: (guard) => set({ guard }),
  disarm: (guard) =>
    set((state) => {
      if (guard && state.guard !== guard) return state
      return { guard: null, pending: null }
    }),
  request: (href, proceed, cancel) => {
    const { guard } = get()
    if (!guard) return false
    if (guard.allow(href)) return false
    set({ pending: { href, proceed, cancel } })
    return true
  },
  confirm: () => {
    const { guard, pending } = get()
    set({ pending: null })
    guard?.onLeave()
    return pending
  },
  cancel: () => {
    const { pending } = get()
    pending?.cancel?.()
    set({ pending: null })
  },
}))

/**
 * Run `navigate` now, or after the vendor confirms if a guard is armed against
 * `href`.
 *
 * For code that navigates with `router.push` rather than a link — the settings
 * overlay's X and Escape, the header's menu items. A link click is caught by
 * `useLeaveGuard`'s document listener; a programmatic push is invisible to it,
 * so those call sites have to ask here themselves.
 */
export function navigateGuarded(href: string, navigate: () => void): void {
  if (useLeaveGuardStore.getState().request(href, navigate)) return
  navigate()
}
