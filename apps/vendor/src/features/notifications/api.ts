import { gql } from "@apollo/client"

/**
 * Header bell feed, scoped server-side to the `X-SHOP` the Apollo link sends:
 * this shop's rows plus the user's shop-less personal ones. `unread_count` is
 * the full unread total for that scope (across all pages), so the badge is
 * correct regardless of the page slice fetched.
 */
export const NOTIFICATIONS = gql`
  query Notifications($page: Int, $limit: Int, $unread_only: Boolean) {
    notifications(page: $page, limit: $limit, unread_only: $unread_only) {
      success
      unread_count
      data {
        id
        notify_type
        notify_text
        entity_type
        entity_id
        is_read
        shop_id
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

export const MARK_NOTIFICATION_READ = gql`
  mutation MarkNotificationRead($id: String!) {
    markNotificationRead(id: $id) {
      success
    }
  }
`

export const MARK_NOTIFICATION_UNREAD = gql`
  mutation MarkNotificationUnread($id: String!) {
    markNotificationUnread(id: $id) {
      success
    }
  }
`

export const DELETE_NOTIFICATION = gql`
  mutation DeleteNotification($id: String!) {
    deleteNotification(id: $id) {
      success
    }
  }
`

export const MARK_ALL_NOTIFICATIONS_READ = gql`
  mutation MarkAllNotificationsRead {
    markAllNotificationsRead {
      success
    }
  }
`

/** Per-type delivery matrix for the current user (every NotifyType, defaults filled). */
export const NOTIFICATION_PREFERENCES = gql`
  query NotificationPreferences {
    notificationPreferences {
      success
      data {
        notify_type
        in_app
        email
      }
    }
  }
`

export const UPDATE_NOTIFICATION_PREFERENCE = gql`
  mutation UpdateNotificationPreference(
    $input: UpdateNotificationPreferenceInput!
  ) {
    updateNotificationPreference(input: $input) {
      success
      data {
        notify_type
        in_app
        email
      }
    }
  }
`

/**
 * Handshake for the SSE stream. `EventSource` can't send an Authorization
 * header, so the Bearer token is spent here for a one-shot, claim-less ticket
 * that is safe to put in the stream URL.
 */
export const NOTIFICATION_STREAM_TICKET = gql`
  mutation NotificationStreamTicket {
    notificationStreamTicket {
      success
      ticket
      expires_in
    }
  }
`

// ── Customer notification console (Shopify Settings → Notifications) ──────────

const TEMPLATE_FIELDS = `
  event_key
  category
  subject
  body
  enabled
  is_customized
  has_previous
`

/** The full catalog of customer-notification templates for the active shop. */
export const NOTIFICATION_CATALOG = gql`
  query NotificationCatalog {
    notificationCatalog {
      success
      data { ${TEMPLATE_FIELDS} }
    }
  }
`

export const NOTIFICATION_TEMPLATE = gql`
  query NotificationTemplate($event_key: String!) {
    notificationTemplate(event_key: $event_key) {
      success
      data { ${TEMPLATE_FIELDS} }
    }
  }
`

export const UPDATE_NOTIFICATION_TEMPLATE = gql`
  mutation UpdateNotificationTemplate($input: UpdateNotificationTemplateInput!) {
    updateNotificationTemplate(input: $input) {
      success
      data { ${TEMPLATE_FIELDS} }
    }
  }
`

export const REVERT_NOTIFICATION_TEMPLATE = gql`
  mutation RevertNotificationTemplate($input: RevertNotificationTemplateInput!) {
    revertNotificationTemplate(input: $input) {
      success
      data { ${TEMPLATE_FIELDS} }
    }
  }
`

export const PREVIEW_NOTIFICATION_TEMPLATE = gql`
  mutation PreviewNotificationTemplate(
    $input: PreviewNotificationTemplateInput!
  ) {
    previewNotificationTemplate(input: $input) {
      success
      subject
      html
    }
  }
`

export const SEND_TEST_NOTIFICATION = gql`
  mutation SendTestNotification($event_key: String!) {
    sendTestNotification(event_key: $event_key) {
      success
    }
  }
`

const SETTING_FIELDS = `
  sender_email
  sender_verified
  logo_url
  logo_width
  accent_color
  show_powered_by
  sms_enabled
  whatsapp_enabled
  telegram_enabled
  order_summary_frequency
  order_summary_hour
  order_summary_day
`

export const NOTIFICATION_SETTING = gql`
  query NotificationSetting {
    notificationSetting {
      success
      data { ${SETTING_FIELDS} }
    }
  }
`

export const UPDATE_NOTIFICATION_SETTING = gql`
  mutation UpdateNotificationSetting($input: UpdateNotificationSettingInput!) {
    updateNotificationSetting(input: $input) {
      success
      data { ${SETTING_FIELDS} }
    }
  }
`

export const SET_SENDER_EMAIL = gql`
  mutation SetSenderEmail($input: SetSenderEmailInput!) {
    setSenderEmail(input: $input) {
      success
      data { ${SETTING_FIELDS} }
    }
  }
`

export const RESEND_SENDER_VERIFICATION = gql`
  mutation ResendSenderVerification {
    resendSenderVerification {
      success
    }
  }
`

/** Consumes the one-shot token from the emailed sender-verification link. */
export const VERIFY_SENDER = gql`
  mutation VerifySender($token: String!) {
    verifySender(token: $token) {
      success
    }
  }
`

// ── Staff notifications (recipients) ─────────────────────────────────────────

const STAFF_RECIPIENT_FIELDS = `
  id
  email
  events
  enabled
`

export const STAFF_NOTIFICATION_RECIPIENTS = gql`
  query StaffNotificationRecipients {
    staffNotificationRecipients {
      success
      data { ${STAFF_RECIPIENT_FIELDS} }
    }
  }
`

export const ADD_STAFF_RECIPIENT = gql`
  mutation AddStaffNotificationRecipient($input: AddStaffRecipientInput!) {
    addStaffNotificationRecipient(input: $input) {
      success
      data { ${STAFF_RECIPIENT_FIELDS} }
    }
  }
`

export const UPDATE_STAFF_RECIPIENT = gql`
  mutation UpdateStaffNotificationRecipient(
    $input: UpdateStaffRecipientInput!
  ) {
    updateStaffNotificationRecipient(input: $input) {
      success
      data { ${STAFF_RECIPIENT_FIELDS} }
    }
  }
`

export const REMOVE_STAFF_RECIPIENT = gql`
  mutation RemoveStaffNotificationRecipient($id: String!) {
    removeStaffNotificationRecipient(id: $id) {
      success
    }
  }
`

export const SEND_TEST_STAFF_NOTIFICATION = gql`
  mutation SendTestStaffNotification {
    sendTestStaffNotification {
      success
    }
  }
`
