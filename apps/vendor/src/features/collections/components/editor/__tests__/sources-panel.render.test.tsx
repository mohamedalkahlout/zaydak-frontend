import { beforeAll, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { useForm } from "react-hook-form"
import {
  collectionFormDefaults,
  newCondition,
  newSource,
} from "@/features/collections/lib/rules"
import {
  MAX_TOTAL_CONDITIONS,
  type CollectionFormApi,
  type CollectionFormInput,
  type ConditionInput,
  type SourceInput,
} from "@/features/collections/validations/shop-collection"

// The panel's one decision: the API's 60-condition budget is per collection,
// so every card's "Add condition" goes quiet together once the sum reaches it,
// and the count only appears once it is close enough to matter.

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}))

// The option hooks are Apollo queries; the label map is all the card reads.
vi.mock("../use-collection-options", () => ({
  useCollectionOptions: () => ({ labelOf: (id: string) => id }),
}))

// A condition row is an attribute popover, an operator select and a value
// editor — none of it is what these pin, and sixty of them in jsdom is a slow
// way to render nothing. The pickers are dialogs that stay closed.
vi.mock("../condition-row", () => ({ ConditionRow: () => null }))
vi.mock("../product-picker-dialog", () => ({ ProductPickerDialog: () => null }))
vi.mock("../collection-picker-dialog", () => ({
  CollectionPickerDialog: () => null,
}))

const { SourcesPanel } = await import("../sources-panel")

beforeAll(() => {
  // Base UI's select positions with floating-ui, which measures the anchor;
  // jsdom ships no ResizeObserver and the trigger never mounts without one.
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

const fill = (count: number): ConditionInput[] =>
  Array.from({ length: count }, () => ({
    ...newCondition("brand"),
    values: ["Acme"],
  }))

/** Two sources sharing the budget: `conditions` on one, `excluded` on the other. */
function Harness({
  conditions,
  excluded = 0,
}: {
  conditions: number
  excluded?: number
}) {
  const second = newSource("b")
  const sources: SourceInput[] = [
    { ...newSource("a"), conditions: fill(conditions) },
    { ...second, exclude: { ...second.exclude, conditions: fill(excluded) } },
  ]
  const form = useForm<CollectionFormInput>({
    defaultValues: { ...collectionFormDefaults(), sources },
  }) as CollectionFormApi
  return <SourcesPanel form={form} />
}

const addButtons = () =>
  screen.getAllByRole("button", {
    name: "sources.addCondition",
  }) as HTMLButtonElement[]

const disabledStates = () => addButtons().map((button) => button.disabled)

describe("SourcesPanel", () => {
  it("keeps the count off screen while the budget is far away", () => {
    render(<Harness conditions={10} />)
    expect(screen.queryByRole("status")).toBeNull()
    expect(disabledStates()).toEqual([false, false])
  })

  it("shows the count once it is close, with every card still able to add", () => {
    render(<Harness conditions={MAX_TOTAL_CONDITIONS - 1} />)
    const status = screen.getByRole("status")
    expect(status.textContent).toBe("conditions.budget")
    expect(status.className).not.toContain("text-destructive")
    expect(disabledStates()).toEqual([false, false])
  })

  it("disables every card's Add condition at the cap, counting exclusions too", () => {
    render(
      <Harness
        conditions={MAX_TOTAL_CONDITIONS - 20}
        excluded={20}
      />,
    )
    expect(screen.getByRole("status").className).toContain("text-destructive")
    expect(disabledStates()).toEqual([true, true])
  })
})
