import { create } from "zustand"

import {
  clearGuestWishlist,
  pruneGuestWishlist,
  readGuestWishlist,
  writeGuestWishlist,
} from "@/shared/lib/guest-wishlist"

/**
 * The signed-out wishlist, held once for the whole app.
 *
 * **A store rather than per-hook state, for the reason `cart-session` is one.**
 * A catalogue page mounts one `WishlistButton` per tile, and the product page
 * mounts another for the same product. They are all reading one fact — is this
 * saved — from storage that only the browser can answer, so a `useState` in the
 * hook would mean N copies of the same list and N first renders describing a
 * visitor who has saved nothing.
 *
 * More than wasteful here: for a signed-in visitor Apollo already keeps every
 * heart for one product in step, because `inWishlist` is a single cache entry
 * they all read. This store is what gives the signed-out path the same
 * property — saving from the grid repaints the heart on the product page
 * behind it, and removing from the saved-items page empties the heart on the
 * tile without either being told.
 *
 * `adopt(slug)` is idempotent per shop, so every consumer can call it on mount
 * and only the first does any work.
 */

interface GuestWishlistState {
  /** The shop the loaded ids belong to. Null until `adopt` runs. */
  slug: string | null
  ids: string[]
  /** Read storage for this shop, once. Safe to call repeatedly. */
  adopt: (slug: string) => void
  /** Add or remove, returning the state the product ended up in. */
  toggle: (slug: string, productId: string) => boolean
  /** Forget the shop's list — called once its contents reach an account. */
  clear: (slug: string) => void
 /**
   * Drop the staged ids the storefront no longer returns after the signed-out
   * list is rehydrated, mirroring the write to storage. A no-op when nothing
   * is missing.
   */
  prune: (slug: string, keepIds: ReadonlySet<string>) => void
}

export const useGuestWishlistStore = create<GuestWishlistState>((set, get) => ({
  slug: null,
  ids: [],

  adopt: (slug) => {
    // Re-read when the shop changes, not only on first call: this app serves
    // every storefront from one deployment, so a client navigation from
    // `/acme` to `/beta` keeps the store alive with the wrong shop's ids.
    if (get().slug === slug) return
    set({ slug, ids: readGuestWishlist(slug) })
  },

  toggle: (slug, productId) => {
    // Read through storage rather than trusting `ids`, so a save made in
    // another tab is not silently reverted by this one.
    const current = readGuestWishlist(slug)
    const saved = current.includes(productId)
    const next = saved
      ? current.filter((id) => id !== productId)
      : [...current, productId]

    writeGuestWishlist(slug, next)
    set({ slug, ids: next })
    return !saved
  },

  clear: (slug) => {
    clearGuestWishlist(slug)
    set({ slug, ids: [] })
  },

  prune: (slug, keepIds) => {
    pruneGuestWishlist(slug, keepIds)
    // The ids the write removed affect this store only when they are this
    // shop's — another shop's visit must not repaint the hearts here.
    if (get().slug !== slug) return
    set({ ids: readGuestWishlist(slug) })
  },
}))
