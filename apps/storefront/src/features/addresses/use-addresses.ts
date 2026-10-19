"use client"

import { useCallback, useMemo } from "react"
import { useMutation, useQuery } from "@apollo/client/react"

import {
  CREATE_ADDRESS,
  DELETE_ADDRESS,
  MY_ADDRESSES,
  UPDATE_ADDRESS,
} from "./api"
import { readAddress, type Address, type AddressType } from "./lib/address"
import type { StorefrontMyAddressesQuery } from "@/shared/api/generated/graphql"

export type AddressEntry = StorefrontMyAddressesQuery["myAddresses"]["data"][number]

/** A saved address with its JSON blob already read into the form's shape. */
export interface SavedAddress {
  id: string
  title: string
  type: string
  default: boolean
  address: Address
}

/**
 * A page big enough to be the whole list for anyone.
 *
 * `myAddresses` is paginated and `clampLimit` caps it server-side, but a
 * customer with more saved addresses than this is not a case worth building a
 * pager for — and a pager on the *checkout* would be a way to lose an address
 * behind a page-2 button at the exact moment it is needed. The screens show the
 * count against `meta.total` so a truncated list is at least visible.
 */
export const ADDRESS_PAGE_SIZE = 50

/**
 * Saved addresses, as one hook.
 *
 * Both screens that touch addresses — the account list and the checkout picker
 * — read through this so they share one cache entry and one notion of which
 * address is the default. The variables are identical at both call sites on
 * purpose: Apollo keys a cached query by its variables, so a different `limit`
 * here would silently mean two lists and two loading states.
 *
 * Every mutation is `awaitRefetchQueries` against `MY_ADDRESSES` rather than a
 * hand-written cache update, because **`default` is exclusive server-side** —
 * saving one row as default clears the flag on every other row, and no
 * single-entry cache write can know which ones those were.
 */
export function useAddresses() {
  const variables = { page: 1, limit: ADDRESS_PAGE_SIZE }

  const { data, loading, error, refetch } = useQuery(MY_ADDRESSES, {
    variables,
    // The list is small and the customer may have edited it in another tab
    // between visits; re-reading on mount keeps the checkout picker honest
    // while still painting instantly from cache.
    fetchPolicy: "cache-and-network",
  })

  const refetchOptions = {
    refetchQueries: [{ query: MY_ADDRESSES, variables }],
    awaitRefetchQueries: true,
  }

  const [createMutation, createState] = useMutation(CREATE_ADDRESS, refetchOptions)
  const [updateMutation, updateState] = useMutation(UPDATE_ADDRESS, refetchOptions)
  const [deleteMutation, deleteState] = useMutation(DELETE_ADDRESS, refetchOptions)

  const entries = data?.myAddresses.data

  const addresses = useMemo<SavedAddress[]>(() => {
    const rows = (entries ?? []).map((entry) => ({
      id: entry.id,
      title: entry.title,
      type: entry.type,
      default: entry.default,
      address: readAddress(entry.address),
    }))

    // The server orders by `created_at desc`. Floating the default to the top
    // is what makes the checkout's first card the one that will actually be
    // used, rather than the most recently added one.
    return rows.sort((a, b) => Number(b.default) - Number(a.default))
  }, [entries])

  const create = useCallback(
    (input: {
      title: string
      type: AddressType
      default: boolean
      address: Address
    }) => createMutation({ variables: { input } }),
    [createMutation],
  )

  const update = useCallback(
    (input: {
      id: string
      title: string
      type: AddressType
      default: boolean
      address: Address
    }) => updateMutation({ variables: { input } }),
    [updateMutation],
  )

  const remove = useCallback(
    (id: string) => deleteMutation({ variables: { id } }),
    [deleteMutation],
  )

  /**
   * Promote one row to default.
   *
   * Sent as a bare `{ id, default: true }` — `UpdateAddressInput` treats every
   * other field as optional and `AddressesService.update` only writes the keys
   * present, so this cannot round-trip the address blob back through the
   * client. Re-sending it would be a chance to write a stale copy.
   */
  const setDefault = useCallback(
    (id: string) => updateMutation({ variables: { input: { id, default: true } } }),
    [updateMutation],
  )

  return {
    addresses,
    /** What the server says exists, which can exceed the page above. */
    total: data?.myAddresses.meta.total ?? addresses.length,
    /** The row checkout starts on: the explicit default, else the newest. */
    preferred: addresses.find((entry) => entry.default) ?? addresses[0] ?? null,
    loading,
    error,
    mutating: createState.loading || updateState.loading || deleteState.loading,
    create,
    update,
    remove,
    setDefault,
    refetch,
  }
}
