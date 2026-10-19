import { gql } from "@apollo/client"

/**
 * The vendor's WhatsApp assistant — the platform's own number, not the shop's.
 *
 * Two things about these operations are worth knowing before adding a third.
 *
 * **Both are shop-scoped, through `X-SHOP`.** They used to be account-scoped,
 * on the reasoning that a handset binds to an account rather than a store. The
 * reasoning was sound and the screen it fed was not: the only page that asks is
 * `/store/{slug}/settings/whatsapp`, so an account-wide answer put another
 * store's handset on this store's page — and a vendor who had just created a
 * store read it as "this store is connected". One handset serves one store now,
 * chosen by the scan that enrolled it.
 *
 * **There is no mutation that links a phone, and there must not be.** Enrolment
 * is not something this app asks for at all: the handset is bound by the
 * back-end when the vendor connects their shop's own WhatsApp, from the number
 * WhatsApp reported to the provider. A mutation accepting a number would let a
 * signed-in vendor bind somebody else's phone to their own account, and one
 * accepting none would have nothing to bind — the proof lives in the scan.
 */

/* No `active_shop_*` here: the query is scoped by `X-SHOP`, so both could only
 * repeat the store already being asked about. */
const LINK_FIELDS = `
  id
  phone_masked
  verified
  last_message_at
  created_at
`

export const GET_MY_VENDOR_BOT = gql`
  query MyVendorBot {
    myVendorBot {
      success
      data {
        available
        bot_number
        link {
          ${LINK_FIELDS}
        }
      }
    }
  }
`

/**
 * Disconnect this store's handset. **No argument** — the shop rides in
 * `X-SHOP` and the account in the token, so there is no id to pass or guess.
 */
export const UNLINK_VENDOR_BOT = gql`
  mutation UnlinkVendorBot {
    unlinkVendorBot {
      success
      data {
        available
        bot_number
        link {
          ${LINK_FIELDS}
        }
      }
    }
  }
`
