import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { ShopReviewsSummary } from "../../types"

// What these pin is the part of the card that is not decoration: the bars are
// the rating filter, so a click has to change the list and a second click has
// to put it back. Translations return their key, so assertions read as keys.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}))

import { ReviewsSummary } from "../reviews-summary"

const summary = (over: Partial<ShopReviewsSummary> = {}): ShopReviewsSummary => ({
  total: 4,
  average_rating: 4.3,
  distribution: [
    { rating: 5, count: 3 },
    { rating: 4, count: 0 },
    { rating: 3, count: 0 },
    { rating: 2, count: 1 },
    { rating: 1, count: 0 },
  ],
  with_photos: 2,
  last_30_days: 4,
  reported: 1,
  ...over,
})

function renderCard(props: Partial<React.ComponentProps<typeof ReviewsSummary>> = {}) {
  const onSelectRating = vi.fn()
  render(
    <ReviewsSummary
      summary={summary()}
      loading={false}
      activeRating={null}
      onSelectRating={onSelectRating}
      {...props}
    />,
  )
  return { onSelectRating }
}

describe("ReviewsSummary", () => {
  it("shows the average to one decimal", () => {
    renderCard()
    expect(screen.getByText("4.3")).toBeDefined()
  })

  it("draws a bar for every star, including the empty ones", () => {
    renderCard()
    // Five bars — a distribution that hid its zeros would read as a shop with
    // only 5- and 2-star reviews and no scale between them.
    expect(screen.getAllByRole("button")).toHaveLength(5)
  })

  it("filters the list when a bar with reviews is clicked", () => {
    const { onSelectRating } = renderCard()
    const bars = screen.getAllByRole("button")
    fireEvent.click(bars[0]) // 5 stars, count 3

    expect(onSelectRating).toHaveBeenCalledWith(5)
  })

  it("clears the filter when the active bar is clicked again", () => {
    const { onSelectRating } = renderCard({ activeRating: 5 })
    const bars = screen.getAllByRole("button")
    expect(bars[0].getAttribute("aria-pressed")).toBe("true")

    fireEvent.click(bars[0])
    expect(onSelectRating).toHaveBeenCalledWith(null)
  })

  it("disables an empty bar that is not the active filter", () => {
    renderCard()
    const bars = screen.getAllByRole("button")
    // 4 stars — zero reviews, nothing to show, so it must not be clickable.
    expect((bars[1] as HTMLButtonElement).disabled).toBe(true)
    // 2 stars — one review.
    expect((bars[3] as HTMLButtonElement).disabled).toBe(false)
  })

  it("keeps an empty bar clickable while it is the active filter", () => {
    // Otherwise filtering to a rating that then drops to zero traps the
    // merchant on an empty list with the only way out disabled.
    renderCard({ activeRating: 4, summary: summary() })
    const bars = screen.getAllByRole("button")
    expect((bars[1] as HTMLButtonElement).disabled).toBe(false)
  })

  it("renders nothing before the summary arrives", () => {
    const { container } = render(
      <ReviewsSummary
        summary={null}
        loading={false}
        activeRating={null}
        onSelectRating={vi.fn()}
      />,
    )
    expect(container.firstChild).toBeNull()
  })
})
