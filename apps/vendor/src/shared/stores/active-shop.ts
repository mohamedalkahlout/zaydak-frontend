import { create } from "zustand"
import { ACTIVE_SHOP_KEY } from "@/shared/lib/auth/cookie-names"
import { getCookie, removeCookie, setCookie } from "@/shared/lib/cookies"

/**
 * Active shop selection.
 *
 * The same slug is mirrored across three places so each layer can read it
 * without coordination:
 *
 *  - in-memory (this store) for client-side Apollo + UI
 *  - localStorage so the slug survives page reloads
 *  - a non-httpOnly cookie (`active_shop_slug`) that the middleware writes
 *    when navigating /store/{slug} and that server-side Apollo reads
 *    to scope its X-SHOP header
 *
 * `setSlug` writes all three; `clear()` removes all three. `hydrate` is
 * called from the ApolloWrapper after mount so the initial render matches
 * SSR (we don't touch localStorage at module-init).
 */

interface ActiveShopState {
  slug: string | null
  currency: string | null
  setSlug: (slug: string) => void
  setCurrency: (currency: string | null) => void
  clear: () => void
  hydrate: () => void
}

const ACTIVE_SHOP_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days
export const ACTIVE_SHOP_CURRENCY_KEY = "active_shop_currency"

export const useActiveShopStore = create<ActiveShopState>((set) => ({
  slug: null,
  currency: null,

  setSlug: (slug) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(ACTIVE_SHOP_KEY, slug)
      setCookie(ACTIVE_SHOP_KEY, slug, { maxAge: ACTIVE_SHOP_COOKIE_MAX_AGE })
    }
    set({ slug })
  },

  setCurrency: (currency) => {
    if (typeof window !== "undefined") {
      if (currency) {
        localStorage.setItem(ACTIVE_SHOP_CURRENCY_KEY, currency)
      } else {
        localStorage.removeItem(ACTIVE_SHOP_CURRENCY_KEY)
      }
    }
    set({ currency })
  },

  clear: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(ACTIVE_SHOP_KEY)
      localStorage.removeItem(ACTIVE_SHOP_CURRENCY_KEY)
      removeCookie(ACTIVE_SHOP_KEY)
    }
    set({ slug: null, currency: null })
  },

  hydrate: () => {
    if (typeof window === "undefined") return
    // Cookie wins because the middleware refreshes it from the URL on every
    // dashboard navigation. localStorage is the fallback for first-load
    // before any /store/{slug} hit.
    const slug =
      getCookie(ACTIVE_SHOP_KEY) ?? localStorage.getItem(ACTIVE_SHOP_KEY)
    const currency = localStorage.getItem(ACTIVE_SHOP_CURRENCY_KEY)
    set({ slug, currency })
  },
}))
