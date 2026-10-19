import { describe, it, expect } from "vitest"
import {
  becameSellerBadgeVariant,
  REPORT_MODEL_TYPES,
  SELLER_STATUS_FILTERS,
} from "../types"

describe("Moderation types & helpers", () => {
  it("maps becameSeller statuses to appropriate badge variants", () => {
    expect(becameSellerBadgeVariant("approved")).toBe("default")
    expect(becameSellerBadgeVariant("pending")).toBe("outline")
    expect(becameSellerBadgeVariant("rejected")).toBe("destructive")
    expect(becameSellerBadgeVariant("unknown")).toBe("secondary")
  })

  it("contains all expected report model types", () => {
    expect(REPORT_MODEL_TYPES).toContain("all")
    expect(REPORT_MODEL_TYPES).toContain("Shop")
    expect(REPORT_MODEL_TYPES).toContain("Product")
    expect(REPORT_MODEL_TYPES).toContain("User")
    expect(REPORT_MODEL_TYPES).toContain("Review")
  })

  it("contains all expected seller status filters", () => {
    expect(SELLER_STATUS_FILTERS).toContain("all")
    expect(SELLER_STATUS_FILTERS).toContain("pending")
    expect(SELLER_STATUS_FILTERS).toContain("approved")
    expect(SELLER_STATUS_FILTERS).toContain("rejected")
  })
})
