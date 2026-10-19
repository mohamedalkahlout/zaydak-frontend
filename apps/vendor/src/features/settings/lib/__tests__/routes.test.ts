import { describe, expect, it } from "vitest"
import { SETTINGS_SECTIONS } from "../../components/settings-sections"
import {
  domainUrl,
  generalSubviewUrl,
  legacySectionRedirect,
  parseSettingsPath,
  sectionIdFromSlug,
  sectionSlug,
  sectionUrl,
} from "../routes"

describe("the slug table", () => {
  it("covers every section in the rail", () => {
    // A section the rail links to but the table has no slug for renders a
    // `/settings/undefined` link, which is a 404 the nav points at itself.
    for (const s of SETTINGS_SECTIONS) {
      expect(sectionSlug(s.id), s.id).toBeTruthy()
    }
  })

  it("is a bijection — no two sections share a URL", () => {
    const slugs = SETTINGS_SECTIONS.map((s) => sectionSlug(s.id))
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it("round-trips id -> slug -> id", () => {
    for (const s of SETTINGS_SECTIONS) {
      expect(sectionIdFromSlug(sectionSlug(s.id))).toBe(s.id)
    }
  })

  it("has no camelCase in a URL", () => {
    for (const s of SETTINGS_SECTIONS) {
      expect(sectionSlug(s.id)).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it("returns null for a slug that is not a section", () => {
    expect(sectionIdFromSlug("nonsense")).toBeNull()
    expect(sectionIdFromSlug("")).toBeNull()
  })
})

describe("url builders", () => {
  it("builds a shop-scoped section url", () => {
    expect(sectionUrl("acme", "customerAccounts")).toBe(
      "/store/acme/settings/customer-accounts",
    )
    expect(generalSubviewUrl("acme", "brand")).toBe(
      "/store/acme/settings/general/brand",
    )
  })

  it("falls back to /store when there is no shop in the URL yet", () => {
    expect(sectionUrl(null, "general")).toBe("/store/general")
  })
})

describe("domainUrl", () => {
  it("builds the detail URL under Domains, escaping the id", () => {
    expect(domainUrl("acme", "dom_1")).toBe("/store/acme/settings/domains/dom_1")
    expect(domainUrl("acme", "a b")).toBe("/store/acme/settings/domains/a%20b")
  })

  it("round-trips through parseSettingsPath", () => {
    expect(parseSettingsPath(domainUrl("acme", "a b")).detail).toBe("a b")
  })
})

describe("parseSettingsPath", () => {
  it("reads the section out of the path", () => {
    expect(parseSettingsPath("/store/acme/settings/shipping")).toEqual({
      section: "shipping",
      subview: null,
      detail: null,
    })
    expect(parseSettingsPath("/store/acme/settings/sales-channels")).toEqual({
      section: "salesChannels",
      subview: null,
      detail: null,
    })
  })

  it("reads General's sub-views", () => {
    expect(parseSettingsPath("/store/acme/settings/general/contact")).toEqual({
      section: "general",
      subview: "contact",
      detail: null,
    })
    expect(parseSettingsPath("/store/acme/settings/general/brand")).toEqual({
      section: "general",
      subview: "brand",
      detail: null,
    })
  })

  it("only recognises a sub-view under General", () => {
    // `/settings/shipping/brand` is not a screen; reading a sub-view there
    // would draw a breadcrumb back to General from a pane that is not in it.
    expect(parseSettingsPath("/store/acme/settings/shipping/brand")).toEqual({
      section: "shipping",
      subview: null,
      detail: null,
    })
  })

  it("returns nothing for a path that is not settings", () => {
    expect(parseSettingsPath("/store/acme/orders")).toEqual({
      section: null,
      subview: null,
      detail: null,
    })
  })

  it("tolerates a trailing slash and the bare settings root", () => {
    expect(parseSettingsPath("/store/acme/settings/general/")).toEqual({
      section: "general",
      subview: null,
      detail: null,
    })
    expect(parseSettingsPath("/store/acme/settings")).toEqual({
      section: null,
      subview: null,
      detail: null,
    })
  })

  it("reads the record a detail screen is showing under Domains", () => {
    // `/settings/domains/<id>` is one domain's setup page: the shell draws a
    // breadcrumb back to Domains and the page supplies the heading. The id
    // is decoded, so a URL-escaped one comes back as the id itself.
    expect(parseSettingsPath("/store/acme/settings/domains/dom_1")).toEqual({
      section: "domains",
      subview: null,
      detail: "dom_1",
    })
    expect(parseSettingsPath("/store/acme/settings/domains/a%20b")).toEqual({
      section: "domains",
      subview: null,
      detail: "a b",
    })
    expect(parseSettingsPath("/store/acme/settings/domains")).toEqual({
      section: "domains",
      subview: null,
      detail: null,
    })
  })

  it("only reads a detail under a section that has detail screens", () => {
    // `/settings/shipping/<x>` is not a screen; a breadcrumb there would point
    // back to a section the pane is not inside.
    expect(parseSettingsPath("/store/acme/settings/shipping/dom_1")).toEqual({
      section: "shipping",
      subview: null,
      detail: null,
    })
  })

  it("survives a malformed escape in the detail segment", () => {
    expect(parseSettingsPath("/store/acme/settings/domains/%E0%A4%A").detail).toBe(
      "%E0%A4%A",
    )
  })

  it("ignores a query string or hash", () => {
    // The leave guard hands over `pathname + search`; `/general?x=1` is still
    // General, or a move inside the group would be asked about.
    expect(parseSettingsPath("/store/acme/settings/general?x=1")).toEqual({
      section: "general",
      subview: null,
      detail: null,
    })
    expect(parseSettingsPath("/store/acme/settings/general/brand#logo")).toEqual({
      section: "general",
      subview: "brand",
      detail: null,
    })
  })
})

describe("legacySectionRedirect", () => {
  it("translates a one-route-era ?section= into the section's own URL", () => {
    expect(legacySectionRedirect("acme", { section: "plan" })).toBe(
      "/store/acme/settings/plan",
    )
    // The old links carried the id; the slug is accepted too.
    expect(legacySectionRedirect("acme", { section: "customerAccounts" })).toBe(
      "/store/acme/settings/customer-accounts",
    )
    expect(legacySectionRedirect("acme", { section: "customer-accounts" })).toBe(
      "/store/acme/settings/customer-accounts",
    )
  })

  it("lands on General for an unknown or missing section", () => {
    expect(legacySectionRedirect("acme", {})).toBe("/store/acme/settings/general")
    expect(legacySectionRedirect("acme", { section: "nonsense" })).toBe(
      "/store/acme/settings/general",
    )
    expect(legacySectionRedirect("acme", { section: ["plan", "billing"] })).toBe(
      "/store/acme/settings/general",
    )
  })

  it("carries every other parameter and never the section itself", () => {
    // `?billing=` is the one that matters: a Stripe session opened from the
    // old `?section=plan` link returns here and the plan route forwards it on.
    expect(legacySectionRedirect("acme", { section: "plan", billing: "ok" })).toBe(
      "/store/acme/settings/plan?billing=ok",
    )
    expect(
      legacySectionRedirect("acme", { section: "plan", tag: ["a", "b"], billing: "ok" }),
    ).toBe("/store/acme/settings/plan?tag=a&tag=b&billing=ok")
    expect(legacySectionRedirect("acme", { section: "plan" })).not.toContain("section")
  })
})
