import type { LucideIcon } from "lucide-react"
import {
  ArrowRightLeftIcon,
  BadgePercentIcon,
  BanknoteIcon,
  CalendarClockIcon,
  ChartNoAxesCombinedIcon,
  FileTextIcon,
  GaugeIcon,
  HeartIcon,
  LanguagesIcon,
  MegaphoneIcon,
  MessageCircleQuestionIcon,
  ReceiptIcon,
  RotateCcwIcon,
  SearchCheckIcon,
  ShoppingCartIcon,
  StarIcon,
  TruckIcon,
  UsersIcon,
  BoxesIcon,
  ClipboardListIcon,
  DownloadIcon,
  FolderIcon,
  FolderPlusIcon,
  LayersIcon,
  ListChecksIcon,
  PackageIcon,
  PackagePlusIcon,
  PackageSearchIcon,
  PencilIcon,
  SparklesIcon,
  TagIcon,
  TagsIcon,
  Trash2Icon,
  TrendingUpIcon,
  UploadIcon,
  WarehouseIcon,
  WrenchIcon,
} from "lucide-react"
import type { Translate } from "@/shared/i18n/translator"
import type {
  VendorAgentToolEvent,
  VendorAgentToolProgress,
} from "./types"

export type Locale = "ar" | "en"

/**
 * Turns a raw tool event into a human-readable action row: an icon, a
 * present-tense label for while it runs ("Searching products…"), and a
 * resolved label for after it lands ("Found 4 products"). This is what makes
 * the assistant turn read like a Shopify-style work log instead of exposing
 * raw tool names like `search_products`.
 *
 * The copy lives in `aiChat.toolLog` — `tools.<name>.running` and
 * `tools.<name>.done` for every tool in the table below — and the caller hands
 * in a translator scoped to that namespace. This table keeps only what is not
 * copy: the icon, and for count-bearing tools the rule that picks a label from
 * the finished result. Everything falls back to a sensible generic when a tool
 * isn't in the table, so a newly-added backend tool degrades gracefully rather
 * than crashing the row.
 */
interface ToolDescriptor {
  icon: LucideIcon
  /** Picks the resolved label from the finished event. Omitted when the
   * tool's plain `done` message is the whole story. `t` is scoped to the
   * tool's own messages (`aiChat.toolLog.tools.<name>`). */
  done?: (event: VendorAgentToolEvent, t: Translate) => string
}

function bool(result: unknown, key: string): boolean {
  if (typeof result !== "object" || result === null) return false
  return (result as Record<string, unknown>)[key] === true
}

function n(result: unknown, ...keys: string[]): number | null {
  if (typeof result !== "object" || result === null) return null
  for (const k of keys) {
    const v = (result as Record<string, unknown>)[k]
    if (typeof v === "number") return v
  }
  return null
}

/** The display name of a `best_match`, when the tool returned one. */
function bestMatchName(result: unknown): string | null {
  if (typeof result !== "object" || result === null) return null
  const best = (result as Record<string, unknown>).best_match
  if (typeof best !== "object" || best === null) return null
  const name = (best as Record<string, unknown>).name
  return typeof name === "string" && name ? name : null
}

/** `doneCount` ("Warehouses: 3") when the result carries a count under one of
 * `keys`, the tool's plain past tense when it does not — a turn stored before
 * the count existed still renders a sentence. */
function counted(...keys: string[]) {
  return (event: VendorAgentToolEvent, t: Translate): string => {
    const value = n(event.result, ...keys)
    return value === null ? t("done") : t("doneCount", { count: value })
  }
}

const DESCRIPTORS: Record<string, ToolDescriptor> = {
  // ── Collections & taxonomy ──────────────────────────────────
  list_collections: {
    icon: FolderIcon,
    done: counted("count", "total_in_shop"),
  },
  create_collection: { icon: FolderPlusIcon },
  list_system_categories: {
    icon: LayersIcon,
    // A zero-result lookup used to render as a green "Suggested categories"
    // row that opened onto nothing, which is how an Arabic label against an
    // English taxonomy looked like success.
    done: (e, t) => {
      const best = bestMatchName(e.result)
      if (best) return t("matched", { name: best })
      const total = n(e.result, "total", "count")
      if (total === 0) return t("none")
      return total === null ? t("done") : t("doneCount", { count: total })
    },
  },
  // ── Products ────────────────────────────────────────────────
  create_product: {
    icon: PackagePlusIcon,
    // The call can end in a question rather than a form: a quantity with no
    // warehouse named, on a shop that has more than one. Saying "drafted the
    // form" there would describe a card that is not on screen.
    done: (e, t) =>
      bool(e.result, "needs_location") ? t("askedLocation") : t("done"),
  },
  search_products: {
    icon: PackageSearchIcon,
    done: counted("total", "count"),
  },
  get_product: { icon: PackageIcon },
  update_product: { icon: PencilIcon },
  // The live form channel: a change to the product form already open. On
  // success it renders as its own card, so this row is what shows while it
  // runs and when it is refused.
  patch_form: { icon: PencilIcon },
  prepare_delete_product: { icon: Trash2Icon },
  delete_product: { icon: Trash2Icon },
  // ── Analytics ───────────────────────────────────────────────
  get_shop_stats: { icon: TrendingUpIcon },
  get_low_stock_products: {
    icon: BoxesIcon,
    done: counted("count"),
  },
  get_top_products: { icon: TrendingUpIcon },
  get_yearly_sales: { icon: TrendingUpIcon },
  get_category_sales: { icon: LayersIcon },
  get_custom_range_stats: { icon: TrendingUpIcon },
  // ── Inventory ───────────────────────────────────────────────
  list_inventory_locations: {
    icon: WarehouseIcon,
    // The count is what the row is for: one warehouse means the question
    // "which one?" never had to be asked, and the vendor can see that.
    done: counted("count"),
  },
  set_inventory: { icon: BoxesIcon },
  inventory_history: { icon: ClipboardListIcon },
  transfer_inventory: { icon: ArrowRightLeftIcon },
  // ── Bulk & CSV ──────────────────────────────────────────────
  bulk_update_price: { icon: TagsIcon },
  bulk_update_tags: { icon: TagsIcon },
  export_products_csv: { icon: DownloadIcon },
  import_products_csv: { icon: UploadIcon },
  // ── Collection edits & membership ───────────────────────────
  update_collection: { icon: PencilIcon },
  prepare_delete_collection: { icon: Trash2Icon },
  delete_collection: { icon: Trash2Icon },
  add_product_to_collection: { icon: FolderPlusIcon },
  remove_product_from_collection: { icon: FolderIcon },
  // ── Coupons ─────────────────────────────────────────────────
  list_coupons: {
    icon: BadgePercentIcon,
    done: counted("total", "count"),
  },
  get_coupon: { icon: BadgePercentIcon },
  create_coupon: { icon: TagIcon },
  update_coupon: { icon: PencilIcon },
  prepare_delete_coupon: { icon: Trash2Icon },
  delete_coupon: { icon: Trash2Icon },
  // ── AI media ────────────────────────────────────────────────
  // The card polls to completion, so "done" here means the job was accepted.
  generate_product_image: { icon: SparklesIcon },
  // ── Multi-step plan (usually hoisted to the header, not a row) ──
  set_task_plan: { icon: ListChecksIcon },
  // -- Absorbed from the retired Sidekick assistant -------------------------
  // A tool with no entry here still renders (see GENERIC below), but as
  // "Working..." -- which in a work log of twelve steps is twelve identical
  // rows. These are the labels that keep the log readable.
  get_orders: { icon: ReceiptIcon, done: counted("count") },
  get_order: { icon: ReceiptIcon },
  get_shipments: { icon: TruckIcon },
  get_refund_requests: { icon: RotateCcwIcon, done: counted("pending") },
  get_fulfillment_speed: { icon: GaugeIcon },
  get_shop_balance: { icon: BanknoteIcon },
  get_daily_digest: { icon: ChartNoAxesCombinedIcon },
  get_conversion_funnel: { icon: ChartNoAxesCombinedIcon },
  get_peak_hours: { icon: CalendarClockIcon },
  get_product_trends: { icon: TrendingUpIcon },
  get_product_performance: { icon: ChartNoAxesCombinedIcon },
  get_store_health: { icon: GaugeIcon },
  get_profit_breakdown: { icon: BanknoteIcon },
  get_revenue_forecast: { icon: TrendingUpIcon },
  get_review_summary: { icon: StarIcon, done: counted("count") },
  get_abandoned_carts: { icon: ShoppingCartIcon, done: counted("count") },
  get_wishlist_demand: { icon: HeartIcon },
  get_stock_forecast: { icon: WarehouseIcon },
  get_return_rates: { icon: RotateCcwIcon },
  get_customer_segments: { icon: UsersIcon },
  get_customer_questions: {
    icon: MessageCircleQuestionIcon,
    done: counted("count"),
  },
  get_price_suggestions: { icon: BadgePercentIcon },
  get_bundle_suggestions: { icon: LayersIcon },
  compare_products: { icon: SearchCheckIcon, done: counted("found") },
  get_flash_sales: { icon: BadgePercentIcon },
  suggest_campaign: { icon: MegaphoneIcon },
  suggest_notification: { icon: MegaphoneIcon },
  generate_product_description: { icon: SparklesIcon },
  generate_product_seo: { icon: SearchCheckIcon },
  translate_product_content: { icon: LanguagesIcon },
  generate_faq: { icon: FileTextIcon },
  draft_review_reply: { icon: StarIcon },
  create_tag: {
    icon: TagIcon,
    done: (e, t) => (bool(e.result, "created") ? t("created") : t("existed")),
  },
}

/**
 * The fallback for a tool with no entry above (`aiChat.toolLog.generic`).
 *
 * It deliberately does NOT name the tool. `شغّل generate_product_image` in an
 * otherwise Arabic conversation reads as a leaked internal identifier; the raw
 * name is still available on the row's `title` for anyone debugging.
 */
const GENERIC: ToolDescriptor = { icon: WrenchIcon }

export interface HumanizedTool {
  icon: LucideIcon
  /** Present-tense label while the tool is running. */
  running: string
  /** Resolved label once the tool has landed. */
  done: string
  /** Past-tense label for a call that failed — the one generic "this step
   * didn't go through" for every tool, because a red triangle beside a
   * present-tense "Searching products…" reads as still running. */
  failed: string
}

/**
 * @param t A translator scoped to `aiChat.toolLog`.
 */
export function humanizeTool(
  event: VendorAgentToolEvent,
  t: Translate,
): HumanizedTool {
  const known = DESCRIPTORS[event.name]
  const d = known ?? GENERIC
  const base = known ? `tools.${event.name}` : "generic"
  const own: Translate = (key, values) => t(`${base}.${key}`, values)
  return {
    icon: d.icon,
    running: own("running"),
    done: d.done ? d.done(event, own) : own("done"),
    failed: t("failed"),
  }
}

/**
 * The `tool_progress` phases with a sentence in `aiChat.toolLog.phases`.
 *
 * The phase names come from the back-end as free text, so this is a
 * best-effort lookup and an unknown phase is NOT an error — it returns null
 * text and the row keeps the tool's own present-tense label. That is what
 * lets a back-end name a new stage without shipping a dashboard release.
 */
const PHASES = new Set([
  // import_products_csv
  "tags",
  "validating",
  "validated",
  "importing",
  "imported",
  // bulk_update_price
  "matching",
  "matched",
  "applying",
  "applied",
  "previewed",
  // generate_product_image
  "enqueuing",
  "enqueued",
])

export interface HumanizedProgress {
  /** Localized phase sentence, or null when the phase is unknown (or absent)
   * and the caller should keep the tool's own running label. */
  text: string | null
  /** 0–100, or null when the tool reported no fraction — an async enqueue has
   * nothing to fill a bar with, and a fake one is worse than none. */
  percent: number | null
  /** "120 / 500", or null when there are no counts. */
  counts: string | null
  /** A specific the server could not translate — a product handle. */
  label?: string
}

/**
 * Localized copy for a `tool_progress` frame.
 *
 * @param t A translator scoped to `aiChat.toolLog`.
 */
export function humanizeProgress(
  progress: VendorAgentToolProgress,
  t: Translate,
): HumanizedProgress {
  const { phase, done, total, label } = progress

  const hasCounts =
    typeof done === "number" && typeof total === "number" && total > 0
  const percent = hasCounts
    ? Math.max(0, Math.min(100, Math.round((done / total) * 100)))
    : null

  return {
    text: phase && PHASES.has(phase) ? t(`phases.${phase}`) : null,
    percent,
    // Western digits in both locales: the rest of the dashboard's counts and
    // money are already rendered this way, and mixing numeral systems inside
    // one card is the kind of detail that reads as a bug.
    counts: hasCounts ? `${done} / ${total}` : null,
    label: label || undefined,
  }
}
