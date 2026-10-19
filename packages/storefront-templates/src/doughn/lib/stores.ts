import { useCallback, useSyncExternalStore } from "react"

import type { Lang } from "../types"

/* ---------- story state: what the nav and the captions show while the street scrolls
   The scroll handler writes it on every frame; a store rather than React state on the
   template root, so only the components that read it re-render, and only on change. */

export interface StoryState {
  /** story time, whole minutes after midnight */
  minute: number
  /** past the street: the nav shows the real time instead */
  live: boolean
  /** the nav wordmark is showing */
  mark: boolean
  /** the nav sits over a light section */
  light: boolean
  /** index into the captions, -1 for none */
  caption: number
}

export type StoryStore = ReturnType<typeof createStoryStore>

export function createStoryStore() {
  let state: StoryState = { minute: 240, live: false, mark: false, light: false, caption: -1 }
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    set(patch: Partial<StoryState>) {
      const next = { ...state, ...patch }
      const keys = Object.keys(patch) as (keyof StoryState)[]
      if (keys.every((k) => next[k] === state[k])) return
      state = next
      listeners.forEach((l) => l())
    },
  }
}

export function useStory(store: StoryStore) {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}

/* ---------- the visitor's language choice, kept across visits
   Read through useSyncExternalStore so the server render (and hydration) uses the
   template's default, and the stored choice arrives on the client without an effect. */

const LANG_KEY = "doughn.lang"
const langListeners = new Set<() => void>()
let chosen: Lang | null | undefined // undefined: not read yet

function readLang(): Lang | null {
  if (chosen !== undefined) return chosen
  chosen = null
  try {
    const asked = new URLSearchParams(window.location.search).get("lang") ?? window.localStorage.getItem(LANG_KEY)
    if (asked === "en" || asked === "ar") chosen = asked
  } catch {
    // storage can be blocked; the default language it is
  }
  return chosen
}

function subscribeLang(listener: () => void) {
  langListeners.add(listener)
  return () => {
    langListeners.delete(listener)
  }
}

export function useTemplateLang(fallback: Lang): [Lang, (lang: Lang) => void] {
  const lang = useSyncExternalStore(
    subscribeLang,
    () => readLang() ?? fallback,
    () => fallback,
  )
  const setLang = useCallback((next: Lang) => {
    chosen = next
    try {
      window.localStorage.setItem(LANG_KEY, next)
    } catch {
      // not persisted; still switched for this visit
    }
    langListeners.forEach((l) => l())
  }, [])
  return [lang, setLang]
}

/* ---------- media queries */

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (listener) => {
      const mq = window.matchMedia(query)
      mq.addEventListener("change", listener)
      return () => mq.removeEventListener("change", listener)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
