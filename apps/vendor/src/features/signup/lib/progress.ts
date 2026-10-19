export const SIGNUP_PROGRESS_KEY = "vendor-signup-progress"

/**
 * A half-finished signup, parked so a **refresh on `/register`** does not throw
 * the vendor back to step one (they may have left the tab to read an SMS).
 *
 * It is **not** a resume token for coming back later. `/login` and `/verify-otp`
 * discard it on arrival, so Login → Create is always a fresh wizard — even
 * when Chrome restores this tab's `sessionStorage` after "continue where you
 * left off". Closing the site and opening `/register` again is a `navigate`,
 * not a reload, so `shouldRestoreSignupProgress` also refuses that resurrect.
 */
export function readSignupProgress<T>(): T | null {
  try {
    const raw = window.sessionStorage.getItem(SIGNUP_PROGRESS_KEY)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/**
 * Only a reload of `/register` may replay the parked pane. A new visit —
 * Login → Create, a typed URL, Chrome restoring the tab after the browser
 * was closed — is `navigate` (or `back_forward`) and must start empty.
 *
 * jsdom has no Navigation Timing entry; treat that as a reload so unit tests
 * and any browser without the API still keep an in-progress SMS detour.
 */
export function shouldRestoreSignupProgress(): boolean {
  try {
    const nav = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming | undefined
    if (!nav?.type) return true
    return nav.type === "reload"
  } catch {
    return true
  }
}

export function writeSignupProgress(value: unknown): void {
  try {
    window.sessionStorage.setItem(SIGNUP_PROGRESS_KEY, JSON.stringify(value))
  } catch {
    // A full or blocked quota costs the vendor a refresh, nothing more.
  }
}

export function clearSignupProgress(): void {
  try {
    window.sessionStorage.removeItem(SIGNUP_PROGRESS_KEY)
  } catch {
    // Ignored for the same reason as write.
  }
}
