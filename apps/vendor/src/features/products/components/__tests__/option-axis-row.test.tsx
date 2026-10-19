import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

// The connected-metafield badge on a variant option row.
//
// It is a dropdown trigger wearing a Badge, and Badge is a `<span>` by
// default. That combination is wrong twice over and only one half is loud:
// Base UI logs a console error about losing native button semantics, while the
// quiet half is that this row lives **inside the product form**, where the fix
// for the loud half — rendering a real `<button>` — submits the form on click
// unless it carries `type="button"`.

import type { OptionAxis } from "../form/variants/use-variant-options"

const { OptionAxisRow } = await import("../form/variants/option-axis-row")

const AXIS: OptionAxis = {
  id: "axis-1",
  name: "Dispenser type",
  values: ["Spray"],
  isEditing: true,
  draftName: "Dispenser type",
  draftValues: ["Spray"],
  connectedAttribute: {
    key: "dispenser_type",
    label: "Dispenser type",
    options: [
      { value: "spray", label: "Spray" },
      { value: "roll_on", label: "Roll-on" },
    ],
  },
}

function renderRow(axis: OptionAxis = AXIS) {
  const noop = vi.fn()
  return render(
    <form onSubmit={noop}>
      <OptionAxisRow
        axis={axis}
        onStartEdit={noop}
        onCancelEdit={noop}
        onDelete={noop}
        onDone={noop}
        onDraftNameChange={noop}
        onDraftValuesChange={noop}
        onDisconnect={noop}
      />
    </form>,
  )
}

describe("OptionAxisRow — connected metafield badge", () => {
  it("is a real button, so it keeps native button semantics", () => {
    renderRow()

    const badge = screen.getByRole("button", { name: /dispenser type/i })
    // Not `role="button"` on a span: a real element is what gives the trigger
    // its keyboard behaviour for free, and it is what Base UI asserts on.
    expect(badge.tagName).toBe("BUTTON")
  })

  it('carries type="button" so clicking it cannot submit the product form', () => {
    renderRow()

    const badge = screen.getByRole("button", { name: /dispenser type/i })
    // A bare <button> inside a <form> defaults to type="submit". This badge
    // opens a menu; saving the product is the save bar's job.
    expect(badge.getAttribute("type")).toBe("button")
  })

  it("is not nested inside the collapsed row's own button", () => {
    // The collapsed row is clickable end to end, but that click target cannot
    // be a <button> wrapping the whole row: the badge is a menu trigger, and
    // <button> inside <button> is invalid HTML that React refuses to hydrate.
    // A name distinct from the metafield label, so the two buttons in the
    // collapsed row are told apart by their accessible names.
    renderRow({ ...AXIS, isEditing: false, name: "Applicator" })

    const badge = screen.getByRole("button", { name: /dispenser type/i })
    expect(badge.closest("button")).toBe(badge)

    // ...and the row still has its own trigger for opening the editor.
    const row = screen.getByRole("button", { name: "Applicator" })
    expect(row).not.toBe(badge)
    expect(row.contains(badge)).toBe(false)
  })

  it("is absent entirely on an axis that is not connected to a metafield", () => {
    const { connectedAttribute: _omitted, ...plain } = AXIS
    renderRow(plain)

    expect(
      screen.queryByRole("button", { name: /dispenser type/i }),
    ).toBeNull()
  })

  it("renders translated View metafield and Disconnect items in the dropdown menu", () => {
    const onDisconnect = vi.fn()
    render(
      <form onSubmit={vi.fn()}>
        <OptionAxisRow
          axis={AXIS}
          onStartEdit={vi.fn()}
          onCancelEdit={vi.fn()}
          onDelete={vi.fn()}
          onDone={vi.fn()}
          onDraftNameChange={vi.fn()}
          onDraftValuesChange={vi.fn()}
          onDisconnect={onDisconnect}
        />
      </form>,
    )

    const badge = screen.getByRole("button", { name: /dispenser type/i })
    fireEvent.click(badge)

    expect(screen.getByText("View metafield")).toBeDefined()
    const disconnectItem = screen.getByText("Disconnect")
    expect(disconnectItem).toBeDefined()

    fireEvent.click(disconnectItem)
    expect(onDisconnect).toHaveBeenCalledTimes(1)
  })
})
