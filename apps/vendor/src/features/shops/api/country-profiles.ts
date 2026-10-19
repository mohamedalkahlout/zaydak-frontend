import { gql } from "@apollo/client"

export const ENABLED_COUNTRY_PROFILES = gql`
  query EnabledCountryProfiles {
    enabledCountryProfiles {
      success
      data {
        country_code
        default_currency
        allowed_currencies
        allowed_payments
        allowed_delivery_channels
        shipping_match
        bank_account_mode
      }
    }
  }
`

export const SHOP_COUNTRY_CAPABILITIES = gql`
  query ShopCountryCapabilities {
    shopCountryCapabilities {
      success
      data {
        home_country
        currency
        shipping_match
        bank_account_mode
        allowed_payments
        allowed_delivery_channels
        effective_cod
        effective_card
        effective_bank_transfer
        effective_merchant_delivery
        effective_carrier_delivery
      }
    }
  }
`

export const PALESTINE_CITIES = gql`
  query PalestineCities {
    palestineCities {
      success
      data {
        code
        country
        name_ar
        name_en
      }
    }
  }
`
