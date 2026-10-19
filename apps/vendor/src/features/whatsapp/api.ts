import { gql } from "@apollo/client"

/**
 * The vendor's WhatsApp channel.
 *
 * Every operation is `MANAGE_OWN_SHOP` + `X-SHOP` + `ShopOwnershipGuard`, so
 * the shop is settled by the header and never by an argument — which matters
 * more here than elsewhere, because what is behind these mutations is a code
 * that links a real WhatsApp account.
 *
 * There is no query that returns a QR, and that is deliberate rather than an
 * omission. The code is a live credential and it rotates every twenty to sixty
 * seconds, so it travels on exactly two paths: the reply to the connect
 * mutation that asked for it, and the SSE stream. Nothing that a cache, a
 * refetch or a devtools panel can hold on to.
 */

const INSTANCE_FIELDS = `
  status
  phone_number
  last_connected_at
  disconnected_at
  last_error
  ai_enabled
  ai_orders_enabled
`

export const GET_MY_WHATSAPP_INSTANCE = gql`
  query MyWhatsAppInstance {
    myWhatsAppInstance {
      success
      data {
        available
        instance {
          ${INSTANCE_FIELDS}
        }
      }
    }
  }
`

export const CONNECT_WHATSAPP = gql`
  mutation ConnectWhatsApp {
    connectWhatsApp {
      success
      data {
        status
        qr_code
        pairing_code
      }
    }
  }
`

export const REQUEST_WHATSAPP_PAIRING_CODE = gql`
  mutation RequestWhatsAppPairingCode($input: RequestWhatsAppPairingCodeInput!) {
    requestWhatsAppPairingCode(input: $input) {
      success
      data {
        status
        qr_code
        pairing_code
      }
    }
  }
`

export const DISCONNECT_WHATSAPP = gql`
  mutation DisconnectWhatsApp {
    disconnectWhatsApp {
      success
      data {
        ${INSTANCE_FIELDS}
      }
    }
  }
`

/**
 * Handshake for the QR stream. `EventSource` cannot send an Authorization
 * header, so the Bearer token is spent here for a one-shot, claim-less ticket
 * that is safe to put in the stream URL — the same trade the notification bell
 * makes, except this ticket names the shop rather than the user.
 */
export const WHATSAPP_QR_TICKET = gql`
  mutation WhatsAppQrTicket {
    whatsAppQrTicket {
      success
      data {
        ticket
        expires_in
      }
    }
  }
`

/**
 * The customer-facing AI answering, on or off.
 *
 * A mutation of its own rather than a field on a settings form, because it is
 * the only control on this screen that changes what a *customer* experiences.
 * It returns the whole instance so the card settles on the server's answer
 * rather than on the value the switch was moved to — an optimistic flip that
 * the write then failed is a merchant believing an assistant is off when it is
 * answering.
 */
export const SET_WHATSAPP_CUSTOMER_BOT = gql`
  mutation SetWhatsAppCustomerBot($enabled: Boolean!) {
    setWhatsAppCustomerBot(enabled: $enabled) {
      success
      data {
        ${INSTANCE_FIELDS}
      }
    }
  }
`

/**
 * Whether the assistant may also take orders in the chat.
 *
 * Its own mutation for the reason the assistant switch has one — it changes
 * what a customer experiences — and it too returns the whole instance, so the
 * switch settles on the server's answer. Turning it on is refused on a plan
 * without `ai.agent.checkout`; turning it off never is.
 */
export const SET_WHATSAPP_CUSTOMER_BOT_ORDERS = gql`
  mutation SetWhatsAppCustomerBotOrders($enabled: Boolean!) {
    setWhatsAppCustomerBotOrders(enabled: $enabled) {
      success
      data {
        ${INSTANCE_FIELDS}
      }
    }
  }
`

/**
 * Send one real message from the shop's number.
 *
 * The point of the button is that it takes the **production path** — the
 * queue, the worker, the session check — rather than a direct send that would
 * pass while all of those were broken. So it answers "queued", not "sent":
 * a worker attempts the delivery after this mutation has already returned.
 */
export const SEND_WHATSAPP_TEST = gql`
  mutation SendWhatsAppTest($input: SendWhatsAppTestInput!) {
    sendWhatsAppTest(input: $input) {
      success
      message
    }
  }
`
