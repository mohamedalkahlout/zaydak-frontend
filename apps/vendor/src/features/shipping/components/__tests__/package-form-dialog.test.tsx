import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

/**
 * What the package dialog says about a size it will not save.
 *
 * The three dimension checks used to name `validation.invalidLength` /
 * `invalidWidth` / `invalidHeight`, which exist in neither catalogue, so a
 * merchant who typed a zero saw a raw key under the form. Translations here
 * are the real English catalogue (`nextIntlMock`), so a key missing from
 * `en.json` fails the assertion instead of echoing back and passing.
 *
 * The form is submitted directly: the inputs carry `required` / `min`, which
 * a browser enforces before submit and jsdom does not, and the dialog's own
 * check is the one under test.
 */

const create = vi.fn()

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [create, { loading: false }],
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }))

const { PackageFormDialog } = await import("../package-form-dialog")

function renderDialog(size: [string, string, string]) {
  render(
    <PackageFormDialog
      open
      draft={{ name: "Mailer box" }}
      onOpenChange={vi.fn()}
    />,
  )
  const [length, width, height] = size
  fireEvent.change(screen.getByLabelText("Length"), {
    target: { value: length },
  })
  fireEvent.change(screen.getByLabelText("Width"), { target: { value: width } })
  fireEvent.change(screen.getByLabelText("Height"), {
    target: { value: height },
  })
  fireEvent.submit(screen.getByLabelText("Package name").closest("form")!)
}

describe("PackageFormDialog", () => {
  beforeEach(() => create.mockReset())

  it.each([
    ["length", ["0", "20", "10"]],
    ["width", ["30", "", "10"]],
    ["height", ["30", "20", "-4"]],
  ] as const)("refuses a bad %s with the translated message", (_, size) => {
    renderDialog([...size])

    expect(
      screen.getByText("Dimensions must be greater than zero"),
    ).toBeTruthy()
    expect(create).not.toHaveBeenCalled()
  })

  it("saves a box whose three sides are all above zero", () => {
    create.mockResolvedValue({ data: { createShopPackage: { data: null } } })
    renderDialog(["30", "20", "10"])

    expect(screen.queryByText("Dimensions must be greater than zero")).toBeNull()
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0].variables.input).toMatchObject({
      length_mm: 300,
      width_mm: 200,
      height_mm: 100,
    })
  })
})
