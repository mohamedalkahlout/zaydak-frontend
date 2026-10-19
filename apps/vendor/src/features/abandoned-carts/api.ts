import { gql } from "@apollo/client"

export const GET_ABANDONED_CARTS = gql`
  query AbandonedCarts(
    $page: Int
    $limit: Int
    $search: String
    $reminder_status: AbandonedCartReminderStatus
    $include_hidden: Boolean
    $start: DateTime
    $end: DateTime
    $created_start: DateTime
    $created_end: DateTime
    $min_total_cents: Int
    $max_total_cents: Int
    $sort_by: AbandonedCartSortField
    $sort_dir: AbandonedCartSortDir
  ) {
    abandonedCarts(
      page: $page
      limit: $limit
      search: $search
      reminder_status: $reminder_status
      include_hidden: $include_hidden
      start: $start
      end: $end
      created_start: $created_start
      created_end: $created_end
      min_total_cents: $min_total_cents
      max_total_cents: $max_total_cents
      sort_by: $sort_by
      sort_dir: $sort_dir
    ) {
      success
      data {
        id
        status
        reminder_status
        hidden
        customer {
          id
          name
          email
          phone
          country
        }
        items {
          id
          product_id
          variation_option_id
          name
          slug
          image
          quantity
          unit_price_cents
          total_cents
        }
        item_count
        total_cents
        currency
        channels {
          email
          sms
          whatsapp
        }
        created_at
        last_activity_at
        abandoned_at
        last_reminder_at
        last_reminder_failed_at
        last_reminder_channels
        marketing_hidden_at
        marketing_draft_order_id
        reminder_link_opened_at
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

export const GET_ABANDONED_CARTS_BY_PRODUCT = gql`
  query AbandonedCartsByProduct(
    $page: Int
    $limit: Int
    $search: String
    $include_hidden: Boolean
    $start: DateTime
    $end: DateTime
    $created_start: DateTime
    $created_end: DateTime
    $min_total_cents: Int
    $max_total_cents: Int
    $sort_by: AbandonedCartSortField
    $sort_dir: AbandonedCartSortDir
  ) {
    abandonedCartsByProduct(
      page: $page
      limit: $limit
      search: $search
      include_hidden: $include_hidden
      start: $start
      end: $end
      created_start: $created_start
      created_end: $created_end
      min_total_cents: $min_total_cents
      max_total_cents: $max_total_cents
      sort_by: $sort_by
      sort_dir: $sort_dir
    ) {
      success
      data {
        product_id
        name
        slug
        image
        cart_count
        lost_revenue_cents
        currency
        last_left_at
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

export const GET_ABANDONED_CARTS_SUMMARY = gql`
  query AbandonedCartsSummary($start: DateTime, $end: DateTime) {
    abandonedCartsSummary(start: $start, end: $end) {
      success
      data {
        total_abandoned
        recovered
        recovery_rate
        average_cart_cents
        currency
      }
    }
  }
`

/**
 * The count beside each status option: the list's filter with the status left
 * out, so every number is what picking that status would show. It takes the
 * list's variables by the list's names and has no `reminder_status`.
 */
export const GET_ABANDONED_CART_STATUS_COUNTS = gql`
  query AbandonedCartStatusCounts(
    $search: String
    $include_hidden: Boolean
    $start: DateTime
    $end: DateTime
    $created_start: DateTime
    $created_end: DateTime
    $min_total_cents: Int
    $max_total_cents: Int
  ) {
    abandonedCartStatusCounts(
      search: $search
      include_hidden: $include_hidden
      start: $start
      end: $end
      created_start: $created_start
      created_end: $created_end
      min_total_cents: $min_total_cents
      max_total_cents: $max_total_cents
    ) {
      success
      data {
        status
        count
      }
    }
  }
`

/**
 * Every cart id the list's filter matches, in the list's order — what "select
 * all matching" selects. At most 500 come back (`SELECT_ALL_LIMIT`); `total`
 * is how many match, so a longer list is a cut one.
 */
export const GET_ABANDONED_CART_IDS = gql`
  query AbandonedCartIds(
    $search: String
    $reminder_status: AbandonedCartReminderStatus
    $include_hidden: Boolean
    $start: DateTime
    $end: DateTime
    $created_start: DateTime
    $created_end: DateTime
    $min_total_cents: Int
    $max_total_cents: Int
    $sort_by: AbandonedCartSortField
    $sort_dir: AbandonedCartSortDir
  ) {
    abandonedCartIds(
      search: $search
      reminder_status: $reminder_status
      include_hidden: $include_hidden
      start: $start
      end: $end
      created_start: $created_start
      created_end: $created_end
      min_total_cents: $min_total_cents
      max_total_cents: $max_total_cents
      sort_by: $sort_by
      sort_dir: $sort_dir
    ) {
      success
      data
      total
    }
  }
`

/** The shop's send / hide / unhide log for a date window; the CSV export's source. */
export const GET_ABANDONED_CART_OPS = gql`
  query AbandonedCartOps(
    $page: Int
    $limit: Int
    $start: DateTime
    $end: DateTime
  ) {
    abandonedCartOps(page: $page, limit: $limit, start: $start, end: $end) {
      success
      data {
        id
        op
        cart_id
        cart_ids
        actor_name
        actor_email
        channels
        failed_channels
        coupon_code
        created_at
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

export const GET_ABANDONED_CHECKOUT_SETTING = gql`
  query AbandonedCheckoutSetting {
    setting(key: "abandoned_checkout") {
      success
      data {
        key
        value
      }
    }
  }
`

export const SEND_ABANDONED_CART_REMINDER = gql`
  mutation SendAbandonedCartReminder($input: SendAbandonedCartReminderInput!) {
    sendAbandonedCartReminder(input: $input) {
      success
      message
      data {
        cart_id
        sent_channels
        failed_channels
        coupon_code
        preview_body
      }
    }
  }
`

export const HIDE_ABANDONED_CART = gql`
  mutation HideAbandonedCart($id: String!) {
    hideAbandonedCart(id: $id) {
      success
    }
  }
`

export const UNHIDE_ABANDONED_CART = gql`
  mutation UnhideAbandonedCart($id: String!) {
    unhideAbandonedCart(id: $id) {
      success
    }
  }
`

export const HIDE_ABANDONED_CARTS = gql`
  mutation HideAbandonedCarts($input: HideAbandonedCartsInput!) {
    hideAbandonedCarts(input: $input) {
      success
      updated
    }
  }
`

export const RECORD_ABANDONED_CART_DRAFT = gql`
  mutation RecordAbandonedCartDraft($input: RecordAbandonedCartDraftInput!) {
    recordAbandonedCartDraft(input: $input) {
      success
    }
  }
`

export const UPSERT_ABANDONED_CHECKOUT_SETTING = gql`
  mutation UpsertAbandonedCheckoutSetting($input: UpsertSettingsInput!) {
    upsertSetting(input: $input) {
      success
      data {
        key
        value
      }
    }
  }
`
