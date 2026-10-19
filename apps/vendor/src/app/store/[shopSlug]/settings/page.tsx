import { redirect } from "next/navigation"
import { legacySectionRedirect } from "@/features/settings"

/**
 * `/settings` is not a screen — General is the first section, exactly as the
 * rail orders it. Redirecting rather than rendering General here keeps one URL
 * per pane: `/settings/general` is the only address that shows it.
 *
 * A `?section=` query survives from the era when every pane lived on this one
 * route; `legacySectionRedirect` translates it to the matching URL and carries
 * the rest of the query (`?billing=` above all), so old links and bookmarks
 * land where they used to. The rule lives in `lib/routes.ts` so it is a pure,
 * tested function rather than logic buried in a server page.
 */
export default async function SettingsIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { shopSlug } = await params
  const query = await searchParams
  redirect(legacySectionRedirect(shopSlug, query))
}
