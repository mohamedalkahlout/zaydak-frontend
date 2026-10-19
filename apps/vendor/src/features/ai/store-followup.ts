import { useAiChatStore } from "./store-chat"
import { markResume } from "./lib/resume-marker"
import type { PrefillPayload } from "./store-prefill"

/**
 * Resuming a chained AI request after the vendor saves a form the agent
 * prefilled.
 *
 * The canonical case: the vendor asks "create a product, then a coupon on
 * it". The product has no id until it is saved, so the coupon step rides on
 * the handoff ticket as `nextStep`; when the create mutation succeeds the
 * submit hook consumes the ticket and resumes the chat with the instruction
 * plus the new product's id, so the vendor never has to type "continue".
 *
 * **The step lives on the ticket, not in a slot of its own.** It used to sit
 * in a second store — one global `nextStep` string with no owner — and that
 * shape had two failures that are gone with it. A save on a screen the agent
 * cannot queue a step against at all (coupon edit and collection edit: both
 * are direct writes with no form handoff) would still call in and consume
 * whatever step was queued for a *different*, unsaved entity. And the `/ai`
 * page's auto-navigation stashed the prefill from one store while never
 * touching the other, so a chained request begun there lost its second half
 * silently. A step now reaches a save only if that save is the one the ticket
 * was minted for.
 */

/**
 * Resume the chat after a save, if this save completed a handoff that had a
 * next step.
 *
 * Takes the ticket the submit hook already consumed rather than reading one
 * of its own: the hook needs it for the receipt too, and a second read is a
 * second chance to disagree about whether the save was the agent's.
 *
 * @param handoff The ticket consumed by this save, or null when the vendor
 *   reached the form on their own — the ordinary case, and a no-op.
 * @param entityMarker `[product:ID]` / `[collection:ID]`, so the agent can
 *   address the entity it just had created. Pass "" when there is nothing
 *   downstream to reference (coupons have no marker).
 */
export function resumeAgentAfterSave(
  handoff: PrefillPayload | null,
  entityMarker: string,
): void {
  const nextStep = handoff?.nextStep
  if (!nextStep) return
  const instruction = entityMarker ? `${nextStep} ${entityMarker}` : nextStep
  // Tag it as an auto-resume turn: the UI hides the bubble (the vendor never
  // typed it) and the backend strips the tag before the LLM sees it.
  useAiChatStore.getState().openWithPrompt(markResume(instruction))
}
