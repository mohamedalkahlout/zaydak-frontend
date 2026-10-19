import { gql } from "@/shared/api/generated"

/**
 * Withdrawal operations.
 *
 * @deprecated D26 — frozen ledger payouts; do not add bank rails. See
 * docs/future-features/tap-commerce-platform.md.
 *
 * `withdrawals` is JWT-only, but `WithdrawalsService.findAll` skips the
 * `user_id`/`shop_id` narrowing for `admin` and `super_admin`, so this console
 * sees every shop's requests. The two mutations are gated on `manage_all_orders`
 * (withdrawals.resolver.ts) — there is no withdrawal-specific permission.
 */

export const WITHDRAWALS = gql(`
  query AdminWithdrawals($page: Int, $limit: Int, $status: WithdrawalStatus) {
    withdrawals(page: $page, limit: $limit, status: $status) {
      success
      data {
        id
        amount_cents
        status
        payment_method
        details
        note
        shop_id
        user_id
        created_at
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

export const UPDATE_WITHDRAWAL_STATUS = gql(`
  mutation AdminUpdateWithdrawalStatus($input: UpdateWithdrawalInput!) {
    updateWithdrawalStatus(input: $input) {
      success
      message
      data {
        id
        status
      }
    }
  }
`)

export const DELETE_WITHDRAWAL = gql(`
  mutation AdminDeleteWithdrawal($id: String!) {
    deleteWithdrawal(id: $id) {
      success
      message
    }
  }
`)
