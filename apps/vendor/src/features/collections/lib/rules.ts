import { centsToMajor, majorToCents } from "@/shared/lib/format"
import type {
  CollectionRuleCondition,
  CollectionRules,
  CollectionSource,
  ShopCollection,
} from "@/features/collections/types"
import type {
  CollectionFormInput,
  CollectionRuleField,
  CollectionRuleOperator,
  ConditionInput,
  ExclusionInput,
  SourceInput,
} from "@/features/collections/validations/shop-collection"

/**
 * The condition catalogue, and the two mappings around it: what the editor
 * shows, and how a source list becomes the `rules` JSON the API stores.
 *
 * The operator lists below are a subset of what the back-end whitelists.
 * `IN` / `NOT_IN` are deliberately not offered: a condition already holds
 * several OR-ed values, and the compiler treats "EQ with two values" and
 * "IN [a, b]" identically — so one spelling in the UI, and `rulesToForm`
 * folds the legacy one into it on load.
 */
export const CONDITION_FIELDS: CollectionRuleField[] = [
  "title",
  "system_category_id",
  "product_type",
  "brand",
  "tag",
  "status",
  "sale_type",
  "price_cents",
  "sale_price_cents",
  "inventory_quantity",
  "weight_grams",
  "attribute",
]

const TEXT_OPERATORS: CollectionRuleOperator[] = [
  "EQ",
  "NE",
  "CONTAINS",
  "NOT_CONTAINS",
  "STARTS_WITH",
  "ENDS_WITH",
]

const NUMBER_OPERATORS: CollectionRuleOperator[] = [
  "EQ",
  "NE",
  "GT",
  "GTE",
  "LT",
  "LTE",
  "BETWEEN",
]

export const OPERATORS_BY_FIELD: Record<
  CollectionRuleField,
  CollectionRuleOperator[]
> = {
  title: TEXT_OPERATORS,
  system_category_id: ["DESCENDANT_OF", "EQ", "NE", "IS_SET", "IS_NOT_SET"],
  product_type: ["EQ", "NE"],
  brand: [...TEXT_OPERATORS, "IS_SET", "IS_NOT_SET"],
  tag: ["CONTAINS", "NOT_CONTAINS", "EQ", "NE"],
  status: ["EQ", "NE"],
  sale_type: ["EQ", "NE"],
  price_cents: NUMBER_OPERATORS,
  sale_price_cents: [...NUMBER_OPERATORS, "IS_SET", "IS_NOT_SET"],
  inventory_quantity: NUMBER_OPERATORS,
  weight_grams: NUMBER_OPERATORS,
  attribute: ["EQ", "NE", "GT", "GTE", "LT", "LTE", "BETWEEN"],
}

/** Which fields an exclusion may use. Mirrors Shopify: identity, not value. */
export const EXCLUSION_FIELDS: CollectionRuleField[] = [
  "system_category_id",
  "tag",
  "product_type",
  "brand",
  "status",
]

export const ENUM_VALUES: Partial<Record<CollectionRuleField, string[]>> = {
  status: ["DRAFT", "PUBLISH", "UNLISTED"],
  sale_type: ["FIXED_PRICE", "NEGOTIABLE", "AUCTION"],
  product_type: ["SIMPLE", "VARIABLE", "DIGITAL", "SERVICE"],
}

/** Fields stored as integer cents — the input takes major units. */
export const MONEY_FIELDS: CollectionRuleField[] = [
  "price_cents",
  "sale_price_cents",
]

const NUMERIC_FIELDS: CollectionRuleField[] = [
  ...MONEY_FIELDS,
  "inventory_quantity",
  "weight_grams",
]

export type ValueKind =
  | "none"
  | "text"
  | "number"
  | "money"
  | "enum"
  | "category"
  | "range"

export function isPresenceOperator(operator: CollectionRuleOperator): boolean {
  return operator === "IS_SET" || operator === "IS_NOT_SET"
}

export function valueKindOf(
  field: CollectionRuleField,
  operator: CollectionRuleOperator,
): ValueKind {
  if (isPresenceOperator(operator)) return "none"
  if (operator === "BETWEEN") return "range"
  if (field === "system_category_id") return "category"
  if (ENUM_VALUES[field]) return "enum"
  if (MONEY_FIELDS.includes(field)) return "money"
  if (NUMERIC_FIELDS.includes(field)) return "number"
  return "text"
}

/** Only a value the vendor can meaningfully repeat gets an OR chain. */
export function allowsMultipleValues(
  field: CollectionRuleField,
  operator: CollectionRuleOperator,
): boolean {
  const kind = valueKindOf(field, operator)
  return kind === "text" || kind === "enum" || kind === "category"
}

export function isNumericField(field: CollectionRuleField): boolean {
  return NUMERIC_FIELDS.includes(field)
}

export function defaultOperator(
  field: CollectionRuleField,
): CollectionRuleOperator {
  return OPERATORS_BY_FIELD[field][0]
}

// ─── Builders ─────────────────────────────────────────────────────────────

let sourceSeq = 0

/** Ids only have to be unique inside one rule set; a counter does that. */
export function nextSourceId(): string {
  sourceSeq += 1
  return `source-${Date.now().toString(36)}-${sourceSeq}`
}

export function newCondition(
  field: CollectionRuleField = "title",
): ConditionInput {
  return {
    field,
    operator: defaultOperator(field),
    values: [""],
    attribute_key: "",
  }
}

export function emptyExclusion(): ExclusionInput {
  return { match: "ANY", conditions: [], product_ids: [], collection_ids: [] }
}

export function newSource(id?: string): SourceInput {
  return {
    id: id ?? nextSourceId(),
    kind: "PRODUCTS",
    match: "ALL",
    conditions: [],
    collection_ids: [],
    exclude: emptyExclusion(),
  }
}

/** True when a source would contribute nothing — used to gate the preview. */
export function sourceIsEmpty(source: SourceInput): boolean {
  return source.kind === "COLLECTIONS"
    ? source.collection_ids.length === 0
    : source.conditions.length === 0
}

// ─── Wire <-> form ────────────────────────────────────────────────────────

const asString = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value)

function conditionToForm(condition: CollectionRuleCondition): ConditionInput {
  // Legacy `IN` / `NOT_IN` fold into the multi-value spelling of EQ / NE, and
  // a list that arrived as a single nested array is flattened with them.
  const operator: CollectionRuleOperator =
    condition.operator === "IN"
      ? "EQ"
      : condition.operator === "NOT_IN"
        ? "NE"
        : condition.operator
  const raw =
    condition.values.length === 1 && Array.isArray(condition.values[0])
      ? (condition.values[0] as unknown[])
      : condition.values

  const money = MONEY_FIELDS.includes(condition.field)
  const toValue = (v: unknown) =>
    money ? asString(centsToMajor(Number(v))) : asString(v)

  if (operator === "BETWEEN") {
    const pair = Array.isArray(raw[0]) ? (raw[0] as unknown[]) : raw
    return {
      field: condition.field,
      operator,
      values: [toValue(pair[0]), toValue(pair[1])],
      attribute_key: condition.attribute_key ?? "",
    }
  }

  return {
    field: condition.field,
    operator,
    values: isPresenceOperator(operator) ? [] : raw.map(toValue),
    attribute_key: condition.attribute_key ?? "",
  }
}

function conditionToWire(
  condition: ConditionInput,
): CollectionRuleCondition | null {
  const money = MONEY_FIELDS.includes(condition.field)
  const numeric = isNumericField(condition.field)
  const cast = (v: string): string | number =>
    money ? majorToCents(Number(v)) : numeric ? Number(v) : v.trim()

  const base = {
    field: condition.field,
    operator: condition.operator,
    ...(condition.field === "attribute" && condition.attribute_key
      ? { attribute_key: condition.attribute_key.trim() }
      : {}),
  }

  if (isPresenceOperator(condition.operator)) {
    return { ...base, values: [] }
  }

  const filled = condition.values.filter((v) => v.trim() !== "")
  if (condition.operator === "BETWEEN") {
    if (filled.length < 2) return null
    return { ...base, values: [[cast(filled[0]), cast(filled[1])]] }
  }
  if (filled.length === 0) return null
  return { ...base, values: filled.map(cast) }
}

function exclusionToWire(exclusion: ExclusionInput) {
  return {
    match: exclusion.match,
    conditions: exclusion.conditions
      .map(conditionToWire)
      .filter((c): c is CollectionRuleCondition => c !== null),
    product_ids: exclusion.product_ids,
    collection_ids: exclusion.collection_ids,
  }
}

/** The `rules` JSON the API stores, built from the editor's source list. */
export function formToRules(sources: SourceInput[]): CollectionRules {
  return {
    version: 2,
    sources: sources.map((source) => ({
      id: source.id,
      kind: source.kind,
      match: source.match,
      conditions:
        source.kind === "COLLECTIONS"
          ? []
          : source.conditions
              .map(conditionToWire)
              .filter((c): c is CollectionRuleCondition => c !== null),
      collection_ids:
        source.kind === "COLLECTIONS" ? source.collection_ids : [],
      exclude: exclusionToWire(source.exclude),
    })),
  }
}

function sourceToForm(source: CollectionSource, index: number): SourceInput {
  return {
    id: source.id || `source-${index + 1}`,
    kind: source.kind,
    match: source.match,
    conditions: (source.conditions ?? []).map(conditionToForm),
    collection_ids: source.collection_ids ?? [],
    exclude: {
      match: source.exclude?.match ?? "ANY",
      conditions: (source.exclude?.conditions ?? []).map(conditionToForm),
      product_ids: source.exclude?.product_ids ?? [],
      collection_ids: source.exclude?.collection_ids ?? [],
    },
  }
}

export function rulesToForm(rules?: CollectionRules | null): SourceInput[] {
  const sources = rules?.sources ?? []
  return sources.length ? sources.map(sourceToForm) : [newSource("source-1")]
}

// ─── Whole-form mapping ───────────────────────────────────────────────────

const text = (value?: { en?: string | null; ar?: string | null } | null) => ({
  en: value?.en ?? "",
  ar: value?.ar ?? "",
})

/**
 * The form's `{ en, ar }` fields: a handoff prefill merges these per locale
 * (`@/shared/lib/merge-prefill`), so a name the assistant gave in one
 * language cannot blank the other.
 */
export const COLLECTION_TRANSLATABLE_FIELDS = [
  "name",
  "description",
  "seo_title",
  "seo_description",
] as const

/** Defaults for a fresh "Add collection" screen. */
export function collectionFormDefaults(): CollectionFormInput {
  return {
    name: { en: "", ar: "" },
    description: { en: "", ar: "" },
    seo_title: { en: "", ar: "" },
    seo_description: { en: "", ar: "" },
    slug: "",
    sort: "MOST_RELEVANT",
    sort_order: 0,
    is_published: true,
    image_url: "",
    image_alt: "",
    sources: [newSource("source-1")],
    product_ids: [],
  }
}

/** The saved collection, as the form renders it. */
export function collectionToForm(
  collection: ShopCollection,
  pinnedProductIds: string[],
): CollectionFormInput {
  return {
    name: text(collection.name),
    description: text(collection.description),
    seo_title: text(collection.seo_title),
    seo_description: text(collection.seo_description),
    slug: collection.slug,
    sort: collection.sort,
    sort_order: collection.sort_order,
    is_published: collection.is_published,
    image_url: collection.image?.url ?? "",
    image_alt: collection.image?.alt ?? "",
    sources: rulesToForm(collection.rules),
    product_ids: pinnedProductIds,
  }
}

const trimmed = (value: { en?: string; ar?: string }) => {
  const out: Record<string, string> = {}
  if (value.en?.trim()) out.en = value.en.trim()
  if (value.ar?.trim()) out.ar = value.ar.trim()
  return out
}

/** The mutation payload. Empty translatables are dropped, not sent as "". */
export function formToInput(
  data: CollectionFormInput,
): Record<string, unknown> {
  const description = trimmed(data.description)
  const seoTitle = trimmed(data.seo_title)
  const seoDescription = trimmed(data.seo_description)
  const imageUrl = data.image_url?.trim()

  const slug = data.slug.trim();

  return {
    name: trimmed(data.name),
    ...(slug ? { slug } : {}),
    sort: data.sort,
    sort_order: data.sort_order ?? 0,
    is_published: data.is_published,
    rules: formToRules(data.sources),
    product_ids: data.product_ids,
    ...(Object.keys(description).length ? { description } : {}),
    ...(Object.keys(seoTitle).length ? { seo_title: seoTitle } : {}),
    ...(Object.keys(seoDescription).length
      ? { seo_description: seoDescription }
      : {}),
    ...(imageUrl
      ? {
          image: {
            url: imageUrl,
            ...(data.image_alt?.trim() ? { alt: data.image_alt.trim() } : {}),
          },
        }
      : {}),
  }
}

/** A URL-safe handle from whatever the vendor typed as the title. */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}
