"use client"

import { useQuery } from "@apollo/client/react"

import { SHOP_STOREFRONT_TEMPLATE } from "./api"
import { isStorefrontTemplateId, type StorefrontTemplateId } from "./registry"

interface ShopStorefrontTemplateData {
  shop?: {
    data?: {
      id: string
      storefront_template?: string | null
      storefront_theme?: unknown
    } | null
  } | null
}

/**
 * The template this shop has chosen, or null for the default storefront.
 *
 * `undefined` while the first answer is still in flight, so a screen can
 * avoid painting the default and then swapping it for the chosen template.
 */
export function useShopStorefrontTemplate(shopSlug: string | undefined): {
  templateId: StorefrontTemplateId | null | undefined
  theme: unknown | undefined
  refetch: () => Promise<unknown>
} {
  const { data, loading, refetch } = useQuery<ShopStorefrontTemplateData>(
    SHOP_STOREFRONT_TEMPLATE,
    {
      variables: { slug: shopSlug ?? "" },
      skip: !shopSlug,
    },
  )
  const raw = data?.shop?.data?.storefront_template
  const templateId = !shopSlug
    ? null
    : loading && data === undefined
      ? undefined
      : raw && isStorefrontTemplateId(raw)
        ? raw
        : null
  const theme =
    !shopSlug || (loading && data === undefined)
      ? undefined
      : (data?.shop?.data?.storefront_theme ?? null)
  return { templateId, theme, refetch }
}
