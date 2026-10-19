import { gql } from "@apollo/client"

export const GET_TAGS = gql`
  query Tags($page: Int, $limit: Int) {
    tags(page: $page, limit: $limit) {
      success
      data {
        id
        name
        slug
        icon
        image
        details
        shop_id
        products_count
        created_at
        updated_at
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

export const GET_TAG_BY_ID = gql`
  query Tag($slug: String!) {
    tag(slug: $slug) {
      success
      data {
        id
        name
        slug
        icon
        image
        details
        shop_id
        products_count
        created_at
        updated_at
      }
    }
  }
`
