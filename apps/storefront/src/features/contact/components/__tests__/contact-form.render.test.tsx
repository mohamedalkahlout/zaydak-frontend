import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { CombinedGraphQLErrors } from "@apollo/client/errors"

import {
  GUEST_ONLY_SEGMENTS,
  PRIVATE_SEGMENTS,
} from "@/shared/auth/route-access"
import { CONTACT_MESSAGE_MAX_LENGTH } from "../../validation"

/**
 * The anonymous contact form.
 *
 * **The property under test is that this screen cannot be used as an
 * email-enumeration oracle.** `ContactFormService` answers a known address, an
 * unknown address, a tripped honeypot and a moderation-blocked body with
 * byte-for-byte the same acknowledgement — and that guarantee is only worth
 * anything if the client spends it. A component that rendered "we could not
 * send that" for one of them, or left the form standing for another, would hand
 * the difference straight back. So the first test below renders five different
 * outcomes and asserts the visitor sees the *same characters* every time.
 *
 * `CONTACT_MESSAGE_RATE_LIMITED` is the one documented exception and is pinned
 * separately: it is about how many messages have left this address in the last
 * hour, which the sender already knows, and wording it as a success would send
 * somebody away believing a message had been filed that was never written down.
 */

type SendResult = { data: { sendContactMessage: { success: boolean } } }

/** Swapped per test: what the mutation does when the form submits. */
let send: (args: unknown) => Promise<SendResult>
/** Every `variables` object the form handed to Apollo, in order. */
let sent: unknown[]

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [
    (args: unknown) => {
      sent.push(args)
      return send(args)
    },
    { loading: false },
  ],
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${Object.values(vars).join(",")}` : key,
}))

const { ContactForm } = await import("../contact-form")

const ACK: SendResult = { data: { sendContactMessage: { success: true } } }

/** A back-end refusal carrying an `error_code`, as Apollo delivers one. */
function graphqlError(code: string): CombinedGraphQLErrors {
  return new CombinedGraphQLErrors({ data: null }, [
    { message: "Something", extensions: { error_code: code } },
  ])
}

function renderForm() {
  return render(<ContactForm shopName="Acme Supply" />)
}

/** Fill the fields a person fills, then submit. */
async function submit(
  container: HTMLElement,
  overrides: { message?: string; website?: string } = {},
) {
  fireEvent.change(screen.getByLabelText("nameLabel"), {
    target: { value: "Dana" },
  })
  fireEvent.change(screen.getByLabelText("emailLabel"), {
    target: { value: "dana@example.com" },
  })
  fireEvent.change(screen.getByLabelText("messageLabel"), {
    target: { value: overrides.message ?? "Where is my order?" },
  })
  if (overrides.website !== undefined) {
    fireEvent.change(container.querySelector('input[name="website"]')!, {
      target: { value: overrides.website },
    })
  }

  await act(async () => {
    fireEvent.submit(container.querySelector("form")!)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  sent = []
  send = vi.fn(async () => ACK)
})

describe("ContactForm — the identical-answer property", () => {
  /**
   * The five outcomes the back-end can produce, as they arrive here. Four of
   * them are indistinguishable on the wire by design; the fifth (a dropped
   * connection) is indistinguishable *from here*, which is the same problem —
   * inventing a state for it would be inventing the signal an oracle needs.
   */
  const outcomes: Array<[string, () => void]> = [
    ["a message that was filed", () => (send = async () => ACK)],
    [
      "a response that did not claim success",
      () =>
        (send = async () => ({
          data: { sendContactMessage: { success: false } },
        })),
    ],
    [
      "a body the moderator blocked",
      () =>
        (send = async () => {
          throw graphqlError("CONTENT_BLOCKED")
        }),
    ],
    [
      "any other refusal the API could grow",
      () =>
        (send = async () => {
          throw graphqlError("SHOP_NOT_FOUND")
        }),
    ],
    [
      "a request that never reached the server",
      () =>
        (send = async () => {
          throw new TypeError("Failed to fetch")
        }),
    ],
  ]

  it("shows one confirmation, character for character, for every outcome but the rate limit", async () => {
    const rendered: string[] = []

    for (const [, arrange] of outcomes) {
      arrange()
      const { container, unmount } = renderForm()
      await submit(container)
      await waitFor(() => expect(screen.getByText("sentTitle")).toBeTruthy())
      rendered.push(container.textContent ?? "")
      unmount()
    }

    // Not "they all contain the confirmation" — they are all the same string.
    // A stray "could not send" line appended to one of them would pass the
    // weaker assertion and give the whole property away.
    expect(new Set(rendered).size).toBe(1)
    expect(rendered[0]).toContain("sentTitle")
  })

  it("answers a tripped honeypot exactly as it answers a real message", async () => {
    const { container: clean, unmount } = renderForm()
    await submit(clean)
    await waitFor(() => expect(screen.getByText("sentTitle")).toBeTruthy())
    const honest = clean.textContent
    unmount()

    const { container: trapped } = renderForm()
    await submit(trapped, { website: "https://spam.example" })
    await waitFor(() => expect(screen.getByText("sentTitle")).toBeTruthy())

    expect(trapped.textContent).toBe(honest)
  })

  it("keeps the form and says so when the rate limit is the answer", async () => {
    send = async () => {
      throw graphqlError("CONTACT_MESSAGE_RATE_LIMITED")
    }
    const { container } = renderForm()
    await submit(container)

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("rateLimited"),
    )
    // The words the visitor typed are still in the box, because they are going
    // to have to send them again.
    expect(screen.queryByText("sentTitle")).toBeNull()
    expect(container.querySelector("form")).toBeTruthy()
    expect(
      (screen.getByLabelText("messageLabel") as HTMLTextAreaElement).value,
    ).toBe("Where is my order?")
  })
})

describe("ContactForm — the honeypot", () => {
  it("renders the field, out of reach of anybody who could see it", () => {
    const { container } = renderForm()
    const trap = container.querySelector(
      'input[name="website"]',
    ) as HTMLInputElement

    expect(trap).toBeTruthy()
    expect(trap.getAttribute("tabindex")).toBe("-1")
    expect(trap.getAttribute("autocomplete")).toBe("off")

    const wrapper = trap.closest("[aria-hidden]") as HTMLElement
    expect(wrapper).toBeTruthy()
    expect(wrapper.getAttribute("aria-hidden")).toBe("true")

    // Off-screen, NOT `display: none`. The cheap form fillers skip an input
    // hidden that way, having learned it is a decoy — a trap nobody springs
    // catches nobody.
    expect(wrapper.className).toContain("left-[-9999px]")
    expect(wrapper.className.split(/\s+/)).not.toContain("hidden")
    expect(wrapper.hidden).toBe(false)
  })

  it("submits whatever landed in it instead of refusing locally", async () => {
    const { container } = renderForm()
    await submit(container, { website: "https://spam.example" })

    // Short-circuiting here would make a bot the one caller on the platform
    // with no rate limit: the back-end spends its per-IP ceiling BEFORE it
    // looks at the trap, precisely so a script pays for every attempt.
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0]).toMatchObject({
      variables: { input: { website: "https://spam.example" } },
    })
  })
})

describe("ContactForm — the message cap", () => {
  it("counts down to the same 2000 the DTO enforces", async () => {
    // `SendContactMessageInput.message` carries `@MaxLength(2000)`. Two numbers
    // is how a counter that says "150 characters left" starts submitting into a
    // `Validation failed`.
    expect(CONTACT_MESSAGE_MAX_LENGTH).toBe(2000)

    renderForm()
    const box = screen.getByLabelText("messageLabel") as HTMLTextAreaElement

    expect(box.maxLength).toBe(2000)
    expect(screen.getByText("charactersLeft:2000")).toBeTruthy()
    // The counter is attached to the field rather than shouted from a live
    // region, which would talk over the typing it is counting.
    expect(box.getAttribute("aria-describedby")).toBe("contact-message-count")

    await act(async () => {
      fireEvent.change(box, { target: { value: "x".repeat(1900) } })
    })
    expect(screen.getByText("charactersLeft:100")).toBeTruthy()
  })
})

describe("/contact stays crawlable", () => {
  it("is in neither of the lists robots.ts derives its disallow rules from", () => {
    // `robots.ts` builds its rules out of these two arrays plus `cart` and
    // `wishlist`. A public page needs nothing done to it to be crawlable — it
    // only needs nobody to have quietly added it to one of these.
    expect(PRIVATE_SEGMENTS as readonly string[]).not.toContain("contact")
    expect(GUEST_ONLY_SEGMENTS as readonly string[]).not.toContain("contact")
  })
})
