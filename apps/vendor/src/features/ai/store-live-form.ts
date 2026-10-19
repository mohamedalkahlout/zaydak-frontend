import { create } from "zustand"
import type { PrefillTarget } from "@/features/ai/store-prefill"

/**
 * The live form channel: which assistant-prepared form is mounted right now,
 * so the chat can send its values with each message and stage a patch back
 * into it.
 *
 * Why it exists. A handoff form reads its prefill once, at mount. A second
 * card for the form already on screen pushed the URL the vendor was on, which
 * does not remount, so "no, make it 300" never reached the form. With this the
 * form registers itself while it is mounted; the chat reads it when sending
 * (`currentLiveForm`) and applies `patch_form` results to it
 * (`applyFormPatchFromResult`), both in `lib/live-form.ts`.
 *
 * Not persisted: a registration is a live component's callbacks, meaningless
 * after a reload — the form registers again when it mounts.
 *
 * Written from effects and stream handlers only, never during render.
 */

/**
 * The forms that can be live: every form an assistant card opens — the
 * product, coupon and collection forms. (There is no `collection_edit`:
 * `update_collection` writes directly and opens no form.)
 */
export type LiveFormTarget = PrefillTarget

/** The targets that edit one saved row, which a registration then names. */
export const EDIT_TARGETS: ReadonlySet<string> = new Set<LiveFormTarget>([
  "product_edit",
  "coupon_edit",
])

export interface LiveFormRegistration {
  /** The handoff id of the ticket the form was opened from. */
  formId: string
  target: LiveFormTarget
  /** The product or coupon being edited; absent on a create form. */
  entityId?: string
  /** What the composer's chip calls the form on an edit: the product's saved
   * title, the coupon's saved code. Absent on a create form, which the chip
   * calls "New product" / "New coupon" / "New collection". */
  label?: string
  /** The form's current values, already reduced to the channel's allow-list. */
  snapshot: () => Record<string, unknown>
  /** Stage a patch into the form; returns the full values it wrote. */
  apply: (values: Record<string, unknown>) => Record<string, unknown>
}

/**
 * What became of one `patch_form` result. `applied` — it reached the form it
 * was meant for. `stale` — that form was gone (closed, saved, or replaced)
 * before the result arrived, so nothing changed.
 */
export type LiveFormOutcome = "applied" | "stale"

interface LiveFormState {
  current: LiveFormRegistration | null
  /** Keyed by the result's `patch_id`. Session memory only: a reloaded
   * thread has no outcome, and its card says so neutrally. */
  outcomes: Record<string, LiveFormOutcome>
  /**
   * Make `reg` the live form. Returns the unregister function, which is a
   * no-op once a newer registration has replaced this one — the same rule as
   * the leave guard's `disarm`, so a form unmounting after its replacement
   * mounted cannot take the replacement down with it.
   */
  register: (reg: LiveFormRegistration) => () => void
  recordOutcome: (patchId: string, outcome: LiveFormOutcome) => void
}

export const useLiveFormStore = create<LiveFormState>((set, get) => ({
  current: null,
  outcomes: {},
  register: (reg) => {
    set({ current: reg })
    return () => {
      if (get().current === reg) set({ current: null })
    }
  },
  recordOutcome: (patchId, outcome) =>
    set((state) => ({ outcomes: { ...state.outcomes, [patchId]: outcome } })),
}))
