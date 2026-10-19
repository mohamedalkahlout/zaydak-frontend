import type { GraphQLResult } from "@/shared/types/api"

export interface AuthTokenData {
  access_token: string
  access_token_expires_at?: string
  refresh_token: string
  refresh_token_expires_at?: string
  token_type?: string
  role: string
  permissions?: string[]
  email_verified?: boolean
}

export interface LoginResponse {
  login: GraphQLResult<AuthTokenData>
}

export interface RefreshTokenResponse {
  refreshToken: GraphQLResult<
    AuthTokenData & {
      access_token_expires_at?: string
      refresh_token_expires_at?: string
    }
  >
}

/**
 * `data` is optional because an API older than `code_length` answers without
 * it (see `lib/legacy-code-length`).
 */
export interface SendOtpResponse {
  sendOtpCode: {
    success: boolean
    data?: { code_length?: number | null } | null
  }
}

export interface VerifyOtpResponse {
  verifyOtpCode: GraphQLResult<AuthTokenData>
}

export interface ForgetPasswordResponse {
  forgetPassword: {
    success: boolean
    message?: string | null
    data?: { code_length?: number | null } | null
  }
}

export interface ResetPasswordResponse {
  resetPassword: { success: boolean }
}

export interface VerifyEmailResponse {
  verifyEmail: { success: boolean; message?: string | null }
}

export interface ResendVerificationEmailResponse {
  resendVerificationEmail: { success: boolean; message?: string | null }
}

export interface ChangePasswordResponse {
  changePassword: { success: boolean; message?: string | null }
}

export interface GetMeResponse {
  me: GraphQLResult<{
    id: string
    name: string
    email: string
    phone?: string | null
    role: string
    permissions?: string[]
    email_verified?: boolean
  }>
}

export interface LookupEnumOption {
  value: string
  label: string
}

export interface Locale {
  code: string
  direction: "ltr" | "rtl"
  is_default: boolean
  label: string
}

export interface LookupsData {
  enums: Record<string, LookupEnumOption[]>
  locales: Locale[]
}

export interface LookupsResponse {
  lookups: GraphQLResult<LookupsData> & { message?: string }
}
