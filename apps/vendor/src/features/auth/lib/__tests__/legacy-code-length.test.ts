import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ApolloClient, InMemoryCache } from "@apollo/client"
import { CombinedGraphQLErrors, ServerError } from "@apollo/client/errors"

/**
 * TRANSITIONAL — goes with `../legacy-code-length.ts`.
 *
 * What these pin is the deploy-order safety net: a dashboard shipped before
 * the API that knows `code_length` must still sign staff in. The last block
 * drives the real link chain over a stubbed fetch answering exactly what the
 * old API answers, so the refusal is detected in the shape it really arrives
 * in, and the global error link is seen to stay quiet about it.
 */

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
const session = vi.hoisted(() => ({ forceLogout: vi.fn() }))

vi.mock("sileo", () => ({ sileo: toast }))
vi.mock("@/shared/lib/auth/session", () => session)

const { isUnknownFieldError, withLegacyFallback, SEND_OTP_CODE_LEGACY } =
  await import("../legacy-code-length")
const { SEND_OTP_CODE } = await import("../../api")
const { composeLinks } = await import("@/shared/lib/apollo/links")

const UNKNOWN_FIELD = 'Cannot query field "code_length" on type "OtpSentData".'

function graphqlError(message: string, extensions: Record<string, unknown>) {
  return new CombinedGraphQLErrors({ errors: [{ message, extensions }] })
}

describe("isUnknownFieldError", () => {
  it("is the old API refusing the new field, as our formatError words it", () => {
    expect(
      isUnknownFieldError(
        graphqlError(UNKNOWN_FIELD, { error_code: "VALIDATION_ERROR" }),
      ),
    ).toBe(true)
  })

  it("is Apollo's own validation code too", () => {
    expect(
      isUnknownFieldError(
        graphqlError("anything", { code: "GRAPHQL_VALIDATION_FAILED" }),
      ),
    ).toBe(true)
  })

  it("is not a refusal the screen has to show", () => {
    for (const code of [
      "OTP_COOLDOWN",
      "PHONE_NOT_CONFIRMED",
      "VALIDATION_ERROR",
      "TOO_MANY_REQUESTS",
    ]) {
      expect(
        isUnknownFieldError(graphqlError("refused", { error_code: code })),
      ).toBe(false)
    }
    expect(isUnknownFieldError(new Error(UNKNOWN_FIELD))).toBe(false)
    expect(isUnknownFieldError(null)).toBe(false)
  })

  it("reads a 400 that arrived without a GraphQL content type", () => {
    const body = JSON.stringify({ errors: [{ message: UNKNOWN_FIELD }] })
    const server = (status: number) =>
      new ServerError("refused", {
        response: new Response(body, { status }),
        bodyText: body,
      })

    expect(isUnknownFieldError(server(400))).toBe(true)
    expect(isUnknownFieldError(server(500))).toBe(false)
  })
})

describe("withLegacyFallback", () => {
  it("does not touch the legacy send when the current one answers", async () => {
    const legacy = vi.fn()
    await expect(
      withLegacyFallback(() => Promise.resolve("current"), legacy),
    ).resolves.toBe("current")
    expect(legacy).not.toHaveBeenCalled()
  })

  it("sends once more, the old way, when the API does not know the field", async () => {
    const legacy = vi.fn(() => Promise.resolve("legacy"))
    await expect(
      withLegacyFallback(
        () =>
          Promise.reject(
            graphqlError(UNKNOWN_FIELD, { error_code: "VALIDATION_ERROR" }),
          ),
        legacy,
      ),
    ).resolves.toBe("legacy")
    expect(legacy).toHaveBeenCalledTimes(1)
  })

  it("hands every other refusal back unchanged, and never retries it", async () => {
    const cooldown = graphqlError("wait", { error_code: "OTP_COOLDOWN" })
    const legacy = vi.fn()
    await expect(
      withLegacyFallback(() => Promise.reject(cooldown), legacy),
    ).rejects.toBe(cooldown)
    expect(legacy).not.toHaveBeenCalled()
  })

  it("lets the legacy send's own refusal through", async () => {
    const cooldown = graphqlError("wait", { error_code: "OTP_COOLDOWN" })
    await expect(
      withLegacyFallback(
        () =>
          Promise.reject(
            graphqlError(UNKNOWN_FIELD, { error_code: "VALIDATION_ERROR" }),
          ),
        () => Promise.reject(cooldown),
      ),
    ).rejects.toBe(cooldown)
  })

  it("keeps the old selection the old selection", () => {
    const printed = SEND_OTP_CODE_LEGACY.loc?.source.body ?? ""
    expect(printed).not.toContain("code_length")
    expect(SEND_OTP_CODE.loc?.source.body).toContain("code_length")
  })
})

describe("an old API over the real link chain", () => {
  const realFetch = globalThis.fetch

  beforeEach(() => {
    toast.error.mockReset()
    session.forceLogout.mockReset()
    // What Apollo Server answers a selection it cannot validate: a 400 in the
    // GraphQL response media type, after our formatError has rewritten it.
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          errors: [
            {
              message: UNKNOWN_FIELD,
              extensions: { success: false, error_code: "VALIDATION_ERROR" },
            },
          ],
        }),
        {
          status: 400,
          headers: {
            "content-type": "application/graphql-response+json; charset=utf-8",
          },
        },
      ),
    ) as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it("arrives as a refusal the fallback recognises, with no toast and no sign-out", async () => {
    const client = new ApolloClient({
      link: composeLinks(() => null),
      cache: new InMemoryCache(),
    })

    const error = await client
      .mutate({
        mutation: SEND_OTP_CODE,
        variables: { input: { identifier: "a@b.com" } },
      })
      .catch((err: unknown) => err)

    expect(isUnknownFieldError(error)).toBe(true)
    // The error link's reactions are dynamic imports; let them land.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(toast.error).not.toHaveBeenCalled()
    expect(session.forceLogout).not.toHaveBeenCalled()
  })
})
