import { describe, it, expect } from "vitest"
import { print } from "graphql"

import { SHOP_DOMAIN_CONFIGURATION, VERIFY_SHOP_DOMAIN } from "../domains"

/**
 * The selection set for the DNS setup screen.
 *
 * **Nothing else checks this file.** It imports `gql` from `@apollo/client`
 * rather than the codegen tag, and `domain-detail-pane.tsx` hand-casts the
 * result — so a field the screen reads but the fragment never asked for is
 * `undefined` at runtime with a green typecheck, a green build and a green test
 * run. The component's fallback to the deprecated scalars then hides it
 * further, rendering one of several values as though that were the whole
 * answer.
 *
 * That is the one way this change ships half-done, so it is asserted here.
 */

const documents = {
  "the configuration query": SHOP_DOMAIN_CONFIGURATION,
  "the verify mutation": VERIFY_SHOP_DOMAIN,
}

describe("the domain configuration selection set", () => {
  for (const [label, document] of Object.entries(documents)) {
    it(`asks for the whole record set in ${label}`, () => {
      const source = print(document)

      // A name is an RRset: both sides are lists, and the screen renders them.
      expect(source).toContain("current_values")
      expect(source).toContain("required_values")
    })

    it(`keeps the deprecated scalars in ${label} for a client behind the API`, () => {
      const source = print(document)
      expect(source).toContain("current_value")
      expect(source).toContain("required_value")
    })
  }
})
