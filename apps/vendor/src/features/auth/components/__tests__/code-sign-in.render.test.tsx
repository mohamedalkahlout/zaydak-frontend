import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { CombinedGraphQLErrors } from "@apollo/client/errors"

/**
 * Completing the 6 slots must fire `verifyOtpCode` immediately, once. The
 * Verify button stays as a fallback; it must not stack a second request on
 * top of the auto-submit that the last digit already started.
 */

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub)
document.elementFromPoint = () => null

const mutations = vi.hoisted(() => ({
  SendOtpCode: vi.fn(),
  SendOtpCodeLegacy: vi.fn(),
  VerifyOtpCode: vi.fn(),
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

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
  // CodeSignIn hands the Apollo client to completeVendorSignIn on the success
  // path. These tests never reach it, but the missing export threw at import
  // and took the whole render with it.
  useApolloClient: () => ({}),
  useMutation: (doc: { definitions?: { name?: { value?: string } }[] }) => {
    const name = doc?.definitions?.[0]?.name?.value
    if (name === "VerifyOtpCode") return [mutations.VerifyOtpCode, { loading: false }]
    if (name === "SendOtpCodeLegacy") {
      return [mutations.SendOtpCodeLegacy, { loading: false }]
    }
    return [mutations.SendOtpCode, { loading: false }]
  },
}))

// No resend cooldown, so a test can press Resend straight after the send.
vi.mock("@/shared/lib/auth/cooldown", () => ({
  startCooldown: vi.fn(),
  getRemainingCooldownSeconds: () => 0,
}))

vi.mock("@repo/ui/components/shader-background", () => ({
  ShaderBackground: () => null,
}))

vi.mock("@/shared/components/app-image", () => ({
  default: ({ alt, ...rest }: { alt: string }) => <img alt={alt} {...rest} />,
}))

vi.mock("@/shared/components/locale-switcher", () => ({
  LocaleSwitcher: () => null,
}))

vi.mock("@/shared/stores/auth", () => ({
  useAuthStore: (sel: (s: { setTokens: () => void }) => unknown) =>
    sel({ setTokens: vi.fn() }),
}))

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }))

const { CodeSignIn } = await import("../code-sign-in")

function otpInput(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>("[data-input-otp]")
  if (!input) throw new Error("missing otp input")
  return input
}

async function reachCodePane() {
  const view = render(<CodeSignIn />)
  fireEvent.change(screen.getByLabelText("Email or Phone"), {
    target: { value: "vendor@example.com" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Send code" }))
  await waitFor(() => {
    expect(screen.getByText("Verify your code")).toBeTruthy()
  })
  return view
}

describe("CodeSignIn OTP auto-submit", () => {
  beforeEach(() => {
    mutations.SendOtpCode.mockReset()
    mutations.VerifyOtpCode.mockReset()
    mutations.SendOtpCode.mockResolvedValue({
      data: { sendOtpCode: { success: true } },
    })
    mutations.VerifyOtpCode.mockReturnValue(new Promise(() => {}))
  })

  it("does not verify an incomplete code", async () => {
    const { container } = await reachCodePane()

    fireEvent.change(otpInput(container), { target: { value: "12345" } })

    expect(mutations.VerifyOtpCode).not.toHaveBeenCalled()
  })

  it("verifies once when all six digits are filled, and ignores Verify while in flight", async () => {
    const { container } = await reachCodePane()
    const input = otpInput(container)

    fireEvent.change(input, { target: { value: "12345" } })
    fireEvent.change(input, { target: { value: "123456" } })
    fireEvent.change(input, { target: { value: "123456" } })
    fireEvent.click(screen.getByRole("button", { name: "Verify" }))

    expect(mutations.VerifyOtpCode).toHaveBeenCalledTimes(1)
    expect(mutations.VerifyOtpCode.mock.calls[0][0]).toMatchObject({
      variables: { input: { identifier: "vendor@example.com", code: "123456" } },
    })
  })
})

/**
 * A number nobody proved on its account gets no code: the server refuses
 * before texting anything, and the screen says to sign in with the email
 * rather than moving on to a code that is never coming.
 */
describe("CodeSignIn with a number nobody proved", () => {
  beforeEach(() => {
    mutations.SendOtpCode.mockReset()
    mutations.SendOtpCode.mockRejectedValue(
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
    render(<CodeSignIn />)
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
 * An admin sets the code length anywhere from 4 to 8, and a Verify service
 * has its own. The screen draws what the send said, and a code of that
 * length is complete — six boxes for a four-digit code could never be
 * submitted.
 */
describe("CodeSignIn code length", () => {
  beforeEach(() => {
    mutations.SendOtpCode.mockReset()
    mutations.SendOtpCodeLegacy.mockReset()
    mutations.VerifyOtpCode.mockReset()
    mutations.VerifyOtpCode.mockReturnValue(new Promise(() => {}))
  })

  it("draws four boxes for a four-digit code, and verifies on the fourth digit", async () => {
    mutations.SendOtpCode.mockResolvedValue(sentWith(4))
    const { container } = await reachCodePane()

    expect(slots(container)).toBe(4)
    expect(screen.getByText(/Enter the 4-digit code sent to/)).toBeTruthy()

    fireEvent.change(otpInput(container), { target: { value: "012" } })
    expect(mutations.VerifyOtpCode).not.toHaveBeenCalled()

    fireEvent.change(otpInput(container), { target: { value: "0123" } })
    expect(mutations.VerifyOtpCode).toHaveBeenCalledTimes(1)
    expect(mutations.VerifyOtpCode.mock.calls[0][0]).toMatchObject({
      variables: { input: { identifier: "vendor@example.com", code: "0123" } },
    })
  })

  it("redraws when a resend answers with another length", async () => {
    mutations.SendOtpCode.mockResolvedValueOnce(sentWith(4))
    const { container } = await reachCodePane()
    expect(slots(container)).toBe(4)

    mutations.SendOtpCode.mockResolvedValueOnce(sentWith(8))
    fireEvent.click(screen.getByRole("button", { name: "Resend" }))

    await waitFor(() => expect(slots(container)).toBe(8))
    fireEvent.change(otpInput(container), { target: { value: "0123" } })
    expect(mutations.VerifyOtpCode).not.toHaveBeenCalled()
    fireEvent.change(otpInput(container), { target: { value: "01234567" } })
    expect(mutations.VerifyOtpCode).toHaveBeenCalledTimes(1)
  })

  it("draws six when the server does not say", async () => {
    mutations.SendOtpCode.mockResolvedValue(sentWith())
    const { container } = await reachCodePane()

    expect(slots(container)).toBe(6)
  })

  /**
   * Transitional: the dashboard can ship before the API that knows
   * `code_length`. That API refuses the selection at validation — nothing was
   * sent — so the send goes again as it used to, and six boxes are drawn.
   */
  it("sends again without code_length when the API does not know the field", async () => {
    mutations.SendOtpCode.mockRejectedValue(
      new CombinedGraphQLErrors({
        errors: [
          {
            message:
              'Cannot query field "code_length" on type "OtpSentData".',
            extensions: { error_code: "VALIDATION_ERROR" },
          },
        ],
      }),
    )
    mutations.SendOtpCodeLegacy.mockResolvedValue({
      data: { sendOtpCode: { success: true } },
    })

    const { container } = await reachCodePane()

    expect(mutations.SendOtpCode).toHaveBeenCalledTimes(1)
    expect(mutations.SendOtpCodeLegacy).toHaveBeenCalledTimes(1)
    expect(mutations.SendOtpCodeLegacy.mock.calls[0][0]).toMatchObject({
      variables: { input: { identifier: "vendor@example.com" } },
    })
    expect(slots(container)).toBe(6)
  })
})
