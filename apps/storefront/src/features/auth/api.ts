import { gql } from "@/shared/api/generated"

/**
 * Signing in as the shop's customer: a phone number and a texted code.
 *
 * **There is no password and no email sign-in for a customer**, and no
 * separate sign-up: a number the code proves is this shop's customer — signed
 * in if the shop has one on it, made if not. The session that comes back is
 * the customer's own (`typ: customer`, bound to this shop), never a platform
 * account's, so a vendor's or an admin's account is never reached from here —
 * the number is simply a customer of this shop.
 */

/** What a sign-in hands back, in the shape `/api/auth/session` stores. */
export const CUSTOMER_SIGN_IN_FIELDS = gql(`
  fragment StorefrontCustomerSignIn on CustomerSignInData {
    access_token
    access_token_expires_at
    refresh_token
    refresh_token_expires_at
    created
    customer {
      id
      name
      phone_e164
      email
    }
  }
`)

/** Text a sign-in code to the number, read in the shop's country when local. */
export const SEND_SIGN_IN_CODE = gql(`
  mutation StorefrontSendSignInCode($input: SendCustomerSignInCodeInput!) {
    sendCustomerSignInCode(input: $input) {
      success
      data {
        phone_e164
        code_length
        resend_after_seconds
        expires_in_seconds
      }
    }
  }
`)

/** Check the code: signed in as this shop's customer, made now if new. */
export const VERIFY_SIGN_IN_CODE = gql(`
  mutation StorefrontVerifySignInCode($input: VerifyCustomerSignInCodeInput!) {
    verifyCustomerSignInCode(input: $input) {
      success
      data {
        ...StorefrontCustomerSignIn
      }
    }
  }
`)

/** The signed-in customer, as they see themselves. */
export const MY_PROFILE = gql(`
  query StorefrontMyProfile {
    myCustomerProfile {
      success
      data {
        id
        name
        phone_e164
        email
      }
    }
  }
`)

/**
 * The name and the email — the only two things a customer edits about
 * themselves. The number is the sign-in, so it is not edited: a different
 * number is a different customer.
 */
export const UPDATE_MY_PROFILE = gql(`
  mutation StorefrontUpdateMyProfile($input: UpdateMyCustomerProfileInput!) {
    updateMyCustomerProfile(input: $input) {
      success
      data {
        id
        name
        phone_e164
        email
      }
    }
  }
`)
