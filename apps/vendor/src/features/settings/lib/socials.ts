import type { IconType } from "react-icons"
import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaPinterestP,
  FaSnapchat,
  FaTiktok,
  FaWhatsapp,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6"

/**
 * The social networks the Brand pane offers, in the order it renders them.
 *
 * A fixed list rather than a free "add a link" repeater, because that is what
 * `ShopSocial.name` has to be for anything downstream to recognise it: the row
 * is `{ name, link }` with `name` a plain string, so a vendor typing "Insta"
 * and a vendor typing "instagram" would produce two rows nothing can map to an
 * icon. The key below IS the stored `name`.
 *
 * Shopify's own list is X, Facebook, Instagram, YouTube, TikTok, Tumblr,
 * Snapchat and Pinterest. Ours drops Tumblr and adds WhatsApp and LinkedIn —
 * WhatsApp because it is how a Saudi shop is actually contacted, LinkedIn
 * because a B2B seller has nowhere else to put it.
 */
export const SOCIAL_NETWORKS = [
  "instagram",
  "x",
  "facebook",
  "tiktok",
  "snapchat",
  "youtube",
  "whatsapp",
  "pinterest",
  "linkedin",
] as const

export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number]

const NETWORK_SET = new Set<string>(SOCIAL_NETWORKS)

export function isSocialNetwork(name: string): name is SocialNetwork {
  return NETWORK_SET.has(name)
}

interface NetworkSpec {
  /** Brand mark. Decorative — the visible label carries the name. */
  icon: IconType
  /** Shown in English regardless of locale: these are proper nouns. */
  label: string
  placeholder: string
}

export const SOCIAL_SPECS: Record<SocialNetwork, NetworkSpec> = {
  instagram: {
    icon: FaInstagram,
    label: "Instagram",
    placeholder: "https://instagram.com/yourshop",
  },
  x: { icon: FaXTwitter, label: "X", placeholder: "https://x.com/yourshop" },
  facebook: {
    icon: FaFacebookF,
    label: "Facebook",
    placeholder: "https://facebook.com/yourshop",
  },
  tiktok: {
    icon: FaTiktok,
    label: "TikTok",
    placeholder: "https://tiktok.com/@yourshop",
  },
  snapchat: {
    icon: FaSnapchat,
    label: "Snapchat",
    placeholder: "https://snapchat.com/add/yourshop",
  },
  youtube: {
    icon: FaYoutube,
    label: "YouTube",
    placeholder: "https://youtube.com/@yourshop",
  },
  whatsapp: {
    icon: FaWhatsapp,
    label: "WhatsApp",
    placeholder: "https://wa.me/9665XXXXXXXX",
  },
  pinterest: {
    icon: FaPinterestP,
    label: "Pinterest",
    placeholder: "https://pinterest.com/yourshop",
  },
  linkedin: {
    icon: FaLinkedinIn,
    label: "LinkedIn",
    placeholder: "https://linkedin.com/company/yourshop",
  },
}

/**
 * Bring a typed link up to something `@IsUrl()` accepts.
 *
 * The back-end validates `ShopSocialInput.link` with class-validator's
 * `@IsUrl()`, which rejects a bare handle. Vendors paste "instagram.com/acme"
 * and "@acme" about as often as they paste a full URL, so a scheme is added
 * rather than the save being bounced with a validation error naming a field
 * inside a dialog they have already closed.
 *
 * A bare handle cannot be resolved to a URL without knowing the network, so
 * that case is left alone and reported by {@link isLikelyUrl} instead.
 */
export function normalizeSocialUrl(raw: string): string {
  const value = raw.trim()
  if (!value) return ""
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith("@")) return value
  return `https://${value}`
}

/** A cheap mirror of the server's `@IsUrl()`, so the error lands on the field. */
export function isLikelyUrl(value: string): boolean {
  if (!value) return true
  try {
    const url = new URL(normalizeSocialUrl(value))
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname.includes(".")
    )
  } catch {
    return false
  }
}
