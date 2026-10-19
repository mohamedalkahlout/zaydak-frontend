import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

// The category picker browses the taxonomy a level at a time.
//
// Search alone was the whole control before, and on open it said "Type at
// least 2 characters" — a merchant who does not already know Google's wording
// for their category had nowhere to go. What this pins is the drill-down that
// replaced it, and above all **which click does what**: a row with children
// goes deeper, a leaf selects, and a parent is selectable only through its own
// deliberate row. Collapsing those would file a perfume under "Cosmetics".

import type { SystemCategory } from "@/features/products/types"

const fixtures = vi.hoisted(() => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => [vi.fn(), { loading: false }]),
}))

vi.mock("@apollo/client/react", () => ({
  useQuery: (...args: unknown[]) => fixtures.useQuery(...args),
  useMutation: (...args: unknown[]) => fixtures.useMutation(...args),
}))

// The picker's chrome is localized and its node names are not (they come back
// from the API already translated), so the mock translates for real against
// `en.json` — a key echo would make "Use <name>" read "use".
vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

const { SystemCategoryPicker } = await import(
  "../form/pickers/system-category-picker"
)

beforeAll(() => {
  // Base UI positions the popup with floating-ui, which measures the anchor.
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
  // cmdk keeps the active row in view; jsdom has no layout to scroll.
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
})

const node = (
  id: string,
  name: string,
  parent_id: string | null,
  level: number,
): SystemCategory => ({ id, name, parent_id, level, slug: id, path: id })

//  apparel ─ clothing ─ shirts
//  food (a childless root)
const NODES: SystemCategory[] = [
  node("apparel", "Apparel & Accessories", null, 0),
  node("clothing", "Clothing", "apparel", 1),
  node("shirts", "Shirts & Tops", "clothing", 2),
  node("food", "Food & Drink", null, 0),
]

/** A react-hook-form stand-in: `Controller` needs only these three. */
function makeForm(value = "", name = "Test Shirt") {
  let current = value
  const onChange = vi.fn((next: string) => {
    current = next
  })
  return {
    onChange,
    api: {
      control: {
        register: () => ({}),
        _formValues: {},
      },
      getValues: (key?: string) => {
        if (key === "system_category_id") return current
        if (key === "name") return { en: name }
        return ""
      },
      watch: (key?: string) => {
        if (key === "system_category_id") return current
        if (key === "name") return { en: name }
        return ""
      },
      setValue: vi.fn(),
    } as never,
  }
}

// `Controller` is heavier to fake than it is worth here; the picker's own
// rendering is what matters, so the form layer is stubbed to a plain field.
vi.mock("react-hook-form", () => ({
  Controller: ({
    render: renderProp,
  }: {
    render: (args: {
      field: { value: string; onChange: (v: string) => void }
    }) => React.ReactNode
  }) => renderProp({ field: fieldRef.current }),
}))

const fieldRef = {
  current: { value: "", onChange: (_: string) => {} },
} as {
  current: { value: string; onChange: (v: string) => void }
}

function setup({ selected = "" }: { selected?: string } = {}) {
  const onChange = vi.fn()
  fieldRef.current = { value: selected, onChange }
  const form = makeForm(selected)
  render(<SystemCategoryPicker form={form.api} />)
  return { onChange }
}

const openPicker = async () => {
  fireEvent.click(screen.getByRole("button", { name: /select a category|in |Apparel|Clothing|Shirts|Food/i }))
  await waitFor(() => screen.getByPlaceholderText(/search taxonomy/i))
}

const input = () =>
  screen.getByPlaceholderText(/search taxonomy/i) as HTMLInputElement

/** Fires on the search box, where cmdk keeps focus; returns false when the key was consumed. */
const key = (k: string) => fireEvent.keyDown(input(), { key: k })

/** A row of the list by its visible name (a crumb with the same name is a button, not an option). */
const option = (name: string | RegExp) => screen.getByRole("option", { name })

const isHighlighted = (el: Element) => el.getAttribute("aria-selected") === "true"

beforeEach(() => {
  fixtures.useQuery.mockReset()
  fixtures.useQuery.mockImplementation((doc: unknown, opts?: { skip?: boolean }) => {
    // The attributes query is the skipped one when nothing is selected; the
    // shape below serves both without needing to inspect the document.
    if (opts?.skip) return { data: undefined, loading: false }
    return {
      data: {
        systemCategoriesFlat: { success: true, data: NODES },
        categoryAttributes: { success: true, data: [] },
      },
      loading: false,
    }
  })
})

afterEach(() => {
  document.documentElement.dir = ""
})

describe("SystemCategoryPicker — browsing", () => {
  it("opens on the top level rather than an empty search box", async () => {
    setup()
    await openPicker()

    // The 21 roots are the answer to "what can I even pick from", which the
    // search-only version never gave.
    expect(screen.getByText("Apparel & Accessories")).toBeTruthy()
    expect(screen.getByText("Food & Drink")).toBeTruthy()
    expect(screen.queryByText("Clothing")).toBeNull()
  })

  it("goes one level deeper on a row that has children", async () => {
    setup()
    await openPicker()

    fireEvent.click(screen.getByText("Apparel & Accessories"))

    await waitFor(() => expect(screen.getByText("Clothing")).toBeTruthy())
    // The level it came from is gone — this is a drill, not an expand.
    expect(screen.queryByText("Food & Drink")).toBeNull()
  })

  it("walks all the way to a leaf", async () => {
    setup()
    await openPicker()

    fireEvent.click(screen.getByText("Apparel & Accessories"))
    await waitFor(() => screen.getByText("Clothing"))
    fireEvent.click(screen.getByText("Clothing"))

    await waitFor(() => expect(screen.getByText("Shirts & Tops")).toBeTruthy())
  })

  it("climbs back out through the breadcrumb", async () => {
    setup()
    await openPicker()

    fireEvent.click(screen.getByText("Apparel & Accessories"))
    await waitFor(() => screen.getByText("Clothing"))
    fireEvent.click(screen.getByText("Clothing"))
    await waitFor(() => screen.getByText("Shirts & Tops"))

    // Seven levels deep, stepping out one at a time is the tax the crumbs
    // remove: "All" returns to the roots in one click.
    fireEvent.click(screen.getByRole("button", { name: "All" }))

    await waitFor(() => expect(screen.getByText("Food & Drink")).toBeTruthy())
  })
})

describe("SystemCategoryPicker — selecting", () => {
  it("selects a leaf on click, because it has nowhere to drill", async () => {
    const { onChange } = setup()
    await openPicker()

    fireEvent.click(screen.getByText("Food & Drink"))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("food"))
  })

  it("never selects a parent from its own row", async () => {
    const { onChange } = setup()
    await openPicker()

    fireEvent.click(screen.getByText("Apparel & Accessories"))
    await waitFor(() => screen.getByText("Clothing"))

    // It drilled instead. One click doing both is what files a product on the
    // category its owner was merely passing through.
    expect(onChange).not.toHaveBeenCalled()
  })

  it("selects a parent through its deliberate row", async () => {
    const { onChange } = setup()
    await openPicker()

    fireEvent.click(screen.getByText("Apparel & Accessories"))
    await waitFor(() => screen.getByText("Clothing"))
    fireEvent.click(screen.getByText(/^Use/))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("apparel"))
  })
})

// The arrow keys walk the tree the way the pointer does: Right drills the
// highlighted row, Left climbs. Before this, a keyboard user could only drill
// with Enter and had no way back out short of the mouse. The highlight after a
// move is deliberate — cmdk's own answer is "the first row", which after a
// climb is a "Use <parent>" row nobody asked for.
describe("SystemCategoryPicker — keyboard", () => {
  it("ArrowRight drills the highlighted parent and lands on its Use row", async () => {
    const { onChange } = setup()
    await openPicker()
    await waitFor(() => expect(isHighlighted(option("Apparel & Accessories"))).toBe(true))

    expect(key("ArrowRight")).toBe(false)

    expect(option("Clothing")).toBeTruthy()
    expect(screen.queryByText("Food & Drink")).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
    await waitFor(() => expect(isHighlighted(option(/^Use Apparel/))).toBe(true))
  })

  it("ArrowLeft climbs and highlights the row it came out of", async () => {
    setup()
    await openPicker()
    await waitFor(() => expect(isHighlighted(option("Apparel & Accessories"))).toBe(true))

    key("ArrowRight")
    await waitFor(() => expect(isHighlighted(option(/^Use Apparel/))).toBe(true))
    key("ArrowDown")
    expect(isHighlighted(option("Clothing"))).toBe(true)
    key("ArrowRight")
    await waitFor(() => expect(isHighlighted(option(/^Use Clothing/))).toBe(true))
    expect(option("Shirts & Tops")).toBeTruthy()

    // Out of Clothing: its row, not "Use Apparel & Accessories", is where the
    // highlight lands, so Right again returns exactly where the merchant was.
    expect(key("ArrowLeft")).toBe(false)
    await waitFor(() => expect(isHighlighted(option("Clothing"))).toBe(true))
    expect(screen.queryByText("Shirts & Tops")).toBeNull()

    key("ArrowLeft")
    await waitFor(() => expect(isHighlighted(option("Apparel & Accessories"))).toBe(true))
    expect(option("Food & Drink")).toBeTruthy()

    // Nothing above the roots to climb to.
    expect(key("ArrowLeft")).toBe(true)
    expect(option("Food & Drink")).toBeTruthy()
  })

  it("ArrowRight on a leaf does nothing, and never selects it", async () => {
    const { onChange } = setup()
    await openPicker()
    await waitFor(() => expect(isHighlighted(option("Apparel & Accessories"))).toBe(true))

    key("ArrowDown")
    expect(isHighlighted(option("Food & Drink"))).toBe(true)

    expect(key("ArrowRight")).toBe(true)

    expect(option("Food & Drink")).toBeTruthy()
    expect(option("Apparel & Accessories")).toBeTruthy()
    expect(onChange).not.toHaveBeenCalled()
  })

  it("is never taken from a caret that can still move through the query", async () => {
    setup()
    await openPicker()

    const box = input()
    fireEvent.change(box, { target: { value: "sh" } })
    await waitFor(() => option(/^Shirts & Tops/))
    box.setSelectionRange(1, 1)

    // Mid-word, both keys are caret movement and the level stays put.
    expect(key("ArrowRight")).toBe(true)
    expect(key("ArrowLeft")).toBe(true)
    expect(option(/^Shirts & Tops/)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "All" })).toBeNull()

    // At the end of the text, Left still has somewhere to go.
    box.setSelectionRange(2, 2)
    expect(key("ArrowLeft")).toBe(true)
    expect(option(/^Shirts & Tops/)).toBeTruthy()
  })

  it("mirrors the keys under dir=rtl, where the drill chevron points left", async () => {
    document.documentElement.dir = "rtl"
    setup()
    await openPicker()
    await waitFor(() => expect(isHighlighted(option("Apparel & Accessories"))).toBe(true))

    expect(key("ArrowLeft")).toBe(false)
    expect(option("Clothing")).toBeTruthy()

    expect(key("ArrowRight")).toBe(false)
    await waitFor(() => expect(option("Food & Drink")).toBeTruthy())
  })

  it("a keyboard drill lands where Enter commits the level", async () => {
    const { onChange } = setup()
    await openPicker()
    await waitFor(() => expect(isHighlighted(option("Apparel & Accessories"))).toBe(true))

    key("ArrowRight")
    await waitFor(() => expect(isHighlighted(option(/^Use Apparel/))).toBe(true))
    key("Enter")

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("apparel"))
  })
})

describe("SystemCategoryPicker — search", () => {
  it("replaces the level with flat matches, and gives it back on clear", async () => {
    setup()
    await openPicker()

    const box = screen.getByPlaceholderText(/search taxonomy/i)
    fireEvent.change(box, { target: { value: "shirt" } })

    // Search reaches a deep node without walking to it.
    await waitFor(() => expect(screen.getByText("Shirts & Tops")).toBeTruthy())
    expect(screen.queryByText("Food & Drink")).toBeNull()

    fireEvent.change(box, { target: { value: "" } })

    // The trail underneath was never disturbed, so clearing returns to it.
    await waitFor(() => expect(screen.getByText("Food & Drink")).toBeTruthy())
  })

  it("prints a match's ancestors by name, the way the levels read", async () => {
    setup()
    await openPicker()

    fireEvent.change(input(), { target: { value: "shirt" } })

    await waitFor(() => expect(screen.getByText("Apparel & Accessories › Clothing")).toBeTruthy())
  })

  it("the match row itself still selects", async () => {
    const { onChange } = setup()
    await openPicker()

    fireEvent.change(input(), { target: { value: "shirt" } })
    await waitFor(() => screen.getByText("Shirts & Tops"))
    fireEvent.click(screen.getByText("Shirts & Tops"))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith("shirts"))
  })

  // A match shows one node and its ancestors; what it cannot show is what
  // sits beside it, which is often the better pick. Opening the level in
  // place is the way there — and it must not also select the match, which is
  // what the row's own click does.
  it("the browse button on a leaf match opens its parent's level with it highlighted", async () => {
    const { onChange } = setup()
    await openPicker()

    fireEvent.change(input(), { target: { value: "shirt" } })
    await waitFor(() => screen.getByText("Shirts & Tops"))
    fireEvent.click(screen.getByRole("button", { name: "Browse here" }))

    expect(onChange).not.toHaveBeenCalled()
    expect(input().value).toBe("")
    expect(screen.getByRole("button", { name: "Apparel & Accessories" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Clothing" })).toBeTruthy()
    await waitFor(() => expect(isHighlighted(option("Shirts & Tops"))).toBe(true))
  })

  it("browsing into a parent match shows its children under its Use row", async () => {
    const { onChange } = setup()
    await openPicker()

    fireEvent.change(input(), { target: { value: "cloth" } })
    await waitFor(() => option(/^Clothing/))
    fireEvent.click(screen.getByRole("button", { name: "Browse here" }))

    expect(option("Shirts & Tops")).toBeTruthy()
    await waitFor(() => expect(isHighlighted(option(/^Use Clothing/))).toBe(true))

    // The level is a real one: Enter on that row commits it, as a click-drill's would.
    key("Enter")
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("clothing"))
  })

  it("ArrowRight on a highlighted match opens its level", async () => {
    const { onChange } = setup()
    await openPicker()

    fireEvent.change(input(), { target: { value: "shirt" } })
    await waitFor(() => expect(isHighlighted(option(/^Shirts & Tops/))).toBe(true))

    // The caret sits at the end of "shirt", so the key has nowhere else to go.
    expect(key("ArrowRight")).toBe(false)

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Clothing" })).toBeTruthy()
    await waitFor(() => expect(isHighlighted(option("Shirts & Tops"))).toBe(true))
  })

  it("suggests a category and applies decisive suggestion directly", async () => {
    const mockSuggest = vi.fn().mockImplementation(({ onCompleted }) => {
      onCompleted({
        suggestSystemCategories: {
          success: true,
          generated: true,
          data: [
            {
              ref: "product",
              decisive: true,
              categories: [{ id: "shirts", label: "Shirts & Tops" }],
            },
          ],
        },
      })
      return Promise.resolve()
    })
    fixtures.useMutation.mockReturnValue([mockSuggest, { loading: false }])

    const { onChange } = setup()
    const suggestBtn = screen.getByRole("button", { name: /suggest a category/i })
    expect(suggestBtn).toBeTruthy()
    fireEvent.click(suggestBtn)

    await waitFor(() => {
      expect(mockSuggest).toHaveBeenCalled()
      expect(onChange).toHaveBeenCalledWith("shirts")
    })
  })

  it("renders chips for ambiguous category suggestions", async () => {
    const mockSuggest = vi.fn().mockImplementation(({ onCompleted }) => {
      onCompleted({
        suggestSystemCategories: {
          success: true,
          generated: true,
          data: [
            {
              ref: "product",
              decisive: false,
              categories: [
                { id: "clothing", label: "Clothing" },
                { id: "shirts", label: "Shirts & Tops" },
              ],
            },
          ],
        },
      })
      return Promise.resolve()
    })
    fixtures.useMutation.mockReturnValue([mockSuggest, { loading: false }])

    const { onChange } = setup()
    const suggestBtn = screen.getByRole("button", { name: /suggest a category/i })
    fireEvent.click(suggestBtn)

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Clothing" })).toBeTruthy()
      expect(screen.getByRole("button", { name: "Shirts & Tops" })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole("button", { name: "Shirts & Tops" }))
    expect(onChange).toHaveBeenCalledWith("shirts")
  })
})

