import { WhatsAppPane } from "@/features/settings"

/**
 * Settings → WhatsApp, at its own URL.
 *
 * A static sibling of `[section]` rather than a placeholder, and deliberately
 * not preloaded on the server the way Plan is: `myWhatsAppInstance` reconciles
 * the row against the live Evolution server on every read, so a server render
 * would be reporting a connection state as of page-build time to a screen
 * whose whole job is to be current.
 */
export default function SettingsWhatsAppPage() {
  return <WhatsAppPane />
}
