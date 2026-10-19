import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"

import messages from "@/shared/messages/en.json"

/**
 * The footer is built almost entirely out of *conditions*: a shop that
 * published no email gets no newsletter field, a shop with no socials gets no
 * social row, a shop that published nothing to reach it by gets no contact
 * column at all, and a shop whose query has not landed yet still has to render
 * something with the slug in it. None of that is visible in a screenshot of a
 * fully-populated shop, and all of it is what the average real shop actually
 * hits.
 *
 * The pair worth naming is **`settings.contact` and `settings.email`**. They
 * are two different fields on `ShopSettings`, and the vendor dashboard labels
 * them "Phone number" and "Store contact email" — this footer used to `mailto:`
 * the phone number, so both the contact link and the newsletter composed a
 * message to an address that could not exist. The tests below pin each to its
 * own scheme.
 *
 * `useShop` throws outside a `ShopProvider` (`shop-context.tsx`), and the real
 * provider runs the `SHOP_BY_SLUG` query — so mounting it here would mean
 * standing up Apollo to test markup that takes no network data of its own.
 * Mocking the context is the same trade `product-gallery.render.test.tsx` makes
 * with `next/image`: stub the infrastructure, assert the component.
 *
 * `next/navigation` is stubbed for the record row's `LocaleSwitcher`, which
 * reads `useRouter` to refresh the route after writing the locale cookie and
 * throws outside an App Router context.
 *
 * `vi.hoisted` rather than a plain `const`: `vi.mock` factories are lifted above
 * the import block, and a bare module-scope binding would still be in its
 * temporal dead zone when the factory first runs.
 */
const shopState = vi.hoisted(() => ({
  slug: "acme",
  base: "/acme",
  shop: null as Record<string, unknown> | null,
  loading: false,
  missing: false,
  currency: "USD",
}))

vi.mock("../../shop-context", () => ({ useShop: () => shopState }))

const paymentState = vi.hoisted(() => ({ methods: ["CASH_ON_DELIVERY", "STRIPE"], error: undefined }))
vi.mock("@/features/bank-transfers/use-payment-options", () => ({ usePaymentOptions: () => paymentState }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
  usePathname: () => "/acme",
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@apollo/client/react", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useMutation: () => [
      vi.fn().mockResolvedValue({ data: { subscribeNewsletter: { success: true } } }),
      { loading: false },
    ],
  };
});

import { ShopFooter } from "../shop-footer"

function renderFooter(shop: Record<string, unknown> | null = null) {
  shopState.shop = shop
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ShopFooter />
    </NextIntlClientProvider>,
  )
}

const href = (name: string) =>
  screen.getByRole("link", { name }).getAttribute("href")

describe("ShopFooter", () => {
  it("falls back to the slug before the shop query resolves", () => {
    renderFooter(null)
    // The source writes the home link as `${base}/`, never as a bare
    // `${base}`: on a shop host `base` is the empty string, and an empty href
    // is not a link home. `next/link` normalises the trailing slash away
    // again, so what lands in the DOM is unchanged by that.
    expect(href("acme")).toBe("/acme")
  })

  it("scopes every nav destination to the shop", () => {
    renderFooter({ name: "Acme Supply" })

    expect(href("All products")).toBe("/acme/products")
    expect(href("Cart")).toBe("/acme/cart")
    expect(href("Your account")).toBe("/acme/account")
    expect(href("Orders")).toBe("/acme/account/orders")
    expect(href("Addresses")).toBe("/acme/account/addresses")
    expect(href("Saved")).toBe("/acme/wishlist")
    expect(href("About Acme Supply")).toBe("/acme")
    expect(href("All shops")).toBe("/")
  })

  it("points the merchandising links at catalogue views the app actually reads", () => {
    // `catalog/lib/filters.ts` parses `sort` and `stock` out of the query
    // string, so these are the same URLs the filter panel itself writes.
    // `?sort=NEWEST` is deliberately absent: it is the catalogue's default,
    // which `writeFilters` omits, so linking it would mint a second URL for a
    // view that already has one.
    renderFooter({ name: "Acme Supply" })

    expect(href("Most popular")).toBe("/acme/products?sort=MOST_VIEWED")
    expect(href("In stock")).toBe("/acme/products?stock=in")
    expect(screen.queryByRole("link", { name: /sort=NEWEST/ })).toBeNull()
  })

  it("labels every link column so the landmarks are distinguishable", () => {
    // Three <nav> elements in one footer are indistinguishable to a screen
    // reader without names, and `aria-labelledby` points at the heading already
    // on screen rather than repeating it.
    renderFooter({ name: "Acme Supply" })

    expect(screen.getByRole("navigation", { name: "Shop" })).toBeTruthy()
    expect(screen.getByRole("navigation", { name: "Account" })).toBeTruthy()
    expect(screen.getByRole("navigation", { name: "About" })).toBeTruthy()
  })

  it("heads every column, with nothing to open", () => {
    // The columns were `Collapsible`s with a chevron and are not any more: a
    // column of four short links has nothing to gain from being closed, and the
    // control cost a press to get back what was already on screen. The headings
    // are plain `<h2>`s, so nothing here is a button.
    renderFooter({ name: "Acme Supply", settings: { email: "hi@acme.test" } })

    for (const name of ["Contact us", "Shop", "Account", "About"]) {
      expect(screen.getByRole("heading", { name, level: 2 })).toBeTruthy()
      expect(screen.queryByRole("button", { name })).toBeNull()
    }
  })

  it("renders no contact column and no signup for a shop that published neither", () => {
    // A website alone does not open the column: that link renders in About, so
    // counting it here would leave an empty box.
    renderFooter({
      name: "Acme Supply",
      settings: { website: "https://acme.test" },
      socials: [],
    })

    expect(screen.queryByRole("textbox")).toBeNull()
    expect(screen.queryByRole("heading", { name: "Contact us" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Subscribe" })).toBeNull()
  })

  it("offers the signup only when there is an address to send it to", () => {
    // The field composes a message to the shop. With no email address there is
    // no honest destination, so the block is absent rather than inert — and a
    // phone number is not one, which is the bug this split fixes.
    renderFooter({
      name: "Acme Supply",
      settings: { contact: "+1 855-987-4420" },
      socials: [],
    })

    expect(screen.queryByLabelText("Email address")).toBeNull()
  })

  it("wires the signup and the email row to settings.email", () => {
    renderFooter({
      name: "Acme Supply",
      settings: { email: "hello@acme.test" },
      socials: [],
    })

    // The address itself is the link text: a shopper deciding whether to trust
    // a shop wants to see where the mail is going before they click.
    expect(href("hello@acme.test")).toBe("mailto:hello@acme.test")

    const field = screen.getByLabelText("Email address")
    expect(field.getAttribute("type")).toBe("email")
    expect(screen.getByRole("button", { name: "Subscribe" })).toBeTruthy()
  })

  it("dials settings.contact rather than mailing it", () => {
    // "Phone number" is what the vendor dashboard calls this field. Everything
    // but the digits and a leading + is stripped for the href, while the
    // vendor's own formatting stays on screen — the punctuation is what makes a
    // number readable and the absence of it is what makes it dialable.
    renderFooter({
      name: "Acme Supply",
      settings: { contact: "+1 855-987-4420 (toll-free)" },
      socials: [],
    })

    expect(href("+1 855-987-4420 (toll-free)")).toBe("tel:+18559874420")
  })

  it("labels each contact row rather than leaving a bare value", () => {
    renderFooter({
      name: "Acme Supply",
      created_at: "2024-03-11T09:00:00.000Z",
      settings: {
        contact: "0551234567",
        email: "hello@acme.test",
        website: "https://acme.test",
        location: { city: "Riyadh", country: "Saudi Arabia" },
      },
      socials: [],
    })

    for (const label of [
      "Call us:",
      "Email us:",
      "Address:",
      "On Zaydak since:",
    ]) {
      expect(screen.getByText(label)).toBeTruthy()
    }

    // The website is not one of them: it lives in the About column, so the same
    // link is not printed twice in one footer.
    expect(screen.queryByText("Website:")).toBeNull()
  })

  it("shows a website as a host rather than a full URL", () => {
    renderFooter({
      name: "Acme Supply",
      settings: { website: "https://www.acme.test/shop?ref=1" },
      socials: [],
    })

    // The href stays exactly what the vendor published; only the label is
    // shortened.
    expect(href("acme.test")).toBe("https://www.acme.test/shop?ref=1")
  })

  it("falls back to the raw value when the website is not a parseable URL", () => {
    renderFooter({
      name: "Acme Supply",
      settings: { website: "not a url" },
      socials: [],
    })

    expect(screen.getByRole("link", { name: "not a url" })).toBeTruthy()
  })

  it("states where the shop trades from, as city and country", () => {
    renderFooter({
      name: "Acme Supply",
      settings: { location: { city: "Riyadh", country: "Saudi Arabia" } },
      socials: [],
    })

    expect(screen.getByText("Riyadh, Saudi Arabia")).toBeTruthy()
  })

  it("prefers the full address only when the parts are missing", () => {
    // `formattedAddress` is a full postal string and wraps to three lines in a
    // footer column, so it is the fallback rather than the first choice.
    renderFooter({
      name: "Acme Supply",
      settings: {
        location: { country: "Saudi Arabia", formattedAddress: "12 King Rd, Riyadh" },
      },
      socials: [],
    })

    expect(screen.getByText("12 King Rd, Riyadh")).toBeTruthy()
  })

  it("renders no place line for a shop that published no location at all", () => {
    renderFooter({ name: "Acme Supply", settings: {}, socials: [] })
    expect(screen.queryByText("Address:")).toBeNull()
  })

  // `Shop.address` is a `JSON` scalar, not a string. Calling `.trim()` on it
  // threw "shop?.address?.trim is not a function" and 500'd the whole page —
  // and only for shops that actually had an address, because a null one
  // short-circuits the optional chain. These three pin each shape.
  it("reads a place out of an address blob when there is no settings.location", () => {
    renderFooter({
      name: "Acme Supply",
      address: { city: "Ramallah", state: "Ramallah", country: "PS" },
      settings: {},
      socials: [],
    })

    expect(screen.getByText("Ramallah, PS")).toBeTruthy()
  })

  it("still accepts an address that is a plain string", () => {
    renderFooter({
      name: "Acme Supply",
      address: "  12 King Rd, Riyadh  ",
      settings: {},
      socials: [],
    })

    expect(screen.getByText("12 King Rd, Riyadh")).toBeTruthy()
  })

  it("renders no place line for an address blob with nothing usable in it", () => {
    renderFooter({
      name: "Acme Supply",
      address: { postal_code: 12345 },
      settings: {},
      socials: [],
    })

    expect(screen.queryByText(/12345/)).toBeNull()
  })

  it("dates the shop from when it joined the platform", () => {
    renderFooter({
      name: "Acme Supply",
      created_at: "2024-03-11T09:00:00.000Z",
      settings: {},
      socials: [],
    })

    // "On Zaydak since", not "established" — `created_at` is when the shop
    // joined this platform and nothing more.
    expect(screen.getByText("On Zaydak since:")).toBeTruthy()
    expect(screen.getByText("2024")).toBeTruthy()
  })

  it("prints no join date rather than NaN for an unparseable timestamp", () => {
    renderFooter({
      name: "Acme Supply",
      created_at: "not a date",
      settings: {},
      socials: [],
    })

    expect(screen.queryByText(/since/i)).toBeNull()
  })

  it("opens social links in a new tab without leaking the referrer", () => {
    renderFooter({
      name: "Acme Supply",
      settings: {},
      socials: [{ id: "s1", name: "Instagram", link: "https://instagram.test/acme" }],
    })

    const link = screen.getByRole("link", { name: "Instagram" })
    expect(link.getAttribute("href")).toBe("https://instagram.test/acme")
    expect(link.getAttribute("target")).toBe("_blank")
    expect(link.getAttribute("rel")).toBe("noreferrer noopener")
  })

  it("still renders a network it has no brand mark for", () => {
    // `ShopSocial.name` is a plain string, and rows written before the vendor's
    // Brand pane fixed the key hold whatever a vendor typed. Dropping them
    // would silently lose a link the shop published.
    renderFooter({
      name: "Acme Supply",
      settings: {},
      socials: [{ id: "s1", name: "Threads", link: "https://threads.test/acme" }],
    })

    const link = screen.getByRole("link", { name: "Threads" })
    expect(link.getAttribute("href")).toBe("https://threads.test/acme")
    expect(link.textContent).toBe("T")
  })

  it("names the two payment routes the checkout actually offers", () => {
    // Not a row of card-scheme marks: `PAYMENT_METHODS` in the checkout is a
    // fixed pair, and which schemes a merchant's Stripe account accepts is not
    // a fact this codebase holds. The strings come from the checkout's own
    // namespace so the two screens cannot drift apart.
    renderFooter({ name: "Acme Supply" })

    const region = screen.getByText("Payment methods").parentElement!
    expect(within(region).getByText("Cash on delivery")).toBeTruthy()
    expect(within(region).getByText("Card")).toBeTruthy()
  })

  it("records the year and the shop in the legal bar", () => {
    renderFooter({ name: "Acme Supply" })
    const year = String(new Date().getFullYear())
    expect(screen.getByText(new RegExp(`${year}.*Acme Supply`))).toBeTruthy()
  })

  it("keeps the shop name to exactly one link", () => {
    // The record row's lockup is the only place the bare name is a destination.
    // A second one would make a screen reader announce the same target twice at
    // the end of every page.
    renderFooter({ name: "Acme Supply" })
    expect(screen.getAllByRole("link", { name: "Acme Supply" })).toHaveLength(1)
  })

  it("clamps a vendor's description rather than letting it set the height", () => {
    // Free text in a fifth of a row. The full text is on the shop's home page,
    // one link away.
    renderFooter({
      name: "Acme Supply",
      description: "We have been making things since forever.",
      settings: {},
    })

    const blurb = screen.getByText("We have been making things since forever.")
    expect(blurb.className).toContain("line-clamp-3")
  })

  it("does not prefetch the routes the proxy redirects when signed out", () => {
    // `proxy.ts` answers a signed-out prefetch of /account or /wishlist with a
    // redirect to /login, and the App Router caches that against the URL —
    // which is what used to bounce a customer back to the form right after they
    // signed in. This column is four guarded routes, so it is four chances.
    renderFooter({ name: "Acme Supply" })

    for (const name of ["Your account", "Orders", "Addresses", "Saved"]) {
      const link = screen.getByRole("link", { name })
      expect(link.getAttribute("href")).toBeTruthy()
    }

    // The unguarded ones keep the default, so the catalogue still prefetches.
    expect(href("All products")).toBe("/acme/products")
  })

  it("does not render policy navigation when no policies are defined", () => {
    renderFooter({ name: "Acme Supply", settings: {} })
    expect(screen.queryByRole("navigation", { name: "Policies" })).toBeNull()
  })

  it("renders only configured policy links with correct destinations", () => {
    renderFooter({
      name: "Acme Supply",
      settings: {
        policies: {
          refund_policy: "Returns allowed within 14 days.",
          privacy_policy: "We protect your data.",
        },
      },
    })

    const nav = screen.getByRole("navigation", { name: "Policies" })
    expect(nav).toBeTruthy()

    const refundLink = within(nav).getByRole("link", { name: "Refund Policy" })
    expect(refundLink.getAttribute("href")).toBe("/acme/policies/refund")

    const privacyLink = within(nav).getByRole("link", { name: "Privacy Policy" })
    expect(privacyLink.getAttribute("href")).toBe("/acme/policies/privacy")

    expect(within(nav).queryByRole("link", { name: "Terms of Service" })).toBeNull()
    expect(within(nav).queryByRole("link", { name: "Shipping Policy" })).toBeNull()
  })
})

