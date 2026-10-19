import { gql } from "@apollo/client"

export const GET_ME = gql`
  query GetMe {
    me {
      success
      data {
        id
        name
        email
        phone
        role
        permissions
        email_verified
        profile {
          bio
          contact
          avatar {
            original
            thumbnail
          }
          socials {
            type
            link
          }
        }
        address {
          id
          title
          type
          default
          address {
            country
            state
            city
            zip
            street_address
          }
        }
      }
    }
  }
`

export const GET_LOOKUPS = gql`
  query Lookups {
    lookups {
      success
      message
      data {
        enums
        locales {
          code
          direction
          is_default
          label
        }
      }
    }
  }
`
