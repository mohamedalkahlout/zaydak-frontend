import { gql } from "@apollo/client";

/**
 * Settings → Domains.
 *
 * Every operation is scoped by the `X-SHOP` header the Apollo link already
 * attaches, so none of them names a shop — the server reads it from the
 * request. A domain `id` is not authority on its own: the service re-reads
 * every row with `shop_id` in the WHERE clause, so a guessed id answers
 * "not found" rather than acting on somebody else's address.
 */

const DOMAIN_FIELDS = gql`
  fragment ShopDomainFields on ShopDomainEntry {
    id
    hostname
    kind
    status
    is_primary
    role
    last_error
    verified_at
    created_at
    dns_records {
      type
      name
      value
    }
  }
`;

export const SHOP_DOMAINS = gql`
  ${DOMAIN_FIELDS}
  query ShopDomains {
    shopDomains {
      success
      custom_domains_enabled
      data {
        ...ShopDomainFields
      }
    }
  }
`;

export const CONNECT_SHOP_DOMAIN = gql`
  ${DOMAIN_FIELDS}
  mutation ConnectShopDomain($hostname: String!) {
    connectShopDomain(hostname: $hostname) {
      success
      data {
        ...ShopDomainFields
      }
    }
  }
`;

/**
 * The full setup state for one domain.
 *
 * Separate from the list because it costs live DNS lookups against public
 * resolvers — paying for that per row, on a screen whose job is two lines of
 * text, would make the common case slow to serve the uncommon one. Fetched when
 * the merchant opens a domain's setup card.
 */
const CONFIGURATION_FIELDS = gql`
  ${DOMAIN_FIELDS}
  fragment ShopDomainConfigurationFields on ShopDomainConfiguration {
    zone_unreachable
    # Severity and a stable code, so a proven blocker can look different from a
    # caution. The deprecated warnings field is the same set with both thrown
    # away, and is not asked for here: two lists on one screen is how they
    # start disagreeing.
    issues {
      code
      severity
      message
      params
    }
    # The evidence behind "Domain is live": which resolver is behind, rather
    # than a yes/no about two unnamed ones.
    propagation {
      checked_at
      agreement
      resolvers {
        key
        name
        responded
        agrees
      }
    }
    domain {
      ...ShopDomainFields
    }
    dns_provider {
      provider
      display_name
      confidence
      management_url
      warning
    }
    # A name is an RRset, so both sides are lists: a parked apex answers with
    # several addresses that are one managed setting at the registrar, and one
    # instruction has to name all of them. The scalars are deprecated and kept
    # only so a client older than this selection set still renders something.
    dns_diff {
      action
      type
      name
      current_values
      required_values
      current_value
      required_value
      reason
    }
    checks {
      dns_configured
      dns_propagated
      ownership_verified
      routing_ready
      tls
    }
  }
`;

export const SHOP_DOMAIN_CONFIGURATION = gql`
  ${CONFIGURATION_FIELDS}
  query ShopDomainConfiguration($id: ID!) {
    shopDomainConfiguration(id: $id) {
      success
      data {
        ...ShopDomainConfigurationFields
      }
    }
  }
`;

/**
 * Returns the whole fresh configuration, not just a status.
 *
 * One round trip: the merchant presses Verify and the records, the checklist
 * and the badge all update together. Returning a bare status would leave the
 * instructions on screen stale against the checklist above them.
 */
export const VERIFY_SHOP_DOMAIN = gql`
  ${CONFIGURATION_FIELDS}
  mutation VerifyShopDomain($id: ID!) {
    verifyShopDomain(id: $id) {
      success
      data {
        ...ShopDomainConfigurationFields
      }
    }
  }
`;

export const SET_PRIMARY_SHOP_DOMAIN = gql`
  ${DOMAIN_FIELDS}
  mutation SetPrimaryShopDomain($id: ID!) {
    setPrimaryShopDomain(id: $id) {
      success
      data {
        ...ShopDomainFields
      }
    }
  }
`;

/**
 * Hand primacy back to the platform subdomain.
 *
 * Takes no id, because the address it promotes has no row to name — it clears
 * every custom domain's primary flag instead, which is the same end state and
 * the state the shop was in before anything was promoted. Returns the whole
 * refreshed list rather than one row: demoting one address changes the role of
 * every other one at the same instant, so a single-row answer would leave the
 * table disagreeing with itself.
 */
export const CLEAR_PRIMARY_SHOP_DOMAIN = gql`
  ${DOMAIN_FIELDS}
  mutation ClearPrimaryShopDomain {
    clearPrimaryShopDomain {
      success
      custom_domains_enabled
      data {
        ...ShopDomainFields
      }
    }
  }
`;

export const REMOVE_SHOP_DOMAIN = gql`
  mutation RemoveShopDomain($id: ID!) {
    removeShopDomain(id: $id) {
      success
      message
    }
  }
`;
