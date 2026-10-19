"use client"

import { create } from "zustand"

/**
 * Editor chrome state — extracted from `segment-editor.tsx` to keep the
 * orchestrator readable. Holds the bits of UI state that don't belong in
 * React Hook Form (which owns name/description/query) or in the
 * `useUnsavedBarStore` (which owns dirty + save handlers).
 *
 *   collapsed       — whether the editor card body is folded
 *   templatesOpen   — whether the Templates picker modal is open
 *   debouncedQuery  — the query value the preview/describe queries actually use
 *   runNonce        — monotonic counter the `Run` button increments to force
 *                     a preview refetch even when the query string is unchanged
 *
 * Each slice exposes a setter + (where useful) a toggler. Components
 * subscribe to *just* the slices they care about, avoiding the cascade
 * re-renders the giant orchestrator suffered from.
 *
 * Lifecycle:
 *   - Store is **per-route**, not global. The list page and the editor page
 *     instantiate the same module-scoped store, but on navigation the
 *     editor `useEffect` calls `resetEditorStore()` to clear state from a
 *     previous segment.
 *   - State that needs to survive page navigation (e.g. unsaved changes)
 *     belongs in `useUnsavedBarStore`, not here.
 */
export interface SegmentEditorState {
  collapsed: boolean
  templatesOpen: boolean
  debouncedQuery: string
  runNonce: number

  setCollapsed: (collapsed: boolean) => void
  toggleCollapsed: () => void
  setTemplatesOpen: (open: boolean) => void
  setDebouncedQuery: (query: string) => void
  bumpRunNonce: () => void
  reset: (initialQuery: string) => void
}

export const useSegmentEditorStore = create<SegmentEditorState>((set) => ({
  collapsed: false,
  templatesOpen: false,
  debouncedQuery: "",
  runNonce: 0,

  setCollapsed: (collapsed) => set({ collapsed }),
  toggleCollapsed: () => set((s) => ({ collapsed: !s.collapsed })),
  setTemplatesOpen: (templatesOpen) => set({ templatesOpen }),
  setDebouncedQuery: (debouncedQuery) => set({ debouncedQuery }),
  bumpRunNonce: () => set((s) => ({ runNonce: s.runNonce + 1 })),
  reset: (initialQuery) =>
    set({
      collapsed: false,
      templatesOpen: false,
      debouncedQuery: initialQuery,
      runNonce: 0,
    }),
}))

/**
 * Convenience selectors so subscribers only re-render on the slice they
 * care about. Use these in components rather than calling
 * `useSegmentEditorStore(s => s.collapsed)` ad-hoc — the named selector
 * doubles as documentation of which slice each component depends on.
 */
export const editorSelectors = {
  collapsed: (s: SegmentEditorState) => s.collapsed,
  toggleCollapsed: (s: SegmentEditorState) => s.toggleCollapsed,
  templatesOpen: (s: SegmentEditorState) => s.templatesOpen,
  setTemplatesOpen: (s: SegmentEditorState) => s.setTemplatesOpen,
  debouncedQuery: (s: SegmentEditorState) => s.debouncedQuery,
  setDebouncedQuery: (s: SegmentEditorState) => s.setDebouncedQuery,
  runNonce: (s: SegmentEditorState) => s.runNonce,
  bumpRunNonce: (s: SegmentEditorState) => s.bumpRunNonce,
  reset: (s: SegmentEditorState) => s.reset,
} as const
