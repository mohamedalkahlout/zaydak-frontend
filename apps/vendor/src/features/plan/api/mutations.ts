import { gql } from "@apollo/client"

/**
 * Self-serve billing. Both mutations hand back a Stripe-hosted URL and write
 * nothing.
 *
 * The subscription only exists once Stripe's webhook says the payment
 * succeeded — the redirect back is not proof of anything, so this screen must
 * refetch on return rather than assume the new plan is live. Stripe's webhook
 * usually lands within a second, but "usually" is not a guarantee the UI can
 * make on its own.
 */
export const START_PLAN_CHECKOUT = gql`
  mutation StartPlanCheckout($input: StartPlanCheckoutInput!) {
    startPlanCheckout(input: $input) {
      success
      message
      data {
        url
      }
    }
  }
`

/**
 * Move an existing subscription onto another plan.
 *
 * **Not a redirect.** A shop that already pays has a card on file, so the
 * difference is charged in place — sending it back through Checkout would open
 * a SECOND Stripe subscription and bill it for both. Upgrades apply at once;
 * downgrades are scheduled for the end of the period already paid for, and come
 * back with `applied: false`.
 */
export const CHANGE_PLAN_SUBSCRIPTION = gql`
  mutation ChangePlanSubscription($input: StartPlanCheckoutInput!) {
    changePlanSubscription(input: $input) {
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
        applied
      }
    }
  }
`

/** Cards, invoices and cancellation — all hosted by Stripe, none rebuilt here. */
export const OPEN_BILLING_PORTAL = gql`
  mutation OpenBillingPortal {
    openBillingPortal {
      success
      message
      data {
        url
      }
    }
  }
`

/**
 * Re-read the subscription from Stripe and answer with the resulting plan.
 *
 * **The repair for a webhook that never arrived.** `myPlan` reads a row only
 * the webhook writes, so a lost `checkout.session.completed` leaves a paying
 * shop looking unsubscribed forever — no refetch of `myPlan` can ever fix it,
 * because there is nothing new to read. This asks Stripe instead.
 *
 * Only the return-from-checkout poll calls it: it costs a Stripe round trip,
 * so it does not belong on a query the plan screen runs on every render.
 */
export const SYNC_MY_SUBSCRIPTION = gql`
  mutation SyncMySubscription {
    syncMySubscription {
      success
      message
      data {
        is_fallback
        status
        interval
        current_period_end
        cancel_at_period_end
        plan {
          id
          code
          name
          name_ar
        }
      }
    }
  }
`

/**
 * Stop the subscription at the end of the period already paid for.
 *
 * Not immediate: the shop keeps its plan until `effective_at`, because it
 * bought those days and Stripe refunds none of them. Reversible until then.
 */
export const CANCEL_MY_SUBSCRIPTION = gql`
  mutation CancelMySubscription {
    cancelMySubscription {
      success
      message
      data {
        effective_at
      }
    }
  }
`

/** Undo a pending cancellation, any time before it takes effect. */
export const RESUME_MY_SUBSCRIPTION = gql`
  mutation ResumeMySubscription {
    resumeMySubscription {
      success
      message
      data {
        effective_at
      }
    }
  }
`
