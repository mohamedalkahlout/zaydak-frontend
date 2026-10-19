import { gql } from "@apollo/client"

const RETURN_FIELDS = gql`
  fragment ReturnFields on ReturnEntry {
    id
    order_id
    customer_id
    shop_id
    status
    reason
    note
    restocking_fee_cents
    refund_id
    line_items {
      id
      order_product_id
      quantity
      reason
      restock
    }
    requested_at
    received_at
    closed_at
    created_at
  }
`

/** Scoped to the active shop by the X-SHOP header the Apollo link attaches. */
export const GET_RETURNS = gql`
  query Returns($page: Int, $limit: Int) {
    returns(page: $page, limit: $limit) {
      success
      data {
        ...ReturnFields
      }
      meta {
        total
        page
        limit
        total_pages
      }
    }
  }
  ${RETURN_FIELDS}
`

/**
 * Advances a return through its lifecycle.
 *
 * `status` is the GraphQL `ReturnStatus` enum — UPPERCASE — while a return
 * reads its status back lowercase. Always pass it through
 * `toReturnStatusInput()`.
 *
 * Moving to RECEIVED MOVES MONEY: the back-end issues the refund there, net of
 * the shop's restocking fee, and restocks the lines flagged for it.
 */
export const UPDATE_RETURN_STATUS = gql`
  mutation UpdateReturnStatus($input: UpdateReturnStatusInput!) {
    updateReturnStatus(input: $input) {
      success
      message
      data {
        ...ReturnFields
      }
    }
  }
  ${RETURN_FIELDS}
`
