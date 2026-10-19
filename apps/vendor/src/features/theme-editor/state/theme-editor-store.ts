import { create } from "zustand"

import type {
  PreviewDevice,
  StoreLayoutDocument,
  StoreSectionType,
} from "../types"
import { getThemeLayoutRepository } from "../api/theme-layout-repository"
import { cloneLayout, createSection, layoutsEqual } from "../lib/create-section"
import { DEFAULT_HOME_LAYOUT } from "../lib/default-home-layout"
import { canAddSectionType, SECTION_REGISTRY } from "../lib/section-registry"
import { existingTypes } from "../lib/layout-validation"

const HISTORY_LIMIT = 50

interface ThemeEditorState {
  shopSlug: string | null
  layout: StoreLayoutDocument
  savedLayout: StoreLayoutDocument
  selectedSectionId: string | null
  previewDevice: PreviewDevice
  inspectorTab: "section" | "theme"
  surface: "tree" | "preview" | "inspector"
  history: StoreLayoutDocument[]
  future: StoreLayoutDocument[]
  loading: boolean
  saving: boolean
  publishing: boolean
  ready: boolean

  hydrate: (shopSlug: string) => Promise<void>
  selectSection: (sectionId: string | null) => void
  setDevice: (device: PreviewDevice) => void
  setInspectorTab: (tab: "section" | "theme") => void
  setSurface: (surface: ThemeEditorState["surface"]) => void
  addSection: (type: StoreSectionType, afterId?: string | null) => void
  removeSection: (sectionId: string) => void
  duplicateSection: (sectionId: string) => void
  moveSection: (sectionId: string, direction: -1 | 1) => void
  reorderSection: (fromIndex: number, toIndex: number) => void
  toggleSection: (sectionId: string) => void
  updateSectionSettings: (
    sectionId: string,
    patch: Record<string, unknown>,
  ) => void
  undo: () => void
  redo: () => void
  reset: () => void
  saveDraftMock: () => Promise<void>
  publishMock: () => Promise<void>
}

function commit(
  state: ThemeEditorState,
  nextLayout: StoreLayoutDocument,
): Partial<ThemeEditorState> {
  return {
    history: [...state.history, cloneLayout(state.layout)].slice(-HISTORY_LIMIT),
    future: [],
    layout: nextLayout,
  }
}

export const useThemeEditorStore = create<ThemeEditorState>((set, get) => ({
  shopSlug: null,
  layout: cloneLayout(DEFAULT_HOME_LAYOUT),
  savedLayout: cloneLayout(DEFAULT_HOME_LAYOUT),
  selectedSectionId: null,
  previewDevice: "desktop",
  inspectorTab: "section",
  surface: "preview",
  history: [],
  future: [],
  loading: false,
  saving: false,
  publishing: false,
  ready: false,

  hydrate: async (shopSlug) => {
    set({ loading: true, shopSlug, ready: false })
    const layout = await getThemeLayoutRepository().load(shopSlug, "home")
    set({
      layout: cloneLayout(layout),
      savedLayout: cloneLayout(layout),
      selectedSectionId: layout.order[0] ?? null,
      previewDevice: "desktop",
      inspectorTab: "section",
      surface: "preview",
      history: [],
      future: [],
      loading: false,
      ready: true,
    })
  },

  selectSection: (sectionId) =>
    set({
      selectedSectionId: sectionId,
      inspectorTab: "section",
    }),

  setDevice: (previewDevice) => set({ previewDevice }),
  setInspectorTab: (inspectorTab) => set({ inspectorTab }),
  setSurface: (surface) => set({ surface }),

  addSection: (type, afterId) => {
    const state = get()
    if (!canAddSectionType(type, existingTypes(state.layout))) return
    const section = createSection(type)
    const order = [...state.layout.order]
    const index = afterId ? order.indexOf(afterId) : -1
    if (index >= 0) order.splice(index + 1, 0, section.id)
    else order.push(section.id)
    set(
      commit(state, {
        ...state.layout,
        sections: { ...state.layout.sections, [section.id]: section },
        order,
      }),
    )
    set({ selectedSectionId: section.id, inspectorTab: "section" })
  },

  removeSection: (sectionId) => {
    const state = get()
    const section = state.layout.sections[sectionId]
    if (!section || !SECTION_REGISTRY[section.type].removable) return
    const sections = { ...state.layout.sections }
    delete sections[sectionId]
    const order = state.layout.order.filter((id) => id !== sectionId)
    const selected =
      state.selectedSectionId === sectionId
        ? (order[0] ?? null)
        : state.selectedSectionId
    set(commit(state, { ...state.layout, sections, order }))
    set({ selectedSectionId: selected })
  },

  duplicateSection: (sectionId) => {
    const state = get()
    const source = state.layout.sections[sectionId]
    if (!source || !SECTION_REGISTRY[source.type].duplicable) return
    const copy = createSection(source.type)
    copy.settings = cloneLayout(source.settings)
    const order = [...state.layout.order]
    const index = order.indexOf(sectionId)
    order.splice(index + 1, 0, copy.id)
    set(
      commit(state, {
        ...state.layout,
        sections: { ...state.layout.sections, [copy.id]: copy },
        order,
      }),
    )
    set({ selectedSectionId: copy.id })
  },

  moveSection: (sectionId, direction) => {
    const state = get()
    const index = state.layout.order.indexOf(sectionId)
    const next = index + direction
    if (index < 0 || next < 0 || next >= state.layout.order.length) return
    const order = [...state.layout.order]
    const [moved] = order.splice(index, 1)
    order.splice(next, 0, moved)
    set(commit(state, { ...state.layout, order }))
  },

  reorderSection: (fromIndex, toIndex) => {
    const state = get()
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= state.layout.order.length ||
      toIndex >= state.layout.order.length
    ) {
      return
    }
    const order = [...state.layout.order]
    const [moved] = order.splice(fromIndex, 1)
    order.splice(toIndex, 0, moved)
    set(commit(state, { ...state.layout, order }))
  },

  toggleSection: (sectionId) => {
    const state = get()
    const section = state.layout.sections[sectionId]
    if (!section) return
    set(
      commit(state, {
        ...state.layout,
        sections: {
          ...state.layout.sections,
          [sectionId]: { ...section, disabled: !section.disabled },
        },
      }),
    )
  },

  updateSectionSettings: (sectionId, patch) => {
    const state = get()
    const section = state.layout.sections[sectionId]
    if (!section) return
    set(
      commit(state, {
        ...state.layout,
        sections: {
          ...state.layout.sections,
          [sectionId]: {
            ...section,
            settings: { ...section.settings, ...patch },
          },
        },
      }),
    )
  },

  undo: () => {
    const state = get()
    const previous = state.history[state.history.length - 1]
    if (!previous) return
    set({
      layout: previous,
      history: state.history.slice(0, -1),
      future: [cloneLayout(state.layout), ...state.future],
    })
  },

  redo: () => {
    const state = get()
    const [next, ...rest] = state.future
    if (!next) return
    set({
      layout: next,
      future: rest,
      history: [...state.history, cloneLayout(state.layout)].slice(-HISTORY_LIMIT),
    })
  },

  reset: () => {
    const { savedLayout } = get()
    set({
      layout: cloneLayout(savedLayout),
      history: [],
      future: [],
    })
  },

  saveDraftMock: async () => {
    const { shopSlug, layout } = get()
    if (!shopSlug) return
    set({ saving: true })
    await getThemeLayoutRepository().saveDraft(shopSlug, layout)
    set({ saving: false, savedLayout: cloneLayout(layout) })
  },

  publishMock: async () => {
    const { shopSlug, layout } = get()
    if (!shopSlug) return
    set({ publishing: true })
    await getThemeLayoutRepository().publish(shopSlug, layout)
    set({
      publishing: false,
      savedLayout: cloneLayout(layout),
    })
  },
}))

export function isThemeEditorDirty(
  layout: StoreLayoutDocument,
  savedLayout: StoreLayoutDocument,
): boolean {
  return !layoutsEqual(layout, savedLayout)
}
