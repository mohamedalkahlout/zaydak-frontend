import type { AuthTokenData } from "@/features/auth/types"
import type { GraphQLResult } from "@/shared/types/api"

/** The four panes of the wizard, in the order the vendor walks them. */
export type SignupStep = "email" | "personal" | "otp" | "store"

/**
 * One row of the progress rail — and one dot of its mobile stepper.
 *
 * Already localized: the rail and the stepper are presentational, which is what
 * lets the code sign-in reuse them with two steps of its own.
 */
export interface SignupProgressStep {
  key: string
  title: string
  description?: string
  /** Forecast completion once this milestone is behind you. Omit for none. */
  progress?: number
}

/** Which channel the platform admin configured for one-time codes. */
export type SignupOtpChannel = "EMAIL" | "SMS" | "BOTH"

export interface SignupDraftData {
  signup_token: string
  /** Masked address or number the code went to — never assumed by the client. */
  destination_masked: string
  channel: SignupOtpChannel
  /** Digits in the code. An admin setting, so the OTP pane renders from it. */
  code_length: number
  resend_after: number
}

export interface VendorSignupEmailAvailableResponse {
  vendorSignupEmailAvailable: GraphQLResult<{ available: boolean }>
}

export interface VendorSignupSlugAvailableResponse {
  vendorSignupSlugAvailable: GraphQLResult<{ available: boolean }>
}

export interface StartVendorSignupResponse {
  startVendorSignup: GraphQLResult<SignupDraftData>
}

export interface ResendVendorSignupOtpResponse {
  resendVendorSignupOtp: GraphQLResult<SignupDraftData>
}

export interface VerifyVendorSignupOtpResponse {
  verifyVendorSignupOtp: GraphQLResult<SignupDraftData>
}

export interface CompleteVendorSignupResponse {
  completeVendorSignup: GraphQLResult<{
    auth: AuthTokenData
    shop_slug: string
    shop_id: string
  }>
}
