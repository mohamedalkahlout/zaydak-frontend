import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type {
  ProviderAccount,
  ProviderCatalogEntry,
  ShopShippingSettings,
} from "../../../providers-types"

/**
 * Whether the merchant can reach the form they are being told to fill in.
 *
 * **The bug this pins.** The carrier cards were gated on the SAVED
 * `offers_carrier_delivery`, while the switch that sets it stages locally
 * behind the global save bar like every other edit in this app. So flipping
 * "Shipping companies" on produced a switch that read ON, a warning saying no
 * carrier prices would appear until an account was connected, and **no account
 * form anywhere on the screen** — it stayed hidden until Save was pressed, and
 * nothing said so. The merchant's next step was invisible at exactly the
 * moment they went looking for it.
 *
 * **And its mirror.** Gating purely on the channel also meant turning the
 * switch back off hid credentials that were already stored, so a merchant
 * could neither rotate nor delete them without switching the channel on again.
 * The switch is about what CUSTOMERS are offered; it should not hide a
 * connected account.
 *
 * The dependent cards (which carriers, which warehouses) are a separate gate
 * and stay behind enabled AND verified — the same rule the server enforces at
 * booking time — because neither question can be answered before the account
 * exists.
 *
 * Boundaries are mocked rather than provided (the repo's component-test
 * convention); translations return their key. No jest-dom — assertions use
 * plain DOM properties.
 */

function opName(doc: any): string {
  return doc?.definitions?.[0]?.name?.value ?? ""
}

let settings: ShopShippingSettings
let accounts: ProviderAccount[]
let catalog: ProviderCatalogEntry[]

const settingsRow = (
  over: Partial<ShopShippingSettings> = {},
): ShopShippingSettings =>
  ({
    mode: "SHIPPING_PROVIDER",
    provider_ready: false,
    // Whether this shop has a usable carrier — enabled AND verified. Separate
    // from `provider_ready`, which is always true for a merchant-managed shop
    // and therefore says nothing about the carrier behind it: the whole reason
    // the server returns both.
    carrier_available: false,
    offers_merchant_delivery: true,
    offers_carrier_delivery: false,
    default_item_weight_grams: 500,
    active_provider_slug: null,
    ...over,
  }) as ShopShippingSettings

const accountRow = (over: Partial<ProviderAccount> = {}): ProviderAccount =>
  ({
    id: "spa_1",
    provider: "oto",
    is_enabled: false,
    is_sandbox: true,
    last_verified_at: null,
    last_verify_error: null,
    masked_credentials: [{ key: "refresh_token", value: "••••9U2x" }],
    created_at: "2026-09-05T09:00:00.000Z",
    updated_at: "2026-09-05T09:00:00.000Z",
    ...over,
  }) as ProviderAccount

const otoSpec = (): ProviderCatalogEntry =>
  ({
    provider: "oto",
    name: "OTO",
    name_ar: "أوتو",
    description: "Carrier aggregator",
    description_ar: "",
    fields: [
      {
        key: "refresh_token",
        label: "Refresh token",
        label_ar: "",
        type: "password",
        required: true,
        secret: true,
        help: "From your OTO dashboard.",
        help_ar: "",
      },
    ],
    requires_location_mapping: true,
    supports_sandbox: true,
  }) as ProviderCatalogEntry

/*
  Apollo hands back a STABLE data reference across renders — it comes out of the
  cache — and both this section and the channels card depend on that: each
  re-seeds its staged state by comparing `settings` BY IDENTITY. A mock that
  built a fresh object every call would change identity on every render and the
  re-seed would never stop, so these are built once per test and handed back
  unchanged.
*/
let settingsResult: unknown
let catalogResult: unknown
let accountsResult: unknown

vi.mock("@apollo/client/react", () => ({
  useSuspenseQuery: () => settingsResult,
  useQuery: (doc: any) =>
    opName(doc) === "ShippingProviderCatalog" ? catalogResult : accountsResult,
  useMutation: () => [vi.fn(() => Promise.resolve({ data: {} })), { loading: false }],
  useApolloClient: () => ({ refetchQueries: vi.fn() }),
}))

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("sileo", () => ({ sileo: { success: vi.fn(), error: vi.fn() } }))

/*
  The two dependent cards are stubbed, not exercised. They run queries of their
  own, and this file is about ONE decision: which cards this section renders,
  and when. Their own behaviour belongs to their own tests.
*/
vi.mock("../carrier-selection-card", () => ({
  CarrierSelectionCard: () => <div data-testid="carrier-selection" />,
}))
vi.mock("../carrier-pickup-card", () => ({
  CarrierPickupCard: () => <div data-testid="carrier-pickup" />,
}))

vi.mock("@/shared/stores/unsaved-bar", () => ({
  useUnsavedBarStore: (selector: any) =>
    selector({ show: vi.fn(), hide: vi.fn(), setError: vi.fn() }),
}))

const { ShippingProvidersSection } = await import(
  "../shipping-providers-section"
)

/** The switch the merchant flips. `ChannelRow` gives it an `aria-label`. */
const carrierSwitch = () => screen.getByLabelText("Shipping companies")

const accountFormShown = () =>
  screen.queryAllByText("Refresh token").length > 0

/** Freeze the current fixtures into the stable results the mock returns. */
function commit() {
  settingsResult = {
    data: { shopShippingSettings: { success: true, data: settings } },
  }
  catalogResult = {
    data: { shippingProviderCatalog: { success: true, data: catalog } },
    loading: false,
  }
  accountsResult = {
    data: { shippingProviderAccounts: { success: true, data: accounts } },
    loading: false,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  settings = settingsRow()
  accounts = []
  catalog = [otoSpec()]
  commit()
})

describe("ShippingProvidersSection — reaching the account form", () => {
  it("hides the account form for a shop offering neither carrier delivery nor an account", () => {
    commit()
    render(<ShippingProvidersSection />)
    expect(accountFormShown()).toBe(false)
  })

  /**
   * The regression. Staging, not saving, is what the switch does — so the form
   * has to appear on the flip, not on the save.
   */
  it("reveals the account form the moment the carrier switch is flipped on, before saving", () => {
    commit()
    render(<ShippingProvidersSection />)
    expect(accountFormShown()).toBe(false)

    fireEvent.click(carrierSwitch())

    expect(accountFormShown()).toBe(true)
  })

  it("shows it immediately when the shop already offers carrier delivery", () => {
    settings = settingsRow({ offers_carrier_delivery: true })
    commit()
    render(<ShippingProvidersSection />)
    expect(accountFormShown()).toBe(true)
  })

  /**
   * The mirror bug: an account already stored must stay reachable when the
   * channel is off, or a merchant cannot rotate or delete the credentials they
   * have already given us.
   */
  it("keeps a stored account visible even with carrier delivery switched off", () => {
    settings = settingsRow({ offers_carrier_delivery: false })
    accounts = [accountRow()]

    commit()
    render(<ShippingProvidersSection />)

    expect(accountFormShown()).toBe(true)
  })
})

describe("ShippingProvidersSection — the dependent cards", () => {
  // Connect → verify → which carriers → which warehouses. Neither later
  // question can be answered before the account exists, and showing them early
  // offers an empty carrier list and a register button that fails.
  it("withholds them while the account is connected but unverified", () => {
    settings = settingsRow({ offers_carrier_delivery: true })
    accounts = [accountRow({ is_enabled: true, last_verified_at: null })]

    commit()
    render(<ShippingProvidersSection />)

    expect(
      screen.getByText(
        "Connect and verify a carrier account above to choose carriers and register your warehouses.",
      ),
    ).toBeTruthy()
  })

  it("stops naming the blocker once the account is enabled and verified", () => {
    settings = settingsRow({
      offers_carrier_delivery: true,
      provider_ready: true,
      carrier_available: true,
    })
    accounts = [
      accountRow({
        is_enabled: true,
        last_verified_at: "2026-09-05T10:00:00.000Z",
      }),
    ]

    commit()
    render(<ShippingProvidersSection />)

    expect(
      screen.queryByText(
        "Connect and verify a carrier account above to choose carriers and register your warehouses.",
      ),
    ).toBeNull()
  })
})

/**
 * The two warnings are mirrors, and the second one was missing.
 *
 * A shop reached production with a verified account, a warehouse registered at
 * OTO, stock in it and every carrier allowed — and no carrier prices at
 * checkout, because the channel switch had never been saved. Every signal on
 * the screen said the setup was finished; the merchant would have found out
 * from a customer.
 */
describe("ShippingProvidersSection — saying why customers see nothing", () => {
  const readyAccount = () =>
    accountRow({
      is_enabled: true,
      last_verified_at: "2026-09-05T10:36:00.000Z",
    })

  /** What the server returns beside a usable account of the shop's own. */
  const readySettings = (): Partial<ShopShippingSettings> => ({
    provider_ready: true,
    carrier_available: true,
  })

  const connectedButOff = () =>
    screen.queryByText(/connected and verified, but shipping/i)

  const notConnectedYet = () =>
    screen.queryByText(/until you connect your own OTO account/i)

  it("says so when the account is ready but the channel is off", () => {
    settings = settingsRow({ ...readySettings(), offers_carrier_delivery: false })
    accounts = [readyAccount()]

    commit()
    render(<ShippingProvidersSection />)

    expect(connectedButOff()).toBeTruthy()
  })

  // The state the merchant is heading for. Both warnings at once would be
  // noise, and the second would be wrong.
  it("drops it the moment the switch is turned on", () => {
    settings = settingsRow({ ...readySettings(), offers_carrier_delivery: false })
    accounts = [readyAccount()]

    commit()
    render(<ShippingProvidersSection />)
    expect(connectedButOff()).toBeTruthy()

    fireEvent.click(carrierSwitch())

    expect(connectedButOff()).toBeNull()
  })

  /**
   * The false positive this was built to avoid.
   *
   * `settings.provider_ready` is always `true` for a merchant-managed shop, so
   * reading that instead would have shown this warning to every shop that
   * simply delivers its own orders and has no carrier account at all. The
   * field that answers the real question is `carrier_available`, which ignores
   * the mode.
   */
  it("stays silent for a shop with no carrier account", () => {
    settings = settingsRow({
      mode: "MERCHANT_MANAGED",
      // True for every merchant-managed shop, and the exact false positive
      // this test exists for: reading it instead of `carrier_available` would
      // show the warning to every shop that simply delivers its own orders.
      provider_ready: true,
      carrier_available: false,
      offers_carrier_delivery: false,
    })
    accounts = []

    commit()
    render(<ShippingProvidersSection />)

    expect(connectedButOff()).toBeNull()
  })

  // Connected is not the same as usable. An account saved but never verified
  // fails at the carrier on the first real parcel.
  it("stays silent when the account exists but was never verified", () => {
    settings = settingsRow({ offers_carrier_delivery: false })
    accounts = [accountRow({ is_enabled: true, last_verified_at: null })]

    commit()
    render(<ShippingProvidersSection />)

    expect(connectedButOff()).toBeNull()
  })

  // The original warning, the other way round: the switch promises something
  // this shop cannot do yet, and the fix is one card below.
  it("names the merchant's own next step when the channel is on and nothing is connected", () => {
    settings = settingsRow({
      offers_carrier_delivery: true,
      provider_ready: false,
    })
    accounts = []

    commit()
    render(<ShippingProvidersSection />)

    expect(notConnectedYet()).toBeTruthy()
    expect(connectedButOff()).toBeNull()
  })
})
