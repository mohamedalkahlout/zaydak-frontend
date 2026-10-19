import { gql } from "@apollo/client"

export const CONTACT_FIELDS_FRAGMENT = gql`
  fragment ContactFields on ContactEntry {
    id
    name
    phone_number
    email
    notes
    description
    status
    overall_score
    meta
    shop_id
    customer_id
    created_at
    updated_at
  }
`

export const GET_CONTACTS = gql`
  ${CONTACT_FIELDS_FRAGMENT}
  query Contacts($page: Int, $limit: Int, $status: String, $search: String) {
    contacts(page: $page, limit: $limit, status: $status, search: $search) {
      success
      data {
        ...ContactFields
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

export const GET_CONTACT_BY_ID = gql`
  ${CONTACT_FIELDS_FRAGMENT}
  query Contact($id: String!) {
    contact(id: $id) {
      success
      data {
        ...ContactFields
      }
    }
  }
`
