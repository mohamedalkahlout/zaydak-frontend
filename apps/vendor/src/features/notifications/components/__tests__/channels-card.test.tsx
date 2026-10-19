import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import type { NotificationSettingEntry } from "../../types"

/**
 * The card that answers "where do notifications go".
 *
 * Two things it exists to get right. **Every switch is staged, not live** —
 * the repo's rule for settings screens, and here it matters more than usual
 * because each of these decides whether a merchant's customers are messaged.
 * And **the Telegram row says its own precondition out loud**: switching it on
 * is not enough, because Telegram refuses to let a bot message anybody who has
 * not opened a chat with it. A merchant who flips it, sees nothing arrive, and
 * finds no explanation will report a bug that is not one.
 *
 * Boundaries are mocked rather than provided (the repo's component-test
 * convention); translations return their key, so assertions read as keys.
 * No jest-dom in this project — assertions use plain DOM properties.
 */

const update = vi.fn(() => Promise.resolve({ data: {} }))
const onSaved = vi.fn()

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [update, { loading: false }],
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

const { ChannelsCard } = await import("../channels-card")

const setting = (
  over: Partial<NotificationSettingEntry> = {},
): NotificationSettingEntry => ({
  sender_email: null,
  sender_verified: false,
  logo_url: null,
  logo_width: 200,
  accent_color: "#1a1a1a",
  show_powered_by: true,
  sms_enabled: false,
  whatsapp_enabled: false,
  telegram_enabled: false,
  order_summary_frequency: "off",
  order_summary_hour: 9,
  order_summary_day: 1,
  ...over,
})

const switches = () => screen.getAllByRole("switch")

beforeEach(() => vi.clearAllMocks())

describe("ChannelsCard — the switches", () => {
  it("offers exactly the three opt-in transports", () => {
    // Email is deliberately absent: it is not a channel a merchant opts into,
    // and a master switch would invite silencing the one channel every
    // customer has.
    render(<ChannelsCard setting={setting()} onSaved={onSaved} />)

    expect(switches()).toHaveLength(3)
    expect(screen.getByText("Order confirmation by SMS")).toBeTruthy()
    expect(screen.getByText("WhatsApp")).toBeTruthy()
    expect(screen.getByText("Telegram")).toBeTruthy()
  })

  it("tells the merchant Telegram only reaches customers who opened the bot", () => {
    // The precondition has nowhere else to be said, and without it the
    // feature looks broken to somebody who switched it on.
    render(<ChannelsCard setting={setting()} onSaved={onSaved} />)

    expect(
      screen.getByText(
        "Send order updates on your shop's bot. Reaches only customers who have opened a chat with it and signed in — Telegram does not let a bot message anyone else.",
      ),
    ).toBeTruthy()
  })

  it("reflects what the shop already has on", () => {
    render(
      <ChannelsCard
        setting={setting({ whatsapp_enabled: true, telegram_enabled: false })}
        onSaved={onSaved}
      />,
    )

    const [sms, whatsapp, telegram] = switches()
    expect(sms.getAttribute("aria-checked")).toBe("false")
    expect(whatsapp.getAttribute("aria-checked")).toBe("true")
    expect(telegram.getAttribute("aria-checked")).toBe("false")
  })
})

describe("ChannelsCard — staging and saving", () => {
  it("saves nothing until asked", () => {
    // No Save button while nothing has changed, and no mutation on a flip.
    render(<ChannelsCard setting={setting()} onSaved={onSaved} />)
    expect(screen.queryByText("Save")).toBeNull()

    fireEvent.click(switches()[2])

    expect(update).not.toHaveBeenCalled()
    expect(screen.getByText("Save")).toBeTruthy()
  })

  it("sends all three switches together, so one save cannot revert another", async () => {
    render(
      <ChannelsCard
        setting={setting({ whatsapp_enabled: true })}
        onSaved={onSaved}
      />,
    )

    fireEvent.click(switches()[2])
    fireEvent.click(screen.getByText("Save"))

    await waitFor(() => expect(update).toHaveBeenCalled())
    expect(update).toHaveBeenCalledWith({
      variables: {
        input: {
          sms_enabled: false,
          // Untouched, and still sent: the mutation merges what it is given,
          // so omitting this would say nothing about it rather than keeping it.
          whatsapp_enabled: true,
          telegram_enabled: true,
        },
      },
    })
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })

  it("hides the Save button again when a flip is undone", () => {
    // Dirty is measured against the saved row, not against having touched
    // anything — so switching on and off leaves nothing to save.
    render(<ChannelsCard setting={setting()} onSaved={onSaved} />)

    fireEvent.click(switches()[1])
    expect(screen.getByText("Save")).toBeTruthy()

    fireEvent.click(switches()[1])
    expect(screen.queryByText("Save")).toBeNull()
  })
})
