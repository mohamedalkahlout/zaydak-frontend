"use client"

import { useEffect, useState } from "react"
import {
  useVendorAgentPrefillStore,
  type PrefillPayload,
  type PrefillTarget,
} from "@/features/ai/store-prefill"

/**
 * Handoff ids whose form is mounted right now.
 *
 * Module-level, and it exists for exactly one reason: React's strict mode
 * mounts, unmounts and remounts a component in the same commit. The release
 * below has to tell that apart from the vendor actually leaving, and the only
 * difference between the two is whether a mount follows within the tick.
 */
const mountedHandoffs = new Set<string>()

/**
 * Returns a staged prefill payload (if any) on the current mount, and
 * releases the ticket if the vendor leaves without saving.
 *
 * Reads synchronously via useState's lazy initializer so the values are
 * available BEFORE react-hook-form's `useForm({ defaultValues })` runs
 * during the same render. (Reading in useEffect was too late — the form
 * had already captured the default values without the prefill.)
 *
 * The read is non-destructive: clearing-on-read caused React strict-mode
 * double-mounts to eat the payload before the real mount could use it, and
 * the save needs the ticket too — for the step queued behind it and for
 * where to land the vendor afterwards. So the ticket is consumed in exactly
 * two places: `takeHandoff` when the form saves, and the release here when
 * the vendor walks away from it.
 *
 * **Why release at all.** Without it the ticket only expired, 15 minutes
 * later. A vendor who asked the assistant for a product, looked at the
 * prefilled form and decided against it got that same rejected draft back
 * the next time they opened "Add product" — with no chat on screen to
 * explain where it came from.
 *
 * @param entityId Pass the product id on the edit page so a prefill
 *   staged for product X can't leak into the form for product Y.
 */
export function useVendorAgentPrefill(
  target: PrefillTarget,
  entityId?: string,
): Record<string, unknown> | undefined {
  return useVendorAgentHandoff(target, entityId)?.values
}

/**
 * The whole ticket this mount was opened from, not only its values — same
 * read, same release as `useVendorAgentPrefill`, which is this with
 * `.values` taken.
 *
 * The product form needs the rest: its `handoffId` is what the form registers
 * under as the live form (`lib/live-form.ts`), so a patch from the chat can
 * tell whether the form on screen is still the one it was meant for.
 */
export function useVendorAgentHandoff(
  target: PrefillTarget,
  entityId?: string,
): PrefillPayload | null {
  const [entry] = useState(() =>
    useVendorAgentPrefillStore.getState().peek(target, entityId),
  )

  const handoffId = entry?.handoffId
  useEffect(() => {
    if (!handoffId) return
    mountedHandoffs.add(handoffId)
    return () => {
      mountedHandoffs.delete(handoffId)
      // Deferred by one macrotask. A strict-mode remount re-runs the effect
      // above before this fires and puts the id back, so the ticket survives;
      // a real unmount leaves the set empty and the ticket goes.
      setTimeout(() => {
        if (mountedHandoffs.has(handoffId)) return
        // A save already consumed it — nothing to release, and nothing to
        // undo either, since `clear` on an absent target is a no-op.
        const live = useVendorAgentPrefillStore.getState().pending[target]
        if (live?.handoffId !== handoffId) return
        useVendorAgentPrefillStore.getState().clear(target)
      }, 0)
    }
  }, [handoffId, target])

  return entry
}

/**
 * Imperatively drop the staged prefill for a target.
 *
 * Kept for a caller that has to void a handoff without a form mounted.
 * The ordinary paths do not need it: a save consumes the ticket through
 * `takeHandoff`, and leaving the form releases it through the hook above.
 */
export function clearVendorAgentPrefill(target: PrefillTarget) {
  useVendorAgentPrefillStore.getState().clear(target)
}
