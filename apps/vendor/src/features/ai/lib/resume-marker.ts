/**
 * Marks an auto-resume chat turn — the message the UI sends on the vendor's
 * behalf after they save a form-prefilled entity (e.g. "make a 15% coupon on
 * this product [product:ID]"). The vendor never typed it, so it must NOT show
 * as a user bubble, yet it still drives the next agent run and is persisted so
 * the chain reads correctly on reload.
 *
 * We tag it with a leading private-use character (U+E000) instead of a schema
 * flag: the frontend hides any user turn whose content starts with it (live
 * and on history reload), and the backend strips it before the text reaches
 * the LLM (see the mirrored constant in `vendor-agent.service.ts`). U+E000 is
 * a Unicode private-use code point — it never appears in real typed input, and
 * it's a valid, storable text character (unlike NUL).
 */
export const RESUME_SENTINEL = String.fromCharCode(0xe000)

/** Prefix a resume instruction so the UI hides it and the backend strips it. */
export function markResume(text: string): string {
  return `${RESUME_SENTINEL}${text}`
}

/** True when a message is an auto-resume turn (should not render as a bubble). */
export function isResumeTurn(content: string): boolean {
  return content.startsWith(RESUME_SENTINEL)
}
