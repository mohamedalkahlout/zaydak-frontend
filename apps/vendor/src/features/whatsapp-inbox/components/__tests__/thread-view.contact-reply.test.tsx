import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import type { InboxMessage, InboxThreadDetail } from "../../types"

/**
 * A contact-form thread is answered by email, and the box under it has to say
 * where the customer's answer will go before the merchant types a word.
 *
 * **No sender email, no box.** The server refuses a reply nobody could answer,
 * so the screen sends the merchant to the setting instead of letting them type
 * a message that will be turned away.
 *
 * **Nothing about the assistant.** No assistant answers this channel, so the
 * "replying pauses the assistant" line the chat box carries would be false here.
 */

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("next/navigation", () => ({
  useParams: () => ({ shopSlug: "acme" }),
}))

const useQuery = vi.fn()
const useMutation = vi.fn()
vi.mock("@apollo/client/react", () => ({
  useQuery: (...a: unknown[]) => useQuery(...a),
  useMutation: (...a: unknown[]) => useMutation(...a),
}))

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }))

const { NOTIFICATION_SETTING } = await import("@/features/notifications/api")
const { REPLY_TO_WHATSAPP_THREAD } = await import("../../api")
const { ThreadView } = await import("../thread-view")

const thread: InboxThreadDetail = {
  id: "conv-1",
  channel: "CONTACT_FORM",
  phone_masked: "j**@example.com",
  latest_message: null,
  unanswered_count: 1,
  ai_paused_until: null,
  is_ai_blocked: false,
  flagged_at: null,
  flag_reason: null,
  last_read_at: null,
  is_read: true,
  updated_at: "2026-10-01T10:00:00.000Z",
  messages: [],
}

const reply = vi.fn()
const startPolling = vi.fn()
const stopPolling = vi.fn()

function show(
  setting: {
    sender_email: string | null
    sender_verified: boolean
  },
  messages: InboxMessage[] = [],
) {
  useQuery.mockImplementation((doc: unknown) =>
    doc === NOTIFICATION_SETTING
      ? {
          data: { notificationSetting: { success: true, data: setting } },
          loading: false,
        }
      : {
          data: {
            shopWhatsAppThread: {
              success: true,
              data: { ...thread, messages },
            },
          },
          loading: false,
          startPolling,
          stopPolling,
        },
  )
  useMutation.mockImplementation((doc: unknown) => [
    doc === REPLY_TO_WHATSAPP_THREAD ? reply : vi.fn(),
    { loading: false },
  ])
  return render(<ThreadView threadId="conv-1" />)
}

describe("ThreadView on a contact-form thread", () => {
  beforeEach(() => {
    useQuery.mockReset()
    useMutation.mockReset()
    reply.mockReset()
    reply.mockResolvedValue({})
  })

  it("offers an email reply and names where the answer goes", () => {
    show({ sender_email: "hello@acme.test", sender_verified: true })

    const box = screen.getByRole("textbox")
    expect(box.hasAttribute("disabled")).toBe(false)
    expect(screen.getByText("hello@acme.test")).toBeTruthy()
    expect(
      screen.queryByText(
        "This address is not verified yet. Check it is spelled right, or the customer's answer will reach someone else.",
      ),
    ).toBeNull()
  })

  it("sends the reply through the inbox mutation", () => {
    show({ sender_email: "hello@acme.test", sender_verified: true })

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "  Your order ships tomorrow.  " },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))

    expect(reply).toHaveBeenCalledWith({
      variables: {
        input: { conversation_id: "conv-1", body: "Your order ships tomorrow." },
      },
    })
  })

  /**
   * Each send is an email from the platform's domain that spends the shop's
   * ceilings. `sending` disables the button only after a re-render, so the
   * guard that stops the second click has to be synchronous.
   */
  it("sends once for a double-click", () => {
    // Never settles: the first reply is still in flight for the second click.
    reply.mockReturnValue(new Promise(() => {}))
    show({ sender_email: "hello@acme.test", sender_verified: true })

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Your order ships tomorrow." },
    })
    const send = screen.getByRole("button", { name: "Send" })
    fireEvent.click(send)
    fireEvent.click(send)

    expect(reply).toHaveBeenCalledTimes(1)
  })

  it("lets the merchant send again once the first reply has settled", async () => {
    show({ sender_email: "hello@acme.test", sender_verified: true })

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "First." },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))
    await Promise.resolve()
    await Promise.resolve()
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Second." },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send" }))

    expect(reply).toHaveBeenCalledTimes(2)
  })

  /** No assistant answers this channel, so there is nothing to stop. */
  it("offers no AI controls and names the channel", () => {
    show({ sender_email: "hello@acme.test", sender_verified: true })

    expect(screen.queryByText("Stop AI replies")).toBeNull()
    expect(screen.queryByText("Resume AI replies")).toBeNull()
    expect(screen.getByText("via Contact Form")).toBeTruthy()
  })

  /**
   * Whether the email has left. The worker sends after the mutation returns
   * and nothing pushes "it left" to the screen, so the open thread re-reads
   * itself for as long as the newest reply is inside its sending window.
   *
   * The clock is pinned to the one the next-intl mock's `useNow` reads, so
   * the label (render) and the poll (effect) agree about what time it is.
   */
  describe("the delivery state of an email reply", () => {
    const NOW = "2026-09-05T00:00:00.000Z"
    const settings = { sender_email: "hello@acme.test", sender_verified: true }

    const mine = (over: Partial<InboxMessage>): InboxMessage => ({
      id: "m-1",
      sender: "VENDOR",
      body: "Your order ships tomorrow.",
      created_at: "2026-09-04T23:59:50.000Z",
      sent_at: null,
      ...over,
    })

    beforeEach(() => {
      vi.useFakeTimers({ now: new Date(NOW) })
      startPolling.mockReset()
      stopPolling.mockReset()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("shows a reply the worker has not sent yet as sending, and re-reads until it has", () => {
      const { unmount } = show(settings, [mine({})])

      expect(screen.getByText("Sending…")).toBeTruthy()
      expect(startPolling).toHaveBeenCalledWith(5_000)

      unmount()
      expect(stopPolling).toHaveBeenCalled()
    })

    it("gives up re-reading when the sending window runs out", () => {
      // Written ten seconds ago, so 110 seconds of the two minutes remain.
      show(settings, [mine({})])
      expect(stopPolling).not.toHaveBeenCalled()

      vi.advanceTimersByTime(110_000)

      expect(stopPolling).toHaveBeenCalledTimes(1)
    })

    it("shows a reply the mail server took as sent, and asks for nothing more", () => {
      show(settings, [mine({ sent_at: "2026-09-04T23:59:52.000Z" })])

      expect(screen.getByText("Sent")).toBeTruthy()
      expect(screen.queryByText("Sending…")).toBeNull()
      expect(startPolling).not.toHaveBeenCalled()
    })

    it("says a reply past its window is not sent yet, rather than sending forever", () => {
      show(settings, [mine({ created_at: "2026-09-04T23:00:00.000Z" })])

      expect(screen.getByText("Not sent yet")).toBeTruthy()
      // More polling would not change it.
      expect(startPolling).not.toHaveBeenCalled()
    })

    it("says nothing about delivery on the customer's own message", () => {
      show(settings, [mine({ sender: "CUSTOMER", body: "Where is my order?" })])

      expect(screen.queryByText("Sending…")).toBeNull()
      expect(screen.queryByText("Not sent yet")).toBeNull()
      expect(startPolling).not.toHaveBeenCalled()
    })
  })

  it("says nothing about pausing an assistant", () => {
    show({ sender_email: "hello@acme.test", sender_verified: true })

    expect(
      screen.queryByText(
        "Replying pauses the assistant on this conversation, so it will not answer over you.",
      ),
    ).toBeNull()
  })

  it("warns when the address it names is not verified", () => {
    show({ sender_email: "hello@acme.test", sender_verified: false })

    expect(
      screen.getByText(
        "This address is not verified yet. Check it is spelled right, or the customer's answer will reach someone else.",
      ),
    ).toBeTruthy()
  })

  it("sends the merchant to notification settings when there is no sender email", () => {
    show({ sender_email: null, sender_verified: false })

    expect(screen.queryByRole("textbox")).toBeNull()
    expect(
      screen.getByText(
        "To reply by email, add a sender email in notification settings. Customers' answers go to that address.",
      ),
    ).toBeTruthy()
    // An anchor rendered through the shared Button, which gives it Base UI's
    // button role; what matters here is where it goes.
    const link = screen.getByText("Open notification settings").closest("a")
    expect(link?.getAttribute("href")).toBe(
      "/store/acme/settings/notifications",
    )
  })
})
