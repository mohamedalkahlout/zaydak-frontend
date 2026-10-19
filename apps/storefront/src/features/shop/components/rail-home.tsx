"use client"

import { useMemo } from "react"
import { useQuery } from "@apollo/client/react"
import { useLocale } from "next-intl"

import { RailTemplate } from "@repo/storefront-templates/rail"

import { STOREFRONT_PRODUCTS } from "@/features/catalog/api"
import { railPiecesFromProducts } from "@/features/shop/lib/rail-pieces"

/**
 * The public home when the shop's template is rail. The pieces are the
 * shop's catalogue. Until that list arrives, and when it has no photos,
 * the sample rail stays up so the page is not an empty bar.
 */
export function RailStorefrontHome({ base }: { base: string }) {
  const locale = useLocale()
  const { data, loading } = useQuery(STOREFRONT_PRODUCTS, {
    variables: { filters: { limit: 12 } },
  })
  const pieces = useMemo(
    () => railPiecesFromProducts(data?.storefrontProducts.data ?? [], base, locale),
    [base, data, locale],
  )

  if (loading && !data) return <div className="rail-tpl" />

  return <RailTemplate pieces={pieces.length > 0 ? pieces : undefined} />
}
