"use client"

import { useCallback, useSyncExternalStore } from "react"
import type { VisibilityState } from "@tanstack/react-table"

const listeners = new Map<string, Set<() => void>>()

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

function read(key: string): VisibilityState | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null
    }
    return parsed as VisibilityState
  } catch {
    return null
  }
}

export function columnPrefsKey(shopSlug: string, view: "customer" | "product") {
  return `vendor.abandoned-carts.columns.${shopSlug}.${view}`
}

export function useColumnVisibility(
  key: string,
  fallback: VisibilityState,
): [VisibilityState, (next: VisibilityState) => void] {
  const snapshot = useSyncExternalStore(
    (onStoreChange) => subscribe(key, onStoreChange),
    () => window.localStorage.getItem(key) ?? "",
    () => "",
  )
  const stored = snapshot ? read(key) : null
  const value = stored ?? fallback
  const set = useCallback(
    (next: VisibilityState) => {
      window.localStorage.setItem(key, JSON.stringify(next))
      emit(key)
    },
    [key],
  )
  return [value, set]
}
