import {
  BogoDiscountType,
  CouponEligibility,
  CouponMethod,
  CouponType,
  CouponValueType,
  type CreateCouponInput,
  type UpdateCouponInput,
} from "@/shared/api/generated/graphql"
import { majorToCents, percentToBps } from "@/shared/lib/format"
import type { AnyCouponOutput } from "@/features/coupons/validations/coupon"

const TYPE_MAP: Record<AnyCouponOutput["type"], CouponType> = {
  amount_off_products: CouponType.AmountOffProducts,
  amount_off_order: CouponType.AmountOffOrder,
  buy_x_get_y: CouponType.BuyXGetY,
  free_shipping: CouponType.FreeShipping,
}

/**
 * Reshape the validated form output into the GraphQL `CreateCouponInput`
 * payload. The form keeps a flatter, UI-friendly shape (radio modes,
 * "limit uses" toggles, separated date+time fields); this layer collapses
 * those into the backend's nested / discriminated structure.
 */
export function toCreateCouponInput(data: AnyCouponOutput): CreateCouponInput {
  const out: Partial<CreateCouponInput> & { type: CouponType } = {
    type: TYPE_MAP[data.type],
  }

  applyCommonFields(out, data)
  applyActiveWindow(out, data)
  applyMinimumPurchase(out, data)
  applyUsageLimits(out, data)
  applyEligibility(out, data)
  applyMethod(out, data)
  applyCombinations(out, data)

  switch (data.type) {
    case "amount_off_products":
      applyAmountOff(out, data)
      applyProductScope(out, data)
      break
    case "amount_off_order":
      applyAmountOff(out, data)
      break
    case "buy_x_get_y":
      applyBogo(out, data)
      applyBogoScope(out, data)
      break
    case "free_shipping":
      applyFreeShipping(out, data)
      break
  }

  return out as CreateCouponInput
}

/**
 * Reshape the validated form output into the `UpdateCouponInput` payload.
 *
 * Backend contract (COUPONS.md):
 *   - Omitted fields → stay untouched (`undefined`).
 *   - Nullable scalar + explicit `null` → cleared on the server.
 *   - Non-nullable scalar (`amount`, `minimum_cart_amount`) + `null` → resets to 0.
 *   - List field + explicit `[]` → replaces the list entirely (clears).
 *
 * So the update path explicitly nulls scalars the merchant un-toggled
 * (end date, usage caps, min purchase) and sends `[]` for list scopes
 * that no longer apply. Without this, clearing a limit on the edit form
 * would keep the stale value on the server.
 */
export function toUpdateCouponInput(
  data: AnyCouponOutput,
  id: string,
): UpdateCouponInput {
  const created = toCreateCouponInput(data) as UpdateCouponInput
  // `type` can't change after creation; the backend update example omits it
  // and sending it has been observed to trigger server errors.
  delete (created as { type?: unknown }).type

  const update: UpdateCouponInput = { ...created, id }

  // ── Scalar clears ──────────────────────────────────
  if (!data.limit_uses) update.max_uses = null
  if (!data.limit_one_per_customer) update.max_uses_per_user = null
  if (!data.set_end_date) update.expire_at = null
  // Optional campaign metadata — applyCommonFields only writes the field
  // when non-empty, so an emptied form input would otherwise look like
  // "no change" to the backend and the stale value would persist.
  if (!data.target) update.target = null
  if (data.priority == null) update.priority = null

  if (data.minimum_mode !== "amount" && data.type !== "buy_x_get_y") {
    // `minimum_cart_amount_cents` is non-nullable → backend resets to 0.
    update.minimum_cart_amount_cents = null
  }
  if (data.minimum_mode !== "quantity") update.minimum_quantity = null

  // `max_discount_cents` only applies to percentage AMOUNT_OFF_*. Clear when
  // switching to fixed or when the user empties the field.
  if (data.type === "amount_off_order" || data.type === "amount_off_products") {
    if (data.value_type !== "percentage" || data.max_discount == null) {
      update.max_discount_cents = null
    }
    // Backend rejects `amount_cents` on PERCENTAGE and `percent_bps` on FIXED,
    // so toggling value_type on an existing coupon must clear the stale field.
    if (data.value_type === "percentage") {
      update.amount_cents = null
    } else {
      update.percent_bps = null
    }
  } else {
    update.max_discount_cents = null
    update.amount_cents = null
    update.percent_bps = null
  }

  if (data.type === "buy_x_get_y") {
    if (!data.max_uses_per_order_enabled) update.max_uses_per_order = null
    if (data.buy_mode !== "amount") update.minimum_cart_amount_cents = null
    if (data.get_discount_mode !== "amount") update.get_discount_amount_cents = null

    if (data.scope_mode === "separate") {
      // Separate pools wipe the shared lists so the backend falls back on
      // buy_*/get_*. Clear whichever buy_* / get_* aren't the active mode.
      update.product_ids = []
      update.collection_ids = []
      if (data.buy_applies_to === "collections") {
        update.buy_product_ids = []
      } else if (data.buy_applies_to === "products") {
        update.buy_collection_ids = []
      } else {
        update.buy_product_ids = []
        update.buy_collection_ids = []
      }
      if (data.get_applies_to === "collections") {
        update.get_product_ids = []
      } else if (data.get_applies_to === "products") {
        update.get_collection_ids = []
      } else {
        update.get_product_ids = []
        update.get_collection_ids = []
      }
    } else {
      // Shared pool — clear buy_*/get_* so the backend uses the shared lists,
      // then mirror the scope toggle for the active list.
      update.buy_product_ids = []
      update.buy_collection_ids = []
      update.get_product_ids = []
      update.get_collection_ids = []
      if (data.applies_to === "collections") {
        update.product_ids = []
      } else if (data.applies_to === "products") {
        update.collection_ids = []
      } else {
        update.product_ids = []
        update.collection_ids = []
      }
    }
  }

  if (data.type === "free_shipping" && !data.exclude_shipping_rates) {
    update.exclude_shipping_rates_over_cents = null
  }

  // ── List clears ───────────────────────────────────
  if (data.type === "amount_off_products") {
    // Clear whichever scope is not active so toggling between
    // "specific products" and "collections" wipes the previous list.
    if (data.applies_to === "collections") {
      update.product_ids = []
    } else {
      update.collection_ids = []
    }
  }

  if (data.type === "free_shipping") {
    if (data.countries_mode !== "selected" || !data.countries?.length) {
      update.countries = []
    }
  }

  if (data.eligibility !== "specific_customers") update.customer_ids = []
  if (data.eligibility !== "segment") update.segment_ids = []

  return update
}

type Out = Partial<CreateCouponInput>

function applyCommonFields(out: Out, data: AnyCouponOutput) {
  if (data.code) out.code = data.code
  if (data.language) out.language = data.language
  if (data.target) out.target = data.target
  if (data.priority != null) out.priority = Number(data.priority)
  // Always send timezone so the backend pairs the wall-clock active/expire
  // times with the merchant's actual zone. Fall back to the browser's
  // detected zone when the form omits it.
  out.timezone = data.timezone || detectTimezoneOrUtc()
}

function applyActiveWindow(out: Out, data: AnyCouponOutput) {
  if (data.active_from_date) {
    const time = data.active_from_time || "00:00"
    out.active_from = toWallClock(data.active_from_date, time)
  }
  if (data.set_end_date && data.expire_at_date) {
    const time = data.expire_at_time || "23:59"
    out.expire_at = toWallClock(data.expire_at_date, time)
  }
}

function detectTimezoneOrUtc(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

/**
 * Compose a zone-neutral wall-clock string (`YYYY-MM-DDTHH:mm:ss`) and let
 * the backend convert to UTC using the sibling `timezone` field. Sending a
 * `.toISOString()` here would bake in the *browser's* zone, which is wrong
 * when the merchant edits from a different zone than their shop's.
 */
function toWallClock(date: string, time: string): string {
  return `${date}T${time.length === 5 ? `${time}:00` : time}`
}

function applyMinimumPurchase(out: Out, data: AnyCouponOutput) {
  if (data.minimum_mode === "amount" && data.minimum_cart_amount) {
    out.minimum_cart_amount_cents = majorToCents(Number(data.minimum_cart_amount))
  }
  if (data.minimum_mode === "quantity" && data.minimum_quantity) {
    out.minimum_quantity = Number(data.minimum_quantity)
  }
}

function applyUsageLimits(out: Out, data: AnyCouponOutput) {
  if (data.limit_uses && data.max_uses) {
    out.max_uses = Number(data.max_uses)
  }
  if (data.limit_one_per_customer) {
    out.max_uses_per_user = 1
  }
}

const ELIGIBILITY_MAP: Record<AnyCouponOutput["eligibility"], CouponEligibility> = {
  all_customers: CouponEligibility.AllCustomers,
  specific_customers: CouponEligibility.SpecificCustomers,
  segment: CouponEligibility.Segment,
}

function applyEligibility(out: Out, data: AnyCouponOutput) {
  out.eligibility = ELIGIBILITY_MAP[data.eligibility]
  if (data.eligibility === "specific_customers" && data.customer_ids?.length) {
    out.customer_ids = data.customer_ids
  }
  if (data.eligibility === "segment" && data.segment_ids?.length) {
    out.segment_ids = data.segment_ids
  }
}

function applyMethod(out: Out, data: AnyCouponOutput) {
  out.method = data.method === "automatic" ? CouponMethod.Automatic : CouponMethod.Code
}

function applyCombinations(out: Out, data: AnyCouponOutput) {
  // Always send `is_exclusive` explicitly — updates need to see
  // `false` to un-set a previously-exclusive coupon.
  out.is_exclusive = !!data.is_exclusive
  if (data.is_exclusive) return
  out.combinations = {
    allow_product: !!data.allow_product,
    allow_order: !!data.allow_order,
    allow_shipping: !!data.allow_shipping,
  }
}

const VALUE_TYPE_MAP = {
  percentage: CouponValueType.Percentage,
  fixed: CouponValueType.Fixed,
} as const

function applyAmountOff(
  out: Out,
  data: Extract<
    AnyCouponOutput,
    { type: "amount_off_products" | "amount_off_order" }
  >,
) {
  // Backend contract: PERCENTAGE uses `percent_bps` and rejects a non-null
  // `amount_cents`; FIXED is the inverse. Sending to the wrong field triggers
  // a 422 from the service-level validation.
  out.value_type = VALUE_TYPE_MAP[data.value_type]
  if (data.value_type === "percentage") {
    out.percent_bps = percentToBps(Number(data.amount))
  } else {
    out.amount_cents = majorToCents(Number(data.amount))
  }
  if (data.value_type === "percentage" && data.max_discount != null) {
    out.max_discount_cents = majorToCents(Number(data.max_discount))
  }
}

function applyProductScope(
  out: Out,
  data: Extract<AnyCouponOutput, { type: "amount_off_products" }>,
) {
  // `applies_to` is an exclusive switch in the UI — backend rejects sending
  // both product_ids and collection_ids populated at the same time. Only
  // include the list that matches the selected scope.
  if (data.applies_to === "collections") {
    if (data.collection_ids?.length) out.collection_ids = data.collection_ids
  } else {
    if (data.product_ids?.length) out.product_ids = data.product_ids
  }
}

function applyBogoScope(
  out: Out,
  data: Extract<AnyCouponOutput, { type: "buy_x_get_y" }>,
) {
  if (data.scope_mode === "separate") {
    // Separate pools — populate buy_* and get_* per their applies_to mode.
    // Backend falls back to shared scope only when both buy_* are empty, so
    // we deliberately leave shared product_ids/collection_ids unset here.
    if (data.buy_applies_to === "products" && data.buy_product_ids?.length) {
      out.buy_product_ids = data.buy_product_ids
    } else if (
      data.buy_applies_to === "collections" &&
      data.buy_collection_ids?.length
    ) {
      out.buy_collection_ids = data.buy_collection_ids
    }
    if (data.get_applies_to === "products" && data.get_product_ids?.length) {
      out.get_product_ids = data.get_product_ids
    } else if (
      data.get_applies_to === "collections" &&
      data.get_collection_ids?.length
    ) {
      out.get_collection_ids = data.get_collection_ids
    }
    return
  }

  // Shared pool — exclusive-switch semantics match AMOUNT_OFF_PRODUCTS.
  // "all" sends neither list, meaning any product qualifies.
  if (data.applies_to === "collections") {
    if (data.collection_ids?.length) out.collection_ids = data.collection_ids
  } else if (data.applies_to === "products") {
    if (data.product_ids?.length) out.product_ids = data.product_ids
  }
}

const BOGO_DISCOUNT_TYPE_MAP = {
  percent: BogoDiscountType.Percent,
  amount: BogoDiscountType.Amount,
  free: BogoDiscountType.Free,
} as const

function applyBogo(
  out: Out,
  data: Extract<AnyCouponOutput, { type: "buy_x_get_y" }>,
) {
  out.buy_quantity = Number(data.buy_quantity)
  out.get_quantity = Number(data.get_quantity)
  out.get_discount_type = BOGO_DISCOUNT_TYPE_MAP[data.get_discount_mode]

  if (data.get_discount_mode === "percent") {
    out.get_discount_percent_bps = percentToBps(
      Number(data.get_discount_percent ?? 0),
    )
  } else if (data.get_discount_mode === "amount" && data.get_discount_amount) {
    out.get_discount_amount_cents = majorToCents(Number(data.get_discount_amount))
  }

  if (data.max_uses_per_order_enabled && data.max_uses_per_order) {
    out.max_uses_per_order = Number(data.max_uses_per_order)
  }

  // Shopify's "Customer buys: minimum purchase amount" maps onto the
  // shared minimum_cart_amount_cents field — the BOGO payload itself only
  // carries quantity, so the amount threshold piggybacks on the base.
  if (data.buy_mode === "amount" && data.buy_amount) {
    out.minimum_cart_amount_cents = majorToCents(Number(data.buy_amount))
  }
}

function applyFreeShipping(
  out: Out,
  data: Extract<AnyCouponOutput, { type: "free_shipping" }>,
) {
  if (data.countries_mode === "selected" && data.countries?.length) {
    out.countries = data.countries
  }
  if (data.exclude_shipping_rates && data.exclude_shipping_rates_over) {
    out.exclude_shipping_rates_over_cents = majorToCents(
      Number(data.exclude_shipping_rates_over),
    )
  }
}

