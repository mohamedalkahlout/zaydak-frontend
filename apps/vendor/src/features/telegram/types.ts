/**
 * What this store's settings screen knows about its Telegram binding.
 *
 * `telegram_username` is display only — which account is connected — and is
 * never what the back-end resolves a message by: a handle can be changed and,
 * once released, claimed by somebody else. The numeric Telegram id stays on the
 * server and is not exposed here at all.
 */
export interface TelegramVendorLink {
  /**
   * Whether a Telegram account is paired to **this store**.
   *
   * There is no `active_shop_id` beside it: the query is scoped by `X-SHOP`, so
   * the server has already answered "is this one mine?" and a screen
   * re-deriving it would be second-guessing a decision the server owns.
   */
  linked: boolean
  telegram_username: string | null
  linked_at: string | null
  /**
   * The bot to open, without the `@`.
   *
   * Null when the platform has no Telegram configured. That is not the
   * vendor's fault and not theirs to fix — the screen says so rather than
   * offering a Connect button that mints a link with nowhere to go.
   */
  bot_username: string | null
}

/** A freshly minted pairing link. Held in component state, never cached. */
export interface TelegramPairingLink {
  url: string
  expires_in: number
}

export interface TelegramVendorLinkResult {
  myTelegramBot: TelegramVendorLink
}

export interface ConnectTelegramBotResult {
  connectTelegramBot: TelegramPairingLink
}

export interface DisconnectTelegramBotResult {
  disconnectTelegramBot: boolean
}

/**
 * The shop's own customer bot, as the merchant sees it.
 *
 * **No token, masked or otherwise.** The back-end never returns it — the bot's
 * `@username` is what says which bot is connected — so there is nothing here
 * for a screen to seed an input with, and nothing a screenshot can leak.
 *
 * `status` and `last_error` together describe the one state a pill cannot: a
 * token Telegram accepted whose webhook it then refused. The row is kept so the
 * screen can say *why* (Telegram's own words) rather than "not connected".
 */
export interface ShopTelegramBot {
  connected: boolean
  bot_username: string | null
  /** Whether the customer assistant answers on this bot. */
  ai_enabled: boolean
  /** Whether that assistant may also take orders in the chat. */
  ai_orders_enabled: boolean
  status: "active" | "disconnected" | string
  last_error: string | null
  last_ok_at: string | null
}

export interface ShopTelegramBotResult {
  myShopTelegramBot: ShopTelegramBot
}

export interface ConnectShopTelegramBotResult {
  connectShopTelegramBot: ShopTelegramBot
}

export interface DisconnectShopTelegramBotResult {
  disconnectShopTelegramBot: boolean
}

export interface SetShopTelegramCustomerBotResult {
  setShopTelegramCustomerBot: ShopTelegramBot
}

export interface SetShopTelegramCustomerBotOrdersResult {
  setShopTelegramCustomerBotOrders: ShopTelegramBot
}

export interface SyncShopTelegramWebhookResult {
  syncShopTelegramWebhook: ShopTelegramBot
}
