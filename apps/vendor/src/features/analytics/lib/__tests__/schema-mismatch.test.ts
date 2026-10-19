import { describe, expect, it } from "vitest"
import { CombinedGraphQLErrors, ServerError } from "@apollo/client/errors"
import { isSchemaMismatchError } from "../schema-mismatch"

/**
 * What the API behind dash.zaydak.com answered to `AnalyticsSalesByChannel`
 * before its image was rebuilt: HTTP 400, two VALIDATION_ERRORs carrying
 * graphql-js's own messages.
 */
const OLD_API = [
  'Unknown type "SalesByChannelInput".',
  'Cannot query field "salesByChannel" on type "Query".',
]

const graphqlErrors = (
  messages: string[],
  extensions: Record<string, unknown> = { error_code: "VALIDATION_ERROR" },
) =>
  new CombinedGraphQLErrors({
    errors: messages.map((message) => ({ message, extensions })),
  })

describe("isSchemaMismatchError", () => {
  it("is an API that does not have the field yet", () => {
    expect(isSchemaMismatchError(graphqlErrors(OLD_API))).toBe(true)
  })

  it("is Apollo Server's own validation code too", () => {
    expect(
      isSchemaMismatchError(
        graphqlErrors(["anything"], { code: "GRAPHQL_VALIDATION_FAILED" }),
      ),
    ).toBe(true)
  })

  it("is a 400 read from its body when it came without a GraphQL type", () => {
    const body = JSON.stringify({ errors: [{ message: OLD_API[1] }] })
    const server = (status: number) =>
      new ServerError("Response not successful", {
        response: new Response(body, { status }),
        bodyText: body,
      })
    expect(isSchemaMismatchError(server(400))).toBe(true)
    expect(isSchemaMismatchError(server(500))).toBe(false)
  })

  it("is not an input validation error, a server error or no error", () => {
    // Our formatError words a class-validator refusal as the translated
    // code, never as graphql-js's schema wording.
    expect(isSchemaMismatchError(graphqlErrors(["Validation failed"]))).toBe(
      false,
    )
    expect(
      isSchemaMismatchError(
        graphqlErrors(["Internal error"], { error_code: "INTERNAL_ERROR" }),
      ),
    ).toBe(false)
    // One schema complaint beside a real failure still deserves a retry.
    expect(
      isSchemaMismatchError(
        new CombinedGraphQLErrors({
          errors: [
            { message: OLD_API[1] },
            { message: "boom", extensions: { error_code: "INTERNAL_ERROR" } },
          ],
        }),
      ),
    ).toBe(false)
    expect(isSchemaMismatchError(new Error("Failed to fetch"))).toBe(false)
    expect(isSchemaMismatchError(undefined)).toBe(false)
  })
})
