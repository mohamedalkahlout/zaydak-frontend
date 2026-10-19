import { describe, expect, it, vi } from "vitest"
import { act, render, screen, fireEvent } from "@testing-library/react"
import { useEffect, useState } from "react"
import { useForm, type UseFormReturn } from "react-hook-form"
import { AiPrefillProvider } from "./ai-prefill-context"
import { AiFilledMark } from "./ai-filled-mark"

/**
 * Marking the fields the assistant filled.
 *
 * The provenance is destroyed by the merge every form does —
 * `{ ...base, ...aiPrefill }` gives the right values and no record of whose
 * they are — so the proposed values have to be carried separately. And the
 * mark has to clear the moment the vendor types: in front of a marked field
 * their question is "is this mine or its?", and a mark that stays after they
 * have answered it themselves is telling them something false.
 *
 * Since the live form channel the assistant can also change a field on a form
 * already open, which makes the field dirty on purpose (the save bar has to
 * show) — so the mark follows the value the assistant proposed, not "dirty".
 */

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

type Values = { price: unknown; name: unknown; description?: unknown }

/** Exposes the form and a way to change what the assistant proposed, the two
 * things a patch from the chat does. */
type Handle = {
  form: UseFormReturn<Values>
  setProposed: (next: Record<string, unknown>) => void
}
let handle: Handle

// Outside the component on purpose: a component may not reassign a variable
// declared outside it (React Compiler), so the harness hands its handle over
// from an effect, through this.
function capture(next: Handle) {
  handle = next
}

function Harness({
  fields,
  defaultValues = { price: 200, name: "Hoodie" },
  handoff = fields.length > 0,
}: {
  fields: string[]
  defaultValues?: Values
  /** Opened from a handoff. Defaults to "the assistant supplied something". */
  handoff?: boolean
}) {
  const form = useForm<Values>({ defaultValues })
  const [proposed, setProposed] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(
      fields.map((f) => [f, defaultValues[f as keyof Values]]),
    ),
  )
  useEffect(() => {
    capture({ form, setProposed })
  }, [form])
  return (
    <AiPrefillProvider
      handoff={handoff}
      proposed={proposed}
      control={form.control}
    >
      <label htmlFor="price">
        Price
        <AiFilledMark name="price" />
      </label>
      <input id="price" {...form.register("price")} />
      <label htmlFor="name">
        Title
        <AiFilledMark name="name" />
      </label>
      <input id="name" {...form.register("name")} />
      <span data-testid="description-label">
        Description
        <AiFilledMark name="description" />
      </span>
      <LocalState />
    </AiPrefillProvider>
  )
}

/** A card's own UI state — the kind a remount throws away. */
function LocalState() {
  const [open, setOpen] = useState(false)
  return (
    <button type="button" onClick={() => setOpen(true)}>
      {open ? "Expanded" : "Collapsed"}
    </button>
  )
}

const marks = () => screen.queryAllByText("Filled by Sidekick")

describe("<AiFilledMark />", () => {
  it("marks only the fields the assistant supplied", () => {
    render(<Harness fields={["price"]} />)

    expect(marks()).toHaveLength(1)
  })

  it("renders nothing on a form the vendor opened themselves", () => {
    render(<Harness fields={[]} />)

    expect(marks()).toHaveLength(0)
  })

  it("clears once the vendor edits that field", () => {
    render(<Harness fields={["price", "name"]} />)
    expect(marks()).toHaveLength(2)

    fireEvent.change(screen.getByLabelText(/Price/), {
      target: { value: "300" },
    })

    // Only the edited one goes.
    expect(marks()).toHaveLength(1)
  })

  it("stays cleared after the vendor types the original value back", () => {
    // Once they have been in the field it is theirs, even if what is in it
    // now matches what the assistant proposed. The mark answers "did I write
    // this or did it?", and after 200 → 300 → 200 the honest answer is "you
    // did". (It falls out of the strict comparison: the proposal is the
    // number 200 and an input yields the string "200".)
    render(<Harness fields={["price"]} />)

    const input = screen.getByLabelText(/Price/)
    fireEvent.change(input, { target: { value: "300" } })
    expect(marks()).toHaveLength(0)

    fireEvent.change(input, { target: { value: "200" } })
    expect(marks()).toHaveLength(0)
  })

  it("keeps the mark on a field the assistant changed on the open form", () => {
    // A patch writes the value dirty — the save bar has to show — and it is
    // still the assistant's value, so it is still marked.
    render(<Harness fields={["price"]} />)

    act(() => {
      handle.form.setValue("price", 300, { shouldDirty: true })
      handle.setProposed({ price: 300 })
    })

    expect(handle.form.getFieldState("price").isDirty).toBe(true)
    expect(marks()).toHaveLength(1)
  })

  it("marks a field the vendor had edited once the assistant patches it", () => {
    render(<Harness fields={["price"]} />)
    fireEvent.change(screen.getByLabelText(/Price/), {
      target: { value: "250" },
    })
    expect(marks()).toHaveLength(0)

    act(() => {
      handle.form.setValue("price", 300, { shouldDirty: true })
      handle.setProposed({ price: 300 })
    })

    expect(marks()).toHaveLength(1)
  })

  it("marks a field the assistant added after the form opened", () => {
    render(<Harness fields={["price"]} />)
    expect(marks()).toHaveLength(1)

    act(() => {
      handle.form.setValue("name", "Winter Hoodie", { shouldDirty: true })
      handle.setProposed({ price: 200, name: "Winter Hoodie" })
    })

    expect(marks()).toHaveLength(2)
  })

  it("marks nothing the assistant proposed empty", () => {
    // `create_product` put `description: { en: "", ar: "" }` in every handoff
    // with no description, and an empty editor holds exactly that — so it
    // read "Filled by Sidekick" over a field nobody wrote in.
    const empty = { en: "", ar: "" }
    render(
      <Harness
        fields={["price", "name", "description"]}
        defaultValues={{ price: 200, name: "", description: empty }}
      />,
    )

    // The price is the only thing it actually proposed.
    expect(marks()).toHaveLength(1)
    expect(screen.getByTestId("description-label").textContent).not.toContain(
      "Filled by Sidekick",
    )

    act(() => {
      handle.setProposed({ price: 200, name: null, description: empty })
    })
    expect(marks()).toHaveLength(1)
  })

  it("does not inherit a parent form's marks", () => {
    function Nested() {
      const outer = useForm<Values>({
        defaultValues: { price: 200, name: "Hoodie" },
      })
      return (
        <AiPrefillProvider
          handoff
          proposed={{ name: "Hoodie" }}
          control={outer.control}
        >
          <Harness fields={[]} />
        </AiPrefillProvider>
      )
    }
    render(<Nested />)
    // The inner form was not opened from a handoff, so the outer proposal
    // for "name" does not mark it.
    expect(marks()).toHaveLength(0)
  })

  it("does not remount the form when the first patch lands on an empty handoff", () => {
    // A handoff can carry no values at all. The provider used to render a
    // bare Fragment until something was proposed, then switch to its watcher
    // — a different element above the whole form, so every card remounted
    // and its own state (an expanded section, a picker's search) was lost.
    render(<Harness fields={[]} handoff />)
    fireEvent.click(screen.getByRole("button", { name: "Collapsed" }))
    const priceInput = screen.getByLabelText(/Price/)
    expect(marks()).toHaveLength(0)

    act(() => {
      handle.form.setValue("price", 300, { shouldDirty: true })
      handle.setProposed({ price: 300 })
    })

    expect(screen.getByRole("button", { name: "Expanded" })).toBeDefined()
    expect(screen.getByLabelText(/Price/)).toBe(priceInput)
    expect(marks()).toHaveLength(1)
  })
})
