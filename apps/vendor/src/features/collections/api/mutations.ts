import { gql } from "@apollo/client"

const COLLECTION_FIELDS = gql`
  fragment CollectionFields on CollectionEntry {
    id
    shop_id
    type
    name
    slug
    image
    description
    seo_title
    seo_description
    sort_order
    sort
    is_published
    rules
    rules_version
    product_count
    created_at
    updated_at
  }
`

export const CREATE_SHOP_COLLECTION = gql`
  mutation CreateCollection($input: CreateCollectionInput!) {
    createCollection(input: $input) {
      success
      error_code
      message
      data {
        ...CollectionFields
      }
    }
  }
  ${COLLECTION_FIELDS}
`

export const UPDATE_SHOP_COLLECTION = gql`
  mutation UpdateCollection($input: UpdateCollectionInput!) {
    updateCollection(input: $input) {
      success
      error_code
      message
      data {
        ...CollectionFields
      }
    }
  }
  ${COLLECTION_FIELDS}
`

export const DELETE_SHOP_COLLECTION = gql`
  mutation DeleteCollection($id: String!) {
    deleteCollection(id: $id) {
      success
      message
    }
  }
`

/** Manual ordering, for a collection whose sort is MANUAL. */
export const REORDER_COLLECTION_PRODUCTS = gql`
  mutation ReorderCollectionProducts(
    $collection_id: String!
    $product_ids: [String!]!
  ) {
    reorderCollectionProducts(
      collection_id: $collection_id
      product_ids: $product_ids
    ) {
      success
      message
    }
  }
`
