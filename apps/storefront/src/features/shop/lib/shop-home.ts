import {
  applyDoughnTheme,
  slotsFromProducts,
  type DoughnShopFacts,
  type DoughnThemeSettings,
  type ThemeProductRow,
} from "@repo/storefront-templates/doughn/theme"

export {
  storefrontCheckoutKind,
  storefrontHomeKind,
  templateOwnsCheckout,
  templateOwnsHome,
} from "./home-kind"
export type { StorefrontCheckoutKind, StorefrontHomeKind } from "./home-kind"

/** The shop home is `/` on a shop host and `/{slug}` on the apex. */
export function isShopHomePath(pathname: string, base: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname || "/"
  if (!base) return path === "/"
  const home = base.length > 1 ? base.replace(/\/+$/, "") : base
  return path === home
}

/** Checkout is `/checkout` on a shop host and `/{slug}/checkout` on the apex. */
export function isCheckoutPath(pathname: string, base: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname || "/"
  if (!base) return path === "/checkout"
  const home = base.length > 1 ? base.replace(/\/+$/, "") : base
  return path === `${home}/checkout`
}

export interface DoughnShopPlace {
  formattedAddress?: string | null
  city?: string | null
  district?: string | null
  lat?: number | null
  lng?: number | null
}

/** The visit line: the merchant's formatted address, or district and city. */
export function doughnAddressLine(
  place: DoughnShopPlace | null | undefined,
): string | undefined {
  const formatted = place?.formattedAddress?.trim()
  if (formatted) return formatted
  const parts = [place?.district, place?.city]
    .map((part) => part?.trim())
    .filter((part): part is string => !!part)
  return parts.length ? parts.join(", ") : undefined
}

export function doughnShopFacts(input: {
  name?: string | null
  timeZone?: string | null
  place?: DoughnShopPlace | null
}): DoughnShopFacts {
  const place = input.place
  return {
    name: input.name,
    timeZone: input.timeZone,
    address: doughnAddressLine(place),
    city: place?.city,
    lat: place?.lat,
    lng: place?.lng,
  }
}

/**
 * The doughn home's content: saved copy and photos over the sample, and
 * collection products when one is chosen. An empty field keeps the sample.
 * The shop's name, address and time zone replace the sample when they are set.
 * Opening hours stay the sample.
 */
export function doughnHomeContent(
  theme: unknown,
  rows: ThemeProductRow[],
  base: string,
  currency: string,
  shop?: DoughnShopFacts | null,
) {
  const settings = (theme ?? null) as DoughnThemeSettings | null
  return applyDoughnTheme(
    settings,
    settings?.collectionId
      ? slotsFromProducts(rows, (product) => `${base}/products/${product}`)
      : undefined,
    { currency, shop },
  )
}
