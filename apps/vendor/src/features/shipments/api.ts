import { gql } from "@apollo/client"

/**
 * Shipments — the physical half of an order.
 *
 * A shipment executes a **Fulfillment** (the decision of which lines leave
 * which location), so everything here is keyed on a fulfillment rather than on
 * the order. A split order has one fulfillment per warehouse and therefore its
 * own shipment per warehouse.
 *
 * `actual_cost_cents` and `cost_source` come back only for shop staff. The
 * server omits them entirely for the customer who placed the order — it is the
 * shop's cost base, and publishing it would hand every buyer the shop's
 * shipping margin.
 */

const SHIPMENT_FIELDS = `
  id
  order_id
  fulfillment_id
  status
  provider_slug
  delivery_company
  tracking_number
  tracking_url
  label_url
  external_shipment_id
  estimated_delivery
  shipped_at
  delivered_at
  cancelled_at
  actual_cost_cents
  cost_source
  notes
  created_at
  packages {
    id
    weight_grams
    length_mm
    width_mm
    height_mm
    tracking_number
    label_url
  }
  tracking_events {
    id
    status
    description
    occurred_at
    source
  }
`

export const GET_ORDER_SHIPMENTS = gql`
  query OrderShipments($order_id: String!) {
    shipments(order_id: $order_id, limit: 100) {
      success
      data {
        ${SHIPMENT_FIELDS}
      }
    }
  }
`

/**
 * What the shopper paid, what the carriers billed, and the gap.
 *
 * A separate query rather than a field on the order: the customer reads the
 * order type, and the permission on this query is what keeps the shop's cost
 * base away from them.
 */
export const GET_ORDER_SHIPPING_ECONOMICS = gql`
  query OrderShippingEconomics($order_id: String!) {
    orderShippingEconomics(order_id: $order_id) {
      success
      data {
        order_id
        customer_charge_cents
        actual_cost_cents
        merchant_subsidy_cents
        merchant_margin_cents
        is_complete
      }
    }
  }
`

export const CREATE_SHIPMENT = gql`
  mutation CreateShipment($input: CreateShipmentInput!) {
    createShipment(input: $input) {
      success
      message
      data {
        ${SHIPMENT_FIELDS}
      }
    }
  }
`

export const UPDATE_SHIPMENT_STATUS = gql`
  mutation UpdateShipmentStatus($input: UpdateShipmentStatusInput!) {
    updateShipmentStatus(input: $input) {
      success
      message
      data {
        ${SHIPMENT_FIELDS}
      }
    }
  }
`

/**
 * Cancels through the carrier, then marks the row — not the same as
 * `updateShipmentStatus(status: "cancelled")`, which only writes a column and
 * would leave a courier holding a live pickup.
 */
export const CANCEL_SHIPMENT = gql`
  mutation CancelShipment($id: String!, $reason: String) {
    cancelShipment(id: $id, reason: $reason) {
      success
      message
      data {
        ${SHIPMENT_FIELDS}
      }
    }
  }
`

export const REFRESH_SHIPMENT_TRACKING = gql`
  mutation RefreshShipmentTracking($id: String!) {
    refreshShipmentTracking(id: $id) {
      success
      message
      data {
        ${SHIPMENT_FIELDS}
      }
    }
  }
`

export const SET_SHIPMENT_ACTUAL_COST = gql`
  mutation SetShipmentActualCost($id: String!, $cost_cents: Int!) {
    setShipmentActualCost(id: $id, cost_cents: $cost_cents) {
      success
      message
      data {
        ${SHIPMENT_FIELDS}
      }
    }
  }
`
