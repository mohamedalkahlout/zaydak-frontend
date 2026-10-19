"use client"

import { useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@apollo/client/react"
import { GET_PRODUCTS } from "@/features/products/api"
import type { Product, ProductsResponse } from "@/features/products/types"
import { PAGE_SIZE } from "@/features/products/lib/list/constants"
import { productName } from "@/features/products/lib/list/helpers"
import {
  parseProductListQueryState,
  toProductListVariables,
} from "@/features/products/lib/list/query-state"

export interface ProductNeighbor {
  slug: string
  name: string
  /** The list page the neighbour sits on, so its href keeps the context. */
  page: number
}

export interface ProductNeighbors {
  previous?: ProductNeighbor
  next?: ProductNeighbor
  loading: boolean
}

function toNeighbor(product: Product | undefined, page: number) {
  if (!product) return undefined
  return { slug: product.slug, name: productName(product.name), page }
}

/**
 * The two products either side of this one, for the header's up/down arrows.
 *
 * The list context travels in the URL: a row links to
 * `.../{slug}/edit?{the list's own query string}`, so this hook can re-parse
 * exactly the filters, sort and page the vendor was looking at and ask for the
 * same page again. With identical variables that read is an Apollo cache hit —
 * arriving from the list costs no request, and the arrows walk the list the
 * vendor actually built rather than some canonical order of our own.
 *
 * Landing on the edit URL directly (a bookmark, a link in chat) carries no
 * query string, so the defaults stand in: page 1, newest first. The product is
 * then usually absent from that page, `index` is -1, and both arrows are
 * disabled — which is the honest answer, because there is no list to step
 * through.
 *
 * Page edges are why there are three queries and not one: the row before the
 * first on page 3 is the last row of page 2, so an edge fetches the adjacent
 * page and takes the one row it needs from it.
 */
export function useProductNeighbors(slug: string): ProductNeighbors {
  const searchParams = useSearchParams()
  const state = useMemo(
    () => parseProductListQueryState(searchParams, PAGE_SIZE),
    [searchParams],
  )

  const current = useQuery<ProductsResponse>(GET_PRODUCTS, {
    variables: toProductListVariables(state),
  })

  const rows = current.data?.products?.data ?? []
  const meta = current.data?.products?.meta
  const page = meta?.page ?? state.page
  const totalPages = Math.max(meta?.total_pages ?? 1, 1)
  const index = rows.findIndex((p) => p.slug === slug)

  const wantsPrevPage = index === 0 && page > 1
  const wantsNextPage =
    index >= 0 && index === rows.length - 1 && page < totalPages

  const prevPage = useQuery<ProductsResponse>(GET_PRODUCTS, {
    variables: toProductListVariables({ ...state, page: page - 1 }),
    skip: !wantsPrevPage,
  })
  const nextPage = useQuery<ProductsResponse>(GET_PRODUCTS, {
    variables: toProductListVariables({ ...state, page: page + 1 }),
    skip: !wantsNextPage,
  })

  const prevRows = prevPage.data?.products?.data ?? []
  const nextRows = nextPage.data?.products?.data ?? []

  const loading =
    current.loading ||
    (wantsPrevPage && prevPage.loading) ||
    (wantsNextPage && nextPage.loading)

  if (index < 0) return { previous: undefined, next: undefined, loading }

  return {
    previous:
      index > 0
        ? toNeighbor(rows[index - 1], page)
        : toNeighbor(prevRows[prevRows.length - 1], page - 1),
    next:
      index < rows.length - 1
        ? toNeighbor(rows[index + 1], page)
        : toNeighbor(nextRows[0], page + 1),
    loading,
  }
}
