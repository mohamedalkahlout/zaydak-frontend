import { gql } from "@/shared/api/generated"

/**
 * Shop administration operations.
 *
 * The mutations that manage the list — `adminCreateShop`, `setShopsActive`,
 * `restoreShops`, `deleteShop` — are gated on `manage_all_shops`, and
 * approve/disapprove on `approve_shop` (shops.resolver.ts).
 *
 * `shops` itself is *not* admin-gated: it is the same public query the
 * storefront pages with. What an admin token buys is visibility — the resolver
 * decides from the caller which shops the filters may reach — so the console
 * asks for suspended, pending and deleted rows and lets the server answer.
 * Omitting `status` returns active, suspended and pending; `deleted` is opt-in.
 */

export const SHOPS = gql(`
  query AdminShops(
    $page: Int!
    $limit: Int!
    $search: String
    $status: ShopStatusFilter
  ) {
    shops(page: $page, limit: $limit, search: $search, status: $status) {
      success
      data {
        id
        name
        slug
        is_active
        is_approved
        deleted_at
        created_at
        products_count
        orders_count
        owner {
          id
          name
          email
        }
      }
      meta {
        page
        limit
        total
        total_pages
      }
    }
  }
`)

/** Creating a shop promotes a `customer` owner to `vendor` in the same transaction. */
export const CREATE_SHOP = gql(`
  mutation AdminCreateShop($input: AdminCreateShopInput!) {
    adminCreateShop(input: $input) {
      success
      data {
        id
        name
        slug
      }
    }
  }
`)

/** Take the storefront offline (`is_active: false`) or bring it back. Not a delete. */
export const SET_SHOPS_ACTIVE = gql(`
  mutation AdminSetShopsActive($ids: [ID!]!, $is_active: Boolean!) {
    setShopsActive(ids: $ids, is_active: $is_active) {
      success
    }
  }
`)

export const RESTORE_SHOPS = gql(`
  mutation AdminRestoreShops($ids: [ID!]!) {
    restoreShops(ids: $ids) {
      success
    }
  }
`)

export const APPROVE_SHOP = gql(`
  mutation AdminApproveShop($slug: String!) {
    approveShop(slug: $slug) {
      success
    }
  }
`)

export const DISAPPROVE_SHOP = gql(`
  mutation AdminDisapproveShop($slug: String!) {
    disapproveShop(slug: $slug) {
      success
    }
  }
`)

/** Soft delete. Refused with SHOP_HAS_ACTIVE_ORDERS while orders are still open. */
export const DELETE_SHOP = gql(`
  mutation AdminDeleteShop($slug: String!) {
    deleteShop(slug: $slug) {
      success
    }
  }
`)

/**
 * One shop's addresses, for `/shops/[shopId]/domains`.
 *
 * A resolver of its own rather than the merchant's `shopDomains`: that one is
 * scoped by `X-SHOP` and takes no shop argument, and this console sends no
 * `X-SHOP` at all. Gated on `manage_all_shops` **alone** — `PermissionsGuard`
 * matches with `.some()`, so a second permission beside it would hand every
 * vendor any shop id they cared to type.
 *
 * There is no mutation to pair with it. The back-end exposes none, and the
 * screen offers none.
 */
export const SHOP_DOMAINS = gql(`
  query AdminShopDomains($shop_id: ID!) {
    adminShopDomains(shop_id: $shop_id) {
      success
      custom_domains_enabled
      shop {
        id
        name
        slug
        is_active
        is_approved
        deleted_at
      }
      data {
        id
        hostname
        kind
        status
        is_primary
        last_error
        verified_at
        created_at
        dns_records {
          type
          name
          value
        }
      }
    }
  }
`)
