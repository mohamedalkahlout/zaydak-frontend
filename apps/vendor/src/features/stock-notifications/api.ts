import { gql } from "@apollo/client"

/**
 * Vendor-side query for outstanding "Notify me when back in stock"
 * subscribers on a product. Excludes already-notified rows (those are
 * history, not pending demand). Used by the product edit page so vendors
 * can size demand before they restock.
 *
 * The subscribe / unsubscribe mutations live on the storefront — not
 * needed in the vendor app.
 */
export const GET_PENDING_STOCK_NOTIFICATIONS = gql`
  query PendingStockNotifications(
    $product_id: String!
    $variation_option_id: String
  ) {
    pendingStockNotifications(
      product_id: $product_id
      variation_option_id: $variation_option_id
    ) {
      success
      data {
        id
        email
        product_id
        variation_option_id
        customer_id
        created_at
      }
    }
  }
`
