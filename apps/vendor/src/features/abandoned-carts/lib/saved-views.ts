"use client"

import { useCallback, useSyncExternalStore } from "react"
import {
  parseAbandonedCartsQueryState,
  toAbandonedCartsSearchParams,
  type AbandonedCartsQueryState,
} from "./query-state"

const listeners = new Map<string, Set<() => void>>()
export const MAX_SAVED_VIEWS = 8
export const SAVED_VIEW_NAME_MAX = 40

export interface AbandonedCartsSavedView {
  id: string
  name: string
  /** Query string as `toAbandonedCartsSearchParams` would write it. */
  params: string
}

function emit(key: string) {
  listeners.get(key)?.forEach((listener) => listener())
}

function subscribe(key: string, onStoreChange: () => void) {
  let set = listeners.get(key)
  if (!set) {
    set = new Set()
    listeners.set(key, set)
  }
  set.add(onStoreChange)
  return () => {
    set?.delete(onStoreChange)
  }
}

export function savedViewsKey(shopSlug: string) {
  return `vendor.abandoned-carts.views.${shopSlug}`
}

export function parseSavedViews(raw: unknown): AbandonedCartsSavedView[] {
  if (!Array.isArray(raw)) return []
  const views: AbandonedCartsSavedView[] = []
  for (const row of raw) {
    if (!row || typeof row !== "object") continue
    const rec = row as Record<string, unknown>
    if (typeof rec.id !== "string" || typeof rec.name !== "string") continue
    if (typeof rec.params !== "string") continue
    const name = rec.name.trim().slice(0, SAVED_VIEW_NAME_MAX)
    if (!name) continue
    views.push({ id: rec.id, name, params: rec.params })
    if (views.length >= MAX_SAVED_VIEWS) break
  }
  return views
}

function read(key: string): AbandonedCartsSavedView[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    return parseSavedViews(JSON.parse(raw) as unknown)
  } catch {
    return []
  }
}

export function snapshotQueryState(state: AbandonedCartsQueryState): string {
  return toAbandonedCartsSearchParams({ ...state, page: 1 }).toString()
}

export function queryStateFromSnapshot(params: string): AbandonedCartsQueryState {
  return parseAbandonedCartsQueryState(new URLSearchParams(params))
}

export function useSavedViews(shopSlug: string): {
  views: AbandonedCartsSavedView[]
  save: (name: string, state: AbandonedCartsQueryState) => AbandonedCartsSavedView | null
  remove: (id: string) => void
} {
  const key = savedViewsKey(shopSlug)
  const snapshot = useSyncExternalStore(
    (onStoreChange) => subscribe(key, onStoreChange),
    () => window.localStorage.getItem(key) ?? "",
    () => "",
  )
  const views = snapshot ? read(key) : []

  const write = useCallback(
    (next: AbandonedCartsSavedView[]) => {
      window.localStorage.setItem(key, JSON.stringify(next))
      emit(key)
    },
    [key],
  )

  const save = useCallback(
    (name: string, state: AbandonedCartsQueryState) => {
      const trimmed = name.trim().slice(0, SAVED_VIEW_NAME_MAX)
      if (!trimmed) return null
      const current = read(key)
      if (current.length >= MAX_SAVED_VIEWS) return null
      const view: AbandonedCartsSavedView = {
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `view-${Date.now()}`,
        name: trimmed,
        params: snapshotQueryState(state),
      }
      write([...current, view])
      return view
    },
    [key, write],
  )

  const remove = useCallback(
    (id: string) => {
      write(read(key).filter((view) => view.id !== id))
    },
    [key, write],
  )

  return { views, save, remove }
}
