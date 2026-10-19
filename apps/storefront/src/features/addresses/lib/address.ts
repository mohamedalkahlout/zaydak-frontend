import { z } from "zod"
import { normalizePhoneNumber } from "@/shared/lib/contact-validation"

/**
 * The address shape.
 *
 * `VerifyCheckoutInput.shipping_address` and `CreateOrderInput.shipping_address`
 * are both `JSON`, so the API imposes no shape at all — which means the shape is
 * a contract between this app and whatever reads the order later (the vendor's
 * order screen, the shipping-rule matcher, the invoice). Writing it down once,
 * here, is what keeps those three reading the same keys.
 *
 * The field names match the `AddressEntry.address` blob the vendor dashboard
 * already renders, so a saved address fills this form and an order placed from
 * it looks identical to one typed in.
 *
 * **The National Address code is now the only thing a customer types, and
 * everything else is derived from it.** The five free-text fields are still
 * here, still written into the blob and still read by everything downstream —
 * they are just filled from the registry rather than by hand.
 *
 * Two things forced that. A carrier prices on the destination CITY as a plain
 * string, so a typed "Jeddah" beside a code that resolves to Riyadh is two
 * answers to one question and the quote is priced for the wrong lane — which is
 * exactly what a real checkout was doing. And a courier finds the building from
 * the code, so the lines a customer types are the half that gets ignored at the
 * far end anyway.
 *
 * The cost is stated plainly: **only addresses in the Saudi registry can be
 * entered here.** That is a deliberate narrowing, not an oversight — it is the
 * The address can be entered via Saudi National Address short code (e.g. RGUC8214)
 * which resolves city, district, street and zip, OR via manual address entry
 * (Country, City, Street, etc.) for international shipments or customers without a short code.
 */

/** Four letters then four digits — the printed shape of the national address code. */
export const NATIONAL_ADDRESS_SHAPE = /^[A-Z]{4}\d{4}$/

const rawAddressSchema = z.object({
  /**
   * Saudi National Address short code — four letters then four digits.
   * Optional if entering an address manually.
   */
  national_address_code: z
    .string()
    .trim()
    .toUpperCase()
    .optional()
    .default(""),
  /**
   * Stable city code for CITY-match markets (e.g. `PS-GZA`). Shipping zones
   * match on this — free-text `city` is display only in those markets.
   */
  city_code: z.string().trim().toUpperCase().optional().default(""),
  /**
   * City and Country are required in both modes.
   */
  city: z.string().trim().min(1),
  country: z.string().trim().min(1),
  /**
   * Required when national_address_code is empty (manual mode).
   * Populated/optional when national_address_code is used.
   */
  street_address: z.string().trim().optional().default(""),
  state: z.string().trim().optional().default(""),
  zip: z.string().trim().optional().default(""),
  /**
   * Recipient delivery phone number (optional on general addresses,
   * but strictly validated as E.164 if provided).
   */
  phone: z.string().trim().optional(),
})

export const addressSchema = rawAddressSchema.superRefine((data, ctx) => {
  const country = data.country.trim().toUpperCase()
  const cityCode = (data.city_code ?? "").trim().toUpperCase()
  const national = (data.national_address_code ?? "").trim().toUpperCase()

  // Palestine (and any CITY-match destination that set city_code): require a
  // stable code rather than free-text city alone.
  if (country === "PS" || cityCode.startsWith("PS-")) {
    if (!cityCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "City is required",
        path: ["city_code"],
      })
    }
    const street = (data.street_address ?? "").trim()
    if (!street) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Street address is required",
        path: ["street_address"],
      })
    }
  } else if (national) {
    if (!NATIONAL_ADDRESS_SHAPE.test(national)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid national address code",
        path: ["national_address_code"],
      })
    }
  } else {
    const street = (data.street_address ?? "").trim()
    if (!street) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Street address is required when not using a national address code",
        path: ["street_address"],
      })
    }
  }

  const rawPhone = (data.phone ?? "").trim()
  if (rawPhone) {
    const normalized = normalizePhoneNumber(rawPhone)
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid phone number",
        path: ["phone"],
      })
    }
  }
})

export type Address = z.infer<typeof rawAddressSchema>

export const EMPTY_ADDRESS: Address = {
  national_address_code: "",
  city_code: "",
  street_address: "",
  city: "",
  state: "",
  zip: "",
  country: "",
}

export function isManualAddress(address: Address): boolean {
  return !address.national_address_code && Boolean(address.city || address.street_address)
}

/**
 * What `lookupNationalAddress` answers with, as the form consumes it.
 *
 * A subset of `ResolvedAddressEntry` — the fields that become address lines.
 * `formatted` is kept because it is the only thing shown back to the customer,
 * and it is the registry's own rendering rather than one we assemble.
 */
export interface ResolvedNationalAddress {
  city: string
  country: string
  formatted?: string | null
  street?: string | null
  district?: string | null
  building_number?: string | null
  postcode?: string | null
}

/**
 * Fill the derived fields from a registry answer.
 *
 * `street_address` is composed from the parts rather than taken from
 * `formatted`, which already contains the city, postcode and country — sending
 * that as a street line would hand the carrier the same facts twice, once in a
 * field meant for something else.
 */
export function applyNationalAddress(
  address: Address,
  resolved: ResolvedNationalAddress,
): Address {
  const street = [
    resolved.building_number,
    resolved.street,
    resolved.district,
  ]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(", ")

  return {
    ...address,
    city_code: "",
    city: resolved.city.trim(),
    country: resolved.country.trim(),
    // Never blank the street line when the registry omits every part: the
    // formatted line is worse than the parts and better than nothing, and a
    // carrier that ignores the code still needs somewhere to deliver.
    street_address: street || resolved.formatted?.trim() || "",
    state: "",
    zip: resolved.postcode?.trim() ?? "",
  }
}

/**
 * Drop everything the previous code resolved to.
 *
 * Called whenever the code itself changes. Without it a corrected code keeps
 * the old city until the new lookup returns — and if the new one resolves to
 * nothing, keeps it forever. That is the failure this form exists to prevent:
 * a destination city that does not belong to the address being shipped to.
 */
export function clearResolved(address: Address): Address {
  return {
    ...address,
    city_code: "",
    city: "",
    country: "",
    street_address: "",
    state: "",
    zip: "",
  }
}

/**
 * Read a saved `AddressEntry.address` blob into the form's shape.
 *
 * Tolerant on the way in: rows written before this app existed may carry
 * `street` or `address_line_1` instead of `street_address`, and dropping them
 * would show a customer an empty form beside an address they can see is saved.
 */
export function readAddress(raw: unknown): Address {
  if (typeof raw !== "object" || raw === null) return EMPTY_ADDRESS
  const record = raw as Record<string, unknown>
  const pick = (...keys: string[]): string => {
    for (const key of keys) {
      const value = record[key]
      if (typeof value === "string" && value.trim()) return value
    }
    return ""
  }

  return {
    street_address: pick("street_address", "street", "address_line_1", "address"),
    city_code: pick("city_code").toUpperCase(),
    city: pick("city", "town"),
    state: pick("state", "region", "province"),
    zip: pick("zip", "postal_code", "postcode"),
    country: pick("country", "country_code"),
    // Tolerant on the way in for the same reason as the fields above: this
    // JSON has no schema on the server, and rows written by a different path
    // may carry the carrier's own spelling.
    national_address_code: pick(
      "national_address_code",
      "short_address_code",
      "shortAddressCode",
    ).toUpperCase(),
    phone: pick("phone", "phone_number", "mobile", "tel"),
  }
}

/** True once the address has enough in it to price shipping against. */
export function isAddressComplete(address: Address): boolean {
  return addressSchema.safeParse(address).success
}

/**
 * The saved-address kinds the API accepts.
 *
 * `CreateAddressInput.type` is `@IsIn(['shipping', 'billing'])`, so anything
 * else is a 422 from the server rather than a row with an odd label.
 */
export const ADDRESS_TYPES = ["shipping", "billing"] as const
export type AddressType = (typeof ADDRESS_TYPES)[number]

export function isAddressType(value: unknown): value is AddressType {
  return (ADDRESS_TYPES as readonly unknown[]).includes(value)
}

/**
 * Render a saved address as the lines a card shows under its title.
 *
 * Empty fields are dropped rather than printed as blanks: `state` and `zip` are
 * optional on purpose (plenty of countries have neither), and a card with a
 * stray empty line reads as a half-saved address.
 */
export function formatAddressLines(address: Address): string[] {
  const locality = [address.city, address.state, address.zip]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ")

  return [
    address.street_address.trim(),
    locality,
    address.country.trim(),
    address.phone ? (normalizePhoneNumber(address.phone) ?? address.phone.trim()) : "",
  ].filter(Boolean)
}

/** The same address as one line — for a summary row or an `aria-label`. */
export function formatAddressOneLine(address: Address): string {
  return formatAddressLines(address).join(" · ")
}

/**
 * True when two addresses would ship to the same place.
 *
 * Compared field by field on trimmed values rather than by object identity,
 * because the checkout form holds its own copy of whichever saved address was
 * picked — identity is lost the moment the customer edits a character, which is
 * exactly when the selection has to stop looking selected.
 */
export function sameAddress(a: Address, b: Address): boolean {
  const keys = Object.keys(EMPTY_ADDRESS) as (keyof Address)[]
  // `?? ""` rather than a bare `.trim()`: these objects originate in a JSON
  // column with no schema, and a key added here later would otherwise make
  // this throw on every address saved before it existed.
  return (
    keys.every((key) => (a[key] ?? "").trim() === (b[key] ?? "").trim()) &&
    (a.phone ?? "").trim() === (b.phone ?? "").trim()
  )
}
