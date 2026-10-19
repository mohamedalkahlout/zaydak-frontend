import type {
  AdminPlansQuery,
  AdminPlanEntitlementsQuery,
  AdminFeatureCatalogQuery,
  AdminShopSubscriptionsQuery,
  AdminShopOverridesQuery,
} from "@/shared/api/generated/graphql"

/** One row of `allPlans`. */
export type PlanRow = NonNullable<AdminPlansQuery["allPlans"]["data"]>[number]

/**
 * One capability from `featureCatalog`, including the JSON Schema for its
 * config. The schema is what `config-field.tsx` renders from, so a new
 * capability needs no code here.
 */
export type CapabilityRow = NonNullable<
  AdminFeatureCatalogQuery["featureCatalog"]["data"]
>[number]

export type SubscriptionRow = NonNullable<
  AdminShopSubscriptionsQuery["shopSubscriptions"]["data"]
>[number]

export type OverrideRow = NonNullable<
  AdminShopOverridesQuery["shopOverrides"]["data"]
>[number]

/** One row of a plan's matrix, as `planEntitlements` returns it. */
export type PlanEntitlementRow = NonNullable<
  AdminPlanEntitlementsQuery["planEntitlements"]["data"]
>[number]

/**
 * The subset of JSON Schema the config fields understand.
 *
 * Deliberately narrow: the server generates these from zod objects whose
 * properties are booleans, bounded integers, enums and arrays of enums. Anything
 * outside that renders read-only rather than guessing at a control.
 */
export interface ConfigProperty {
  type?: "boolean" | "integer" | "number" | "string" | "array"
  enum?: string[]
  minimum?: number
  maximum?: number
  default?: unknown
  items?: { type?: string; enum?: string[] }
}

export interface ConfigSchema {
  properties?: Record<string, ConfigProperty>
}

/** Narrow the `JSON` scalar the server sends into the shape above. */
export function asConfigSchema(value: unknown): ConfigSchema | null {
  if (!value || typeof value !== "object") return null
  const props = (value as ConfigSchema).properties
  return props && typeof props === "object" ? { properties: props } : null
}
