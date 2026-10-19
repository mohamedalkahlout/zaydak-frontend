import { gql } from "@apollo/client"

const ATTRIBUTION_ROW_FIELDS = gql`
  fragment AttributionRowFields on AttributionRow {
    key
    channel
    revenue_cents
    orders
    units
    aov_cents
    new_customers
    returning_customers
    conversion_rate_bps
    cac_cents
    roas_bps
  }
`

export const ATTRIBUTION_REPORT = gql`
  query AnalyticsAttributionReport($input: AttributionReportInput!) {
    attributionReport(input: $input) {
      success
      data {
        group_by
        model
        currency
        rows {
          ...AttributionRowFields
        }
        totals {
          ...AttributionRowFields
        }
      }
    }
  }
  ${ATTRIBUTION_ROW_FIELDS}
`

const AD_SPEND_FIELDS = gql`
  fragment AdSpendFields on AdSpend {
    id
    channel
    source
    campaign
    date
    spend_cents
    currency
    exchange_rate_bps
    normalized_spend_cents
    impressions
    clicks
    source_kind
    created_at
  }
`

export const AD_SPENDS = gql`
  query AnalyticsAdSpends($start: DateTime, $end: DateTime) {
    adSpends(start: $start, end: $end) {
      success
      data {
        ...AdSpendFields
      }
    }
  }
  ${AD_SPEND_FIELDS}
`

export const CREATE_AD_SPEND = gql`
  mutation AnalyticsCreateAdSpend($input: AdSpendInput!) {
    createAdSpend(input: $input) {
      success
      data {
        ...AdSpendFields
      }
    }
  }
  ${AD_SPEND_FIELDS}
`

export const UPDATE_AD_SPEND = gql`
  mutation AnalyticsUpdateAdSpend($id: ID!, $input: AdSpendInput!) {
    updateAdSpend(id: $id, input: $input) {
      success
      data {
        ...AdSpendFields
      }
    }
  }
  ${AD_SPEND_FIELDS}
`

export const DELETE_AD_SPEND = gql`
  mutation AnalyticsDeleteAdSpend($id: ID!) {
    deleteAdSpend(id: $id) {
      success
    }
  }
`
