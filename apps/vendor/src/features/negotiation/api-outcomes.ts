import { gql } from "@apollo/client"

/**
 * The merchant's report on the AI negotiator. Rows are one page; `summary` is
 * over every session the filter matches, and its money counts redeemed deals
 * only. `customer_label` arrives masked — this app never sees a guest key.
 */
export const NEGOTIATION_OUTCOMES = gql`
  query NegotiationOutcomes(
    $filter: NegotiationOutcomesFilterInput
    $page: Int
    $limit: Int
  ) {
    negotiationOutcomes(filter: $filter, page: $page, limit: $limit) {
      success
      data {
        session_id
        created_at
        product_id
        variation_option_id
        product_title
        variation_title
        channel
        session_status
        rounds
        max_rounds
        customer_label
        is_guest
        list_price_cents
        last_offer_cents
        final_price_cents
        quantity
        offer_status
        offer_expires_at
        redeemed_at
        order_id
        order_unwound
        discount_cents
        margin_cents
        currency
      }
      meta {
        total
        page
        limit
        total_pages
      }
      summary {
        sessions
        accepted
        redeemed
        acceptance_bps
        conversion_bps
        revenue_cents
        discount_cents
        margin_cents
        redeemed_without_cost
        currency
      }
    }
  }
`

/**
 * The same report grouped by product, by strategy and over time — its own
 * query, never fields on `NEGOTIATION_OUTCOMES`, on purpose: the table
 * re-queries on every page flip and the CSV export loops over every page, and
 * the grouping should run once per filter, not per page. It also fails on its
 * own: an error here shows in the breakdown cards and leaves the table and
 * the KPI row as they were.
 *
 * The fragment lives in the same literal, with no `${}`, so codegen sees it.
 */
export const NEGOTIATION_OUTCOME_ROLLUPS = gql`
  fragment NegotiationOutcomeFiguresFields on NegotiationOutcomeFigures {
    sessions
    accepted
    redeemed
    acceptance_bps
    conversion_bps
    revenue_cents
    discount_cents
    avg_discount_bps
    margin_cents
    margin_bps
    redeemed_without_cost
    floor_reached
    floor_reached_bps
    avg_rounds_to_close
  }

  query NegotiationOutcomeRollups(
    $filter: NegotiationOutcomesFilterInput
    $granularity: String
    $product_limit: Int
  ) {
    negotiationOutcomeRollups(
      filter: $filter
      granularity: $granularity
      product_limit: $product_limit
    ) {
      success
      data {
        granularity
        timezone
        currency
        products_total
        total {
          ...NegotiationOutcomeFiguresFields
        }
        products {
          product_id
          product_title
          figures {
            ...NegotiationOutcomeFiguresFields
          }
        }
        strategies {
          strategy
          figures {
            ...NegotiationOutcomeFiguresFields
          }
        }
        trend {
          date
          figures {
            ...NegotiationOutcomeFiguresFields
          }
        }
      }
    }
  }
`
