import { gql } from "@apollo/client"

/**
 * TRANSITIONAL — delete this file once every API this dashboard can talk to
 * returns `code_length` on `sendOtpCode` and `forgetPassword`.
 *
 * Vercel ships this app minutes after a push; the API image is rebuilt on its
 * own schedule. A dashboard that selects `data { code_length }` against an API
 * that does not have it is refused at GraphQL validation, and without this the
 * refusal would take staff sign-in and password reset down until the API
 * caught up. So a send that is refused *for an unknown field* is sent again
 * with the selection it had before, and the screen draws the six boxes it
 * always drew. A request that fails validation is never executed, so the retry
 * cannot text or mail a second code.
 *
 * Neither global error link reacts to that first refusal: the back-end's
 * `formatError` answers it as `VALIDATION_ERROR`, which the link keeps silent
 * (it is in `SILENT_CODES`) and does not sign anyone out over.
 */

/** `SEND_OTP_CODE` exactly as it was before `code_length` existed. */
export const SEND_OTP_CODE_LEGACY = gql`
  mutation SendOtpCodeLegacy($input: SendOtpInput!) {
    sendOtpCode(input: $input) {
      success
    }
  }
`

/** `FORGET_PASSWORD` exactly as it was before `code_length` existed. */
export const FORGET_PASSWORD_LEGACY = gql`
  mutation ForgetPasswordLegacy($input: ForgetPasswordInput!) {
    forgetPassword(input: $input) {
      success
      message
    }
  }
`

// The refusal test and the retry are shared with every other field added the
// same way; re-exported so this file's callers and tests are unchanged.
export {
  isUnknownFieldError,
  withLegacyFallback,
} from "@/shared/lib/apollo/legacy-fallback"
