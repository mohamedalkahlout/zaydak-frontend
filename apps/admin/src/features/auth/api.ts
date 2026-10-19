import { gql } from "@/shared/api/generated"

/**
 * Admin console GraphQL operations.
 *
 * `gql` here is the codegen-generated tag, not Apollo's — every document below
 * is a `TypedDocumentNode`, so `useQuery`/`useMutation` infer their data and
 * variable types with no generic argument. Run `npm run codegen` after touching
 * an operation (or after the back-end schema changes).
 *
 * The auth-token selection is written out per operation rather than shared as a
 * fragment: the client preset masks fragments by default, and the login screens
 * read `data.role` straight off the result to run the admin role gate.
 */

export const LOGIN = gql(`
  mutation AdminLogin($input: LoginInput!) {
    login(input: $input) {
      success
      message
      data {
        access_token
        access_token_expires_at
        refresh_token
        refresh_token_expires_at
        role
        permissions
        email_verified
      }
    }
  }
`)

/**
 * `code_length` is how many boxes the code step draws: 4 to 8, the OTP setting
 * for an email and the SMS provider's own length for a text. Sent through
 * `useSendOtpCode` (`lib/send-code.ts`), never directly.
 */
export const SEND_OTP_CODE = gql(`
  mutation AdminSendOtpCode($input: SendOtpInput!) {
    sendOtpCode(input: $input) {
      success
      data {
        code_length
      }
    }
  }
`)

export const VERIFY_OTP_CODE = gql(`
  mutation AdminVerifyOtpCode($input: VerifyOtpInput!) {
    verifyOtpCode(input: $input) {
      success
      data {
        access_token
        access_token_expires_at
        refresh_token
        refresh_token_expires_at
        role
        permissions
        email_verified
      }
    }
  }
`)

/**
 * `forgetPassword` with nothing read back — the users screen sends a reset
 * code on somebody else's behalf and draws no boxes for it.
 */
export const FORGET_PASSWORD = gql(`
  mutation AdminForgetPassword($input: ForgetPasswordInput!) {
    forgetPassword(input: $input) {
      success
      message
    }
  }
`)

/**
 * `forgetPassword` for the forgot-password and reset-code screens, which draw
 * `code_length` boxes. Sent through `useForgetPassword` (`lib/send-code.ts`).
 */
export const REQUEST_RESET_CODE = gql(`
  mutation AdminRequestResetCode($input: ForgetPasswordInput!) {
    forgetPassword(input: $input) {
      success
      message
      data {
        code_length
      }
    }
  }
`)

export const RESET_PASSWORD = gql(`
  mutation AdminResetPassword($input: ResetPasswordInput!) {
    resetPassword(input: $input) {
      success
    }
  }
`)

// The `users` query moved to `features/users/api.ts` when the screen grew
// mutations — it was only ever here because the read-only list arrived before
// the feature folder did.

/**
 * Who is signed in.
 *
 * The auth store holds tokens and nothing else, and `proxy.ts` never decodes
 * the JWT, so the console has no local copy of the caller's id or role. The
 * users screen needs both to know which rows it may offer actions on — asking
 * the server keeps that answer the same one the server will enforce.
 */
export const ME = gql(`
  query AdminMe {
    me {
      success
      data {
        id
        name
        email
        role
      }
    }
  }
`)
