import { gql } from "@apollo/client"

/**
 * Two bots, two scopes, one screen.
 *
 * **The vendor assistant** — the platform's own bot, not the shop's. Those
 * operations are shop-scoped through `X-SHOP`, same as the customer bot's. They
 * used to be account-scoped, with the store chosen inside Telegram from buttons
 * listing every store the account owned; that put a sibling store's binding on
 * this store's settings page, where a vendor reads it as "this store is
 * connected", and it made the conversation itself a tenant selector. Connect
 * now names the store it was pressed on, and the token carries it.
 *
 * **There is no mutation that links a Telegram id, and there must not be.**
 * `connectTelegramBot` mints a one-time token and hands back a `t.me` link; the
 * identity is bound later, by the back-end, from the `/start` update Telegram
 * delivers when the vendor opens that link. A mutation accepting an id would
 * let a signed-in vendor bind somebody else's Telegram to their own account.
 *
 * The link is returned once and never queryable again — see the section for
 * why it lives in component state and nowhere else.
 *
 * **The shop's customer bot** is the opposite scope: every operation is
 * shop-scoped through `X-SHOP` and the ownership guard, and none takes a shop
 * id — the header is the only way to name the shop, so a vendor cannot attach
 * a bot to a store they do not own. The token crosses once, inbound, inside
 * `connectShopTelegramBot`; no operation returns it.
 */

/* No `active_shop_*`: the query is scoped by `X-SHOP`, so `linked` already
 * means "for this store" and both fields could only repeat it. */
const LINK_FIELDS = `
  linked
  telegram_username
  linked_at
  bot_username
`

export const GET_MY_TELEGRAM_BOT = gql`
  query MyTelegramBot {
    myTelegramBot {
      ${LINK_FIELDS}
    }
  }
`

export const CONNECT_TELEGRAM_BOT = gql`
  mutation ConnectTelegramBot {
    connectTelegramBot {
      url
      expires_in
    }
  }
`

export const DISCONNECT_TELEGRAM_BOT = gql`
  mutation DisconnectTelegramBot {
    disconnectTelegramBot
  }
`

const SHOP_BOT_FIELDS = `
  connected
  bot_username
  ai_enabled
  ai_orders_enabled
  status
  last_error
  last_ok_at
`

export const GET_MY_SHOP_TELEGRAM_BOT = gql`
  query MyShopTelegramBot {
    myShopTelegramBot {
      ${SHOP_BOT_FIELDS}
    }
  }
`

export const CONNECT_SHOP_TELEGRAM_BOT = gql`
  mutation ConnectShopTelegramBot($input: ConnectShopTelegramBotInput!) {
    connectShopTelegramBot(input: $input) {
      ${SHOP_BOT_FIELDS}
    }
  }
`

export const DISCONNECT_SHOP_TELEGRAM_BOT = gql`
  mutation DisconnectShopTelegramBot {
    disconnectShopTelegramBot
  }
`

export const SET_SHOP_TELEGRAM_CUSTOMER_BOT = gql`
  mutation SetShopTelegramCustomerBot($enabled: Boolean!) {
    setShopTelegramCustomerBot(enabled: $enabled) {
      ${SHOP_BOT_FIELDS}
    }
  }
`

/**
 * Whether the assistant on the shop's bot may take orders in the chat. Turning
 * it on also re-registers the bot's webhook (so the summary's confirm button
 * can be pressed), and fails with Telegram's words when that is refused.
 */
export const SET_SHOP_TELEGRAM_CUSTOMER_BOT_ORDERS = gql`
  mutation SetShopTelegramCustomerBotOrders($enabled: Boolean!) {
    setShopTelegramCustomerBotOrders(enabled: $enabled) {
      ${SHOP_BOT_FIELDS}
    }
  }
`

/**
 * Re-registers the shop bot's webhook from the token already sealed on the
 * server, so a webhook Telegram refused (a dead tunnel, a moved callback
 * origin) can be retried without the merchant pasting the token again. Takes
 * no argument for the same reason nothing here returns the token: it never
 * crosses twice.
 */
export const SYNC_SHOP_TELEGRAM_WEBHOOK = gql`
  mutation SyncShopTelegramWebhook {
    syncShopTelegramWebhook {
      ${SHOP_BOT_FIELDS}
    }
  }
`
