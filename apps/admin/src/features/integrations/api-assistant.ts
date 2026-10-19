import { gql } from "@/shared/api/generated"

/**
 * The vendor assistant's own WhatsApp number.
 *
 * Kept out of `api.ts` because it is a different kind of object. That file is
 * `integration_configs` CRUD — one row per type, holding a third party's
 * credentials, all of it expressible as a form. This is a *session*: a phone
 * account paired by scanning a QR, which no amount of form-filling produces.
 *
 * Both live on the same screen because an admin thinks of them as one thing,
 * and because the session is useless without the credentials above it — the
 * Evolution server has to be configured before there is anywhere to pair
 * against.
 *
 * Every operation is gated on `manage_integrations` alone. That is what makes
 * them genuinely admin-only: `PermissionsGuard` matches with `.some()`, so a
 * second permission beside it would open them to any vendor holding that one.
 */

export const GET_PLATFORM_WHATSAPP = gql(`
  query PlatformWhatsApp {
    platformWhatsApp {
      success
      data {
        id
        instance_name
        phone_masked
        status
        last_connected_at
        disconnected_at
        last_error
        linked_vendors
      }
    }
  }
`)

/**
 * Start pairing, and return the first QR.
 *
 * The code is a live credential: whoever scans it links their own device to the
 * platform's assistant account. It is rendered once from this response and
 * never cached, stored or logged — every later code arrives on the stream.
 */
export const CONNECT_PLATFORM_WHATSAPP = gql(`
  mutation ConnectPlatformWhatsApp {
    connectPlatformWhatsApp {
      success
      data {
        state
        qr_code
        pairing_code
      }
    }
  }
`)

export const DISCONNECT_PLATFORM_WHATSAPP = gql(`
  mutation DisconnectPlatformWhatsApp {
    disconnectPlatformWhatsApp {
      success
      data {
        status
        phone_masked
        linked_vendors
      }
    }
  }
`)

export const SYNC_PLATFORM_WHATSAPP_WEBHOOK = gql(`
  mutation SyncPlatformWhatsAppWebhook {
    syncPlatformWhatsAppWebhook {
      success
      message
      data {
        status
      }
    }
  }
`)

/** The one-shot ticket the pairing stream is opened with. */
export const PLATFORM_WHATSAPP_QR_TICKET = gql(`
  mutation PlatformWhatsAppQrTicket {
    platformWhatsAppQrTicket {
      success
      data {
        ticket
        ttl_seconds
      }
    }
  }
`)
