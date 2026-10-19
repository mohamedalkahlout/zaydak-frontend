import { CombinedGraphQLErrors } from "@apollo/client/errors"
import { describe, expect, it, vi } from "vitest"

import {
  applyValidationErrors,
  getErrorCode,
  getValidationErrors,
} from "../graphql-errors"

function gqlError(extensions: Record<string, unknown>) {
  return new CombinedGraphQLErrors({
    errors: [{ message: "Bad request", extensions }],
  })
}

describe("getErrorCode", () => {
  it("prefers the normalized error_code", () => {
    expect(getErrorCode(gqlError({ error_code: "INVALID_OTP", code: "BAD" }))).toBe(
      "INVALID_OTP",
    )
  })

  it("falls back to Apollo's generic code", () => {
    expect(getErrorCode(gqlError({ code: "UNAUTHENTICATED" }))).toBe(
      "UNAUTHENTICATED",
    )
  })

  it("returns null when extensions carry no code", () => {
    expect(getErrorCode(gqlError({}))).toBeNull()
  })

  it("returns null for anything that is not a GraphQL error", () => {
    expect(getErrorCode(new Error("network down"))).toBeNull()
    expect(getErrorCode(undefined)).toBeNull()
  })
})

describe("getValidationErrors", () => {
  it("reads validation_errors off the first error", () => {
    const err = gqlError({
      validation_errors: [{ field: "password", messages: ["Too short"] }],
    })
    expect(getValidationErrors(err)).toEqual([
      { field: "password", messages: ["Too short"] },
    ])
  })

  it("returns an empty array when absent or not a GraphQL error", () => {
    expect(getValidationErrors(gqlError({}))).toEqual([])
    expect(getValidationErrors(new Error("boom"))).toEqual([])
  })
})

describe("applyValidationErrors", () => {
  it("routes a known field to setError with the first message", () => {
    const setError = vi.fn()
    const err = gqlError({
      validation_errors: [
        { field: "password", messages: ["Too short", "Also weak"] },
      ],
    })

    const unmapped = applyValidationErrors(err, setError, ["password"])

    expect(setError).toHaveBeenCalledWith("password", {
      type: "server",
      message: "Too short",
    })
    expect(unmapped).toEqual([])
  })

  it("returns unknown fields instead of dropping them", () => {
    const setError = vi.fn()
    const err = gqlError({
      validation_errors: [{ field: "captcha", messages: ["Expired"] }],
    })

    const unmapped = applyValidationErrors(err, setError, ["password"])

    expect(setError).not.toHaveBeenCalled()
    expect(unmapped).toEqual([{ field: "captcha", message: "Expired" }])
  })

  it("falls back to the code, then to a generic message", () => {
    const setError = vi.fn()
    const err = gqlError({
      validation_errors: [
        { field: "identifier", code: "ALREADY_TAKEN" },
        { field: "code" },
      ],
    })

    applyValidationErrors(err, setError, ["identifier", "code"])

    expect(setError).toHaveBeenNthCalledWith(1, "identifier", {
      type: "server",
      message: "ALREADY_TAKEN",
    })
    expect(setError).toHaveBeenNthCalledWith(2, "code", {
      type: "server",
      message: "Invalid value",
    })
  })
})
