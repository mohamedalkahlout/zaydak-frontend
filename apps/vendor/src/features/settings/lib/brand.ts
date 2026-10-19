import { normalizeHex } from "./contrast"
import {
  SOCIAL_NETWORKS,
  isSocialNetwork,
  normalizeSocialUrl,
  type SocialNetwork,
} from "./socials"
import type { FileEntry } from "@/features/files/types"
import type { GeneralValues, SettingsImage, SettingsShop } from "../types"

/** Mirrors `SHOP_SLOGAN_MAX_LENGTH` in `back-end/src/shops/dto/settings.input.ts`. */
export const SHOP_SLOGAN_MAX = 160

/**
 * Advisory only. `UpdateShopInput.description` allows 10,000 characters, and
 * the same column is the storefront's long description — so this pane warns
 * past a short paragraph rather than truncating text written elsewhere.
 */
export const SHORT_DESCRIPTION_SOFT_MAX = 300

/** The form keys this module owns. */
export type BrandKey =
  | "description"
  | "slogan"
  | "logo"
  | "squareLogo"
  | "coverImage"
  | "primaryBackground"
  | "primaryForeground"
  | "secondaryBackground"
  | "secondaryForeground"
  | "socials"

export type BrandValues = Pick<GeneralValues, BrandKey>

function emptySocials(): Record<SocialNetwork, string> {
  return Object.fromEntries(SOCIAL_NETWORKS.map((n) => [n, ""])) as Record<
    SocialNetwork,
    string
  >
}

/** Server snapshot → the flat, always-defined shape the form edits. */
export function brandDefaults(shop: SettingsShop): BrandValues {
  const brand = shop.settings?.brand
  const colors = brand?.colors

  const socials = emptySocials()
  for (const entry of shop.socials ?? []) {
    if (isSocialNetwork(entry.name)) socials[entry.name] = entry.link ?? ""
  }

  return {
    description: shop.description ?? "",
    slogan: brand?.slogan ?? "",
    logo: shop.logo ?? null,
    squareLogo: brand?.square_logo ?? null,
    coverImage: shop.cover_image ?? null,
    primaryBackground: colors?.primary?.background ?? "",
    primaryForeground: colors?.primary?.foreground ?? "",
    secondaryBackground: colors?.secondary?.background ?? "",
    secondaryForeground: colors?.secondary?.foreground ?? "",
    socials,
  }
}

function pair(background: string, foreground: string) {
  const bg = normalizeHex(background)
  const fg = normalizeHex(foreground)
  if (!bg && !fg) return null
  return { background: bg, foreground: fg }
}

/**
 * The `brand` half of `ShopSettingsInput`.
 *
 * Anything the vendor left blank — or half-typed, like `#ab` — is sent as
 * `null` rather than as itself: the back-end rejects a colour that is not
 * `#RRGGBB`, and a validation error naming `settings.brand.colors.primary`
 * would surface on a save bar with nothing to point at.
 */
export function brandSettingsInput(values: BrandValues) {
  const primary = pair(values.primaryBackground, values.primaryForeground)
  const secondary = pair(values.secondaryBackground, values.secondaryForeground)

  return {
    slogan: values.slogan.trim() || null,
    square_logo: toImageInput(values.squareLogo),
    colors: primary || secondary ? { primary, secondary } : null,
  }
}

/**
 * `ImageInput` is three required fields, so a partially-shaped image would be
 * rejected by GraphQL itself. Anything incomplete becomes `null` — "no image"
 * — which is also how the field is cleared.
 */
export function toImageInput(
  image: SettingsImage | null,
): SettingsImage | null {
  if (!image?.id || !image.original) return null
  return {
    id: image.id,
    original: image.original,
    thumbnail: image.thumbnail || image.original,
  }
}

/**
 * A media-library row as a slot value.
 *
 * Two things open the library picker for a logo — the slot's own "From
 * library" item and the Logos card's footer — and both stage what it returns.
 * One mapping rather than one per caller, because the two would otherwise be
 * free to drift and stage different shapes for the same file.
 */
export function fileToSettingsImage(
  file: Pick<FileEntry, "id" | "url" | "thumbnail">,
): SettingsImage {
  return {
    id: file.id,
    original: file.url,
    thumbnail: file.thumbnail || file.url,
  }
}

/**
 * The `socials` array for `UpdateShopInput`.
 *
 * `ShopsService.update` **replaces** the whole set when `socials` is present,
 * so a network this pane does not render would be deleted by any save. Rows
 * whose `name` is not one of ours are therefore carried through untouched —
 * that is what `extras` is for, and dropping it is a silent data loss with no
 * error and no undo.
 */
export function socialsInput(
  values: BrandValues,
  shop: SettingsShop,
): Array<{ name: string; link: string }> {
  const known = SOCIAL_NETWORKS.flatMap((network) => {
    const link = normalizeSocialUrl(values.socials[network] ?? "")
    return link ? [{ name: network, link }] : []
  })

  const extras = (shop.socials ?? [])
    .filter((entry) => !isSocialNetwork(entry.name) && entry.link)
    .map((entry) => ({ name: entry.name, link: entry.link }))

  return [...known, ...extras]
}

/** Value-based dirty check for the brand half, so Save sends only what moved. */
export function brandChanged(values: BrandValues, snapshot: BrandValues) {
  return JSON.stringify(values) !== JSON.stringify(snapshot)
}
