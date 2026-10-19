import { beforeEach, describe, expect, it } from "vitest"

import { layoutsEqual } from "../../lib/create-section"
import { DEFAULT_HOME_LAYOUT } from "../../lib/default-home-layout"
import { useThemeEditorStore } from "../theme-editor-store"

function resetStore() {
  useThemeEditorStore.setState({
    shopSlug: "acme",
    layout: structuredClone(DEFAULT_HOME_LAYOUT),
    savedLayout: structuredClone(DEFAULT_HOME_LAYOUT),
    selectedSectionId: "sec_hero_01",
    previewDevice: "desktop",
    inspectorTab: "section",
    surface: "preview",
    history: [],
    future: [],
    loading: false,
    saving: false,
    publishing: false,
    ready: true,
  })
}

describe("theme editor store", () => {
  beforeEach(() => {
    resetStore()
  })

  it("adds a duplicable section after the selected one", () => {
    useThemeEditorStore.getState().addSection("product_rail", "sec_hero_01")
    const { layout, selectedSectionId } = useThemeEditorStore.getState()
    expect(layout.order[1]).toBe(selectedSectionId)
    expect(layout.sections[selectedSectionId!]?.type).toBe("product_rail")
  })

  it("refuses a second singleton hero", () => {
    const before = useThemeEditorStore.getState().layout.order.length
    useThemeEditorStore.getState().addSection("hero")
    expect(useThemeEditorStore.getState().layout.order).toHaveLength(before)
  })

  it("does not remove a non-removable hero", () => {
    useThemeEditorStore.getState().removeSection("sec_hero_01")
    expect(useThemeEditorStore.getState().layout.sections.sec_hero_01).toBeDefined()
  })

  it("removes a removable section", () => {
    useThemeEditorStore.getState().removeSection("sec_values_01")
    expect(useThemeEditorStore.getState().layout.sections.sec_values_01).toBeUndefined()
    expect(useThemeEditorStore.getState().layout.order).not.toContain("sec_values_01")
  })

  it("duplicates a product rail", () => {
    const before = useThemeEditorStore.getState().layout.order.length
    useThemeEditorStore.getState().duplicateSection("sec_popular_01")
    expect(useThemeEditorStore.getState().layout.order).toHaveLength(before + 1)
  })

  it("reorders with moveSection", () => {
    useThemeEditorStore.getState().moveSection("sec_hero_01", 1)
    expect(useThemeEditorStore.getState().layout.order[0]).toBe("sec_facets_01")
    expect(useThemeEditorStore.getState().layout.order[1]).toBe("sec_hero_01")
  })

  it("toggles visibility", () => {
    useThemeEditorStore.getState().toggleSection("sec_popular_01")
    expect(useThemeEditorStore.getState().layout.sections.sec_popular_01.disabled).toBe(true)
  })

  it("patches settings", () => {
    useThemeEditorStore.getState().updateSectionSettings("sec_hero_01", {
      showStats: false,
    })
    expect(
      useThemeEditorStore.getState().layout.sections.sec_hero_01.settings.showStats,
    ).toBe(false)
  })

  it("undoes and redoes a settings change", () => {
    useThemeEditorStore.getState().updateSectionSettings("sec_hero_01", {
      showStats: false,
    })
    useThemeEditorStore.getState().undo()
    expect(
      useThemeEditorStore.getState().layout.sections.sec_hero_01.settings.showStats,
    ).toBe(true)
    useThemeEditorStore.getState().redo()
    expect(
      useThemeEditorStore.getState().layout.sections.sec_hero_01.settings.showStats,
    ).toBe(false)
  })

  it("marks dirty after a change and clean after reset to saved", () => {
    useThemeEditorStore.getState().toggleSection("sec_story_01")
    const after = useThemeEditorStore.getState()
    expect(layoutsEqual(after.layout, after.savedLayout)).toBe(false)
    after.reset()
    const reset = useThemeEditorStore.getState()
    expect(layoutsEqual(reset.layout, reset.savedLayout)).toBe(true)
  })

  it("reorders by index", () => {
    useThemeEditorStore.getState().reorderSection(0, 2)
    expect(useThemeEditorStore.getState().layout.order[2]).toBe("sec_hero_01")
  })

  it("saves a mock draft and clears dirty", async () => {
    window.localStorage.clear()
    useThemeEditorStore.getState().toggleSection("sec_story_01")
    await useThemeEditorStore.getState().saveDraftMock()
    const after = useThemeEditorStore.getState()
    expect(layoutsEqual(after.layout, after.savedLayout)).toBe(true)
    expect(after.layout.sections.sec_story_01.disabled).toBe(true)
  })

  it("publishes the current layout into mock published storage", async () => {
    window.localStorage.clear()
    useThemeEditorStore.getState().toggleSection("sec_values_01")
    await useThemeEditorStore.getState().publishMock()
    const raw = window.localStorage.getItem("zaydak_theme_layout:acme:home")
    const record = JSON.parse(raw ?? "{}")
    expect(record.published.sections.sec_values_01.disabled).toBe(true)
    expect(record.draft.sections.sec_values_01.disabled).toBe(true)
  })
})
