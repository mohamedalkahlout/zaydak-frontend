import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { NotificationSettingEntry } from "../../types"

/**
 * The landing card's title is Reply-to, because that address is never the
 * From. The body already said so; the heading used to say "Sender email".
 */

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [vi.fn(), { loading: false }],
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

const { SenderEmailCard } = await import("../sender-email-card")

const setting: NotificationSettingEntry = {
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
}

describe("<SenderEmailCard />", () => {
  it("titles the card as the reply-to address", () => {
    render(<SenderEmailCard setting={setting} onChanged={vi.fn()} />)

    expect(screen.getByRole("heading", { name: "Reply-to address" })).toBeTruthy()
    expect(screen.queryByText("Sender email")).toBeNull()
  })
})
