import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"

/**
 * The opt-in card.
 *
 * What is worth pinning is not the markup but **when it says nothing**. Two of
 * its three states render no card at all, and both would be bugs the other way
 * round: offering a link into a bot that cannot receive gives a customer a tap
 * that leads nowhere, and offering it again to somebody already bound is
 * persuasion that has already worked.
 *
 * The third thing pinned is that the link is minted by the press rather than on
 * mount. It is a single-use credential with a few minutes on it — one fetched
 * on mount would be stale by the time anybody scrolled to it, and would be
 * minted for every visitor who never wanted it.
 */

let status: {
  available: boolean
  linked: boolean
  bot_username: string | null
}
/** Typed, because `ReturnType<typeof vi.fn>` is the un-parameterised mock
 *  and calling it does not typecheck. */
let connect: () => Promise<{
  connectTelegramOrderUpdates: { url: string; expires_in: number } | null
}>

const opName = (doc: unknown): string =>
  (doc as { definitions?: { name?: { value?: string } }[] })?.definitions?.[0]
    ?.name?.value ?? ""

vi.mock("@apollo/client/react", () => ({
  useQuery: () => ({ data: { myTelegramOrderUpdates: status } }),
  useMutation: (doc: unknown, opts: { onCompleted?: (d: unknown) => void }) => {
    if (opName(doc) !== "StorefrontConnectTelegramOrderUpdates") {
      return [vi.fn(), { loading: false }]
    }
    return [
      async () => {
        const data = await connect()
        opts?.onCompleted?.(data)
        return { data }
      },
      { loading: false },
    ]
  },
}))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, vars?: Record<string, unknown>) =>
    vars ? `${key}:${Object.values(vars).join(",")}` : key,
}))

const errorToast = vi.fn()
vi.mock("sileo", () => ({
  sileo: { success: vi.fn(), error: (...args: unknown[]) => errorToast(...args) },
}))

const { TelegramUpdatesCard } = await import("../telegram-updates-card")

beforeEach(() => {
  vi.clearAllMocks()
  status = { available: true, linked: false, bot_username: "AcmeShopBot" }
  connect = vi.fn(async () => ({
    connectTelegramOrderUpdates: {
      url: "https://t.me/AcmeShopBot?start=tok",
      expires_in: 900,
    },
  }))
})

describe("TelegramUpdatesCard", () => {
  it("renders nothing for a shop with no connected bot", () => {
    // A button here would mint a link into a bot with no receiver: the customer
    // taps, Telegram opens, and nothing ever answers.
    status = { available: false, linked: false, bot_username: null }
    const { container } = render(<TelegramUpdatesCard />)
    expect(container.firstChild).toBeNull()
  })

  it("stops asking once the customer is already bound", () => {
    status = { available: true, linked: true, bot_username: "AcmeShopBot" }
    render(<TelegramUpdatesCard />)

    expect(screen.getByText("linkedTo:@AcmeShopBot")).toBeTruthy()
    expect(screen.queryByText(/^connect/)).toBeNull()
  })

  it("mints nothing until the press that will spend it", () => {
    const { container } = render(<TelegramUpdatesCard />)
    expect(connect).not.toHaveBeenCalled()
    // Queried as an anchor rather than by role: `@repo/ui`'s Button stamps
    // `role="button"` on whatever it renders, so the `t.me` link is an `<a>`
    // that does not answer to `getByRole("link")`.
    expect(container.querySelector("a[href]")).toBeNull()
  })

  it("shows the minted link as a link, not a navigation", async () => {
    const { container } = render(<TelegramUpdatesCard />)

    await act(async () => {
      fireEvent.click(screen.getByText("connectTo:@AcmeShopBot"))
    })

    const anchor = container.querySelector("a[href]") as HTMLAnchorElement
    expect(anchor.href).toBe("https://t.me/AcmeShopBot?start=tok")
    // Somebody else's origin, opened from a page holding a session.
    expect(anchor.rel).toContain("noopener")
    // Fifteen minutes, said in the customer's own units.
    expect(screen.getByText("expires:15")).toBeTruthy()
  })

  /**
   * The race: the query said available, the merchant disconnected the bot
   * before the press. The back-end answers null rather than an error code,
   * because its own "Telegram is not configured" is about the platform and
   * would be a lie about a merchant who simply dropped their bot.
   */
  it("says so when the bot went away between the query and the press", async () => {
    connect = vi.fn(async () => ({ connectTelegramOrderUpdates: null }))
    const { container } = render(<TelegramUpdatesCard />)

    await act(async () => {
      fireEvent.click(screen.getByText("connectTo:@AcmeShopBot"))
    })

    await waitFor(() =>
      expect(errorToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "unavailable" }),
      ),
    )
    expect(container.querySelector("a[href]")).toBeNull()
  })
})
