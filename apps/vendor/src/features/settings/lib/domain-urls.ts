/**
 * The address customers open, for each row of the domains table.
 *
 * **The server is the authority, and the env vars are only the placeholder.**
 * `shopDomains` synthesises the platform address from the shop's handle and the
 * back-end's own `STOREFRONT_ROOT_DOMAIN`, and *omits the row entirely* when
 * there is no apex — so the row's presence answers "is host mode on?" and its
 * hostname answers "at what address?", both without this app guessing. It used
 * to guess, from `NEXT_PUBLIC_ROOT_DOMAIN`, and the two variables are set on
 * different deployments by different people: with the vendor one unset against
 * a back-end that has an apex, one screen gave two different answers to "what
 * is my store's address" — the table listed `acme.zaydak.com` and its own View
 * link opened `localhost:3003/acme`.
 *
 * What is left of the env vars is the gap before the list answers, where there
 * is no row to read and a placeholder beats an empty line.
 */

export interface ViewableDomain {
  kind: "PLATFORM_SUBDOMAIN" | "CUSTOM";
  /**
   * Absent only for a placeholder this app built before the list answered.
   * Every row the server sends carries one.
   */
  hostname?: string | null;
}

export interface StorefrontAddressing {
  /** `NEXT_PUBLIC_STOREFRONT_URL`, scheme included. */
  storefrontUrl: string;
  /** `NEXT_PUBLIC_ROOT_DOMAIN`, or null when the storefront is path-scoped. */
  rootDomain: string | null;
}

/**
 * Pure, so it can be tested without an environment: the wrapper below reads
 * the variables once and hands them in.
 */
export function viewUrlFor(
  domain: ViewableDomain,
  shopSlug: string,
  addressing: StorefrontAddressing,
): string {
  if (domain.kind === "CUSTOM" && domain.hostname) {
    return `https://${domain.hostname}`;
  }

  // The platform row exists only on a deployment whose back-end has an apex,
  // so its hostname *is* the address — there is nothing left to derive and
  // nothing this app could add by consulting its own environment.
  if (domain.hostname) return `https://${domain.hostname}`;

  // No row: the list has not answered yet, or the deployment is path-scoped
  // and the server sent none. Both land on the path URL, which serves either
  // way — the apex never redirects.
  return `${addressing.storefrontUrl.replace(/\/+$/, "")}/${shopSlug}`;
}

/**
 * The apex the server built this shop's platform address from, or null when it
 * built none.
 *
 * Read back out of the hostname rather than sent as its own field: the row is
 * exactly `<slug>.<apex>` by construction, so there is nothing to add to the
 * API and nothing that can drift from the address actually being listed. Null
 * means the deployment is path-scoped, which is a state rather than a missing
 * value — every caller already has to render that case.
 */
export function platformRootFrom(
  rows: readonly ViewableDomain[],
  shopSlug: string,
): string | null {
  const hostname = rows.find(
    (row) => row.kind === "PLATFORM_SUBDOMAIN",
  )?.hostname;
  if (!hostname) return null;

  const prefix = `${shopSlug}.`;
  if (!hostname.startsWith(prefix)) return null;
  return hostname.slice(prefix.length) || null;
}

const ADDRESSING: StorefrontAddressing = {
  storefrontUrl:
    process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3003",
  rootDomain: process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim() || null,
};

export function domainViewUrl(domain: ViewableDomain, shopSlug: string): string {
  return viewUrlFor(domain, shopSlug, ADDRESSING);
}

/**
 * The apex shop subdomains hang off, as this app's environment describes it.
 *
 * **The placeholder, not the answer** — see the file docblock. Use
 * `platformRootFrom` once the list has answered, and fall back to this only
 * while it has not.
 */
export const ROOT_DOMAIN = ADDRESSING.rootDomain;

/** The storefront's host, scheme stripped, for the path-scoped preview. */
export const STOREFRONT_HOST = ADDRESSING.storefrontUrl.replace(
  /^https?:\/\//,
  "",
);
