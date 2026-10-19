import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TemplateLibrary } from "../template-library"

const refetch = vi.fn()
let templateId: string | null = null

vi.mock("next-intl", async () => (await import("@/shared/test/next-intl")).nextIntlMock())

vi.mock("next/navigation", () => ({
  useParams: () => ({ shopSlug: "acme" }),
}))

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: unknown
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("@/shared/components/app-image", () => ({
  default: () => <span data-testid="thumbnail" />,
}))

vi.mock("../../use-shop-template", () => ({
  useShopStorefrontTemplate: () => ({ templateId, refetch }),
}))

describe("TemplateLibrary", () => {
  beforeEach(() => {
    templateId = null
    refetch.mockReset()
  })

  it("opens each sample in a new tab and offers contact", () => {
    render(<TemplateLibrary />)

    expect(screen.getByRole("heading", { name: "Theme library" })).toBeTruthy()
    expect(
      screen.getByText(
        "Examples of a custom theme. Preview one, and contact us if you want a theme made for your store.",
      ),
    ).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Doughn" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Hullo" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Drip" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Rail" })).toBeTruthy()
    expect(screen.getAllByTestId("thumbnail")).toHaveLength(4)

    const previews = screen.getAllByRole("button", { name: /Preview/ })
    expect(previews.map((preview) => preview.getAttribute("href"))).toEqual([
      "/theme-preview/doughn",
      "/theme-preview/hullo",
      "/theme-preview/drip",
      "/theme-preview/rail",
    ])
    for (const preview of previews) {
      expect(preview.getAttribute("target")).toBe("_blank")
      expect(preview.getAttribute("rel")).toContain("noopener")
    }

    const contacts = screen.getAllByRole("button", { name: "Contact us" })
    expect(contacts).toHaveLength(4)
    for (const contact of contacts) {
      expect(contact.getAttribute("href")).toBe("/store/acme/settings/whatsapp")
    }
    expect(screen.queryByRole("button", { name: "Use this theme" })).toBeNull()
    expect(screen.queryByRole("link", { name: "Use this theme" })).toBeNull()
  })

  it("labels an example already on the shop and does not apply another", () => {
    templateId = "doughn"
    render(<TemplateLibrary />)

    expect(screen.getByText("In use")).toBeTruthy()
    expect(screen.queryByRole("link", { name: "In use" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Use this theme" })).toBeNull()
    expect(screen.getAllByRole("button", { name: "Contact us" })).toHaveLength(4)
  })
})
