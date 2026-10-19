import { create } from "zustand"

import type { AssistantMessage } from "./types"

/**
 * How big the panel is.
 *
 * There was a third, `docked` — a full-height rail at the inline edge. It was
 * built to match a reference and removed on the merchant's own reading: a
 * storefront assistant is something you consult beside the page, not a second
 * column you give a quarter of the screen to. Nothing replaced it, which is the
 * point.
 */
export type AssistantMode = "compact" | "expanded"

export interface AssistantConversation {
  id: string
  /** The first thing the shopper said — what the history list shows. */
  title: string
  messages: AssistantMessage[]
  at: number
}

interface AssistantState {
  mode: AssistantMode
  setMode: (mode: AssistantMode) => void

  /** Whether the launcher panel is open. Owned here so PDP can open it. */
  open: boolean
  setOpen: (open: boolean) => void

  /**
   * Prompt to send once the panel mounts (e.g. negotiate from PDP).
   * Consumed by the panel; null when idle.
   */
  pendingPrompt: string | null
  /**
   * The product a caller opened the panel *about*, when it is not simply the
   * page underneath.
   *
   * The PDP's negotiate button used to put the slug in the shopper's own
   * message — "(slug: bydh-fakhr-30-hbh-2)" in their chat bubble — because the
   * tool had no other way to learn which product was meant. It now travels
   * beside the message instead of inside it.
   *
   * Sticky for the conversation rather than for one turn: a haggle is a run of
   * bare numbers, and each of them is about the product the shopper opened the
   * panel on, even after they navigate away from its page.
   */
  subjectProductSlug: string | null
  /**
   * The option of that product selected on its page — a size or colour. A
   * price is agreed per option, and without it the assistant asked which one
   * while it sat selected on screen. Sticky with the product, and cleared
   * with it.
   */
  subjectVariationId: string | null
  /** Open the ask-anything chat, optionally seeding the first customer turn. */
  openWithPrompt: (
    prompt?: string,
    subjectProductSlug?: string | null,
    subjectVariationId?: string | null,
  ) => void
  consumePendingPrompt: () => string | null

  /** The transcript on screen. */
  messages: AssistantMessage[]
  setMessages: (next: (prev: AssistantMessage[]) => AssistantMessage[]) => void

  /** Earlier conversations from this tab, newest first. */
  history: AssistantConversation[]
  /** File the current transcript and start empty. */
  startNew: () => void
  /** Bring an earlier one back, filing whatever is on screen first. */
  restore: (id: string) => void
}

/**
 * The panel's own memory, for as long as the tab is open.
 *
 * **Nothing here reaches a server, and that is the product decision.** A
 * WhatsApp thread is the merchant's record and belongs in their inbox; a shopper
 * asking about a tote is not correspondence, and filing every idle question
 * would build a support archive nobody asked for.
 *
 * So "history" means *this tab*. It survives closing and reopening the panel and
 * navigating between pages — which is what a shopper actually expects when they
 * minimise something mid-question — and it ends with the tab. Deliberately not
 * `sessionStorage`: reading it back would resurrect a conversation after a
 * reload the shopper may have done precisely to be rid of it, and buys little
 * over a store that already outlives every navigation in a SPA.
 *
 * A module store rather than component state for the same reason the mode lives
 * here: `AssistantPanel` unmounts every time the pill closes, and state inside
 * it would take the conversation with it.
 */
export const useAssistantStore = create<AssistantState>((set, get) => ({
  mode: "compact",
  setMode: (mode) => set({ mode }),

  open: false,
  setOpen: (open) => set({ open }),

  pendingPrompt: null,
  subjectProductSlug: null,
  subjectVariationId: null,
  openWithPrompt: (prompt, subjectProductSlug, subjectVariationId) =>
    set({
      open: true,
      pendingPrompt: prompt?.trim() ? prompt.trim() : null,
      subjectProductSlug: subjectProductSlug ?? null,
      // Only ever with its product: an option alone names nothing.
      subjectVariationId: subjectProductSlug
        ? (subjectVariationId ?? null)
        : null,
    }),
  consumePendingPrompt: () => {
    const prompt = get().pendingPrompt
    set({ pendingPrompt: null })
    return prompt
  },

  messages: [],
  setMessages: (next) => set((state) => ({ messages: next(state.messages) })),

  history: [],

  startNew: () =>
    set((state) => ({
      messages: [],
      subjectProductSlug: null,
      subjectVariationId: null,
      history: fileCurrent(state.messages, state.history),
    })),

  restore: (id) => {
    const state = get()
    const wanted = state.history.find((c) => c.id === id)
    if (!wanted) return
    set({
      messages: wanted.messages,
      // The restored one leaves the list and whatever was on screen joins it,
      // so the same conversation is never in two places at once.
      history: fileCurrent(
        state.messages,
        state.history.filter((c) => c.id !== id),
      ),
    })
  },
}))

/**
 * Move a transcript into the history list, if it is worth keeping.
 *
 * An empty panel is not a conversation, and filing one would leave the shopper
 * a list of blank rows they never started.
 */
function fileCurrent(
  messages: AssistantMessage[],
  history: AssistantConversation[],
): AssistantConversation[] {
  if (messages.length === 0) return history
  const first = messages.find((m) => m.role === "customer")
  return [
    {
      id: `c${Date.now()}`,
      title: first?.text ?? "",
      messages,
      at: Date.now(),
    },
    ...history,
  // Capped: this is a browsing aid, not an archive, and an unbounded list in
  // memory is a leak on a long session.
  ].slice(0, 20)
}
