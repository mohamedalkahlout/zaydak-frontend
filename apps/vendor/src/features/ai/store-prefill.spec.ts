import { beforeEach, describe, expect, it } from "vitest"
import {
  stashPrefill,
  takeHandoff,
  useVendorAgentPrefillStore,
} from "./store-prefill"

/**
 * The chat → form handoff ticket.
 *
 * One ticket per target, minted when the vendor clicks through from a
 * `navigate_to_form` card, carrying everything the save on the other side
 * needs: the form values, the step to run afterwards, and the warehouse the
 * vendor named in chat. The form reads it with `peek` (non-destructively, so
 * React strict mode's double-mount cannot eat it); the save consumes it with
 * `takeHandoff`.
 *
 * The three things these tests exist to hold in place, each of which was
 * broken before the ticket had an owner:
 *
 *   - **Consume on save.** The prefill outlived every save, so a draft the
 *     vendor abandoned came back the next time they opened the form inside
 *     the TTL — decorated as though the assistant had just prepared it.
 *   - **Scope by target.** The step to run after a save lived in one global
 *     slot, so a coupon-edit save could consume the step queued for a
 *     product the vendor had not saved yet.
 *   - **Carry the warehouse with everything else.** It used to be taken out
 *     of the store separately, which made the order of two lines in the
 *     submit hook load-bearing and invisible.
 */

const reset = () => useVendorAgentPrefillStore.setState({ pending: {} })

describe("takeHandoff", () => {
  beforeEach(reset)

  it("hands back the whole ticket, exactly once", () => {
    stashPrefill({
      target: "product_create",
      values: { name: { en: "Hoodie" }, quantity: 30 },
      nextStep: "اعمل كوبون خصم 15% على هذا المنتج",
      placeStockAt: { id: "loc-2", name: "Jeddah branch", quantity: 30 },
    })

    const ticket = takeHandoff("product_create")
    expect(ticket).toMatchObject({
      values: { name: { en: "Hoodie" }, quantity: 30 },
      nextStep: "اعمل كوبون خصم 15% على هذا المنتج",
      placeStockAt: { id: "loc-2", name: "Jeddah branch", quantity: 30 },
    })

    // Consumed. A second create in the same session must not inherit the
    // warehouse, nor re-run a step that already ran.
    expect(takeHandoff("product_create")).toBeNull()
  })

  it("carries an id, so a save can be attributed to one handoff", () => {
    const first = stashPrefill({ target: "product_create", values: {} })
    const second = stashPrefill({ target: "coupon_create", values: {} })

    expect(first).not.toBe(second)
    expect(takeHandoff("product_create")?.handoffId).toBe(first)
    expect(takeHandoff("coupon_create")?.handoffId).toBe(second)
  })

  it("does not reach across targets", () => {
    // A coupon the assistant prepared, and a product the vendor then created
    // by hand. Under the old global slot the product's save took the coupon's
    // step; now the coupon's ticket is still sitting there afterwards.
    stashPrefill({
      target: "coupon_create",
      values: {},
      nextStep: "أضف الكوبون لقسم الصيف",
    })

    expect(takeHandoff("product_create")).toBeNull()
    expect(takeHandoff("coupon_create")?.nextStep).toBe(
      "أضف الكوبون لقسم الصيف",
    )
  })

  it("does not reach across entities on an edit", () => {
    // Staged for product X; the form saving is product Y's.
    stashPrefill({
      target: "product_edit",
      entityId: "prod-x",
      values: { price: 120 },
    })

    expect(takeHandoff("product_edit", "prod-y")).toBeNull()
    expect(takeHandoff("product_edit", "prod-x")?.values).toEqual({
      price: 120,
    })
  })

  it("is null when nothing was staged at all", () => {
    // A vendor who opened the create form directly, with no chat behind it.
    expect(takeHandoff("product_create")).toBeNull()
  })

  it("is null once the handoff has expired", () => {
    stashPrefill({
      target: "product_create",
      values: { name: { en: "Hoodie" } },
      placeStockAt: { id: "loc-2", name: "Jeddah branch", quantity: 30 },
      ttlMs: -1,
    })
    // An answer given long enough ago that the vendor has forgotten it is
    // not an instruction to move stock now.
    expect(takeHandoff("product_create")).toBeNull()
  })

  it("clears through to storage, so a reload does not resurrect it", () => {
    stashPrefill({
      target: "product_create",
      values: { name: { en: "Hoodie" } },
      nextStep: "اعمل كوبون",
    })
    takeHandoff("product_create")

    const rehydrated = JSON.parse(
      JSON.stringify(useVendorAgentPrefillStore.getState().pending),
    ) as Record<string, unknown>
    expect("product_create" in rehydrated).toBe(false)
  })
})

describe("peek", () => {
  beforeEach(reset)

  it("does not consume, so a strict-mode double mount still sees it", () => {
    stashPrefill({ target: "product_create", values: { price: 200 } })
    const store = useVendorAgentPrefillStore.getState()

    expect(store.peek("product_create")?.values).toEqual({ price: 200 })
    expect(store.peek("product_create")?.values).toEqual({ price: 200 })
  })

  it("reads an expired ticket as absent without writing", () => {
    stashPrefill({ target: "product_create", values: {}, ttlMs: -1 })
    const before = useVendorAgentPrefillStore.getState().pending

    expect(useVendorAgentPrefillStore.getState().peek("product_create")).toBeNull()

    // Pure: a read that mutated the store was fine only while nothing
    // subscribed to it with a hook. Reached from a form's `useState`
    // initializer, a write here is React's "Cannot update a component while
    // rendering a different component".
    expect(useVendorAgentPrefillStore.getState().pending).toBe(before)
  })

  it("sweeps an expired ticket on the next write instead", () => {
    stashPrefill({ target: "product_create", values: {}, ttlMs: -1 })
    stashPrefill({ target: "coupon_create", values: {} })

    expect(
      "product_create" in useVendorAgentPrefillStore.getState().pending,
    ).toBe(false)
  })
})
