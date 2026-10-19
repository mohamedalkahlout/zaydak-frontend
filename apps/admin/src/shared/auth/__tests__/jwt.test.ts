import { describe, expect, it } from "vitest"

import { decodeJwtPayload, readRoleFromToken } from "../jwt"

/** Builds an unsigned, real-shaped JWT — the guard never checks the signature. */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url")
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.signature`
}

describe("decodeJwtPayload", () => {
  it("reads the claims the back-end signs", () => {
    const token = jwt({
      sub: "user-1",
      role: "super_admin",
      permissions: ["manage_users"],
    })
    expect(decodeJwtPayload(token)).toMatchObject({
      sub: "user-1",
      role: "super_admin",
      permissions: ["manage_users"],
    })
  })

  it("survives multi-byte UTF-8 claims", () => {
    const token = jwt({ role: "admin", name: "أسامة" })
    expect(decodeJwtPayload(token)).toMatchObject({ role: "admin" })
  })

  it("returns null for anything that is not a three-part token", () => {
    expect(decodeJwtPayload("")).toBeNull()
    expect(decodeJwtPayload(undefined)).toBeNull()
    expect(decodeJwtPayload(null)).toBeNull()
    expect(decodeJwtPayload("dummy")).toBeNull()
    expect(decodeJwtPayload("a.b")).toBeNull()
    expect(decodeJwtPayload("a.b.c.d")).toBeNull()
  })

  it("returns null when the payload is not valid base64url JSON", () => {
    expect(decodeJwtPayload("header.!!!not-base64!!!.sig")).toBeNull()
    expect(decodeJwtPayload(`header.${Buffer.from("not json").toString("base64url")}.sig`)).toBeNull()
  })

  it("returns null when the payload is a JSON scalar, not an object", () => {
    const scalar = Buffer.from(JSON.stringify("just-a-string")).toString("base64url")
    expect(decodeJwtPayload(`header.${scalar}.sig`)).toBeNull()
  })
})

describe("readRoleFromToken", () => {
  it("extracts the role claim", () => {
    expect(readRoleFromToken(jwt({ role: "admin" }))).toBe("admin")
    expect(readRoleFromToken(jwt({ role: "vendor" }))).toBe("vendor")
  })

  it("returns null when the claim is absent or not a string", () => {
    expect(readRoleFromToken(jwt({ sub: "u1" }))).toBeNull()
    expect(readRoleFromToken(jwt({ role: 42 }))).toBeNull()
  })

  it("returns null for an opaque non-JWT cookie value", () => {
    expect(readRoleFromToken("dummy")).toBeNull()
  })
})
