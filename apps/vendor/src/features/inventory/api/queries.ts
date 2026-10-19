// Shopify-parity multi-location inventory.

import { gql } from "@apollo/client"

export const GET_INVENTORY_LOCATIONS = gql`
  query InventoryLocations {
    inventoryLocations {
      success
      data {
        id
        name
        shop_id
        address_line1
        address_line2
        city
        state
        zip
        country
        phone
        national_address_code
        is_default
        is_active
        fulfills_online_orders
        created_at
        updated_at
      }
    }
  }
`

export const GET_INVENTORY_LEVELS = gql`
  query InventoryLevels(
    $product_id: String
    $variation_option_id: String
    $include_variations: Boolean
  ) {
    inventoryLevels(
      product_id: $product_id
      variation_option_id: $variation_option_id
      include_variations: $include_variations
    ) {
      success
      data {
        id
        location_id
        product_id
        variation_option_id
        available
        committed
        updated_at
      }
    }
  }
`

/**
 * Main Inventory page — one row per (product OR variant). Mirrors Shopify's
 * Inventory list columns: Product, SKU, Unavailable, Committed, Available,
 * On hand, Incoming.
 */
export const GET_INVENTORY_ITEMS = gql`
  query InventoryItems(
    $search: String
    $location_id: String
    $status: InventoryStockStatus
    $page: Int
    $limit: Int
  ) {
    inventoryItems(
      search: $search
      location_id: $location_id
      status: $status
      page: $page
      limit: $limit
    ) {
      success
      data {
        product_id
        product_slug
        variation_option_id
        name
        variant_title
        image
        sku
        unavailable
        committed
        available
        on_hand
        incoming
        unavailable_damaged
        unavailable_quality_control
        unavailable_safety_stock
        unavailable_other
        low_stock_threshold
        is_low_stock
        is_out_of_stock
        safety_stock
      }
      meta {
        total
        page
        limit
        total_pages
        low_stock_count
        out_of_stock_count
      }
    }
  }
`

export const GET_INVENTORY_TRANSFERS = gql`
  query InventoryTransfers(
    $status: InventoryTransferStatus
    $statuses: [InventoryTransferStatus!]
    $search: String
    $page: Int
    $limit: Int
  ) {
    inventoryTransfers(
      status: $status
      statuses: $statuses
      search: $search
      page: $page
      limit: $limit
    ) {
      success
      data {
        id
        number
        source_location_id
        destination_location_id
        status
        reference
        tracking_number
        tracking_url
        shipping_carrier
        shipment_cost_cents
        barcode
        note
        tags
        expected_arrival
        ready_at
        sent_at
        received_at
        cancelled_at
        created_at
        updated_at
        lines {
          id
          product_id
          variation_option_id
          quantity
          received_quantity
          rejected_quantity
          product_name
          variant_title
          image
          sku
          available_at_source
          available_at_destination
        }
      }
      meta {
        total
        page
        limit
        total_pages
      }
    }
  }
`

export const GET_INVENTORY_TRANSFER_STATS = gql`
  query InventoryTransferStats($days: Int) {
    inventoryTransferStats(days: $days) {
      success
      data {
        window_days
        total_ordered
        total_shipped
        total_received
        total_rejected
        unique_skus
        acceptance_rate
      }
    }
  }
`

export const GET_INVENTORY_TRANSFER_TIMELINE = gql`
  query InventoryTransferTimeline($id: String!) {
    inventoryTransferTimeline(id: $id) {
      success
      data {
        id
        action
        new_values
        created_at
        user {
          id
          name
        }
      }
    }
  }
`

export const GET_INVENTORY_TRANSFER = gql`
  query InventoryTransfer($id: String!) {
    inventoryTransfer(id: $id) {
      success
      data {
        id
        number
        source_location_id
        destination_location_id
        status
        reference
        tracking_number
        tracking_url
        shipping_carrier
        shipment_cost_cents
        barcode
        note
        tags
        expected_arrival
        ready_at
        sent_at
        received_at
        cancelled_at
        created_at
        updated_at
        lines {
          id
          product_id
          variation_option_id
          quantity
          received_quantity
          rejected_quantity
          product_name
          variant_title
          image
          sku
          available_at_source
          available_at_destination
        }
      }
    }
  }
`

export const GET_SUPPLIERS = gql`
  query Suppliers($search: String, $page: Int, $limit: Int) {
    suppliers(search: $search, page: $page, limit: $limit) {
      success
      data {
        id
        name
        contact_name
        email
        phone
        address_line1
        city
        country
        note
        created_at
      }
      meta {
        total
        page
        limit
        total_pages
      }
    }
  }
`

export const GET_PURCHASE_ORDERS = gql`
  query PurchaseOrders(
    $status: PurchaseOrderStatus
    $supplier_id: String
    $location_id: String
    $page: Int
    $limit: Int
  ) {
    purchaseOrders(
      status: $status
      supplier_id: $supplier_id
      location_id: $location_id
      page: $page
      limit: $limit
    ) {
      success
      data {
        id
        supplier_id
        destination_location_id
        status
        reference
        tracking_number
        shipping_carrier
        payment_terms
        currency_code
        tags
        expected_at
        subtotal_cents
        tax_cents
        shipping_cents
        total_cents
        ordered_at
        received_at
        closed_at
        created_at
        supplier {
          id
          name
        }
        lines {
          id
          product_id
          variation_option_id
          supplier_sku
          quantity
          received_quantity
          rejected_quantity
          unit_cost_cents
          tax_percent_bps
        }
      }
      meta {
        total
        page
        limit
        total_pages
      }
    }
  }
`

export const GET_PURCHASE_ORDER = gql`
  query PurchaseOrder($id: String!) {
    purchaseOrder(id: $id) {
      success
      data {
        id
        supplier_id
        destination_location_id
        status
        reference
        tracking_number
        shipping_carrier
        payment_terms
        currency_code
        tags
        note
        expected_at
        subtotal_cents
        tax_cents
        shipping_cents
        total_cents
        ordered_at
        received_at
        closed_at
        created_at
        updated_at
        supplier {
          id
          name
          contact_name
          email
          phone
        }
        lines {
          id
          product_id
          variation_option_id
          supplier_sku
          quantity
          received_quantity
          rejected_quantity
          unit_cost_cents
          tax_percent_bps
        }
      }
    }
  }
`

export const GET_INVENTORY_HISTORY = gql`
  query InventoryHistory(
    $product_id: String
    $variation_option_id: String
    $location_id: String
    $page: Int
    $limit: Int
  ) {
    inventoryHistory(
      product_id: $product_id
      variation_option_id: $variation_option_id
      location_id: $location_id
      page: $page
      limit: $limit
    ) {
      success
      data {
        id
        location_id
        product_id
        variation_option_id
        reason
        delta
        available_before
        available_after
        reference_type
        reference_id
        note
        actor_user_id
        created_at
      }
      meta {
        total
        page
        total_pages
      }
    }
  }
`
