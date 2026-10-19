import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { AssistantTurn } from "./assistant-turn"
import type { AssistantPart, VendorAgentToolEvent } from "@/features/ai/lib/types"

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

/**
 * The work log had no render test at all, and every defect in the bug report
 * showed up here: raw asterisks in the bubble, the same lookup drawn twice,
 * and a failure that arrived as a detached banner with no way to retry.
 */

function tool(
  name: string,
  args: Record<string, unknown>,
  result: unknown,
  ok = true,
): VendorAgentToolEvent {
  return { name, args, ok, result }
}

function turn(parts: AssistantPart[]) {
  return render(
    <AssistantTurn
      parts={parts}
      content=""
      currency="SAR"
      locale="en"
      onRetry={() => {}}
    />,
  )
}

const CATEGORIES = {
  query: "clothing",
  locale: "en",
  best_match: {
    id: "c1",
    name: "Clothing",
    breadcrumb: "Apparel & Accessories",
    level: 1,
  },
  categories: [
    { id: "c1", name: "Clothing", breadcrumb: "Apparel & Accessories", level: 1 },
    { id: "c2", name: "Dresses", breadcrumb: "Apparel & Accessories › Clothing", level: 2 },
  ],
  total: 2,
  truncated: false,
}

describe("<AssistantTurn />", () => {
  it("renders the model's markdown instead of printing its asterisks", () => {
    const { container } = turn([
      { kind: "text", text: "أحتاج **اسم المنتج** قبل ما أكمل." },
    ])
    expect(container.textContent).not.toContain("**")
    expect(container.querySelector("strong")?.textContent).toBe("اسم المنتج")
  })

  it("lets the bubble follow the text's own direction, not the UI's", () => {
    const { container } = turn([{ kind: "text", text: "مبيعات اليوم 1,240" }])
    const bubble = container.querySelector("[dir='auto']")
    expect(bubble).not.toBeNull()
  })

  it("folds a lookup the model repeated with the same arguments", () => {
    const { container } = turn([
      { kind: "tool", event: tool("list_system_categories", { query: "clothing" }, CATEGORIES) },
      { kind: "tool", event: tool("list_system_categories", { query: "clothing" }, CATEGORIES) },
    ])
    // One row, badged with how many calls it stands for.
    expect(container.textContent).toContain("×2")
    expect(screen.getAllByTitle("the same lookup, repeated")).toHaveLength(1)
  })

  it("keeps a failed call and its retry as two separate rows", () => {
    const { container } = turn([
      { kind: "tool", event: tool("search_products", { q: "a" }, null, false) },
      { kind: "tool", event: tool("search_products", { q: "a" }, { products: [], count: 0, total: 0 }) },
    ])
    expect(container.textContent).not.toContain("×2")
  })

  it("does not fold two lookups that asked different things", () => {
    const { container } = turn([
      { kind: "tool", event: tool("list_system_categories", { query: "clothing" }, CATEGORIES) },
      { kind: "tool", event: tool("list_system_categories", { query: "shoes" }, CATEGORIES) },
    ])
    expect(container.textContent).not.toContain("×2")
  })

  it("labels a failed row in the past tense rather than as still running", () => {
    const { container } = turn([
      { kind: "tool", event: tool("list_system_categories", {}, null, false) },
    ])
    expect(container.textContent).toContain("This step didn't go through")
    expect(container.textContent).not.toContain("Matching the category")
  })

  it("puts a failed turn's error inside the turn, with a retry", async () => {
    const onRetry = vi.fn()
    render(
      <AssistantTurn
        parts={[
          { kind: "text", text: "Let me check your stock." },
          {
            kind: "error",
            code: "PROVIDER_OVERLOADED",
            message: "The AI service is busy right now.",
            retryable: true,
          },
        ]}
        content=""
        currency="SAR"
        locale="en"
        onRetry={onRetry}
      />,
    )
    // The narration that preceded the failure survives it.
    expect(screen.getByText("Let me check your stock.")).toBeTruthy()
    const retry = screen.getByRole("button", { name: /try again/i })
    retry.click()
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it("offers no retry for a failure only the platform can fix", () => {
    render(
      <AssistantTurn
        parts={[
          {
            kind: "error",
            code: "PROVIDER_CREDITS",
            message: "The assistant is paused.",
            retryable: false,
          },
        ]}
        content=""
        currency="SAR"
        locale="en"
        onRetry={() => {}}
      />,
    )
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull()
    expect(screen.getByText(/platform team has been notified/i)).toBeTruthy()
  })

  it("marks the best category match and shows a breadcrumb, not a slug", () => {
    const { container } = turn([
      {
        kind: "tool",
        event: tool("list_system_categories", { query: "clothing" }, CATEGORIES),
      },
    ])
    expect(container.textContent).toContain("Best match")
    expect(container.textContent).toContain("Apparel & Accessories")
    expect(container.textContent).not.toContain("apparel-and-accessories")
  })

  it("opens the create that stopped to ask which warehouse onto the list", () => {
    // `create_product` is a leaf action — no card — until it returns the
    // warehouse question. Then the list the vendor is choosing from has to be
    // the expanded card, or they are asked to pick from options they cannot
    // see.
    const { container } = turn([
      {
        kind: "tool",
        event: tool("create_product", { name_ar: "هودي", quantity: 30 }, {
          ok: true,
          needs_location: true,
          count: 2,
          locations: [
            { id: "l1", name: "Main warehouse", city: "Riyadh", is_default: true, is_active: true, fulfills_online_orders: true },
            { id: "l2", name: "Jeddah branch", city: "Jeddah", is_default: false, is_active: true, fulfills_online_orders: true },
          ],
        }),
      },
    ])
    expect(container.textContent).toContain("Asked which warehouse")
    expect(screen.getByText("Jeddah branch")).toBeTruthy()
    // And never the form-handoff CTA, which would offer to open a form for a
    // product that was not drafted.
    expect(container.textContent).not.toContain("Drafted the product form")
  })

  it("says so when nothing matched, instead of a titled empty box", () => {
    const { container } = turn([
      {
        kind: "tool",
        event: tool(
          "list_system_categories",
          { query: "ملابس" },
          { query: "ملابس", locale: "en", best_match: null, categories: [], total: 0, truncated: false },
        ),
      },
    ])
    expect(container.textContent).toContain('No category matched "ملابس"')
  })
})

describe("<AssistantTurn /> a change to the open form", () => {
  const patch = (patchId: string) =>
    tool(
      "patch_form",
      { price: 300 },
      {
        ok: true,
        form_patch: {
          patch_id: patchId,
          form_id: "h1",
          target: "product_create",
          values: { price: 300 },
          changed: [{ field: "price", from: 200, to: 300 }],
        },
      },
    )

  it("draws it as a card of its own, not a collapsed row", () => {
    turn([{ kind: "tool", event: patch("p1") }])
    // The card itself, open — not the one-line "Updated the open form" row.
    expect(screen.getByText("Changed on the open form")).toBeTruthy()
    expect(screen.queryByText("Updated the open form")).toBeNull()
  })

  it("never folds two patches together", () => {
    // Two corrections to the same price are two things that happened.
    turn([
      { kind: "tool", event: patch("p1") },
      { kind: "tool", event: patch("p2") },
    ])
    expect(screen.getAllByText("Changed on the open form")).toHaveLength(2)
  })

  it("shows a refused patch as a failed row", () => {
    turn([
      {
        kind: "tool",
        event: tool("patch_form", {}, { ok: false, error: "nope" }, false),
      },
    ])
    expect(screen.queryByText("Changed on the open form")).toBeNull()
  })

  // `create_product` refusing a second card for the form already open, and
  // the patch that corrected it. A red "Operation failed" card above the fix
  // read as though something had broken.
  const alreadyOpen = (hint: string) =>
    tool(
      "create_product",
      { name_ar: "هودي", price: 300 },
      {
        ok: false,
        error: "The product form is already open on your screen, unsaved.",
        hint,
      },
      false,
    )

  it("draws the refusal it corrected itself as a quiet row", () => {
    const { container } = turn([
      {
        kind: "tool",
        event: alreadyOpen(
          "The form is open on the vendor screen with your unsaved draft. Call patch_form with only the fields that change.",
        ),
      },
      { kind: "tool", event: patch("p1") },
    ])
    expect(screen.getByText("The form is already open on your screen")).toBeTruthy()
    expect(screen.queryByText("Operation failed")).toBeNull()
    expect(container.textContent).not.toContain("This step didn't go through")
    expect(screen.getByText("Changed on the open form")).toBeTruthy()
  })

  it("recognises the refusal by its code, whatever its hint says", () => {
    // What the back-end sends since refusals carry a code; the hint match
    // above is for turns persisted before that.
    turn([
      {
        kind: "tool",
        event: tool(
          "update_product",
          { id: "p1", price: 300 },
          {
            ok: false,
            code: "AGENT_FORM_ALREADY_OPEN",
            error: "The product form is already open on your screen, unsaved.",
            hint: "Reworded since.",
          },
          false,
        ),
      },
    ])
    expect(
      screen.getByText("The form is already open on your screen"),
    ).toBeTruthy()
    expect(screen.queryByText("Operation failed")).toBeNull()
  })

  it("keeps any other create_product failure red", () => {
    turn([{ kind: "tool", event: alreadyOpen("Ask the vendor for a name.") }])
    expect(screen.getByText("Operation failed")).toBeTruthy()
  })
})

/**
 * The plan card, and who is allowed to draw it.
 *
 * A turn sees only its own `parts`, and the multi-step flow the prompt
 * prescribes — hand off to a form, vendor saves, chat auto-resumes — puts the
 * agent's re-sends in DIFFERENT turns. Within-turn dedup was therefore not
 * enough on its own: it produced one frozen To-do card per turn, stacked down
 * the transcript, each with a spinner that never stopped.
 */
describe("<AssistantTurn /> task plan", () => {
  const plan = (steps: Array<{ title: string; status: string }>) =>
    tool("set_task_plan", {}, { ok: true, task_plan: { steps } })

  const SNAPSHOT = [
    { title: "Create product", status: "done" },
    { title: "15% coupon", status: "active" },
  ]

  it("draws only the last re-send inside one turn", () => {
    turn([
      { kind: "tool", event: plan([{ title: "Create product", status: "active" }]) },
      { kind: "text", text: "Drafted it." },
      { kind: "tool", event: plan(SNAPSHOT) },
    ])

    expect(screen.getAllByText("Create product")).toHaveLength(1)
    expect(screen.getByText("15% coupon")).toBeDefined()
  })

  it("draws nothing when a newer turn owns the plan", () => {
    render(
      <AssistantTurn
        parts={[{ kind: "tool", event: plan(SNAPSHOT) }]}
        content=""
        currency="SAR"
        locale="en"
        planIsCurrent={false}
      />,
    )

    expect(screen.queryByText("15% coupon")).toBeNull()
  })

  it("shows an active step as waiting once the turn has finished", () => {
    // The turn ended *because* it is waiting on the vendor to save a form.
    // A spinner there said the opposite, and said it forever — including in
    // persisted history, where nothing was ever going to finish it.
    turn([{ kind: "tool", event: plan(SNAPSHOT) }])

    expect(screen.getByText("waiting on you")).toBeDefined()
  })

  it("shows an active step as running while the turn streams", () => {
    render(
      <AssistantTurn
        parts={[{ kind: "tool", event: plan(SNAPSHOT) }]}
        content=""
        currency="SAR"
        locale="en"
        caret
      />,
    )

    expect(screen.queryByText("waiting on you")).toBeNull()
  })
})
