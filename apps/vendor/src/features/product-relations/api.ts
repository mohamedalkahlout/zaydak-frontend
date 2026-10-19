import { gql } from "@apollo/client"

/**
 * Vendor view of relations sourced from a product. Includes draft +
 * soft-deleted targets so the manage UI can offer cleanup links. The
 * resolver requires JWT — only the owner can read this list.
 */
export const GET_PRODUCT_RELATIONS = gql`
  query ProductRelations($product_id: String!, $type: ProductRelationType) {
    productRelations(product_id: $product_id, type: $type) {
      success
      data {
        id
        source_product_id
        target_product_id
        type
        position
        created_at
      }
    }
  }
`

export const ADD_PRODUCT_RELATION = gql`
  mutation AddProductRelation($input: AddProductRelationInput!) {
    addProductRelation(input: $input) {
      success
      data {
        id
        source_product_id
        target_product_id
        type
        position
        created_at
      }
    }
  }
`

export const REMOVE_PRODUCT_RELATION = gql`
  mutation RemoveProductRelation($id: String!) {
    removeProductRelation(id: $id) {
      success
      message
    }
  }
`

export const REORDER_PRODUCT_RELATION = gql`
  mutation ReorderProductRelation($input: ReorderProductRelationInput!) {
    reorderProductRelation(input: $input) {
      success
      data {
        id
        position
      }
    }
  }
`
