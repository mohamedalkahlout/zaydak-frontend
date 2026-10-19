import { gql } from "@apollo/client"

export const SIGNUP_AVAILABILITY_FRAGMENT = gql`
  fragment SignupAvailabilityFields on SignupAvailabilityData {
    available
  }
`

export const VENDOR_SIGNUP_DRAFT_FRAGMENT = gql`
  fragment VendorSignupDraftFields on VendorSignupDraftData {
    signup_token
    destination_masked
    channel
    code_length
    resend_after
  }
`

export const VENDOR_SIGNUP_AUTH_FRAGMENT = gql`
  fragment VendorSignupAuthFields on AuthData {
    access_token
    access_token_expires_at
    refresh_token
    refresh_token_expires_at
    token_type
    role
    permissions
    email_verified
  }
`

export const VENDOR_SIGNUP_EMAIL_AVAILABLE = gql`
  ${SIGNUP_AVAILABILITY_FRAGMENT}
  query VendorSignupEmailAvailable($email: String!) {
    vendorSignupEmailAvailable(email: $email) {
      success
      data {
        ...SignupAvailabilityFields
      }
    }
  }
`

export const VENDOR_SIGNUP_SLUG_AVAILABLE = gql`
  ${SIGNUP_AVAILABILITY_FRAGMENT}
  query VendorSignupSlugAvailable($slug: String!) {
    vendorSignupSlugAvailable(slug: $slug) {
      success
      data {
        ...SignupAvailabilityFields
      }
    }
  }
`

export const START_VENDOR_SIGNUP = gql`
  ${VENDOR_SIGNUP_DRAFT_FRAGMENT}
  mutation StartVendorSignup($input: StartVendorSignupInput!) {
    startVendorSignup(input: $input) {
      success
      data {
        ...VendorSignupDraftFields
      }
    }
  }
`

export const RESEND_VENDOR_SIGNUP_OTP = gql`
  ${VENDOR_SIGNUP_DRAFT_FRAGMENT}
  mutation ResendVendorSignupOtp($token: String!) {
    resendVendorSignupOtp(token: $token) {
      success
      data {
        ...VendorSignupDraftFields
      }
    }
  }
`

export const VERIFY_VENDOR_SIGNUP_OTP = gql`
  ${VENDOR_SIGNUP_DRAFT_FRAGMENT}
  mutation VerifyVendorSignupOtp($input: VerifyVendorSignupOtpInput!) {
    verifyVendorSignupOtp(input: $input) {
      success
      data {
        ...VendorSignupDraftFields
      }
    }
  }
`

export const COMPLETE_VENDOR_SIGNUP = gql`
  ${VENDOR_SIGNUP_AUTH_FRAGMENT}
  mutation CompleteVendorSignup($input: CompleteVendorSignupInput!) {
    completeVendorSignup(input: $input) {
      success
      data {
        shop_slug
        shop_id
        auth {
          ...VendorSignupAuthFields
        }
      }
    }
  }
`
