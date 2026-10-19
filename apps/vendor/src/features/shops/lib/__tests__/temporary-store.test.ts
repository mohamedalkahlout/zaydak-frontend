import { describe, it, expect } from "vitest"
import en from "@/shared/messages/en"
import ar from "@/shared/messages/ar"
import {
  TEMPORARY_STORE_NAMES,
  isTemporaryHandle,
  isTemporaryName,
  mintTemporaryHandle,
  temporaryStoreHint,
} from "../temporary-store"

// The detection is a hand-written mirror of two other places — the message
// files' `createStore.temporaryName` and `mintTemporaryHandle()` — and nothing
// at runtime ties them together. These tests are the tie: rename the
// placeholder in one locale, or change the handle's shape, and the picker
// stops recognising fresh stores unless this file is updated with it.

describe("isTemporaryName", () => {
  it("lists every locale's createStore.temporaryName", () => {
    expect(TEMPORARY_STORE_NAMES).toContain(en.createStore.temporaryName)
    expect(TEMPORARY_STORE_NAMES).toContain(ar.createStore.temporaryName)
  })

  it("matches the placeholder in either locale, whitespace aside", () => {
    expect(isTemporaryName("My Store")).toBe(true)
    expect(isTemporaryName("  My Store ")).toBe(true)
    expect(isTemporaryName("متجري")).toBe(true)
  })

  it("does not match a name the vendor chose", () => {
    expect(isTemporaryName("Acme")).toBe(false)
    expect(isTemporaryName("My Store 2")).toBe(false)
    expect(isTemporaryName("")).toBe(false)
  })
})

describe("isTemporaryHandle", () => {
  it("accepts the twelve-hex handle mintTemporaryHandle mints, suffixed or not", () => {
    expect(isTemporaryHandle("3f9a1c2b7d4e")).toBe(true)
    expect(isTemporaryHandle("3f9a1c2b7d4e-1")).toBe(true)
    expect(isTemporaryHandle("3f9a1c2b7d4e-12")).toBe(true)
  })

  it("matches a handle it just minted", () => {
    expect(isTemporaryHandle(mintTemporaryHandle())).toBe(true)
  })

  it("rejects a chosen handle, upper case, and the wrong length", () => {
    expect(isTemporaryHandle("acme")).toBe(false)
    expect(isTemporaryHandle("my-store-1")).toBe(false)
    expect(isTemporaryHandle("3F9A1C2B7D4E")).toBe(false)
    expect(isTemporaryHandle("3f9a1c2b7d4")).toBe(false)
    expect(isTemporaryHandle("3f9a1c2b7d4e5")).toBe(false)
    expect(isTemporaryHandle("3f9a1c2b7d4e-")).toBe(false)
  })
})

describe("temporaryStoreHint", () => {
  it("points at the name first, then the handle, then nowhere", () => {
    expect(temporaryStoreHint({ name: "My Store", slug: "3f9a1c2b7d4e" })).toBe(
      "name",
    )
    expect(temporaryStoreHint({ name: "My Store", slug: "acme" })).toBe("name")
    expect(temporaryStoreHint({ name: "Acme", slug: "3f9a1c2b7d4e" })).toBe(
      "handle",
    )
    expect(temporaryStoreHint({ name: "Acme", slug: "acme" })).toBeNull()
  })
})
