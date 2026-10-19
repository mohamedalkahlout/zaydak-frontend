import { CombinedGraphQLErrors, ServerError } from "@apollo/client/errors"

import { gql } from "@/shared/api/generated"

/**
 * TRANSITIONAL — delete this file once every API this console can talk to
 * returns `code_length` on `sendOtpCode` and `forgetPassword`.
 *
 * Vercel ships this app minutes after a push; the API image is rebuilt on its
 * own schedule. A console that selects `data { code_length }` against an API
 * that does not have it is refused at GraphQL validation, and without this the
 * refusal would take admin sign-in by code and password reset down until the
 * API caught up. So a send that is refused *for an unknown field* is sent again
 * with the selection it had before, and the screen draws the six boxes it
 * always drew. A request that fails validation is never executed, so the retry
 * cannot text or mail a second code.
 *
 * The global error link does not react to that first refusal: the back-end's
 * `formatError` answers it as `VALIDATION_ERROR`, which the link only logs —
 * it signs out on the auth codes alone.
 *
 * The old `forgetPassword` selection needs no copy here: it is
 * `FORGET_PASSWORD` itself, which the users screen keeps using.
 */

/** `SEND_OTP_CODE` exactly as it was before `code_length` existed. */
export const SEND_OTP_CODE_LEGACY = gql(`
  mutation AdminSendOtpCodeLegacy($input: SendOtpInput!) {
    sendOtpCode(input: $input) {
      success
    }
  }
`)

const UNKNOWN_FIELD = /Cannot query field/

/**
 * The API does not know a field the operation selected. Apollo Server calls
 * that `GRAPHQL_VALIDATION_FAILED`; ours rewrites it to `VALIDATION_ERROR` and
 * keeps graphql-js's message, so the message is what is matched. A 400 that
 * arrived without a GraphQL content type is read from its body.
 */
export function isUnknownFieldError(err: unknown): boolean {
  if (CombinedGraphQLErrors.is(err)) {
    return err.errors.some(
      (e) =>
        e.extensions?.code === "GRAPHQL_VALIDATION_FAILED" ||
        UNKNOWN_FIELD.test(e.message),
    )
  }
  if (ServerError.is(err)) {
    return err.statusCode === 400 && UNKNOWN_FIELD.test(err.bodyText)
  }
  return false
}

/**
 * Run `current`; if the API refused it for a field it does not know, run
 * `legacy` once instead. Any other failure is the caller's, unchanged.
 */
export async function withLegacyFallback<T>(
  current: () => Promise<T>,
  legacy: () => Promise<T>,
): Promise<T> {
  try {
    return await current()
  } catch (err) {
    if (!isUnknownFieldError(err)) throw err
    return legacy()
  }
}
