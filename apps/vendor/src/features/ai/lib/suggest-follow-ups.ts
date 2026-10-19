import type { VendorAgentMessage, VendorAgentToolEvent } from "./types"

/**
 * Derive 2-3 contextual follow-up prompts for the vendor to tap after
 * the assistant's last turn. Rule-based, not LLM-driven: every suggestion
 * costs $0 and renders instantly, which matters because we show these
 * after every assistant message.
 *
 * The mapping is tool-name → prompt list, because the tool the agent
 * just ran is a strong signal for what the vendor might want next
 * (e.g. after stats → dig into a specific slice; after creating a
 * collection → add products to it).
 *
 * Returns an empty array when nothing contextually relevant exists;
 * the UI should hide the chips row entirely in that case.
 */
export function suggestFollowUps(
  message: VendorAgentMessage,
  locale: "ar" | "en",
): string[] {
  if (message.role !== "assistant") return []
  const events = message.tool_events ?? []
  if (events.length === 0) return []

  // The "most meaningful" event is usually the last successful one —
  // earlier tools may be read/lookup scaffolding (list_collections) and
  // the final one is the action the vendor cares about. We walk from
  // the end and pick the first non-read suggestion-rich tool.
  for (let i = events.length - 1; i >= 0; i--) {
    const evt = events[i]
    if (!evt.ok) continue
    const suggestions = suggestionsForTool(evt, locale)
    if (suggestions.length > 0) return suggestions
  }

  // Fallback — show a generic "what else" row if no tool matched.
  return locale === "ar"
    ? ["شو المنتجات الأكثر مبيعاً؟", "وريني إحصائيات اليوم"]
    : ["What's selling best?", "Show today's stats"]
}

/** The warehouse names a `needs_location` result offers, or null when the
 * result is not that question. Capped at four: a chips row is a choice, not
 * a directory, and a shop with more than four warehouses can still type. */
function locationNames(result: unknown): string[] | null {
  if (typeof result !== "object" || result === null) return null
  const r = result as { needs_location?: unknown; locations?: unknown }
  if (r.needs_location !== true || !Array.isArray(r.locations)) return null
  const names = r.locations
    .map((l) => (l as { name?: unknown }).name)
    .filter((n): n is string => typeof n === "string" && n.trim() !== "")
  return names.length ? names.slice(0, 4) : null
}

/** The window a `get_shop_stats` call covered: the result's own `period`
 * (both payload versions carry it), else the argument it was called with. */
function statsPeriod(evt: VendorAgentToolEvent): string | null {
  const fromResult =
    typeof evt.result === "object" && evt.result !== null
      ? (evt.result as { period?: unknown }).period
      : undefined
  const period = fromResult ?? evt.args?.period
  return typeof period === "string" ? period : null
}

/**
 * "Compare" against the window just before the one on screen. It used to say
 * "last month" whatever was shown, so a 7-day card offered a calendar-month
 * comparison — a range the model then had to build with no date to build it
 * from. Each period now names its own predecessor, the same length and shape
 * as the window `get_shop_stats` v2 reports, so the model can answer it with
 * one `get_custom_range_stats` call.
 */
function compareChip(period: string | null, isAr: boolean): string {
  switch (period) {
    case "today":
      return isAr ? "قارن مع مبارح" : "Compare with yesterday"
    case "weekly":
      return isAr
        ? "قارن مع السبع أيام اللي قبلها"
        : "Compare with the 7 days before"
    case "monthly":
      return isAr
        ? "قارن مع الثلاثين يوم اللي قبلها"
        : "Compare with the 30 days before"
    case "yearly":
      return isAr
        ? "قارن مع نفس الفترة من السنة الماضية"
        : "Compare with the same period last year"
    default:
      return isAr ? "قارن مع الفترة اللي قبلها" : "Compare vs prior period"
  }
}

function suggestionsForTool(
  evt: VendorAgentToolEvent,
  locale: "ar" | "en",
): string[] {
  const isAr = locale === "ar"
  switch (evt.name) {
    case "get_shop_stats":
      return isAr
        ? [
            "وريني المنتجات الأكثر مبيعاً",
            "شو المنتجات اللي مخزونها ناقص؟",
            compareChip(statsPeriod(evt), true),
          ]
        : [
            "Show me top sellers",
            "What's running low on stock?",
            compareChip(statsPeriod(evt), false),
          ]
    case "get_top_products":
      return isAr
        ? ["وريني إحصائيات أوسع", "شو المنتجات الأقل مبيعاً؟"]
        : ["Show broader stats", "What's underperforming?"]
    case "get_low_stock_products":
      return isAr
        ? ["اعرض كل المنتجات DRAFT", "وريني الطلبات الأخيرة"]
        : ["List DRAFT products", "Show recent orders"]
    case "get_yearly_sales":
      return isAr
        ? ["قسّم حسب الفئة", "أي شهر كان الأفضل؟"]
        : ["Break down by category", "Which month was best?"]
    case "get_category_sales":
      return isAr
        ? ["وريني الأكثر مبيعاً في الفئة الأولى", "مبيعات السنة الكاملة"]
        : ["Top sellers in the leading category", "Full year sales"]
    case "get_custom_range_stats":
      return isAr
        ? ["أي منتج تصدّر هاي الفترة؟", "قارن مع الفترة اللي قبلها"]
        : ["Which product led this period?", "Compare vs prior period"]
    case "search_products":
      return isAr
        ? ["عدّل سعر أحدها", "اعرض التفاصيل", "احذف المنتجات القديمة"]
        : ["Update a price", "Show full details", "Delete old ones"]
    case "get_product":
      return isAr
        ? ["عدّل السعر", "غيّر المخزون", "احذف المنتج"]
        : ["Change the price", "Update stock", "Delete it"]
    case "list_collections":
      return isAr
        ? ["اعمل قسم جديد", "أضف منتجات لقسم"]
        : ["Create a new collection", "Add products to a collection"]
    case "create_collection":
    case "update_collection":
      return isAr
        ? ["أضف منتج جديد لهاد القسم", "اعرض منتجات القسم"]
        : ["Add a product to this collection", "Show products in this collection"]
    case "create_product": {
      // The create can stop to ask which warehouse the quantity goes to. The
      // answer is one of the names it returned, so those are the chips —
      // tapping one answers the question instead of retyping it. Offering
      // "Publish it" there would describe a product that does not exist.
      const names = locationNames(evt.result)
      if (names) return names
      return isAr
        ? ["أضف منتج آخر", "عدّل تفاصيل هاد المنتج", "انشر المنتج"]
        : ["Add another product", "Edit this product", "Publish it"]
    }
    case "update_product":
      return isAr
        ? ["عدّل الحالة", "وريني قائمة المنتجات المحدّثة"]
        : ["Change status", "Show updated products"]
    case "delete_product":
      return isAr
        ? ["عرض باقي المنتجات", "احذف منتج آخر"]
        : ["Show remaining products", "Delete another one"]
    case "list_inventory_locations":
      // The two things a vendor does right after seeing the list: move
      // stock between two of them, or correct the count in one.
      return isAr
        ? ["انقل كمية بين مخزنين", "عدّل كمية منتج في مخزن"]
        : ["Move stock between warehouses", "Set a product's stock in one"]
    case "list_system_categories":
      return isAr
        ? ["أنشئ منتج في هاي الفئة"]
        : ["Create a product in this category"]
    default:
      return []
  }
}
