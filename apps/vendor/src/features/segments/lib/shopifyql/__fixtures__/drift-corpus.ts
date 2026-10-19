/**
 * Shared drift-detection corpus — frontend mirror.
 *
 * Kept byte-identical (in content) with the backend's
 * `back-end/.../shopifyql/__fixtures__/drift-corpus.ts`. Both spec
 * suites round-trip every case; divergent behaviour on either side
 * makes one suite fail and we know exactly where to look.
 *
 * See the backend file for the rationale on why behaviour-level
 * drift (not bytewise file drift) is the right abstraction here.
 */

export const DRIFT_CORPUS: ReadonlyArray<readonly [string, string]> = [
  ["amount_spent > 100", "amount_spent > 100"],
  ["number_of_orders >= 5", "number_of_orders >= 5"],
  [
    "email_subscription_status = 'SUBSCRIBED'",
    "email_subscription_status = 'SUBSCRIBED'",
  ],
  ["abandoned_checkout_date IS NULL", "abandoned_checkout_date IS NULL"],
  [
    "abandoned_checkout_date IS NOT NULL",
    "abandoned_checkout_date IS NOT NULL",
  ],
  ["amount_spent BETWEEN 100 AND 999.99", "amount_spent BETWEEN 100 AND 999.99"],
  ["customer_tags CONTAINS 'VIP'", "customer_tags CONTAINS 'VIP'"],
  [
    "customer_tags NOT CONTAINS 'wholesale'",
    "customer_tags NOT CONTAINS 'wholesale'",
  ],
  ["country IN ('SA', 'AE', 'KW')", "country IN ('SA', 'AE', 'KW')"],
  ["country NOT IN ('SA', 'AE')", "country NOT IN ('SA', 'AE')"],
  ["last_order_at >= -7d", "last_order_at >= -7d"],
  [
    "last_order_at BETWEEN -30d AND today",
    "last_order_at BETWEEN -30d AND today",
  ],
  ["sms_subscribed = TRUE", "sms_subscribed = TRUE"],
  [
    "orders_placed MATCHES (count >= 3, date >= -6m)",
    "orders_placed MATCHES (count >= 3, date >= -6m)",
  ],
  [
    "amount_spent > 100 AND number_of_orders >= 5",
    "amount_spent > 100 AND number_of_orders >= 5",
  ],
  [
    "amount_spent > 100 OR number_of_orders >= 5",
    "amount_spent > 100 OR number_of_orders >= 5",
  ],
  [
    "(amount_spent > 100 OR number_of_orders >= 5) AND customer_tags CONTAINS 'VIP'",
    "(amount_spent > 100 OR number_of_orders >= 5) AND customer_tags CONTAINS 'VIP'",
  ],
] as const
