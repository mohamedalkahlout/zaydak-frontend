import { gql } from "@apollo/client"

export const GET_MY_SHOPS = gql`
  query MyShops {
    myShops {
      success
      data {
        id
        name
        slug
        timezone
        currency
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
        is_active
        is_approved
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
        socials {
          id
          link
          name
        }
        balance {
          id
          admin_commission_bps
          current_balance_cents
          total_earnings_cents
          withdrawn_amount_cents
          is_custom_commission
          payment_info {
            account
            bank
            email
            name
          }
        }
        owner {
          id
          name
          email
          phone
        }
        owner_id
        orders_count
        products_count
        notifications
        shipping
        created_at
        updated_at
      }
    }
  }
`

/**
 * The shop a handle names today.
 *
 * `shop(slug)` resolves retired handles through `shop_slug_history`, so this
 * answers with the shop's **current** id and slug for an address the vendor
 * bookmarked before a rename. Two fields only: this is the redirect check in
 * `store/[shopSlug]/layout.tsx`, on every navigation into a shop the vendor
 * does not currently own a slug for, and it must not drag the whole shop
 * payload along with it.
 */
export const RESOLVE_SHOP_HANDLE = gql`
  query ResolveShopHandle($slug: String!) {
    shop(slug: $slug) {
      success
      data {
        id
        slug
      }
    }
  }
`

/**
 * Whether a handle is free, asked before the vendor commits to it.
 *
 * The server is the authority and the rename mutation enforces it either way;
 * this exists so the answer arrives while the dialog is open rather than as an
 * error toast after it closes. It reports `false` for three different reasons —
 * another shop holds the handle, a **retired** handle still reserves it, or the
 * platform keeps it for itself — and deliberately does not say which. A form
 * that distinguished them would be telling anyone with a dashboard which
 * handles exist.
 *
 * `excludeShopId` is what lets a shop see its own current handle as available,
 * so re-opening the dialog and changing nothing does not read as a conflict.
 */
export const IS_SHOP_SLUG_AVAILABLE = gql`
  query IsShopSlugAvailable($slug: String!, $excludeShopId: String) {
    isShopSlugAvailable(slug: $slug, excludeShopId: $excludeShopId)
  }
`
