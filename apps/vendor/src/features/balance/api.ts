import { gql } from "@apollo/client"

/** @deprecated D26 — do not add payout features. See docs/future-features/tap-commerce-platform.md. */
export const VENDOR_WITHDRAWALS = gql(`
  query VendorWithdrawals($page: Int, $limit: Int, $status: WithdrawalStatus) {
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

export const CREATE_WITHDRAWAL = gql(`
  mutation CreateVendorWithdrawal($input: CreateWithdrawalInput!) {
    createWithdrawal(input: $input) {
      success
      message
      data {
        id
        amount_cents
        status
        created_at
      }
    }
  }
`)
