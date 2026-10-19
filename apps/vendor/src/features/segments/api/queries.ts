import { gql } from "@apollo/client"

const SEGMENT_FIELDS = gql`
  fragment SegmentFields on CustomerSegmentEntry {
    id
    shop_id
    name
    description
    query
    rules
    coupons_count
    created_at
    updated_at
  }
`

export const GET_SEGMENTS = gql`
  ${SEGMENT_FIELDS}
  query CustomerSegments($page: Int, $limit: Int, $search: String) {
    customerSegments(page: $page, limit: $limit, search: $search) {
      success
      data {
        ...SegmentFields
      }
      meta {
        total
        page
        limit
        total_pages
      }
    }
  }
`

export const GET_SEGMENT_BY_ID = gql`
  ${SEGMENT_FIELDS}
  query CustomerSegment($id: String!) {
    customerSegment(id: $id) {
      success
      data {
        ...SegmentFields
      }
    }
  }
`

export const PREVIEW_SEGMENT = gql`
  query PreviewCustomerSegment($query: String!, $sampleSize: Int) {
    previewCustomerSegment(query: $query, sampleSize: $sampleSize) {
      success
      count
      sample {
        id
        name
        phone_number
        email
        meta
        created_at
        updated_at
      }
      message
    }
  }
`

export const GET_SEGMENT_TEMPLATES = gql`
  query SegmentTemplates($category: SegmentTemplateCategory) {
    segmentTemplates(category: $category) {
      success
      templates {
        id
        name {
          en
          ar
        }
        description {
          en
          ar
        }
        category
        query
      }
    }
  }
`

export const GET_FILTER_CATALOG = gql`
  query CustomerSegmentFilters {
    customerSegmentFilters {
      success
      filters {
        field
        description {
          en
          ar
        }
        valueKind
        allowedOperators
        enumValues
        cost
      }
    }
  }
`

export const DESCRIBE_SEGMENT = gql`
  query DescribeCustomerSegment($query: String!, $locale: String) {
    describeCustomerSegment(query: $query, locale: $locale) {
      success
      description
    }
  }
`

/**
 * Lightweight count-only query — returns just `meta.total` from the
 * contacts list, used by the editor stats bar to compute "X% of your
 * customer base".
 */
export const GET_CUSTOMER_BASE_COUNT = gql`
  query CustomerBaseCount {
    contacts(page: 1, limit: 1) {
      success
      meta {
        total
      }
    }
  }
`

/**
 * Segment analytics — populates the Insights tab.
 * Reads from Contact materialised columns + meta JSON paths.
 */
export const GET_SEGMENT_INSIGHTS = gql`
  query SegmentInsights($id: String!) {
    segmentInsights(id: $id) {
      success
      message
      data {
        count
        baseCount
        sizeHistory {
          date
          cumulative
        }
        topCountries {
          value
          count
        }
        topCities {
          value
          count
        }
        topLanguages {
          value
          count
        }
        emailSubscribedRatio
        smsSubscribedRatio
        avgTotalSpentCents
        medianTotalSpentCents
        avgOrdersCount
      }
    }
  }
`

/**
 * AI explain — natural-language summary + refinement suggestions for the
 * current draft query. Throttled 10 req/min/IP.
 */
export const EXPLAIN_SEGMENT = gql`
  query ExplainCustomerSegment(
    $query: String!
    $count: Int!
    $baseCount: Int!
    $locale: String
  ) {
    explainCustomerSegment(
      query: $query
      count: $count
      baseCount: $baseCount
      locale: $locale
    ) {
      success
      data {
        summary
        suggestions {
          label
          refinement
        }
      }
    }
  }
`
