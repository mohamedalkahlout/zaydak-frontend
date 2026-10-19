// Shape of the structured `tool_events[]` that the back-end returns.
// Kept narrow and JSON-safe so Apollo caches it cleanly.

export type VendorAgentRole = "user" | "assistant"

/**
 * How far a running tool has got, from the latest `tool_progress` SSE frame.
 *
 * Live-stream only. Nothing persists it, it never rides in `parts`, and a
 * reloaded conversation has none — the row is finished by then, so there is
 * nothing left to say. Every field is optional because a tool that can only
 * say *what* it is doing (an async enqueue) is still worth hearing from.
 */
export interface VendorAgentToolProgress {
  /** Stage within the tool — `importing`, `applying`, `enqueuing`. Free text
   * from the server; an unrecognized value falls back to the tool's own
   * present-tense label. */
  phase?: string
  done?: number
  total?: number
  /** A specific we cannot translate — a product handle. Quoted verbatim. */
  label?: string
}

export interface VendorAgentToolEvent {
  name: string
  args: Record<string, unknown>
  ok: boolean
  result?: unknown
  error?: string | null
  /** The id the backend issued for this tool call. Present on live events;
   * absent on turns reloaded from the database, which never stored it. It is
   * what binds a `tool_progress` or `tool_result` frame to the right row when
   * one model turn calls the same tool twice. */
  call_id?: string
  /** Latest progress frame, while the call is still running. Cleared when the
   * result lands, so a finished row never carries a stale bar. */
  progress?: VendorAgentToolProgress | null
}

/**
 * One write the agent wants to make that the graph refuses to run without
 * an explicit human decision. Mirrors the backend `ApprovalRequest`.
 *
 * Carries no prose — the vendor-facing sentence is composed here, where
 * next-intl owns localization. `facts` is a server-computed dry run (e.g.
 * `{ affected: 247 }`); `previewed` says whether it is real, so the card can
 * quote a count or honestly stay quiet rather than guess.
 */
export interface AgentApprovalRequest {
  id: string
  tool: string
  args: Record<string, unknown>
  facts: Record<string, unknown>
  previewed: boolean
}

export interface AgentApprovalDecision {
  id: string
  approved: boolean
}

/**
 * One ordered segment of an assistant turn. Preserves the exact
 * chronological interleaving of narration and actions so the transcript
 * renders as a "work log" (say → do → react) instead of a text blob
 * followed by a pile of cards. Mirrors the backend `AssistantPart`.
 *
 * A `tool` part's `event` is the same shape as an entry in `tool_events`.
 *
 * An `approval` part with an empty `decisions` array means the run is still
 * paused — that is how a reloaded thread knows to re-render a live
 * Approve/Reject card instead of a historical record of one.
 *
 * An `error` part is a turn that died on the way — a provider outage, a
 * dropped connection. It rides inside the turn rather than in a banner beside
 * it, so the failure keeps the narration and tool rows that preceded it and a
 * reload shows the same thing the live session did. `retryable` decides whether
 * the vendor is offered a retry or told to wait for the platform team.
 */
export type AssistantPart =
  | { kind: "text"; text: string }
  | { kind: "tool"; event: VendorAgentToolEvent }
  | {
      kind: "approval"
      requests: AgentApprovalRequest[]
      decisions: AgentApprovalDecision[]
    }
  | {
      kind: "error"
      code: string
      message: string
      retryable: boolean
    }

export interface VendorAgentMessage {
  id: string
  role: VendorAgentRole
  content: string
  tool_events?: VendorAgentToolEvent[]
  /** Ordered narration ⇄ action log for assistant turns. Absent on user
   * turns and on legacy assistant turns persisted before parts existed —
   * the renderer falls back to (content + tool_events) for those. */
  parts?: AssistantPart[]
  created_at: string
}

export interface VendorAgentChatResponse {
  vendorAgentChat: {
    reply: string
    conversation_id: string
    tool_events: VendorAgentToolEvent[]
  }
}

export interface VendorAgentChatVariables {
  input: {
    message: string
    conversation_id?: string
    history?: Array<{ role: VendorAgentRole; content: string }>
  }
}

export interface VendorAgentConversationSummary {
  id: string
  title: string | null
  updated_at: string
  message_count: number
  preview: string | null
  pinned_at: string | null
  is_shared: boolean
  share_expires_at: string | null
  has_share_pin: boolean
}

export interface VendorAgentConversationDetail {
  id: string
  title: string | null
  /** The shop's ISO 4217 currency. Selected by the share page only (the
   * dashboard has the active shop), and absent from an API older than the
   * field. */
  currency?: string | null
  created_at: string
  updated_at: string
  messages: Array<{
    id: string
    role: VendorAgentRole
    content: string
    created_at: string
    tool_events: VendorAgentToolEvent[] | null
    parts?: AssistantPart[] | null
  }>
}

export interface VendorAgentConversationsResponse {
  vendorAgentConversations: VendorAgentConversationSummary[]
}

export interface VendorAgentConversationResponse {
  vendorAgentConversation: VendorAgentConversationDetail | null
}

// ── Tool-specific result shapes ──────────────────────────────
// Each tool returns a JSON string; the back-end parses it and
// forwards the object via the `result` field. The UI narrows
// by inspecting `tool.name` + a type guard.

export interface CreateCollectionResult {
  ok: true
  collection: {
    id: string
    name: Record<string, string>
    slug: string
    type: string
    description?: Record<string, string> | null
  }
}

export interface CreateProductResult {
  ok: true
  product: {
    id: string
    name: Record<string, string>
    slug: string
    price_cents: number | null
    sale_price_cents: number | null
    quantity: number
    status: string
    product_type: string
  }
}

export interface ListCollectionsResult {
  found: boolean
  count: number
  total_in_shop: number
  collections: Array<{
    id: string
    name: Record<string, string>
    slug: string
    type: string
    products_count: number
  }>
}

/**
 * One row of the global taxonomy, as the agent's category lookup returns it.
 *
 * `breadcrumb` is the ancestors' display names ("Apparel & Accessories ›
 * Clothing"); `path` is the slug path the tool used to return instead
 * ("apparel-and-accessories/clothing"). Both are optional because turns
 * persisted before the tool was reshaped carry only `path`, and the card has
 * to keep rendering them.
 */
export interface SystemCategoryMatch {
  id: string
  name: string
  breadcrumb?: string
  path?: string
  level: number
}

export interface ListSystemCategoriesResult {
  /** What was actually searched for, after any Arabic label was resolved. */
  query?: string
  locale: string
  /** The one row the tool is confident about, when it is confident. */
  best_match?: SystemCategoryMatch | null
  categories: SystemCategoryMatch[]
  /** How many matched in total, before the result was capped. */
  total?: number
  truncated?: boolean
  /** Legacy fields, still present on stored turns. */
  found?: boolean
  count?: number
}

export interface ToolErrorResult {
  ok: false
  error: string
}

// ── Phase 2 tool result shapes ───────────────────────────────

export interface ProductSummary {
  id: string
  name: Record<string, string>
  slug: string
  price_cents: number | null
  sale_price_cents: number | null
  quantity: number
  status: string
  in_stock: boolean
}

export interface SearchProductsResult {
  ok: true
  total: number
  page: number
  count: number
  products: ProductSummary[]
}

export interface GetProductResult {
  ok: true
  product: ProductSummary & {
    description?: Record<string, string> | null
    product_type: string
    sku?: string | null
    version?: number
  }
}

export interface UpdateProductResult {
  ok: true
  product: ProductSummary & { product_type: string }
}

export interface DeleteProductResult {
  ok: true
  id: string
  message: string
}

/**
 * The four windows `get_shop_stats` takes. In the v2 payload they are
 * shop-local: `today` since local midnight, `weekly` / `monthly` the last 7 /
 * 30 local days including today, `yearly` since local 1 January.
 */
export type ShopStatsPeriod = "today" | "weekly" | "monthly" | "yearly"

export interface OrdersByStatus {
  pending: number
  processing: number
  completed: number
  cancelled: number
  refunded: number
  failed: number
  at_local_facility: number
  out_for_delivery: number
}

/**
 * One channel's share of a period's sales. `channel` is the back-end's
 * `SalesChannel` (`ONLINE_STORE` / `TELEGRAM` / `WHATSAPP` / `DRAFT_ORDER`),
 * typed as a string because a persisted turn outlives any enum: a channel
 * added later still has to render, just without an identity of its own.
 * `sales` is in major units, like every tool payload; `share_pct` has one
 * decimal. The tool lists only channels that sold something or took an
 * order, sorted by `sales` descending.
 */
export interface SalesChannelSlice {
  channel: string
  sales: number
  orders: number
  share_pct: number
}

/**
 * `get_shop_stats` before 2026-09-29, still in every conversation persisted
 * before then. Only `orders.by_status` covered `period`: `revenue.total` and
 * `orders.total` were lifetime, `new_customers` a fixed 30 days, and revenue
 * counted completed orders only — which is why the card labels them that way
 * instead of putting the period over them.
 */
export interface ShopStatsResultV1 {
  ok: true
  version?: undefined
  period: ShopStatsPeriod
  revenue: {
    total: number
    today: number
    /** A lifetime refund count, not money. Never rendered. */
    refunds: number
  }
  orders: {
    total: number
    by_status: OrdersByStatus
  }
  new_customers: number
}

/**
 * `get_shop_stats` v2: every period field covers the same `window`, and a
 * sale is any order placed in it except cancelled and failed ones, net of
 * cancelled slices, minus settled refunds (dated by the refund). Money is
 * major units. `orders.placed` equals the sum of `by_status`.
 */
export interface ShopStatsResultV2 {
  ok: true
  version: 2
  period: ShopStatsPeriod
  currency: string
  window: {
    start: string
    end: string
    /** Shop-local calendar dates, both inclusive. */
    from_date: string
    to_date: string
    days: number
    timezone: string
  }
  /** One English sentence for the model; the card shows its own translation. */
  sales_basis: string
  revenue: {
    period_sales: number
    period_returns: number
    average_order_value: number
    today_sales: number
    lifetime_sales: number
  }
  orders: {
    placed: number
    counted_as_sales: number
    lifetime_placed: number
    by_status: OrdersByStatus
  }
  new_customers: number
  by_channel: SalesChannelSlice[]
}

export type ShopStatsResult = ShopStatsResultV1 | ShopStatsResultV2

/** Keyed on `version` alone: both shapes carry `revenue`, which is what the
 * renderer routes on, so the card is where they part. */
export function isShopStatsV2(
  result: ShopStatsResult,
): result is ShopStatsResultV2 {
  return (result as { version?: unknown }).version === 2
}

export interface LowStockProductsResult {
  ok: true
  threshold: number
  count: number
  products: Array<{
    id: string
    name: Record<string, string>
    slug: string
    quantity: number
  }>
}

// ── Phase 3 tool result shapes ───────────────────────────────

export interface UpdateCollectionResult {
  ok: true
  collection: {
    id: string
    name: Record<string, string>
    slug: string
    type: string
    description?: Record<string, string> | null
  }
}

export interface DeleteCollectionResult {
  ok: true
  id: string
  name: Record<string, string>
  slug: string
  message: string
}

export interface CollectionMembershipResult {
  ok: true
  action: "attached" | "detached"
  collection: {
    id: string
    name: Record<string, string>
    products_count: number | null
  }
  product_id: string
}

export interface TopProductsResult {
  ok: true
  count: number
  /**
   * The window the list covers, in the shop's local calendar days (both
   * inclusive). `null` = all time, and so is a turn from before 2026-09-30,
   * when the tool took no dates and the key is absent. A null `end_date` runs
   * to now; a null `start_date` runs from the shop's first order.
   */
  range?: {
    start_date: string | null
    end_date: string | null
    timezone: string
  } | null
  products: Array<{
    id: string
    name: Record<string, string>
    slug: string
    image?: Record<string, unknown> | null
    orders_count: number
    total_sales: number
  }>
}

// ── Phase 4 analytics result shapes ───────────────────────────

export interface YearlySalesResult {
  ok: true
  year: number
  total: number
  months: Array<{ month: number; total: number }>
}

export interface CategorySalesResult {
  ok: true
  count: number
  categories: Array<{
    category_id: string
    name: string
    slug: string
    product_count: number
    total_quantity_sold: number
  }>
}

/**
 * `get_custom_range_stats` before 2026-09-29. `total_revenue` counted
 * completed orders only, and the "inclusive" `end_date` actually stopped at
 * that day's midnight UTC, so the end day itself was missing.
 */
export interface CustomRangeStatsResultV1 {
  ok: true
  version?: undefined
  range: { start_date: string; end_date: string | null }
  total_orders: number
  total_revenue: number
  completed_orders: number
  cancelled_orders: number
}

/**
 * `get_custom_range_stats` v2. `range` holds shop-local calendar dates and
 * `end_date` is truly inclusive; a null `end_date` means "up to now".
 * `total_revenue` is sales on the same basis as `get_shop_stats` v2, and
 * `total_orders` counts every order placed, of which `sale_orders` counted.
 */
export interface CustomRangeStatsResultV2 {
  ok: true
  version: 2
  currency: string
  range: { start_date: string; end_date: string | null; timezone: string }
  sales_basis: string
  total_revenue: number
  returns: number
  average_order_value: number
  total_orders: number
  sale_orders: number
  completed_orders: number
  cancelled_orders: number
  failed_orders: number
  by_channel: SalesChannelSlice[]
}

export type CustomRangeStatsResult =
  | CustomRangeStatsResultV1
  | CustomRangeStatsResultV2

export function isCustomRangeStatsV2(
  result: CustomRangeStatsResult,
): result is CustomRangeStatsResultV2 {
  return (result as { version?: unknown }).version === 2
}

// ── Coupon tool result shapes ────────────────────────────────
// Money crosses as integer cents / basis points here (read-only surface);
// the coupon cards format via formatMoneyCents / bpsToPercent.

export type CouponType =
  | "amount_off_order"
  | "amount_off_products"
  | "free_shipping"
  | "buy_x_get_y"

export interface CouponSummary {
  id: string
  code: string | null
  type: CouponType
  method: string
  eligibility: string
  status: "scheduled" | "active" | "expired"
  is_active: boolean
  discount_label: string
  amount_cents: number | null
  percent_bps: number | null
  minimum_cart_amount_cents: number
  max_discount_cents: number | null
  currency: string
  times_used: number
  max_uses: number | null
  active_from: string
  expire_at: string | null
}

export interface ListCouponsResult {
  ok: true
  total: number
  count: number
  coupons: CouponSummary[]
}

export interface GetCouponResult {
  ok: true
  coupon: CouponSummary & {
    product_ids: string[]
    collection_ids: string[]
    buy_quantity: number | null
    get_quantity: number | null
    is_exclusive: boolean
  }
}

export interface DeleteCouponResult {
  ok: true
  id: string
  message: string
}

// ── Multi-step progress checklist (set_task_plan tool) ───────

export interface TaskPlanStep {
  title: string
  status: "pending" | "active" | "done"
}

/**
 * The receipt the server writes when the vendor saves what the agent
 * prepared. See `back-end/src/vendor-agent/save-receipt.ts` for why this
 * rides `kind: "tool"` instead of being a part kind of its own.
 */
export interface SaveReceiptResult {
  ok: true
  save_receipt: {
    handoff_id: string
    entity: "product" | "collection" | "coupon"
    action: "created" | "updated"
    name: string
    url?: string
  }
}

export interface TaskPlanResult {
  ok: true
  task_plan: { steps: TaskPlanStep[] }
}

export interface InventoryLocationSummary {
  id: string
  name: string
  city?: string | null
  is_default: boolean
  is_active: boolean
  fulfills_online_orders: boolean
  /** Present only when the tool was asked about one product. */
  available?: number
  committed?: number
}

export interface InventoryLocationsResult {
  ok: true
  count: number
  locations: InventoryLocationSummary[]
}

// ── Navigate-to-form intent (new in Phase 2.1) ────────────────────────────
// Returned by create_product / create_collection / update_product tools
// instead of the tool mutating directly. The UI renders a CTA card that
// stashes `prefill` in sessionStorage and routes to `url`.

export type NavigateTarget =
  | "product_create"
  | "product_edit"
  | "collection_create"
  | "coupon_create"
  | "coupon_edit"
  /**
   * A store import's progress screen (`/products/import/[jobId]`).
   *
   * The odd one out, and deliberately: every other target opens a form with
   * `prefill` staged into it, while this one is a **deep link to work already
   * running** — `scan_store` has queued a crawl and the vendor needs the
   * screen where it reports, approves and shows what it found. So it stages no
   * prefill (there is no form to seed), and it is not in `PrefillTarget`.
   */
  | "store_import"

export interface NavigateToFormEntity {
  id: string
  slug: string
  name: Record<string, string>
}

export interface NavigateToFormResult {
  ok: true
  navigate_to_form: {
    target: NavigateTarget
    url: string
    prefill: Record<string, unknown>
    entity?: NavigateToFormEntity
    /** Where the opening quantity has to end up, when the vendor named a
     * warehouse that is not the shop's default. Deliberately NOT inside
     * `prefill` — the create form has no location control and seeds stock at
     * the default, so this is an instruction for after the save. */
    place_stock_at?: { id: string; name: string; quantity: number }
    /** A follow-up instruction to auto-resume in the chat after the vendor
     * saves this entity (e.g. "make a 15% coupon on it"). Only set for
     * chained requests where the next step needs the new entity's id. */
    next_step?: string
  }
}

// ── Live form patch ───────────────────────────────────────────────────────
// Returned by `patch_form`: a change to the product form the vendor already
// has open, staged into it rather than sent to a new card. See
// `lib/live-form.ts` and `store-live-form.ts`.

/** One field the patch changed. A translatable's `from`/`to` carry only the
 * locale that changed (`{ ar: "…" }`); every other field is the raw value,
 * `from` null when the form had it empty. */
export interface FormPatchChange {
  field: string
  from: unknown
  to: unknown
}

export interface FormPatchResult {
  ok: true
  form_patch: {
    /** Names this patch, so the card can find what became of it. The call
     * id cannot do that job: it is not persisted in `parts`. */
    patch_id: string
    /** The handoff id of the form it is for. */
    form_id: string
    target:
      | "product_create"
      | "product_edit"
      | "coupon_create"
      | "coupon_edit"
      | "collection_create"
    entity_id?: string
    /** In the form's own shape; a translatable carries only the changed
     * locale and is merged over the form's value when applied. `null` empties
     * the field (`patch_form`'s `clear`). */
    values: Record<string, unknown>
    changed: FormPatchChange[]
  }
}
