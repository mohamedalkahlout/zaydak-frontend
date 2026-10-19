import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { WhatsAppInstance } from "../../types";

/**
 * The screen's job is to be unambiguous about two things a merchant can get
 * badly wrong, and these tests pin exactly those.
 *
 * **Which number is which.** Two WhatsApp numbers live on this page: the shop's
 * own, which customers write to, and Zaydak's, which the vendor writes to. A
 * merchant who conflates them hands a customer the wrong number, so the two
 * headings and the "you do not connect this number" line are load-bearing
 * copy, not decoration.
 *
 * **Whether an assistant is answering.** Pairing must never switch the bot on
 * by itself — the failure mode is a merchant learning about it from a customer
 * who got a reply they never wrote — so a freshly connected number shows the
 * ask, not a settled switch, and turning a live switch *off* is confirmed
 * while turning it on is not.
 *
 * Boundaries are mocked rather than provided (the repo's component-test
 * convention); translations return their key, so assertions read as keys.
 */

const refetch = vi.fn(() => Promise.resolve({ data: {} }));
const connect = vi.fn(() =>
  Promise.resolve({
    data: {
      connectWhatsApp: {
        success: true,
        data: {
          status: "connecting",
          qr_code: "data:image/png;base64,AA",
          pairing_code: null,
        },
      },
    },
  }),
);
const setBot = vi.fn(() =>
  Promise.resolve({ data: { setWhatsAppCustomerBot: { success: true } } }),
);
const setOrders = vi.fn(() =>
  Promise.resolve({
    data: { setWhatsAppCustomerBotOrders: { success: true } },
  }),
);
/** Whether the shop's plan includes `ai.agent.checkout`. */
let ordersAllowed = true;

let available = true;
let instance: WhatsAppInstance | null = null;
/** The platform assistant, read by the vendor-bot card through its own query. */
let vendorBot: unknown = {
  available: true,
  bot_number: "+970599000111",
  link: null,
};

const row = (over: Partial<WhatsAppInstance> = {}): WhatsAppInstance => ({
  status: "connected",
  phone_number: "97******99",
  last_connected_at: "2026-08-20T10:00:00.000Z",
  disconnected_at: null,
  last_error: null,
  ai_enabled: false,
  ai_orders_enabled: false,
  ...over,
});

/** Operation name off a gql document, so each fn is keyed to its mutation. */
function opName(doc: any): string {
  return doc?.definitions?.[0]?.name?.value ?? "";
}

vi.mock("@apollo/client/react", () => ({
  useQuery: (doc: any) => {
    if (opName(doc) === "MyVendorBot") {
      return {
        data: { myVendorBot: { success: true, data: vendorBot } },
        loading: false,
      };
    }
    return {
      data: {
        myWhatsAppInstance: { success: true, data: { available, instance } },
      },
      loading: false,
      refetch,
    };
  },
  useMutation: (doc: any) => {
    const name = opName(doc);
    if (name === "ConnectWhatsApp") return [connect, { loading: false }];
    if (name === "SetWhatsAppCustomerBot") return [setBot, { loading: false }];
    if (name === "SetWhatsAppCustomerBotOrders")
      return [setOrders, { loading: false }];
    return [vi.fn(() => Promise.resolve({ data: {} })), { loading: false }];
  },
  useApolloClient: () => ({ mutate: vi.fn() }),
}));

vi.mock("next-intl", () => ({
  useTranslations: (ns?: string) => (key: string) =>
    ns ? `${ns}.${key}` : key,
  useFormatter: () => ({
    dateTime: () => "20 Aug 2026",
    relativeTime: () => "just now",
  }),
  useNow: () => new Date("2026-08-20T00:00:00.000Z"),
  useLocale: () => "en",
}));

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }));

// The plan gate reads its own two queries; what matters here is its answer.
vi.mock("@/features/plan/lib/use-feature", () => ({
  useFeature: () => ({ allowed: ordersAllowed, loading: false }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt, ...rest }: any) => <img alt={alt} {...rest} />,
}));

vi.mock("@/shared/stores/active-shop", () => ({
  useActiveShopStore: (sel: any) => sel({ slug: "acme" }),
}));

// The SSE hook opens an EventSource; the screen's behaviour under test is what
// it renders, not what it subscribes to.
vi.mock("../../use-whatsapp-qr-stream", () => ({
  useWhatsAppQrStream: () => undefined,
}));

const { WhatsAppSection } = await import("../whatsapp-section");

beforeEach(() => {
  vi.clearAllMocks();
  available = true;
  instance = null;
  ordersAllowed = true;
  vendorBot = { available: true, bot_number: "+970599000111", link: null };
});

/**
 * The two switches, by position: the assistant's sits in the card header and
 * the orders switch below it, only while the assistant is on. (Base UI names a
 * switch after its wrapping label, which carries the on/off word.)
 */
const assistantSwitch = () => screen.getAllByRole("switch")[0]
const ordersSwitch = (): HTMLElement | null =>
  screen.queryAllByRole("switch")[1] ?? null

describe("WhatsAppSection — the two numbers", () => {
  it("keeps the shop's number and Zaydak's under separate headings", () => {
    instance = row();
    render(<WhatsAppSection />);

    expect(
      screen.getByText("settings.whatsapp.group.store.title"),
    ).toBeTruthy();
    expect(
      screen.getByText("settings.whatsapp.group.assistant.title"),
    ).toBeTruthy();
  });

  it("says the vendor does not pair the platform number", () => {
    instance = row();
    render(<WhatsAppSection />);

    // The line that stops a merchant hunting for a second QR. Matched on the
    // paragraph's whole text, because it carries the read-only note beside it
    // — and scoped to `P`, or every ancestor up to `<body>` matches too.
    expect(
      screen.getByText(
        (_, el) =>
          el?.tagName === "P" &&
          (el.textContent ?? "").includes(
            "settings.whatsapp.vendorBot.noPairing",
          ),
      ),
    ).toBeTruthy();
  });

  /**
   * The bug this pins, reported on a store created minutes earlier: the
   * assistant card showed a green "Connected" pill on a store nothing had been
   * connected to.
   *
   * Two facts were being rendered as one. `available` is *the platform paired
   * its own number*, which is true for every vendor the moment an admin does
   * it; `link` is *a handset is enrolled for this store*. The pill read the
   * first — directly beneath a card where the same word means "your customers
   * can reach you".
   */
  it("does not call the assistant connected just because the platform is up", () => {
    instance = row();
    vendorBot = {
      available: true,
      bot_number: "+970599000111",
      link: null,
    };
    render(<WhatsAppSection />);

    expect(
      screen.getByText("settings.whatsapp.vendorBot.pill.unlinked"),
    ).toBeTruthy();
    expect(
      screen.queryByText("settings.whatsapp.vendorBot.pill.linked"),
    ).toBeNull();
    // And no phone is claimed to be enrolled, because none is.
    expect(screen.queryByText("settings.whatsapp.vendorBot.linked")).toBeNull();
  });

  it("reports connected once a handset is enrolled for this store", () => {
    instance = row();
    vendorBot = {
      available: true,
      bot_number: "+970599000111",
      link: {
        id: "link-1",
        phone_masked: "+97*******08",
        verified: true,
        last_message_at: null,
        created_at: "2026-09-04T16:39:05.000Z",
      },
    };
    render(<WhatsAppSection />);

    expect(
      screen.getByText("settings.whatsapp.vendorBot.pill.linked"),
    ).toBeTruthy();
    expect(screen.getByText("settings.whatsapp.vendorBot.linked")).toBeTruthy();
    // It answers about this store and says so. The query is scoped by X-SHOP,
    // so a sibling store's handset never arrives here to be mistaken for this
    // one's.
    expect(
      screen.getByText("settings.whatsapp.vendorBot.answersHere"),
    ).toBeTruthy();
  });

  it("says unavailable when the platform has no assistant number", () => {
    instance = row();
    vendorBot = { available: false, bot_number: null, link: null };
    render(<WhatsAppSection />);

    // Not the vendor's fault and not theirs to fix, so it outranks "not
    // connected": connecting is not the action that would help.
    expect(
      screen.getByText("settings.whatsapp.vendorBot.pill.unavailable"),
    ).toBeTruthy();
  });

  it("offers no connect control on the platform card", () => {
    instance = row();
    render(<WhatsAppSection />);

    // Connect belongs to the shop's card alone. A second one here would be
    // offering to pair a session the platform owns.
    expect(
      screen.queryAllByText("settings.whatsapp.action.connect"),
    ).toHaveLength(0);
  });
});

describe("WhatsAppSection — connection states", () => {
  it("teaches rather than reports when nothing has been connected", () => {
    instance = null;
    render(<WhatsAppSection />);

    expect(screen.getByText("settings.whatsapp.empty.title")).toBeTruthy();
    expect(
      screen.getByText("settings.whatsapp.empty.facts.oneNumber"),
    ).toBeTruthy();
    // Consent is on screen before the button that mints a code.
    expect(screen.getByText("settings.whatsapp.consent.title")).toBeTruthy();
  });

  it("states the platform's own gap instead of a button that would fail", () => {
    available = false;
    instance = null;
    render(<WhatsAppSection />);

    expect(
      screen.getByText("settings.whatsapp.state.unavailable.body"),
    ).toBeTruthy();
    expect(screen.queryByText("settings.whatsapp.action.connect")).toBeNull();
  });

  it("treats a dropped session as routine, with a way back", () => {
    instance = row({
      status: "disconnected",
      disconnected_at: "2026-08-25T10:00:00.000Z",
    });
    render(<WhatsAppSection />);

    expect(
      screen.getByText("settings.whatsapp.state.disconnected.label"),
    ).toBeTruthy();
    expect(screen.getByText("settings.whatsapp.action.reconnect")).toBeTruthy();
    // Not a failure: the error state's label must not be what a flat phone shows.
    expect(
      screen.queryByText("settings.whatsapp.state.error.label"),
    ).toBeNull();
  });

  it("separates a failed attempt from a routine drop, and shows the reason", () => {
    instance = row({
      status: "disconnected",
      disconnected_at: "2026-08-25T10:00:00.000Z",
      last_error: "Device limit reached",
    });
    render(<WhatsAppSection />);

    expect(
      screen.getByText("settings.whatsapp.state.error.label"),
    ).toBeTruthy();
    // The provider's own words, so a merchant can fix it without support.
    expect(screen.getByText("Device limit reached")).toBeTruthy();
  });

  it("mints no code until the button is pressed", () => {
    instance = null;
    render(<WhatsAppSection />);

    expect(connect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("settings.whatsapp.action.connect"));
    expect(connect).toHaveBeenCalledTimes(1);
  });
});

describe("WhatsAppSection — the customer assistant", () => {
  it("asks rather than assuming, on a number that has just connected", () => {
    instance = row({ ai_enabled: false });
    render(<WhatsAppSection />);

    expect(screen.getByText("settings.whatsapp.bot.ask.title")).toBeTruthy();
    // No settled switch while the question is open: a control already in a
    // position is an answer nobody gave.
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("does not offer the assistant beside a session that cannot run it", () => {
    instance = row({
      status: "disconnected",
      disconnected_at: "2026-08-25T10:00:00.000Z",
    });
    render(<WhatsAppSection />);

    expect(screen.queryByText("settings.whatsapp.bot.title")).toBeNull();
  });

  it("settles into a switch once the merchant has answered", () => {
    instance = row({ ai_enabled: true });
    render(<WhatsAppSection />);

    expect(screen.queryByText("settings.whatsapp.bot.ask.title")).toBeNull();
    expect(assistantSwitch()).toBeTruthy();
    expect(screen.getByText("settings.whatsapp.bot.onBody")).toBeTruthy();
  });

  it("turns on without a confirmation — the ask was the confirmation", () => {
    instance = row({ ai_enabled: false });
    render(<WhatsAppSection />);

    fireEvent.click(screen.getByText("settings.whatsapp.bot.ask.enable"));
    expect(setBot).toHaveBeenCalledWith({ variables: { enabled: true } });
  });

  it("confirms before turning a live assistant off", () => {
    instance = row({ ai_enabled: true });
    render(<WhatsAppSection />);

    fireEvent.click(assistantSwitch());

    // The write waits on the dialog: the change is invisible from the
    // merchant's side, so they find out from a customer if it is wrong.
    expect(setBot).not.toHaveBeenCalled();
    expect(
      screen.getByText("settings.whatsapp.bot.confirmOff.title"),
    ).toBeTruthy();
    // And it leads with what keeps working, not with what stops.
    expect(
      screen.getByText("settings.whatsapp.bot.confirmOff.keeps.received"),
    ).toBeTruthy();
  });
});

/**
 * Taking orders is a second consent under the first: something other than the
 * merchant placing orders in their store. So it exists only under a live
 * assistant, turning it on is confirmed, turning it off never is, and a plan
 * without the capability can turn it off but not on.
 */
describe("WhatsAppSection — orders in the chat", () => {
  it("is not offered while the assistant is off or undecided", () => {
    instance = row({ ai_enabled: false });
    render(<WhatsAppSection />);
    expect(ordersSwitch()).toBeNull();
  });

  it("sits under a live assistant, off by default", () => {
    instance = row({ ai_enabled: true });
    render(<WhatsAppSection />);

    const toggle = ordersSwitch();
    expect(toggle).toBeTruthy();
    expect(toggle?.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText("settings.whatsapp.bot.orders.body")).toBeTruthy();
  });

  it("asks before letting the assistant take orders", () => {
    instance = row({ ai_enabled: true });
    render(<WhatsAppSection />);

    fireEvent.click(ordersSwitch()!);

    expect(setOrders).not.toHaveBeenCalled();
    expect(
      screen.getByText("settings.whatsapp.bot.orders.confirmOn.title"),
    ).toBeTruthy();
    // Cash on delivery, said in so many words.
    expect(
      screen.getByText("settings.whatsapp.bot.orders.confirmOn.points.cod"),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByText("settings.whatsapp.bot.orders.confirmOn.turnOn"),
    );
    expect(setOrders).toHaveBeenCalledWith({ variables: { enabled: true } });
  });

  it("turns off at once — the safe direction needs no dialog", () => {
    instance = row({ ai_enabled: true, ai_orders_enabled: true });
    render(<WhatsAppSection />);

    fireEvent.click(ordersSwitch()!);

    expect(setOrders).toHaveBeenCalledWith({ variables: { enabled: false } });
    expect(
      screen.queryByText("settings.whatsapp.bot.orders.confirmOn.title"),
    ).toBeNull();
  });

  it("cannot be turned on without the plan, and says why", () => {
    ordersAllowed = false;
    instance = row({ ai_enabled: true });
    render(<WhatsAppSection />);

    expect(ordersSwitch()?.hasAttribute("disabled") ||
      ordersSwitch()?.getAttribute("aria-disabled") === "true" ||
      ordersSwitch()?.hasAttribute("data-disabled")).toBe(true);
    expect(
      screen.getByText("settings.whatsapp.bot.orders.notOnPlan"),
    ).toBeTruthy();
  });

  it("can still be turned off after the plan lost it", () => {
    ordersAllowed = false;
    instance = row({ ai_enabled: true, ai_orders_enabled: true });
    render(<WhatsAppSection />);

    fireEvent.click(ordersSwitch()!);

    expect(setOrders).toHaveBeenCalledWith({ variables: { enabled: false } });
  });
});
