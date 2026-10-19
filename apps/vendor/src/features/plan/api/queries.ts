import { gql } from "@apollo/client"

/**
 * The shop's plan, what it grants, and what is left of it.
 *
 * `myEntitlements` returns the **resolved** map — override-over-plan precedence
 * is applied server-side, so nothing here re-implements it. Read it once and
 * cache it: a UI that gates twenty buttons needs one query, not twenty.
 *
 * Money is integer cents; quota limits are whole units of `billing_unit`, and
 * `limit_value: null` means unlimited.
 */
export const GET_MY_PLAN = gql`
  query MyPlan {
    myPlan {
      success
      data {
        is_fallback
        is_stripe_billed
        billing_enabled
        has_billing_account
        trial_available
        subscription_id
        status
        interval
        current_period_start
        current_period_end
        trial_ends_at
        cancel_at_period_end
        pending_change_at
        pending_plan {
          id
          code
          name
          name_ar
        }
        plan {
          id
          code
          name
          name_ar
          description
          description_ar
          monthly_price_cents
          yearly_price_cents
          currency
          trial_days
        }
      }
    }
  }
`

export const GET_MY_ENTITLEMENTS = gql`
  query MyEntitlements {
    myEntitlements {
      success
      data {
        key
        group
        name
        name_ar
        kind
        billing_unit
        period
        enabled
        limit_value
        config
        source
      }
    }
  }
`

/**
 * Consumption per metered capability in the current window.
 *
 * Read fresh, never from a cached "remaining" — the counter changes the moment
 * anything is consumed, and a stale number on a quota meter is the one number a
 * vendor will act on.
 */
export const GET_MY_USAGE = gql`
  query MyUsage {
    myUsage {
      success
      data {
        key
        billing_unit
        used
        limit_value
        remaining
        period_start
        period_end
      }
    }
  }
`

/** The public tiers, for the comparison table. */
export const GET_PLANS = gql`
  query Plans {
    plans {
      success
      data {
        id
        code
        name
        name_ar
        description
        description_ar
        monthly_price_cents
        yearly_price_cents
        currency
        trial_days
      }
    }
  }
`

/**
 * The comparison table's two halves.
 *
 * `featureCatalog` is the ROWS — every capability the product sells, already
 * grouped and ordered, carrying the unit each is metered in. `planComparison`
 * is the CELLS — what each public tier grants. Neither is shop-scoped, so both
 * cache for the session and a capability added next month appears as a new row
 * with no change to the table.
 */
export const GET_FEATURE_CATALOG = gql`
  query FeatureCatalog {
    featureCatalog {
      success
      data {
        key
        group
        name
        name_ar
        description
        description_ar
        kind
        billing_unit
        period
        sort_order
      }
    }
  }
`

/**
 * What switching plans would cost, before switching.
 *
 * A query because it creates nothing at Stripe — it runs the same proration
 * engine the real change will, so the figure in the dialog is the figure on the
 * invoice. Fetched `network-only`: a cached quote is a quote for a different
 * moment in the billing period, and the amount moves by the second.
 */
export const PREVIEW_PLAN_CHANGE = gql`
  query PreviewPlanChange($input: StartPlanCheckoutInput!) {
    previewPlanChange(input: $input) {
      success
      message
      data {
        from_plan_code
        to_plan_code
        to_plan_name
        interval
        is_upgrade
        ends_trial
        effective_at
        currency
        amount_due_now_cents
        credit_cents
        charge_cents
        next_invoice_at
        next_invoice_cents
      }
    }
  }
`

export const GET_PLAN_COMPARISON = gql`
  query PlanComparison {
    planComparison {
      success
      data {
        plan_id
        capabilities {
          feature_key
          enabled
          limit_value
        }
      }
    }
  }
`

/**
 * The shop's invoices, read live from Stripe.
 *
 * Not mirrored in our database — Stripe owns the numbering, the tax lines and
 * the PDF an accountant is shown, and a local copy of the same money is free to
 * drift from that one. `hosted_url` is a Stripe-hosted receipt page, so nothing
 * here renders a document.
 */
export const GET_MY_INVOICES = gql`
  query MyInvoices($limit: Int) {
    myInvoices(limit: $limit) {
      success
      data {
        id
        number
        status
        created_at
        amount_cents
        currency
        hosted_url
        pdf_url
      }
    }
  }
`

/**
 * The shop's usage history — one row per metered call.
 *
 * `myUsage` is the counter and answers "how much is left"; this is the ledger
 * behind it and answers "on what". The shop comes from the X-SHOP header, never
 * an argument, and the server withholds `cost_cents` from this projection — it
 * is what we paid a provider, not what the vendor was charged.
 *
 * Defaults to the last 30 days server-side. `usage_events` is append-only and
 * grows with every call, so an unbounded first page would be a scan of the
 * shop's whole history.
 */
export const GET_MY_USAGE_EVENTS = gql`
  query MyUsageEvents(
    $feature_key: String
    $from: DateTime
    $to: DateTime
    $page: Int
    $limit: Int
  ) {
    myUsageEvents(
      feature_key: $feature_key
      from: $from
      to: $to
      page: $page
      limit: $limit
    ) {
      success
      data {
        id
        feature_key
        feature_name
        quantity
        billing_unit
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
`

/** The same history, totalled per capability over the window. */
export const GET_MY_USAGE_SUMMARY = gql`
  query MyUsageSummary($from: DateTime, $to: DateTime) {
    myUsageSummary(from: $from, to: $to) {
      success
      data {
        feature_key
        feature_name
        group
        events
        quantity
      }
    }
  }
`

/**
 * Who spent the customer-AI allowance this period.
 *
 * **No window arguments, deliberately.** The server reads the entitlement
 * period — the same one the meters above it report — so the two numbers on this
 * screen cannot drift apart. Passing the screen's rolling `from`/`to` here is
 * the one thing that would break it.
 *
 * The shop comes from `X-SHOP`, never an argument, and `label` arrives already
 * masked: this app has no client-side masker and must not grow one. No cost
 * field is selectable — what the platform paid a provider is not a vendor's
 * business, the same rule `myUsageEvents` keeps.
 */
export const GET_MY_AI_SPENDERS = gql`
  query MyAiSpenders {
    myAiSpenders {
      success
      data {
        rows {
          key
          channel
          label
          turns
          last_turn_at
          conversation_id
        }
        unattributed_turns
        total_turns
        period_start
        period_end
      }
    }
  }
`
