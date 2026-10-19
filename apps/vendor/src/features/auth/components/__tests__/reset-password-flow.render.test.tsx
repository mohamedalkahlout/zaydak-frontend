import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub)

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

const nav = vi.hoisted(() => ({ search: "identifier=a%40b.com" }))
const mutations = vi.hoisted(() => ({ ForgetPassword: vi.fn() }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
}))

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode
    href: string
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock("@apollo/client/react", () => ({
  useMutation: (doc: { definitions?: { name?: { value?: string } }[] }) =>
    doc?.definitions?.[0]?.name?.value === "ForgetPassword"
      ? [mutations.ForgetPassword, { loading: false }]
      : [vi.fn(), { loading: false }],
  useApolloClient: () => ({ clearStore: vi.fn() }),
}))

// No resend cooldown, so a test can press Resend straight away.
vi.mock("@/shared/lib/auth/cooldown", () => ({
  startCooldown: vi.fn(),
  getRemainingCooldownSeconds: () => 0,
}))

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }))

const { ResetPasswordFields, ResetCodeStep, ResetPasswordFlow } = await import(
  "../reset-password-flow"
)

function slots(container: HTMLElement) {
  return container.querySelectorAll('[data-slot="input-otp-slot"]').length
}

describe("ResetPasswordFields", () => {
  it("shows only new password and confirm — no reset code input", () => {
    const { container } = render(
      <ResetPasswordFields
        identifier="a@b.com"
        code="123456"
        onBack={vi.fn()}
        onOtpRejected={vi.fn()}
      />,
    )

    expect(screen.getByLabelText("New Password")).toBeTruthy()
    expect(screen.getByLabelText("Confirm Password")).toBeTruthy()
    expect(container.querySelectorAll('input[type="password"]')).toHaveLength(2)

    expect(screen.queryByLabelText("Reset Code")).toBeNull()
    expect(container.querySelector("#code")).toBeNull()
    expect(container.querySelector("[data-input-otp]")).toBeNull()
    expect(screen.queryByText("Didn't receive a code?")).toBeNull()
  })
})

describe("ResetCodeStep", () => {
  it("asks for the code and not for a password", () => {
    const { container } = render(
      <ResetCodeStep identifier="a@b.com" onVerified={vi.fn()} />,
    )

    expect(screen.getByLabelText("Reset Code")).toBeTruthy()
    expect(container.querySelector("[data-input-otp], #code")).toBeTruthy()
    expect(container.querySelectorAll('input[type="password"]')).toHaveLength(0)
    expect(screen.queryByLabelText("New Password")).toBeNull()
    expect(screen.queryByLabelText("Confirm Password")).toBeNull()
  })

  it("does not continue on an incomplete code", () => {
    const onVerified = vi.fn()
    const { container } = render(
      <ResetCodeStep identifier="a@b.com" onVerified={onVerified} />,
    )
    const input = container.querySelector<HTMLInputElement>("[data-input-otp]")
    if (!input) throw new Error("missing otp input")

    fireEvent.change(input, { target: { value: "12345" } })

    expect(onVerified).not.toHaveBeenCalled()
  })

  it("continues once when all six digits are filled", () => {
    const onVerified = vi.fn()
    const { container } = render(
      <ResetCodeStep identifier="a@b.com" onVerified={onVerified} />,
    )
    const input = container.querySelector<HTMLInputElement>("[data-input-otp]")
    if (!input) throw new Error("missing otp input")

    fireEvent.change(input, { target: { value: "123456" } })
    fireEvent.change(input, { target: { value: "123456" } })
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    expect(onVerified).toHaveBeenCalledTimes(1)
    expect(onVerified).toHaveBeenCalledWith("123456")
  })

  /** An admin can set codes to four digits; the fourth one completes it. */
  it("continues once on the fourth digit of a four-digit code", () => {
    const onVerified = vi.fn()
    const { container } = render(
      <ResetCodeStep identifier="a@b.com" codeLength={4} onVerified={onVerified} />,
    )
    const input = container.querySelector<HTMLInputElement>("[data-input-otp]")
    if (!input) throw new Error("missing otp input")

    expect(slots(container)).toBe(4)
    expect(screen.getByText(/Enter the 4-digit code sent to/)).toBeTruthy()
    fireEvent.change(input, { target: { value: "012" } })
    expect(onVerified).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: "0123" } })
    fireEvent.click(screen.getByRole("button", { name: "Continue" }))

    expect(onVerified).toHaveBeenCalledTimes(1)
    expect(onVerified).toHaveBeenCalledWith("0123")
  })
})

/**
 * The forgot-password screen puts the length the send announced in the URL,
 * so the reset screen draws it — on a reload too.
 */
describe("ResetPasswordFlow code length", () => {
  beforeEach(() => {
    mutations.ForgetPassword.mockReset()
  })

  it("draws as many boxes as the URL's code_length", () => {
    nav.search = "identifier=a%40b.com&code_length=5"
    const { container } = render(<ResetPasswordFlow />)

    expect(slots(container)).toBe(5)
  })

  it.each(["", "&code_length=", "&code_length=3", "&code_length=9", "&code_length=six"])(
    "draws six for %j",
    (suffix) => {
      nav.search = `identifier=a%40b.com${suffix}`
      const { container } = render(<ResetPasswordFlow />)

      expect(slots(container)).toBe(6)
    },
  )

  it("redraws when a resend answers with another length", async () => {
    nav.search = "identifier=a%40b.com&code_length=4"
    mutations.ForgetPassword.mockResolvedValue({
      data: { forgetPassword: { success: true, data: { code_length: 7 } } },
    })
    const { container } = render(<ResetPasswordFlow />)
    expect(slots(container)).toBe(4)

    fireEvent.click(screen.getByRole("button", { name: "Resend" }))

    await waitFor(() => expect(slots(container)).toBe(7))
    expect(mutations.ForgetPassword.mock.calls[0][0]).toMatchObject({
      variables: { input: { identifier: "a@b.com" } },
    })
  })
})
