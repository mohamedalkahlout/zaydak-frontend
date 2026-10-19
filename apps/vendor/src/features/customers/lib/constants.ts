import { CircleCheckIcon, CircleSlashIcon } from "lucide-react"
import type { FilterValueOption } from "@/shared/components/filter-bar"
import type { Translate } from "@/shared/i18n/translator"
import type { ContactStatus, TaxSetting } from "@/features/customers/types"
import { regionName } from "@/shared/lib/country-name"

export const PAGE_SIZE = 10

/**
 * Where a contact status's words live, as a key rather than the words.
 *
 * The English `Record` that used to sit here was read by the badge while the
 * filter menu held a second copy of the same two labels, so the two could drift
 * apart without anything failing. Both now resolve
 * `customers.status.<value>`.
 */
export const contactStatusKey = (status: ContactStatus | string) =>
  `status.${status}`

export const CONTACT_STATUS_STYLE: Record<ContactStatus, string> = {
  active: "bg-emerald-100 text-emerald-900",
  inactive: "bg-zinc-100 text-zinc-700",
}

/**
 * The two statuses the list filters by, each with the glyph its chip is drawn
 * with — and no label, which is a message key derived from the value.
 */
export const CONTACT_STATUS_OPTIONS: readonly FilterValueOption<ContactStatus>[] =
  [
    { value: "active", icon: CircleCheckIcon },
    { value: "inactive", icon: CircleSlashIcon },
  ]

/** Where a tax setting's words live: `customers.tax.options.<value>`. */
export const taxSettingKey = (setting: TaxSetting | string) =>
  `tax.options.${setting}`

/**
 * The languages a customer can be notified in (matches Shopify's "This
 * customer will receive notifications in this language." helper).
 *
 * Each is named in its own language — the dashboard's locale switcher does the
 * same, which is why `locale.json` spells "English" and "العربية" identically
 * in both catalogues — so the names are data, not copy. The one piece of copy
 * is the default marker, added by `customerLanguageOptions`.
 */
export const CUSTOMER_LANGUAGES: readonly {
  value: string
  name: string
  isDefault?: boolean
}[] = [
  { value: "en", name: "English", isDefault: true },
  { value: "ar", name: "العربية" },
]

/** The language picker's options, with the default marked in the active locale. */
export function customerLanguageOptions(
  t: Translate,
): { value: string; label: string }[] {
  return CUSTOMER_LANGUAGES.map(({ value, name, isDefault }) => ({
    value,
    label: isDefault ? t("overview.defaultLanguage", { language: name }) : name,
  }))
}

/**
 * The countries the address card offers, as ISO 3166 codes — the code is what
 * is stored. Their names come from `countryName`, in the active locale.
 */
export const COUNTRY_CODES: readonly string[] = [
  "SA",
  "AE",
  "EG",
  "JO",
  "KW",
  "BH",
  "QA",
  "OM",
  "PS",
  "LB",
  "SY",
  "IQ",
  "YE",
  "TR",
  "US",
  "GB",
]

/**
 * A country's name in `locale` (see `regionName`, which the coupon and
 * shipping-zone pickers read too). Anything that is not a region code — a
 * free-text country saved from elsewhere — comes back as it was.
 */
export function countryName(code: string, locale: string): string {
  return regionName(code, locale) ?? code
}
