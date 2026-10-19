import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

import { useOtpAutoSubmit } from "../use-otp-auto-submit"

function Harness({
  length = 6,
  onSubmit,
}: {
  length?: number
  onSubmit: (code: string) => Promise<void>
}) {
  const { onCodeChange, submitOnce } = useOtpAutoSubmit(length)
  const [value, setValue] = useState("")

  const run = (code: string) => submitOnce(() => onSubmit(code))

  return (
    <div>
      <input
        aria-label="otp"
        value={value}
        onChange={(event) => {
          const next = event.target.value
          setValue(next)
          onCodeChange(next, () => {
            void run(next)
          })
        }}
      />
      <button type="button" onClick={() => void run(value)}>
        Verify
      </button>
    </div>
  )
}

function pending() {
  let resolve!: (value: void) => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe("useOtpAutoSubmit", () => {
  it("does not submit an incomplete code", () => {
    const onSubmit = vi.fn(() => Promise.resolve())
    render(<Harness onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText("otp"), { target: { value: "12345" } })

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("submits once when the last digit is filled", () => {
    const onSubmit = vi.fn(() => Promise.resolve())
    render(<Harness onSubmit={onSubmit} />)
    const input = screen.getByLabelText("otp")

    fireEvent.change(input, { target: { value: "12345" } })
    fireEvent.change(input, { target: { value: "123456" } })
    fireEvent.change(input, { target: { value: "123456" } })

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith("123456")
  })

  it("ignores the Verify button while the auto-submit request is in flight", async () => {
    const hold = pending()
    const onSubmit = vi.fn(() => hold.promise)
    render(<Harness onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText("otp"), { target: { value: "123456" } })
    fireEvent.click(screen.getByRole("button", { name: "Verify" }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    hold.resolve()
    await hold.promise
  })

  it("can auto-submit again after the value becomes incomplete", async () => {
    const onSubmit = vi.fn(() => Promise.resolve())
    render(<Harness onSubmit={onSubmit} />)
    const input = screen.getByLabelText("otp")

    fireEvent.change(input, { target: { value: "123456" } })
    await Promise.resolve()
    fireEvent.change(input, { target: { value: "12345" } })
    fireEvent.change(input, { target: { value: "123457" } })

    expect(onSubmit).toHaveBeenCalledTimes(2)
    expect(onSubmit).toHaveBeenLastCalledWith("123457")
  })
})
