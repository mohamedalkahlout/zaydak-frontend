import { gql } from "@apollo/client"

export const CUSTOMER_ANALYTICS = gql`
  query AnalyticsCustomers($input: CustomerAnalyticsInput!) {
    customerAnalytics(input: $input) {
      success
      data {
        currency
        timezone
        summary {
          total_customers
          one_time_customers
          repeat_customers
          repeat_rate_bps
          total_orders
          total_revenue_cents
          avg_ltv_cents
          avg_orders_per_customer_x100
          new_customers
          returning_customers
          active_customers
          window_revenue_cents
          window_orders
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
  }
`
