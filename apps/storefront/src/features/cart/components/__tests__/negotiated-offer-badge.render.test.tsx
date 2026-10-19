import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"

import { NegotiatedOfferBadge } from "../negotiated-offer-badge"

const messages = {
  cart: {
    negotiatedBadge: "AI negotiated",
    offerExpiresIn: "Expires in {time}",
    offerExpired: "Offer expired",
  },
}

function renderBadge(expiresAt?: string | number | Date | null) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <NegotiatedOfferBadge expiresAt={expiresAt} />
    </NextIntlClientProvider>,
  )
}

describe("NegotiatedOfferBadge", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders the AI negotiated badge", () => {
    renderBadge()
    expect(screen.getByText("AI negotiated")).toBeTruthy()
  })

  it("renders countdown when expiresAt is in the future", () => {
    const now = new Date("2026-09-19T12:00:00.000Z")
    vi.setSystemTime(now)

    // 10 minutes in the future
    const future = new Date("2026-09-19T12:10:00.000Z")
    renderBadge(future)

    expect(screen.getByText("AI negotiated")).toBeTruthy()
    expect(screen.getByText("Expires in 10:00")).toBeTruthy()

    // Fast-forward 1 minute
    act(() => {
      vi.advanceTimersByTime(60000)
    })

    expect(screen.getByText("Expires in 09:00")).toBeTruthy()
  })

  it("renders expired state when expiresAt is in the past", () => {
    const now = new Date("2026-09-19T12:00:00.000Z")
    vi.setSystemTime(now)

    // 5 minutes in the past
    const past = new Date("2026-09-19T11:55:00.000Z")
    renderBadge(past)

    expect(screen.getByText("AI negotiated")).toBeTruthy()
    expect(screen.getByText("Offer expired")).toBeTruthy()
  })

  it("transitions from active to expired when time runs out", () => {
    const now = new Date("2026-09-19T12:00:00.000Z")
    vi.setSystemTime(now)

    // 2 seconds in future
    const future = new Date("2026-09-19T12:00:02.000Z")
    renderBadge(future)

    expect(screen.getByText("Expires in 00:02")).toBeTruthy()

    // Advance 3 seconds
    act(() => {
      vi.advanceTimersByTime(3000)
    })

    expect(screen.getByText("Offer expired")).toBeTruthy()
  })
})
