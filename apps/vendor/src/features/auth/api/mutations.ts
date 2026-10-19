import { gql } from "@apollo/client"

// ── Login / Register / Token ─────────────────────────

export const LOGIN = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      success
      data {
        access_token
        access_token_expires_at
        refresh_token
        refresh_token_expires_at
        token_type
        role
        permissions
        email_verified
      }
    }
  }
`

// The client-side `register` path was removed on 2026-08-12. Signup is the
// four-pane wizard in `features/signup/` (startVendorSignup → verify → complete),
// and this mutation had no caller after that cutover. The back-end `register`
// operation still exists and is unchanged — only the dead client half is gone.

export const REFRESH_TOKEN = gql`
  mutation RefreshToken($token: String!) {
    refreshToken(token: $token) {
      success
      data {
        access_token
        refresh_token
        access_token_expires_at
        refresh_token_expires_at
        token_type
      }
    }
  }
`

export const LOGOUT = gql`
  mutation Logout($token: String!) {
    logout(token: $token) {
      success
    }
  }
`

// ── OTP ───────────────────────────────────────────────

// `code_length` is how many boxes the code pane draws: 4 to 8, the OTP setting
// for an email and the SMS provider's own length for a text. Sent through
// `useSendOtpCode` (`../lib/send-code`), never directly.
export const SEND_OTP_CODE = gql`
  mutation SendOtpCode($input: SendOtpInput!) {
    sendOtpCode(input: $input) {
      success
      data {
        code_length
      }
    }
  }
`

export const VERIFY_OTP_CODE = gql`
  mutation VerifyOtpCode($input: VerifyOtpInput!) {
    verifyOtpCode(input: $input) {
      success
      data {
        access_token
        access_token_expires_at
        refresh_token
        refresh_token_expires_at
        token_type
        role
        permissions
        email_verified
      }
    }
  }
`

export const SIGN_IN_WITH_SOCIAL = gql`
  mutation SignInWithSocial($input: SignInWithSocialInput!) {
    signInWithSocial(input: $input) {
      success
      data {
        access_token
        access_token_expires_at
        refresh_token
        refresh_token_expires_at
        token_type
        role
        permissions
        email_verified
      }
    }
  }
`

// ── Magic Link ────────────────────────────────────────

export const REQUEST_MAGIC_LINK = gql`
  mutation RequestMagicLink($input: RequestMagicLinkInput!) {
    requestMagicLink(input: $input) {
      success
      data {
        magic_link
      }
    }
  }
`

export const VERIFY_MAGIC_LINK = gql`
  mutation VerifyMagicLink($input: VerifyMagicLinkInput!) {
    verifyMagicLink(input: $input) {
      success
      data {
        access_token
        refresh_token
        role
      }
    }
  }
`

// ── Password / Email ──────────────────────────────────

// Password reset uses a one-time code plus the identifier instead of a
// reset-link token. `code_length` is how many digits that code has, the same
// answer `SEND_OTP_CODE` gives. Sent through `useForgetPassword`.
export const FORGET_PASSWORD = gql`
  mutation ForgetPassword($input: ForgetPasswordInput!) {
    forgetPassword(input: $input) {
      success
      message
      data {
        code_length
      }
    }
  }
`

export const RESET_PASSWORD = gql`
  mutation ResetPassword($input: ResetPasswordInput!) {
    resetPassword(input: $input) {
      success
    }
  }
`

export const VERIFY_EMAIL = gql`
  mutation VerifyEmail($token: String!) {
    verifyEmail(token: $token) {
      success
    }
  }
`

export const RESEND_VERIFICATION_EMAIL = gql`
  mutation ResendVerificationEmail {
    resendVerificationEmail {
      success
    }
  }
`

export const CHANGE_PASSWORD = gql`
  mutation ChangePassword($input: ChangePasswordInput!) {
    changePassword(input: $input) {
      success
    }
  }
`
