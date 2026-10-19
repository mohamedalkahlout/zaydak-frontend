import { describe, it, expect, vi, beforeAll } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import type { ShopReview } from "../../types"

// One review card. What is pinned is the "show only this product" hook: it
// exists only when the row has a product and a screen to filter, it is gone
// while the list is already narrowed to that product, and what it hands back
// is the mapped chip rather than the raw review product.

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
}))

vi.mock("next/navigation", () => ({
  useParams: () => ({ shopSlug: "acme" }),
}))

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock("@/shared/components/app-image", () => ({
  default: (props: { src: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element -- a test double, not a page image
    <img alt="" src={props.src} className={props.className} />
  ),
}))

// The dialog owns a mutation and a toast; the row only has to mount it.
vi.mock("../report-review-dialog", () => ({
  ReportReviewDialog: () => null,
}))

const { ReviewRow } = await import("../review-row")

beforeAll(() => {
  // Base UI positions the menu with floating-ui, which measures the anchor.
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

const review = (over: Partial<ShopReview> = {}): ShopReview => ({
  id: "r1",
  product_id: "p1",
  customer_id: "c1",
  order_id: null,
  comment: "Runs a little fast.",
  rating: 4,
  photo_urls: [],
  positive_feedbacks_count: 0,
  negative_feedbacks_count: 0,
  abusive_reports_count: 0,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
  product: {
    id: "p1",
    name: { en: "Dive Watch" },
    slug: "dive-watch",
    image: "https://cdn.example/p1.jpg",
  },
  customer: { id: "u1", name: "Sam", email: null, avatar: null },
  ...over,
})

const openMenu = async () => {
  fireEvent.click(screen.getByRole("button", { name: "actions.menu" }))
  await waitFor(() => screen.getByText("actions.report"))
}

describe("ReviewRow — show only this product", () => {
  it("offers it and hands back the mapped chip", async () => {
    const onFilterProduct = vi.fn()
    render(<ReviewRow review={review()} onFilterProduct={onFilterProduct} />)
    await openMenu()

    fireEvent.click(screen.getByText("actions.showOnlyProduct"))

    expect(onFilterProduct).toHaveBeenCalledWith({
      id: "p1",
      label: "Dive Watch",
      image: "https://cdn.example/p1.jpg",
    })
  })

  it("hides it while the list is already narrowed to this product", async () => {
    render(
      <ReviewRow
        review={review()}
        activeProductId="p1"
        onFilterProduct={vi.fn()}
      />,
    )
    await openMenu()

    expect(screen.queryByText("actions.showOnlyProduct")).toBeNull()
  })

  it("has nothing to offer for a deleted product", async () => {
    // The product is gone from the catalogue, so it could not be picked in
    // the toolbar either — a filter on it would only ever show this review.
    render(<ReviewRow review={review({ product: null })} onFilterProduct={vi.fn()} />)
    await openMenu()

    expect(screen.queryByText("actions.showOnlyProduct")).toBeNull()
    expect(screen.getByText("list.deletedProduct")).toBeTruthy()
  })

  it("is absent when the row is rendered without a screen to filter", async () => {
    render(<ReviewRow review={review()} />)
    await openMenu()

    expect(screen.queryByText("actions.showOnlyProduct")).toBeNull()
  })
})
