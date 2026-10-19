import type {
  Contact,
  ContactAddress,
  ContactMeta,
  ContactOverallScore,
  TaxSetting,
} from "@/features/customers/types"
import type { CustomerFormOutput } from "@/features/customers/validations/customer"

export function customerInitials(name?: string | null): string {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  const first = parts[0][0] ?? ""
  const second = parts[1]?.[0] ?? ""
  return (first + second).toUpperCase() || "?"
}

/**
 * Average of the three documented overall_score fields, normalized to a
 * 0..100 percentage. Returns null when no scores are present.
 */
export function averageScore(
  score?: ContactOverallScore | null,
): number | null {
  if (!score) return null
  const values = [
    score.seriousness_score,
    score.purchase_intent_score,
    score.budget_score,
  ].filter((v): v is number => typeof v === "number")
  if (values.length === 0) return null
  const avg = values.reduce((s, v) => s + v, 0) / values.length
  return Math.round(avg * 100)
}

/** Whether this contact is one of the shop's customers (a proven number). */
export function hasLinkedCustomer(contact: Contact): boolean {
  return (
    typeof contact.customer_id === "string" && contact.customer_id.length > 0
  )
}

// ─── name <-> first/last helpers ──────────────────────────────────────────

export function splitName(name: string | null | undefined): {
  first_name: string
  last_name: string
} {
  if (!name) return { first_name: "", last_name: "" }
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first_name: "", last_name: "" }
  if (parts.length === 1) return { first_name: parts[0], last_name: "" }
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  }
}

export function composeName(
  first?: string | null,
  last?: string | null,
  fallback?: string | null,
): string {
  const f = (first ?? "").trim()
  const l = (last ?? "").trim()
  const composed = [f, l].filter(Boolean).join(" ")
  if (composed) return composed
  return (fallback ?? "").trim()
}

// ─── meta read helpers ────────────────────────────────────────────────────

export function readMeta(contact: Contact | null | undefined): ContactMeta {
  return (contact?.meta ?? {}) as ContactMeta
}

/**
 * The `email` column, not `meta.email`: the column is what the server
 * searches, segments and exports on, so it is what the merchant should see.
 */
export function contactEmail(contact: Contact): string | null {
  return contact.email ?? null
}

export function contactLanguage(contact: Contact): string | null {
  return readMeta(contact).language ?? null
}

export function contactTags(contact: Contact): string[] {
  const t = readMeta(contact).tags
  return Array.isArray(t) ? t : []
}

export function contactAddress(contact: Contact): ContactAddress | null {
  return readMeta(contact).default_address ?? null
}

export function contactAcceptsMarketing(contact: Contact): boolean {
  return readMeta(contact).accepts_marketing === true
}

export function contactAcceptsSmsMarketing(contact: Contact): boolean {
  return readMeta(contact).accepts_sms_marketing === true
}

export function contactTaxSetting(contact: Contact): TaxSetting {
  const s = readMeta(contact).tax_setting
  return s === "dont_collect" || s === "exempt" ? s : "collect"
}

export function formatAddressLines(
  addr: ContactAddress | null | undefined,
): string[] {
  if (!addr) return []
  const lines: string[] = []
  const line1 = [addr.address_1, addr.address_2].filter(Boolean).join(", ")
  if (line1) lines.push(line1)
  const line2 = [addr.city, addr.region, addr.postal_code]
    .filter(Boolean)
    .join(", ")
  if (line2) lines.push(line2)
  if (addr.country) lines.push(addr.country)
  if (addr.company) lines.unshift(addr.company)
  return lines
}

export function formatLocation(
  addr: ContactAddress | null | undefined,
): string {
  if (!addr) return ""
  const parts = [addr.city, addr.region, addr.country].filter(Boolean)
  return parts.join(", ")
}

// ─── form <-> mutation input ──────────────────────────────────────────────

/**
 * Build the GraphQL input for createContact / updateContact from validated
 * form values. The Contact backend only has a single `name` field plus a
 * JSON `meta` blob — we compose `name` from first/last and pack the rest
 * into meta so the rendered profile stays Shopify-shaped.
 */
export function buildContactMutationInput(
  values: CustomerFormOutput,
  prevMeta?: ContactMeta | null,
): {
  name: string
  phone_number: string | null
  description: string | null
  notes: string | null
  status: "active" | "inactive"
  meta: ContactMeta
} {
  const meta: ContactMeta = {
    ...(prevMeta ?? {}),
    first_name: values.first_name?.trim() || null,
    last_name: values.last_name?.trim() || null,
    email: values.email?.trim() || null,
    language: values.language?.trim() || null,
    accepts_marketing: values.accepts_marketing,
    accepts_sms_marketing: values.accepts_sms_marketing,
    tags: values.tags ?? [],
    tax_setting: values.tax_setting,
  }

  // Address: only persist when at least one field is set so we don't
  // leak empty objects into meta.
  const a = values.address
  if (
    a &&
    Object.values(a).some((v) => typeof v === "string" && v.trim() !== "")
  ) {
    meta.default_address = {
      address_1: a.address_1?.trim() || null,
      address_2: a.address_2?.trim() || null,
      city: a.city?.trim() || null,
      region: a.region?.trim() || null,
      country: a.country?.trim() || null,
      postal_code: a.postal_code?.trim() || null,
      company: a.company?.trim() || null,
    }
  } else {
    meta.default_address = null
  }

  // Marketing consent timestamp tracks the moment any consent toggle
  // changes — matches Shopify's audit trail expectations.
  const prevAccepts = prevMeta?.accepts_marketing === true
  const prevAcceptsSms = prevMeta?.accepts_sms_marketing === true
  if (
    meta.accepts_marketing !== prevAccepts ||
    meta.accepts_sms_marketing !== prevAcceptsSms
  ) {
    meta.marketing_consent_updated_at = new Date().toISOString()
  }

  const composed = composeName(values.first_name, values.last_name)
  const fallback =
    values.email?.trim() ||
    values.phone_number?.trim() ||
    "Unnamed customer"
  return {
    name: composed || fallback,
    phone_number: values.phone_number?.trim() || null,
    description: values.description?.trim() || null,
    notes: values.notes?.trim() || null,
    status: values.status,
    meta,
  }
}

/**
 * Build form defaults from an existing Contact for the edit flow.
 */
export function contactToFormValues(
  contact: Contact,
): CustomerFormOutput {
  const meta = readMeta(contact)
  const split = splitName(contact.name)
  return {
    first_name: meta.first_name ?? split.first_name,
    last_name: meta.last_name ?? split.last_name,
    email: contactEmail(contact) ?? "",
    phone_number: contact.phone_number ?? "",
    language: meta.language ?? "",
    accepts_marketing: meta.accepts_marketing === true,
    accepts_sms_marketing: meta.accepts_sms_marketing === true,
    address: {
      address_1: meta.default_address?.address_1 ?? "",
      address_2: meta.default_address?.address_2 ?? "",
      city: meta.default_address?.city ?? "",
      region: meta.default_address?.region ?? "",
      country: meta.default_address?.country ?? "",
      postal_code: meta.default_address?.postal_code ?? "",
      company: meta.default_address?.company ?? "",
    },
    tax_setting: contactTaxSetting(contact),
    tags: contactTags(contact),
    description: contact.description ?? "",
    notes: contact.notes ?? "",
    status: contact.status,
  }
}
