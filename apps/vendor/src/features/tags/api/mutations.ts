import { gql } from "@apollo/client"

const TAG_FIELDS = gql`
  fragment TagFields on TagEntry {
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
`

export const CREATE_TAG = gql`
  mutation CreateTag($input: CreateTagInput!) {
    createTag(input: $input) {
      success
      data {
        ...TagFields
      }
    }
  }
  ${TAG_FIELDS}
`

export const UPDATE_TAG = gql`
  mutation UpdateTag($input: UpdateTagInput!) {
    updateTag(input: $input) {
      success
      data {
        ...TagFields
      }
    }
  }
  ${TAG_FIELDS}
`

export const DELETE_TAG = gql`
  mutation DeleteTag($id: String!) {
    deleteTag(id: $id) {
      success
    }
  }
`
