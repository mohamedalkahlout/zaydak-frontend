import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import type { ShopTelegramBot, TelegramVendorLink } from "../../types"

/**
 * The screen's job is to be unambiguous about two things a merchant can get
 * wrong and one thing the app can: whose bot each card is, where the pairing
 * link lives, and that the shop's token is typed once and never comes back.
 *
 * **Whose bot.** Two handles can be on this screen — the shop's own bot, and
 * Zaydak's, which the vendor writes *to*. Each is labelled, and the labels
 * are load-bearing copy.
 *
 * **Where the link lives.** It is a one-time credential — whoever opens it
 * binds their Telegram to this account — so it must be minted by the click
 * that will use it and never fetched by a render. These tests pin that no
 * connect mutation runs on mount, and that the link appears only after the
 * press.
 *
 * **The shop token.** Pasted, shape-checked, sent once. Nothing mutates on
 * mount, the button stays disabled until the paste looks like a token, and the
 * connected card shows a handle, never the token. A refused webhook is retried
 * from the token the server already holds — no paste, no token in the call.
 *
 * **The assistant switch.** Same discipline as the WhatsApp card it reuses:
 * absent until a bot is connected, a question before a switch, on without a
 * confirm, off through one — and reading Telegram's own copy, not WhatsApp's.
 *
 * Boundaries are mocked rather than provided (the repo's component-test
 * convention); translations return their key, so assertions read as keys.
 * No jest-dom in this project — assertions use plain DOM properties.
 */

const VALID_TOKEN = "123456789:AAFakeTokenForTestsOnly-not-a-real-credential"

const refetch = vi.fn(() => Promise.resolve({ data: {} }))
const refetchShop = vi.fn(() => Promise.resolve({ data: {} }))
const connectResult = {
  data: {
    connectTelegramBot: {
      url: "https://t.me/SellorrAI_bot?start=tok-abc",
      expires_in: 600,
    },
  },
}
const connect = vi.fn(() => Promise.resolve(connectResult))
const disconnect = vi.fn(() =>
  Promise.resolve({ data: { disconnectTelegramBot: true } }),
)
// The call's arguments are recorded by vi.fn itself, so the implementation
// takes none; `toHaveBeenCalledWith` below still sees the variables.
const connectShop = vi.fn(() =>
  Promise.resolve({
    data: {
      connectShopTelegramBot: shopRow({
        connected: true,
        bot_username: "AcmeShopBot",
        status: "active",
      }),
    },
  }),
)
const disconnectShop = vi.fn(() =>
  Promise.resolve({ data: { disconnectShopTelegramBot: true } }),
)
const setShopBot = vi.fn(() =>
  Promise.resolve({
    data: {
      setShopTelegramCustomerBot: shopRow({
        connected: true,
        bot_username: "AcmeShopBot",
        status: "active",
        ai_enabled: true,
      }),
    },
  }),
)
const setShopOrders = vi.fn(() =>
  Promise.resolve({
    data: {
      setShopTelegramCustomerBotOrders: shopRow({
        connected: true,
        bot_username: "AcmeShopBot",
        status: "active",
        ai_enabled: true,
        ai_orders_enabled: true,
      }),
    },
  }),
)
let ordersAllowed = true
const syncShop = vi.fn(() =>
  Promise.resolve({
    data: {
      syncShopTelegramWebhook: shopRow({
        connected: true,
        bot_username: "AcmeShopBot",
        status: "active",
      }),
    },
  }),
)

let status: TelegramVendorLink
let shop: ShopTelegramBot

const row = (over: Partial<TelegramVendorLink> = {}): TelegramVendorLink => ({
  linked: false,
  telegram_username: null,
  linked_at: null,
  bot_username: "SellorrAI_bot",
  ...over,
})

function shopRow(over: Partial<ShopTelegramBot> = {}): ShopTelegramBot {
  return {
    connected: false,
    bot_username: null,
    ai_enabled: false,
    ai_orders_enabled: false,
    status: "disconnected",
    last_error: null,
    last_ok_at: null,
    ...over,
  }
}

function opName(doc: any): string {
  return doc?.definitions?.[0]?.name?.value ?? ""
}

vi.mock("@apollo/client/react", () => ({
  useQuery: (doc: any) =>
    opName(doc) === "MyShopTelegramBot"
      ? { data: { myShopTelegramBot: shop }, loading: false, refetch: refetchShop }
      : { data: { myTelegramBot: status }, loading: false, refetch },
  useMutation: (doc: any, opts: any) => {
    const name = opName(doc)
    const wire = (fn: (args?: unknown) => Promise<{ data: unknown }>) => [
      async (args?: unknown) => {
        const res = await fn(args)
        opts?.onCompleted?.(res.data)
        return res
      },
      { loading: false },
    ]
    if (name === "ConnectTelegramBot") return wire(() => connect())
    if (name === "DisconnectTelegramBot") return wire(() => disconnect())
    if (name === "ConnectShopTelegramBot") return wire((a) => connectShop(a))
    if (name === "DisconnectShopTelegramBot") return wire(() => disconnectShop())
    if (name === "SetShopTelegramCustomerBot") return wire((a) => setShopBot(a))
    if (name === "SetShopTelegramCustomerBotOrders")
      return wire((a) => setShopOrders(a))
    if (name === "SyncShopTelegramWebhook") return wire(() => syncShop())
    return [vi.fn(() => Promise.resolve({ data: {} })), { loading: false }]
  },
}))

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) =>
    ns ? `${ns}.${key}` : key,
  useFormatter: () => ({ relativeTime: () => "just now" }),
  useNow: () => new Date("2026-09-02T00:00:00.000Z"),
}))

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }))

// The plan gate reads its own queries; what matters here is its answer.
vi.mock("@/features/plan/lib/use-feature", () => ({
  useFeature: () => ({ allowed: ordersAllowed, loading: false }),
}))

const { TelegramSection } = await import("../telegram-section")

beforeEach(() => {
  vi.clearAllMocks()
  status = row()
  shop = shopRow()
  ordersAllowed = true
})

/**
 * The two switches, by position: the assistant's in the card header and the
 * orders switch below it, only while the assistant is on.
 */
const assistantSwitch = () => screen.getAllByRole("switch")[0]
const ordersSwitch = (): HTMLElement | null =>
  screen.queryAllByRole("switch")[1] ?? null

describe("TelegramSection — whose bot", () => {
  it("labels the handle as Zaydak's", () => {
    render(<TelegramSection />)
    expect(
      screen.getByText("settings.telegram.vendorBot.botLabel"),
    ).toBeTruthy()
    expect(screen.getByText("@SellorrAI_bot")).toBeTruthy()
  })

  it("offers no Connect button when the platform has no bot", () => {
    // Not the vendor's fault and not theirs to fix. A button would mint a link
    // with nowhere to go.
    status = row({ bot_username: null })
    render(<TelegramSection />)
    expect(
      screen.getByText("settings.telegram.vendorBot.notConfigured"),
    ).toBeTruthy()
    expect(
      screen.queryByText("settings.telegram.vendorBot.connect"),
    ).toBeNull()
  })

  it("puts the shop's own bot under its own heading, first", () => {
    render(<TelegramSection />)
    const shopHeading = screen.getByText("settings.telegram.group.shop.title")
    const assistantHeading = screen.getByText(
      "settings.telegram.group.assistant.title",
    )
    expect(
      shopHeading.compareDocumentPosition(assistantHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})

describe("TelegramSection — the pairing link", () => {
  it("mints nothing on mount", () => {
    render(<TelegramSection />)
    expect(connect).not.toHaveBeenCalled()
    expect(screen.queryByTestId("telegram-pairing-url")).toBeNull()
  })

  it("shows the link only after Connect is pressed", async () => {
    render(<TelegramSection />)
    fireEvent.click(screen.getByText("settings.telegram.vendorBot.connect"))

    await waitFor(() =>
      expect(
        screen.getByTestId("telegram-pairing-url").textContent,
      ).toContain("https://t.me/SellorrAI_bot?start=tok-abc"),
    )
    expect(connect).toHaveBeenCalledTimes(1)
    // The Connect button is gone while a live link is on screen — pressing it
    // again would mint a second token and orphan the one being shown.
    expect(
      screen.queryByText("settings.telegram.vendorBot.connect"),
    ).toBeNull()
  })

  it("shows consent above the button, not in a footnote", () => {
    render(<TelegramSection />)
    const consent = screen.getByText("settings.telegram.vendorBot.consent")
    const button = screen.getByText("settings.telegram.vendorBot.connect")
    expect(
      consent.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})

describe("TelegramSection — once linked", () => {
  it("names the account and says it answers about this store", () => {
    status = row({
      linked: true,
      telegram_username: "shahd",
      linked_at: "2026-09-02T00:00:00.000Z",
    })
    render(<TelegramSection />)
    expect(
      screen.getByText("settings.telegram.vendorBot.linkedAs"),
    ).toBeTruthy()
    // Stated rather than assumed: an answer about the wrong shop is the one
    // mistake a vendor would never think to check for.
    expect(
      screen.getByText("settings.telegram.vendorBot.answersHere"),
    ).toBeTruthy()
    expect(
      screen.queryByText("settings.telegram.vendorBot.connect"),
    ).toBeNull()
  })

  /**
   * `linked` is scoped to this store by `X-SHOP`, so a sibling store's binding
   * never reaches this screen. Before that, a vendor who paired one store saw
   * every other store's settings page report a connected assistant.
   */
  it("offers Connect on a store whose own binding does not exist", () => {
    status = row({ linked: false, telegram_username: null })
    render(<TelegramSection />)
    expect(
      screen.getByText("settings.telegram.vendorBot.connect"),
    ).toBeTruthy()
    expect(
      screen.queryByText("settings.telegram.vendorBot.answersHere"),
    ).toBeNull()
  })

  it("disconnects and refetches", async () => {
    status = row({ linked: true, telegram_username: "shahd" })
    render(<TelegramSection />)
    fireEvent.click(screen.getByText("settings.telegram.vendorBot.disconnect"))

    await waitFor(() => expect(disconnect).toHaveBeenCalledTimes(1))
    expect(refetch).toHaveBeenCalled()
  })

  it("always says the assistant is read-only", () => {
    status = row({ linked: true })
    render(<TelegramSection />)
    expect(
      screen.getByText("settings.telegram.vendorBot.readOnly"),
    ).toBeTruthy()
  })
})

describe("TelegramSection — the shop's bot, before connecting", () => {
  const connectButton = () =>
    screen
      .getByText("settings.telegram.shopBot.connect")
      .closest("button") as HTMLButtonElement

  it("mutates nothing on mount and shows the steps and the token field", () => {
    render(<TelegramSection />)
    expect(connectShop).not.toHaveBeenCalled()
    expect(screen.getByText("settings.telegram.shopBot.steps.one")).toBeTruthy()
    expect(screen.getByTestId("telegram-shop-token")).toBeTruthy()
  })

  it("keeps Connect disabled until the paste is shaped like a token", () => {
    // The server's DTO refuses anything else; refusing it here first means a
    // pasted `@username` or `t.me` link fails before a request leaves.
    render(<TelegramSection />)
    expect(connectButton().disabled).toBe(true)

    fireEvent.change(screen.getByTestId("telegram-shop-token"), {
      target: { value: "@AcmeShopBot" },
    })
    expect(connectButton().disabled).toBe(true)

    fireEvent.change(screen.getByTestId("telegram-shop-token"), {
      target: { value: VALID_TOKEN },
    })
    expect(connectButton().disabled).toBe(false)
  })

  it("sends the pasted token once, then clears the field and refetches", async () => {
    render(<TelegramSection />)
    const input = screen.getByTestId("telegram-shop-token") as HTMLInputElement
    fireEvent.change(input, { target: { value: `  ${VALID_TOKEN}  ` } })
    fireEvent.click(connectButton())

    await waitFor(() => expect(connectShop).toHaveBeenCalledTimes(1))
    expect(connectShop).toHaveBeenCalledWith({
      variables: { input: { bot_token: VALID_TOKEN } },
    })
    await waitFor(() => expect(input.value).toBe(""))
    expect(refetchShop).toHaveBeenCalled()
  })

  it("shows consent above the Connect button", () => {
    render(<TelegramSection />)
    const consent = screen.getByText("settings.telegram.shopBot.consent")
    expect(
      consent.compareDocumentPosition(connectButton()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })
})

describe("TelegramSection — the shop's bot, once connected", () => {
  beforeEach(() => {
    shop = shopRow({
      connected: true,
      bot_username: "AcmeShopBot",
      status: "active",
      last_ok_at: "2026-09-02T00:00:00.000Z",
    })
  })

  it("labels the handle as the store's own and hides the token field", () => {
    render(<TelegramSection />)
    expect(screen.getByText("settings.telegram.shopBot.botLabel")).toBeTruthy()
    expect(screen.getByText("@AcmeShopBot")).toBeTruthy()
    expect(screen.queryByTestId("telegram-shop-token")).toBeNull()
    // Never the token — the server does not return it, and the card has
    // nothing to show but the handle.
    expect(document.body.textContent).not.toContain(VALID_TOKEN)
  })

  it("keeps the inbox note, now pointing at the switch below it", () => {
    render(<TelegramSection />)
    expect(screen.getByText("settings.telegram.shopBot.inboxNote")).toBeTruthy()
  })

  it("asks before disconnecting, then disconnects and refetches", async () => {
    // Reconnecting needs the token again, which the merchant may not have to
    // hand — unlike the assistant card, where Connect re-links in a minute.
    render(<TelegramSection />)
    fireEvent.click(screen.getByText("settings.telegram.shopBot.disconnect"))
    expect(disconnectShop).not.toHaveBeenCalled()

    const confirm = await screen.findByText(
      "settings.telegram.shopBot.confirmDisconnect.confirm",
    )
    fireEvent.click(confirm)

    await waitFor(() => expect(disconnectShop).toHaveBeenCalledTimes(1))
    expect(refetchShop).toHaveBeenCalled()
  })
})

describe("TelegramSection — the shop's bot and the customer assistant", () => {
  const connectedRow = () =>
    shopRow({
      connected: true,
      bot_username: "AcmeShopBot",
      status: "active",
      last_ok_at: "2026-09-02T00:00:00.000Z",
    })

  it("offers no switch and no ask until a bot is connected", () => {
    // Nothing to answer on. Both the settled card and the question are
    // absent, not merely disabled — a control sitting there beside a token
    // field would read as something to configure before connecting.
    render(<TelegramSection />)
    expect(screen.queryByText("settings.telegram.shopBot.bot.title")).toBeNull()
    expect(
      screen.queryByText("settings.telegram.shopBot.bot.ask.title"),
    ).toBeNull()
    expect(screen.queryByRole("switch")).toBeNull()
  })

  it("leads with the ask while the assistant is off and unanswered", () => {
    shop = connectedRow()
    render(<TelegramSection />)
    expect(
      screen.getByText("settings.telegram.shopBot.bot.ask.title"),
    ).toBeTruthy()
    // Telegram's own copy, not WhatsApp's — "your number" is the wrong noun.
    expect(screen.queryByText("settings.whatsapp.bot.ask.title")).toBeNull()
    expect(screen.queryByRole("switch")).toBeNull()
  })

  it("turns on from the ask without a confirmation", async () => {
    shop = connectedRow()
    render(<TelegramSection />)

    fireEvent.click(screen.getByText("settings.telegram.shopBot.bot.ask.enable"))

    await waitFor(() => expect(setShopBot).toHaveBeenCalledTimes(1))
    expect(setShopBot).toHaveBeenCalledWith({ variables: { enabled: true } })
    await waitFor(() => expect(refetchShop).toHaveBeenCalled())
  })

  it("settles into a switch once the assistant is on", () => {
    shop = connectedRow()
    shop.ai_enabled = true
    render(<TelegramSection />)

    expect(
      screen.queryByText("settings.telegram.shopBot.bot.ask.title"),
    ).toBeNull()
    const sw = assistantSwitch()
    expect(sw.getAttribute("aria-checked")).toBe("true")
    expect(screen.getByText("settings.telegram.shopBot.bot.onBody")).toBeTruthy()
  })

  it("confirms before turning a live assistant off", async () => {
    shop = connectedRow()
    shop.ai_enabled = true
    render(<TelegramSection />)

    fireEvent.click(assistantSwitch())

    // The write waits on the dialog: the change is invisible from the
    // merchant's side, so they find out from a customer if it is wrong.
    expect(setShopBot).not.toHaveBeenCalled()
    expect(
      await screen.findByText("settings.telegram.shopBot.bot.confirmOff.title"),
    ).toBeTruthy()
    // And it leads with what keeps working, in the bot's terms.
    expect(
      screen.getByText("settings.telegram.shopBot.bot.confirmOff.keeps.received"),
    ).toBeTruthy()

    fireEvent.click(
      screen.getByText("settings.telegram.shopBot.bot.confirmOff.turnOff"),
    )
    await waitFor(() => expect(setShopBot).toHaveBeenCalledTimes(1))
    expect(setShopBot).toHaveBeenCalledWith({ variables: { enabled: false } })
  })
})

/**
 * The WhatsApp orders switch, on the bot: a second consent under a live
 * assistant, confirmed on the way on and never on the way off, reading the
 * bot's own copy.
 */
describe("TelegramSection — the shop's bot taking orders", () => {
  const liveRow = (over: Partial<ShopTelegramBot> = {}) =>
    shopRow({
      connected: true,
      bot_username: "AcmeShopBot",
      status: "active",
      ai_enabled: true,
      ...over,
    })

  it("is not offered while the assistant is off", () => {
    shop = liveRow({ ai_enabled: false })
    render(<TelegramSection />)
    expect(ordersSwitch()).toBeNull()
  })

  it("sits under a live assistant, off by default, in the bot's words", () => {
    shop = liveRow()
    render(<TelegramSection />)

    expect(ordersSwitch()?.getAttribute("aria-checked")).toBe("false")
    expect(
      screen.getByText("settings.telegram.shopBot.bot.orders.body"),
    ).toBeTruthy()
    expect(screen.queryByText("settings.whatsapp.bot.orders.body")).toBeNull()
  })

  it("asks before letting the assistant take orders", async () => {
    shop = liveRow()
    render(<TelegramSection />)

    fireEvent.click(ordersSwitch()!)

    expect(setShopOrders).not.toHaveBeenCalled()
    expect(
      screen.getByText("settings.telegram.shopBot.bot.orders.confirmOn.title"),
    ).toBeTruthy()
    fireEvent.click(
      screen.getByText("settings.telegram.shopBot.bot.orders.confirmOn.turnOn"),
    )
    await waitFor(() =>
      expect(setShopOrders).toHaveBeenCalledWith({
        variables: { enabled: true },
      }),
    )
    await waitFor(() => expect(refetchShop).toHaveBeenCalled())
  })

  it("turns off at once — the safe direction needs no dialog", async () => {
    shop = liveRow({ ai_orders_enabled: true })
    render(<TelegramSection />)

    fireEvent.click(ordersSwitch()!)

    await waitFor(() =>
      expect(setShopOrders).toHaveBeenCalledWith({
        variables: { enabled: false },
      }),
    )
    expect(
      screen.queryByText("settings.telegram.shopBot.bot.orders.confirmOn.title"),
    ).toBeNull()
  })

  it("cannot be turned on without the plan, and says why", () => {
    ordersAllowed = false
    shop = liveRow()
    render(<TelegramSection />)

    const sw = ordersSwitch()
    expect(
      sw?.hasAttribute("disabled") ||
        sw?.getAttribute("aria-disabled") === "true" ||
        sw?.hasAttribute("data-disabled"),
    ).toBe(true)
    expect(
      screen.getByText("settings.telegram.shopBot.bot.orders.notOnPlan"),
    ).toBeTruthy()
  })
})

describe("TelegramSection — the shop's bot, when Telegram refused the webhook", () => {
  beforeEach(() => {
    // A token Telegram accepted whose webhook it then refused. The row is kept
    // so the merchant reads *why* rather than "not connected".
    shop = shopRow({
      connected: false,
      bot_username: "AcmeShopBot",
      status: "disconnected",
      last_error: "bad webhook: HTTPS url must be provided",
    })
  })

  it("shows Telegram's reason and offers to connect again", () => {
    render(<TelegramSection />)

    const box = screen.getByTestId("telegram-shop-bot-error")
    expect(box.textContent).toContain("HTTPS url must be provided")
    expect(screen.getByText("settings.telegram.shopBot.errorHint")).toBeTruthy()
    expect(screen.getByText("settings.telegram.shopBot.reconnect")).toBeTruthy()
    expect(screen.getByTestId("telegram-shop-token")).toBeTruthy()
  })

  it("retries the registration from the saved token, without asking for it", async () => {
    render(<TelegramSection />)

    const retry = screen.getByTestId("telegram-shop-bot-retry") as HTMLButtonElement
    // Enabled with the token field empty — that field is the other way out.
    expect(retry.disabled).toBe(false)
    fireEvent.click(retry)

    await waitFor(() => expect(syncShop).toHaveBeenCalledTimes(1))
    expect(connectShop).not.toHaveBeenCalled()
    expect(refetchShop).toHaveBeenCalled()
  })

  it("offers no retry when there is no refused row to retry", () => {
    shop = shopRow()
    render(<TelegramSection />)
    expect(screen.queryByTestId("telegram-shop-bot-retry")).toBeNull()
  })

  it("offers no assistant switch beside a refused webhook", () => {
    render(<TelegramSection />)
    expect(screen.queryByText("settings.telegram.shopBot.bot.title")).toBeNull()
    expect(screen.queryByRole("switch")).toBeNull()
  })
})
