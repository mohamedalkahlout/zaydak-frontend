import { create } from "zustand"

export interface UnsavedBarState {
  active: boolean
  label: string
  saving: boolean
  /**
   * Populated by the submit handler when the most recent save failed.
   * The header switches to an error skin while this is non-empty; clears
   * on the next save attempt or when the bar unmounts.
   */
  error: string | null
  /**
   * Monotonically increments every time `setError(msg)` is called with a
   * non-null value. The header uses it as a remount key so the shake
   * animation plays fresh even when the same error message repeats.
   */
  errorNonce: number
  discardHref?: string
  onSave?: () => void
  onDiscard?: () => void
  show: (
    config: Pick<
      UnsavedBarState,
      "label" | "saving" | "discardHref" | "onSave" | "onDiscard"
    >,
  ) => void
  update: (
    patch: Partial<
      Pick<
        UnsavedBarState,
        "label" | "saving" | "discardHref" | "onSave" | "onDiscard"
      >
    >,
  ) => void
  setError: (error: string | null) => void
  hide: () => void
}

export const useUnsavedBarStore = create<UnsavedBarState>((set) => ({
  active: false,
  label: "Unsaved changes",
  saving: false,
  error: null,
  errorNonce: 0,
  discardHref: undefined,
  onSave: undefined,
  onDiscard: undefined,
  show: (config) =>
    set({
      active: true,
      label: config.label,
      saving: config.saving,
      discardHref: config.discardHref,
      onSave: config.onSave,
      onDiscard: config.onDiscard,
    }),
  update: (patch) => set((state) => ({ ...state, ...patch })),
  setError: (error) =>
    set((state) => ({
      error,
      errorNonce: error ? state.errorNonce + 1 : state.errorNonce,
    })),
  hide: () =>
    set({
      active: false,
      saving: false,
      error: null,
      onSave: undefined,
      onDiscard: undefined,
      discardHref: undefined,
    }),
}))
