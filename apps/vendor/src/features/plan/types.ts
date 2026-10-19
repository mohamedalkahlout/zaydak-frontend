/**
 * Hand-written types mirroring the back-end plans schema.
 *
 * Money is **integer cents** and quota limits are whole units of
 * `billing_unit`. `limit_value: null` means **unlimited** — deliberately not
 * the `0 = unlimited` convention the AI image env var used, so a plan can grant
 * a real allowance of none.
 */

export type CapabilityKind = "BOOLEAN" | "LIMIT" | "QUOTA"
export type QuotaPeriod = "NONE" | "DAY" | "MONTH" | "YEAR"
export type EntitlementSource = "OVERRIDE" | "PLAN" | "DENIED"

export interface PlanEntry {
  id: string
  code: string
  name: string
  name_ar?: string | null
  description?: string | null
  description_ar?: string | null
  monthly_price_cents: number
  yearly_price_cents: number
  currency: string
  trial_days: number
  is_public: boolean
  is_active: boolean
  sort_order: number
}

export interface MyPlanEntry {
  plan: PlanEntry
  subscription_id?: string | null
  status?: string | null
  interval?: string | null
  current_period_start?: string | null
  current_period_end?: string | null
  trial_ends_at?: string | null
  cancel_at_period_end?: boolean | null
  /** True when no live subscription exists and the shop falls back to FREE. */
  is_fallback: boolean
  /**
   * True when the live subscription is Stripe's. False for a row an admin
   * assigned by hand, which has no `external_ref` and therefore nothing Stripe
   * can be asked to move — such a shop starts at Checkout like any other, and
   * without this field the picker could not tell the two apart.
   */
  is_stripe_billed: boolean
  /**
   * True when this deployment has Stripe configured. Says nothing about this
   * shop — the picker is hidden when it is false, because every button in it
   * would fail.
   */
  billing_enabled: boolean
  /** True when the shop has a Stripe customer, so the portal has something to open. */
  has_billing_account: boolean
  /**
   * Whether a free trial is still available to the **owner** of this shop —
   * not to this shop.
   *
   * Creating a shop is free, so a per-shop rule let one account start a fresh
   * fourteen days whenever the last set ran out. The cards read this so they
   * stop advertising a trial to someone who will be charged on day one;
   * refusing it silently at checkout is the same lie told a step later.
   */
  trial_available: boolean
  /**
   * A downgrade already scheduled for `pending_change_at`.
   *
   * The shop is still on `plan` and keeps its capabilities until then — it paid
   * for them. Shown so a vendor who downgraded is not left thinking the button
   * did nothing.
   */
  pending_plan?: Pick<PlanEntry, "id" | "code" | "name" | "name_ar"> | null
  pending_change_at?: string | null
}

export type BillingInterval = "MONTHLY" | "YEARLY"

/** Shared by the quote and the result of a plan change. */
export interface PlanChangeSummary {
  from_plan_code: string
  to_plan_code: string
  to_plan_name: string
  interval: BillingInterval
  /** True when it applies now. False for a downgrade, which waits. */
  is_upgrade: boolean
  /**
   * True when the change ends a running free trial, because the target tier
   * grants none. The vendor pays in full instead of nothing, so the dialog has
   * to say so before they confirm.
   */
  ends_trial: boolean
  effective_at: string
  currency: string
}

/** Stripe's own proration, in integer cents. Nothing here is computed locally. */
export interface PlanChangePreview extends PlanChangeSummary {
  /** Charged on confirm. Zero for a scheduled downgrade. */
  amount_due_now_cents: number
  /** Credit for unused time on the current plan, as a positive number. */
  credit_cents: number
  /** Charge for the rest of the period on the new plan. */
  charge_cents: number
  next_invoice_at: string
  next_invoice_cents: number
}

export interface PlanChangeResult extends PlanChangeSummary {
  /** False when the change was scheduled rather than applied. */
  applied: boolean
}

/**
 * One invoice, read live from Stripe.
 *
 * `amount_cents` is what was actually collected, not what was billed — a partly
 * paid or credited invoice must not read as fully collected.
 */
export interface InvoiceEntry {
  id: string
  number?: string | null
  /** `draft` | `open` | `paid` | `uncollectible` | `void`. */
  status?: string | null
  created_at: string
  amount_cents: number
  currency: string
  /** Stripe-hosted receipt page. Null on a draft. */
  hosted_url?: string | null
  pdf_url?: string | null
}

export interface EntitlementEntry {
  key: string
  group: string
  name: string
  name_ar?: string | null
  kind: CapabilityKind
  billing_unit: string
  period: QuotaPeriod
  enabled: boolean
  /** Null = unlimited. Always null for BOOLEAN. */
  limit_value?: number | null
  config: Record<string, unknown>
  source: EntitlementSource
}

export interface UsageEntry {
  key: string
  billing_unit: string
  used: number
  limit_value?: number | null
  /** Null when unlimited; clamped at zero so an over-quota shop reads "none left". */
  remaining?: number | null
  period_start: string
  period_end: string
}

export interface CapabilityEntry {
  key: string
  group: string
  name: string
  name_ar?: string | null
  description?: string | null
  description_ar?: string | null
  kind: CapabilityKind
  billing_unit: string
  period: QuotaPeriod
  is_estimated?: boolean
  sort_order: number
}

/**
 * One cell of the public comparison table.
 *
 * Carries no `config` — the server withholds it, because the knobs a capability
 * runs on are not part of what the plan sells.
 */
export interface PlanCapabilityEntry {
  feature_key: string
  enabled: boolean
  /** Null = unlimited. Always null for BOOLEAN. */
  limit_value?: number | null
}

/** One public plan's column in the comparison table. */
export interface PlanComparisonEntry {
  plan_id: string
  capabilities: PlanCapabilityEntry[]
}

/**
 * One line of the shop's own usage history.
 *
 * The counter (`UsageEntry`) answers "how much is left this period"; this
 * answers "on what, when, and by whom". It deliberately carries **no cost** —
 * `cost_cents` is what the platform paid a provider for the call, and the
 * server projects it away before a vendor can select it.
 */
export interface UsageEventEntry {
  id: string
  feature_key: string
  /** The capability's display name, or the raw key if the catalog dropped it. */
  feature_name: string
  quantity: number
  billing_unit: string
  /** What it was for, e.g. ('ai_image_generation', <id>). */
  ref_type?: string | null
  ref_id?: string | null
  /** Who asked. Null for work no user initiated — a job, a webhook. */
  user_id?: string | null
  /** A refund: the work failed and the allowance was handed back. */
  released: boolean
  created_at: string
}

/** Per-capability totals over the window the usage screen opens on. */
export interface UsageSummaryEntry {
  feature_key: string
  feature_name: string
  group: string
  /** Calls made, as opposed to units they consumed. */
  events: number
  quantity: number
}

export interface PageMeta {
  total: number
  page: number
  limit: number
  total_pages: number
}

/**
 * One visitor's share of the customer-AI allowance.
 *
 * `label` is **already masked** by the server — a phone number arrives as
 * `+97*******08`, a guest as a four-character suffix. Print it; never try to
 * shorten or re-mask it here.
 */
export interface AiSpenderEntry {
  key: string
  /**
   * `WHATSAPP` | `TELEGRAM` | `CONTACT_FORM` | `STOREFRONT` |
   * `STOREFRONT_GUEST` | `NEGOTIATION`.
   */
  channel: string
  label: string | null
  /** Answered turns charged to this visitor this period. */
  turns: number
  last_turn_at: string
  /** The inbox thread, on the channels that have one. Null elsewhere. */
  conversation_id: string | null
}

/**
 * The breakdown, and how much of the meter it explains.
 *
 * `unattributed_turns` is not a rounding error and the screen renders it:
 * refunded turns and spend from before attribution shipped land there. A list
 * shown as though it summed to the meter would be a claim we cannot support.
 */
export interface AiSpenders {
  rows: AiSpenderEntry[]
  unattributed_turns: number
  /** The meter itself, not a sum of the rows above. */
  total_turns: number
  period_start: string
  period_end: string
}
