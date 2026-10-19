import { gql } from "@/shared/api/generated"

/**
 * Plans console operations.
 *
 * Every write here is gated on the `manage_plans` permission
 * (`plans.resolver.ts`, `@RequirePermissions(Permission.MANAGE_PLANS)`), which
 * is granted to `admin` and `super_admin` and carried by no vendor role. The
 * whole surface is **platform-scoped: no X-SHOP header on any of it** — this
 * app does not send one anyway.
 *
 * Units: money crosses the API as **integer cents**, the same unit the database
 * stores. The form takes human-friendly major units and converts at the network
 * boundary (see `plan-form-dialog.tsx`), never inside a render.
 *
 * Quota units: `limit_value` is `null` for **unlimited** and `0` for a real
 * allowance of none — the two are not interchangeable, and the form keeps them
 * distinct rather than collapsing an empty input to zero.
 */

export const ADMIN_PLANS = gql(`
  query AdminPlans {
    allPlans {
      success
      data {
        id
        code
        name
        name_ar
        description
        monthly_price_cents
        yearly_price_cents
        currency
        trial_days
        is_public
        is_active
        sort_order
      }
    }
  }
`)

/**
 * The capability catalog, each row carrying the JSON Schema for its `config`.
 *
 * `config_schema` is what lets `config-field.tsx` render the right control per
 * capability from data — a new capability never needs a hand-written form here,
 * and the form cannot disagree with the server's validation because both come
 * from the same zod object.
 */
export const ADMIN_FEATURE_CATALOG = gql(`
  query AdminFeatureCatalog {
    featureCatalog {
      success
      data {
        key
        group
        name
        name_ar
        description
        kind
        billing_unit
        period
        is_estimated
        sort_order
        config_schema
      }
    }
  }
`)

/**
 * One plan's matrix, unresolved.
 *
 * Deliberately NOT `myEntitlements`: that resolves a SHOP's map through
 * overrides and the FREE fallback, and is shop-scoped through X-SHOP, which
 * this app never sends. The console edits what the plan itself grants.
 */
export const ADMIN_PLAN_ENTITLEMENTS = gql(`
  query AdminPlanEntitlements($plan_id: String!) {
    planEntitlements(plan_id: $plan_id) {
      success
      data {
        feature_key
        enabled
        limit_value
        config
      }
    }
  }
`)

/**
 * The subscriber list.
 *
 * Returns **history as well as the live row** — a shop that has changed plan
 * three times has three rows, which is the point of keeping them. The status
 * filter is what narrows it to current subscribers.
 *
 * `is_stripe_billed` decides what the row's actions may offer: a Stripe
 * subscription renews by charging a card, so renewal is not the admin's to
 * grant, and cancelling it has to reach Stripe.
 */
export const ADMIN_SHOP_SUBSCRIPTIONS = gql(`
  query AdminShopSubscriptions(
    $plan_id: String
    $shop_id: String
    $statuses: [SubscriptionStatus!]
    $search: String
    $page: Int
    $limit: Int
  ) {
    shopSubscriptions(
      plan_id: $plan_id
      shop_id: $shop_id
      statuses: $statuses
      search: $search
      page: $page
      limit: $limit
    ) {
      success
      data {
        id
        shop_id
        shop_slug
        shop_name
        plan_id
        plan_code
        status
        interval
        current_period_start
        current_period_end
        trial_ends_at
        price_cents_snapshot
        is_stripe_billed
        cancel_at_period_end
        canceled_at
        pending_plan_code
        pending_change_at
        created_at
      }
      meta {
        total
        page
        limit
        total_pages
      }
    }
  }
`)

export const ADMIN_SHOP_OVERRIDES = gql(`
  query AdminShopOverrides($shop_id: String!) {
    shopOverrides(shop_id: $shop_id) {
      success
      data {
        id
        feature_key
        enabled
        limit_value
        config
        expires_at
        note
        created_by
        created_at
      }
    }
  }
`)

export const ADMIN_CREATE_PLAN = gql(`
  mutation AdminCreatePlan($input: CreatePlanInput!) {
    createPlan(input: $input) {
      success
      message
      data { id code name monthly_price_cents yearly_price_cents is_public }
    }
  }
`)

export const ADMIN_UPDATE_PLAN = gql(`
  mutation AdminUpdatePlan($input: UpdatePlanInput!) {
    updatePlan(input: $input) {
      success
      message
      data { id code name monthly_price_cents yearly_price_cents is_public is_active }
    }
  }
`)

export const ADMIN_DELETE_PLAN = gql(`
  mutation AdminDeletePlan($id: String!) {
    deletePlan(id: $id) { success message }
  }
`)

/**
 * Saves the entitlement matrix.
 *
 * A **patch, not a replacement** on the server: capabilities absent from the
 * input keep their rows. That is what lets this console send only the group the
 * admin actually edited without wiping every other capability.
 */
export const ADMIN_SET_PLAN_ENTITLEMENTS = gql(`
  mutation AdminSetPlanEntitlements($input: SetPlanEntitlementsInput!) {
    setPlanEntitlements(input: $input) { success message }
  }
`)

/**
 * Put a shop on a plan by hand.
 *
 * **This takes over the shop's billing.** The row it writes is ours, not
 * Stripe's, so the server ends any Stripe subscription it supersedes — the
 * shop stops being charged and starts being granted. Irreversible from here:
 * getting back onto Stripe means the vendor going through Checkout again.
 */
export const ADMIN_ASSIGN_SHOP_PLAN = gql(`
  mutation AdminAssignShopPlan($input: AssignShopPlanInput!) {
    assignShopPlan(input: $input) {
      success
      message
      data { id shop_slug plan_code status interval price_cents_snapshot }
    }
  }
`)

export const ADMIN_CANCEL_SHOP_SUBSCRIPTION = gql(`
  mutation AdminCancelShopSubscription($shop_id: String!) {
    cancelShopSubscription(shop_id: $shop_id) { success message }
  }
`)

/**
 * Re-read one shop's subscription from Stripe and repair the row.
 *
 * For "this store paid but shows as unsubscribed". Our row is written by
 * webhooks only, so a delivery that never landed leaves it permanently wrong
 * and refreshing cannot fix it — there is nothing new to read. This asks
 * Stripe, and collapses any duplicate subscriptions an outage allowed.
 */
export const ADMIN_RECONCILE_SHOP_SUBSCRIPTION = gql(`
  mutation AdminReconcileShopSubscription($shop_id: String!) {
    reconcileShopSubscription(shop_id: $shop_id) { success message }
  }
`)

/**
 * Push a hand-assigned subscription out by another period.
 *
 * Refused for a Stripe-billed subscription — that renewal is a card being
 * charged, and a date moved here would be a promise nothing collects on.
 */
export const ADMIN_RENEW_SHOP_SUBSCRIPTION = gql(`
  mutation AdminRenewShopSubscription($input: RenewShopSubscriptionInput!) {
    renewShopSubscription(input: $input) {
      success
      message
      data { id shop_slug plan_code status current_period_end }
    }
  }
`)

/**
 * Zero a shop's consumed quota — one capability, or all of them.
 *
 * The counterpart to an override, which can only raise the ceiling. A shop
 * that has spent 200 of 200 images needs the counter back at zero; no amount
 * of raising the limit is the same thing.
 */
export const ADMIN_RESET_SHOP_USAGE = gql(`
  mutation AdminResetShopUsage($input: ResetShopUsageInput!) {
    resetShopUsage(input: $input) { success message }
  }
`)

export const ADMIN_SET_SUBSCRIPTION_OVERRIDE = gql(`
  mutation AdminSetSubscriptionOverride($input: SetSubscriptionOverrideInput!) {
    setSubscriptionOverride(input: $input) { success message }
  }
`)

/**
 * The usage ledger — one row per metered call, across shops or scoped to one.
 *
 * `usage_events` is written by the entitlements engine: `commit`/`release` on
 * the reservation path, and `record` for the capabilities that meter themselves
 * (AI images, where the generation rows are the count). Nothing writes it from
 * here — this console can read the history and never rewrite it.
 *
 * `cost_cents` is what the platform paid a provider for that call. It is on the
 * admin projection only; the vendor's own `myUsageEvents` withholds it.
 */
export const ADMIN_USAGE_LEDGER = gql(`
  query AdminUsageLedger(
    $shop_id: String
    $feature_key: String
    $from: DateTime
    $to: DateTime
    $page: Int
    $limit: Int
  ) {
    usageLedger(
      shop_id: $shop_id
      feature_key: $feature_key
      from: $from
      to: $to
      page: $page
      limit: $limit
    ) {
      success
      data {
        id
        shop_id
        shop_slug
        shop_name
        feature_key
        feature_name
        quantity
        billing_unit
        cost_cents
        ref_type
        ref_id
        user_id
        released
        created_at
      }
      meta {
        total
        page
        limit
        total_pages
      }
    }
  }
`)

/** The same history, totalled per capability over the window. */
export const ADMIN_USAGE_SUMMARY = gql(`
  query AdminUsageSummary($shop_id: String, $from: DateTime, $to: DateTime) {
    usageSummary(shop_id: $shop_id, from: $from, to: $to) {
      success
      data {
        feature_key
        feature_name
        group
        events
        quantity
        cost_cents
      }
    }
  }
`)
