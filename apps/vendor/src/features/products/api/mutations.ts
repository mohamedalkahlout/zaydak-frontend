import { gql } from "@apollo/client"

const PRODUCT_MUTATION_FIELDS = gql`
  fragment ProductMutationFields on ProductEntry {
    id
    name
    slug
    price_cents
    sale_price_cents
    quantity
    in_stock
    image
    status
    product_type
    sale_type
    version
    created_at
    updated_at
  }
`

export const CREATE_PRODUCT = gql`
  mutation CreateProduct($input: CreateProductInput!) {
    createProduct(input: $input) {
      success
      data {
        ...ProductMutationFields
      }
    }
  }
  ${PRODUCT_MUTATION_FIELDS}
`

export const UPDATE_PRODUCT = gql`
  mutation UpdateProduct($input: UpdateProductInput!) {
    updateProduct(input: $input) {
      success
      data {
        ...ProductMutationFields
      }
    }
  }
  ${PRODUCT_MUTATION_FIELDS}
`

export const DELETE_PRODUCT = gql`
  mutation DeleteProduct($id: String!) {
    deleteProduct(id: $id) {
      success
      message
    }
  }
`

// Shopify-style "Duplicate" — clones the product into a fresh DRAFT row.
export const DUPLICATE_PRODUCT = gql`
  mutation DuplicateProduct($id: String!) {
    duplicateProduct(id: $id) {
      success
      data {
        ...ProductMutationFields
      }
    }
  }
  ${PRODUCT_MUTATION_FIELDS}
`

// Bulk status flip on a list of selected products. Server enforces the
// state-transition map per product and silently skips rows the caller
// doesn't own.
export const BULK_UPDATE_PRODUCTS_STATUS = gql`
  mutation BulkUpdateProductsStatus($ids: [String!]!, $status: ProductStatus!) {
    bulkUpdateProductsStatus(ids: $ids, status: $status) {
      success
      updated
    }
  }
`

export const VIEW_PRODUCT = gql`
  mutation ViewProduct($slug: String!) {
    viewProduct(slug: $slug) {
      success
      data {
        id
        views
      }
    }
  }
`

/**
 * Ask the model to fill this category's metafields from the product's own text.
 *
 * A mutation despite writing no row: it spends a model call. Free on every
 * plan, so there is no entitlement to check before offering it — a per-user
 * rate limit is the only ceiling. `skip_keys` is every key the merchant has
 * already answered; the server drops them from the prompt, so a suggestion can
 * never appear over something a person chose.
 */
export const SUGGEST_PRODUCT_ATTRIBUTES = gql`
  mutation SuggestProductAttributes(
    $input: SuggestAttributesInput!
    $locale: String
  ) {
    suggestProductAttributes(input: $input, locale: $locale) {
      success
      generated
      data {
        key
        type
        value_text
        value_number
        value_boolean
        value_option
        value_options
      }
    }
  }
`
