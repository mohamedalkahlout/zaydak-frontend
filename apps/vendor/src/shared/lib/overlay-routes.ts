/**
 * Routes drawn as a sheet over the dashboard rather than inside it: the
 * settings overlay and the store-import review. Both sit in the band under the
 * site header and over the app sidebar, and two things key off that fact —
 * the assistant panel, which has to open *above* the sheet rather than behind
 * it, and `DashboardShell`, which makes the covered sidebar `inert` so Tab and
 * a screen reader do not walk a navigation nobody can see.
 *
 * Read off the path rather than a flag a shell raises on mount, for the reason
 * `parseSettingsPath` gives: a second copy of "where am I" is a second thing
 * that can lag a navigation, and a flag written in an effect would leave the
 * panel one commit behind the sheet it exists to clear.
 */
export const OVERLAY_ROUTE =
  /^\/store\/[^/]+\/(?:settings|products\/import\/[^/]+\/review)(?:\/|$)/

export function isOverlayRoute(pathname: string | null | undefined): boolean {
  return OVERLAY_ROUTE.test(pathname ?? "")
}
