import { describe, it, expect } from "vitest"
import {
  inlineMentionsIn,
  insertMentionText,
  mentionToken,
  segmentMentions,
  serializeInlineMentions,
  splitBubbleMentions,
} from "./inline-mentions"
import { parseMentionTag, type MentionCandidate } from "./mention-config"

/**
 * The panel's inline @-mention model.
 *
 * Two of these pin bugs the reference this was ported from actually has, and
 * both are invisible to an English-only suite: its token boundary is
 * `(?=$|[^\w])`, and JavaScript's `\w` is ASCII-only, so every Arabic letter
 * reads as a boundary and `@هودي` matches inside `@هوديات`. The other is the
 * overlapping-name case — a shop holding both "Hoodie" and "Hoodie Winter" —
 * which single-word fixtures pass either way.
 *
 * The rest pin the thing the whole model rests on: the outgoing
 * `[Referenced: …]` tail is rebuilt from the TEXT, so a token the vendor
 * deleted is gone from it and nothing has to track the deletion.
 */

function cand(
  type: MentionCandidate["type"],
  id: string,
  display: string,
): MentionCandidate {
  return { type, id, display }
}

const hoodie = cand("product", "p1", "Summer Hoodie")
const order = cand("order", "o1", "#TR-1023")

describe("segmentMentions", () => {
  it("leaves text alone when nothing has been picked", () => {
    expect(segmentMentions("restock the hoodie", [])).toEqual([
      { text: "restock the hoodie", mention: null },
    ])
  })

  it("splits a multi-word token out of the sentence around it", () => {
    expect(segmentMentions("Restock @Summer Hoodie today", [hoodie])).toEqual([
      { text: "Restock ", mention: null },
      { text: "@Summer Hoodie", mention: hoodie },
      { text: " today", mention: null },
    ])
  })

  it("does not match an Arabic token inside a longer Arabic word", () => {
    const arabic = cand("product", "p2", "هودي")
    // "@هوديات" is a different word. A `[^\w]` boundary would match here,
    // because `\w` never matches an Arabic letter.
    const segments = segmentMentions("@هوديات جديدة", [arabic])
    expect(segments.some((s) => s.mention)).toBe(false)
  })

  it("still matches the Arabic token when it stands on its own", () => {
    const arabic = cand("product", "p2", "هودي")
    expect(segmentMentions("@هودي جديد", [arabic])[0]).toEqual({
      text: "@هودي",
      mention: arabic,
    })
  })

  it("prefers the longer of two overlapping names", () => {
    const short = cand("product", "p3", "Hoodie")
    const long = cand("product", "p4", "Hoodie Winter")
    // Short one first in the list, so ordering cannot come from the input.
    expect(segmentMentions("@Hoodie Winter is low", [short, long])).toEqual([
      { text: "@Hoodie Winter", mention: long },
      { text: " is low", mention: null },
    ])
  })

  it("ignores an '@' that is not at a word boundary, so an email is safe", () => {
    const segments = segmentMentions("mail me at a@Summer Hoodie", [hoodie])
    expect(segments.some((s) => s.mention)).toBe(false)
  })
})

describe("inlineMentionsIn", () => {
  it("drops a mention the vendor typed over", () => {
    expect(inlineMentionsIn("Restock the hoodie", [hoodie, order])).toEqual([])
  })

  it("returns each entity once, in the order it appears", () => {
    const text = "@#TR-1023 holds @Summer Hoodie and @Summer Hoodie again"
    expect(inlineMentionsIn(text, [hoodie, order])).toEqual([order, hoodie])
  })
})

describe("serializeInlineMentions", () => {
  it("emits nothing when the text carries no token", () => {
    expect(serializeInlineMentions("just a question", [hoodie])).toBe("")
  })

  it("round-trips through the tail parser the bubble reads", () => {
    const tail = serializeInlineMentions("Restock @Summer Hoodie", [hoodie])
    expect(tail).toBe('\n\n[Referenced: product:p1 "Summer Hoodie"]')
    expect(parseMentionTag("Restock @Summer Hoodie" + tail)).toEqual({
      text: "Restock @Summer Hoodie",
      mentions: [{ type: "product", display: "Summer Hoodie" }],
    })
  })
})

describe("insertMentionText", () => {
  it("replaces the typed query and leaves one space after the token", () => {
    expect(insertMentionText("Restock @sum", 12, hoodie)).toEqual({
      next: "Restock @Summer Hoodie ",
      caret: 23,
    })
  })

  it("reuses a space already at the seam rather than stacking a second", () => {
    const { next, caret } = insertMentionText("Restock @sum please", 12, hoodie)
    expect(next).toBe("Restock @Summer Hoodie please")
    // Caret lands past the existing space, on the "p".
    expect(next.slice(caret)).toBe("please")
  })

  it("opens a boundary when the caret has wandered off the token", () => {
    // ArrowLeft, a click, or a dictation that rewrote the draft all leave the
    // caret outside an "@": without a leading space the token would be glued
    // onto the previous word, where segmentMentions cannot see it and the pick
    // would vanish from both the highlight and the sent tail.
    const { next, caret } = insertMentionText("restock the mug", 15, hoodie)
    expect(next).toBe("restock the mug @Summer Hoodie ")
    expect(next.slice(caret)).toBe("")
    expect(inlineMentionsIn(next, [hoodie])).toEqual([hoodie])
  })

  it("adds no leading space at the very start of an empty draft", () => {
    expect(insertMentionText("", 0, hoodie).next).toBe("@Summer Hoodie ")
  })
})

describe("splitBubbleMentions", () => {
  const tagged = [{ type: "product" as const, display: "Summer Hoodie" }]

  it("highlights a mention in place and adds no pill for it", () => {
    const { segments, pills } = splitBubbleMentions(
      "Restock @Summer Hoodie",
      tagged,
    )
    expect(pills).toEqual([])
    expect(segments.filter((s) => s.mention).map((s) => s.text)).toEqual([
      "@Summer Hoodie",
    ])
  })

  it("still pills a message whose text holds no token, as older turns do", () => {
    const { segments, pills } = splitBubbleMentions("Restock this one", tagged)
    expect(pills.map((p) => p.display)).toEqual(["Summer Hoodie"])
    expect(segments.some((s) => s.mention)).toBe(false)
  })

  it("pills only the mentions it could not find inline", () => {
    const { pills } = splitBubbleMentions("Restock @Summer Hoodie", [
      ...tagged,
      { type: "order" as const, display: "#TR-1023" },
    ])
    expect(pills.map((p) => p.display)).toEqual(["#TR-1023"])
  })
})

describe("mentionToken", () => {
  it("is the display name behind an '@'", () => {
    expect(mentionToken(hoodie)).toBe("@Summer Hoodie")
  })

  it("folds double quotes the same way the tail does, so the two agree", () => {
    // `serializeMentions` has to neutralise quotes because the tail quotes each
    // name. A product genuinely called `24" Mug` would otherwise sit in the
    // text as @24" Mug and in the tail as 24' Mug, and the bubble — which
    // matches text against tail — would show it twice.
    const inches = cand("product", "p9", '24" Mug')
    expect(mentionToken(inches)).toBe("@24' Mug")
    const text = "Restock " + mentionToken(inches)
    const { pills, segments } = splitBubbleMentions(
      text,
      parseMentionTag(text + serializeInlineMentions(text, [inches])).mentions,
    )
    expect(pills).toEqual([])
    expect(segments.filter((s) => s.mention).map((s) => s.text)).toEqual([
      "@24' Mug",
    ])
  })
})
