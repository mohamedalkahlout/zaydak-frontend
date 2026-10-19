import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { CombinedGraphQLErrors } from "@apollo/client/errors"
import en from "@/shared/messages/en.json"

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub)

const mutations = vi.hoisted(() => ({
  AdminSendOtpCode: vi.fn(),
  AdminSendOtpCodeLegacy: vi.fn(),
  AdminVerifyOtpCode: vi.fn(),
}))

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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
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
  useMutation: (doc: { definitions?: { name?: { value?: string } }[] }) => {
    const name = doc?.definitions?.[0]?.name?.value
    if (name === "AdminVerifyOtpCode") {
      return [mutations.AdminVerifyOtpCode, { loading: false }]
    }
    if (name === "AdminSendOtpCodeLegacy") {
      return [mutations.AdminSendOtpCodeLegacy, { loading: false }]
    }
    return [mutations.AdminSendOtpCode, { loading: false }]
  },
}))

// No resend cooldown, so a test can press Resend straight after the send.
vi.mock("@/shared/auth/cooldown", () => ({
  startCooldown: vi.fn(),
  getRemainingCooldownSeconds: () => 0,
}))

vi.mock("@/shared/stores/auth", () => ({
  useAuthStore: (sel: (s: { setTokens: () => void }) => unknown) =>
    sel({ setTokens: vi.fn() }),
}))

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }))

const OtpLoginPage = (await import("@/app/(auth)/verify-otp/page")).default

function otpInput(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>("[data-input-otp]")
  if (!input) throw new Error("missing otp input")
  return input
}

async function reachVerifyStep() {
  const view = render(<OtpLoginPage />)
  fireEvent.change(screen.getByLabelText("Email or Phone"), {
    target: { value: "admin@example.com" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Send code" }))
  await waitFor(() => {
    expect(screen.getByText("Verify your code")).toBeTruthy()
  })
  return view
}

describe("admin verify-otp auto-submit", () => {
  beforeEach(() => {
    mutations.AdminSendOtpCode.mockReset()
    mutations.AdminVerifyOtpCode.mockReset()
    mutations.AdminSendOtpCode.mockResolvedValue({
      data: { sendOtpCode: { success: true } },
    })
    mutations.AdminVerifyOtpCode.mockReturnValue(new Promise(() => {}))
  })

  it("does not verify an incomplete code", async () => {
    const { container } = await reachVerifyStep()

    fireEvent.change(otpInput(container), { target: { value: "12345" } })

    expect(mutations.AdminVerifyOtpCode).not.toHaveBeenCalled()
  })

  it("verifies once when all six digits are filled", async () => {
    const { container } = await reachVerifyStep()
    const input = otpInput(container)

    fireEvent.change(input, { target: { value: "123456" } })
    fireEvent.change(input, { target: { value: "123456" } })
    fireEvent.click(screen.getByRole("button", { name: "Verify" }))

    expect(mutations.AdminVerifyOtpCode).toHaveBeenCalledTimes(1)
    expect(mutations.AdminVerifyOtpCode.mock.calls[0][0]).toMatchObject({
      variables: { input: { identifier: "admin@example.com", code: "123456" } },
    })
  })
})

/**
 * A number nobody proved on its account gets no code — an admin's least of
 * all: the server refuses before texting anything, and the screen says to
 * sign in with the email.
 */
describe("admin verify-otp with a number nobody proved", () => {
  beforeEach(() => {
    mutations.AdminSendOtpCode.mockReset()
    mutations.AdminSendOtpCode.mockRejectedValue(
      new CombinedGraphQLErrors({
        errors: [
          {
            message: "not confirmed",
            extensions: { error_code: "PHONE_NOT_CONFIRMED" },
          },
        ],
      }),
    )
  })

  it("says to sign in with the email, and stays on the first step", async () => {
    render(<OtpLoginPage />)
    fireEvent.change(screen.getByLabelText("Email or Phone"), {
      target: { value: "+970599123456" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send code" }))

    await waitFor(() => {
      expect(screen.getByText(/Sign in with your email instead/)).toBeTruthy()
    })
    expect(screen.queryByText("Verify your code")).toBeNull()
  })
})

function slots(container: HTMLElement) {
  return container.querySelectorAll('[data-slot="input-otp-slot"]').length
}

const sentWith = (code_length?: number) => ({
  data: {
    sendOtpCode: {
      success: true,
      ...(code_length === undefined ? {} : { data: { code_length } }),
    },
  },
})

/**
 * Codes can be set anywhere from 4 to 8 digits, and a Verify service has its
 * own length. The step draws what the send said, and a code of that length is
 * complete — six boxes for a four-digit code could never be submitted.
 */
describe("admin verify-otp code length", () => {
  beforeEach(() => {
    mutations.AdminSendOtpCode.mockReset()
    mutations.AdminSendOtpCodeLegacy.mockReset()
    mutations.AdminVerifyOtpCode.mockReset()
    mutations.AdminVerifyOtpCode.mockReturnValue(new Promise(() => {}))
  })

  it("draws four boxes for a four-digit code, and verifies once on the fourth digit", async () => {
    mutations.AdminSendOtpCode.mockResolvedValue(sentWith(4))
    const { container } = await reachVerifyStep()

    expect(slots(container)).toBe(4)
    expect(screen.getByText(/Enter the 4-digit code sent to/)).toBeTruthy()

    fireEvent.change(otpInput(container), { target: { value: "012" } })
    expect(mutations.AdminVerifyOtpCode).not.toHaveBeenCalled()

    fireEvent.change(otpInput(container), { target: { value: "0123" } })
    fireEvent.click(screen.getByRole("button", { name: "Verify" }))
    expect(mutations.AdminVerifyOtpCode).toHaveBeenCalledTimes(1)
    expect(mutations.AdminVerifyOtpCode.mock.calls[0][0]).toMatchObject({
      variables: { input: { identifier: "admin@example.com", code: "0123" } },
    })
  })

  it("draws eight for an eight-digit code", async () => {
    mutations.AdminSendOtpCode.mockResolvedValue(sentWith(8))
    const { container } = await reachVerifyStep()

    expect(slots(container)).toBe(8)
  })

  it("redraws when a resend answers with another length", async () => {
    mutations.AdminSendOtpCode.mockResolvedValueOnce(sentWith(4))
    const { container } = await reachVerifyStep()

    mutations.AdminSendOtpCode.mockResolvedValueOnce(sentWith(7))
    fireEvent.click(screen.getByRole("button", { name: "Resend" }))

    await waitFor(() => expect(slots(container)).toBe(7))
  })

  it("draws six when the server does not say", async () => {
    mutations.AdminSendOtpCode.mockResolvedValue(sentWith())
    const { container } = await reachVerifyStep()

    expect(slots(container)).toBe(6)
  })

  /**
   * Transitional: the console can ship before the API that knows
   * `code_length`. That API refuses the selection at validation — nothing was
   * sent — so the send goes again as it used to, and six boxes are drawn.
   */
  it("sends again without code_length when the API does not know the field", async () => {
    mutations.AdminSendOtpCode.mockRejectedValue(
      new CombinedGraphQLErrors({
        errors: [
          {
            message: 'Cannot query field "code_length" on type "OtpSentData".',
            extensions: { error_code: "VALIDATION_ERROR" },
          },
        ],
      }),
    )
    mutations.AdminSendOtpCodeLegacy.mockResolvedValue(sentWith())

    const { container } = await reachVerifyStep()

    expect(mutations.AdminSendOtpCode).toHaveBeenCalledTimes(1)
    expect(mutations.AdminSendOtpCodeLegacy).toHaveBeenCalledTimes(1)
    expect(slots(container)).toBe(6)
  })
})
