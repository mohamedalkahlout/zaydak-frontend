import { gql } from "@apollo/client"

export const GET_REPORT_SCHEMA = gql`
  query AnalyticsReportSchema {
    reportSchema {
      success
      data {
        dimensions {
          key
          role
          kind
          availability
        }
        measures {
          key
          role
          kind
          availability
        }
        max_dimensions
        max_range_days
      }
    }
  }
`

export const RUN_REPORT = gql`
  query AnalyticsRunReport($input: RunReportInput!) {
    runReport(input: $input) {
      success
      data {
        columns {
          key
          role
          kind
        }
        rows
        totals
        currency
        timezone
        unavailable_measures
        truncated
        source
      }
    }
  }
`
