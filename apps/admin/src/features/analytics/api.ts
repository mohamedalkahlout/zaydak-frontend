import { gql } from "@/shared/api/generated"

/**
 * Platform analytics.
 *
 * **Every operation here is an existing shop-scoped vendor query being called
 * with no `X-SHOP` header.** That is not a trick — it is how the back-end is
 * built. `AnalyticsResolver.resolveShopId` returns `undefined` when no shop is
 * resolved, and the service's `shopFilter(undefined)` then omits the shop
 * predicate entirely, so the same SQL aggregates the whole marketplace. This
 * app sends no `X-SHOP` link, so it gets the platform figures by construction.
 *
 * The guard that would normally stand in the way returns early for platform
 * staff, deliberately and with a comment saying so: `ShopOwnershipGuard`
 * bypasses for `admin`/`super_admin`. The resolver carries no `FeatureGuard`
 * — analytics is on every plan, so there is no plan gate to bypass.
 *
 * Money: every figure on this screen is **integer cents** — `analytics`
 * (`total_revenue_cents`, `todays_revenue_cents`), `yearlySales` (`total_cents`),
 * `topProducts` (`total_sales_cents`) and `usageSummary`/`usageTopShops`
 * (`cost_cents`) alike. They render through `formatAmountCents` (grouped) or
 * `formatCompactCents` (the bar axis) — see `lib/analytics.ts`.
 */

/**
 * The whole overview in one round trip: headline figures, the monthly revenue
 * series, and the order-status split. Batched because all three are read
 * together on first paint and none of them takes a filter the others don't.
 */
export const ADMIN_PLATFORM_ANALYTICS = gql(`
  query AdminPlatformAnalytics($year: Int) {
    analytics {
      success
      data {
        total_revenue_cents
        todays_revenue_cents
        total_orders
        total_refunds
        total_shops
        total_vendors
        new_customers
      }
    }
    yearlySales(year: $year) {
      success
      data {
        month
        total_cents
      }
    }
    ordersByStatus {
      success
      data {
        pending
        processing
        at_local_facility
        out_for_delivery
        completed
        cancelled
        refunded
        failed
      }
    }
  }
`)

/**
 * What the platform paid third-party providers, and which stores spent it.
 *
 * This is the genuinely admin-only half of the screen. `cost_cents` is our
 * margin against a vendor's subscription and the vendor's own `myUsageEvents`
 * is a projection with the field removed — it exists nowhere they can reach.
 * Both operations are gated on `manage_plans` alone (`plans.resolver.ts`), and
 * both take `shop_id`-free arguments here so they aggregate every store.
 */
export const ADMIN_PLATFORM_COST = gql(`
  query AdminPlatformCost($from: DateTime, $limit: Int, $planId: String) {
    usageSummary(from: $from) {
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
    usageTopShops(from: $from, limit: $limit) {
      success
      data {
        shop_id
        shop_name
        shop_slug
        events
        quantity
        cost_cents
      }
    }
    aiSpendByShop(from: $from, limit: $limit, plan_id: $planId) {
      success
      data {
        shop_id
        shop_slug
        shop_name
        plan_id
        plan_name
        sidekick_cents
        customer_bot_cents
        images_cents
        other_cents
        total_cents
      }
    }
    aiSpendByPlan(from: $from, plan_id: $planId) {
      success
      data {
        plan_id
        plan_code
        plan_name
        shop_count
        sidekick_cents
        customer_bot_cents
        images_cents
        other_cents
        total_cents
      }
    }
  }
`)

/**
 * Sales split by where each order was placed, across every store: the
 * storefront, a shop's Telegram or WhatsApp assistant, or a converted draft.
 *
 * Its own document, not a field on `AdminPlatformAnalytics`: the console ships
 * before the API is rebuilt, and an API that does not know `salesByChannel`
 * rejects the whole document it sits in. Kept apart, only this panel is left
 * out. With no `X-SHOP` the resolver passes no shop, so the report covers the
 * marketplace in UTC with every row `connected: true`; `connected`, `share_bps`
 * and the per-day `series` are not selected because the panel reads none of
 * them (shares are recomputed over the positive total, as on the vendor side).
 */
export const ADMIN_PLATFORM_SALES_BY_CHANNEL = gql(`
  query AdminPlatformSalesByChannel($input: SalesByChannelInput!) {
    salesByChannel(input: $input) {
      success
      data {
        total_sales_cents
        orders_count
        rows {
          channel
          total_sales_cents
          orders_count
          returns_cents
          customers_count
          previous_total_sales_cents
        }
      }
    }
  }
`)

/** Best sellers across every store, ranked by sales value rather than order count. */
export const ADMIN_PLATFORM_TOP_PRODUCTS = gql(`
  query AdminPlatformTopProducts($limit: Int!) {
    topProducts(limit: $limit, by: SALES) {
      success
      data {
        id
        name
        slug
        orders_count
        total_sales_cents
      }
    }
  }
`)
