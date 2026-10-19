/**
 * Settings → Telegram: the Zaydak assistant, reached from the vendor's own
 * Telegram account.
 *
 * Its own feature rather than a card inside `whatsapp/`, for the reason
 * `vendor-bot/` gives: everything here is account-scoped and carries no
 * `X-SHOP` meaning, which must not blur into a feature where everything else
 * is shop-scoped.
 */
export { TelegramSection } from "./components/telegram-section"
export * from "./api"
export * from "./types"
