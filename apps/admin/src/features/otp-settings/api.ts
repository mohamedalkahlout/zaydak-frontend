import { gql } from "@/shared/api/generated"

/**
 * Platform-wide one-time-code settings.
 *
 * Both operations are gated on `manage_integrations` (`otp-settings.resolver.ts`)
 * — the same permission as the integrations console, which is where the rest of
 * the platform's delivery configuration lives. Platform-scoped, so no X-SHOP.
 *
 * What is saved here reaches every flow that issues a code: vendor signup,
 * OTP login, and password reset all read it on the way through `OtpService`.
 * `shop_hourly_limit` is the storefront's alone: how many sign-in codes one
 * shop may have texted in an hour, across every number.
 */
export const OTP_SETTINGS = gql(`
  query OtpSettings {
    otpSettings {
      success
      data {
        code_length
        ttl_seconds
        cooldown_seconds
        max_attempts
        daily_limit
        shop_hourly_limit
        lockout_minutes
        channel
        is_customized
        updated_at
      }
    }
  }
`)

export const UPDATE_OTP_SETTINGS = gql(`
  mutation UpdateOtpSettings($input: UpdateOtpSettingsInput!) {
    updateOtpSettings(input: $input) {
      success
      data {
        code_length
        ttl_seconds
        cooldown_seconds
        max_attempts
        daily_limit
        shop_hourly_limit
        lockout_minutes
        channel
        is_customized
        updated_at
      }
    }
  }
`)
