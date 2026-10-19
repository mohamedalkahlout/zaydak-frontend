import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import type { InboxThreadDetail } from "../../types"

/**
 * The Block control, and the two things about it that are easy to get wrong.
 *
 * **It must be visible on an ordinary thread.** The header's end-side row used
 * to exist only inside the `paused` branch, so a control put there would have
 * been invisible on almost every conversation — present in the code, absent
 * from the screen, and no type or compile step would have said a word.
 *
 * **The reply box must stay usable while blocked.** Blocking says "do not spend
 * my AI on this person", not "I never want to hear from them"; the customer's
 * messages still arrive and the merchant can still answer by hand. A gate added
 * here later would quietly turn a spend control into a mute.
 */

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

const useQuery = vi.fn()
const useMutation = vi.fn()
vi.mock("@apollo/client/react", () => ({
  useQuery: (...a: unknown[]) => useQuery(...a),
  useMutation: (...a: unknown[]) => useMutation(...a),
}))

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }))

const { ThreadView } = await import("../thread-view")

const thread = (over: Partial<InboxThreadDetail> = {}): InboxThreadDetail => ({
  id: "conv-1",
  channel: "WHATSAPP",
  phone_masked: "+97*******56",
  latest_message: null,
  unanswered_count: 0,
  ai_paused_until: null,
  is_ai_blocked: false,
  flagged_at: null,
  flag_reason: null,
  last_read_at: null,
  is_read: true,
  updated_at: "2026-09-21T10:00:00.000Z",
  messages: [],
  ...over,
})

const show = (over: Partial<InboxThreadDetail> = {}) => {
  useQuery.mockReturnValue({
    data: { shopWhatsAppThread: { success: true, data: thread(over) } },
    loading: false,
  })
  return render(<ThreadView threadId="conv-1" />)
}

/**
 * The "via …" line. Telegram threads share this inbox, and the old
 * contact-form-else-WhatsApp fork labelled every one of them "via WhatsApp".
 */
describe("ThreadView channel label", () => {
  beforeEach(() => {
    useQuery.mockReset()
    useMutation.mockReset()
    useMutation.mockReturnValue([vi.fn(), { loading: false }])
  })

  it("labels a Telegram thread as Telegram", () => {
    show({ channel: "TELEGRAM", phone_masked: "tg:****4321" })
    expect(screen.getByText("via Telegram")).toBeTruthy()
    expect(screen.queryByText("via WhatsApp")).toBeNull()
  })

  it("labels a WhatsApp thread as WhatsApp", () => {
    show()
    expect(screen.getByText("via WhatsApp")).toBeTruthy()
  })

  /**
   * `sent_at` is null for good on a message no queue carried — a merchant's
   * Telegram reply is sent inline — so on a chat thread an unstamped bubble is
   * not an unsent one, and the email reply's delivery line must not appear.
   */
  it.each(["TELEGRAM", "WHATSAPP"])(
    "says nothing about delivery on a %s reply",
    (channel) => {
      show({
        channel,
        messages: [
          {
            id: "m-1",
            sender: "VENDOR",
            body: "On its way.",
            created_at: "2026-09-04T23:00:00.000Z",
            sent_at: null,
          },
        ],
      })

      expect(screen.getByText("On its way.")).toBeTruthy()
      expect(screen.queryByText("Not sent yet")).toBeNull()
      expect(screen.queryByText("Sending…")).toBeNull()
      expect(screen.queryByText("Sent")).toBeNull()
    },
  )

  it("keeps the AI controls on a Telegram thread, where the assistant answers", () => {
    show({ channel: "TELEGRAM" })
    expect(screen.getByText("Stop AI replies")).toBeTruthy()
  })
})

/**
 * A double-click on Send. Each call records a new message, so the server's
 * per-message job ids could not tell two clicks apart; this guard is
 * synchronous because `sending` only disables the button after a re-render.
 */
describe("ThreadView chat reply", () => {
  beforeEach(() => {
    useQuery.mockReset()
    useMutation.mockReset()
  })

  it("sends once for a double-click", () => {
    const reply = vi.fn().mockReturnValue(new Promise(() => {}))
    useMutation.mockReturnValue([reply, { loading: false }])
    show()

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "On its way." },
    })
    const send = screen.getByRole("button", { name: "Send" })
    fireEvent.click(send)
    fireEvent.click(send)

    expect(reply).toHaveBeenCalledTimes(1)
  })
})

describe("ThreadView block control", () => {
  beforeEach(() => {
    useQuery.mockReset()
    useMutation.mockReset()
    useMutation.mockReturnValue([vi.fn(), { loading: false }])
  })

  /** The regression guard for the header row that only existed while paused. */
  it("offers Stop AI replies on an ordinary, unpaused thread", () => {
    show()
    expect(screen.getByText("Stop AI replies")).toBeTruthy()
  })

  it("offers Resume AI replies once the contact is blocked", () => {
    show({ is_ai_blocked: true })
    expect(screen.getByText("Resume AI replies")).toBeTruthy()
    expect(screen.queryByText("Stop AI replies")).toBeNull()
  })

  it("badges a blocked thread", () => {
    show({ is_ai_blocked: true })
    expect(screen.getAllByText("AI stopped").length).toBeGreaterThan(0)
  })

  it("shows no badge when nobody is blocked", () => {
    show()
    expect(screen.queryByText("AI stopped")).toBeNull()
  })

  /**
   * The property that makes this a spend control rather than a mute. The
   * merchant answers by hand on exactly the threads they stopped the assistant
   * on — that is the normal case, not the exception.
   */
  it("keeps the reply box usable on a blocked thread", () => {
    show({ is_ai_blocked: true })
    const box = screen.getByRole("textbox")
    expect(box.hasAttribute("disabled")).toBe(false)
  })

  it("still shows the pause controls beside the block control", () => {
    show({
      is_ai_blocked: true,
      ai_paused_until: "2099-01-01T00:00:00.000Z",
    })
    // The pause pill and its Resume button, plus the block control — the two
    // are different promises and both belong on screen at once.
    expect(screen.getByText("Assistant paused")).toBeTruthy()
    expect(screen.getByText("Resume assistant")).toBeTruthy()
    expect(screen.getByText("Resume AI replies")).toBeTruthy()
  })
})

/**
 * The nudge, and the line between it and a decision.
 *
 * The server never blocks anybody by itself — a real customer having a bad day
 * looks identical to a squatter from its side. What it does is put the question
 * in front of the person who can answer it.
 */
describe("ThreadView flag", () => {
  beforeEach(() => {
    useQuery.mockReset()
    useMutation.mockReset()
    useMutation.mockReturnValue([vi.fn(), { loading: false }])
  })

  it("names the ceiling rather than passing a verdict", () => {
    show({ flagged_at: "2026-09-21T10:00:00.000Z", flag_reason: "share" })
    expect(screen.getByText("Using a lot of your allowance")).toBeTruthy()
  })

  it("falls back to a rate wording when the reason is missing", () => {
    show({ flagged_at: "2026-09-21T10:00:00.000Z", flag_reason: null })
    expect(screen.getByText("Sending very fast")).toBeTruthy()
  })

  it("prompts the merchant above the reply box, and offers the control", () => {
    show({ flagged_at: "2026-09-21T10:00:00.000Z", flag_reason: "rate" })
    expect(
      screen.getByText(
        "This visitor keeps hitting the reply limit. You can stop the assistant answering them.",
      ),
    ).toBeTruthy()
    expect(screen.getByText("Stop AI replies")).toBeTruthy()
  })

  /**
   * The chip asks a question the merchant has already answered by blocking.
   * Leaving it up makes it noise they learn to ignore.
   */
  it("disappears once the contact is blocked", () => {
    show({
      flagged_at: "2026-09-21T10:00:00.000Z",
      flag_reason: "rate",
      is_ai_blocked: true,
    })
    expect(screen.queryByText("Sending very fast")).toBeNull()
    expect(screen.getAllByText("AI stopped").length).toBeGreaterThan(0)
  })

  it("shows nothing on an unflagged thread", () => {
    show()
    expect(screen.queryByText("Sending very fast")).toBeNull()
    expect(screen.getByText("Replying pauses the assistant on this conversation, so it will not answer over you.")).toBeTruthy()
  })

  /** Advisory: the reply box is untouched by a flag. */
  it("leaves the reply box usable", () => {
    show({ flagged_at: "2026-09-21T10:00:00.000Z", flag_reason: "rate" })
    expect(screen.getByRole("textbox").hasAttribute("disabled")).toBe(false)
  })
})
