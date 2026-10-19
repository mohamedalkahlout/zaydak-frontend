import type { ApolloClient } from "@apollo/client"

import {
  CREATE_SHOP,
  ENABLED_COUNTRY_PROFILES,
  GET_MY_SHOPS,
} from "@/features/shops/api"
import type { CreateShopResponse, MyShopsResponse } from "@/features/shops/types"
import { refreshAccessToken } from "@/shared/lib/auth/refresh"

import { mintTemporaryHandle } from "./temporary-store"

export interface EnsuredVendorShop {
  /** The shop to open. */
  slug: string
  /** Every handle the vendor currently holds, `slug` included. */
  slugs: string[]
}

/**
 * Resolve a shop slug for the signed-in vendor, creating one when they have none.
 *
 * Auto-create only when exactly one CountryProfile is enabled (Palestine launch).
 * Multiple markets require `/create-store` so the merchant declares home_country.
 */
export async function ensureVendorShop(
  client: ApolloClient,
  temporaryName: string,
): Promise<EnsuredVendorShop> {
  const { data } = await client.query<MyShopsResponse>({
    query: GET_MY_SHOPS,
    fetchPolicy: "network-only",
  })
  const shops = data?.myShops?.data ?? []
  if (shops.length > 0) {
    return { slug: shops[0]!.slug, slugs: shops.map((shop) => shop.slug) }
  }

  const { data: markets } = await client.query<{
    enabledCountryProfiles: {
      success: boolean
      data: { country_code: string }[]
    }
  }>({
    query: ENABLED_COUNTRY_PROFILES,
    fetchPolicy: "network-only",
  })
  const enabled = markets?.enabledCountryProfiles?.data ?? []
  if (enabled.length !== 1) {
    throw new Error("create-store-required")
  }
  const homeCountry = enabled[0]!.country_code

  const { data: created } = await client.mutate<CreateShopResponse>({
    mutation: CREATE_SHOP,
    variables: {
      input: {
        name: temporaryName,
        slug: mintTemporaryHandle(),
        home_country: homeCountry,
      },
    },
  })

  const slug = created?.createShop?.data?.slug
  if (!created?.createShop?.success || !slug) {
    throw new Error("createShop failed")
  }

  try {
    await refreshAccessToken()
  } catch {
    // Non-fatal: dashboard will re-auth if the old token is still usable.
  }

  return { slug, slugs: [slug] }
}
