import { describe, expect, it } from "vitest"
import { draftCustomerErrorKey, draftQuoteErrorKey } from "../customer"

/** What Apollo hands a caller for a `VALIDATION_ERROR` with one entry. */
const validationError = (field: string, code: string) => ({
  message: "Validation failed",
  errors: [
    {
      message: "Validation failed",
      extensions: {
        error_code: "VALIDATION_ERROR",
        validation_errors: [{ field, code, messages: ["refused"] }],
      },
    },
  ],
})

describe("draftQuoteErrorKey", () => {
  it("is null when the quote did not fail", () => {
    expect(draftQuoteErrorKey(undefined)).toBeNull()
    expect(draftQuoteErrorKey(null)).toBeNull()
  })

  it("names the customer for an invalid_customer refusal", () => {
    expect(
      draftQuoteErrorKey(validationError("customer_id", "invalid_customer")),
    ).toBe("shippingQuoteCustomerInvalid")
  })

  it("falls back to the generic key for any other failure", () => {
    expect(draftQuoteErrorKey(validationError("id", "not_editable"))).toBe(
      "shippingQuoteFailed",
    )
    expect(draftQuoteErrorKey(new Error("Failed to fetch"))).toBe(
      "shippingQuoteFailed",
    )
  })
})

describe("draftCustomerErrorKey", () => {
  it("still maps invalid_customer to the save-time message", () => {
    expect(
      draftCustomerErrorKey(validationError("customer_id", "invalid_customer")),
    ).toBe("customerErrorDeleted")
    expect(draftCustomerErrorKey(validationError("id", "not_editable"))).toBe(
      null,
    )
  })
})
