import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { CombinedGraphQLErrors } from "@apollo/client/errors"
import type { StoreImportField } from "@/features/products/api"

/**
 * The bulk fill's toolbar action and confirmation. What these pin is what a
 * merchant reads before pressing the button — the count, the variant caveat,
 * that existing values are kept — and the two refusals the screen makes on its
 * own: no fill under an unsaved draft, and no fill with nothing to write.
 */

const { fill } = vi.hoisted(() => ({ fill: vi.fn() }))

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [fill, { loading: false }],
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

// The real picker loads the whole taxonomy; the dialog only needs to know
// what it hands back.
vi.mock(
  "@/features/products/components/form/pickers/system-category-picker",
  () => ({
    SystemCategoryCombobox: ({
      onSelect,
    }: {
      onSelect: (id: string) => void
    }) => (
      <button type="button" onClick={() => onSelect("cat-apparel")}>
        pick apparel
      </button>
    ),
  }),
)

import { BulkFillDialog } from "../bulk-fill-dialog"

const FIELDS: StoreImportField[] = [
  {
    key: "name_en",
    kind: "text",
    group: "product",
    never_scanned: false,
    blocks_sale: false,
    bulk_fillable: false,
  },
  {
    key: "quantity",
    kind: "integer",
    group: "inventory",
    never_scanned: true,
    blocks_sale: true,
    bulk_fillable: true,
  },
  {
    key: "system_category_id",
    kind: "category",
    group: "organization",
    never_scanned: true,
    blocks_sale: true,
    bulk_fillable: true,
  },
]

function renderDialog(
  props: Partial<Parameters<typeof BulkFillDialog>[0]> = {},
) {
  const onFilled = vi.fn()
  render(
    <BulkFillDialog
      jobId="job_1"
      fields={FIELDS}
      total={40}
      onlyIncomplete
      search="  mug "
      dirty={false}
      loading={false}
      onFilled={onFilled}
      {...props}
    />,
  )
  return { onFilled }
}

const trigger = () =>
  screen.getByRole("button", { name: "Fill stock and category" })

describe("BulkFillDialog", () => {
  beforeEach(() => {
    fill.mockReset()
    fill.mockResolvedValue({
      data: {
        bulkFillStoreImportOverrides: {
          success: true,
          affected: 32,
          matched: 40,
          data: { id: "job_1", status: "READY", artifact_expires_at: null },
        },
      },
    })
  })

  it("cannot be opened while there is an unsaved draft, and says why", () => {
    renderDialog({ dirty: true })

    const button = trigger() as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.getAttribute("title")).toBe(
      "Save or discard your edits before filling in bulk.",
    )
    // The reason is announced, not only hovered.
    const hint = document.getElementById(
      button.getAttribute("aria-describedby") ?? "",
    )
    expect(hint?.textContent).toBe(
      "Save or discard your edits before filling in bulk.",
    )
  })

  it("renders nothing when the server offers no field to fill", () => {
    renderDialog({
      fields: FIELDS.map((field) => ({ ...field, bulk_fillable: false })),
    })
    expect(
      screen.queryByRole("button", { name: "Fill stock and category" }),
    ).toBeNull()
  })

  it("names the count, the kept values and the first-variant caveat", () => {
    renderDialog()
    fireEvent.click(trigger())

    expect(
      screen.getByText(
        /This fills the 40 products in the current view\. Products you left out are skipped\./,
      ),
    ).toBeDefined()
    expect(
      screen.getByText(
        "On a product with variants, the stock goes to its first variant only, not to each variant. Set the other variants' stock after importing.",
      ),
    ).toBeDefined()
    expect(
      screen.getByText(
        "Off: only empty cells are filled. Your own edits and what we read from your old store are kept.",
      ),
    ).toBeDefined()
    expect(screen.getByRole("button", { name: "Fill 40 products" })).toBeDefined()
  })

  it("says 'this import' rather than 'the current view' when nothing filters it", () => {
    renderDialog({ onlyIncomplete: false, search: "" })
    fireEvent.click(trigger())

    expect(
      screen.getByText(/This fills the 40 products in this import\./),
    ).toBeDefined()
  })

  it("will not confirm with nothing to write", () => {
    renderDialog()
    fireEvent.click(trigger())

    const confirm = screen.getByRole("button", {
      name: "Fill 40 products",
    }) as HTMLButtonElement
    expect(confirm.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText("Stock"), {
      target: { value: "   " },
    })
    expect(confirm.disabled).toBe(true)
    expect(fill).not.toHaveBeenCalled()
  })

  it("sends the filter on screen, keeps existing values by default, and reports both counts", async () => {
    const { onFilled } = renderDialog()
    fireEvent.click(trigger())

    fireEvent.change(screen.getByLabelText("Stock"), {
      target: { value: "20" },
    })
    fireEvent.click(screen.getByRole("button", { name: "pick apparel" }))
    fireEvent.click(screen.getByRole("button", { name: "Fill 40 products" }))

    await waitFor(() => expect(onFilled).toHaveBeenCalled())
    expect(fill).toHaveBeenCalledWith({
      variables: {
        input: {
          id: "job_1",
          fields: { quantity: "20", system_category_id: "cat-apparel" },
          only_incomplete: true,
          search: "mug",
          overwrite: false,
        },
      },
    })
    expect(onFilled).toHaveBeenCalledWith({ affected: 32, matched: 40 })
  })

  it("overwrites only when the box is ticked", async () => {
    renderDialog()
    fireEvent.click(trigger())

    fireEvent.change(screen.getByLabelText("Stock"), {
      target: { value: "5" },
    })
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Replace values that are already there",
      }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Fill 40 products" }))

    await waitFor(() => expect(fill).toHaveBeenCalled())
    expect(fill.mock.calls[0]![0].variables.input.overwrite).toBe(true)
  })

  it("shows the server's refusal in words and stays open", async () => {
    fill.mockRejectedValue(
      new CombinedGraphQLErrors({
        errors: [
          {
            message: "This import can no longer be edited",
            extensions: { error_code: "STORE_IMPORT_INVALID_STATE" },
          },
        ],
      }),
    )
    const { onFilled } = renderDialog()
    fireEvent.click(trigger())

    fireEvent.change(screen.getByLabelText("Stock"), {
      target: { value: "5" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Fill 40 products" }))

    expect((await screen.findByRole("alert")).textContent).toBe(
      "This import isn't at a stage where that is possible. Reload the page.",
    )
    expect(onFilled).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "Fill 40 products" })).toBeDefined()
  })

  it("says what to fix when the server refuses a value, not 'try again'", async () => {
    fill.mockRejectedValue(
      new CombinedGraphQLErrors({
        errors: [
          {
            message: '"quantity" is not a whole number',
            extensions: { error_code: "VALIDATION_ERROR" },
          },
        ],
      }),
    )
    renderDialog()
    fireEvent.click(trigger())

    fireEvent.change(screen.getByLabelText("Stock"), {
      target: { value: "lots" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Fill 40 products" }))

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Check the values: stock must be a whole number, and the category must be one from the list.",
    )
  })
})
