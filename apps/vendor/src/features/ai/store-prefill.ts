import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

/**
 * Targets correspond to the vendor-agent tool `navigate_to_form.target` field.
 * Each one maps to exactly one form page in the dashboard.
 */
export type PrefillTarget =
  | "product_create"
  | "product_edit"
  | "collection_create"
  | "coupon_create"
  | "coupon_edit"

export interface PrefillPayload {
  target: PrefillTarget
  /**
   * Identity for this one handoff, minted when the vendor opens the form.
   *
   * It is what makes a save attributable. Before it, the follow-up step was
   * a single global slot with no owner, so a coupon-edit save — a screen the
   * agent cannot even queue a step against, since `update_coupon` has no form
   * handoff — would happily consume the step staged for a product the vendor
   * had not saved yet. Everything downstream of a save (the resume, and the
   * receipt the chat writes) is keyed on this id rather than on "whatever was
   * in the global slot when a form happened to save".
   */
  handoffId: string
  /** For edits only — scopes the prefill to one specific entity so the
   * form doesn't pick it up for a different product. */
  entityId?: string
  /** Partial form values merged into defaultValues at form mount. */
  values: Record<string, unknown>
  /**
   * What the agent wants done AFTER this form is saved, in the vendor's
   * language ("اعمل كوبون خصم 15% على هذا المنتج").
   *
   * It rides on the ticket rather than in a store of its own because the two
   * are one fact: a form-handoff tool returns `prefill` and `next_step` as
   * siblings, and splitting them across two stores is what let them get out
   * of step — the `/ai` page's auto-navigation stashed the prefill and
   * dropped the next step entirely, so a chained request begun there could
   * never finish.
   */
  nextStep?: string
  /**
   * The conversation this handoff came out of.
   *
   * Captured when the vendor clicks the card, not when they save: a receipt
   * belongs in the thread that asked for the work, and by save time they may
   * have switched threads. Absent when the chat had not started one yet.
   */
  conversationId?: string
  /**
   * A warehouse the vendor picked in chat for this product's opening stock.
   *
   * Not a form value: `createProduct` seeds the quantity at the shop's
   * default location and the create form has no control for this. The submit
   * hook moves it once the product has an id, which is the same two steps a
   * vendor would do by hand.
   */
  placeStockAt?: { id: string; name: string; quantity: number }
  /** Wall-clock expiry — prefill is dropped if the vendor takes too long
   * to open the form after asking the AI. */
  expires_at: number
}

interface PrefillState {
  pending: Partial<Record<PrefillTarget, PrefillPayload>>
  setPending: (payload: PrefillPayload) => void
  /**
   * Read the pending payload without deleting it. Use this from a form's
   * lazy-init state so React strict mode's double-mount cannot "eat" the
   * prefill before the real mount runs. TTL + the entityId scope guard
   * against stale reuse.
   *
   * **Pure.** It used to garbage-collect an expired entry with a `set()` of
   * its own, which was invisible only because nothing subscribed to this
   * store with a hook — the moment one does, a `set()` reached from a
   * `useState` initializer is React's "Cannot update a component while
   * rendering a different component". Expiry is now swept on write, where
   * there is no render to interrupt.
   */
  peek: (target: PrefillTarget, entityId?: string) => PrefillPayload | null
  clear: (target: PrefillTarget) => void
}

/** 15 minutes — long enough for the vendor to review, short enough that a
 * stale prefill from a forgotten chat doesn't resurface weeks later. */
const DEFAULT_TTL_MS = 15 * 60 * 1000

/** Drop every entry whose TTL has passed. Called on write, never on read. */
function sweep(
  pending: Partial<Record<PrefillTarget, PrefillPayload>>,
  now: number,
): Partial<Record<PrefillTarget, PrefillPayload>> {
  const out: Partial<Record<PrefillTarget, PrefillPayload>> = {}
  for (const [key, entry] of Object.entries(pending)) {
    if (entry && now <= entry.expires_at) {
      out[key as PrefillTarget] = entry
    }
  }
  return out
}

export const useVendorAgentPrefillStore = create<PrefillState>()(
  persist(
    (set, get) => ({
      pending: {},

      setPending: (payload) =>
        set((state) => ({
          pending: {
            ...sweep(state.pending, Date.now()),
            [payload.target]: payload,
          },
        })),

      peek: (target, entityId) => {
        const entry = get().pending[target]
        if (!entry) return null

        // Expired entries read as absent. The actual delete happens on the
        // next write — see `sweep`.
        if (Date.now() > entry.expires_at) return null

        // Edit-target scoping: the prefill was staged for product X; if
        // the form mounting is for product Y, don't bleed the values.
        if (entry.entityId && entityId && entry.entityId !== entityId) {
          return null
        }

        return entry
      },

      clear: (target) =>
        set((state) => {
          const { [target]: _dropped, ...rest } = state.pending
          return { pending: rest }
        }),
    }),
    {
      name: "vendor_agent_prefill",
      // sessionStorage — not localStorage: prefill is a within-session
      // handoff from chat → form, not durable user state.
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? (undefined as never) : sessionStorage,
      ),
    },
  ),
)

/**
 * A handoff id that is unique within the session.
 *
 * `crypto.randomUUID` needs a secure context, which a merchant on a plain
 * `http://` staging host does not have, so the counter is a real fallback
 * rather than defensive padding. Uniqueness within one tab is all this has
 * to buy: the id is only ever compared against a ticket in the same tab's
 * sessionStorage.
 */
let handoffSeq = 0
function mintHandoffId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  handoffSeq += 1
  return `handoff-${Date.now()}-${handoffSeq}`
}

/**
 * Imperatively stash a prefill payload before navigating. Used by the
 * NavigateToFormCard onClick handler. Returns the minted handoff id.
 */
export function stashPrefill(args: {
  target: PrefillTarget
  values: Record<string, unknown>
  entityId?: string
  nextStep?: string
  conversationId?: string
  placeStockAt?: { id: string; name: string; quantity: number }
  ttlMs?: number
}): string {
  const handoffId = mintHandoffId()
  const expires_at = Date.now() + (args.ttlMs ?? DEFAULT_TTL_MS)
  useVendorAgentPrefillStore.getState().setPending({
    target: args.target,
    handoffId,
    entityId: args.entityId,
    values: args.values,
    nextStep: args.nextStep,
    conversationId: args.conversationId,
    placeStockAt: args.placeStockAt,
    expires_at,
  })
  return handoffId
}

/**
 * Read **and clear** the whole ticket for a target.
 *
 * This is the save-time half of the handoff: the form has just written the
 * entity, so the ticket has done its job and must not survive to be matched
 * against an unrelated save later. Returns null when the vendor reached this
 * form on their own, which is the ordinary case and not an error.
 */
export function takeHandoff(
  target: PrefillTarget,
  entityId?: string,
): PrefillPayload | null {
  const store = useVendorAgentPrefillStore.getState()
  const entry = store.peek(target, entityId)
  if (!entry) return null
  store.clear(target)
  return entry
}
