import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { CombinedGraphQLErrors } from "@apollo/client/errors"
import en from "@/shared/messages/en.json"

/**
 * Signing in to a shop: a phone number, then the code texted to it.
 *
 * What these pin is the whole of the customer's way in. The number is the
 * only thing asked for — no password, no email — and it goes to the server as
 * typed, which reads it in the shop's country; the code is checked against the
 * number the server said it texted; a customer the shop knows by name is
 * signed straight in, and a new one is asked for a name (the email beside it
 * optional, for receipts) with the session already open.
 */

const sendCode = vi.fn()
const verifyCode = vi.fn()
const updateProfile = vi.fn()
const setTokens = vi.fn()
const completeSignIn = vi.fn()
const finishSignIn = vi.fn()

vi.mock("@apollo/client/react", async () => {
  const api = await import("../../api")
  return {
    useMutation: (doc: unknown) => [
      doc === api.SEND_SIGN_IN_CODE
        ? sendCode
        : doc === api.VERIFY_SIGN_IN_CODE
          ? verifyCode
          : updateProfile,
      { loading: false },
    ],
    useApolloClient: () => ({}),
  }
})

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
  }
})

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("redirect=/acme/checkout"),
}))

vi.mock("sileo", () => ({
  sileo: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock("@/features/shop/shop-context", () => ({
  useShop: () => ({ slug: "acme", base: "/acme", shop: { name: "Acme" } }),
}))

vi.mock("@/shared/stores/auth", () => ({
  useAuthStore: { getState: () => ({ setTokens }) },
}))

vi.mock("../../lib/complete-sign-in", () => ({
  completeSignIn: (args: unknown) => completeSignIn(args),
  finishSignIn: (args: unknown) => finishSignIn(args),
}))

// The code boxes (`input-otp`) measure and hit-test themselves; jsdom does
// neither.
vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
)
document.elementFromPoint = () => null

const { LoginForm } = await import("../login-form")

const SENT = {
  data: {
    sendCustomerSignInCode: {
      success: true,
      data: {
        phone_e164: "+970599123456",
        code_length: 6,
        resend_after_seconds: 60,
        expires_in_seconds: 300,
      },
    },
  },
}

function verified(name: string | null) {
  return {
    data: {
      verifyCustomerSignInCode: {
        success: true,
        data: {
          access_token: "a",
          access_token_expires_at: "x",
          refresh_token: "r",
          refresh_token_expires_at: "y",
          created: name === null,
          customer: {
            id: "cust-1",
            name,
            phone_e164: "+970599123456",
            email: null,
          },
        },
      },
    },
  }
}

function refusal(code: string): CombinedGraphQLErrors {
  return new CombinedGraphQLErrors({ data: null }, [
    { message: "Refused", extensions: { error_code: code } },
  ])
}

async function submitNumber(value: string) {
  fireEvent.change(screen.getByLabelText("Mobile number"), {
    target: { value },
  })
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Text me a code" }))
  })
}

/** Type the whole code: a full code submits itself, as it does for a person. */
async function submitCode(code: string) {
  const input = document.querySelector(
    "input[autocomplete=one-time-code]",
  ) as HTMLInputElement
  await act(async () => {
    fireEvent.change(input, { target: { value: code } })
  })
  await waitFor(() => expect(verifyCode).toHaveBeenCalled())
}

beforeEach(() => {
  window.localStorage.clear()
  for (const fn of [
    sendCode,
    verifyCode,
    updateProfile,
    setTokens,
    completeSignIn,
    finishSignIn,
  ]) {
    fn.mockReset()
  }
  sendCode.mockResolvedValue(SENT)
  setTokens.mockResolvedValue(undefined)
})

afterEach(cleanup)

describe("LoginForm", () => {
  it("asks for a number, and never for a password or an email", () => {
    render(<LoginForm />)

    expect(screen.getByLabelText("Mobile number")).toBeTruthy()
    expect(document.querySelector("input[type=password]")).toBeNull()
    expect(document.querySelector("input[type=email]")).toBeNull()
  })

  it("sends the number as typed, then asks for the code it texted", async () => {
    render(<LoginForm />)

    await submitNumber("0599 123 456")

    // Only the number: the server reads it in the shop's country.
    expect(sendCode).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { input: { phone: "0599 123 456" } },
      }),
    )
    expect(await screen.findByText("Enter the code")).toBeTruthy()
    expect(screen.getByText("+970599123456")).toBeTruthy()
  })

  it("says the shop can send no more codes this hour, and stays", async () => {
    const { sileo } = await import("sileo")
    const toast = vi.spyOn(sileo, "error")
    sendCode.mockRejectedValue(refusal("CUSTOMER_SIGN_IN_RATE_LIMITED"))
    render(<LoginForm />)

    await submitNumber("0599 123 456")

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({ title: en.auth.shopSignInBusy }),
    )
    expect(screen.queryByText("Enter the code")).toBeNull()
    toast.mockRestore()
  })

  it("says so when the number is not one, and stays", async () => {
    sendCode.mockRejectedValue(refusal("INVALID_PHONE_FORMAT"))
    render(<LoginForm />)

    await submitNumber("123")

    expect(
      await screen.findByText(
        "Enter a valid mobile number, with its country code if it isn't local.",
      ),
    ).toBeTruthy()
    expect(screen.queryByText("Enter the code")).toBeNull()
  })

  it("signs a customer the shop knows by name straight in", async () => {
    verifyCode.mockResolvedValue(verified("Sara"))
    render(<LoginForm />)
    await submitNumber("0599123456")

    await submitCode("123456")

    // Verified against the number the server said it texted.
    expect(verifyCode).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { input: { phone: "+970599123456", code: "123456" } },
      }),
    )
    await waitFor(() => expect(completeSignIn).toHaveBeenCalled())
    expect(completeSignIn.mock.calls[0][0]).toMatchObject({
      slug: "acme",
      redirect: "/acme/checkout",
      tokens: expect.objectContaining({ access_token: "a" }),
    })
    expect(screen.queryByText("Welcome")).toBeNull()
  })

  it("opens the session for a new customer, then asks for a name", async () => {
    verifyCode.mockResolvedValue(verified(null))
    render(<LoginForm />)
    await submitNumber("0599123456")

    await submitCode("123456")

    expect(await screen.findByText("Welcome")).toBeTruthy()
    // Stored first, so the name is saved with the new session.
    expect(setTokens).toHaveBeenCalledWith(
      "acme",
      expect.objectContaining({ access_token: "a" }),
    )
    expect(completeSignIn).not.toHaveBeenCalled()
    // The email is there, and optional.
    expect(screen.getByLabelText("Email (optional)")).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Skip for now" }))
    })
    expect(finishSignIn).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "acme", redirect: "/acme/checkout" }),
    )
  })

  it("keeps a new customer's name and optional email", async () => {
    verifyCode.mockResolvedValue(verified(null))
    updateProfile.mockResolvedValue({ data: {} })
    render(<LoginForm />)
    await submitNumber("0599123456")
    await submitCode("123456")
    await screen.findByText("Welcome")

    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Sara Nour" },
    })
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Save and continue" }),
      )
    })

    // No email typed: none is sent, rather than an empty one.
    expect(updateProfile).toHaveBeenCalledWith({
      variables: { input: { name: "Sara Nour" } },
    })
    await waitFor(() => expect(finishSignIn).toHaveBeenCalled())
  })

  it("shows a wrong code under the boxes and signs nobody in", async () => {
    verifyCode.mockRejectedValue(refusal("OTP_INVALID"))
    render(<LoginForm />)
    await submitNumber("0599123456")

    await submitCode("000000")

    expect(
      await screen.findByText("That code isn't right. Check it and try again."),
    ).toBeTruthy()
    expect(completeSignIn).not.toHaveBeenCalled()
    expect(setTokens).not.toHaveBeenCalled()
  })
})

/**
 * A number still inside its cooldown gets no new code — the one already sent
 * is the one to type — and the refusal does not say how long that code is.
 * The screen has to remember what the send that issued it announced.
 */
describe("LoginForm code length on the cooldown path", () => {
  const sentWith = (code_length: number) => ({
    data: {
      sendCustomerSignInCode: {
        ...SENT.data.sendCustomerSignInCode,
        data: { ...SENT.data.sendCustomerSignInCode.data, code_length },
      },
    },
  })
  const boxes = () =>
    document.querySelectorAll('[data-slot="input-otp-slot"]').length

  it("keeps the length the last send announced on this screen", async () => {
    sendCode.mockResolvedValueOnce(sentWith(4))
    render(<LoginForm />)
    await submitNumber("0599123456")
    await screen.findByText("Enter the code")
    expect(boxes()).toBe(4)

    // Only this screen's memory is left to go on.
    window.localStorage.clear()
    fireEvent.click(screen.getByRole("button", { name: "Use a different number" }))
    sendCode.mockRejectedValueOnce(refusal("OTP_COOLDOWN"))
    await submitNumber("0599123456")

    await screen.findByText("Enter the code")
    expect(boxes()).toBe(4)
    expect(screen.getByText("We texted a 4-digit code to")).toBeTruthy()
  })

  it("keeps it across a reload", async () => {
    sendCode.mockResolvedValueOnce(sentWith(4))
    const first = render(<LoginForm />)
    await submitNumber("0599123456")
    await screen.findByText("Enter the code")
    first.unmount()

    sendCode.mockRejectedValueOnce(refusal("OTP_COOLDOWN"))
    render(<LoginForm />)
    await submitNumber("0599123456")

    await screen.findByText("Enter the code")
    expect(boxes()).toBe(4)
  })

  it("draws six when no send has said anything", async () => {
    sendCode.mockRejectedValueOnce(refusal("OTP_COOLDOWN"))
    render(<LoginForm />)
    await submitNumber("0599123456")

    await screen.findByText("Enter the code")
    expect(boxes()).toBe(6)
  })
})
