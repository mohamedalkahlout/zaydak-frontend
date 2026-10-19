import { describe, it, expect } from "vitest"
import { isStoreResetError } from "../store-reset-error"

/**
 * Both forms have to match. Apollo prints invariant texts only in development;
 * a production build ships the *number* behind a lookup URL, so a matcher
 * written against the English sentence alone passes every test here and fails
 * in the one place a vendor would meet it.
 */

const DEV_MESSAGE = "Store reset while query was in flight (not completed in link chain)"

/** Exactly what `newInvariantError(91)` produces once texts are stripped. */
function minified(code: number): string {
  const payload = encodeURIComponent(
    JSON.stringify({ version: "4.2.6", message: code, args: [] }),
  )
  return `An error occurred! For more details, see the full error text at https://go.apollo.dev/c/err#${payload}`
}

describe("isStoreResetError", () => {
  it("matches the development message", () => {
    expect(isStoreResetError(new Error(DEV_MESSAGE))).toBe(true)
  })

  it("matches the production invariant-91 link", () => {
    expect(isStoreResetError(new Error(minified(91)))).toBe(true)
  })

  it("does not match a neighbouring invariant code", () => {
    expect(isStoreResetError(new Error(minified(89)))).toBe(false)
    expect(isStoreResetError(new Error(minified(910)))).toBe(false)
  })

  it("does not match ordinary failures", () => {
    expect(isStoreResetError(new Error("Failed to fetch"))).toBe(false)
    expect(isStoreResetError(new TypeError("x is not a function"))).toBe(false)
  })

  it("reads a message off a plain object, and shrugs at anything else", () => {
    expect(isStoreResetError({ message: DEV_MESSAGE })).toBe(true)
    expect(isStoreResetError(null)).toBe(false)
    expect(isStoreResetError(undefined)).toBe(false)
    expect(isStoreResetError({})).toBe(false)
  })
})
