import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

/**
 * Whether `deleteRule` can be reached for the last rate on a zone.
 *
 * A zone with no rate is not "free", it is a wall: the matcher returns it
 * with no options, checkout answers `destination_excluded`, and `createOrder`
 * refuses every order to its destinations. The old dialog confirmed the
 * delete with copy saying the zone would be "quoted nothing", which was both
 * wrong and one click from a shop that could not sell to that region.
 *
 * The blocked state renders no Delete button at all — the mutation is
 * unreachable, not merely disabled — and offers the two ways out in words,
 * one of them as a button. The unblocked states are unchanged and pinned so
 * the branch cannot swallow them.
 *
 * Boundaries are mocked rather than provided (the repo's component-test
 * convention); translations return their key. No jest-dom — assertions use
 * plain DOM properties.
 */

function opName(doc: any): string {
  return doc?.definitions?.[0]?.name?.value ?? ""
}

/** One spy per mutation document, keyed by operation name. */
const mutations: Record<string, ReturnType<typeof vi.fn>> = {}

vi.mock("@apollo/client/react", () => ({
  useMutation: (doc: any) => [mutations[opName(doc)], { loading: false }],
  useApolloClient: () => ({ refetchQueries: vi.fn() }),
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }))

const { DeleteShippingDialog } = await import("../delete-shipping-dialog")

const deleteButton = () =>
  screen.queryByRole("button", { name: "Delete" })

beforeEach(() => {
  mutations.DeleteShippingRule = vi.fn(() => Promise.resolve({ data: {} }))
  mutations.DeleteShippingZone = vi.fn(() => Promise.resolve({ data: {} }))
})

describe("DeleteShippingDialog", () => {
  it("refuses the last rate on a zone and offers deleting the zone instead", () => {
    const onDeleteZoneInstead = vi.fn()
    render(
      <DeleteShippingDialog
        open
        kind="rate"
        id="r1"
        name="Standard"
        lastRateOfZone={{ name: "Gulf" }}
        onDeleteZoneInstead={onDeleteZoneInstead}
        onOpenChange={vi.fn()}
      />,
    )

    expect(
      screen.getByText("This is the zone’s only rate"),
    ).toBeTruthy()
    expect(deleteButton()).toBeNull()

    fireEvent.click(
      screen.getByRole("button", {
        name: "Delete the zone instead",
      }),
    )
    expect(onDeleteZoneInstead).toHaveBeenCalledTimes(1)
    expect(mutations.DeleteShippingRule).not.toHaveBeenCalled()
    expect(mutations.DeleteShippingZone).not.toHaveBeenCalled()
  })

  it("deletes a rate that is not the last on its zone", () => {
    render(
      <DeleteShippingDialog
        open
        kind="rate"
        id="r1"
        name="Standard"
        onOpenChange={vi.fn()}
      />,
    )

    expect(screen.getByText("Delete this rate?")).toBeTruthy()
    fireEvent.click(deleteButton() as HTMLElement)
    expect(mutations.DeleteShippingRule).toHaveBeenCalledWith({
      variables: { id: "r1" },
    })
    expect(mutations.DeleteShippingZone).not.toHaveBeenCalled()
  })

  it("deletes a zone", () => {
    render(
      <DeleteShippingDialog
        open
        kind="zone"
        id="z1"
        name="Gulf"
        onOpenChange={vi.fn()}
      />,
    )

    expect(screen.getByText("Delete this zone?")).toBeTruthy()
    fireEvent.click(deleteButton() as HTMLElement)
    expect(mutations.DeleteShippingZone).toHaveBeenCalledWith({
      variables: { id: "z1" },
    })
    expect(mutations.DeleteShippingRule).not.toHaveBeenCalled()
  })

  // The parent swaps `kind` to "zone" while the blocked state's zone is still
  // in its state object; the block must be a rate-only reading of that prop.
  it("ignores lastRateOfZone once the dialog is confirming a zone", () => {
    render(
      <DeleteShippingDialog
        open
        kind="zone"
        id="z1"
        name="Gulf"
        lastRateOfZone={{ name: "Gulf" }}
        onOpenChange={vi.fn()}
      />,
    )

    expect(screen.getByText("Delete this zone?")).toBeTruthy()
    expect(deleteButton()).toBeTruthy()
  })
})
