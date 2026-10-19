import { gql } from "@apollo/client"

/**
 * The selection set has to name every field the settings panes edit.
 *
 * Apollo writes the mutation's `data` into the normalised cache under the
 * shop's id, and `MyShops` reads from the same entity. A field the mutation
 * does not ask for is simply not written, so the pane keeps rendering the
 * pre-save value until the refetch lands — which is how a freshly picked logo
 * appeared to snap back to the old one for a beat.
 */
export const UPDATE_SHOP = gql`
  mutation UpdateShop($slug: String!, $input: UpdateShopInput!) {
    updateShop(slug: $slug, input: $input) {
      success
      message
      data {
        id
        name
        slug
        timezone
        storefront_template
        storefront_theme
        tax_bps
        description
        logo {
          id
          original
          thumbnail
        }
        cover_image {
          id
          original
          thumbnail
        }
        socials {
          id
          link
          name
        }
        settings {
          contact
          email
          website
          isShopUnderMaintenance
          location {
            city
            country
            formattedAddress
            apartment
            company
            lat
            lng
            state
            district
            zip
          }
          brand {
            slogan
            square_logo {
              id
              original
              thumbnail
            }
            colors {
              primary {
                background
                foreground
              }
              secondary {
                background
                foreground
              }
            }
          }
          policies {
            refund_policy
            privacy_policy
            terms_of_service
            shipping_policy
          }
        }
      }
    }
  }
`

export const CREATE_SHOP = gql`
  mutation CreateShop($input: CreateShopInput!) {
    createShop(input: $input) {
      success
      data {
        id
        name
        slug
        description
        home_country
        currency
        address
        settings {
          contact
          email
          website
          isShopUnderMaintenance
          location {
            city
            country
            formattedAddress
            apartment
            company
            lat
            lng
            state
            district
            zip
          }
        }
        is_active
        is_approved
      }
    }
  }
`

/**
 * Soft-delete the current shop. Ownership is checked on the back-end
 * (`manage_own_shop` + owner, or `manage_all_shops`). Sets `deleted_at` and
 * clears `is_active`; reversible only via admin `restoreShops`.
 */
export const DELETE_SHOP = gql`
  mutation DeleteShop($slug: String!) {
    deleteShop(slug: $slug) {
      success
    }
  }
`
