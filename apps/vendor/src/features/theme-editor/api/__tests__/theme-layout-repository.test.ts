import { beforeEach, describe, expect, it } from "vitest"

import {
  MockThemeLayoutRepository,
  themeLayoutStorageKey,
} from "../theme-layout-repository"
import { DEFAULT_HOME_LAYOUT } from "../../lib/default-home-layout"

describe("MockThemeLayoutRepository", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("loads the default homepage when nothing is stored", async () => {
    const repo = new MockThemeLayoutRepository()
    const layout = await repo.load("acme", "home")
    expect(layout.order).toEqual(DEFAULT_HOME_LAYOUT.order)
    expect(layout.sections.sec_hero_01.type).toBe("hero")
  })

  it("saves a draft without publishing", async () => {
    const repo = new MockThemeLayoutRepository()
    const layout = await repo.load("acme", "home")
    layout.sections.sec_hero_01.settings.showStats = false
    await repo.saveDraft("acme", layout)

    const raw = window.localStorage.getItem(themeLayoutStorageKey("acme", "home"))
    const record = JSON.parse(raw ?? "{}")
    expect(record.draft.sections.sec_hero_01.settings.showStats).toBe(false)
    expect(record.published.sections.sec_hero_01.settings.showStats).toBe(true)
  })

  it("publishes by copying draft onto published", async () => {
    const repo = new MockThemeLayoutRepository()
    const layout = await repo.load("acme", "home")
    layout.sections.sec_hero_01.settings.showStats = false
    await repo.publish("acme", layout)

    const raw = window.localStorage.getItem(themeLayoutStorageKey("acme", "home"))
    const record = JSON.parse(raw ?? "{}")
    expect(record.draft.sections.sec_hero_01.settings.showStats).toBe(false)
    expect(record.published.sections.sec_hero_01.settings.showStats).toBe(false)
  })
})
