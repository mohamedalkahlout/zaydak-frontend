import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import en from "@/shared/messages/en.json"

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub)

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>()
  return {
    ...actual,
    useTranslations: (namespace?: string) =>
      actual.createTranslator({
        locale: "en",
        messages: en as never,
        namespace: namespace as never,
      }),
    useLocale: () => "en",
  }
})

const nav = vi.hoisted(() => ({ search: "identifier=a%40b.com" }))
const mutations = vi.hoisted(() => ({ AdminRequestResetCode: vi.fn() }))

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
    doc?.definitions?.[0]?.name?.value === "AdminRequestResetCode"
      ? [mutations.AdminRequestResetCode, { loading: false }]
      : [vi.fn(), { loading: false }],
  useApolloClient: () => ({ clearStore: vi.fn() }),
}))

// No resend cooldown, so a test can press Resend straight away.
vi.mock("@/shared/auth/cooldown", () => ({
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

  it.each([
    [4, "012", "0123"],
    [8, "0123456", "01234567"],
  ])(
    "draws %i boxes and continues once on the last digit",
    (codeLength, short, full) => {
      const onVerified = vi.fn()
      const { container } = render(
        <ResetCodeStep
          identifier="a@b.com"
          codeLength={codeLength}
          onVerified={onVerified}
        />,
      )
      const input = container.querySelector<HTMLInputElement>("[data-input-otp]")
      if (!input) throw new Error("missing otp input")

      expect(slots(container)).toBe(codeLength)
      expect(
        screen.getByText(new RegExp(`Enter the ${codeLength}-digit code`)),
      ).toBeTruthy()
      fireEvent.change(input, { target: { value: short } })
      expect(onVerified).not.toHaveBeenCalled()

      fireEvent.change(input, { target: { value: full } })
      fireEvent.click(screen.getByRole("button", { name: "Continue" }))
      expect(onVerified).toHaveBeenCalledTimes(1)
      expect(onVerified).toHaveBeenCalledWith(full)
    },
  )
})

/**
 * The forgot-password screen puts the length the send announced in the URL,
 * so the reset screen draws it — on a reload too.
 */
describe("ResetPasswordFlow code length", () => {
  beforeEach(() => {
    mutations.AdminRequestResetCode.mockReset()
  })

  it("draws as many boxes as the URL's code_length", () => {
    nav.search = "identifier=a%40b.com&code_length=5"
    const { container } = render(<ResetPasswordFlow />)

    expect(slots(container)).toBe(5)
  })

  it.each(["", "&code_length=3", "&code_length=9", "&code_length=six"])(
    "draws six for %j",
    (suffix) => {
      nav.search = `identifier=a%40b.com${suffix}`
      const { container } = render(<ResetPasswordFlow />)

      expect(slots(container)).toBe(6)
    },
  )

  it("redraws when a resend answers with another length", async () => {
    nav.search = "identifier=a%40b.com&code_length=4"
    mutations.AdminRequestResetCode.mockResolvedValue({
      data: { forgetPassword: { success: true, data: { code_length: 7 } } },
    })
    const { container } = render(<ResetPasswordFlow />)
    expect(slots(container)).toBe(4)

    fireEvent.click(screen.getByRole("button", { name: "Resend" }))

    await waitFor(() => expect(slots(container)).toBe(7))
  })
})
