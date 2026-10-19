import type { VendorAgentMessage } from "@/features/ai/lib/types"
import { create } from "zustand"

interface AiChatState {
  open: boolean
  expanded: boolean
  /**
   * A receipt landed while the panel was closed. Cleared on open — the row is
   * already in the thread, so this is only the sparkle-button badge.
   */
  unread: boolean
  /**
   * A prompt queued from outside the panel (e.g. the dashboard welcome
   * input). The panel auto-sends it the moment it opens, then clears it.
   */
  pendingPrompt: string | null

  /**
   * A receipt row the server just wrote, waiting for a mounted chat to show.
   *
   * Deliberately does NOT open the panel. The vendor is on a form they just
   * saved, and a panel sliding out over it is the "stop moving me" complaint
   * in a different costume — the row is already persisted, so a closed panel
   * simply shows it the next time it is opened.
   */
  pendingReceipt: { conversationId: string; message: VendorAgentMessage } | null

  openPanel: () => void
  /** Open the panel and queue a prompt for it to send automatically. */
  openWithPrompt: (prompt: string) => void
  clearPendingPrompt: () => void
  /**
   * Hand a server-written receipt to whichever chat surface is mounted.
   *
   * Carries its conversation id: the panel may be sitting on a different
   * thread by the time it reads this (or on none at all, if it has not been
   * opened yet this session), and appending a receipt into the wrong
   * conversation would be a message about work that thread never asked for.
   */
  pushReceipt: (conversationId: string, message: VendorAgentMessage) => void
  clearPendingReceipt: () => void
  closePanel: () => void
  togglePanel: () => void
  toggleExpanded: () => void
}

export const useAiChatStore = create<AiChatState>((set) => ({
  open: false,
  expanded: false,
  unread: false,
  pendingPrompt: null,
  pendingReceipt: null,

  openPanel: () => set({ open: true, unread: false }),
  openWithPrompt: (prompt) =>
    set({ open: true, pendingPrompt: prompt, unread: false }),
  clearPendingPrompt: () => set({ pendingPrompt: null }),
  pushReceipt: (conversationId, message) =>
    set((state) => ({
      pendingReceipt: { conversationId, message },
      unread: state.open ? false : true,
    })),
  clearPendingReceipt: () => set({ pendingReceipt: null }),
  closePanel: () => set({ open: false, expanded: false }),
  togglePanel: () =>
    set((state) => {
      const open = !state.open
      return {
        open,
        expanded: open ? state.expanded : false,
        unread: open ? false : state.unread,
      }
    }),
  toggleExpanded: () => set((state) => ({ expanded: !state.expanded })),
}))
