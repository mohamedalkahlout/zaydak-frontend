import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  adoptGuestCart,
  consumeMergeNotice,
  consumePendingAdopt,
} from "../adopt-guest-cart"
import { SYNC_CART } from "../api"

const peek = vi.hoisted(() => vi.fn<() => string | null>())

vi.mock("@/shared/lib/cart-session", () => ({
  peekCartSessionId: peek,
}))

/**
 * The guest-to-user cart handover.
 *
 * Two of these tests are about the merge happening at all — it did not, for as
 * long as the storefront existed, because `syncCart` was written for this and
 * never called. The rest are about the ways it can do *harm*, which is the
 * sharper risk now that it is wired up: `CartSyncService` replaces the account's
 * items rather than adding to them, so the difference between "send nothing" and
 * "send an empty list" is the difference between leaving a saved cart alone and
 * deleting it.
 */

function line(over: Record<string, unknown> = {}) {
  return {
    product_id: "prod-1",
    variation_option_id: null,
    quantity: 2,
    custom_options: null,
    ...over,
  }
}

function clientWith(items: unknown[] | null) {
  return {
    query: vi.fn().mockResolvedValue({
      data: { cart: { data: items === null ? null : { items } } },
    }),
    mutate: vi.fn().mockResolvedValue({ data: {} }),
  }
}

/** The helper only ever touches `query` and `mutate`. */
const asClient = (c: unknown) => c as never

beforeEach(() => {
  peek.mockReset()
  peek.mockReturnValue("sess-1")
  sessionStorage.clear()
})

describe("adoptGuestCart", () => {
  it("hands the guest cart's items to syncCart with the session that owns them", async () => {
    const client = clientWith([line(), line({ product_id: "prod-2", quantity: 1 })])

    await expect(adoptGuestCart(asClient(client))).resolves.toBe(true)

    expect(client.mutate).toHaveBeenCalledTimes(1)
    const call = client.mutate.mock.calls[0]![0]
    expect(call.mutation).toBe(SYNC_CART)
    // `session_id` is what lets the back-end release the guest cart's stock
    // holds and soft-delete it; without it the merge leaves a live duplicate
    // holding inventory until the reaper takes it.
    expect(call.variables.input.session_id).toBe("sess-1")
    expect(call.variables.input.items).toEqual([
      { product_id: "prod-1", quantity: 2 },
      { product_id: "prod-2", quantity: 1 },
    ])
  })

  it("carries a variation and its custom options rather than dropping them", async () => {
    const client = clientWith([
      line({ variation_option_id: "var-9", custom_options: { engraving: "Sam" } }),
    ])

    await adoptGuestCart(asClient(client))

    expect(client.mutate.mock.calls[0]![0].variables.input.items[0]).toEqual({
      product_id: "prod-1",
      quantity: 2,
      variation_option_id: "var-9",
      custom_options: { engraving: "Sam" },
    })
  })

  it("does not sync an empty guest cart — that would wipe the account's own", async () => {
    // The whole reason this is a function and not a line in the login form.
    // The merge is destructive on the user's side, so an empty list is a
    // delete: someone signing in on a device where they browsed but added
    // nothing would lose the cart they left last week.
    const client = clientWith([])

    await expect(adoptGuestCart(asClient(client))).resolves.toBe(false)
    expect(client.mutate).not.toHaveBeenCalled()
  })

  it("does nothing when the visitor never had a guest cart", async () => {
    peek.mockReturnValue(null)
    const client = clientWith([line()])

    await expect(adoptGuestCart(asClient(client))).resolves.toBe(false)
    // Not even a read: minting a session id to ask whether it has a cart would
    // invent the guest this whole path exists to hand over.
    expect(client.query).not.toHaveBeenCalled()
    expect(client.mutate).not.toHaveBeenCalled()
  })

  it("reads the guest cart unauthenticated, so it is not the account's cart", async () => {
    const client = clientWith([line()])

    await adoptGuestCart(asClient(client))

    const read = client.query.mock.calls[0]![0]
    // The session cookie is already written by the time this runs, so an
    // ordinary read would come back as the *user's* cart and we would sync it
    // onto itself.
    expect(read.context.headers.authorization).toBe("")
    expect(read.variables).toEqual({ session_id: "sess-1" })
    // And the guest snapshot must not land in the store under the same key the
    // authenticated cart query uses.
    expect(read.fetchPolicy).toBe("no-cache")
  })

  it("reports failure instead of throwing, so a lost cart is not a failed login", async () => {
    const client = clientWith([line()])
    client.mutate.mockRejectedValue(new Error("throttled"))

    await expect(adoptGuestCart(asClient(client))).resolves.toBe(false)
  })

  it("survives a cart read that comes back with no envelope", async () => {
    const client = clientWith(null)

    await expect(adoptGuestCart(asClient(client))).resolves.toBe(false)
    expect(client.mutate).not.toHaveBeenCalled()
  })

  it("arms the cart page notice when a merge moves items", async () => {
    const client = clientWith([line()])
    sessionStorage.setItem("cart.merge.pending", "1")

    await expect(adoptGuestCart(asClient(client))).resolves.toBe(true)

    // The merge replaced the account's cart, so the next /cart visit is told,
    // and a retry is no longer owed — a merge cannot succeed twice.
    expect(consumeMergeNotice()).toBe(true)
    expect(consumePendingAdopt()).toBe(false)
  })

  it("leaves no notice and no retry when there is nothing to move", async () => {
    sessionStorage.setItem("cart.merge.pending", "1")
    const empty = clientWith([])
    const absent = clientWith(null)

    await adoptGuestCart(asClient(empty))
    expect(consumeMergeNotice()).toBe(false)
    expect(consumePendingAdopt()).toBe(false)

    await adoptGuestCart(asClient(absent))
    expect(consumeMergeNotice()).toBe(false)
    expect(consumePendingAdopt()).toBe(false)
  })

  it("voids a pending retry when the visitor never had a guest cart", async () => {
    peek.mockReturnValue(null)
    sessionStorage.setItem("cart.merge.pending", "1")

    await adoptGuestCart(asClient(clientWith([line()])))

    expect(consumePendingAdopt()).toBe(false)
    expect(consumeMergeNotice()).toBe(false)
  })

  it("arms a retry for the next cart read when the merge fails", async () => {
    // A failed login-side attempt must not be the last word — e.g. `syncCart`'s
    // 5/60s throttle can refuse a merge that follows a cart write too closely,
    // and the guest cart stays orphaned until a second attempt moves it.
    const client = clientWith([line()])
    client.mutate.mockRejectedValue(new Error("throttled"))

    await expect(adoptGuestCart(asClient(client))).resolves.toBe(false)

    expect(consumePendingAdopt()).toBe(true)
    expect(consumeMergeNotice()).toBe(false)
  })

  it("clears the notice flag without a second merge", async () => {
    // `consume*` are read-and-clear: a re-render of the cart page must not
    // redraw the banner, and a second page load must not retry a resolved debt.
    sessionStorage.setItem("cart.merge.notice", "1")

    expect(consumeMergeNotice()).toBe(true)
    expect(consumeMergeNotice()).toBe(false)
    expect(consumePendingAdopt()).toBe(false)
  })
})
