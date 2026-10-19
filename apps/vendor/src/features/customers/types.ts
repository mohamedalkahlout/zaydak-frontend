import type { GraphQLResult, PaginationMeta } from "@/shared/types/api"

export type ContactStatus = "active" | "inactive"

export type TaxSetting = "collect" | "dont_collect" | "exempt"

export interface ContactOverallScore {
  seriousness_score?: number
  purchase_intent_score?: number
  budget_score?: number
  [key: string]: unknown
}

/**
 * Shopify-style extras stored on `Contact.meta`. The backend treats this
 * blob opaquely (GraphQLJSON) — we own the shape on the frontend so the
 * form, the list page, and the detail view all read/write the same keys.
 */
export interface ContactAddress {
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  region?: string | null
  country?: string | null
  postal_code?: string | null
  company?: string | null
}

export interface ContactMeta {
  first_name?: string | null
  last_name?: string | null
  /** Written on save; read `Contact.email` instead (see there). */
  email?: string | null
  language?: string | null
  accepts_marketing?: boolean
  accepts_sms_marketing?: boolean
  marketing_consent_updated_at?: string | null
  tags?: string[]
  default_address?: ContactAddress | null
  tax_setting?: TaxSetting
  [key: string]: unknown
}

export interface Contact {
  id: string
  name: string
  phone_number?: string | null
  /**
   * The `contacts.email` column: trimmed, lowercased, null for no address.
   * Read this, not `meta.email`. The back-end keeps the two in step (every
   * writer sets both), and a save still sends the address as `meta.email`,
   * which the server copies into the column.
   */
  email?: string | null
  notes?: string | null
  description?: string | null
  status: ContactStatus
  overall_score?: ContactOverallScore | null
  meta?: ContactMeta | null
  shop_id?: string | null
  /** The shop's customer (`customers.id`) this record is about, if any. */
  customer_id?: string | null
  created_at: string
  updated_at: string
}

export interface ContactsResponse {
  contacts: GraphQLResult<Contact[]> & { meta?: PaginationMeta }
}

export interface ContactResponse {
  contact: GraphQLResult<Contact>
}

export interface CreateContactResponse {
  createContact: GraphQLResult<Contact>
}

export interface UpdateContactResponse {
  updateContact: GraphQLResult<Contact>
}

export interface DeleteContactResponse {
  deleteContact: { success: boolean; message?: string | null }
}
