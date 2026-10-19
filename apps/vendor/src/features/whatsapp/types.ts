/** The three states the back-end narrows Evolution's vocabulary down to. */
export type WhatsAppStatus = "disconnected" | "connecting" | "connected"

export interface WhatsAppInstance {
  status: WhatsAppStatus
  /**
   * Masked at the API boundary (`97******99`), never the full number. The
   * vendor knows their own number; what this answers is *which* phone picked
   * up the scan.
   */
  phone_number: string | null
  last_connected_at: string | null
  disconnected_at: string | null
  last_error: string | null
  ai_enabled: boolean
  /** Whether that assistant may take orders in the chat. */
  ai_orders_enabled: boolean
}

export interface WhatsAppStatusResult {
  myWhatsAppInstance: {
    success: boolean
    data: {
      /**
       * Whether this *platform* can pair a phone at all — false when no
       * WhatsApp integration is enabled in the admin console. The vendor
       * cannot fix it, so the screen says so instead of offering a button.
       */
      available: boolean
      instance: WhatsAppInstance | null
    }
  }
}

/**
 * One pairing attempt.
 *
 * `qr_code` and `pairing_code` are shown once and dropped. Nothing here is
 * cached, written to a store, or logged.
 */
export interface WhatsAppHandshake {
  status: WhatsAppStatus
  /** Data-URL PNG. */
  qr_code: string | null
  /** Eight characters, typed into WhatsApp instead of scanning. */
  pairing_code: string | null
}

export interface ConnectWhatsAppResult {
  connectWhatsApp: { success: boolean; data: WhatsAppHandshake }
}

export interface PairingCodeResult {
  requestWhatsAppPairingCode: { success: boolean; data: WhatsAppHandshake }
}

export interface DisconnectWhatsAppResult {
  disconnectWhatsApp: { success: boolean; data: WhatsAppInstance }
}

export interface SetCustomerBotResult {
  setWhatsAppCustomerBot: { success: boolean; data: WhatsAppInstance }
}

export interface SetCustomerBotOrdersResult {
  setWhatsAppCustomerBotOrders: { success: boolean; data: WhatsAppInstance }
}

export interface WhatsAppQrTicketResult {
  whatsAppQrTicket: {
    success: boolean
    data: { ticket: string; expires_in: number }
  }
}

/** What arrives on the SSE stream. Mirrors `WhatsAppQrEvent` on the back-end. */
export type WhatsAppStreamEvent =
  | { type: "qr"; qr: string }
  | { type: "state"; state: WhatsAppStatus }
  | { type: "connected" }
  | { type: "error"; message: string }
  | { type: "ping" }
  | { type: "expired" }
