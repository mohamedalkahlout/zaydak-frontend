"use client"

import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { useLazyQuery, useQuery } from "@apollo/client/react"
import { GET_SHOP_COLLECTIONS } from "@/features/collections/api"
import { GET_PRODUCTS } from "@/features/products/api"
import { GET_ORDERS } from "@/features/orders/api"
import { GET_CONTACTS } from "@/features/customers/api"
import { GET_COUPONS } from "@/features/coupons/api"
import type { MentionCandidate, MentionType } from "./mention-config"

// Re-export so existing importers (`vendor-agent-chat`, `mention-dropdown`)
// keep resolving these from one place.
export type { MentionCandidate, MentionType } from "./mention-config"

interface Props {
  /** The drilled-in category. `null` = root menu (no entity search). */
  category: MentionType | null
  /** Search text typed after the "@" (filters within the category). */
  query: string
  /** Picks the vendor's language out of bilingual entity names. */
  locale: "ar" | "en"
  /** False until the caret enters an "@" token — gates all traffic. */
  active: boolean
}

/**
 * Per-category entity search for the hierarchical @-mention picker.
 *
 * Each category resolves against its own source: products and coupons hit
 * the server (both support a `search` arg, so requests stay small);
 * collections, orders, and customers are fetched once per open and filtered
 * client-side (small per-shop lists, and their queries lack a free-text
 * search). Only the active category's list is computed; the others stay
 * dormant behind `skip`/lazy guards.
 */
export function useMentionSearch({ category, query, locale, active }: Props) {
  const t = useTranslations("aiChat.mention")
  const collectionHint = t("collectionHint")
  const unnamed = t("unnamed")

  // Debounce the server-backed categories so we don't fire a request per
  // keystroke. Client-filtered categories read `query` directly for instant
  // feedback.
  const [debouncedQuery, setDebouncedQuery] = useState(query)
  // Clearing is immediate; only typing is debounced. Drilling into a category
  // resets the query to "", and a 180ms lag there meant the category's FIRST
  // request went out filtered by the token the vendor typed before clicking —
  // the server matches a coupon `search` against the code alone, so "@cou"
  // returned nothing and a shop full of coupons read as empty. Adjusted during
  // render rather than from an effect, so no frame is committed with the stale
  // query still driving the request.
  if (query === "" && debouncedQuery !== "") setDebouncedQuery("")
  useEffect(() => {
    if (query === "") return
    const t = setTimeout(() => setDebouncedQuery(query), 180)
    return () => clearTimeout(t)
  }, [query])

  // Products — server search (empty query returns recent).
  const [
    fetchProducts,
    { data: productsData, loading: productsLoading, error: productsError },
  ] = useLazyQuery(GET_PRODUCTS, { fetchPolicy: "cache-and-network" })

  // Coupons — server search (empty query returns recent).
  const [
    fetchCoupons,
    { data: couponsData, loading: couponsLoading, error: couponsError },
  ] = useLazyQuery(GET_COUPONS, { fetchPolicy: "cache-and-network" })

  // Orders — fetch a recent page once on drill-in, filter client-side.
  const [
    fetchOrders,
    { data: ordersData, loading: ordersLoading, error: ordersError },
  ] = useLazyQuery(GET_ORDERS, { fetchPolicy: "cache-and-network" })

  useEffect(() => {
    if (!active) return
    const q = debouncedQuery.trim()
    if (category === "product") {
      void fetchProducts({
        variables: { filters: { ...(q ? { search: q } : {}), limit: 8 } },
      })
    } else if (category === "coupon") {
      void fetchCoupons({
        variables: { page: 1, limit: 8, ...(q ? { search: q } : {}) },
      })
    }
  }, [active, category, debouncedQuery, fetchProducts, fetchCoupons])

  useEffect(() => {
    if (!active || category !== "order") return
    void fetchOrders({ variables: { filters: { page: 1, limit: 30 } } })
  }, [active, category, fetchOrders])

  // Collections — fetch once, filter client-side.
  const {
    data: collectionsData,
    loading: collectionsLoading,
    error: collectionsError,
  } = useQuery(GET_SHOP_COLLECTIONS, {
    variables: { page: 1, limit: 50 },
    fetchPolicy: "cache-first",
    skip: !active || category !== "collection",
  })

  // Customers (contacts) — fetch once, filter client-side.
  const {
    data: contactsData,
    loading: contactsLoading,
    error: contactsError,
  } = useQuery(GET_CONTACTS, {
    variables: { page: 1, limit: 100 },
    fetchPolicy: "cache-first",
    skip: !active || category !== "customer",
  })

  const candidates = useMemo<MentionCandidate[]>(() => {
    switch (category) {
      case "product":
        return normalizeProducts(productsData, locale)
      case "collection":
        return normalizeCollections(
          collectionsData,
          query,
          locale,
          collectionHint,
        )
      case "order":
        return normalizeOrders(ordersData, query)
      case "customer":
        return normalizeCustomers(contactsData, query, unnamed)
      case "coupon":
        return normalizeCoupons(couponsData)
      default:
        return []
    }
  }, [
    category,
    productsData,
    collectionsData,
    ordersData,
    contactsData,
    couponsData,
    query,
    locale,
    collectionHint,
    unnamed,
  ])

  // A category is still loading until its first answer lands — `useLazyQuery`
  // reports `loading: false` before `execute()` has run, and the two
  // `useQuery` categories never reported loading at all, so the picker painted
  // "No matches" in the gap before it had even asked. An error ends the wait
  // too, otherwise a failed request spins forever.
  const pending = (isLoading: boolean, data: unknown, err: unknown) =>
    isLoading || (!data && !err)

  const loading =
    (category === "product" && pending(productsLoading, productsData, productsError)) ||
    (category === "coupon" && pending(couponsLoading, couponsData, couponsError)) ||
    (category === "order" && pending(ordersLoading, ordersData, ordersError)) ||
    (category === "collection" &&
      pending(collectionsLoading, collectionsData, collectionsError)) ||
    (category === "customer" &&
      pending(contactsLoading, contactsData, contactsError))

  // Apollo's default errorPolicy blanks `data` on any error, so without this a
  // failed request is indistinguishable from an empty shop.
  const error =
    (category === "product" && productsError) ||
    (category === "coupon" && couponsError) ||
    (category === "order" && ordersError) ||
    (category === "collection" && collectionsError) ||
    (category === "customer" && contactsError) ||
    null

  return { candidates, loading, error: error || null }
}

/* ------------------------------- normalizers ------------------------------ */

function normalizeProducts(
  data: unknown,
  locale: "ar" | "en",
): MentionCandidate[] {
  const rows = rowsOf(data, "products")
  return rows.slice(0, 8).map((raw) => {
    const p = raw as { id: string; slug: string; name?: LocalizedName }
    return {
      type: "product",
      id: p.id,
      display: pickName(p.name, locale, p.slug),
      secondary: "/" + p.slug,
    }
  })
}

function normalizeCollections(
  data: unknown,
  query: string,
  locale: "ar" | "en",
  /** The row's second line — the kind, already translated. */
  hint: string,
): MentionCandidate[] {
  const rows = rowsOf(data, "collections")
  const q = query.trim().toLowerCase()
  const all: MentionCandidate[] = rows.map((raw) => {
    const c = raw as { id: string; slug: string; name?: LocalizedName }
    return {
      type: "collection",
      id: c.id,
      display: pickName(c.name, locale, c.slug),
      secondary: hint,
    }
  })
  if (!q) return all.slice(0, 8)
  return all
    .filter((c) => c.display.toLowerCase().includes(q))
    .slice(0, 8)
}

function normalizeOrders(data: unknown, query: string): MentionCandidate[] {
  const rows = rowsOf(data, "orders")
  const q = query.trim().toLowerCase()
  const all: MentionCandidate[] = rows.map((raw) => {
    const o = raw as {
      id: string
      tracking_number?: string | null
      order_status?: string | null
      customer?: { name?: string | null } | null
    }
    const label = o.tracking_number ? `#${o.tracking_number}` : o.id.slice(0, 8)
    const bits = [o.customer?.name, o.order_status].filter(Boolean)
    return {
      type: "order",
      id: o.id,
      display: label,
      secondary: bits.length ? bits.join(" · ") : undefined,
    }
  })
  if (!q) return all.slice(0, 8)
  return all
    .filter(
      (o) =>
        o.display.toLowerCase().includes(q) ||
        (o.secondary?.toLowerCase().includes(q) ?? false),
    )
    .slice(0, 8)
}

function normalizeCustomers(
  data: unknown,
  query: string,
  /** What a contact with no name is called, already translated. */
  unnamed: string,
): MentionCandidate[] {
  const rows = rowsOf(data, "contacts")
  const q = query.trim().toLowerCase()
  const all: MentionCandidate[] = rows.map((raw) => {
    const c = raw as {
      id: string
      name?: string | null
      phone_number?: string | null
    }
    return {
      type: "customer",
      id: c.id,
      display: c.name?.trim() || unnamed,
      secondary: c.phone_number ?? undefined,
    }
  })
  if (!q) return all.slice(0, 8)
  return all
    .filter(
      (c) =>
        c.display.toLowerCase().includes(q) ||
        (c.secondary?.toLowerCase().includes(q) ?? false),
    )
    .slice(0, 8)
}

function normalizeCoupons(data: unknown): MentionCandidate[] {
  const rows = rowsOf(data, "coupons")
  return rows.slice(0, 8).map((raw) => {
    const c = raw as {
      id: string
      code: string
      description?: string | null
    }
    return {
      type: "coupon",
      id: c.id,
      display: c.code,
      secondary: c.description ?? undefined,
    }
  })
}

/* --------------------------------- helpers -------------------------------- */

type LocalizedName = Record<string, string> | string | null

function rowsOf(data: unknown, root: string): unknown[] {
  const node = (data as Record<string, { data?: unknown[] }> | null)?.[root]
  return node?.data ?? []
}

function pickName(
  raw: LocalizedName | undefined,
  locale: "ar" | "en",
  fallback: string,
): string {
  if (!raw) return fallback
  if (typeof raw === "string") return raw
  return raw[locale] ?? raw.en ?? raw.ar ?? fallback
}
