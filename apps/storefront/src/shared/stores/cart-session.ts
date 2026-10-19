import { create } from "zustand"

import {
  getOrCreateCartSessionId,
  peekCartSessionId,
} from "@/shared/lib/cart-session"

/**
 * The anonymous cart identity, held once for the whole app.
 *
 * This used to be a `useState` + effect inside `useCart`, which meant every
 * component calling the hook owned a *separate* copy: a catalogue page renders
 * one `QuickAddButton` per tile, so a 24-product grid ran 24 identical effects
 * and held 24 copies of the same string. Worse, each copy started as `null`, so
 * the first render of every one of them described a visitor with no identity at
 * all.
 *
 * That last part was not free. `CartRepository.getOrCreateCart` **throws**
 * when it is handed neither a user nor a session id, so a signed-out visitor's
 * first `StorefrontCart` query was guaranteed to fail before a second, correct
 * one went out. `useCart` now skips the query until `sessionId` is non-null,
 * and this store is what makes that one shared decision rather than N.
 *
 * `adopt()` is idempotent, so every consumer can call it on mount and only the
 * first does any work.
 */

interface CartSessionState {
  /** Null until `adopt()` runs — it can only be read in the browser. */
  sessionId: string | null
  /** Read the cookie, minting an id on first use. Safe to call repeatedly. */
  adopt: () => string | null
  /** Sign-out hands the visitor back to their anonymous cart. */
  reset: () => void
}

export const useCartSessionStore = create<CartSessionState>((set, get) => ({
  sessionId: null,

  adopt: () => {
    const current = get().sessionId
    if (current) return current

    // `peek` before `getOrCreate` so a returning visitor's existing cart is
    // adopted rather than replaced — minting unconditionally would hand every
    // reload a new empty cart.
    const adopted = peekCartSessionId() ?? getOrCreateCartSessionId()
    if (adopted) set({ sessionId: adopted })
    return adopted
  },

  reset: () => set({ sessionId: peekCartSessionId() }),
}))

/** Non-reactive read, for callers outside React (the Apollo links, mostly). */
export function currentCartSessionId(): string | null {
  return useCartSessionStore.getState().sessionId
}
