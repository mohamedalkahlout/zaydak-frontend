import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

/**
 * The row's accessibility wiring, which nothing else would notice regressing:
 * the input is named by its `<Label>` rather than its placeholder, the
 * caption and the counter describe it, and Revert names the field it reverts
 * so a screen reader does not hear "Revert, Revert, Revert" down a card.
 */

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

import { FieldDiffRow } from "../field-diff-row"
import type { StoreImportField } from "@/features/products/api"

const TITLE: StoreImportField = {
  key: "name_en",
  kind: "text",
  group: "product",
  never_scanned: false,
  blocks_sale: false,
  max_length: 70,
}

const STOCK: StoreImportField = {
  key: "quantity",
  kind: "integer",
  group: "inventory",
  never_scanned: true,
  blocks_sale: true,
  max_length: null,
}

/** No connector reads a category, but the scan's enrichment pass can. */
const CATEGORY: StoreImportField = {
  key: "system_category_id",
  kind: "category",
  group: "organization",
  never_scanned: true,
  blocks_sale: true,
  max_length: null,
}

const BRAND: StoreImportField = {
  key: "brand",
  kind: "text",
  group: "product",
  never_scanned: false,
  blocks_sale: false,
  max_length: null,
}

/** The Arabic title: its reference is the English it translates. */
const ARABIC_TITLE: StoreImportField = {
  key: "name_ar",
  kind: "text",
  group: "translation",
  never_scanned: false,
  blocks_sale: false,
  max_length: 255,
  reference_key: "name_en",
}

describe("FieldDiffRow", () => {
  it("shows a translation against its English source", () => {
    render(
      <FieldDiffRow
        field={ARABIC_TITLE}
        scanned=""
        reference="Mug"
        value=""
        onChange={() => {}}
      />,
    )
    expect(screen.getByText("Mug")).toBeDefined()
    expect(screen.getByText("Source: English")).toBeDefined()
    expect(
      screen
        .getByRole("textbox", { name: "Title" })
        .getAttribute("placeholder"),
    ).toBe("Add a translation")
    expect(screen.queryByText("Arabic we read")).toBeNull()
  })

  it("shows the Arabic the scan already read beneath the English", () => {
    render(
      <FieldDiffRow
        field={ARABIC_TITLE}
        scanned="كوب"
        reference="Mug"
        value=""
        onChange={() => {}}
      />,
    )
    expect(screen.getByText("Mug")).toBeDefined()
    expect(screen.getByText("Arabic we read")).toBeDefined()
    expect(screen.getByText("كوب")).toBeDefined()
    expect(
      screen
        .getByRole("textbox", { name: "Title" })
        .getAttribute("placeholder"),
    ).toBe("Keep what we read")
  })

  it("names the input after its label and describes it by caption and counter", () => {
    render(
      <FieldDiffRow
        field={TITLE}
        scanned="Mug"
        value="Cup"
        onChange={() => {}}
      />,
    )
    const input = screen.getByRole("textbox", { name: "Title" })
    const describedBy = input.getAttribute("aria-describedby") ?? ""
    const ids = describedBy.split(" ").filter(Boolean)
    expect(ids).toHaveLength(2)
    const described = ids.map((id) => document.getElementById(id)?.textContent)
    expect(described).toContain("From your old store")
    expect(described).toContain("3 of 70 characters used")
  })

  it("offers a per-field Revert only while the cell carries a value", () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <FieldDiffRow
        field={TITLE}
        scanned="Mug"
        value="Cup"
        onChange={onChange}
      />,
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Revert Title to what we read" }),
    )
    expect(onChange).toHaveBeenCalledWith("")

    rerender(
      <FieldDiffRow field={TITLE} scanned="Mug" value="" onChange={onChange} />,
    )
    expect(screen.queryByRole("button", { name: /Revert/ })).toBeNull()
  })

  it("flags a field the scan can never fill as the work to do", () => {
    render(
      <FieldDiffRow field={STOCK} scanned="" value="" onChange={() => {}} />,
    )
    expect(screen.getByText("Needed to sell")).toBeDefined()
    expect(screen.getByText("Nothing found")).toBeDefined()
    // A count reads left-to-right and asks for digits.
    const input = screen.getByRole("textbox", { name: "Stock" })
    expect(input.getAttribute("dir")).toBe("ltr")
    expect(input.getAttribute("inputmode")).toBe("decimal")
  })
})

/**
 * A cleared cell is empty exactly like an untouched one, so the row has to be
 * told — and once told, everything it says comes from what will be imported
 * rather than from the scan. Reading the scan is how a product the server
 * flagged, because its scanned category was cleared, showed a row with
 * nothing wrong on it.
 */
describe("FieldDiffRow — a cleared cell", () => {
  const picker = <span>picker</span>

  it("says a cleared scanned category is needed to sell, and offers it back", () => {
    const { container } = render(
      <FieldDiffRow
        field={CATEGORY}
        scanned="123"
        value=""
        cleared
        onChange={() => {}}
        onRevert={() => {}}
        control={picker}
      />,
    )
    expect(screen.getByText("Needed to sell")).toBeDefined()
    expect(container.querySelector("[data-overridden]")).not.toBeNull()
    expect(
      screen.getByRole("button", { name: "Revert Category to what we read" }),
    ).toBeDefined()
  })

  it("reads the same row as fine while the scan's category stands", () => {
    const { container } = render(
      <FieldDiffRow
        field={CATEGORY}
        scanned="123"
        value=""
        onChange={() => {}}
        control={picker}
      />,
    )
    expect(screen.queryByText("Needed to sell")).toBeNull()
    expect(container.querySelector("[data-overridden]")).toBeNull()
    expect(screen.queryByRole("button", { name: /Revert/ })).toBeNull()
  })

  it("does not promise to keep a scanned stock count the merchant cleared", () => {
    render(
      <FieldDiffRow
        field={STOCK}
        scanned="12"
        value=""
        cleared
        onChange={() => {}}
      />,
    )
    expect(screen.getByText("Needed to sell")).toBeDefined()
    expect(
      screen
        .getByRole("textbox", { name: "Stock" })
        .getAttribute("placeholder"),
    ).toBe("Add a value")
  })

  it("names a clear on a field the product can sell without", () => {
    render(
      <FieldDiffRow
        field={BRAND}
        scanned="Old Co"
        value=""
        cleared
        onChange={() => {}}
      />,
    )
    expect(screen.getByText("Cleared — will import empty")).toBeDefined()
    expect(screen.queryByText("Needed to sell")).toBeNull()
  })

  it("reverts through the screen's own revert, not by erasing the text", () => {
    // Erasing an already-empty cell stages nothing, so a clear stored by an
    // earlier save could never be undone that way.
    const onChange = vi.fn()
    const onRevert = vi.fn()
    render(
      <FieldDiffRow
        field={BRAND}
        scanned="Old Co"
        value=""
        cleared
        onChange={onChange}
        onRevert={onRevert}
      />,
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Revert Brand to what we read" }),
    )
    expect(onRevert).toHaveBeenCalledOnce()
    expect(onChange).not.toHaveBeenCalled()
  })
})

/**
 * The AI control's three states, and the one rule that matters about them: an
 * answer never silently replaces a merchant's own words.
 */
describe("FieldDiffRow — the AI assist", () => {
  const ai = (
    over: Partial<Parameters<typeof FieldDiffRow>[0]["ai"] & {}> = {},
  ) => ({
    actions: ["improve", "shorten"] as const,
    running: false,
    busy: false,
    proposal: null,
    error: null,
    onRun: vi.fn(),
    onAccept: vi.fn(),
    onDismiss: vi.fn(),
    ...over,
  })

  it("renders no control on a field that offers nothing", () => {
    render(
      <FieldDiffRow field={TITLE} scanned="Mug" value="" onChange={() => {}} />,
    )
    expect(screen.queryByRole("button", { name: /AI/i })).toBeNull()
  })

  it("offers the field's actions and runs the one that is chosen", () => {
    const assist = ai()
    render(
      <FieldDiffRow
        field={TITLE}
        scanned="Mug"
        value=""
        onChange={() => {}}
        ai={assist}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /Improve Title/i }))
    fireEvent.click(screen.getByRole("menuitem", { name: "Shorten" }))
    expect(assist.onRun).toHaveBeenCalledWith("shorten")
  })

  it("stands down while a call is running anywhere on the screen", () => {
    // One call in flight for the whole screen: each one is billed, and a row
    // of sparkle buttons is an invitation to press four.
    render(
      <FieldDiffRow
        field={TITLE}
        scanned="Mug"
        value=""
        onChange={() => {}}
        ai={ai({ busy: true, running: true })}
      />,
    )
    const trigger = screen.getByRole("button", { name: /Improve Title/i })
    expect(trigger.hasAttribute("disabled")).toBe(true)
    expect(trigger.getAttribute("aria-busy")).toBe("true")
  })

  it("proposes rather than replaces, and lets the merchant keep their own", () => {
    const assist = ai({ proposal: "<p>Classic Cotton Tee</p>" })
    render(
      <FieldDiffRow
        field={TITLE}
        scanned="Mug"
        value="My own title"
        onChange={() => {}}
        ai={assist}
      />,
    )
    // The markup a model returns is shown as text: the merchant is deciding
    // about the words, and nothing here renders a model's HTML into the DOM.
    expect(screen.getByText("Classic Cotton Tee")).toBeDefined()
    expect(screen.getByDisplayValue("My own title")).toBeDefined()

    fireEvent.click(screen.getByRole("button", { name: "Keep mine" }))
    expect(assist.onDismiss).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole("button", { name: "Use this" }))
    expect(assist.onAccept).toHaveBeenCalledOnce()
  })

  it("says why a request failed, in the row that asked", () => {
    render(
      <FieldDiffRow
        field={TITLE}
        scanned="Mug"
        value=""
        onChange={() => {}}
        ai={ai({ error: "Your plan's AI writing for this period is used up." })}
      />,
    )
    expect(screen.getByRole("alert").textContent).toContain("used up")
  })
})
