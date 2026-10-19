/**
 * What a notification points at. `entity_id` is that entity's route key.
 *
 * `plan` is the exception: the shop's plan page is keyed on the shop, so its
 * `entity_id` is a shop id and the route is built from the active slug instead.
 */
export type NotifyEntityType = "order" | "product" | "plan"

export interface NotifyLogEntry {
  id: string
  notify_type: string
  /** Already rendered by the back-end in the request's language. */
  notify_text?: string | null
  entity_type?: NotifyEntityType | string | null
  entity_id?: string | null
  is_read: boolean
  shop_id?: string | null
  created_at: string
}

export interface NotificationsResult {
  notifications: {
    success: boolean
    unread_count: number
    data: NotifyLogEntry[]
    meta: {
      total: number
      page: number
      limit: number
      total_pages: number
    }
  }
}

export interface MarkReadResult {
  markNotificationRead: { success: boolean }
}

export interface MarkAllReadResult {
  markAllNotificationsRead: { success: boolean }
}

export interface StreamTicketResult {
  notificationStreamTicket: {
    success: boolean
    ticket: string
    expires_in: number
  }
}

export interface MarkUnreadResult {
  markNotificationUnread: { success: boolean }
}

export interface DeleteNotificationResult {
  deleteNotification: { success: boolean }
}

/** Mirrors the back-end `NotifyType` enum (N13). */
export type NotifyTypeValue =
  | "ORDER"
  | "REFUND"
  | "PAYMENT"
  | "INVENTORY"
  | "REVIEW"
  | "STORE_NOTICE"
  | "MESSAGE"
  | "SYSTEM"
  | "BILLING"

export interface NotificationPreferenceEntry {
  notify_type: NotifyTypeValue
  in_app: boolean
  email: boolean
}

export interface NotificationPreferencesResult {
  notificationPreferences: {
    success: boolean
    data: NotificationPreferenceEntry[]
  }
}

export interface UpdatePreferenceResult {
  updateNotificationPreference: {
    success: boolean
    data: NotificationPreferenceEntry[]
  }
}

// ── Customer notification console ────────────────────────────────────────────

export type NotifyCategory =
  | "order_processing"
  | "order_exceptions"
  | "shipping_updates"
  | "returns"
  | "accounts"

export interface NotificationTemplateEntry {
  event_key: string
  category: NotifyCategory | string
  subject: string
  body: string
  enabled: boolean
  is_customized: boolean
  has_previous: boolean
}

export interface NotificationCatalogResult {
  notificationCatalog: { success: boolean; data: NotificationTemplateEntry[] }
}

export interface NotificationTemplateResult {
  notificationTemplate: {
    success: boolean
    data?: NotificationTemplateEntry | null
  }
}

export interface UpdateTemplateResult {
  updateNotificationTemplate: {
    success: boolean
    data?: NotificationTemplateEntry | null
  }
}

export interface RevertTemplateResult {
  revertNotificationTemplate: {
    success: boolean
    data?: NotificationTemplateEntry | null
  }
}

export interface PreviewTemplateResult {
  previewNotificationTemplate: {
    success: boolean
    subject: string
    html: string
  }
}

export interface NotificationSettingEntry {
  sender_email?: string | null
  sender_verified: boolean
  logo_url?: string | null
  logo_width: number
  accent_color: string
  show_powered_by: boolean
  sms_enabled: boolean
  whatsapp_enabled: boolean
  telegram_enabled: boolean
  order_summary_frequency: string
  order_summary_hour: number
  order_summary_day: number
}

export interface NotificationSettingResult {
  notificationSetting: { success: boolean; data: NotificationSettingEntry }
}

export interface UpdateSettingResult {
  updateNotificationSetting: {
    success: boolean
    data: NotificationSettingEntry
  }
}

export interface SetSenderEmailResult {
  setSenderEmail: { success: boolean; data: NotificationSettingEntry }
}

// ── Staff notifications ──────────────────────────────────────────────────────

export interface StaffRecipientEntry {
  id: string
  email: string
  events: string[]
  enabled: boolean
}

export interface StaffRecipientsResult {
  staffNotificationRecipients: {
    success: boolean
    data: StaffRecipientEntry[]
  }
}
