"use client"

import { useCallback } from "react"
import { useMutation } from "@apollo/client/react"
import { VENDOR_AGENT_SAVE_RECEIPT } from "@/features/ai/api/mutations"
import { useAiChatStore } from "@/features/ai/store-chat"
import type { PrefillPayload } from "@/features/ai/store-prefill"
import type { VendorAgentMessage } from "@/features/ai/lib/types"

export type ReceiptEntity = "product" | "collection" | "coupon"
export type ReceiptAction = "created" | "updated"

interface SaveReceiptResponse {
  vendorAgentSaveReceipt: VendorAgentMessage
}

/**
 * Close the loop the vendor asked for: "as soon as I hit save, the assistant
 * knows, and tells me it's done."
 *
 * The server writes the sentence, so this costs no model turn. That is the
 * decision worth knowing: every agent turn runs `reserveTurn`/`settleTurn`
 * against the shop's plan allowance and the platform's budget, and a message
 * that is always "تمام، خلصنا" would bill a real generation on every save
 * forever — while also being slower than the save it acknowledges, and able
 * to fail on an overloaded provider.
 *
 * **Scope.** Only a save that completed a handoff the agent opened gets one,
 * which is what the ticket is for; a vendor adding a product by hand is not
 * in a conversation and must not be answered as though they were. And a
 * handoff carrying a `nextStep` gets none either — the chained resume is
 * already about to speak, and two messages about one save read as two saves.
 *
 * Never throws. The entity is saved by the time this runs and the vendor has
 * been told so by a toast; a receipt that could turn a successful save into
 * an error message would be worse than no receipt.
 */
export function useSaveReceipt() {
  const [record] = useMutation<SaveReceiptResponse>(VENDOR_AGENT_SAVE_RECEIPT)
  const pushReceipt = useAiChatStore((s) => s.pushReceipt)

  return useCallback(
    async (
      handoff: PrefillPayload | null,
      details: {
        entity: ReceiptEntity
        action: ReceiptAction
        name: string
        url?: string
      },
    ) => {
      if (!handoff?.conversationId || handoff.nextStep) return
      const name = details.name.trim()
      if (!name) return
      try {
        const { data } = await record({
          variables: {
            input: {
              conversation_id: handoff.conversationId,
              handoff_id: handoff.handoffId,
              entity: details.entity,
              action: details.action,
              name,
              url: details.url,
            },
          },
        })
        const message = data?.vendorAgentSaveReceipt
        if (message) pushReceipt(handoff.conversationId, message)
      } catch {
        // Deliberately silent. The save worked; the acknowledgement is the
        // only thing that did not, and the row is recoverable by reloading
        // the thread if the mutation actually landed.
      }
    },
    [record, pushReceipt],
  )
}
