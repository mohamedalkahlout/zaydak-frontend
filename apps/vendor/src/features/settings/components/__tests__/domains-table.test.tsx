import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { DomainsTable, type DomainRow } from "../domains/domains-table"

/**
 * Every address the shop answers at, as a tree under the primary one.
 *
 * What is worth pinning is the shape — the primary is the root whichever kind
 * of address it is — and what each row is allowed to do, which is derived
 * from one fact: a row with no `id` has no database row behind it, so it can
 * be looked at but not opened, promoted or deleted.
 *
 * (No jest-dom in this project — assertions use plain DOM properties.)
 */

vi.mock("next-intl", async () =>
  (await import("@/shared/test/next-intl")).nextIntlMock(),
)

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

// The two confirm dialogs each own a mutation; closed, they render nothing.
vi.mock("@apollo/client/react", () => ({
  useMutation: () => [vi.fn(), { loading: false }],
}))

vi.mock("sileo", () => ({
  sileo: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const platform = (over: Partial<DomainRow> = {}): DomainRow => ({
  id: null,
  hostname: "acme.zaydak.com",
  kind: "PLATFORM_SUBDOMAIN",
  status: "ACTIVE",
  is_primary: true,
  ...over,
})

const custom = (over: Partial<DomainRow> = {}): DomainRow => ({
  id: "dom_1",
  hostname: "acme.com",
  kind: "CUSTOM",
  status: "PENDING",
  is_primary: false,
  ...over,
})

/** The rows in document order, by hostname. */
function rowOrder(container: HTMLElement) {
  return Array.from(container.querySelectorAll("[data-domain]")).map((node) =>
    node.getAttribute("data-domain"),
  )
}

function rowOf(container: HTMLElement, hostname: string) {
  return container.querySelector(`[data-domain="${hostname}"]`) as HTMLElement
}

describe("DomainsTable", () => {
  it("roots the tree at the primary address and hangs the others off it", () => {
    const { container } = render(
      <DomainsTable
        rows={[platform(), custom(), custom({ id: "dom_2", hostname: "www.acme.com" })]}
        shopSlug="acme"
      />,
    )
    expect(rowOrder(container)).toEqual(["acme.zaydak.com", "acme.com", "www.acme.com"])
    // The root is a top-level row; the branches sit inside a nested list.
    expect(rowOf(container, "acme.zaydak.com").closest("ul ul")).toBeNull()
    expect(rowOf(container, "acme.com").closest("ul ul")).not.toBeNull()
    expect(rowOf(container, "www.acme.com").closest("ul ul")).not.toBeNull()
  })

  it("re-roots under a promoted custom domain, with the platform address as a branch", () => {
    // The server lists the platform address first regardless; the tree is
    // about primacy, which is what actually changed.
    const { container } = render(
      <DomainsTable
        rows={[
          platform({ is_primary: false }),
          custom({ status: "ACTIVE", is_primary: true }),
        ]}
        shopSlug="acme"
      />,
    )
    expect(rowOrder(container)).toEqual(["acme.com", "acme.zaydak.com"])
    expect(rowOf(container, "acme.com").closest("ul ul")).toBeNull()
    expect(rowOf(container, "acme.zaydak.com").closest("ul ul")).not.toBeNull()
  })

  it("marks exactly one row Primary and gives every row a status", () => {
    render(<DomainsTable rows={[platform(), custom()]} shopSlug="acme" />)
    expect(screen.getAllByText("Primary")).toHaveLength(1)
    expect(screen.queryByText("Connected")).not.toBeNull()
    expect(screen.queryByText("Needs setup")).not.toBeNull()
  })

  it("tells wrong DNS from a domain waiting on the platform, from the stored row alone", () => {
    // The provider writes back the records it is still waiting on: a
    // VERIFYING row with records outstanding is wrong DNS, one with none is
    // right DNS waiting on the certificate.
    render(
      <DomainsTable
        rows={[
          platform(),
          custom({ status: "VERIFYING", dns_records: [{ type: "A" }] }),
          custom({
            id: "dom_2",
            hostname: "www.acme.com",
            status: "VERIFYING",
            dns_records: [],
          }),
        ]}
        shopSlug="acme"
      />,
    )
    expect(screen.queryByText("Invalid DNS")).not.toBeNull()
    expect(screen.queryByText("Provisioning TLS")).not.toBeNull()
  })

  it("opens a custom domain's setup screen from its name, and nothing for the platform address", () => {
    const { container } = render(
      <DomainsTable rows={[platform(), custom()]} shopSlug="acme" />,
    )
    const link = rowOf(container, "acme.com").querySelector("a[href^='/store']")
    expect(link?.getAttribute("href")).toBe("/store/acme/settings/domains/dom_1")

    // The platform address opens too, through a sentinel. It has no row and so
    // no id, which is why it used to lead nowhere — and why, once a custom
    // domain was promoted, there was no way to hand primacy back short of
    // deleting that domain.
    const platformLink = rowOf(container, "acme.zaydak.com").querySelector(
      "a[href^='/store']",
    )
    expect(platformLink?.getAttribute("href")).toBe(
      "/store/acme/settings/domains/platform",
    )
  })

  it("makes View a real link to the address, opening in a new tab", () => {
    const { container } = render(
      <DomainsTable rows={[platform(), custom()]} shopSlug="acme" />,
    )
    const view = rowOf(container, "acme.com").querySelector("[aria-label='View acme.com']")
    expect(view?.tagName).toBe("A")
    expect(view?.getAttribute("href")).toBe("https://acme.com")
    expect(view?.getAttribute("target")).toBe("_blank")
  })

  it("offers View and Change domain type on every row, but Delete only where there is a row to delete", () => {
    const { container } = render(
      <DomainsTable rows={[platform(), custom()]} shopSlug="acme" />,
    )
    const platformRow = rowOf(container, "acme.zaydak.com")
    const customRow = rowOf(container, "acme.com")

    // The accessible name carries the hostname: three rows of "Delete domain"
    // would give a screen-reader user no way to tell which address each acts on.
    expect(platformRow.querySelector("[aria-label='View acme.zaydak.com']")).not.toBeNull()
    // Deletion is the one action a missing row genuinely rules out: there is
    // nothing to delete. Changing the type is where primacy is handed back, so
    // it is offered here too.
    expect(platformRow.querySelector("[aria-label^='Delete']")).toBeNull()
    expect(
      platformRow.querySelector("[aria-label='Change domain type for acme.zaydak.com']"),
    ).not.toBeNull()

    expect(customRow.querySelector("[aria-label='View acme.com']")).not.toBeNull()
    expect(customRow.querySelector("[aria-label='Delete acme.com']")).not.toBeNull()
    expect(
      customRow.querySelector("[aria-label='Change domain type for acme.com']"),
    ).not.toBeNull()
  })

  it("renders every hostname left-to-right, whatever the page direction", () => {
    // The dashboard runs RTL in Arabic, and a hostname rendered RTL has its
    // segments visually reversed.
    const { container } = render(
      <DomainsTable rows={[platform(), custom()]} shopSlug="acme" />,
    )
    const names = Array.from(container.querySelectorAll("[data-domain] [dir]"))
    expect(names).toHaveLength(2)
    expect(names.every((node) => node.getAttribute("dir") === "ltr")).toBe(true)
  })

  it("shows placeholder rows on first load and none once there are rows", () => {
    const { container, rerender } = render(
      <DomainsTable rows={[]} shopSlug="acme" loading />,
    )
    expect(container.querySelectorAll("[data-slot=skeleton]").length).toBeGreaterThan(0)
    rerender(<DomainsTable rows={[platform()]} shopSlug="acme" loading />)
    expect(container.querySelectorAll("[data-slot=skeleton]")).toHaveLength(0)
  })
})
