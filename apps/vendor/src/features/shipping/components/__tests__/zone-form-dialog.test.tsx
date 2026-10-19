import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { ShippingZone } from "../../types"

/**
 * Whether the dialog lets a merchant save a second catch-all.
 *
 * Two catch-alls match exactly the same destinations — the dialog cannot edit
 * `states`, so there is nothing to tell them apart — and only `priority`
 * decides which one is charged. The other sits on the list looking live. The
 * hint under the countries field already said "keep exactly one of these";
 * this is what makes the sentence true.
 *
 * Three cases: a second catch-all is refused (with the existing one named and
 * Save disabled — and Enter, which submits the form regardless of the
 * button, refused too); the existing catch-all can still be edited without
 * being reported as its own conflict; and the first catch-all is allowed.
 *
 * Boundaries are mocked rather than provided (the repo's component-test
 * convention); translations return their key. No jest-dom — assertions use
 * plain DOM properties.
 */

function opName(doc: any): string {
  return doc?.definitions?.[0]?.name?.value ?? ""
}

let create: ReturnType<typeof vi.fn>
let update: ReturnType<typeof vi.fn>

vi.mock("@apollo/client/react", () => ({
  useMutation: (doc: any) => [
    opName(doc) === "CreateShippingZone" ? create : update,
    { loading: false },
  ],
  useApolloClient: () => ({ refetchQueries: vi.fn() }),
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }))

// The nested picker searches ~250 countries and has its own behaviour; this
// file is about one derived boolean, so the picker is stubbed out.
vi.mock("@/features/coupons/components/new/countries-picker-dialog", () => ({
  CountriesPickerDialog: () => null,
}))

const { ZoneFormDialog } = await import("../zone-form-dialog")

function zone(
  partial: Partial<ShippingZone> & { id: string; name: ShippingZone["name"] },
): ShippingZone {
  return {
    countries: [],
    states: [],
    priority: 0,
    is_global: false,
    shop_id: "shop_1",
    rules: [],
    ...partial,
  }
}

const rest = zone({ id: "rest", name: { en: "Rest of world" } })
const gulf = zone({ id: "gulf", name: { en: "Gulf" }, countries: ["SA"] })

const saveButton = () =>
  screen.getByRole("button", { name: "Save" }) as HTMLButtonElement
const conflictShown = () =>
  screen.queryByText(/is already the catch-all/)
const hintShown = () =>
  screen.queryByText(
    "Leave empty and this zone catches every destination no other zone covers. Keep exactly one of these.",
  )

function typeName(value: string) {
  fireEvent.change(
    screen.getByPlaceholderText("Gulf, Local, Rest of world…"),
    { target: { value } },
  )
}

/** Enter in the name input — submits the form whatever Save's `disabled` says. */
function submitForm() {
  fireEvent.submit(saveButton().closest("form") as HTMLFormElement)
}

beforeEach(() => {
  create = vi.fn(() => Promise.resolve({ data: {} }))
  update = vi.fn(() => Promise.resolve({ data: {} }))
})

describe("ZoneFormDialog — exactly one catch-all", () => {
  it("refuses a second catch-all: names the existing one, disables Save and ignores Enter", () => {
    render(<ZoneFormDialog open zones={[gulf, rest]} onOpenChange={vi.fn()} />)
    typeName("Everywhere")

    expect(conflictShown()).toBeTruthy()
    expect(hintShown()).toBeNull()
    expect(saveButton().disabled).toBe(true)

    submitForm()
    expect(create).not.toHaveBeenCalled()
  })

  it("lets the existing catch-all be edited without seeing itself as the conflict", () => {
    render(
      <ZoneFormDialog
        open
        zone={rest}
        zones={[gulf, rest]}
        onOpenChange={vi.fn()}
      />,
    )

    expect(conflictShown()).toBeNull()
    expect(hintShown()).toBeTruthy()
    expect(saveButton().disabled).toBe(false)

    submitForm()
    expect(update).toHaveBeenCalledTimes(1)
    expect(create).not.toHaveBeenCalled()
  })

  it("allows the first catch-all", () => {
    render(<ZoneFormDialog open zones={[gulf]} onOpenChange={vi.fn()} />)
    typeName("Rest of world")

    expect(conflictShown()).toBeNull()
    expect(hintShown()).toBeTruthy()
    expect(saveButton().disabled).toBe(false)

    submitForm()
    expect(create).toHaveBeenCalledTimes(1)
  })
})
