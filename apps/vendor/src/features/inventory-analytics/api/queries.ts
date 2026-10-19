import { gql } from "@apollo/client"

const STOCK_ROW_FIELDS = gql`
  fragment StockRowFields on StockRow {
    id
    name
    slug
    sku
    quantity
    units_sold
    inventory_cost_cents
    revenue_cents
    sell_through_bps
    days_of_inventory
    abc_class
  }
`

export const INVENTORY_ANALYTICS = gql`
  query AnalyticsInventory($input: InventoryAnalyticsInput!) {
    inventoryAnalytics(input: $input) {
      success
      data {
        currency
        summary {
          total_products
          total_units
          inventory_cost_cents
          inventory_retail_cents
          out_of_stock
          low_stock
          dead_stock_count
          units_sold_window
          sell_through_bps
        }
        abc {
          a_count
          b_count
          c_count
          a_revenue_cents
          b_revenue_cents
          c_revenue_cents
        }
        top_movers {
          ...StockRowFields
        }
        dead_stock {
          ...StockRowFields
        }
        slow_movers {
          ...StockRowFields
        }
      }
    }
  }
  ${STOCK_ROW_FIELDS}
`
