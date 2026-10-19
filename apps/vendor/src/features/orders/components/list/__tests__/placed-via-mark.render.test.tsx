import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

// Resolved against the real message files, so a label that was never written
// fails here instead of rendering as its key on the merchant's screen.
const messages = vi.hoisted(async () => ({
  en: (await import("@/shared/messages/en")).default as Record<string, unknown>,
  ar: (await import("@/shared/messages/ar")).default as Record<string, unknown>,
}))
let locale: "en" | "ar" = "en"

vi.mock("next-intl", async () => {
  const all = await messages
  return {
    useTranslations: (namespace?: string) => (key: string) => {
      const path = namespace ? `${namespace}.${key}` : key
      const value = path
        .split(".")
        .reduce<unknown>(
          (node, part) =>
            node && typeof node === "object"
              ? (node as Record<string, unknown>)[part]
              : undefined,
          all[locale],
        )
      if (typeof value !== "string") throw new Error(`Missing message: ${path}`)
      return value
    },
  }
})

const { PlacedViaMark } = await import("../placed-via-mark")

describe("PlacedViaMark", () => {
  it("marks an order the assistant took on WhatsApp, in both languages", () => {
    for (const lang of ["en", "ar"] as const) {
      locale = lang
      const { unmount } = render(
        <PlacedViaMark placedVia="whatsapp_assistant" />,
      )
      const mark = screen.getByRole("img")
      expect(mark.getAttribute("aria-label")).toBeTruthy()
      expect(mark.getAttribute("title")).toBe(mark.getAttribute("aria-label"))
      unmount()
    }
  })

  it("marks an order the assistant took on Telegram, in both languages", () => {
    for (const lang of ["en", "ar"] as const) {
      locale = lang
      const { unmount } = render(
        <PlacedViaMark placedVia="telegram_assistant" />,
      )
      const mark = screen.getByRole("img")
      expect(mark.getAttribute("aria-label")).toBeTruthy()
      unmount()
    }
    // Its own label, not WhatsApp's.
    locale = "en"
    const { unmount } = render(<PlacedViaMark placedVia="telegram_assistant" />)
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(
      /Telegram/,
    )
    unmount()
  })

  it("marks nothing else", () => {
    locale = "en"
    for (const placedVia of [null, undefined, "", "storefront", "sms_assistant"]) {
      const { container, unmount } = render(
        <PlacedViaMark placedVia={placedVia} />,
      )
      expect(container.innerHTML).toBe("")
      unmount()
    }
  })
})
