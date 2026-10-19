import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import { CouponTicket } from "../coupon-ticket"

/**
 * The ticket carries two things a pill chip could not hold at once — what the
 * code is and what it is worth — and it puts the remove control on the tear
 * line rather than beside the text. All three are worth pinning, because the
 * stub is a 3rem square with no visible label: if its accessible name ever goes
 * missing, the only way to drop a discount becomes an unnamed button.
 *
 * `DitherField` is deliberately not mocked. jsdom has no `IntersectionObserver`,
 * so `useOnScreen` never flips and no WebGL canvas is mounted — which is the
 * same path a browser without WebGL2 takes. Asserting the content renders
 * anyway is the assertion that the shader is decoration and nothing else.
 */
function renderTicket(props: Partial<Parameters<typeof CouponTicket>[0]> = {}) {
  const onRemove = vi.fn()
  render(
    <CouponTicket
      code="SAVE10"
      amount="SAR 10"
      label="Discount applied"
      removeLabel="Remove discount code"
      onRemove={onRemove}
      {...props}
    />,
  )
  return { onRemove }
}

describe("CouponTicket", () => {
  it("shows the code and what it took off", () => {
    renderTicket()
    expect(screen.getByText("SAVE10")).toBeTruthy()
    expect(screen.getByText("−SAR 10")).toBeTruthy()
    expect(screen.getByText("Discount applied")).toBeTruthy()
  })

  it("names the tear-off stub, which is the only way to remove the code", () => {
    const { onRemove } = renderTicket()

    const stub = screen.getByRole("button", { name: "Remove discount code" })
    fireEvent.click(stub)

    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it("cannot be torn off while the cart is already mutating", () => {
    const { onRemove } = renderTicket({ disabled: true })

    const stub = screen.getByRole("button", { name: "Remove discount code" })
    expect(stub.hasAttribute("disabled")).toBe(true)

    fireEvent.click(stub)
    expect(onRemove).not.toHaveBeenCalled()
  })

  it("renders without a shader when the browser cannot mount one", () => {
    const { container } = render(
      <CouponTicket
        code="SAVE10"
        amount="SAR 10"
        label="Discount applied"
        removeLabel="Remove discount code"
        onRemove={() => {}}
      />,
    )

    expect(container.querySelector("canvas")).toBeNull()
    expect(screen.getAllByText("SAVE10").length).toBeGreaterThan(0)
  })
})
