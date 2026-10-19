import { describe, expect, it } from "vitest"

import { isPublicPath, routeDecision } from "../route-access"

function jwt(role: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url")
  return `${b64({ alg: "HS256" })}.${b64({ sub: "u1", role })}.signature`
}

const ADMIN = jwt("admin")
const SUPER_ADMIN = jwt("super_admin")
const VENDOR = jwt("vendor")
const CUSTOMER = jwt("customer")

const at = (pathname: string, token?: string, expired = false) =>
  routeDecision({ pathname, token, expired })

describe("isPublicPath", () => {
  it("covers the auth screens and nothing else", () => {
    expect(isPublicPath("/login")).toBe(true)
    expect(isPublicPath("/verify-otp")).toBe(true)
    expect(isPublicPath("/reset-password?identifier=a")).toBe(true)
    expect(isPublicPath("/users")).toBe(false)
    expect(isPublicPath("/withdrawals")).toBe(false)
    expect(isPublicPath("/")).toBe(false)
  })
})

describe("routeDecision — logged out", () => {
  it("sends an anonymous visitor to /login, preserving where they were headed", () => {
    expect(at("/withdrawals")).toEqual({
      type: "redirect",
      to: "/login?redirect=%2Fwithdrawals",
      clearCookies: false,
    })
  })

  it("lets an anonymous visitor reach the auth screens", () => {
    expect(at("/login")).toEqual({ type: "next" })
    expect(at("/forgot-password")).toEqual({ type: "next" })
  })
})

describe("routeDecision — admin session", () => {
  it.each([ADMIN, SUPER_ADMIN])("admits an admin to the console", (token) => {
    expect(at("/users", token)).toEqual({ type: "next" })
    expect(at("/withdrawals", token)).toEqual({ type: "next" })
    expect(at("/commissions", token)).toEqual({ type: "next" })
  })

  it("bounces a signed-in admin off the auth screens", () => {
    expect(at("/login", ADMIN)).toEqual({
      type: "redirect",
      to: "/users",
      clearCookies: false,
    })
  })

  it("clears the jar when the refresh failed upstream", () => {
    expect(at("/login", ADMIN, true)).toEqual({ type: "clear" })
  })
})

describe("routeDecision — a non-admin session (the shared-cookie-jar bug)", () => {
  // Regression: the vendor dashboard and this console both wrote `access_token`
  // at path=/ on the same host. Cookies are not isolated by port, so a vendor
  // who signed in on :3001 arrived at :3002 already carrying a session, and the
  // guard — which only checked that *a* cookie existed — sent them to /users.
  it.each([VENDOR, CUSTOMER])(
    "never lets a non-admin token reach the console",
    (token) => {
      for (const path of ["/users", "/withdrawals", "/commissions", "/"]) {
        expect(at(path, token)).toEqual({
          type: "redirect",
          to: "/login?forbidden=1",
          clearCookies: true,
        })
      }
    },
  )

  it("does not redirect a non-admin from /login to /users", () => {
    expect(at("/login", VENDOR)).toEqual({ type: "clear" })
  })

  it("drops the stale jar so the bounce cannot loop", () => {
    const decision = at("/users", VENDOR)
    expect(decision).toMatchObject({ clearCookies: true })
  })
})

describe("routeDecision — malformed tokens", () => {
  it("treats an opaque cookie value as a non-admin, not as a valid session", () => {
    // `access_token=dummy` used to open the whole console.
    expect(at("/withdrawals", "dummy")).toEqual({
      type: "redirect",
      to: "/login?forbidden=1",
      clearCookies: true,
    })
  })

  it("treats a token with no role claim as a non-admin", () => {
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url")
    const roleless = `${b64({ alg: "HS256" })}.${b64({ sub: "u1" })}.sig`
    expect(at("/users", roleless)).toMatchObject({ type: "redirect" })
  })

  it("is case-sensitive about the role, matching the back-end's lowercase claim", () => {
    expect(at("/users", jwt("ADMIN"))).toMatchObject({ type: "redirect" })
  })
})
