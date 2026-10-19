import { WhatsAppInboxPage } from "@/features/whatsapp-inbox"

/**
 * The shop's WhatsApp conversations.
 *
 * **Not server-preloaded**, unlike the customers table beside it. That list is
 * a catalogue and a stale first paint costs nothing; this is a conversation
 * somebody may be waiting in, and rendering it as of build time would show a
 * merchant an inbox that is quietly minutes old. The client query is
 * `cache-and-network` and polls, which is the honest shape for a screen whose
 * whole job is to be current.
 */
export default function WhatsAppInboxRoute() {
  return <WhatsAppInboxPage />
}
