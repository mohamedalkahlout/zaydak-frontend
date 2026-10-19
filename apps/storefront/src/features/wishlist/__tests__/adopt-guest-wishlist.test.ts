import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  adoptGuestWishlist,
  consumeWishlistMergeNotice,
} from "../adopt-guest-wishlist"
import { TOGGLE_WISHLIST, WISHLISTS } from "../api"

const read = vi.hoisted(() => vi.fn<() => string[]>())
const clear = vi.hoisted(() => vi.fn())

vi.mock("@/shared/lib/guest-wishlist", () => ({
  readGuestWishlist: read,
  clearGuestWishlist: clear,
}))

/**
 * The guest-to-user wishlist handover.
 *
 * The hazard here is the mirror of the cart's, and sharper. `toggleWishlist` is
 * a **toggle**: re-sending a product the account already had would *remove* it,
 * silently, and the customer would only notice an old favourite missing some
 * time later. So most of these tests are about what is deliberately not sent.
 */

const savedEntry = (productId: string) => ({
  id: `w-${productId}`,
  product_id: productId,
})

function clientWith(accountIds: string[]) {
  return {
    query: vi.fn().mockResolvedValue({
      data: { wishlists: { data: accountIds.map(savedEntry) } },
    }),
    mutate: vi.fn().mockResolvedValue({ data: {} }),
  }
}

const asClient = (c: unknown) => c as never

const sentIds = (client: { mutate: { mock: { calls: unknown[][] } } }) =>
  client.mutate.mock.calls.map(
    (call) => (call[0] as { variables: { input: { product_id: string } } })
      .variables.input.product_id,
  )

beforeEach(() => {
  read.mockReset()
  clear.mockReset()
  sessionStorage.clear()
})

describe("adoptGuestWishlist", () => {
  it("moves staged items onto an account holding none", async () => {
    read.mockReturnValue(["p1", "p2"])
    const client = clientWith([])

    await expect(adoptGuestWishlist(asClient(client), "acme")).resolves.toBe(2)

    expect(sentIds(client)).toEqual(["p1", "p2"])
    expect(client.mutate.mock.calls[0]![0].mutation).toBe(TOGGLE_WISHLIST)
    expect(clear).toHaveBeenCalledWith("acme")
    // The handover moved something, so the saved-items page gets told.
    expect(consumeWishlistMergeNotice()).toBe(true)
  })

  it("arms a notice that is read-and-clear, so the story is told once", async () => {
    read.mockReturnValue(["p1"])
    const client = clientWith([])

    await adoptGuestWishlist(asClient(client), "acme")

    expect(consumeWishlistMergeNotice()).toBe(true)
    // The flag does not re-arm on a second read, so re-renders cannot redraw
    // the banner.
    expect(consumeWishlistMergeNotice()).toBe(false)
  })

  it("never re-toggles something the account already saved", async () => {
    // The whole reason this reads before it writes. `toggleWishlist` on an
    // already-saved product *unsaves* it, so replaying the staged list blind
    // would delete exactly the items the customer cared about most.
    read.mockReturnValue(["p1", "p2", "p3"])
    const client = clientWith(["p2"])

    await expect(adoptGuestWishlist(asClient(client), "acme")).resolves.toBe(2)

    expect(sentIds(client)).toEqual(["p1", "p3"])
    expect(sentIds(client)).not.toContain("p2")
  })

  it("sends nothing when everything staged is already saved, but still clears", async () => {
    read.mockReturnValue(["p1"])
    const client = clientWith(["p1"])

    await expect(adoptGuestWishlist(asClient(client), "acme")).resolves.toBe(0)

    expect(client.mutate).not.toHaveBeenCalled()
    // Cleared anyway: the local copy has served its purpose, and leaving it
    // would replay this same no-op on every future sign-in.
    expect(clear).toHaveBeenCalledWith("acme")
    // Nothing moved, so there is nothing to announce.
    expect(consumeWishlistMergeNotice()).toBe(false)
  })

  it("does nothing at all when nothing was staged", async () => {
    read.mockReturnValue([])
    const client = clientWith(["p1"])

    await expect(adoptGuestWishlist(asClient(client), "acme")).resolves.toBe(0)
    expect(client.query).not.toHaveBeenCalled()
    expect(client.mutate).not.toHaveBeenCalled()
    expect(clear).not.toHaveBeenCalled()
    expect(consumeWishlistMergeNotice()).toBe(false)
  })

  it("keeps the list staged when the account's own could not be read", async () => {
    // Without knowing what the account holds there is no safe difference to
    // send — guessing is what would unsave things.
    read.mockReturnValue(["p1"])
    const client = clientWith([])
    client.query.mockRejectedValue(new Error("network"))

    await expect(adoptGuestWishlist(asClient(client), "acme")).resolves.toBe(0)
    expect(client.mutate).not.toHaveBeenCalled()
    expect(clear).not.toHaveBeenCalled()
  })

  it("keeps going past one unsaveable product, and keeps the rest staged", async () => {
    read.mockReturnValue(["gone", "p2"])
    const client = clientWith([])
    client.mutate.mockRejectedValueOnce(new Error("product not found"))

    await expect(adoptGuestWishlist(asClient(client), "acme")).resolves.toBe(1)

    // Both attempted — one failure must not strand the rest of the list.
    expect(sentIds(client)).toEqual(["gone", "p2"])
    // And storage is kept, so the next sign-in retries what did not land.
    expect(clear).not.toHaveBeenCalled()
    // The one that landed is still proof the handover is happening.
    expect(consumeWishlistMergeNotice()).toBe(true)
  })

  it("reads the account's list across every shop, not just this one", async () => {
    // `wishlists` is not shop-scoped. A product saved from another storefront
    // is still saved, and toggling it would unsave it.
    read.mockReturnValue(["p1"])
    const client = clientWith([])

    await adoptGuestWishlist(asClient(client), "acme")

    const call = client.query.mock.calls[0]![0]
    expect(call.query).toBe(WISHLISTS)
    expect(call.fetchPolicy).toBe("no-cache")
    expect(call.variables).toEqual({ page: 1, limit: 200 })
  })
})
