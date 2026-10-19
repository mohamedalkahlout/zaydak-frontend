import { gql } from "@apollo/client"

const CONTACT_FIELDS = gql`
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

export const CREATE_CONTACT = gql`
  mutation CreateContact($input: CreateContactInput!) {
    createContact(input: $input) {
      success
      data {
        ...ContactFields
      }
    }
  }
  ${CONTACT_FIELDS}
`

export const UPDATE_CONTACT = gql`
  mutation UpdateContact($input: UpdateContactInput!) {
    updateContact(input: $input) {
      success
      data {
        ...ContactFields
      }
    }
  }
  ${CONTACT_FIELDS}
`

export const DELETE_CONTACT = gql`
  mutation DeleteContact($id: String!) {
    deleteContact(id: $id) {
      success
    }
  }
`
