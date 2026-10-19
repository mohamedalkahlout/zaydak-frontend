/**
 * What the sign-in form needs to know about the frame it is rendered in.
 *
 * It is used twice — as a route under `/[shopSlug]` and as the panel inside
 * `AuthDialog` — and the only differences are chrome: where the heading
 * element comes from, and where the shopper goes afterwards. Everything else
 * (the mutations, the code cooldown, `completeSignIn`) is identical, so it is
 * one component with this prop set rather than two copies.
 */
export interface AuthChromeProps {
  variant?: "page" | "dialog"
  /**
   * Overrides `?redirect=`. The popup passes the URL the shopper is standing
   * on; a route has nothing to pass and falls back to the search param the
   * guard wrote.
   */
  redirect?: string | null
}
