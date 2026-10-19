import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import en from "@/shared/messages/en.json"
import {
  ShopDomainKind,
  ShopDomainStatus,
} from "@/shared/api/generated/graphql"
import { ShopDomains } from "../components/shop-domains"
import type { ShopDomainRow, ShopDomainsShop } from "../types"

type Payload = {
  success: boolean
  custom_domains_enabled: boolean
  shop: ShopDomainsShop
  data: ShopDomainRow[]
}

let payload: Payload | undefined
let loading: boolean
let queryError: Error | undefined

const shop = (over: Partial<ShopDomainsShop> = {}): ShopDomainsShop => ({
  __typename: "ShopDomainShop",
  id: "shop-1",
  name: "Acme Supply",
  slug: "acme",
  is_active: true,
  is_approved: true,
  deleted_at: null,
  ...over,
})

const platformRow = (
  status: ShopDomainStatus = ShopDomainStatus.Active,
): ShopDomainRow => ({
  __typename: "ShopDomainEntry",
  // The platform address is synthesised from the handle, so it carries no row
  // id and no verification of its own.
  id: null,
  hostname: "acme.zaydak.com",
  kind: ShopDomainKind.PlatformSubdomain,
  status,
  is_primary: false,
  last_error: null,
  verified_at: null,
  created_at: null,
  dns_records: [],
})

const customRow = (over: Partial<ShopDomainRow> = {}): ShopDomainRow => ({
  __typename: "ShopDomainEntry",
  id: "dom-1",
  hostname: "shop.acme.com",
  kind: ShopDomainKind.Custom,
  status: ShopDomainStatus.Active,
  is_primary: true,
  last_error: null,
  verified_at: "2026-08-01T10:00:00.000Z",
  created_at: "2026-07-30T10:00:00.000Z",
  dns_records: [],
  ...over,
})

vi.mock("@apollo/client/react", () => ({
  useQuery: () => ({
    data: payload ? { adminShopDomains: payload } : undefined,
    loading,
    error: queryError,
  }),
}))

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>()
  return {
    ...actual,
    useTranslations: (namespace?: string) =>
      actual.createTranslator({
        locale: "en",
        messages: en as never,
        namespace: namespace as never,
      }),
    useLocale: () => "en",
  }
})

beforeEach(() => {
  loading = false
  queryError = undefined
  payload = {
    success: true,
    custom_domains_enabled: true,
    shop: shop(),
    data: [platformRow(), customRow()],
  }
})

afterEach(cleanup)

describe("ShopDomains", () => {
  it("holds the card's height with placeholder rows before the first answer", () => {
    loading = true
    payload = undefined
    render(<ShopDomains shopId="shop-1" />)

    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBe(25)
    expect(screen.queryByText(en.shops.domains.empty)).toBeNull()
    // The notice belongs to an answered query; a blank `custom_domains_enabled`
    // must not read as "custom domains are off on this deployment".
    expect(screen.queryByText(en.shops.domains.customDisabled)).toBeNull()
  })

  it("names the shop with the same status the list gives it", () => {
    payload = {
      ...payload!,
      shop: shop({ is_approved: false }),
    }
    render(<ShopDomains shopId="shop-1" />)

    expect(screen.getByText("Acme Supply")).toBeTruthy()
    expect(screen.getByText("acme")).toBeTruthy()
    // `shopStatus`, not a second reading of the flags: a shop that reads
    // "Pending review" on /shops must not read "Active" here.
    expect(screen.getByText(en.shops.status.pending)).toBeTruthy()
  })

  it("lists every address with its kind, status, primary flag and check date", () => {
    render(<ShopDomains shopId="shop-1" />)

    expect(screen.getByText("acme.zaydak.com")).toBeTruthy()
    expect(screen.getByText("shop.acme.com")).toBeTruthy()
    expect(screen.getByText(en.shops.domains.kind.platform)).toBeTruthy()
    expect(screen.getByText(en.shops.domains.kind.custom)).toBeTruthy()
    expect(screen.getAllByText(en.shops.domains.status.ACTIVE).length).toBe(2)
    // The column head and the badge share the word; only one of them is a span.
    expect(
      screen
        .getAllByText(en.shops.domains.primary)
        .filter((node) => node.tagName === "SPAN"),
    ).toHaveLength(1)
    expect(screen.getByText("Aug 1, 2026")).toBeTruthy()
  })

  it("shows the records the merchant has yet to set, and only while they matter", () => {
    payload = {
      ...payload!,
      data: [
        customRow({
          status: ShopDomainStatus.Pending,
          verified_at: null,
          dns_records: [
            {
              __typename: "ShopDomainDnsRecord",
              type: "CNAME",
              name: "shop",
              value: "edge.zaydak.com",
            },
          ],
        }),
      ],
    }
    const { rerender } = render(<ShopDomains shopId="shop-1" />)
    expect(screen.getByText(en.shops.domains.dnsTitle)).toBeTruthy()
    expect(screen.getByText(/edge\.zaydak\.com/)).toBeTruthy()

    // Once it serves, the record is one that has already been read.
    payload = { ...payload!, data: [customRow()] }
    rerender(<ShopDomains shopId="shop-1" />)
    expect(screen.queryByText(en.shops.domains.dnsTitle)).toBeNull()
  })

  it("surfaces a failed check against an address that is still serving", () => {
    payload = {
      ...payload!,
      data: [customRow({ last_error: "NXDOMAIN" })],
    }
    render(<ShopDomains shopId="shop-1" />)

    // The sweep leaves the row ACTIVE and writes the strike; the next failed
    // check is what demotes it, so both must be legible at once.
    expect(screen.getByText("Last check failed: NXDOMAIN")).toBeTruthy()
    expect(screen.getByText(en.shops.domains.status.ACTIVE)).toBeTruthy()
  })

  it("explains that the platform address's status comes from the shop", () => {
    render(<ShopDomains shopId="shop-1" />)
    expect(screen.getByText(en.shops.domains.platformNote)).toBeTruthy()
    // The pointed version belongs to the case that is actually misread.
    expect(screen.queryByText(en.shops.domains.platformPendingNote)).toBeNull()

    cleanup()
    payload = {
      ...payload!,
      shop: shop({ is_approved: false }),
      data: [platformRow(ShopDomainStatus.Pending)],
    }
    render(<ShopDomains shopId="shop-1" />)
    expect(screen.getByText(en.shops.domains.platformPendingNote)).toBeTruthy()
  })

  it("says why the list can only ever hold the platform subdomain", () => {
    payload = {
      ...payload!,
      custom_domains_enabled: false,
      data: [platformRow()],
    }
    const { rerender } = render(<ShopDomains shopId="shop-1" />)
    expect(screen.getByText(en.shops.domains.customDisabled)).toBeTruthy()

    payload = { ...payload!, custom_domains_enabled: true }
    rerender(<ShopDomains shopId="shop-1" />)
    expect(screen.queryByText(en.shops.domains.customDisabled)).toBeNull()
  })

  it("reports an empty list apart from a failed one", () => {
    payload = { ...payload!, data: [] }
    const { rerender } = render(<ShopDomains shopId="shop-1" />)
    expect(screen.getByText(en.shops.domains.empty)).toBeTruthy()

    queryError = new Error("Shop not found")
    payload = undefined
    rerender(<ShopDomains shopId="shop-1" />)
    expect(screen.getByRole("alert").textContent).toBe("Shop not found")
  })

  it("is read-only: nothing here promotes, removes or re-verifies a domain", () => {
    payload = {
      ...payload!,
      data: [
        platformRow(),
        customRow({ status: ShopDomainStatus.Failed, is_primary: false }),
      ],
    }
    render(<ShopDomains shopId="shop-1" />)

    // A domain is the merchant's property and the DNS is in their registrar,
    // so the screen offers no control at all — the assertion is the absence of
    // every button, not of three named ones.
    expect(screen.queryAllByRole("button")).toHaveLength(0)
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0)
    const links = screen.getAllByRole("link")
    expect(links).toHaveLength(1)
    expect(links[0]?.getAttribute("href")).toBe("/shops")
  })
})
