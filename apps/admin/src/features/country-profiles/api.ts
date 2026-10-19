import { gql } from "@/shared/api/generated"

/**
 * Platform CountryProfile rows. Gated on `manage_all_shops` — no X-SHOP.
 * Caps stay seed-managed; this surface flips `enabled` for create-store.
 */

export const COUNTRY_PROFILES = gql(`
  query AdminCountryProfiles {
    countryProfiles {
      success
      data {
        country_code
        enabled
        default_currency
        allowed_currencies
        allowed_payments
        allowed_delivery_channels
        shipping_match
        bank_account_mode
      }
    }
  }
`)

export const UPDATE_COUNTRY_PROFILE = gql(`
  mutation AdminUpdateCountryProfile($input: UpdateCountryProfileInput!) {
    updateCountryProfile(input: $input) {
      success
      data {
        country_code
        enabled
        default_currency
        allowed_currencies
        allowed_payments
        allowed_delivery_channels
        shipping_match
        bank_account_mode
      }
    }
  }
`)
