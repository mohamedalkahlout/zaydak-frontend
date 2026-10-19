import { beforeEach, describe, expect, it } from "vitest"
import { resumeAgentAfterSave } from "./store-followup"
import { useAiChatStore } from "./store-chat"
import { RESUME_SENTINEL } from "./lib/resume-marker"
import type { PrefillPayload } from "./store-prefill"

/**
 * Resuming a chained request after a save.
 *
 * The rule the whole thing turns on: a step reaches a save only if that save
 * is the one it was staged for. It used to live in a single global slot with
 * no owner, and the two consequences were both live. A save on a screen the
 * agent cannot queue a step against at all — coupon edit, collection edit,
 * both direct writes with no form handoff — would consume the step queued for
 * a different, still-unsaved entity. And a vendor who created something by
 * hand while a chained request was parked had their unrelated save continue
 * somebody else's plan.
 */

const ticket = (over: Partial<PrefillPayload> = {}): PrefillPayload => ({
  target: "product_create",
  handoffId: "h-1",
  values: {},
  expires_at: Date.now() + 60_000,
  ...over,
})

const pending = () => useAiChatStore.getState().pendingPrompt

beforeEach(() => {
  useAiChatStore.setState({ open: false, expanded: false, pendingPrompt: null })
})

describe("resumeAgentAfterSave", () => {
  it("sends the step with the new entity's marker, and opens the panel", () => {
    resumeAgentAfterSave(
      ticket({ nextStep: "اعمل كوبون خصم 15% على هذا المنتج" }),
      "[product:prod-1]",
    )

    expect(pending()).toBe(
      `${RESUME_SENTINEL}اعمل كوبون خصم 15% على هذا المنتج [product:prod-1]`,
    )
    expect(useAiChatStore.getState().open).toBe(true)
  })

  it("marks the turn so the UI hides a bubble the vendor never typed", () => {
    resumeAgentAfterSave(ticket({ nextStep: "أضف صور للمنتج" }), "")

    expect(pending()?.startsWith(RESUME_SENTINEL)).toBe(true)
  })

  it("omits the marker when there is nothing downstream to reference", () => {
    // Coupons have no [coupon:ID] marker — the agent continues from the
    // instruction alone.
    resumeAgentAfterSave(ticket({ nextStep: "أضف الكوبون لقسم الصيف" }), "")

    expect(pending()).toBe(`${RESUME_SENTINEL}أضف الكوبون لقسم الصيف`)
  })

  it("does nothing for a save the vendor made on their own", () => {
    resumeAgentAfterSave(null, "[product:prod-1]")

    expect(pending()).toBeNull()
    expect(useAiChatStore.getState().open).toBe(false)
  })

  it("does nothing for a handoff that queued no step", () => {
    // The ordinary single-action handoff: the assistant prepared a product
    // and there is nothing after it. Opening the chat to say so would be a
    // panel appearing for no reason.
    resumeAgentAfterSave(ticket(), "[product:prod-1]")

    expect(pending()).toBeNull()
    expect(useAiChatStore.getState().open).toBe(false)
  })
})
