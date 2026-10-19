import { gql } from "@apollo/client"

// The full definition (no live progress) — cheap to fetch for lists/forms.
const TARGET_FIELDS = gql`
  fragment TargetFields on Target {
    id
    name
    metric
    period
    periodStart
    periodEnd
    unit
    targetValue
    currency
    status
    createdAt
  }
`

// Live progress. Selecting it triggers an O(1) recompute per target on the
// server, so list views fetch it only when they render gauges.
const TARGET_PROGRESS_FIELDS = gql`
  fragment TargetProgressFields on TargetProgress {
    currentValue
    targetValue
    attainmentBps
    status
    paceable
    projectedValue
    elapsedBps
    pacingSeries {
      date
      value
    }
    idealPaceSeries {
      date
      value
    }
    costCoverageBps
  }
`

export const GET_TARGETS = gql`
  query AnalyticsTargets($status: [TargetStatus!]) {
    targets(status: $status) {
      success
      data {
        ...TargetFields
        progress {
          ...TargetProgressFields
        }
      }
    }
  }
  ${TARGET_FIELDS}
  ${TARGET_PROGRESS_FIELDS}
`

export const GET_TARGET = gql`
  query AnalyticsTarget($id: ID!) {
    target(id: $id) {
      success
      data {
        ...TargetFields
        progress {
          ...TargetProgressFields
        }
      }
    }
  }
  ${TARGET_FIELDS}
  ${TARGET_PROGRESS_FIELDS}
`

export const CREATE_TARGET = gql`
  mutation AnalyticsCreateTarget($input: CreateTargetInput!) {
    createTarget(input: $input) {
      success
      data {
        ...TargetFields
      }
    }
  }
  ${TARGET_FIELDS}
`

export const UPDATE_TARGET = gql`
  mutation AnalyticsUpdateTarget($id: ID!, $input: CreateTargetInput!) {
    updateTarget(id: $id, input: $input) {
      success
      data {
        ...TargetFields
      }
    }
  }
  ${TARGET_FIELDS}
`

export const DELETE_TARGET = gql`
  mutation AnalyticsDeleteTarget($id: ID!) {
    deleteTarget(id: $id) {
      success
    }
  }
`
