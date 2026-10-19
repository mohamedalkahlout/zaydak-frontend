import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { AutoscaleInput } from "../autoscale-input"

describe("<AutoscaleInput />", () => {
  it("renders the prefix and the current value", () => {
    render(
      <AutoscaleInput
        readOnly
        numberFormat="string"
        value="1,234.56"
        prefix="SAR"
        aria-label="Total sales"
      />,
    )
    const input = screen.getByLabelText("Total sales") as HTMLInputElement
    expect(input.value).toBe("1,234.56")
    expect(screen.getByText("SAR")).toBeTruthy()
  })

  it("emits the formatted value through onChange", () => {
    const onChange = vi.fn()
    render(<AutoscaleInput numberFormat="us" aria-label="Amount" onChange={onChange} />)
    const input = screen.getByLabelText("Amount") as HTMLInputElement
    fireEvent.change(input, { target: { value: "1234567" } })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange.mock.calls[0][0].target.value).toBe("1,234,567")
  })

  it("formats as the user types when uncontrolled", () => {
    render(<AutoscaleInput numberFormat="us" aria-label="Amount" />)
    const input = screen.getByLabelText("Amount") as HTMLInputElement
    fireEvent.change(input, { target: { value: "9999.5" } })
    expect(input.value).toBe("9,999.5")
  })
})
