import { describe, expect, it } from "vitest"

import ar from "@/shared/messages/ar.json"
import en from "@/shared/messages/en.json"

import {
  INTEGRATION_ICONS,
  INTEGRATION_TYPES,
  integrationHref,
  slugToType,
} from "../nav"

/**
 * A new integration type costs this app three things — a row in
 * `INTEGRATION_TYPES`, an icon, and a label in both message files — and none of
 * them fails a type check when forgotten: a missing icon renders nothing in the
 * rail, and a missing label renders the raw key.
 */
describe("integration types", () => {
  it.each(INTEGRATION_TYPES)("%s has an icon and an en/ar label", (type) => {
    expect(INTEGRATION_ICONS[type]).toBeDefined()
    expect(
      (en.integrations.type as Record<string, string>)[type]
    ).toBeTruthy()
    expect(
      (ar.integrations.type as Record<string, string>)[type]
    ).toBeTruthy()
  })

  // The Bunny credentials uploads are written with. Only the credentials: the
  // storage driver itself stays STORAGE_DRIVER in the server environment.
  it("offers storage, reachable by its own URL", () => {
    expect(INTEGRATION_TYPES).toContain("STORAGE")
    expect(integrationHref("STORAGE")).toBe("/integrations/storage")
    expect(slugToType("storage")).toBe("STORAGE")
  })

  // Declared in the Prisma enum with no provider spec behind it — a screen for
  // it would be a form with nothing to pick.
  it("still does not offer payments", () => {
    expect(slugToType("payment")).toBeNull()
  })
})
