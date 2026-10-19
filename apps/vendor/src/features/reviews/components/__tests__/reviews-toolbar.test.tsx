import { describe, it, expect, vi, beforeAll } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { ReviewProductFilter } from "../../types"

// The toolbar is wiring: what it pins is that every filter reaches the screen
// through its own callback and that Clear exists only while something is
// filtered. The product picker has its own test, so here it is a stub that
// shows the value it was handed and reports one fixed pick.

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}))

const PICK: ReviewProductFilter = { id: "p9", label: "Nine", image: null }

vi.mock("../product-filter", () => ({
  ProductFilter: ({
    value,
    onChange,
  }: {
    value: ReviewProductFilter | null
    onChange: (p: ReviewProductFilter | null) => void
  }) => (
    <button type="button" onClick={() => onChange(PICK)}>
      {value ? `product:${value.label}` : "product:none"}
    </button>
  ),
}))

const { ReviewsToolbar } = await import("../reviews-toolbar")

beforeAll(() => {
  // Base UI's Select measures its trigger through floating-ui.
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

function renderToolbar(
  props: Partial<React.ComponentProps<typeof ReviewsToolbar>> = {},
) {
  const handlers = {
    onSearchChange: vi.fn(),
    onRatingChange: vi.fn(),
    onProductChange: vi.fn(),
    onSortChange: vi.fn(),
    onClear: vi.fn(),
  }
  render(
    <ReviewsToolbar
      search=""
      rating={null}
      product={null}
      sort="NEWEST"
      hasFilters={false}
      {...handlers}
      {...props}
    />,
  )
  return handlers
}

describe("ReviewsToolbar", () => {
  it("offers Clear only while something is filtered", () => {
    renderToolbar()
    expect(screen.queryByText("clear")).toBeNull()
  })

  it("clears through the screen, not by itself", () => {
    const { onClear } = renderToolbar({ hasFilters: true, rating: 5 })
    fireEvent.click(screen.getByText("clear"))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it("passes the raw search text up on every keystroke", () => {
    const { onSearchChange } = renderToolbar()
    fireEvent.change(screen.getByLabelText("filters.searchPlaceholder"), {
      target: { value: "late" },
    })
    // Throttling is the screen's job; the toolbar reports the raw value.
    expect(onSearchChange).toHaveBeenCalledWith("late")
  })

  it("hands the product filter its value and relays its pick", () => {
    const { onProductChange } = renderToolbar({
      product: { id: "p1", label: "Dive Watch", image: null },
    })
    expect(screen.getByText("product:Dive Watch")).toBeTruthy()

    fireEvent.click(screen.getByText("product:Dive Watch"))
    expect(onProductChange).toHaveBeenCalledWith(PICK)
  })

  it("shows no product while none is selected", () => {
    renderToolbar()
    expect(screen.queryByText("product:none")).toBeNull()
  })
})
