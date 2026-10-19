import { gql } from "@apollo/client"

export const CREATE_SEGMENT = gql`
  mutation CreateCustomerSegment($input: CreateCustomerSegmentInput!) {
    createCustomerSegment(input: $input) {
      success
      data {
        id
        name
        query
        rules
        coupons_count
        created_at
        updated_at
      }
      message
    }
  }
`

export const UPDATE_SEGMENT = gql`
  mutation UpdateCustomerSegment($input: UpdateCustomerSegmentInput!) {
    updateCustomerSegment(input: $input) {
      success
      data {
        id
        name
        query
        rules
        coupons_count
        updated_at
      }
      message
    }
  }
`

export const DELETE_SEGMENT = gql`
  mutation DeleteCustomerSegment($id: String!) {
    deleteCustomerSegment(id: $id) {
      success
      message
    }
  }
`

/**
 * Bulk soft-delete — single round-trip for the segments-list bulk bar.
 * The backend silently skips IDs not in the current shop, returns
 * `deletedCount` so the UI can show "N segments deleted".
 */
export const BULK_DELETE_SEGMENTS = gql`
  mutation BulkDeleteCustomerSegments($ids: [String!]!) {
    bulkDeleteCustomerSegments(ids: $ids) {
      success
      deletedCount
      message
    }
  }
`

/**
 * AI-powered: natural language description → ShopifyQL query.
 * Backend parses + validates the LLM output before returning, so the
 * `query` we get back is guaranteed to be syntactically valid and use
 * only registered filter fields.
 */
export const GENERATE_SEGMENT_FROM_PROMPT = gql`
  mutation GenerateCustomerSegmentFromPrompt(
    $input: GenerateSegmentInput!
  ) {
    generateCustomerSegmentFromPrompt(input: $input) {
      success
      data {
        query
        canonical
        retried
        outOfScope {
          reason
          suggestion
        }
      }
      message
    }
  }
`
