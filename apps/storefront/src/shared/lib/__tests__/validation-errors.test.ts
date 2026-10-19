import { describe, it, expect } from "vitest"
import {
  validationErrors,
  validationMessage,
  hasValidationCode,
  errorCodeOf,
} from "../validation-errors"

const combined = (
  validation_errors: unknown,
  extra: Record<string, unknown> = {},
) => ({
  message: "Validation failed",
  errors: [
    {
      message: "Validation failed",
      extensions: { validation_errors, ...extra },
    },
  ],
})

describe("validationMessage", () => {
  it("returns the server's sentence rather than the constant", () => {
    const err = combined([
      {
        field: "products",
        code: "ORDER_NOT_ALLOCATABLE",
        messages: ["No location can fulfill the requested quantity."],
      },
    ])

    expect(validationMessage(err)).toBe(
      "No location can fulfill the requested quantity.",
    )
  })

  it("joins every message when multiple fields are reported", () => {
    const err = combined([
      {
        field: "shipping_address",
        code: "ADDRESS_INCOMPLETE",
        messages: ["Street address is required."],
      },
      {
        field: "customer_contact",
        code: "CONTACT_REQUIRED",
        messages: ["Phone number is required."],
      },
    ])

    expect(validationMessage(err)).toBe(
      "Street address is required. Phone number is required.",
    )
  })

  it("de-duplicates a message repeated across fields", () => {
    const err = combined([
      { field: "a", code: "X", messages: ["Same error message."] },
      { field: "b", code: "X", messages: ["Same error message."] },
    ])

    expect(validationMessage(err)).toBe("Same error message.")
  })

  it("falls back to detail when validation_errors is empty", () => {
    const err = combined([], { detail: "Gateway rejected transaction" })
    expect(validationMessage(err)).toBe("Gateway rejected transaction")
  })

  it("never returns the constant 'Validation failed'", () => {
    expect(
      validationMessage({ message: "Validation failed" }, "Order failed"),
    ).toBe("Order failed")
  })

  it("keeps a real top-level message when there is one", () => {
    expect(validationMessage({ message: "Network request failed" })).toBe(
      "Network request failed",
    )
  })

  it("returns fallback for non-error shapes", () => {
    expect(validationMessage(null, "Fallback error")).toBe("Fallback error")
    expect(validationMessage(undefined, "Fallback error")).toBe("Fallback error")
  })
})

describe("validationErrors and hasValidationCode", () => {
  const entry = [
    { field: "products", code: "ORDER_NOT_ALLOCATABLE", messages: ["Out of stock."] },
  ]

  it("reads CombinedGraphQLErrors errors", () => {
    expect(validationErrors(combined(entry))).toEqual(entry)
  })

  it("identifies code with hasValidationCode", () => {
    expect(hasValidationCode(combined(entry), "ORDER_NOT_ALLOCATABLE")).toBe(true)
    expect(hasValidationCode(combined(entry), "OTHER_CODE")).toBe(false)
  })
})

describe("errorCodeOf", () => {
  it("reads the code off CombinedGraphQLErrors", () => {
    expect(
      errorCodeOf({
        errors: [{ message: "x", extensions: { error_code: "CHECKOUT_EXPECTATION_FAILED" } }],
      }),
    ).toBe("CHECKOUT_EXPECTATION_FAILED")
  })

  it("reads it off graphQLErrors and a cause too", () => {
    expect(
      errorCodeOf({ graphQLErrors: [{ extensions: { error_code: "A" } }] }),
    ).toBe("A")
    expect(
      errorCodeOf({ cause: { errors: [{ extensions: { error_code: "B" } }] } }),
    ).toBe("B")
  })

  it("is null when there is none, or it is not a string", () => {
    expect(errorCodeOf(null)).toBeNull()
    expect(errorCodeOf(new Error("network"))).toBeNull()
    expect(errorCodeOf({ errors: [{ extensions: { error_code: 42 } }] })).toBeNull()
  })
})
