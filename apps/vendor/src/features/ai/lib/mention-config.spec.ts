import { describe, it, expect } from "vitest"
import {
  conversationTitleFrom,
  mentionKey,
  parseMentionTag,
  serializeMentions,
  type MentionCandidate,
} from "./mention-config"

function cand(
  type: MentionCandidate["type"],
  id: string,
  display: string,
): MentionCandidate {
  return { type, id, display }
}

describe("serializeMentions", () => {
  it("returns an empty string for no mentions", () => {
    expect(serializeMentions([])).toBe("")
  })

  it("serializes each mention as `type:id \"display\"` joined by '; '", () => {
    const tag = serializeMentions([
      cand("product", "abc", "هودي صيفي"),
      cand("order", "xyz", "#TR-1023"),
    ])
    expect(tag).toBe('\n\n[Referenced: product:abc "هودي صيفي"; order:xyz "#TR-1023"]')
  })

  it("neutralizes double quotes in the display so the tail stays parseable", () => {
    const tag = serializeMentions([cand("coupon", "c1", 'SUMMER "SALE"')])
    expect(tag).toContain("coupon:c1 \"SUMMER 'SALE'\"")
  })
})

describe("parseMentionTag", () => {
  it("returns the raw text and no mentions when there is no tail", () => {
    const out = parseMentionTag("just a question")
    expect(out.text).toBe("just a question")
    expect(out.mentions).toEqual([])
  })

  it("round-trips serialize → parse, stripping the tail from the text", () => {
    const mentions = [
      cand("product", "abc", "هودي صيفي"),
      cand("customer", "u9", "Osama"),
    ]
    const message = "how many left?" + serializeMentions(mentions)
    const out = parseMentionTag(message)
    expect(out.text).toBe("how many left?")
    expect(out.mentions).toEqual([
      { type: "product", display: "هودي صيفي" },
      { type: "customer", display: "Osama" },
    ])
  })

  it("only strips a tail anchored at the end of the message", () => {
    const out = parseMentionTag('text [Referenced: product:a "X"] more text')
    // The block is not at the tail, so it is left untouched.
    expect(out.text).toBe('text [Referenced: product:a "X"] more text')
    expect(out.mentions).toEqual([])
  })
})

describe("mentionKey", () => {
  it("is stable per type:id and distinguishes types", () => {
    expect(mentionKey({ type: "product", id: "1" })).toBe("product:1")
    expect(mentionKey({ type: "order", id: "1" })).not.toBe(
      mentionKey({ type: "product", id: "1" }),
    )
  })
})

/**
 * The sidebar shows what the SERVER derived. These pin the browser's copy to
 * the same rules, because the exported Markdown's H1 comes from here — and a
 * thread called two different things in two places is the bug this prevents.
 */
describe("conversationTitleFrom", () => {
  it("keeps an ordinary message as it is", () => {
    expect(conversationTitleFrom("Is this one selling?")).toBe(
      "Is this one selling?",
    )
  })

  it("drops the [Referenced: ...] tail the agent reads", () => {
    expect(
      conversationTitleFrom(
        'Is this one selling?\n\n[Referenced: product:p1 "Summer Hoodie"]',
      ),
    ).toBe("Is this one selling?")
  })

  it("flattens an inline token to the words it reads as", () => {
    expect(
      conversationTitleFrom(
        'How is @Summer Hoodie doing?\n\n[Referenced: product:p1 "Summer Hoodie"]',
      ),
    ).toBe("How is Summer Hoodie doing?")
  })

  it("titles a tail-only message after the thing that was picked", () => {
    // The vendor picked a product and pressed send without typing. The honest
    // title is what they picked, not nothing.
    expect(
      conversationTitleFrom('[Referenced: product:p1 "Summer Hoodie"]'),
    ).toBe("Summer Hoodie")
  })

  it("does not let a shorter display half-eat a longer one", () => {
    expect(
      conversationTitleFrom(
        '@Summer Hoodie beats @Summer\n\n[Referenced: product:p1 "Summer"; product:p2 "Summer Hoodie"]',
      ),
    ).toBe("Summer Hoodie beats Summer")
  })

  it("handles Arabic, where an ASCII word boundary would split the token", () => {
    expect(
      conversationTitleFrom(
        'كم بعنا من @هودي\n\n[Referenced: product:p1 "هودي"]',
      ),
    ).toBe("كم بعنا من هودي")
  })

  it("truncates the vendor's own words, after the tag is gone", () => {
    const long = "a".repeat(80)
    expect(
      conversationTitleFrom(long + '\n\n[Referenced: product:p1 "X"]'),
    ).toHaveLength(60)
  })

  it("returns null when there is nothing worth showing", () => {
    expect(conversationTitleFrom("")).toBeNull()
    expect(conversationTitleFrom("   ")).toBeNull()
  })
})
