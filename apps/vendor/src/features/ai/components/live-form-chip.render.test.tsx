import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { setTestLocale } from "@/features/ai/test-utils/next-intl"
import { LiveFormChip } from "./live-form-chip"

vi.mock("next-intl", async () =>
  (await import("@/features/ai/test-utils/next-intl")).bilingualNextIntlMock(),
)

/**
 * The composer's chip naming the form the assistant can see.
 *
 * "Make it 300" works beside a form the assistant prepared and means nothing
 * beside one the vendor opened themselves, and nothing in the chat said which
 * they were in front of. (No jest-dom here: plain DOM assertions.)
 */

beforeEach(() => setTestLocale("en"))

describe("<LiveFormChip />", () => {
  it("names the product being edited", () => {
    render(<LiveFormChip target="product_edit" label="Linen Shirt" />)

    expect(screen.getByRole("status").textContent).toContain(
      "Editing: Linen Shirt",
    )
  })

  it("calls a create form a new product, with no title to wait for", () => {
    render(<LiveFormChip target="product_create" />)

    expect(screen.getByText("New product")).toBeTruthy()
  })

  it("still says something for a product with no title", () => {
    render(<LiveFormChip target="product_edit" />)

    expect(screen.getByText("Editing a product")).toBeTruthy()
  })

  it("says what the chip means, for a pointer and for a screen reader", () => {
    const { container } = render(<LiveFormChip target="product_create" />)
    const hint =
      "Sidekick can see this form and change it for you. Nothing is saved until you press Save."

    expect(screen.getByRole("status").getAttribute("title")).toBe(hint)
    expect(container.querySelector(".sr-only")?.textContent).toBe(hint)
  })

  it("reads in Arabic, with the title isolated from the sentence around it", () => {
    setTestLocale("ar")
    const { container } = render(
      <LiveFormChip target="product_edit" label="Linen Shirt" />,
    )

    expect(screen.getByRole("status").textContent).toContain(
      "تعديل: Linen Shirt",
    )
    // An English title inside an Arabic sentence keeps its own direction.
    expect(container.querySelector("bdi")?.textContent).toBe("Linen Shirt")
  })

  it("names a new product in Arabic", () => {
    setTestLocale("ar")
    render(<LiveFormChip target="product_create" />)

    expect(screen.getByText("منتج جديد")).toBeTruthy()
  })
})

describe("<LiveFormChip /> for the coupon and collection forms", () => {
  it("names the coupon being edited by its code", () => {
    render(<LiveFormChip target="coupon_edit" label="SUMMER20" />)

    expect(screen.getByRole("status").textContent).toContain(
      "Editing: SUMMER20",
    )
  })

  it("still says something for an automatic coupon with no code", () => {
    render(<LiveFormChip target="coupon_edit" />)

    expect(screen.getByText("Editing a coupon")).toBeTruthy()
  })

  it("calls the create forms what they are", () => {
    const { rerender } = render(<LiveFormChip target="coupon_create" />)
    expect(screen.getByText("New coupon")).toBeTruthy()

    // A create form has no saved name: a label passed anyway is not shown.
    rerender(<LiveFormChip target="collection_create" label="Summer Sale" />)
    expect(screen.getByText("New collection")).toBeTruthy()
  })

  it("reads in Arabic", () => {
    setTestLocale("ar")
    const { rerender } = render(<LiveFormChip target="coupon_create" />)
    expect(screen.getByText("كوبون جديد")).toBeTruthy()

    rerender(<LiveFormChip target="collection_create" />)
    expect(screen.getByText("مجموعة جديدة")).toBeTruthy()

    rerender(<LiveFormChip target="coupon_edit" label="SUMMER20" />)
    expect(screen.getByRole("status").textContent).toContain("تعديل: SUMMER20")
  })
})
