"use client"

import { useQuery } from "@apollo/client/react"
import { GET_MY_ENTITLEMENTS, GET_MY_USAGE } from "../api/queries"
import { featureState, type FeatureState } from "./entitlements"
import type { EntitlementEntry, UsageEntry } from "../types"

/**
 * What the shop's plan allows for one capability, and what is left of it.
 *
 * **One query pair for the whole app, not one per gate.** Both documents are
 * shared Apollo cache entries, so twenty gated buttons cost two network reads
 * on first paint and none after — the alternative is twenty round trips to
 * render one screen.
 *
 * Both queries use `cache-and-network`: usage moves the moment anything is
 * consumed, and entitlements move when `seed:plans` (or an admin edit) grants
 * a new key. A bare `cache-first` map kept showing "not on plan" for
 * `ai.negotiation` after the row existed in Postgres, because the browser
 * never asked again.
 */
export function useFeature(key: string): FeatureState & { loading: boolean } {
  const {
    data: entData,
    loading: entLoading,
    error: entError,
  } = useQuery<{
    myEntitlements: { success: boolean; data?: EntitlementEntry[] }
  }>(GET_MY_ENTITLEMENTS, { fetchPolicy: "cache-and-network" })

  const { data: usageData, loading: usageLoading } = useQuery<{
    myUsage: { success: boolean; data?: UsageEntry[] }
  }>(GET_MY_USAGE, { fetchPolicy: "cache-and-network" })

  const entitlements = entData?.myEntitlements.data
  const state = featureState(key, entitlements, usageData?.myUsage.data)

  // `featureState` treats a missing map as DENIED. While the query has not
  // answered yet that would flash (or stick) every gated card as "not on
  // plan" — stay in loading until the map arrives, or until the query fails.
  const mapPending = !entError && entitlements === undefined

  return {
    ...state,
    allowed: mapPending ? false : state.allowed,
    loading: entLoading || usageLoading || mapPending,
  }
}

/**
 * The AI-image allowance, for the surfaces that spend it.
 *
 * A named wrapper rather than a bare string at each call site: the key is a
 * server contract, and one typo would silently render a denied capability as
 * "unlimited" — `featureState` returns DENIED for an unknown key, and DENIED
 * has `remaining: null`, which the counter reads as no cap.
 */
export function useAiImageQuota() {
  return useFeature("ai.image.generate")
}
