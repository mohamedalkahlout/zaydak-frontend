import { describe, it, expect } from "vitest"
import {
  validationErrors,
  validationMessage,
  hasValidationCode,
} from "../validation-errors"

/**
 * Getting the reason out of a refusal.
 *
 * The property this protects: **`err.message` on a validation failure is always
 * the constant "Validation failed"**, so anything reading it shows a person a
 * sentence with no information, for an action the server refused for a reason
 * it had already written down. These pin that the reason is found in each of
 * the shapes Apollo actually hands a caller, and that the generic string never
 * survives as the thing displayed.
 */

const combined = (
  validation_errors: unknown,
  extra: Record<string, unknown> = {},
) => ({
  message: "Validation failed",
  errors: [{ message: "Validation failed", extensions: { validation_errors, ...extra } }],
})

describe("validationMessage", () => {
  it("returns the server's sentence rather than the constant", () => {
    const err = combined([
      {
        field: "id",
        code: "LOCATION_NOT_EMPTY",
        messages: ["Location still holds stock in 3 level(s). Transfer or zero out first."],
      },
    ])

    expect(validationMessage(err)).toBe(
      "Location still holds stock in 3 level(s). Transfer or zero out first.",
    )
  })

  /**
   * `enableCarrierPickup` reports each missing field as its own entry. Showing
   * one at a time turns a single fix into three round trips.
   */
  it("joins every message, so a merchant sees all the missing fields at once", () => {
    const err = combined([
      { field: "national_address_code", code: "LOCATION_INCOMPLETE_FOR_CARRIER", messages: ["Add a national address code."] },
      { field: "phone", code: "LOCATION_INCOMPLETE_FOR_CARRIER", messages: ["Add a phone number."] },
    ])

    expect(validationMessage(err)).toBe(
      "Add a national address code. Add a phone number.",
    )
  })

  it("de-duplicates a message repeated across fields", () => {
    const err = combined([
      { field: "a", code: "X", messages: ["Same thing."] },
      { field: "b", code: "X", messages: ["Same thing."] },
    ])

    expect(validationMessage(err)).toBe("Same thing.")
  })

  // The carrier's own refusal is more use than our generic sentence.
  it("falls back to `detail` when there are no validation entries", () => {
    const err = combined([], { detail: "OTO refreshToken HTTP 401: invalid grant" })

    expect(validationMessage(err)).toBe("OTO refreshToken HTTP 401: invalid grant")
  })

  it("never returns the constant itself", () => {
    expect(validationMessage({ message: "Validation failed" }, "Could not save")).toBe(
      "Could not save",
    )
  })

  it("keeps a real top-level message when there is one", () => {
    expect(validationMessage({ message: "Shop not found" })).toBe("Shop not found")
  })

  it("returns the fallback for something that is not an error shape at all", () => {
    expect(validationMessage(undefined, "Could not save")).toBe("Could not save")
    expect(validationMessage(null, "Could not save")).toBe("Could not save")
  })
})

describe("validationErrors — the shapes Apollo hands a caller", () => {
  const entry = [{ field: "id", code: "LOCATION_NOT_EMPTY", messages: ["Nope."] }]

  it("reads a CombinedGraphQLErrors `.errors`", () => {
    expect(validationErrors(combined(entry))).toEqual(entry)
  })

  it("reads the legacy `.graphQLErrors`", () => {
    const err = {
      message: "Validation failed",
      graphQLErrors: [{ extensions: { validation_errors: entry } }],
    }
    expect(validationErrors(err)).toEqual(entry)
  })

  it("reads a single error carrying extensions directly", () => {
    expect(
      validationErrors({ extensions: { validation_errors: entry } }),
    ).toEqual(entry)
  })

  it("reads through a rethrow that kept the original on `.cause`", () => {
    expect(validationErrors({ message: "boom", cause: combined(entry) })).toEqual(
      entry,
    )
  })

  it("returns an empty array rather than throwing on anything else", () => {
    expect(validationErrors(new Error("plain"))).toEqual([])
    expect(validationErrors(undefined)).toEqual([])
  })
})

describe("hasValidationCode", () => {
  it("matches a code the caller wants to branch on", () => {
    const err = combined([
      { field: "shipping_provider", code: "SHIPPING_PROVIDER_NOT_CONFIGURED", messages: ["Connect one."] },
    ])

    expect(hasValidationCode(err, "SHIPPING_PROVIDER_NOT_CONFIGURED")).toBe(true)
    expect(hasValidationCode(err, "LOCATION_NOT_EMPTY")).toBe(false)
  })
})
