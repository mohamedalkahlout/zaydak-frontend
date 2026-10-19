/**
 * One handset bound to this account, serving this shop.
 *
 * `phone_masked` is masked at the API boundary and there is deliberately no
 * unmasked field beside it. The vendor knows their own numbers; what this
 * answers is *which* of their phones this row is, and `+97*******08` answers it
 * without putting a whole number into a screenshot pasted into a support chat.
 */
export interface VendorBotLink {
  id: string
  phone_masked: string | null
  /**
   * Always true for rows written today: enrolment happens in one step, on the
   * back of the shop's WhatsApp pairing, so there is no pending state to sit
   * in. Still read rather than assumed — rows predating that change exist.
   */
  verified: boolean
  last_message_at: string | null
  created_at: string
}

export interface VendorBotStatus {
  /**
   * Whether the platform has a connected assistant number at all.
   *
   * False is not the vendor's fault and not their problem to fix — it means an
   * admin has not paired the assistant, or it has dropped. The screen says so
   * rather than offering a button that mints a code with nowhere to send it.
   */
  available: boolean
  /** The number to message, in E.164. Null whenever the assistant is down. */
  bot_number: string | null
  /**
   * The handset enrolled **for this shop**, or null until its QR is scanned.
   *
   * Singular, not a list. A handset serves one store and a store is served by
   * one handset, so a list here could only ever be another store's business
   * shown on this store's page — which is what it was, and what made a
   * minute-old store report a connected assistant.
   *
   * Distinct from `available` in a way the card must keep distinct: that one is
   * platform-wide and true for every vendor the moment an admin pairs the
   * assistant number.
   */
  link: VendorBotLink | null
}

export interface VendorBotStatusResult {
  myVendorBot: {
    success: boolean
    data: VendorBotStatus | null
  }
}

export interface UnlinkVendorBotResult {
  unlinkVendorBot: {
    success: boolean
    data: VendorBotStatus | null
  }
}
