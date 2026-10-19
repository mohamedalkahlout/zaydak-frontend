import { create } from "zustand"

/**
 * Whether the sign-in popup is open, and where it sends the shopper after.
 *
 * Signing in is an interruption in the middle of shopping, so it happens over
 * the page the shopper is already on rather than on a screen they navigate to.
 * The things that open it — the header's account button, the header panel, the
 * bank-transfer block halfway down checkout — are nowhere near the thing that
 * renders it (`ShopShell`, once, above every route), which is the same reason
 * `cart-drawer` is a store: threading a callback from the shell down to a
 * payment section would make every component in between take a prop it does
 * not use.
 *
 * There is one panel: a phone number and the code texted to it. Signing up is
 * the same step as signing in, and there is no password to reset, so nothing
 * stacks on it. `stack` stays a list so a caller reads "open" the way it
 * always has.
 *
 * `/login` (and `/register`, `/forgot-password`, which show the same form)
 * stay real routes for a cold load. `proxy.ts` guards `/checkout` and `/account` on the server and can only answer with a
 * redirect, so a page has to exist at the other end of it — and an emailed
 * "sign in to see your order" link has to land somewhere with no JavaScript
 * having run yet. A client-side navigation is intercepted and opens this popup
 * instead, then goes back to the page it left.
 */
export type AuthView = "login"

interface AuthDialogState {
  /** Empty when nothing is open. */
  stack: AuthView[]
  /**
   * Where to send the shopper once the session exists.
   *
   * Captured when the popup opens rather than read from `?redirect=`: the
   * shopper is mid-page, so "back to where I was" is this URL. `completeSignIn`
   * hard-navigates to it, which on the same URL is a reload — exactly what the
   * signed-in version of the page needs anyway. It belongs to the popup, not
   * to a pane, so moving from the number to the code cannot lose it.
   */
  redirect: string | null
  open: (view?: AuthView, redirect?: string | null) => void
  close: () => void
}

export const useAuthDialogStore = create<AuthDialogState>((set) => ({
  stack: [],
  redirect: null,

  open: (view = "login", redirect) =>
    set({ stack: [view], redirect: redirect ?? currentPath() }),

  close: () => set({ stack: [] }),
}))

function currentPath(): string | null {
  if (typeof window === "undefined") return null
  return `${window.location.pathname}${window.location.search}`
}
