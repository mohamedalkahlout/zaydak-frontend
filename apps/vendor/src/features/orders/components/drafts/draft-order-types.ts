/** Shared draft-order form types (create + edit). */

export type LineDraft = {
  product_id: string
  variation_option_id: string | null
  name: string
  image: string | null
  unit_price_cents: number
  quantity: number
  /** Present only for locally-staged custom items (not a catalog product). */
  is_custom?: boolean
}

/**
 * Delivery address staged field-by-field. Same keys as the storefront's
 * addressSchema — the shipping-zone matcher reads country/state off the
 * order's shipping_address.
 */
export type DraftAddress = {
  street_address: string
  city: string
  state: string
  zip: string
  country: string
}

export const EMPTY_DRAFT_ADDRESS: DraftAddress = {
  street_address: "",
  city: "",
  state: "",
  zip: "",
  country: "",
}

export function readDraftAddress(
  raw?: Record<string, unknown> | null,
): DraftAddress {
  const pick = (key: string) =>
    typeof raw?.[key] === "string" ? (raw[key] as string) : ""
  return {
    street_address: pick("street_address"),
    city: pick("city"),
    state: pick("state"),
    zip: pick("zip"),
    country: pick("country"),
  }
}

export const addressIsEmpty = (a: DraftAddress) =>
  Object.values(a).every((v) => !v.trim())

export function contactAddressToDraft(addr: {
  address_1?: string | null
  city?: string | null
  region?: string | null
  postal_code?: string | null
  country?: string | null
} | null | undefined): DraftAddress {
  if (!addr) return { ...EMPTY_DRAFT_ADDRESS }
  return {
    street_address: addr.address_1?.trim() ?? "",
    city: addr.city?.trim() ?? "",
    state: addr.region?.trim() ?? "",
    zip: addr.postal_code?.trim() ?? "",
    country: addr.country?.trim() ?? "",
  }
}

export function currencyDisplayLabel(code: string, locale = "en"): string {
  try {
    const name =
      new Intl.DisplayNames([locale], { type: "currency" }).of(code) ?? code
    const symbol =
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: code,
        currencyDisplay: "narrowSymbol",
      })
        .formatToParts(0)
        .find((p) => p.type === "currency")?.value ?? ""
    return `${name} (${code}${symbol ? ` ${symbol}` : ""})`
  } catch {
    return code
  }
}
