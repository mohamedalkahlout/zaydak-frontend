import { describe, it, expect, vi, beforeAll } from "vitest"
import { useState } from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

// The picker behind the product form's Collections and Tags fields. What is
// worth pinning is the panel's decisions rather than its looks: which rows the
// search leaves standing, when it offers to create what was typed, and that a
// selection survives being made from either side of the control.

// The picker now reads `products.picker.*` for its own chrome, so the usual
// key-echo mock would turn every English assertion below into a key. This one
// translates against the real `en.json`, which is also what makes a key that
// does not exist fail here rather than pass quietly.
vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

import { ChipPicker, type PickerGroup } from "../form/pickers/chip-picker"

beforeAll(() => {
  // Base UI positions the panel with floating-ui, which measures the anchor.
  // jsdom ships no ResizeObserver, and without one the popup never mounts.
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

const GROUPS: PickerGroup[] = [
  { label: "Frequently used", options: [{ id: "t1", label: "Summer" }] },
  {
    label: "Other tags",
    options: [
      { id: "t2", label: "Casual" },
      { id: "t3", label: "Clothing" },
    ],
  },
]

function Harness({
  initial = [],
  onChange,
  ...rest
}: {
  initial?: string[]
  onChange?: (ids: string[]) => void
} & Partial<React.ComponentProps<typeof ChipPicker>>) {
  const [value, setValue] = useState<string[]>(initial)
  return (
    <ChipPicker
      label="Tags"
      addLabel="Add tags"
      groups={GROUPS}
      value={value}
      onChange={(ids) => {
        setValue(ids)
        onChange?.(ids)
      }}
      {...rest}
    />
  )
}

// One opener exists at a time and both carry the same accessible name: the
// pill inside an empty box, the small button on the label row once there are
// chips. So this drives the control in either state.
const openPanel = () =>
  fireEvent.click(screen.getByRole("button", { name: "Add tags" }))

const search = (text: string) =>
  fireEvent.change(screen.getByPlaceholderText("Search"), {
    target: { value: text },
  })

describe("ChipPicker", () => {
  it("offers an add pill inside the box while nothing is selected", () => {
    render(<Harness />)
    const pill = screen.getByRole("button", { name: "Add tags" })
    // Inside the field's own box, not on the label row beside it.
    expect(pill.closest("[class*='border-input']")).not.toBeNull()
  })

  it("moves the opener to the label row once a chip lands", () => {
    render(<Harness initial={["t1"]} />)
    const opener = screen.getByRole("button", { name: "Add tags" })
    expect(opener.closest("[class*='border-input']")).toBeNull()
    // Never two at once -- a second opener outside the panel fights its own
    // outside-press dismissal and the control reads as stuck open.
    expect(screen.getAllByRole("button", { name: "Add tags" })).toHaveLength(1)
  })

  it("labels a chip from a snapshot when the option is off the loaded page", () => {
    render(<Harness initial={["t9"]} snapshots={{ t9: "Vintage" }} />)
    expect(screen.getByText("Vintage")).toBeDefined()
  })

  it("adds the row it is told to, keeping what was already selected", async () => {
    const onChange = vi.fn()
    render(<Harness initial={["t1"]} onChange={onChange} />)
    openPanel()
    fireEvent.click(await screen.findByText("Casual"))
    expect(onChange).toHaveBeenCalledWith(["t1", "t2"])
    // A row is a <label> around the checkbox, so a click on the text forwards
    // to it. Once — a second, self-cancelling toggle would leave the assertion
    // above intact and the control unusable.
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it("toggles from the checkbox itself as well as from the row", async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    openPanel()
    await screen.findByText("Casual")
    // Rows are in group order: Summer, Casual, Clothing.
    fireEvent.click(screen.getAllByRole("checkbox")[1]!)
    expect(onChange).toHaveBeenCalledWith(["t2"])
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it("removes a selection from its chip", () => {
    const onChange = vi.fn()
    render(<Harness initial={["t1", "t2"]} onChange={onChange} />)
    fireEvent.click(screen.getByRole("button", { name: "Remove Summer" }))
    expect(onChange).toHaveBeenCalledWith(["t2"])
  })

  it("filters across groups and drops the headings left empty", async () => {
    render(<Harness />)
    openPanel()
    await screen.findByText("Casual")
    search("clo")
    expect(screen.getByText("Clothing")).toBeDefined()
    expect(screen.queryByText("Casual")).toBeNull()
    expect(screen.queryByText("Frequently used")).toBeNull()
  })

  it("offers to create what was typed once nothing matches, and selects it", async () => {
    const onCreateOption = vi.fn().mockResolvedValue("new-id")
    const onChange = vi.fn()
    render(<Harness onChange={onChange} onCreateOption={onCreateOption} />)
    openPanel()
    await screen.findByText("Casual")
    search("agash")

    expect(screen.getByText("No results")).toBeDefined()
    fireEvent.click(screen.getByText('Add "agash"'))

    await waitFor(() => expect(onCreateOption).toHaveBeenCalledWith("agash"))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(["new-id"]))
  })

  it("leaves the selection alone when the create fails", async () => {
    const onCreateOption = vi.fn().mockResolvedValue(null)
    const onChange = vi.fn()
    render(<Harness onChange={onChange} onCreateOption={onCreateOption} />)
    openPanel()
    await screen.findByText("Casual")
    search("agash")
    fireEvent.click(screen.getByText('Add "agash"'))

    await waitFor(() => expect(onCreateOption).toHaveBeenCalled())
    expect(onChange).not.toHaveBeenCalled()
  })

  it("does not offer to create a name that already exists", async () => {
    render(<Harness onCreateOption={vi.fn()} />)
    openPanel()
    await screen.findByText("Casual")
    search("casual")
    expect(screen.queryByText('Add "casual"')).toBeNull()
  })

  it("runs the footer action and closes the panel behind it", async () => {
    const onSelect = vi.fn()
    render(
      <Harness footerAction={{ label: "Add new collection", onSelect }} />,
    )
    openPanel()
    fireEvent.click(await screen.findByText("Add new collection"))

    expect(onSelect).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(screen.queryByText("Add new collection")).toBeNull(),
    )
  })

  it("falls back to the shared search placeholder, and lets a caller override it", async () => {
    const { unmount } = render(<Harness />)
    openPanel()
    // No `searchPlaceholder` prop: `common.search`, the same word every other
    // search box in the dashboard uses.
    expect(await screen.findByPlaceholderText("Search")).toBeDefined()
    unmount()

    render(<Harness searchPlaceholder="Search or add tags" />)
    openPanel()
    expect(await screen.findByPlaceholderText("Search or add tags")).toBeDefined()
  })

  it("names the add opener from the caller rather than composing it", () => {
    // The composed `Add ${label.toLowerCase()}` is what made this control
    // untranslatable; the label and the button text are now two separate
    // already-localized strings and neither is derived from the other.
    render(<Harness label="الوسوم" addLabel="إضافة وسوم" />)
    expect(
      screen.getByRole("button", { name: "إضافة وسوم" }),
    ).toBeDefined()
  })
})
