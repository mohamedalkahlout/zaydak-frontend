import { describe, expect, it } from "vitest"
import type { DraftOrder } from "@/features/orders/types"
import { draftNumber, matchDraft } from "../match"

const draft = (over: Partial<DraftOrder> = {}): DraftOrder => ({
  id: "aaaaaaaa-bbbb-cccc-dddd-1234567890ab",
  shop_id: "shop",
  customer_name: "Sara",
  customer_contact: "sara@example.com",
  status: "open",
  manual_discount_cents: 0,
  currency: "SAR",
  tags: [],
  line_items: [],
  subtotal_cents: 0,
  estimated_total_cents: 0,
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
  ...over,
})

describe("matchDraft", () => {
  it("filters by status view without dropping an unmatched search", () => {
    expect(matchDraft(draft(), "", "open")).toBe(true)
    expect(matchDraft(draft(), "", "completed")).toBe(false)
  })

  it("matches the draft number, customer name, or contact", () => {
    expect(matchDraft(draft(), "90AB", "all")).toBe(true)
    expect(matchDraft(draft(), "sara", "all")).toBe(true)
    expect(matchDraft(draft(), "example.com", "all")).toBe(true)
    expect(matchDraft(draft(), "nope", "all")).toBe(false)
  })

  it("matches a tag", () => {
    const tagged = draft({ tags: ["wholesale", "phone-order"] })
    expect(matchDraft(tagged, "wholesale", "all")).toBe(true)
    expect(matchDraft(tagged, "PHONE", "all")).toBe(true)
    expect(matchDraft(tagged, "retail", "all")).toBe(false)
    // A draft with no tags must not throw on the new clause.
    expect(matchDraft(draft(), "wholesale", "all")).toBe(false)
  })

  it("requires both the view and the search to match", () => {
    expect(matchDraft(draft({ status: "completed" }), "sara", "open")).toBe(
      false,
    )
  })
})

describe("draftNumber", () => {
  it("is the last six characters of the id", () => {
    expect(draftNumber("aaaaaaaa-bbbb-cccc-dddd-1234567890ab")).toBe("#D-7890AB")
  })
})
