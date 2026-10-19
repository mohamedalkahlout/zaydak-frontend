import type { SocialNetwork } from "./lib/socials"

/** Shape of the shop fields the settings overlay reads (subset of MyShops). */
export interface SettingsShopLocation {
  city?: string | null
  country?: string | null
  formattedAddress?: string | null
  /** Unit, floor or suite. */
  apartment?: string | null
  /** The trading name on the address, when it differs from the shop's own. */
  company?: string | null
  lat?: number | null
  lng?: number | null
  state?: string | null
  /** Neighbourhood (حي); English name, Saudi addresses only. */
  district?: string | null
  zip?: string | null
}

/** What `ImageInput` needs and what `ShopImage` returns — the same three keys. */
export interface SettingsImage {
  id: string
  original: string
  thumbnail: string
}

/** One colour role: the fill, and the text that has to stay legible on it. */
export interface SettingsColorPair {
  background?: string | null
  foreground?: string | null
}

/**
 * The brand assets with no column of their own, read from `settings.brand`.
 * The default logo, the cover image and the short description are real `Shop`
 * fields and are not repeated here.
 */
export interface SettingsBrand {
  slogan?: string | null
  square_logo?: SettingsImage | null
  colors?: {
    primary?: SettingsColorPair | null
    secondary?: SettingsColorPair | null
  } | null
}

export interface SettingsSocial {
  id: string
  name: string
  link: string
}

export interface SettingsPolicies {
  refund_policy?: string | null
  privacy_policy?: string | null
  terms_of_service?: string | null
  shipping_policy?: string | null
}

export interface SettingsShop {
  id: string
  name: string
  slug: string
  timezone?: string | null
  /** ISO 4217. Every money figure in the shipping pane is formatted with it. */
  currency?: string | null
  /**
   * Shop-wide sales-tax fallback in basis points (0–10000).
   * Cart / checkout / createOrder use it when a line has no TaxClass.
   */
  tax_bps?: number | null
  description?: string | null
  logo?: SettingsImage | null
  cover_image?: SettingsImage | null
  is_active: boolean
  is_approved: boolean
  address?: unknown
  socials?: SettingsSocial[] | null
  owner?: {
    id: string
    name?: string | null
    email?: string | null
    phone?: string | null
  } | null
  settings?: {
    contact?: string | null
    /** The shop's own address, not `owner.email`. */
    email?: string | null
    website?: string | null
    isShopUnderMaintenance?: boolean | null
    location?: SettingsShopLocation | null
    brand?: SettingsBrand | null
    policies?: SettingsPolicies | null
  } | null
}

export interface MyShopsSettingsResponse {
  myShops: { success: boolean; data: SettingsShop[] }
}

/**
 * The General pane's staged form. Lives here rather than beside the pane
 * because the contact sub-pane, the address dialog and the brand sub-pane are
 * all handed the same `useForm` instance — they stage into it, and only the
 * contextual save bar on the pane itself talks to the server.
 *
 * One form for three screens rather than three forms is what keeps a single
 * Save in the navbar honest: a vendor who edits the address, walks into Brand
 * and changes the logo has one set of unsaved changes, and one button that
 * commits all of it.
 */
export interface GeneralValues {
  name: string
  timezone: string
  contact: string
  /** The store's own contact address; `owner.email` stays read-only beside it. */
  email: string
  website: string
  formattedAddress: string
  apartment: string
  company: string
  city: string
  state: string
  district: string
  zip: string
  /** ISO 3166-1 alpha-2. */
  country: string
  // ── Brand ────────────────────────────────────────────────────────────────
  description: string
  slogan: string
  logo: SettingsImage | null
  squareLogo: SettingsImage | null
  coverImage: SettingsImage | null
  primaryBackground: string
  primaryForeground: string
  secondaryBackground: string
  secondaryForeground: string
  /** Keyed by network so the form is flat; empty string means "no link". */
  socials: Record<SocialNetwork, string>
}
