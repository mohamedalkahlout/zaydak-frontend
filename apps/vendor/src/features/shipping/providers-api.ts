import { gql } from "@apollo/client"

/**
 * Shipping mode and carrier accounts.
 *
 * Separate file from `api.ts` on purpose: that one is zones and rates — what
 * the CUSTOMER pays — and this one is who carries the parcel. They share a
 * screen but not a subject, and the back-end keeps them in two modules for the
 * same reason.
 *
 * Every operation here is `MANAGE_OWN_SHOP` + `X-SHOP`, so they scope to the
 * shop in the header like the rest of the dashboard.
 */

export const GET_SHOP_SHIPPING_SETTINGS = gql`
  query ShopShippingSettings {
    shopShippingSettings {
      success
      data {
        mode
        provider_ready
        # Mode-independent, where provider_ready is not: that one is always
        # true for a merchant-managed shop, and such a shop can still offer
        # carrier prices at checkout. This says whether they can be quoted.
        carrier_available
        active_provider_slug
        # What the CUSTOMER is offered at checkout. Independent of the mode,
        # which is how a shipment is executed — a shop can stop showing
        # carrier prices without losing the ability to book one.
        offers_merchant_delivery
        offers_carrier_delivery
        default_item_weight_grams
      }
    }
  }
`

export const UPDATE_SHOP_SHIPPING_MODE = gql`
  mutation UpdateShopShippingMode($input: UpdateShopShippingModeInput!) {
    updateShopShippingMode(input: $input) {
      success
      message
      data {
        mode
        provider_ready
        active_provider_slug
      }
    }
  }
`

/**
 * The carriers a merchant may pick, and the form to render for each.
 *
 * The fields come from the server so a carrier added on the back-end costs this
 * app nothing — same contract as the admin console's integrations screen.
 * `manual` is deliberately absent from this list: it is how merchant-managed
 * delivery is executed, not a third option beside the two modes.
 */
export const GET_SHIPPING_PROVIDER_CATALOG = gql`
  query ShippingProviderCatalog {
    shippingProviderCatalog {
      success
      data {
        provider
        name
        name_ar
        description
        description_ar
        requires_location_mapping
        supports_sandbox
        fields {
          key
          label
          label_ar
          type
          required
          secret
          placeholder
          help
          help_ar
          options {
            value
            label
            label_ar
          }
        }
      }
    }
  }
`

/**
 * The shop's carrier accounts.
 *
 * `masked_credentials` is `••••1234` for secrets and the real value for
 * anything not secret. There is no field on this type that could carry a
 * plaintext credential — the server has none to give.
 */
export const GET_SHIPPING_PROVIDER_ACCOUNTS = gql`
  query ShippingProviderAccounts {
    shippingProviderAccounts {
      success
      data {
        id
        provider
        is_enabled
        is_sandbox
        last_verified_at
        last_verify_error
        masked_credentials {
          key
          masked_value
        }
      }
    }
  }
`

export const UPSERT_SHIPPING_PROVIDER_ACCOUNT = gql`
  mutation UpsertShippingProviderAccount(
    $input: UpsertShippingProviderAccountInput!
  ) {
    upsertShippingProviderAccount(input: $input) {
      success
      message
      data {
        id
        provider
        is_enabled
        is_sandbox
        last_verified_at
        last_verify_error
        masked_credentials {
          key
          masked_value
        }
      }
    }
  }
`

export const VERIFY_SHIPPING_PROVIDER_ACCOUNT = gql`
  mutation VerifyShippingProviderAccount($account_id: String!) {
    verifyShippingProviderAccount(account_id: $account_id) {
      success
      message
      data {
        ok
        error
      }
    }
  }
`

export const SET_SHIPPING_PROVIDER_ACCOUNT_ENABLED = gql`
  mutation SetShippingProviderAccountEnabled(
    $input: SetShippingProviderAccountEnabledInput!
  ) {
    setShippingProviderAccountEnabled(input: $input) {
      success
      message
    }
  }
`

export const DELETE_SHIPPING_PROVIDER_ACCOUNT = gql`
  mutation DeleteShippingProviderAccount($account_id: String!) {
    deleteShippingProviderAccount(account_id: $account_id) {
      success
      message
    }
  }
`

export const GET_SHIPPING_PROVIDER_LOCATIONS = gql`
  query ShippingProviderLocations {
    shippingProviderLocations {
      success
      data {
        id
        location_id
        location_name
        location_city
        location_country
        external_location_id
        is_enabled
      }
    }
  }
`

export const MAP_SHIPPING_PROVIDER_LOCATION = gql`
  mutation MapShippingProviderLocation(
    $input: MapShippingProviderLocationInput!
  ) {
    mapShippingProviderLocation(input: $input) {
      success
      message
    }
  }
`

export const UNMAP_SHIPPING_PROVIDER_LOCATION = gql`
  mutation UnmapShippingProviderLocation(
    $input: UnmapShippingProviderLocationInput!
  ) {
    unmapShippingProviderLocation(input: $input) {
      success
      message
    }
  }
`

/**
 * The carriers this shop can offer, and which are on.
 *
 * `using_platform_defaults` is what the screen leads with: while it is true
 * the shop has stored nothing and EVERY carrier is allowed, so the checkboxes
 * render all-on. Rendering them all-off there would tell a merchant they
 * cannot ship when in fact they can ship with all of them.
 */
export const GET_SHOP_SHIPPING_CARRIERS = gql`
  query ShopShippingCarriers {
    shopShippingCarriers {
      success
      using_platform_defaults
      data {
        code
        name
        logo
        enabled
      }
    }
  }
`

export const SET_SHOP_SHIPPING_CARRIERS = gql`
  mutation SetShopShippingCarriers($input: SetShopCarriersInput!) {
    setShopShippingCarriers(input: $input) {
      success
      message
    }
  }
`

/** Back to "use the platform's defaults" — the opposite of submitting none. */
export const RESET_SHOP_SHIPPING_CARRIERS = gql`
  mutation ResetShopShippingCarriers {
    resetShopShippingCarriers {
      success
      message
    }
  }
`

/**
 * Resolve a national-address short code against the official registry.
 *
 * A query, not a mutation: it stores nothing. The locations dialog calls it as
 * the merchant types so they can confirm the address a courier will be sent to
 * before saving eight characters they cannot otherwise verify.
 */
export const LOOKUP_NATIONAL_ADDRESS = gql`
  query LookupNationalAddress($input: LookupNationalAddressInput!) {
    lookupNationalAddress(input: $input) {
      success
      data {
        code
        formatted
        city
        district
        street
        building_number
        postcode
        country
      }
    }
  }
`

/**
 * Register one warehouse as a pickup location on the platform's carrier
 * account.
 *
 * Explicit on purpose — it creates a durable record at the carrier that has no
 * delete, so it is never a side effect of saving an address.
 */
export const ENABLE_CARRIER_PICKUP = gql`
  mutation EnableCarrierPickup($input: EnableCarrierPickupInput!) {
    enableCarrierPickup(input: $input) {
      success
      created
    }
  }
`

/**
 * Which delivery channels this shop offers its customers.
 *
 * Partial on purpose — flipping one switch must not rewrite the other with
 * whatever the form happened to hold.
 */
export const UPDATE_DELIVERY_CHANNELS = gql`
  mutation UpdateDeliveryChannels($input: UpdateDeliveryChannelsInput!) {
    updateDeliveryChannels(input: $input) {
      success
    }
  }
`
