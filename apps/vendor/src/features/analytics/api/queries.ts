import { gql } from "@apollo/client"

const SALES_BREAKDOWN_FIELDS = gql`
  fragment SalesBreakdownFields on SalesBreakdown {
    gross_sales_cents
    discounts_cents
    returns_cents
    net_sales_cents
    shipping_cents
    taxes_cents
    total_sales_cents
    orders_count
    fulfilled_orders_count
    return_fees_cents
    average_order_value_cents
    returning_customer_rate_bps
    cogs_cents
    fees_cents
    gross_profit_cents
    net_profit_cents
    margin_bps
    units_missing_cost
    cost_coverage_bps
    is_estimated
  }
`

export const GET_SALES_REPORT = gql`
  query AnalyticsSalesReport($input: SalesReportInput!) {
    salesReport(input: $input) {
      success
      data {
        start
        end
        granularity
        currency
        timezone
        current {
          ...SalesBreakdownFields
        }
        previous {
          ...SalesBreakdownFields
        }
        series {
          date
          total_sales_cents
          orders_count
        }
        previous_series {
          date
          total_sales_cents
          orders_count
        }
      }
    }
  }
  ${SALES_BREAKDOWN_FIELDS}
`

// One round trip for everything that DEPENDS ON the date range (refetches when
// the range/compare changes). salesReport, topProducts (by sales value),
// sell-through, customer analytics (cohorts + top customers), and channel
// attribution all share the window and resolve server-side in one request.
export const GET_ANALYTICS_OVERVIEW = gql`
  query AnalyticsOverview(
    $input: SalesReportInput!
    $limit: Int
    $start: DateTime
    $end: DateTime
    $caInput: CustomerAnalyticsInput!
    $attrInput: AttributionReportInput!
  ) {
    salesReport(input: $input) {
      success
      data {
        start
        end
        granularity
        currency
        timezone
        current {
          ...SalesBreakdownFields
        }
        previous {
          ...SalesBreakdownFields
        }
        series {
          date
          total_sales_cents
          orders_count
        }
        previous_series {
          date
          total_sales_cents
          orders_count
        }
      }
    }
    topProducts(limit: $limit, start: $start, end: $end, by: SALES) {
      success
      data {
        id
        name
        slug
        image
        orders_count
        total_sales_cents
      }
    }
    sellThroughProducts(limit: $limit, start: $start, end: $end) {
      success
      data {
        id
        name
        slug
        sold_units
        on_hand
        sell_through_bps
      }
    }
    customerAnalytics(input: $caInput) {
      success
      data {
        currency
        timezone
        summary {
          total_customers
          repeat_rate_bps
          new_customers
          returning_customers
          active_customers
        }
        cohorts {
          cohort
          size
          retention_bps
        }
        top_customers {
          id
          name
          email
          orders_count
          total_spent_cents
        }
      }
    }
    attributionReport(input: $attrInput) {
      success
      data {
        group_by
        model
        currency
        rows {
          key
          channel
          revenue_cents
          orders
        }
        totals {
          key
          channel
          revenue_cents
          orders
        }
      }
    }
  }
  ${SALES_BREAKDOWN_FIELDS}
`

// Where orders were placed (online store, Telegram, WhatsApp, manual orders),
// for the same window and comparison as the overview. Deliberately NOT a field
// of AnalyticsOverview: GraphQL validates a document as a whole, so one field
// the running API does not know fails every field beside it. Kept apart, an
// older API costs this one section its data and leaves the rest of the page.
export const GET_SALES_BY_CHANNEL = gql`
  query AnalyticsSalesByChannel($input: SalesByChannelInput!) {
    salesByChannel(input: $input) {
      success
      data {
        start
        end
        granularity
        currency
        timezone
        total_sales_cents
        orders_count
        rows {
          channel
          orders_count
          total_sales_cents
          returns_cents
          average_order_value_cents
          customers_count
          share_bps
          previous_total_sales_cents
          previous_orders_count
          connected
          series {
            date
            total_sales_cents
            orders_count
          }
        }
      }
    }
  }
`

// One round trip for everything that does NOT depend on the date range
// (current stock state / all-time aggregates) — fetched once, never refetched
// when the range changes.
export const GET_ANALYTICS_SECONDARY = gql`
  query AnalyticsSecondary($threshold: Int) {
    ordersByStatus {
      success
      data {
        pending
        processing
        completed
        cancelled
        refunded
        failed
        at_local_facility
        out_for_delivery
      }
    }
    lowStockProducts(threshold: $threshold) {
      success
      data {
        id
        name
        slug
        quantity
        shop_id
      }
    }
    categorySales {
      success
      data {
        category_id
        name
        slug
        product_count
        total_quantity_sold
      }
    }
  }
`

export const GET_ANALYTICS_SUMMARY = gql`
  query AnalyticsSummary {
    analytics {
      success
      data {
        total_revenue_cents
        todays_revenue_cents
        total_refunds
        total_orders
        total_shops
        new_customers
        total_vendors
      }
    }
  }
`

export const GET_ORDERS_BY_STATUS = gql`
  query AnalyticsOrdersByStatus($period: String) {
    ordersByStatus(period: $period) {
      success
      data {
        pending
        processing
        completed
        cancelled
        refunded
        failed
        at_local_facility
        out_for_delivery
      }
    }
  }
`

export const GET_TOP_PRODUCTS = gql`
  query AnalyticsTopProducts($limit: Int, $start: DateTime, $end: DateTime) {
    topProducts(limit: $limit, start: $start, end: $end) {
      success
      data {
        id
        name
        slug
        image
        orders_count
        total_sales_cents
      }
    }
  }
`

export const GET_LOW_STOCK_PRODUCTS = gql`
  query AnalyticsLowStockProducts($threshold: Int) {
    lowStockProducts(threshold: $threshold) {
      success
      data {
        id
        name
        slug
        quantity
        shop_id
      }
    }
  }
`

export const GET_CATEGORY_SALES = gql`
  query AnalyticsCategorySales {
    categorySales {
      success
      data {
        category_id
        name
        slug
        product_count
        total_quantity_sold
      }
    }
  }
`
