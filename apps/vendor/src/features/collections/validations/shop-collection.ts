import { z } from "zod"
import type { UseFormReturn } from "react-hook-form"
import type { Translate } from "@/shared/i18n/translator"

/**
 * The collection editor's form shape. It mirrors the API's rules v2 one for
 * one — sources holding conditions, each condition holding the values it
 * OR-s together — so saving is a coercion pass and not a translation layer.
 * Values stay strings while they are being typed; `formToRules` casts them.
 */
export const collectionRuleFieldSchema = z.enum([
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
])
export type CollectionRuleField = z.infer<typeof collectionRuleFieldSchema>

export const collectionRuleOperatorSchema = z.enum([
  "EQ",
  "NE",
  "GT",
  "GTE",
  "LT",
  "LTE",
  "BETWEEN",
  "IN",
  "NOT_IN",
  "CONTAINS",
  "NOT_CONTAINS",
  "STARTS_WITH",
  "ENDS_WITH",
  "IS_SET",
  "IS_NOT_SET",
  "DESCENDANT_OF",
])
export type CollectionRuleOperator = z.infer<
  typeof collectionRuleOperatorSchema
>

export const collectionRuleMatchSchema = z.enum(["ALL", "ANY"])
export type CollectionRuleMatch = z.infer<typeof collectionRuleMatchSchema>

export const collectionSourceKindSchema = z.enum(["PRODUCTS", "COLLECTIONS"])
export type CollectionSourceKind = z.infer<typeof collectionSourceKindSchema>

export const collectionSortSchema = z.enum([
  "MOST_RELEVANT",
  "BEST_SELLING",
  "TITLE_ASC",
  "TITLE_DESC",
  "PRICE_ASC",
  "PRICE_DESC",
  "CREATED_DESC",
  "CREATED_ASC",
  "MANUAL",
])
export type CollectionSort = z.infer<typeof collectionSortSchema>

export const conditionSchema = z.object({
  field: collectionRuleFieldSchema,
  operator: collectionRuleOperatorSchema,
  /** One entry per OR-ed alternative. BETWEEN holds exactly [min, max]. */
  values: z.array(z.string()),
  attribute_key: z.string().optional().or(z.literal("")),
})
export type ConditionInput = z.infer<typeof conditionSchema>

export const exclusionSchema = z.object({
  match: collectionRuleMatchSchema,
  conditions: z.array(conditionSchema),
  product_ids: z.array(z.string()),
  collection_ids: z.array(z.string()),
})
export type ExclusionInput = z.infer<typeof exclusionSchema>

export const sourceSchema = z.object({
  id: z.string(),
  kind: collectionSourceKindSchema,
  match: collectionRuleMatchSchema,
  conditions: z.array(conditionSchema),
  collection_ids: z.array(z.string()),
  exclude: exclusionSchema,
})
export type SourceInput = z.infer<typeof sourceSchema>

/**
 * The API's per-collection budget (`MAX_TOTAL_CONDITIONS` in the rule
 * evaluator): source conditions plus exclusion conditions, summed across
 * every source. It is mirrored here because the same check also runs on
 * `previewCollection`, whose error the items panel swallows — one condition
 * over, the preview would silently freeze on its last result while the vendor
 * kept adding rows, and the refusal would only surface at Save.
 */
export const MAX_TOTAL_CONDITIONS = 60

/** Counted the way the evaluator counts: conditions and exclusion conditions. */
export function countConditions(sources: SourceInput[]): number {
  return sources.reduce(
    (sum, source) =>
      sum + source.conditions.length + source.exclude.conditions.length,
    0,
  )
}

const translatableSchema = z.object({
  en: z.string().optional().or(z.literal("")),
  ar: z.string().optional().or(z.literal("")),
})

/** Presence operators take no operand; everything else needs at least one. */
const PRESENCE_OPERATORS: CollectionRuleOperator[] = ["IS_SET", "IS_NOT_SET"]

/**
 * Built from the `collections.validation` translator: a zod message is fixed
 * when the schema is built, and these messages reach the vendor as they are —
 * beside a condition row, or in the save bar through `firstMessage`.
 */
export const collectionFormSchema = (t: Translate) =>
  z
    .object({
      name: translatableSchema.refine((v) => !!(v.en?.trim() || v.ar?.trim()), {
        message: t("titleRequired"),
      }),
      description: translatableSchema,
      seo_title: translatableSchema,
      seo_description: translatableSchema,
      // Optional: an Arabic-only title transliterates to nothing here, and the
      // API derives the handle from the name in exactly that case.
      slug: z
        .string()
        .trim()
        .regex(/^[a-z0-9-]*$/i, t("slugFormat")),
      sort: collectionSortSchema,
      sort_order: z.number().int().optional(),
      is_published: z.boolean(),
      image_url: z.string().optional().or(z.literal("")),
      image_alt: z.string().optional().or(z.literal("")),
      sources: z.array(sourceSchema).min(1),
      /** Hand-picked products. They survive every rule re-sync. */
      product_ids: z.array(z.string()),
    })
    .superRefine((data, ctx) => {
      data.sources.forEach((source, si) => {
        if (source.kind === "COLLECTIONS" && source.collection_ids.length === 0) {
          ctx.addIssue({
            code: "custom",
            message: t("pickCollection"),
            path: ["sources", si, "collection_ids"],
          })
        }
        const groups: Array<[ConditionInput[], (string | number)[]]> = [
          [source.conditions, ["sources", si, "conditions"]],
          [source.exclude.conditions, ["sources", si, "exclude", "conditions"]],
        ]
        for (const [conditions, base] of groups) {
          conditions.forEach((condition, ci) => {
            if (condition.field === "attribute" && !condition.attribute_key?.trim()) {
              ctx.addIssue({
                code: "custom",
                message: t("pickAttributeKey"),
                path: [...base, ci, "attribute_key"],
              })
            }
            if (PRESENCE_OPERATORS.includes(condition.operator)) return
            const filled = condition.values.filter((v) => v.trim() !== "")
            if (condition.operator === "BETWEEN") {
              if (filled.length < 2) {
                ctx.addIssue({
                  code: "custom",
                  message: t("minMaxRequired"),
                  path: [...base, ci, "values"],
                })
              }
              return
            }
            if (filled.length === 0) {
              ctx.addIssue({
                code: "custom",
                message: t("valueRequired"),
                path: [...base, ci, "values"],
              })
            }
          })
        }
      })
      // No control is registered under `sources`, so this lands in the save bar
      // via `firstMessage` rather than beside a row — before any round trip.
      if (countConditions(data.sources) > MAX_TOTAL_CONDITIONS) {
        ctx.addIssue({
          code: "custom",
          message: t("tooManyConditions", { max: MAX_TOTAL_CONDITIONS }),
          path: ["sources"],
        })
      }
    })

export type CollectionFormInput = z.infer<ReturnType<typeof collectionFormSchema>>
export type CollectionFormApi = UseFormReturn<CollectionFormInput>
