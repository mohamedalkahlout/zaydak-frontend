import { describe, it, expect, vi, beforeAll } from "vitest"
import { useState } from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

// Type and Vendor are free text on the server, so what this control has to
// get right is the part that keeps a catalogue's vocabulary to one spelling:
// it opens on what the shop already uses, offers to create only what matches
// none of it, and never offers to create a value that already exists.

// The panel shares `products.picker.*` with `ChipPicker`, so the mock has to
// translate for real — a key echo would replace every string asserted below.
vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

import { ValueCombobox } from "../form/pickers/value-combobox"

beforeAll(() => {
  // Base UI positions the popup with floating-ui, which measures the anchor.
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

const OPTIONS = ["Graphic shirt", "Perfume"]

function Harness({
  initial = "",
  onChange,
  options = OPTIONS,
  ...rest
}: {
  initial?: string
  onChange?: (value: string) => void
  options?: string[]
} & Partial<React.ComponentProps<typeof ValueCombobox>>) {
  const [value, setValue] = useState(initial)
  return (
    <ValueCombobox
      label="Product type"
      value={value}
      onChange={(next) => {
        onChange?.(next)
        setValue(next)
      }}
      options={options}
      placeholder="Select or add product type"
      searchPlaceholder="Search or add product type"
      {...rest}
    />
  )
}

const trigger = () => screen.getByRole("button", { name: "Product type" })
const search = () =>
  screen.getByRole("textbox", { name: "Search or add product type" })

const openPanel = async () => {
  fireEvent.click(trigger())
  await screen.findByRole("textbox", { name: "Search or add product type" })
}

describe("ValueCombobox", () => {
  it("shows the placeholder until something is chosen", () => {
    render(<Harness />)
    expect(trigger().textContent).toContain("Select or add product type")
  })

  it("lists what the shop already uses and picks one", async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await openPanel()

    for (const option of OPTIONS) {
      expect(screen.getByRole("button", { name: option })).toBeTruthy()
    }

    fireEvent.click(screen.getByRole("button", { name: "Perfume" }))
    expect(onChange).toHaveBeenCalledWith("Perfume")
    // Picking closes the panel and the trigger reads the value.
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull())
    expect(trigger().textContent).toContain("Perfume")
  })

  it("narrows the list as you type", async () => {
    render(<Harness />)
    await openPanel()

    fireEvent.change(search(), { target: { value: "perf" } })

    expect(screen.getByRole("button", { name: "Perfume" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Graphic shirt" })).toBeNull()
  })

  it("offers to add a value the shop has never used", async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await openPanel()

    fireEvent.change(search(), { target: { value: "Candles" } })

    expect(screen.getByText("No results")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: 'Add "Candles"' }))
    expect(onChange).toHaveBeenCalledWith("Candles")
  })

  it("never offers to add a value that already exists, whatever the casing", async () => {
    render(<Harness />)
    await openPanel()

    // This is the whole reason the field is a picker: typing "perfume" must
    // land on the existing "Perfume" rather than creating a second spelling.
    fireEvent.change(search(), { target: { value: "perfume" } })

    expect(screen.queryByRole("button", { name: /^Add "/ })).toBeNull()
    expect(screen.getByRole("button", { name: "Perfume" })).toBeTruthy()
  })

  it("clears the field when the chosen value is picked again", async () => {
    const onChange = vi.fn()
    render(<Harness initial="Perfume" onChange={onChange} />)
    await openPanel()

    fireEvent.click(screen.getByRole("button", { name: "Perfume" }))

    expect(onChange).toHaveBeenCalledWith("")
    await waitFor(() =>
      expect(trigger().textContent).toContain("Select or add product type"),
    )
  })

  it("takes the first match on Enter, and the new value when nothing matches", async () => {
    const onChange = vi.fn()
    const { unmount } = render(<Harness onChange={onChange} />)
    await openPanel()
    fireEvent.change(search(), { target: { value: "graph" } })
    fireEvent.keyDown(search(), { key: "Enter" })
    expect(onChange).toHaveBeenLastCalledWith("Graphic shirt")
    unmount()

    render(<Harness onChange={onChange} />)
    await openPanel()
    fireEvent.change(search(), { target: { value: "  Candles  " } })
    fireEvent.keyDown(search(), { key: "Enter" })
    // Trimmed: the stored value is what the next product will match against.
    expect(onChange).toHaveBeenLastCalledWith("Candles")
  })

  it("says so when the shop has no values yet, and still offers to add one", async () => {
    render(<Harness options={[]} />)
    await openPanel()

    expect(screen.getByText("Nothing to show yet")).toBeTruthy()
    fireEvent.change(search(), { target: { value: "Perfume" } })
    expect(screen.getByRole("button", { name: 'Add "Perfume"' })).toBeTruthy()
  })

  it("drops the query when the panel closes, so it reopens clean", async () => {
    render(<Harness />)
    await openPanel()
    fireEvent.change(search(), { target: { value: "graph" } })
    fireEvent.keyDown(search(), { key: "Escape" })

    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull())
    await openPanel()
    expect(search()).toHaveProperty("value", "")
    expect(screen.getByRole("button", { name: "Perfume" })).toBeTruthy()
  })
  it("falls back to the shared picker vocabulary when the caller names nothing", async () => {
    // Type and Vendor pass their own wording; anything else that reaches for
    // this control gets `products.picker.*` — the same strings `ChipPicker`
    // uses, which is the point of the two panels sharing a namespace.
    render(
      <Harness placeholder={undefined} searchPlaceholder={undefined} options={[]} />,
    )
    expect(
      screen.getByRole("button", { name: "Product type" }).textContent,
    ).toContain("Select or add")

    fireEvent.click(screen.getByRole("button", { name: "Product type" }))
    const box = await screen.findByRole("textbox", { name: "Search or add" })
    expect(screen.getByText("Nothing to show yet")).toBeTruthy()

    fireEvent.change(box, { target: { value: "Candles" } })
    expect(screen.getByRole("button", { name: 'Add "Candles"' })).toBeTruthy()
  })
})
