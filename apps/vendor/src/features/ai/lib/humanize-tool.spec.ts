import { describe, it, expect } from "vitest"
import { createTranslator } from "next-intl"
import arMessages from "@/shared/messages/ar"
import { enTranslator } from "@/shared/test/next-intl"
import { humanizeTool } from "./humanize-tool"
import type { VendorAgentToolEvent } from "./types"

// The labels live in the real catalogues now, so the assertions below are
// against the copy a merchant reads rather than against a table in this file.
const EN = enTranslator("aiChat.toolLog")
const AR = createTranslator({
  locale: "ar",
  messages: arMessages as Parameters<typeof createTranslator>[0]["messages"],
  namespace: "aiChat.toolLog" as never,
}) as unknown as typeof EN

function ev(
  name: string,
  result: unknown = {},
  ok = true,
): VendorAgentToolEvent {
  return { name, args: {}, ok, result }
}

describe("humanizeTool", () => {
  it("returns localized running + done labels for a known tool", () => {
    const en = humanizeTool(ev("get_shop_stats"), EN)
    expect(en.running).toBe("Pulling shop stats")
    expect(en.done).toBe("Pulled shop stats")

    const ar = humanizeTool(ev("get_shop_stats"), AR)
    expect(ar.running).toBe("يجمع الإحصائيات")
    expect(ar.done).toBe("جلب الإحصائيات")
  })

  it("enriches count-bearing tools from the result", () => {
    const found = humanizeTool(ev("search_products", { total: 4, count: 4 }), EN)
    expect(found.done).toBe("Found products: 4")

    // No count in the result → falls back to the generic past label.
    const fallback = humanizeTool(ev("search_products", {}), EN)
    expect(fallback.done).toBe("Searched products")
  })

  it("degrades gracefully for an unknown tool, without leaking its name", () => {
    const en = humanizeTool(ev("some_new_tool"), EN)
    expect(en.running).toBe("Working")
    // The raw identifier belongs on the row's title attribute, not in the
    // sentence an Arabic vendor reads.
    expect(en.done).toBe("Done")
    expect(en.done).not.toContain("some_new_tool")
    expect(en.icon).toBeTruthy()
  })

  it("labels a failure in the past tense so it doesn't read as still running", () => {
    const failed = humanizeTool(
      { name: "list_system_categories", args: {}, ok: false, error: "boom" },
      EN,
    )
    expect(failed.failed).toBe("This step didn't go through")
    expect(failed.failed).not.toBe(failed.running)
    expect(
      humanizeTool(
        { name: "list_system_categories", args: {}, ok: false, error: "boom" },
        AR,
      ).failed,
    ).toBe("تعذّر تنفيذ الخطوة")
  })

  it("reports the category match rather than a flat 'suggested'", () => {
    const matched = humanizeTool(
      ev("list_system_categories", {
        total: 6,
        best_match: { id: "c1", name: "Clothing", breadcrumb: "Apparel › Clothing", level: 1 },
      }),
      EN,
    )
    expect(matched.done).toBe("Matched: Clothing")

    const none = humanizeTool(ev("list_system_categories", { total: 0 }), EN)
    expect(none.done).toBe("No category matched")
  })

  it("says how many warehouses there are, because that is the whole point", () => {
    // The row exists so the vendor can see whether "which warehouse?" was a
    // real question. One warehouse means it never was.
    const many = humanizeTool(
      ev("list_inventory_locations", { ok: true, count: 3, locations: [] }),
      EN,
    )
    expect(many.done).toBe("Warehouses: 3")
    expect(
      humanizeTool(
        ev("list_inventory_locations", { ok: true, count: 3, locations: [] }),
        AR,
      ).done,
    ).toBe("المخازن: 3")

    // A stored turn from before the count existed still renders a sentence.
    expect(humanizeTool(ev("list_inventory_locations", {}), EN).done).toBe(
      "Reviewed the warehouses",
    )
  })

  it("does not claim a form when the create stopped to ask which warehouse", () => {
    // create_product ends in a question instead of a card when a quantity has
    // nowhere named to land. "Drafted the product form" would describe a card
    // that is not on screen.
    const asked = ev("create_product", {
      ok: true,
      needs_location: true,
      count: 2,
      locations: [],
    })
    expect(humanizeTool(asked, EN).done).toBe("Asked which warehouse")
    expect(humanizeTool(asked, AR).done).toBe("سأل عن المخزن")

    expect(
      humanizeTool(ev("create_product", { navigate_to_form: {} }), EN).done,
    ).toBe("Drafted the product form")
  })

  it("names a change to the open form in both languages", () => {
    // The row shows while patch_form runs and when it is refused; on success
    // the change renders as its own card.
    const en = humanizeTool(ev("patch_form"), EN)
    expect(en.running).toBe("Updating the open form")
    expect(en.done).toBe("Updated the open form")
    expect(humanizeTool(ev("patch_form"), AR).running).toBe(
      "يعدّل النموذج المفتوح",
    )
  })

  it("always supplies an icon", () => {
    expect(humanizeTool(ev("list_coupons", { total: 2, count: 2 }), AR).icon).toBeTruthy()
  })
})
