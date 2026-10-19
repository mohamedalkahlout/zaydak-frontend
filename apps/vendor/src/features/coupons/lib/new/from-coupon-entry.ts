import type { CouponEntry } from "@/shared/api/generated/graphql"
import type {
  AmountOffOrderCouponInput,
  AmountOffProductsCouponInput,
  AnyCouponInput,
  BuyXGetYCouponInput,
  FreeShippingCouponInput,
} from "@/features/coupons/validations/coupon"
import { bpsToPercent, centsToMajor, translatable } from "@/shared/lib/format"

/**
 * PERCENTAGE coupons carry their value in `percent_bps`; FIXED coupons in
 * `amount_cents`. Displaying the wrong field shows `0` after editing a
 * percentage coupon round-trip.
 */
function amountFromEntry(entry: CouponEntry): number {
  if (entry.value_type === "PERCENTAGE") {
    return bpsToPercent(entry.percent_bps)
  }
  return centsToMajor(entry.amount_cents)
}
import type { CouponType } from "@/features/coupons/types"
import { detectTimezone } from "@/features/coupons/validations/coupon"

/**
 * Id → display-label map for each entity kind. Populated from the
 * resolved `products/customers/segments` arrays returned by `coupon(id)`
 * so edit-page pickers and chips can render names without a second
 * round-trip. Collections aren't returned as a relation by the backend
 * (`collection_ids` only) so the picker dialog fetches names itself.
 */
export interface InitialCouponSnapshots {
  products: Record<string, { name: string; image?: { thumbnail?: string; original?: string } | null }>
  collections: Record<string, { name: string }>
  customers: Record<string, { name: string }>
  segments: Record<string, { name: string }>
}

export function extractInitialSnapshots(
  entry: CouponEntry,
): InitialCouponSnapshots {
  const snapshots: InitialCouponSnapshots = {
    products: {},
    collections: {},
    customers: {},
    segments: {},
  }
  for (const p of entry.products ?? []) {
    snapshots.products[p.id] = {
      name: translatable(p.name) || p.slug || p.id,
      image: p.image ?? null,
    }
  }
  for (const c of entry.customers ?? []) {
    snapshots.customers[c.id] = {
      name: c.name || c.email || c.id,
    }
  }
  for (const s of entry.segments ?? []) {
    snapshots.segments[s.id] = { name: s.name || s.id }
  }
  return snapshots
}

/** API enum → form literal for the top-level coupon type. */
const TYPE_MAP: Record<string, CouponType> = {
  AMOUNT_OFF_PRODUCTS: "amount_off_products",
  AMOUNT_OFF_ORDER: "amount_off_order",
  BUY_X_GET_Y: "buy_x_get_y",
  FREE_SHIPPING: "free_shipping",
}

export function couponEntryType(entry: CouponEntry): CouponType | null {
  return TYPE_MAP[entry.type] ?? null
}

/**
 * Translate a `CouponEntry` fetched from the API into the flat form
 * input shape consumed by react-hook-form `defaultValues`. Inverse of
 * `toCreateCouponInput`.
 */
export function fromCouponEntry(entry: CouponEntry): AnyCouponInput {
  const type = couponEntryType(entry)
  if (!type) {
    throw new Error(`Unsupported coupon type: ${entry.type}`)
  }

  const common = buildCommonFields(entry)

  switch (type) {
    case "amount_off_products":
      return buildAmountOffProducts(entry, common)
    case "amount_off_order":
      return buildAmountOffOrder(entry, common)
    case "buy_x_get_y":
      return buildBogo(entry, common)
    case "free_shipping":
      return buildFreeShipping(entry, common)
  }
}

type CommonFields = ReturnType<typeof buildCommonFields>

function buildCommonFields(entry: CouponEntry) {
  const { date: fromDate, time: fromTime } = splitISO(entry.active_from) ?? {
    date: "",
    time: "00:00",
  }
  const expire = splitISO(entry.expire_at)

  return {
    code: entry.code ?? "",
    method: (entry.method === "AUTOMATIC" ? "automatic" : "code") as
      | "code"
      | "automatic",

    eligibility: mapEligibility(entry.eligibility),
    customer_ids: entry.customer_ids ?? [],
    segment_ids: entry.segment_ids ?? [],

    ...minimumPurchase(entry),

    limit_uses: typeof entry.max_uses === "number" && entry.max_uses > 0,
    max_uses: entry.max_uses ?? undefined,
    limit_one_per_customer: entry.max_uses_per_user === 1,

    is_exclusive: entry.is_exclusive ?? false,
    allow_product: entry.combinations?.allow_product ?? false,
    allow_order: entry.combinations?.allow_order ?? false,
    allow_shipping: entry.combinations?.allow_shipping ?? false,

    active_from_date: fromDate,
    active_from_time: fromTime,
    set_end_date: !!expire,
    expire_at_date: expire?.date ?? "",
    expire_at_time: expire?.time ?? "",
    timezone: entry.timezone ?? detectTimezone(),

    product_ids: entry.product_ids ?? [],
    collection_ids: entry.collection_ids ?? [],

    language: entry.language ?? "",
    target: entry.target ?? "",
    priority: entry.priority ?? undefined,
  }
}

function mapEligibility(
  value: CouponEntry["eligibility"],
): "all_customers" | "specific_customers" | "segment" {
  if (value === "SPECIFIC_CUSTOMERS") return "specific_customers"
  if (value === "SEGMENT") return "segment"
  return "all_customers"
}

function minimumPurchase(entry: CouponEntry) {
  if (entry.minimum_quantity && entry.minimum_quantity > 0) {
    return {
      minimum_mode: "quantity" as const,
      minimum_cart_amount: undefined,
      minimum_quantity: entry.minimum_quantity,
    }
  }
  if (entry.minimum_cart_amount_cents && entry.minimum_cart_amount_cents > 0) {
    return {
      minimum_mode: "amount" as const,
      minimum_cart_amount: centsToMajor(entry.minimum_cart_amount_cents),
      minimum_quantity: undefined,
    }
  }
  return {
    minimum_mode: "none" as const,
    minimum_cart_amount: undefined,
    minimum_quantity: undefined,
  }
}

function buildAmountOffProducts(
  entry: CouponEntry,
  common: CommonFields,
): AmountOffProductsCouponInput {
  return {
    ...common,
    type: "amount_off_products",
    value_type: entry.value_type === "FIXED" ? "fixed" : "percentage",
    amount: amountFromEntry(entry),
    max_discount:
      entry.max_discount_cents != null
        ? centsToMajor(entry.max_discount_cents)
        : undefined,
    applies_to:
      (entry.collection_ids?.length ?? 0) > 0 ? "collections" : "products",
  }
}

function buildAmountOffOrder(
  entry: CouponEntry,
  common: CommonFields,
): AmountOffOrderCouponInput {
  return {
    ...common,
    type: "amount_off_order",
    value_type: entry.value_type === "FIXED" ? "fixed" : "percentage",
    amount: amountFromEntry(entry),
    max_discount:
      entry.max_discount_cents != null
        ? centsToMajor(entry.max_discount_cents)
        : undefined,
  }
}

function buildBogo(
  entry: CouponEntry,
  common: CommonFields,
): BuyXGetYCouponInput {
  // Buy-by-amount piggy-backs on `minimum_cart_amount_cents`, matching how
  // `applyBogo` writes it in `transform-coupon-input.ts`.
  const hasBuyAmount =
    !!entry.minimum_cart_amount_cents && entry.minimum_cart_amount_cents > 0
  const discountMode = mapBogoDiscountMode(entry.get_discount_type)

  // Separate pools override the shared pool when any of the buy_*/get_*
  // lists are populated. Keep the existing shared-scope logic as the
  // fallback so legacy coupons edit identically.
  const buyProducts = entry.buy_product_ids ?? []
  const buyCollections = entry.buy_collection_ids ?? []
  const getProducts = entry.get_product_ids ?? []
  const getCollections = entry.get_collection_ids ?? []
  const scopeMode: "shared" | "separate" =
    buyProducts.length > 0 ||
    buyCollections.length > 0 ||
    getProducts.length > 0 ||
    getCollections.length > 0
      ? "separate"
      : "shared"

  // Shared-pool scope — same logic as before.
  const sharedAppliesTo: "all" | "products" | "collections" =
    (entry.collection_ids?.length ?? 0) > 0
      ? "collections"
      : (entry.product_ids?.length ?? 0) > 0
        ? "products"
        : "all"

  const buyAppliesTo: "all" | "products" | "collections" =
    buyCollections.length > 0
      ? "collections"
      : buyProducts.length > 0
        ? "products"
        : "all"
  const getAppliesTo: "all" | "products" | "collections" =
    getCollections.length > 0
      ? "collections"
      : getProducts.length > 0
        ? "products"
        : "all"

  return {
    ...common,
    // Minimum-purchase section is hidden on BOGO; the shared card's
    // fields collapse to "none" so the UI doesn't show a stale value.
    minimum_mode: "none",
    minimum_cart_amount: undefined,
    minimum_quantity: undefined,
    type: "buy_x_get_y",
    amount: centsToMajor(entry.amount_cents ?? 0),
    scope_mode: scopeMode,
    applies_to: sharedAppliesTo,
    buy_applies_to: buyAppliesTo,
    get_applies_to: getAppliesTo,
    buy_product_ids: buyProducts,
    buy_collection_ids: buyCollections,
    get_product_ids: getProducts,
    get_collection_ids: getCollections,
    buy_mode: hasBuyAmount ? "amount" : "quantity",
    buy_quantity: entry.buy_quantity ?? 1,
    buy_amount: hasBuyAmount
      ? centsToMajor(entry.minimum_cart_amount_cents)
      : undefined,
    get_quantity: entry.get_quantity ?? 1,
    get_discount_mode: discountMode,
    get_discount_percent:
      entry.get_discount_percent_bps != null
        ? bpsToPercent(entry.get_discount_percent_bps)
        : 100,
    get_discount_amount:
      entry.get_discount_amount_cents != null
        ? centsToMajor(entry.get_discount_amount_cents)
        : undefined,
    max_uses_per_order_enabled:
      typeof entry.max_uses_per_order === "number" &&
      entry.max_uses_per_order > 0,
    max_uses_per_order: entry.max_uses_per_order ?? undefined,
  }
}

function mapBogoDiscountMode(
  value: CouponEntry["get_discount_type"],
): "percent" | "amount" | "free" {
  if (value === "AMOUNT") return "amount"
  if (value === "FREE") return "free"
  return "percent"
}

function buildFreeShipping(
  entry: CouponEntry,
  common: CommonFields,
): FreeShippingCouponInput {
  return {
    ...common,
    type: "free_shipping",
    amount: centsToMajor(entry.amount_cents ?? 0),
    countries_mode: (entry.countries?.length ?? 0) > 0 ? "selected" : "all",
    countries: entry.countries ?? [],
    exclude_shipping_rates:
      typeof entry.exclude_shipping_rates_over_cents === "number" &&
      entry.exclude_shipping_rates_over_cents > 0,
    exclude_shipping_rates_over:
      entry.exclude_shipping_rates_over_cents != null
        ? centsToMajor(entry.exclude_shipping_rates_over_cents)
        : undefined,
  }
}

/**
 * Split an ISO string into local-wall-clock date + time. `new Date`
 * parses the ISO as UTC; using its local getters mirrors the form's
 * create path, which treats the inputs as wall-clock values.
 */
function splitISO(
  iso: string | null | undefined,
): { date: string; time: string } | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  return { date, time }
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}
