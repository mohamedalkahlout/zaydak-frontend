import { gql } from "@/shared/api/generated"

/**
 * Commission-tier operations.
 *
 * Reads are public (`OptionalJwtGuard`); the three mutations are gated on
 * `manage_all_shops` (commissions.resolver.ts), i.e. admin + super_admin.
 *
 * Units: money crosses the API as integer cents and the rate as basis points —
 * the same units the database stores. The form takes human-friendly dollars and
 * a percent; the table converts to/from cents and bps at the network boundary
 * (see `commissions-table.tsx`), never inside a render.
 */

export const COMMISSIONS = gql(`
  query AdminCommissions($page: Int, $limit: Int) {
    commissions(page: $page, limit: $limit) {
      success
      data {
        id
        level
        sub_level
        description
        min_balance_cents
        max_balance_cents
        commission_bps
        language
        shop_id
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

export const CREATE_COMMISSION = gql(`
  mutation AdminCreateCommission($input: CreateCommissionInput!) {
    createCommission(input: $input) {
      success
      data {
        id
      }
    }
  }
`)

export const UPDATE_COMMISSION = gql(`
  mutation AdminUpdateCommission($input: UpdateCommissionInput!) {
    updateCommission(input: $input) {
      success
      data {
        id
      }
    }
  }
`)

export const DELETE_COMMISSION = gql(`
  mutation AdminDeleteCommission($id: String!) {
    deleteCommission(id: $id) {
      success
      message
    }
  }
`)
