import { describe, expect, it } from "vitest"

import type { AbandonedCart } from "../../types"
import { marketingStatusOf, statusTimeline } from "../status"

/**
 * The reminder-link click (`reminder_link_opened_at`) in the status popover:
 * it is its own timeline event, and it makes a cart RETURNED the same way the
 * back-end's `marketingReminderStatus` does.
 */

function cart(overrides: Partial<AbandonedCart> = {}): AbandonedCart {
  return {
    id: "c1",
    status: "abandoned",
    reminder_status: "SENT",
    hidden: false,
    items: [],
    item_count: 0,
    currency: "SAR",
    channels: { email: true, sms: false, whatsapp: false },
    created_at: "2026-09-01T00:00:00.000Z",
    abandoned_at: "2026-09-02T00:00:00.000Z",
    last_activity_at: "2026-09-01T12:00:00.000Z",
    last_reminder_at: "2026-09-10T00:00:00.000Z",
    ...overrides,
  }
}

describe("reminder link opened", () => {
  it("adds an 'opened' event after the send when the link was opened later", () => {
    const events = statusTimeline(
      cart({ reminder_link_opened_at: "2026-09-10T02:00:00.000Z" }),
    )
    expect(events.map((e) => e.key)).toEqual(["abandoned", "sent", "opened"])
    expect(events.at(-1)?.at).toBe("2026-09-10T02:00:00.000Z")
  })

  it("leaves out an open that predates the latest send", () => {
    const events = statusTimeline(
      cart({ reminder_link_opened_at: "2026-09-05T00:00:00.000Z" }),
    )
    expect(events.map((e) => e.key)).toEqual(["abandoned", "sent"])
  })

  it("shows the click and the later return as two separate events", () => {
    const events = statusTimeline(
      cart({
        reminder_link_opened_at: "2026-09-10T02:00:00.000Z",
        last_activity_at: "2026-09-10T03:00:00.000Z",
      }),
    )
    expect(events.map((e) => e.key)).toEqual([
      "abandoned",
      "sent",
      "opened",
      "returned",
    ])
  })

  it("derives RETURNED from an opened link alone", () => {
    expect(
      marketingStatusOf(
        cart({ reminder_link_opened_at: "2026-09-10T02:00:00.000Z" }),
      ),
    ).toBe("RETURNED")
    expect(
      marketingStatusOf(
        cart({ reminder_link_opened_at: "2026-09-05T00:00:00.000Z" }),
      ),
    ).toBe("SENT")
  })
})
