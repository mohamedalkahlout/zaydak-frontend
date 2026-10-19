import { z } from "zod"
import type { UseFormReturn } from "react-hook-form"
import type { Translate } from "@/shared/i18n/translator"

// The schemas that carry a message are factories taking a translator over
// `products.validation`: a zod message is fixed when the schema is built, so a
// schema constant with English literals stays English on an Arabic dashboard.
// The form builds `productSchema(useTranslations("products.validation"))`.

// ── Enums (mirror the GraphQL wire values) ─────────────

export const productStatusSchema = z.enum(["DRAFT", "PUBLISH", "UNLISTED"])
export type ProductStatus = z.infer<typeof productStatusSchema>










// Structure of the product (PRODUCTS.md §4). Pricing mechanism moved to
// `saleTypeSchema` in 2026-04-21 — backend no longer accepts `NEGOTIABLE`,
// `AUCTION`, or `FIXED_PRICE` here.
export const productTypeSchema = z.enum([
  "SIMPLE",
  "VARIABLE",
  "DIGITAL",
  "SERVICE",
])
export type ProductType = z.infer<typeof productTypeSchema>

// Orthogonal pricing mechanism — any ProductType × any SaleType is valid.
export const saleTypeSchema = z.enum([
  "FIXED_PRICE",
  "NEGOTIABLE",
  "AUCTION",
])
export type SaleType = z.infer<typeof saleTypeSchema>

export const targetAudienceSchema = z.enum(["MEN", "WOMEN", "KIDS", "UNISEX"])
export type TargetAudience = z.infer<typeof targetAudienceSchema>

/** Vendor display preference for weight (storage stays grams server-side). */
export const weightUnitSchema = z.enum(["KG", "LB", "G", "OZ"])
export type WeightUnit = z.infer<typeof weightUnitSchema>

// ── Translatable text ──────────────────────────────────
// Stored as `{ en?, ar? }` to mirror the backend JSON shape. At least one
// of the two locales must be filled for user-visible fields (name/title).
export const translatableSchema = z
  .object({
    en: z.string().optional().or(z.literal("")),
    ar: z.string().optional().or(z.literal("")),
  })
  .default({ en: "", ar: "" })

const translatableNonEmpty = (t: Translate) =>
  translatableSchema.refine((v) => !!(v.en?.trim() || v.ar?.trim()), {
    message: t("required"),
  })

// ── Image JSON shape ───────────────────────────────────
// Canonical shape — mirrors back-end/src/products/types/product-media.shape.ts.
// `alt` + `position` + `media_type` are opt-in for back-compat with legacy
// rows; the renderer treats missing `media_type` as IMAGE.
//
// `alt` is multilang ({en, ar}) — critical for SEO + screen-reader accessibility.
// Google Image Search ranks alt text directly; RTL screen-readers won't read
// images without it. Empty strings allowed so a vendor can save EN-only alt
// without being forced to fill AR.
export const altTextSchema = z
  .record(z.string(), z.string())
  .optional()
export type AltTextValue = z.infer<typeof altTextSchema>

export const productImageSchema = z.object({
  id: z.string().optional(),
  original: z.string().optional().or(z.literal("")),
  thumbnail: z.string().optional().or(z.literal("")),
  alt: altTextSchema,
  position: z.number().int().min(0).optional(),
  media_type: z
    .enum(["IMAGE", "VIDEO", "EXTERNAL_VIDEO", "MODEL_3D"])
    .optional(),
  // Normalized focal point (0..1) from the image editor; storefronts map it
  // to CSS object-position. Absent = centered. Round-trips in the image JSON.
  focal_point: z
    .object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) })
    .optional(),
})
export type ProductImageValue = z.infer<typeof productImageSchema>

export const galleryImageSchema = productImageSchema.extend({
  color: z.string().optional().or(z.literal("")),
})
export type GalleryImageValue = z.infer<typeof galleryImageSchema>

/**
 * A product video. Stored on the server as a JSON array of `{ url, poster }`,
 * which is the shape `ATTACHMENT_URL_REFERENCES` already registers for
 * `products.video`.
 *
 * `attachment_id` is carried alongside the URL rather than instead of it,
 * deliberately: the column is denormalized like every other media reference
 * here, so the URL is what the storefront reads, and the id is what lets a
 * future read-time resolution (the "reference by id" item in TODO.md) find its
 * way back to the attachment without a URL match.
 */
export const productVideoSchema = z.object({
  url: z.string(),
  /** Poster frame — the source photo the clip opens on. */
  poster: z.string().optional().or(z.literal("")),
  attachment_id: z.string().optional(),
  /** Whole seconds, for a duration badge on the tile. */
  duration_seconds: z.number().int().optional(),
})
export type ProductVideoValue = z.infer<typeof productVideoSchema>

// ── Category metafield values (PRODUCTS.md §16.4) ──────────────────
// Keyed by the definition's `key`. Only one of the five sub-fields is
// populated per entry; which one depends on the definition type and is
// chosen by the renderer. Empty entries are dropped on submit so we
// don't trip the backend's exactly-one-value constraint.
export const attributeValueEntrySchema = z.object({
  text: z.string().optional(),
  number: z
    .preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.coerce.number().int().optional(),
    )
    .optional(),
  boolean: z.boolean().optional(),
  option: z.string().optional(),
  options: z.array(z.string()).optional(),
})

export type AttributeValueEntryInput = z.input<typeof attributeValueEntrySchema>
export type AttributeValueEntryOutput = z.output<typeof attributeValueEntrySchema>

// ── Variation (UI shape — prices in MAJOR units, cents on submit) ───
export const variationOptionSchema = (t: Translate) => z.object({
  /** Preserved on edit so the backend can match the existing row. */
  id: z.string().optional(),
  title: translatableSchema,
  /** Free-form key/value dictionary: `{ color: "red", size: "M" }`. */
  options: z.record(z.string(), z.string()).default({}),
  price: z.coerce.number().min(0, t("mustBeNonNegative")),
  sale_price: z
    .preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.coerce.number().min(0).optional(),
    )
    .optional(),
  /** Per-variant sourcing cost (Shopify-style margin per variant). Major units. */
  cost_per_item: z
    .preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.coerce.number().min(0).optional(),
    )
    .optional(),
  sku: z.string().optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(0).default(0),
  /** Display order in the variant grid (0-based). */
  position: z.coerce.number().int().min(0).default(0),
  is_disable: z.boolean().default(false),
  /**
   * Tri-state per-variant inventory tracking. `null` = inherit parent
   * `track_quantity` (default — preserves existing behavior). `true` =
   * tracked even if parent is untracked. `false` = always in-stock
   * (digital / license-key) even if parent is tracked. Most variants
   * leave this null; only the hybrid "physical + ebook" case needs an
   * explicit override.
   */
  track_quantity: z.boolean().nullable().default(null),
  image: productImageSchema.optional().nullable(),
})
export type VariationOptionInput = z.input<
  ReturnType<typeof variationOptionSchema>
>
export type VariationOptionOutput = z.output<
  ReturnType<typeof variationOptionSchema>
>

// ── Option-definition (Shopify variant grid schema) ────
// `[{ name: { en, ar }, position, values: [{ label: { en, ar } }] }]`.
// When set, the backend strictly validates each variation's `options`
// JSON keys+values against this list.
export const productOptionValueSchema = z.object({
  label: translatableSchema,
})

export const productOptionDefinitionSchema = (t: Translate) => z.object({
  name: translatableNonEmpty(t),
  position: z.coerce.number().int().min(1).default(1),
  values: z.array(productOptionValueSchema).min(1, t("atLeastOneValue")),
})

export type ProductOptionDefinitionInput = z.input<
  ReturnType<typeof productOptionDefinitionSchema>
>
export type ProductOptionDefinitionOutput = z.output<
  ReturnType<typeof productOptionDefinitionSchema>
>

// ── Main product schema ────────────────────────────────
export const productSchema = (t: Translate) => z
  .object({
    // ── Identity / core ────────────
    name: translatableNonEmpty(t),
    slug: z
      .string()
      .regex(/^[a-z0-9-]*$/, t("slugFormat"))
      .max(140, t("tooLong"))
      .optional()
      .or(z.literal("")),
    description: translatableSchema.optional(),

    // ── SEO ────────────────────────
    /** Override the storefront <title>. Falls back to `name` when empty. */
    seo_title: translatableSchema.optional(),
    /** Override the meta description. Falls back to truncated description. */
    seo_description: translatableSchema.optional(),

    status: productStatusSchema.default("DRAFT"),
    product_type: productTypeSchema.default("SIMPLE"),
    sale_type: saleTypeSchema.default("FIXED_PRICE"),

    // ── Pricing (major units in the form; converted to cents on submit) ──
    // Required for non-VARIABLE; VARIABLE products leave these empty and
    // derive min/max from variations server-side.
    price: z
      .preprocess(
        (v) => (v === "" || v === null ? undefined : v),
        z.coerce.number().min(0).optional(),
      )
      .optional(),
    sale_price: z
      .preprocess(
        (v) => (v === "" || v === null ? undefined : v),
        z.coerce.number().min(0).optional(),
      )
      .optional(),
    /** Vendor's wholesale / sourcing cost per unit. Drives margin/profit. */
    cost_per_item: z
      .preprocess(
        (v) => (v === "" || v === null ? undefined : v),
        z.coerce.number().min(0).optional(),
      )
      .optional(),

    // ── Inventory (SIMPLE only) ────
    sku: z.string().optional().or(z.literal("")),
    barcode: z.string().optional().or(z.literal("")),
    quantity: z
      .preprocess(
        (v) => (v === "" || v === null ? undefined : v),
        z.coerce.number().int().min(0).optional(),
      )
      .optional(),

    // ── Inventory policy (Shopify) ─
    /** When false, stock-reservation engine bypasses qty checks. */
    track_quantity: z.boolean().default(true),
    /** When true, allow oversell / backorder. */
    continue_selling_when_out_of_stock: z.boolean().default(false),

    // ── Media ──────────────────────
    image: productImageSchema.optional().nullable(),
    gallery: z.array(galleryImageSchema).default([]),
    /**
     * Product videos. Staged like every other media edit — a generated clip
     * lands here and is persisted by the contextual save bar, never by the
     * generation itself.
     */
    video: z.array(productVideoSchema).default([]),

    // ── Flags ──────────────────────
    is_digital: z.boolean().default(false),

    // ── Shipping (Shopify-style) ───
    /** Physical product toggle. Defaults true. False for digital/service. */
    requires_shipping: z.boolean().default(true),
    /** Canonical storage unit = grams (integer). */
    weight_grams: z
      .preprocess(
        (v) => (v === "" || v === null ? undefined : v),
        z.coerce.number().int().min(0).optional(),
      )
      .optional(),
    /** Display preference (KG | LB | G | OZ). */
    weight_unit_display: weightUnitSchema.optional(),
    /** Package dimensions in millimeters (integer). */
    length_mm: z
      .preprocess(
        (v) => (v === "" || v === null ? undefined : v),
        z.coerce.number().int().min(0).optional(),
      )
      .optional(),
    width_mm: z
      .preprocess(
        (v) => (v === "" || v === null ? undefined : v),
        z.coerce.number().int().min(0).optional(),
      )
      .optional(),
    height_mm: z
      .preprocess(
        (v) => (v === "" || v === null ? undefined : v),
        z.coerce.number().int().min(0).optional(),
      )
      .optional(),
    package_id: z.string().optional().nullable(),
    /** Harmonized System code for international shipping. */
    hs_code: z.string().optional().or(z.literal("")),
    /** ISO-3166-1 alpha-2 country code. */
    country_of_origin: z.string().optional().or(z.literal("")),

    // ── Organization ───────────────
    /** Google-taxonomy classification node (PRODUCTS.md §16.2). */
    system_category_id: z.string().optional().or(z.literal("")),
    tag_ids: z.array(z.string()).default([]),
    /** Hand-picked collection membership. Rule-derived membership is the
     * server's and is not represented here — the picker only ever writes
     * the pinned list. */
    collection_ids: z.array(z.string()).default([]),
    brand: z.string().max(120, t("tooLong")).optional().or(z.literal("")),
    /** Shopify's free-text "Product type" — the shop's own vocabulary, and
     *  deliberately not `product_type`, which is the structural kind. */
    type_name: z.string().max(120, t("tooLong")).optional().or(z.literal("")),
    target_audience: targetAudienceSchema.optional(),

    // ── Variations (used when product_type === "VARIABLE") ─────
    variation_options: z.array(variationOptionSchema(t)).default([]),

    /**
     * Per-location stock edits staged by the variants table while a specific
     * location is selected. Not part of `updateProduct` — the submit hook
     * flushes each entry through `setInventoryAvailable` once the product
     * has been saved, so a warehouse figure travels behind the same save bar
     * as everything else on the form instead of writing on blur.
     *
     * Keyed by variation, so only saved variants can appear here; a variant
     * added in this session has no id yet and uses its `quantity` field as
     * opening stock at the default location, exactly as create mode does.
     */
    inventory_levels: z
      .array(
        z.object({
          location_id: z.string(),
          variation_option_id: z.string(),
          available: z.coerce.number().int().min(0),
        }),
      )
      .default([]),
    /** Shopify variant-grid schema. When set → strict validation server-side. */
    option_definitions: z
      .array(productOptionDefinitionSchema(t))
      .optional()
      .default([]),

    /**
     * Metafield values, keyed by attribute key. Shape of each entry is
     * driven by the definition's type — the renderer writes to the
     * matching sub-field. Pruned on submit to drop empty entries.
     */
    attribute_values: z
      .record(z.string(), attributeValueEntrySchema)
      .default({}),

    // ── Auction fields (used when sale_type === "AUCTION") ─────
    // Stored in major units in the form; converted to cents/bps on submit.
    min_bid_price: z
      .preprocess(
        (v) => (v === "" || v === null ? undefined : v),
        z.coerce.number().min(0).optional(),
      )
      .optional(),
    max_bid_price: z
      .preprocess(
        (v) => (v === "" || v === null ? undefined : v),
        z.coerce.number().min(0).optional(),
      )
      .optional(),
    /** Percentage in whole-number form (15 = 15.00%). Converted to basis points on submit. */
    max_percentage: z
      .preprocess(
        (v) => (v === "" || v === null ? undefined : v),
        z.coerce.number().min(0).max(100).optional(),
      )
      .optional(),

    // ── Optimistic lock ────────────
    /** Version last fetched from the server. Sent as `expected_version`. */
    expected_version: z.number().int().optional(),
  })
  .superRefine((data, ctx) => {
    // VARIABLE ⇒ at least one variation.
    if (data.product_type === "VARIABLE" && data.variation_options.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["variation_options"],
        message: t("variableNeedsVariation"),
      })
    }

    // FIXED_PRICE ⇒ price required (except VARIABLE which derives it from
    // variations, and SERVICE which can be priced per engagement).
    if (
      data.sale_type === "FIXED_PRICE" &&
      data.product_type !== "VARIABLE" &&
      data.product_type !== "SERVICE"
    ) {
      if (data.price == null) {
        ctx.addIssue({
          code: "custom",
          path: ["price"],
          message: t("required"),
        })
      }
    }

    // AUCTION ⇒ min_bid_price required; max must be ≥ min.
    if (data.sale_type === "AUCTION") {
      if (data.min_bid_price == null) {
        ctx.addIssue({
          code: "custom",
          path: ["min_bid_price"],
          message: t("requiredForAuctions"),
        })
      }
      if (
        data.max_bid_price != null &&
        data.min_bid_price != null &&
        data.max_bid_price < data.min_bid_price
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["max_bid_price"],
          message: t("maxBelowMin"),
        })
      }
    }

    // sale_price must be strictly less than price.
    if (
      data.price != null &&
      data.sale_price != null &&
      data.sale_price >= data.price
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["sale_price"],
        message: t("saleNotLessThanPrice"),
      })
    }

    // Variation sale_price must be less than its price.
    for (let i = 0; i < data.variation_options.length; i += 1) {
      const v = data.variation_options[i]
      if (v.sale_price != null && v.sale_price >= v.price) {
        ctx.addIssue({
          code: "custom",
          path: ["variation_options", i, "sale_price"],
          message: t("saleNotLessThanPrice"),
        })
      }
    }

    // Option-definitions / variation-options coherence (mirrors the backend
    // helper). Only enforced when both sides are set so legacy products
    // with freeform variations still validate.
    if (data.option_definitions.length > 0 && data.variation_options.length > 0) {
      const allowed = new Map<string, Set<string>>()
      for (const def of data.option_definitions) {
        const name = def.name.en?.trim() ?? ""
        if (!name) continue
        allowed.set(name, new Set(def.values.map((v) => v.label.en?.trim() ?? "")))
      }

      const seenCombos = new Set<string>()
      for (let i = 0; i < data.variation_options.length; i += 1) {
        const v = data.variation_options[i]
        const opts = v.options ?? {}
        // Required keys
        for (const [name] of allowed) {
          if (!(name in opts)) {
            ctx.addIssue({
              code: "custom",
              path: ["variation_options", i, "options", name],
              message: t("missingOption", { name }),
            })
          }
        }
        // Disallowed keys + invalid values
        for (const [k, val] of Object.entries(opts)) {
          const allowedValues = allowed.get(k)
          if (!allowedValues) {
            ctx.addIssue({
              code: "custom",
              path: ["variation_options", i, "options", k],
              message: t("unknownOption", { name: k }),
            })
            continue
          }
          if (!allowedValues.has(val)) {
            ctx.addIssue({
              code: "custom",
              path: ["variation_options", i, "options", k],
              message: t("undeclaredValue", { value: val, name: k }),
            })
          }
        }
        // Duplicate combinations
        const combo = Object.entries(opts)
          .map(([k, v]) => `${k}=${v}`)
          .sort()
          .join("|")
        if (seenCombos.has(combo)) {
          ctx.addIssue({
            code: "custom",
            path: ["variation_options", i, "options"],
            message: t("duplicateCombination"),
          })
        }
        seenCombos.add(combo)
      }
    }
  })

export type ProductFormInput = z.input<ReturnType<typeof productSchema>>
export type ProductFormOutput = z.output<ReturnType<typeof productSchema>>

export type ProductFormApi = UseFormReturn<
  ProductFormInput,
  unknown,
  ProductFormOutput
>

/**
 * The three statuses, in the order the picker renders them. Each one's label
 * is `products.status.<value>` and the sentence it is actually promising is
 * `products.statusDesc.<value>`. The description is not decoration — the whole
 * difference between Draft and Unlisted is who can still reach the product, and
 * a bare label cannot say it.
 *
 * There is no transition map any more. There were six statuses and a state
 * machine that made publishing a draft a three-step trip through an approval
 * flow no screen ever drove; all three of these are one write from each other,
 * so the picker offers them unconditionally.
 */
export const PRODUCT_STATUS_CHOICES = [
  { value: "PUBLISH" },
  { value: "DRAFT" },
  { value: "UNLISTED" },
] as const satisfies readonly { value: ProductStatus }[]

/** English fallback. Screens render `products.status.<value>` so the cookie
 *  locale wins; these strings stay so a non-React caller still has a word.
 *  The API value is the key (PUBLISH / DRAFT / UNLISTED), never the label. */
export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  PUBLISH: "Active",
  DRAFT: "Draft",
  UNLISTED: "Unlisted",
}

// The kind and the selling method have no English map here: screens render
// `products.productTypes.<VALUE>` and `products.organization.saleType.<VALUE>`.

export const WEIGHT_UNIT_LABELS: Record<WeightUnit, string> = {
  KG: "kg",
  LB: "lb",
  G: "g",
  OZ: "oz",
}
