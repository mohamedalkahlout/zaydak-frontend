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
 * Display names for the network keys the vendor dashboard writes.
 *
 * `ShopSocial.name` is a plain string and used to hold whatever a vendor typed.
 * The Brand pane (`apps/vendor/src/features/settings/lib/socials.ts`) now emits
 * a fixed lowercase key per network, which is what makes a link recognisable —
 * but rendered raw it reads "tiktok" and "x". This maps a known key to the way
 * the network writes its own name.
 *
 * Anything unknown falls through unchanged, because rows written before the
 * pane existed — and any network the pane does not offer — are still shown.
 */
const LABELS: Record<string, string> = {
  instagram: "Instagram",
  x: "X",
  twitter: "X",
  facebook: "Facebook",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  youtube: "YouTube",
  whatsapp: "WhatsApp",
  pinterest: "Pinterest",
  linkedin: "LinkedIn",
}

export function socialLabel(name: string): string {
  return LABELS[name.trim().toLowerCase()] ?? name
}

/**
 * The brand mark for a network key, or null when there is nothing to draw.
 *
 * `react-icons` rather than hand-drawn paths, and `fa6` rather than a second
 * icon set, because this is the **same list and the same faces the vendor
 * dashboard renders** (`apps/vendor/src/features/settings/lib/socials.ts`) —
 * the pane where a vendor picks the network is the reason `ShopSocial.name` is
 * a fixed lowercase key at all, and a shop's mark should not change shape
 * between the screen where it was set and the storefront where it is shown.
 *
 * Null for anything unknown, which is a real case rather than a defensive one:
 * `ShopSocial.name` is a plain string and rows written before the Brand pane
 * existed hold whatever a vendor typed. The footer draws the first letter of
 * `socialLabel` for those, so an unrecognised network is still a working link
 * with a readable button rather than an empty circle.
 *
 * lucide has no brand glyphs at all — they were removed in v1, which this app
 * is on — so there is no lighter option that stays on the icon set already
 * imported here.
 */
const ICONS: Record<string, IconType> = {
  instagram: FaInstagram,
  x: FaXTwitter,
  twitter: FaXTwitter,
  facebook: FaFacebookF,
  tiktok: FaTiktok,
  snapchat: FaSnapchat,
  youtube: FaYoutube,
  whatsapp: FaWhatsapp,
  pinterest: FaPinterestP,
  linkedin: FaLinkedinIn,
}

export function socialIcon(name: string): IconType | null {
  return ICONS[name.trim().toLowerCase()] ?? null
}
