import { gql } from "@apollo/client"

export const GET_INSIGHTS = gql`
  query AnalyticsInsights($limit: Int) {
    insights(limit: $limit) {
      success
      data {
        id
        type
        severity
        title
        body
        data
        suggested_actions
        is_read
        created_at
        expires_at
      }
    }
  }
`

export const MARK_INSIGHT_READ = gql`
  mutation AnalyticsMarkInsightRead($id: ID!) {
    markInsightRead(id: $id) {
      success
    }
  }
`

export const DISMISS_INSIGHT = gql`
  mutation AnalyticsDismissInsight($id: ID!) {
    dismissInsight(id: $id) {
      success
    }
  }
`
