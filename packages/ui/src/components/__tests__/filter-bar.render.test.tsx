import { beforeAll, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"

import type { Filter, FilterBarLabels, FilterFieldDef, FilterOption } from "../filter-bar"

/**
 * The bar is controlled, so what is worth pinning is the reducer underneath the
 * chips: which edits clear values, which keep the menu open, and what a chip
 * reads when the option behind a value has gone. The popovers themselves are
 * Base UI's and the springs are motion's — neither is this file's job.
 *
 * The async case is the one with a real bug behind it. `loadOptions` is called
 * per keystroke, replies land out of order, and the naive version rendered
 * whichever arrived last. The sequence guard is asserted directly.
 *
 * jsdom performs no layout, so the RTL case can only hold what actually
 * regressed: a physical utility written where a logical one belongs. It asserts
 * the logical class is present *and* the physical one is absent, because only
 * the second half fails when someone pastes `rounded-l-md` back in.
 *
 * (No jest-dom in this package — assertions use plain DOM properties.)
 */

beforeAll(() => {
  // Base UI's popups probe `matchMedia` for reduced motion on mount, and its
  // positioner wants a `ResizeObserver`; jsdom has neither.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  // cmdk scrolls its highlighted row into view on mount; jsdom has no such
  // method, and without it every menu throws as it opens.
  Element.prototype.scrollIntoView = () => {}
})

vi.mock("../../hooks/use-hydrated", () => ({
  useHydrated: () => true,
  useSafeReducedMotion: () => true,
}))

const { FilterBar } = await import("../filter-bar")

const LABELS: FilterBarLabels = {
  add: "Filter",
  empty: "Add filter",
  selectValue: "Select…",
  search: "Filter…",
  noMatches: "No matches",
  loading: "Loading options…",
  loadError: "Could not load options.",
  retry: "Try again",
  clear: "Clear",
  editField: (field) => `Field: ${field}`,
  editOperator: (field) => `Operator for ${field}`,
  editValue: (field, value) => `Value for ${field}: ${value}`,
  remove: (field) => `Remove ${field} filter`,
}

const STATUS: FilterFieldDef = {
  id: "status",
  label: "Status",
  operators: [
    { value: "is_any_of", label: "is any of", multi: true },
    { value: "is", label: "is" },
  ],
  options: [
    { value: "open", label: "Open" },
    { value: "closed", label: "Closed" },
    { value: "held", label: "Held" },
  ],
}

/** One operator only — the case that renders as text rather than a button. */
const PAYMENT: FilterFieldDef = {
  id: "payment",
  label: "Payment",
  operators: [{ value: "is_any_of", label: "is any of", multi: true }],
  options: [
    { value: "paid", label: "Paid" },
    { value: "refunded", label: "Refunded" },
  ],
}

const FIELDS = [STATUS, PAYMENT]

function Harness({
  initial = [],
  fields = FIELDS,
  onChange,
}: {
  initial?: Filter[]
  fields?: FilterFieldDef[]
  onChange?: (filters: Filter[]) => void
}) {
  const [value, setValue] = useState<Filter[]>(initial)
  return (
    <FilterBar
      fields={fields}
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
      labels={LABELS}
      aria-label="Filters"
    />
  )
}

const openValueMenu = (field = "Status") =>
  fireEvent.click(
    screen.getByLabelText(new RegExp(`^Value for ${field}:`)),
  )

describe("<FilterBar />", () => {
  it("adds a chip with no values and opens its value menu", () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    // The empty bar is one button, and it says what it is for.
    expect(screen.getByText("Add filter")).toBeTruthy()

    fireEvent.click(screen.getByText("Add filter"))
    fireEvent.click(screen.getByText("Status"))

    expect(onChange).toHaveBeenCalledTimes(1)
    const [added] = onChange.mock.calls[0]![0] as Filter[]
    expect(added!.field).toBe("status")
    // The first operator is the default, and nothing is chosen yet.
    expect(added!.operator).toBe("is_any_of")
    expect(added!.values).toEqual([])

    // The value menu opened itself — a chip with no value narrows nothing.
    expect(screen.getByPlaceholderText("Filter…")).toBeTruthy()
  })

  it("accumulates values under a multi operator and keeps the menu open", () => {
    render(
      <Harness
        initial={[
          { id: "f1", field: "status", operator: "is_any_of", values: [] },
        ]}
      />,
    )

    openValueMenu()
    fireEvent.click(screen.getByText("Open"))
    expect(screen.getByLabelText("Value for Status: Open")).toBeTruthy()

    // Still open, so a second value can be ticked without reopening.
    fireEvent.click(screen.getByText("Closed"))
    expect(screen.getByLabelText("Value for Status: Open, Closed")).toBeTruthy()

    // And ticking one again removes it.
    fireEvent.click(screen.getByText("Open"))
    expect(screen.getByLabelText("Value for Status: Closed")).toBeTruthy()
  })

  it("replaces the value and closes the menu under a single-value operator", () => {
    render(
      <Harness
        initial={[
          { id: "f1", field: "status", operator: "is", values: ["open"] },
        ]}
      />,
    )

    openValueMenu()
    fireEvent.click(screen.getByText("Closed"))

    expect(screen.getByLabelText("Value for Status: Closed")).toBeTruthy()
    expect(screen.queryByPlaceholderText("Filter…")).toBeNull()
  })

  it("drops every value but the first when the operator stops being multi", () => {
    render(
      <Harness
        initial={[
          {
            id: "f1",
            field: "status",
            operator: "is_any_of",
            values: ["open", "closed"],
          },
        ]}
      />,
    )

    fireEvent.click(screen.getByLabelText("Operator for Status"))
    fireEvent.click(screen.getByText("is", { selector: "[data-slot='command-item'] span" }))

    // "is" cannot hold two, and silently applying both would be a lie.
    expect(screen.getByLabelText("Value for Status: Open")).toBeTruthy()
  })

  it("clears the values when the field changes", () => {
    render(
      <Harness
        initial={[
          { id: "f1", field: "status", operator: "is_any_of", values: ["open"] },
        ]}
      />,
    )

    fireEvent.click(screen.getByLabelText("Field: Status"))
    fireEvent.click(screen.getByText("Payment"))

    // The old values belonged to the old field.
    expect(screen.getByLabelText("Value for Payment: Select…")).toBeTruthy()
  })

  it("renders a lone operator as text rather than a button", () => {
    render(
      <Harness
        initial={[
          { id: "f1", field: "payment", operator: "is_any_of", values: [] },
        ]}
      />,
    )

    expect(screen.getByText("is any of").tagName).toBe("SPAN")
    expect(screen.queryByLabelText("Operator for Payment")).toBeNull()
  })

  it("falls back to the raw value when the option behind it is gone", () => {
    render(
      <Harness
        initial={[
          { id: "f1", field: "status", operator: "is", values: ["archived"] },
        ]}
      />,
    )

    // A deleted option still has to render as something that can be removed.
    expect(screen.getByLabelText("Value for Status: archived")).toBeTruthy()
  })

  it("draws an option's hint after its label and the field's note under the list", () => {
    const counted: FilterFieldDef = {
      ...STATUS,
      hintNote: "Counts ignore other filters.",
      options: [
        { value: "open", label: "Open", hint: "12" },
        { value: "closed", label: "Closed", hint: "0" },
        { value: "held", label: "Held" },
      ],
    }
    render(
      <Harness
        fields={[counted]}
        initial={[{ id: "f1", field: "status", operator: "is", values: ["open"] }]}
      />,
    )

    // The chip says what is applied, never how many match.
    expect(screen.getByLabelText("Value for Status: Open").textContent).not.toContain("12")

    openValueMenu()
    const open = screen.getByText("Open", { selector: "[data-slot='command-item'] span" })
    const row = open.closest("[data-slot='command-item']")!
    const hint = row.querySelector("[data-slot='filter-option-hint']")!
    expect(hint.textContent).toBe("12")
    // Trailing, not leading: the hint follows the label in the row.
    expect(open.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // A zero is still a count and still drawn.
    const closedRow = screen
      .getByText("Closed", { selector: "[data-slot='command-item'] span" })
      .closest("[data-slot='command-item']")!
    expect(closedRow.querySelector("[data-slot='filter-option-hint']")!.textContent).toBe("0")
    // An option without one draws nothing in its place.
    const heldRow = screen
      .getByText("Held", { selector: "[data-slot='command-item'] span" })
      .closest("[data-slot='command-item']")!
    expect(heldRow.querySelector("[data-slot='filter-option-hint']")).toBeNull()

    expect(screen.getByText("Counts ignore other filters.")).toBeTruthy()
  })

  it("leaves the note out while no option carries a hint", () => {
    render(
      <Harness
        fields={[{ ...STATUS, hintNote: "Counts ignore other filters." }]}
        initial={[{ id: "f1", field: "status", operator: "is", values: [] }]}
      />,
    )

    openValueMenu()
    expect(screen.getByText("Open", { selector: "[data-slot='command-item'] span" })).toBeTruthy()
    // A footnote explaining numbers that are not on screen explains nothing.
    expect(screen.queryByText("Counts ignore other filters.")).toBeNull()
  })

  it("counts values past the third so a chip stays on its row", () => {
    render(
      <Harness
        initial={[
          {
            id: "f1",
            field: "status",
            operator: "is_any_of",
            values: ["open", "closed", "held", "archived"],
          },
        ]}
      />,
    )

    expect(screen.getByLabelText("Value for Status: Open +3")).toBeTruthy()
  })

  it("offers Clear only once a second filter is on the bar", () => {
    const one = render(
      <Harness
        initial={[
          { id: "f1", field: "status", operator: "is", values: ["open"] },
        ]}
      />,
    )
    // One filter is removed by its own X; the shortcut would be a second way
    // to do the same thing.
    expect(screen.queryByText("Clear")).toBeNull()
    one.unmount()

    const onChange = vi.fn()
    render(
      <Harness
        onChange={onChange}
        initial={[
          { id: "f1", field: "status", operator: "is", values: ["open"] },
          { id: "f2", field: "payment", operator: "is_any_of", values: ["paid"] },
        ]}
      />,
    )
    fireEvent.click(screen.getByText("Clear"))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it("removes one chip and leaves the rest", () => {
    const onChange = vi.fn()
    render(
      <Harness
        onChange={onChange}
        initial={[
          { id: "f1", field: "status", operator: "is", values: ["open"] },
          { id: "f2", field: "payment", operator: "is_any_of", values: ["paid"] },
        ]}
      />,
    )

    fireEvent.click(screen.getByLabelText("Remove Status filter"))
    // Asserted on what goes out rather than on what leaves the DOM: the chip's
    // exit is an `AnimatePresence` animation, and jsdom runs no animations.
    const next = onChange.mock.calls[0]![0] as Filter[]
    expect(next.map((f) => f.id)).toEqual(["f2"])
  })

  it("offers each field once and drops the add button when all are used", () => {
    render(
      <Harness
        initial={[
          { id: "f1", field: "status", operator: "is", values: ["open"] },
        ]}
      />,
    )

    fireEvent.click(screen.getByText("Filter"))
    // Status is already on the bar; a second chip on it could only be ignored.
    expect(screen.queryByText("Status", { selector: "[data-slot='command-item'] span" })).toBeNull()
    expect(screen.getByText("Payment", { selector: "[data-slot='command-item'] span" })).toBeTruthy()

    // Adding the last remaining field leaves nothing to add.
    fireEvent.click(screen.getByText("Payment", { selector: "[data-slot='command-item'] span" }))
    expect(screen.queryByText("Filter")).toBeNull()
  })

  it("still lists a chip's own field in its field menu", () => {
    render(
      <Harness
        initial={[
          { id: "f1", field: "status", operator: "is", values: ["open"] },
          { id: "f2", field: "payment", operator: "is_any_of", values: [] },
        ]}
      />,
    )

    fireEvent.click(screen.getByLabelText("Field: Status"))
    // Its own field stays, or changing a field would be blocked by the chip
    // doing the changing; the other chip's field is what is withheld.
    expect(screen.getByText("Status", { selector: "[data-slot='command-item'] span" })).toBeTruthy()
    expect(screen.queryByText("Payment", { selector: "[data-slot='command-item'] span" })).toBeNull()
  })

  it("leaves the caret keys alone inside a nested input", () => {
    const onChange = vi.fn()
    render(
      <Harness
        onChange={onChange}
        initial={[
          { id: "f1", field: "status", operator: "is", values: ["open"] },
        ]}
      />,
    )
    // A screen puts its search box in `leading`; the bar must not treat a key
    // press inside it as navigation.
    const search = document.createElement("input")
    search.setAttribute("aria-label", "Search")
    screen.getByRole("toolbar").prepend(search)
    search.focus()

    for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"]) {
      const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
      })
      search.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(false)
    }
    expect(document.activeElement).toBe(search)
  })

  it("keeps the chip's corners logical so it flips under dir=rtl", () => {
    render(
      <div dir="rtl">
        <Harness
          initial={[
            { id: "f1", field: "status", operator: "is", values: ["open"] },
          ]}
        />
      </div>,
    )

    const field = screen.getByLabelText("Field: Status")
    expect(field.className).toContain("rounded-s-md")
    expect(field.className).not.toContain("rounded-l-md")

    const remove = screen.getByLabelText("Remove Status filter")
    expect(remove.className).toContain("rounded-e-md")
    expect(remove.className).not.toContain("rounded-r-md")
  })

  it("hides the add label when compactAdd is on", () => {
    render(
      <FilterBar
        fields={FIELDS}
        value={[]}
        onChange={() => {}}
        labels={LABELS}
        compactAdd
        aria-label="Filters"
      />,
    )
    expect(screen.queryByText("Add filter")).toBeNull()
    expect(screen.getByLabelText("Add filter")).toBeTruthy()
  })

  describe("async options", () => {
    const deferred = () => {
      let resolve!: (options: FilterOption[]) => void
      let reject!: () => void
      const promise = new Promise<FilterOption[]>((res, rej) => {
        resolve = res
        reject = rej
      })
      return { promise, resolve, reject }
    }

    const asyncField = (
      loadOptions: (query: string) => Promise<FilterOption[]>,
    ): FilterFieldDef => ({
      id: "tag",
      label: "Tag",
      operators: [{ value: "is_any_of", label: "is any of", multi: true }],
      loadOptions,
    })

    it("fetches when the menu opens and shows the rows it gets back", async () => {
      const first = deferred()
      const loadOptions = vi.fn(() => first.promise)
      render(
        <Harness
          fields={[asyncField(loadOptions)]}
          initial={[
            { id: "f1", field: "tag", operator: "is_any_of", values: [] },
          ]}
        />,
      )

      openValueMenu("Tag")
      expect(loadOptions).toHaveBeenCalledWith("")
      expect(screen.getByText("Loading options…")).toBeTruthy()

      first.resolve([{ value: "sale", label: "Sale" }])
      expect(await screen.findByText("Sale")).toBeTruthy()
    })

    it("drops a reply that a newer query has already superseded", async () => {
      const slow = deferred()
      const fast = deferred()
      const loadOptions = vi
        .fn<(query: string) => Promise<FilterOption[]>>()
        .mockReturnValueOnce(slow.promise)
        .mockReturnValueOnce(fast.promise)

      render(
        <Harness
          fields={[asyncField(loadOptions)]}
          initial={[
            { id: "f1", field: "tag", operator: "is_any_of", values: [] },
          ]}
        />,
      )

      openValueMenu("Tag")
      expect(loadOptions).toHaveBeenCalledTimes(1)

      fireEvent.change(screen.getByPlaceholderText("Filter…"), {
        target: { value: "su" },
      })
      // The debounce means only the last keystroke reaches the server.
      await waitFor(() => expect(loadOptions).toHaveBeenCalledTimes(2))
      expect(loadOptions).toHaveBeenLastCalledWith("su")

      fast.resolve([{ value: "summer", label: "Summer" }])
      expect(await screen.findByText("Summer")).toBeTruthy()

      // The first request lands last. It answers a query nobody is typing now.
      slow.resolve([{ value: "sale", label: "Sale" }])
      await Promise.resolve()
      expect(screen.queryByText("Sale")).toBeNull()
      expect(screen.getByText("Summer")).toBeTruthy()
    })

    it("offers a retry when the fetch fails", async () => {
      const failing = deferred()
      const second = deferred()
      const loadOptions = vi
        .fn<(query: string) => Promise<FilterOption[]>>()
        .mockReturnValueOnce(failing.promise)
        .mockReturnValueOnce(second.promise)

      render(
        <Harness
          fields={[asyncField(loadOptions)]}
          initial={[
            { id: "f1", field: "tag", operator: "is_any_of", values: [] },
          ]}
        />,
      )

      openValueMenu("Tag")
      failing.reject()
      expect(await screen.findByText("Could not load options.")).toBeTruthy()

      fireEvent.click(screen.getByText("Try again"))
      second.resolve([{ value: "sale", label: "Sale" }])
      expect(await screen.findByText("Sale")).toBeTruthy()
    })
  })
})
