import { gql } from "@/shared/api/generated"

/**
 * The platform's one-time-code log.
 *
 * Read-only and gated on `manage_users` (`otp-logs.resolver.ts`) rather than on
 * the `manage_integrations` behind the OTP *settings* screen: these rows carry
 * the email addresses and phone numbers codes were sent to. Platform-scoped, so
 * no X-SHOP.
 *
 * The code and its hash are not fields on `OtpLogEntry` — the list never carries
 * them. `REVEAL_OTP_CODE` below is the single, audited exception.
 *
 * `from` / `to` are inclusive `created_at` bounds, either valid on its own. The
 * same document backs the CSV export, which re-runs it page by page at the
 * server's `limit` ceiling.
 */
export const OTP_LOGS = gql(`
  query AdminOtpLogs(
    $page: Int
    $limit: Int
    $search: String
    $purpose: OtpPurpose
    $status: OtpLogStatus
    $from: DateTime
    $to: DateTime
    $includeDeliveryErrors: Boolean! = true
  ) {
    otpDeliveryErrorGroups(
      search: $search
      purpose: $purpose
      status: $status
      from: $from
      to: $to
    ) @include(if: $includeDeliveryErrors) {
      reason
      count
    }
    otpLogs(
      page: $page
      limit: $limit
      search: $search
      purpose: $purpose
      status: $status
      from: $from
      to: $to
    ) {
      success
      data {
        id
        identifier
        purpose
        status
        attempts
        max_attempts
        expires_at
        verified_at
        delivered_at
        delivery_error
        verifier
        created_at
        user_id
        user_name
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

/**
 * Reads the code behind one still-live row. `super_admin` only, and the
 * back-end writes an `ACCESS` audit entry naming the caller on every call.
 *
 * A mutation despite writing no row: it must not be cached, prefetched or
 * refetched on the client's own initiative, and it returns a live credential.
 * The server refuses any row that is not `PENDING` — a code already used,
 * locked, replaced or expired opens nothing, so there is nothing to show.
 */
export const REVEAL_OTP_CODE = gql(`
  mutation AdminRevealOtpCode($id: ID!) {
    revealOtpCode(id: $id) {
      success
      data {
        id
        code
        expires_at
      }
    }
  }
`)
