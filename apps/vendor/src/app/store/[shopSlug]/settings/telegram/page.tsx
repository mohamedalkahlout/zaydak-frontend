import { TelegramPane } from "@/features/settings"

/**
 * Settings → Telegram, at its own URL.
 *
 * A static sibling of `[section]`, like WhatsApp, and not preloaded on the
 * server: `myTelegramBot` asks Telegram for the bot's live handle on every
 * read, and the pairing link it mints is a one-time credential that must be
 * fetched by the click that will use it, never by a render.
 */
export default function SettingsTelegramPage() {
  return <TelegramPane />
}
