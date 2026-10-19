import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub)
document.elementFromPoint = () => null

const mutations = vi.hoisted(() => ({
  VerifyVendorSignupOtp: vi.fn(),
  ResendVendorSignupOtp: vi.fn(),
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("@apollo/client/react", () => ({
  useMutation: (doc: {
    definitions?: { kind?: string; name?: { value?: string } }[]
  }) => {
    const name =
      doc.definitions?.find((def) => def.kind === "OperationDefinition")?.name
        ?.value ?? ""
    if (name === "VerifyVendorSignupOtp") {
      return [mutations.VerifyVendorSignupOtp, { loading: false }]
    }
    return [mutations.ResendVendorSignupOtp, { loading: false }]
  },
}))

const { OtpStep } = await import("../otp-step")

const draft = {
  signup_token: "token",
  destination_masked: "v***@example.com",
  channel: "EMAIL" as const,
  code_length: 6,
  resend_after: 0,
}

function otpInput(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>("[data-input-otp]")
  if (!input) throw new Error("missing otp input")
  return input
}

describe("OtpStep auto-submit", () => {
  beforeEach(() => {
    mutations.VerifyVendorSignupOtp.mockReset()
    mutations.ResendVendorSignupOtp.mockReset()
    mutations.VerifyVendorSignupOtp.mockReturnValue(new Promise(() => {}))
  })

  it("does not verify an incomplete code", () => {
    const { container } = render(
      <OtpStep
        draft={draft}
        onVerified={vi.fn()}
        onDraftRefreshed={vi.fn()}
        onBack={vi.fn()}
      />,
    )

    fireEvent.change(otpInput(container), { target: { value: "12345" } })

    expect(mutations.VerifyVendorSignupOtp).not.toHaveBeenCalled()
  })

  it("verifies once when every slot is filled", () => {
    const { container } = render(
      <OtpStep
        draft={draft}
        onVerified={vi.fn()}
        onDraftRefreshed={vi.fn()}
        onBack={vi.fn()}
      />,
    )
    const input = otpInput(container)

    fireEvent.change(input, { target: { value: "123456" } })
    fireEvent.change(input, { target: { value: "123456" } })
    fireEvent.click(screen.getByRole("button", { name: "Verify" }))

    expect(mutations.VerifyVendorSignupOtp).toHaveBeenCalledTimes(1)
    expect(mutations.VerifyVendorSignupOtp.mock.calls[0][0]).toMatchObject({
      variables: { input: { token: "token", code: "123456" } },
    })
  })
})
