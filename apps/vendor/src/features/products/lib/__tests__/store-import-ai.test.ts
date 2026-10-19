import { describe, it, expect } from "vitest"
import { CombinedGraphQLErrors } from "@apollo/client/errors"
import type { StoreImportField } from "@/features/products/api"
import {
  aiActionsFor,
  aiAnswerForField,
  aiCapabilityFor,
  aiErrorKey,
  aiPlanDeniedKey,
  aiSourceFor,
  aiTargetFor,
  clampWords,
  plainLine,
} from "../store-import-ai"

/**
 * The AI assist's rules, away from React.
 *
 * Almost all of them are about the same thing: an answer from a model must
 * arrive as something this CSV cell can actually hold, built from the text
 * that will actually be imported, and it must never be offered where it could
 * only do harm.
 */

const field = (over: Partial<StoreImportField> = {}): StoreImportField => ({
  key: "name_en",
  kind: "text",
  group: "product",
  never_scanned: false,
  blocks_sale: false,
  max_length: 255,
  ...over,
})

describe("which fields offer AI at all", () => {
  it("offers rewriting on the text a merchant sells with", () => {
    expect(aiActionsFor(field({ key: "name_en" }))).toContain("improve")
    expect(
      aiActionsFor(field({ key: "description_en", kind: "multiline" })),
    ).toContain("extend")
    expect(aiActionsFor(field({ key: "brand" }))).toEqual(["improve"])
  })

  it("offers translation, and only translation, on the Arabic rows", () => {
    // One action is why the row renders a single press instead of a menu.
    expect(aiActionsFor(field({ key: "name_ar" }))).toEqual(["translate-ar"])
    expect(
      aiActionsFor(field({ key: "description_ar", kind: "multiline" })),
    ).toEqual(["translate-ar"])
  })

  it("offers nothing on a number, a code, or the category", () => {
    // There is no sense in which a model improves a price the old store
    // recorded — inventing one is the failure, and the button is the invite.
    for (const key of [
      "price_cents",
      "sale_price_cents",
      "cost_per_item_cents",
      "quantity",
      "sku",
      "barcode",
      "system_category_id",
    ]) {
      expect(aiActionsFor(field({ key })), key).toEqual([])
    }
  })
})

describe("what shape of answer a field asks for", () => {
  it("asks for a document only where the column holds one", () => {
    expect(aiTargetFor(field({ kind: "multiline" }))).toBe("RICH_TEXT")
    expect(aiTargetFor(field({ kind: "text" }))).toBe("PLAIN_LINE")
  })

  it("keeps a description's markup and reduces a title's", () => {
    const description = field({ key: "description_en", kind: "multiline" })
    expect(aiAnswerForField(description, "<p>A soft tee.</p>")).toBe(
      "<p>A soft tee.</p>",
    )
    expect(aiAnswerForField(field(), "<p>Classic Cotton Tee</p>")).toBe(
      "Classic Cotton Tee",
    )
  })

  it("never stages a value the server would refuse for being too long", () => {
    // The cell's cap is the server's validator. Clamping here is the
    // difference between a suggestion and a save that fails.
    const long = "A ".repeat(60).trim()
    const staged = aiAnswerForField(field({ max_length: 20 }), long)
    expect(staged.length).toBeLessThanOrEqual(20)
  })
})

describe("reducing a model's answer to one line", () => {
  it("keeps a word boundary where a block ended", () => {
    expect(plainLine("<p>Mug</p><p>Steel</p>")).toBe("Mug Steel")
    expect(plainLine("Blue<br>Mug")).toBe("Blue Mug")
  })

  it("strips the packaging a model adds when it is being helpful", () => {
    expect(plainLine("```html\n<p>Steel Bottle</p>\n```")).toBe("Steel Bottle")
    expect(plainLine('Title: "Blue Mug"')).toBe("Blue Mug")
    expect(plainLine("**Blue Mug**")).toBe("Blue Mug")
  })

  it("decodes entities and leaves a real line alone", () => {
    expect(plainLine("Salt &amp; Pepper")).toBe("Salt & Pepper")
    expect(plainLine("كوب قهوة")).toBe("كوب قهوة")
    expect(plainLine("Baker's Dozen")).toBe("Baker's Dozen")
  })

  it("cuts on a word rather than mid-word", () => {
    const value = "Vintage Hand Poured Soy Wax Candle"
    const cut = clampWords(value, 20)
    expect(cut.length).toBeLessThanOrEqual(20)
    expect(value.startsWith(cut)).toBe(true)
    expect(value[cut.length]).toBe(" ")
  })
})

describe("what the model is given to work from", () => {
  it("rewrites the value that will actually be imported", () => {
    // The merchant's correction, not the scan it replaced: improving a title
    // nobody is going to ship is a wasted call and a confusing answer.
    expect(
      aiSourceFor({ own: "My own title", reference: "ignored", field: field() }),
    ).toBe("My own title")
  })

  it("translates from the English neighbour, not the empty Arabic cell", () => {
    const arabic = field({ key: "name_ar", reference_key: "name_en" })
    expect(
      aiSourceFor({ own: "", reference: "Classic Cotton Tee", field: arabic }),
    ).toBe("Classic Cotton Tee")
  })
})

describe("what a refusal is called", () => {
  /** The real wire shape: Apollo 4 wraps GraphQL errors in this class. */
  const refusal = (code: string) =>
    new CombinedGraphQLErrors(
      { errors: [{ message: code, extensions: { error_code: code } }] },
      [{ message: code, extensions: { error_code: code } }],
    )

  /** A plan allowance arrives as a validation error with the real code inside. */
  const quota = (code: string) =>
    new CombinedGraphQLErrors(
      {
        errors: [
          {
            message: "Validation failed",
            extensions: {
              error_code: "VALIDATION_ERROR",
              validation_errors: [{ field: "quantity", code }],
            },
          },
        ],
      },
      [
        {
          message: "Validation failed",
          extensions: {
            error_code: "VALIDATION_ERROR",
            validation_errors: [{ field: "quantity", code }],
          },
        },
      ],
    )

  it("tells a plan that never had the feature from one that has used it up", () => {
    expect(aiErrorKey(refusal("FEATURE_NOT_AVAILABLE"))).toBe("aiNotInPlan")
    expect(aiErrorKey(refusal("PLAN_QUOTA_EXCEEDED"))).toBe("aiQuota")
  })

  it("reads a code the server buried inside a validation error", () => {
    // `AppException.validation` hardcodes the outer code to VALIDATION_ERROR,
    // so reading only that is how a quota refusal reaches a merchant as
    // "please try again" — advice that cannot work.
    expect(aiErrorKey(quota("PLAN_QUOTA_EXCEEDED"))).toBe("aiQuota")
  })

  it("falls back to a generic failure for a code nobody planned for", () => {
    expect(aiErrorKey(refusal("SOMETHING_NEW"))).toBe("aiFailed")
    expect(aiErrorKey(new Error("network"))).toBe("aiFailed")
  })
})

describe("which plan key an action spends", () => {
  it("keeps rewrite, summarize and translate apart, matching the server", () => {
    expect(aiCapabilityFor("improve")).toBe("ai.text.rewrite")
    expect(aiCapabilityFor("extend")).toBe("ai.text.rewrite")
    expect(aiCapabilityFor("simplify")).toBe("ai.text.rewrite")
    expect(aiCapabilityFor("shorten")).toBe("ai.text.summarize")
    expect(aiCapabilityFor("translate-ar")).toBe("ai.text.translate")
    expect(aiCapabilityFor("translate-en")).toBe("ai.text.translate")
    expect(aiCapabilityFor("custom")).toBe("ai.text.generate")
  })

  it("does not flash a disabled control while entitlements load", () => {
    expect(
      aiPlanDeniedKey({ allowed: false, exhausted: false, loading: true }),
    ).toBeNull()
    expect(aiPlanDeniedKey({ allowed: false, exhausted: false })).toBe(
      "aiNotInPlan",
    )
    expect(aiPlanDeniedKey({ allowed: true, exhausted: true })).toBe("aiQuota")
    expect(aiPlanDeniedKey({ allowed: true, exhausted: false })).toBeNull()
  })
})
