import { gql } from "@apollo/client"

/**
 * Shipping zones and rates.
 *
 * All six mutations are `MANAGE_OWN_SHOP` / `MANAGE_ALL_SHOPS` + `X-SHOP`, so
 * they scope to the shop in the header exactly like the rest of the dashboard.
 * The two reads are `OptionalJwtGuard` — the storefront needs them too.
 *
 * `shippingZones` takes no arguments and returns every zone with its rate
 * bands nested, so the whole pane is one query.
 */

const ZONE_FIELDS = `
  id
  name
  countries
  states
  city_codes
  priority
  is_global
  shop_id
  rules {
    id
    name
    type
    amount_cents
    amount_bps
    per_kg_cents
    min_order_cents
    min_delivery_days
    max_delivery_days
    zone_id
    is_global
    created_at
  }
`

export const GET_SHIPPING_ZONES = gql`
  query ShippingZones {
    shippingZones {
      success
      data {
        ${ZONE_FIELDS}
      }
    }
  }
`

/**
 * Every rate the shop has, zoned or not.
 *
 * The pane needs the unzoned ones specifically: they are what the back-end
 * falls back to when a shop has no zones at all, and they stop being consulted
 * the moment a first zone exists. Nothing else in the app would show a vendor
 * that a rate they created has quietly stopped applying.
 */
/**
 * The pane's initial `shippingRules` variables, exported so the server page's
 * `PreloadQuery` and the pane's `useSuspenseQuery` can never drift — a
 * mismatch would make the client ask a second time and the preload buy
 * nothing.
 */
export const SHIPPING_RULES_VARIABLES = { page: 1, limit: 100 }

export const GET_SHIPPING_RULES = gql`
  query ShippingRules($page: Int, $limit: Int) {
    shippingRules(page: $page, limit: $limit) {
      success
      data {
        id
        name
        type
        amount_cents
        amount_bps
        per_kg_cents
        min_order_cents
        min_delivery_days
        max_delivery_days
        zone_id
        is_global
        created_at
      }
      meta {
        page
        limit
        total
        total_pages
      }
    }
  }
`

export const CREATE_SHIPPING_ZONE = gql`
  mutation CreateShippingZone($input: CreateShippingZoneInput!) {
    createShippingZone(input: $input) {
      success
      message
      data {
        ${ZONE_FIELDS}
      }
    }
  }
`

export const UPDATE_SHIPPING_ZONE = gql`
  mutation UpdateShippingZone($input: UpdateShippingZoneInput!) {
    updateShippingZone(input: $input) {
      success
      message
      data {
        ${ZONE_FIELDS}
      }
    }
  }
`

export const DELETE_SHIPPING_ZONE = gql`
  mutation DeleteShippingZone($id: String!) {
    deleteShippingZone(id: $id) {
      success
      message
    }
  }
`

export const CREATE_SHIPPING_RULE = gql`
  mutation CreateShippingRule($input: CreateShippingRuleInput!) {
    createShippingRule(input: $input) {
      success
      message
      data {
        id
        name
        type
        amount_cents
        zone_id
      }
    }
  }
`

export const UPDATE_SHIPPING_RULE = gql`
  mutation UpdateShippingRule($input: UpdateShippingRuleInput!) {
    updateShippingRule(input: $input) {
      success
      message
      data {
        id
        name
        type
        amount_cents
        zone_id
      }
    }
  }
`

export const DELETE_SHIPPING_RULE = gql`
  mutation DeleteShippingRule($id: String!) {
    deleteShippingRule(id: $id) {
      success
      message
    }
  }
`

export const SHOP_PACKAGE_FIELDS = `
  id
  shop_id
  name
  package_type
  length_mm
  width_mm
  height_mm
  empty_weight_grams
  is_default
  created_at
  updated_at
`

export const GET_SHOP_PACKAGES = gql`
  query ShopPackages {
    shopPackages {
      success
      data {
        ${SHOP_PACKAGE_FIELDS}
      }
    }
  }
`

export const CREATE_SHOP_PACKAGE = gql`
  mutation CreateShopPackage($input: CreateShopPackageInput!) {
    createShopPackage(input: $input) {
      success
      message
      data {
        ${SHOP_PACKAGE_FIELDS}
      }
    }
  }
`

export const UPDATE_SHOP_PACKAGE = gql`
  mutation UpdateShopPackage($id: String!, $input: UpdateShopPackageInput!) {
    updateShopPackage(id: $id, input: $input) {
      success
      message
      data {
        ${SHOP_PACKAGE_FIELDS}
      }
    }
  }
`

export const DELETE_SHOP_PACKAGE = gql`
  mutation DeleteShopPackage($id: String!) {
    deleteShopPackage(id: $id) {
      success
      message
    }
  }
`

export const SET_DEFAULT_SHOP_PACKAGE = gql`
  mutation SetDefaultShopPackage($id: String!) {
    setDefaultShopPackage(id: $id) {
      success
      message
      data {
        ${SHOP_PACKAGE_FIELDS}
      }
    }
  }
`

