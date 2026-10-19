import {
  findMentionStart,
  mentionKey,
  serializeMentions,
  type MentionCandidate,
  type MentionType,
} from "./mention-config"

/**
 * The inline half of the @-mention model used by the slide-in chat panel.
 *
 * The full-page chat keeps the original *chip* model — a picked entity leaves
 * the textarea entirely and rides above it as a removable pill. The panel
 * instead leaves the token **in the text** (`Restock @Summer Hoodie please`)
 * and paints it through a mirrored backdrop, so what the vendor sends and what
 * they see are the same string.
 *
 * That moves the bookkeeping: with chips, the picked list *is* the truth, and
 * `serializeMentions` reads it directly. Inline, the text is the truth — a
 * vendor can delete half a token with Backspace, and the `[Referenced: …]`
 * tail must follow. So `resolved` here is only a *lookup* (display text → the
 * entity it was picked from) and every outgoing tail is rebuilt by scanning
 * the final text, never by trusting the pick list.
 */

/**
 * The literal run of characters an inline mention occupies.
 *
 * Double quotes are folded to single ones because `serializeMentions` does the
 * same to the display it writes into the tail — it has to, since the tail
 * quotes each name. Without the same fold here the two would disagree for a
 * product genuinely called `24" Mug`: the text would carry `@24" Mug` and the
 * tail `24' Mug`, `splitBubbleMentions` would find nothing to highlight, and
 * the sent bubble would show the name twice, which is the one thing it exists
 * to prevent.
 */
export function mentionToken(m: Pick<MentionCandidate, "display">): string {
  return "@" + m.display.replace(/"/g, "'")
}

export interface MentionSegment {
  text: string
  /** The entity this run resolves to, or `null` for ordinary text. */
  mention: MentionCandidate | null
}

/**
 * What may legally follow a token. Deliberately spelled out rather than
 * written as `[^\w]`: JavaScript's `\w` is ASCII-only, so `(?=$|[^\w])` — the
 * obvious boundary, and the one the reference component uses — treats every
 * Arabic letter as a boundary and would match `@هودي` inside `@هوديات`.
 */
const TOKEN_TAIL = /[\s.,!?:;)\]}"'«»،؛؟…]/

interface TokenForm {
  token: string
  mention: MentionCandidate
}

/** The form starting at `i`, or null. Longest form wins (see `formsOf`). */
function matchAt(text: string, i: number, forms: TokenForm[]): TokenForm | null {
  if (text[i] !== "@") return null
  // A token opens at the start of the text or after whitespace — the same rule
  // `detectMentionQuery` uses, so an email address is never a mention.
  if (i > 0 && !/\s/.test(text[i - 1])) return null
  for (const f of forms) {
    if (!text.startsWith(f.token, i)) continue
    const after = text[i + f.token.length]
    if (after === undefined || TOKEN_TAIL.test(after)) return f
  }
  return null
}

function formsOf(resolved: readonly MentionCandidate[]): TokenForm[] {
  return resolved
    .map((mention) => ({ token: mentionToken(mention), mention }))
    // Longest first, so a shop holding both "Hoodie" and "Hoodie Winter"
    // matches the longer one rather than leaving " Winter" as loose text.
    .sort((a, b) => b.token.length - a.token.length)
}

/**
 * Splits `text` into plain runs and mention runs, matched against the tokens
 * of `resolved`. Both the composer's highlight backdrop and the sent-message
 * bubble render from this, so the two can never disagree about what counts as
 * a mention.
 */
export function segmentMentions(
  text: string,
  resolved: readonly MentionCandidate[],
): MentionSegment[] {
  if (!text) return []
  const forms = formsOf(resolved)
  if (forms.length === 0) return [{ text, mention: null }]

  const out: MentionSegment[] = []
  let last = 0
  let i = 0
  while (i < text.length) {
    const hit = matchAt(text, i, forms)
    if (!hit) {
      i++
      continue
    }
    if (i > last) out.push({ text: text.slice(last, i), mention: null })
    out.push({ text: hit.token, mention: hit.mention })
    i += hit.token.length
    last = i
  }
  if (last < text.length) out.push({ text: text.slice(last), mention: null })
  return out
}

export interface MentionSpan {
  /** Index of the token's "@". */
  start: number
  /** Index one past the token's last character. */
  end: number
  mention: MentionCandidate
}

/**
 * The already-resolved mention the caret is sitting inside, with the run it
 * occupies — or `null` when the caret is in ordinary text or in a token still
 * being typed.
 *
 * This is what separates "the vendor is writing a new mention" from "the
 * vendor clicked one they already picked". The two need opposite answers: the
 * first opens the category menu so a kind can be chosen, the second should go
 * straight to that entity's own list, because the kind is already settled and
 * the only thing left to do is swap the entity. Returning the span as well is
 * what lets the swap replace the whole token rather than the half of it
 * before the caret.
 */
export function mentionSpanAt(
  text: string,
  caret: number,
  resolved: readonly MentionCandidate[],
): MentionSpan | null {
  let index = 0
  for (const seg of segmentMentions(text, resolved)) {
    const end = index + seg.text.length
    // Strictly after the start, so a caret resting immediately before the "@"
    // is still "outside" — there the vendor is typing up to the token, not in
    // it. The end is inclusive, because a caret just past the last character
    // is still within the word.
    if (seg.mention && caret > index && caret <= end) {
      return { start: index, end, mention: seg.mention }
    }
    index = end
  }
  return null
}

/**
 * The entities still present in `text`, deduped by `type:id` and in the order
 * they appear. A mention the vendor typed over or deleted is simply absent.
 */
export function inlineMentionsIn(
  text: string,
  resolved: readonly MentionCandidate[],
): MentionCandidate[] {
  const seen = new Set<string>()
  const out: MentionCandidate[] = []
  for (const seg of segmentMentions(text, resolved)) {
    if (!seg.mention) continue
    const key = mentionKey(seg.mention)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(seg.mention)
  }
  return out
}

/**
 * The `[Referenced: …]` tail for a message, rebuilt from the text. Identical
 * in shape to the chip composer's, so the agent prompt and `parseMentionTag`
 * need no second format.
 */
export function serializeInlineMentions(
  text: string,
  resolved: readonly MentionCandidate[],
): string {
  return serializeMentions(inlineMentionsIn(text, resolved))
}

/**
 * Splices a picked entity over the "@query" the caret sits in, leaving one
 * space after it so the next character typed does not extend the token.
 * Returns the new value and where the caret belongs.
 */
export function insertMentionText(
  value: string,
  caret: number,
  candidate: MentionCandidate,
  /**
   * Replace this exact run instead of the "@query" the caret sits in. Passed
   * when the caret is inside a mention that is already resolved, where the
   * caret is mid-token and splicing at it would leave the token's tail behind
   * as loose text (`@SAVE20` with the caret after "SAVE" becoming `@NEW1020`).
   */
  span?: { start: number; end: number } | null,
): { next: string; caret: number } {
  const at = span ? span.start : findMentionStart(value, caret)
  const before = at === -1 ? value.slice(0, caret) : value.slice(0, at)
  const after = value.slice(span ? span.end : caret)
  const token = mentionToken(candidate)
  // A token only counts as one if it opens at a word boundary. `at === -1`
  // means the caret had wandered off the "@" — an ArrowLeft, a click, a
  // dictation that rewrote the draft — and without this the token would be
  // glued onto the previous word, where `segmentMentions` cannot see it and
  // the pick is silently lost from the highlight and from the sent tail.
  const lead = before.length > 0 && !/\s$/.test(before) ? " " : ""
  // Reuse a space already sitting at the seam rather than stacking a second.
  const gap = after.startsWith(" ") ? "" : " "
  return {
    next: before + lead + token + gap + after,
    caret: before.length + lead.length + token.length + (gap ? gap.length : 1),
  }
}

/**
 * How a *sent* user message should render. A message written in the panel
 * carries its mentions inline, so painting the `[Referenced: …]` entries as
 * pills underneath would show each one twice; a message written in the
 * full-page chat (or by any older build) carries no inline tokens at all and
 * needs every pill. One pass covers both: a tagged mention found inline is
 * highlighted in place, and only the ones with nothing to highlight fall
 * through to pills.
 */
export function splitBubbleMentions(
  text: string,
  tagged: readonly { type: MentionType; display: string }[],
): { segments: MentionSegment[]; pills: { type: MentionType; display: string }[] } {
  // The tail carries no ids (`parseMentionTag` drops them), so index stands in
  // as the identity for the found/not-found bookkeeping below.
  const pseudo: MentionCandidate[] = tagged.map((m, i) => ({
    type: m.type,
    id: String(i),
    display: m.display,
  }))
  const segments = segmentMentions(text, pseudo)
  const inline = new Set(
    segments.flatMap((s) => (s.mention ? [s.mention.id] : [])),
  )
  return {
    segments,
    pills: pseudo.filter((p) => !inline.has(p.id)),
  }
}
