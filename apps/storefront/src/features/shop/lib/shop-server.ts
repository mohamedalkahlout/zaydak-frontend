import "server-only"

import { GRAPHQL_URL } from "@/shared/apollo/endpoint"
import { tunnelHeaders } from "@/shared/apollo/tunnel-headers"

/**
 * A server-side read of the shop, for the two things that have to be decided
 * before the page paints: the document metadata, and the brand colours.
 *
 * It is a plain `fetch` rather than Apollo because this app's client is
 * client-only (`ApolloNextAppProvider`) — there is no RSC client to reuse. The
 * alternative was to inject the colours from `ShopProvider` once its query
 * resolved, which works but repaints the accent a few hundred milliseconds in;
 * a brand colour arriving late is exactly the thing a vendor would notice.
 *
 * `shop(slug)` is `OptionalJwtGuard` only and needs no `X-SHOP`, so this call
 * carries no credentials and is safe to cache. A failure returns `null` and the
 * storefront falls back to its own palette and title — this must never be the
 * reason a page 500s.
 */


/** A shop's identity changes about never; an hour of staleness costs nothing. */
const REVALIDATE_SECONDS = 3600

const QUERY = /* GraphQL */ `
  query StorefrontShopShell($slug: String!) {
    shop(slug: $slug) {
      data {
        id
        name
        slug
        description
        logo {
          original
          thumbnail
        }
        cover_image {
          original
        }
        settings {
          email
          policies {
            refund_policy
            privacy_policy
            terms_of_service
            shipping_policy
          }
          brand {
            slogan
            square_logo {
              original
              thumbnail
            }
            colors {
              primary {
                background
                foreground
              }
              secondary {
                background
                foreground
              }
            }
          }
        }
      }
    }
  }
`

interface ShellImage {
  original?: string | null
  thumbnail?: string | null
}

export interface ShellColorPair {
  background?: string | null
  foreground?: string | null
}

export interface ShellPolicies {
  refund_policy?: string | null
  privacy_policy?: string | null
  terms_of_service?: string | null
  shipping_policy?: string | null
}

export interface ShopShellData {
  id: string
  /**
   * The shop's **current** handle, which is not necessarily the one asked for:
   * `shop(slug)` resolves a retired handle too. The layout compares the two to
   * decide whether the visitor is standing on an old address.
   */
  slug: string
  name: string
  description?: string | null
  logo?: ShellImage | null
  cover_image?: ShellImage | null
  settings?: {
    email?: string | null
    policies?: ShellPolicies | null
    brand?: {
      slogan?: string | null
      square_logo?: ShellImage | null
      colors?: {
        primary?: ShellColorPair | null
        secondary?: ShellColorPair | null
      } | null
    } | null
  } | null
}

export interface StorefrontPlace {
  formattedAddress?: string | null
  city?: string | null
  district?: string | null
  lat?: number | null
  lng?: number | null
}

export interface StorefrontPresentation {
  template: string | null
  theme: unknown
  currency: string
  name: string
  timeZone: string | null
  place: StorefrontPlace | null
  businessModel: string
}

const THEME_QUERY = /* GraphQL */ `
  query StorefrontPresentation($slug: String!) {
    shop(slug: $slug) {
      data {
        name
        business_model
        storefront_template
        storefront_theme
        currency
        timezone
        settings {
          location {
            formattedAddress
            city
            district
            lat
            lng
          }
        }
      }
    }
  }
`

/**
 * The template choice and its saved customization.
 *
 * Not cached: a merchant who saves copy should see it on the next load of
 * their own shop, and the hour-long shell cache is the wrong place for that.
 */
export async function fetchStorefrontPresentation(
  slug: string,
): Promise<StorefrontPresentation | null> {
  try {
    const res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...tunnelHeaders(GRAPHQL_URL),
      },
      body: JSON.stringify({ query: THEME_QUERY, variables: { slug } }),
      cache: "no-store",
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      data?: {
        shop?: {
          data?: {
            name?: string | null
            business_model?: string | null
            storefront_template?: string | null
            storefront_theme?: unknown
            currency?: string | null
            timezone?: string | null
            settings?: {
              location?: StorefrontPlace | null
            } | null
          } | null
        } | null
      } | null
    }
    const data = json.data?.shop?.data
    if (!data) return null
    return {
      template: data.storefront_template ?? null,
      theme: data.storefront_theme ?? null,
      currency: data.currency || "SAR",
      name: data.name ?? "",
      timeZone: data.timezone ?? null,
      place: data.settings?.location ?? null,
      businessModel: data.business_model ?? "OWN_PRODUCTS",
    }
  } catch {
    return null
  }
}

export async function fetchShopShell(
  slug: string,
): Promise<ShopShellData | null> {
  try {
    const res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...tunnelHeaders(GRAPHQL_URL),
      },
      body: JSON.stringify({ query: QUERY, variables: { slug } }),
      next: { revalidate: REVALIDATE_SECONDS, tags: [`shop:${slug}`] },
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      data?: { shop?: { data?: ShopShellData | null } | null } | null
    }
    return json.data?.shop?.data ?? null
  } catch {
    // A closed shop answers NOT_FOUND, which arrives as a GraphQL error rather
    // than a thrown one — both land here as "no shop", which is what the
    // caller wants either way.
    return null
  }
}
