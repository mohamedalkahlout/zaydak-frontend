"use client"

import { useEffect } from "react"
import type { ProductFormApi } from "@/features/products/validations/product"
import type { ProductKind } from "@/features/products/lib/list/product-kind-meta"
import {
  clearProductDraft,
  writeProductDraft,
} from "@/features/products/lib/form/product-draft"

/** Field changes inside this window collapse into one write. */
export const PRODUCT_DRAFT_DEBOUNCE_MS = 300

interface UseProductDraftOptions {
  form: ProductFormApi
  shopSlug: string
  /** Stored beside the values; see `ProductDraft` for why. */
  kind: ProductKind
  /** Off in edit mode, and until the shell has decided whether a draft exists. */
  enabled: boolean
  /**
   * A save is in flight. Nothing is written while it is: a keystroke a few
   * hundred milliseconds before a fast create would otherwise land after
   * the success handler cleared the draft — resurrecting, on the next "Add
   * product", the product that was just created.
   */
  submitting: boolean
  /**
   * True when the form's defaults *are* the draft. Pristine then means
   * "still equals the draft", so it is kept; on a fresh form pristine means
   * "typed back to empty", and a draft of an empty form would only restore
   * an empty form with a "Draft restored" toast over it.
   */
  restored: boolean
  /**
   * The assistant handoff this form was opened from, if any. Written into the
   * draft so it ends with that ticket rather than resurfacing on a later
   * manual "Add product" — see `ProductDraft.handoff_id`.
   */
  handoffId?: string
}

/**
 * Parks the create form's values in `sessionStorage` as they change, so a
 * reload lands on the form the merchant left rather than an empty one.
 *
 * It listens through `form.subscribe` rather than a top-level `useWatch`:
 * watching every field from `ProductForm` would re-render the whole form —
 * every card — on each keystroke, and this is the heaviest screen in the
 * app. The subscription fires outside React's render, the write is
 * debounced, and nothing here sets state, so typing costs what it did.
 *
 * It deliberately does not flush on unmount: Discard and a successful save
 * both clear the draft and then navigate, and a flush on that unmount
 * would write the draft straight back. `pagehide` is the one flush, for
 * the reload that follows a keystroke too closely. `submitting` is a
 * dependency rather than a check inside the callback so that the effect's
 * own cleanup is what drops a pending write when a save starts — there is
 * no second timer to keep in step.
 */
export function useProductDraft({
  form,
  shopSlug,
  kind,
  enabled,
  submitting,
  restored,
  handoffId,
}: UseProductDraftOptions) {
  useEffect(() => {
    if (!enabled || submitting) return
    // Held in the closure rather than a ref: nothing outside this effect
    // needs it, and a ref invites a read during render.
    let timer: ReturnType<typeof setTimeout> | null = null

    const cancel = () => {
      if (timer === null) return
      clearTimeout(timer)
      timer = null
    }
    const flush = () => {
      if (timer === null) return
      cancel()
      // Read at write time, not at schedule time: the payload's `values` is
      // a shallow snapshot whose nested objects keep moving underneath it,
      // and only the latest state is worth keeping anyway.
      writeProductDraft(shopSlug, {
        kind,
        values: form.getValues(),
        saved_at: Date.now(),
        ...(handoffId ? { handoff_id: handoffId } : {}),
      })
    }

    const unsubscribe = form.subscribe({
      // Only these two keys reach the callback; validation, touch and the
      // submit lifecycle report through the same channel and are filtered
      // out by react-hook-form before they get here.
      formState: { values: true, isDirty: true },
      callback: ({ isDirty }) => {
        cancel()
        if (isDirty || restored) {
          timer = setTimeout(flush, PRODUCT_DRAFT_DEBOUNCE_MS)
          return
        }
        // Typed, then reverted to exactly the defaults. `isDirty` is
        // value-based, so this is the one signal that the form is empty
        // again — and an empty draft is worse than none.
        clearProductDraft(shopSlug)
      },
    })
    window.addEventListener("pagehide", flush)

    return () => {
      unsubscribe()
      window.removeEventListener("pagehide", flush)
      cancel()
    }
  }, [form, shopSlug, kind, enabled, submitting, restored, handoffId])
}
