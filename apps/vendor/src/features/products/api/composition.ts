import { gql } from "@/shared/api/generated"

export const GET_PRODUCT_COMPOSITION = gql(`
  query ProductComposition($product_id: String!) {
    productComposition(product_id: $product_id) {
      success
      data {
        product_id
        min_count
        max_count
        vessel_cap
        price_ladder_cents
        groups {
          key
          priced_by_ladder
          selection
          min_count
          max_count
          addon_cents
          position
          parts {
            product_id
            addon_cents
            position
            cutout_url
          }
        }
      }
    }
  }
`)

export const SET_PRODUCT_COMPOSITION = gql(`
  mutation SetProductComposition($input: SetProductCompositionInput!) {
    setProductComposition(input: $input) {
      success
      data {
        product_id
      }
    }
  }
`)

export const CLEAR_PRODUCT_COMPOSITION = gql(`
  mutation ClearProductComposition($product_id: String!) {
    clearProductComposition(product_id: $product_id) {
      success
    }
  }
`)
