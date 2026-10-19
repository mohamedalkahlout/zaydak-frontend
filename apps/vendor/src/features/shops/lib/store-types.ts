/**
 * The store types, as **stored** values. They are sent to the server as the
 * new shop's description, so they stay English whatever the interface language
 * is; only the label is translated.
 *
 * Shared by `/create-store` and the last pane of `/register`, which ask the
 * same question.
 */
export const STORE_TYPES = [
  "Sell online",
  "Sell in-store",
  "Dropshipping",
  "Sell digital products",
  "Move existing store",
] as const

export type StoreType = (typeof STORE_TYPES)[number]

export const STORE_TYPE_LABEL_KEYS: Record<StoreType, string> = {
  "Sell online": "types.sellOnline",
  "Sell in-store": "types.sellInStore",
  Dropshipping: "types.dropshipping",
  "Sell digital products": "types.sellDigital",
  "Move existing store": "types.moveExisting",
}
