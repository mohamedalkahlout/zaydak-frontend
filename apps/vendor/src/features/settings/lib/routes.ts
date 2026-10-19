import type { SettingsSectionId } from "../components/settings-sections"

/**
 * Every settings section is a URL.
 *
 * It used to be one route holding twenty panes in local state, which meant a
 * vendor could not link a colleague to Shipping, could not open Brand in a new
 * tab, and lost their place on refresh. The admin console had already settled
 * this for `/integrations/[type]` — the same reasoning applies here, and more
 * so, because these panes carry unsaved forms: one form per route is what makes
 * "you have unsaved changes" mean one unambiguous thing.
 *
 * The id is the i18n key (`settings.nav.<id>`) and the slug is the URL. They
 * differ only where the id is camelCase.
 */
const SLUGS: Record<SettingsSectionId, string> = {
  general: "general",
  plan: "plan",
  billing: "billing",
  users: "users",
  payments: "payments",
  checkout: "checkout",
  abandonedCarts: "abandoned-carts",
  customerAccounts: "customer-accounts",
  shipping: "shipping",
  taxes: "taxes",
  locations: "locations",
  markets: "markets",
  apps: "apps",
  salesChannels: "sales-channels",
  whatsapp: "whatsapp",
  telegram: "telegram",
  instagram: "instagram",
  shein: "shein",
  domains: "domains",
  customerEvents: "customer-events",
  notifications: "notifications",
  metafields: "metafields",
  languages: "languages",
  customerPrivacy: "customer-privacy",
  policies: "policies",
}

const IDS = Object.fromEntries(
  Object.entries(SLUGS).map(([id, slug]) => [slug, id as SettingsSectionId]),
) as Record<string, SettingsSectionId>

/** General's sub-screens, each its own URL under `/settings/general`. */
export const GENERAL_SUBVIEWS = ["contact", "brand"] as const
export type GeneralSubview = (typeof GENERAL_SUBVIEWS)[number]

/**
 * Sections whose third path segment names a *record* rather than a sub-view.
 *
 * `/settings/domains/<id>` is one domain's setup screen — a detail page in
 * the sense a product edit page is, not a sibling pane the way General's
 * Brand is. The shell draws a breadcrumb back to the section for these and
 * lets the page fill the title in, because the title (the hostname) is data
 * the page has to load.
 */
const DETAIL_SECTIONS: ReadonlySet<SettingsSectionId> = new Set(["domains"])

export function sectionSlug(id: SettingsSectionId): string {
  return SLUGS[id]
}

export function sectionIdFromSlug(slug: string): SettingsSectionId | null {
  return IDS[slug] ?? null
}

export function settingsRoot(shopSlug: string | null): string {
  return shopSlug ? `/store/${shopSlug}/settings` : "/store"
}

export function sectionUrl(
  shopSlug: string | null,
  id: SettingsSectionId,
): string {
  return `${settingsRoot(shopSlug)}/${SLUGS[id]}`
}

export function generalSubviewUrl(
  shopSlug: string | null,
  subview: GeneralSubview,
): string {
  return `${sectionUrl(shopSlug, "general")}/${subview}`
}

/**
 * The id the platform subdomain is addressed by, having none of its own.
 *
 * `<slug>.<root>` is synthesised from the handle and has no `shop_domains`
 * row, so every row action keyed off `id` skipped it — including opening it,
 * which is why it was the one address on the screen that led nowhere. A
 * sentinel gives it a URL without giving it a row.
 *
 * It cannot collide with a real id: those are cuids, which are far longer and
 * never this word. The detail pane matches on this exact string and falls
 * through to a lookup by id otherwise, so a shop that somehow held a domain
 * with this id would render the platform screen rather than anything unsafe.
 */
export const PLATFORM_DOMAIN_ID = "platform"

/** One domain's setup screen, under Domains. */
export function domainUrl(shopSlug: string | null, domainId: string): string {
  return `${sectionUrl(shopSlug, "domains")}/${encodeURIComponent(domainId)}`
}

/**
 * Where a link from the one-route era lands.
 *
 * `/settings?section=<id>` was the address of every pane before each had a
 * URL of its own; the index page still honours it so old links and bookmarks
 * land where they used to. The section is consumed — the path is the address
 * now, so it never survives into the query — and every other parameter is
 * carried, `billing` above all: a Stripe session opened from the old
 * `?section=plan` link returns here and the plan route forwards it on. An
 * unknown or missing section means General, exactly as the rail orders it.
 * Ids and slugs are both accepted; the old links carried the id.
 */
export function legacySectionRedirect(
  shopSlug: string,
  query: Record<string, string | string[] | undefined>,
): string {
  const legacy = typeof query.section === "string" ? query.section : ""
  const section: SettingsSectionId =
    (Object.prototype.hasOwnProperty.call(SLUGS, legacy)
      ? (legacy as SettingsSectionId)
      : null) ??
    sectionIdFromSlug(legacy) ??
    "general"

  const rest = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (key === "section") continue
    if (typeof value === "string") rest.set(key, value)
    else if (Array.isArray(value)) value.forEach((v) => rest.append(key, v))
  }
  const suffix = rest.toString()
  return `${sectionUrl(shopSlug, section)}${suffix ? `?${suffix}` : ""}`
}

/**
 * Read the active section and General sub-view straight out of the path.
 *
 * Derived rather than held in state, for the same reason the storefront derives
 * its shop scope from the URL: a second copy of "where am I" is a second thing
 * that can lag a navigation and be wrong.
 *
 * A query string or hash is ignored: `usePathname()` never carries one, but
 * the leave guard hands over `pathname + search`, and `/general?x=1` is still
 * General.
 */
export function parseSettingsPath(pathname: string): {
  section: SettingsSectionId | null
  subview: GeneralSubview | null
  /**
   * The record a detail screen is showing — a domain id under Domains.
   * Decoded, so it is the id itself rather than its URL spelling. Null for
   * every path that is not a detail screen.
   */
  detail: string | null
} {
  const [path = ""] = pathname.split(/[?#]/)
  const parts = path.split("/").filter(Boolean)
  const at = parts.indexOf("settings")
  if (at === -1) return { section: null, subview: null, detail: null }

  const section = sectionIdFromSlug(parts[at + 1] ?? "")
  const next = parts[at + 2] ?? ""
  const subview =
    section === "general" &&
    (GENERAL_SUBVIEWS as readonly string[]).includes(next)
      ? (next as GeneralSubview)
      : null
  const detail =
    section && DETAIL_SECTIONS.has(section) && next
      ? safeDecode(next)
      : null

  return { section, subview, detail }
}

/** A malformed escape (`%E0%A4%A`) is a wrong URL, not a crash. */
function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}
