"use client"

import { useState } from "react"
import { useMutation } from "@apollo/client/react"
import { useLocale } from "next-intl"
import {
  AI_TEXT_TRANSFORM,
  aiTextVariables,
  type AiAction,
  type AiTextData,
} from "@/shared/lib/ai-text"
import type {
  StoreImportField,
  StoreImportProduct,
} from "@/features/products/api"
import { useFeature } from "@/features/plan/lib/use-feature"
import {
  aiAnswerForField,
  aiCapabilityFor,
  aiErrorKey,
  aiPlanDeniedKey,
  aiSourceFor,
  aiTargetFor,
} from "@/features/products/lib/store-import-ai"

/** `handle:field_key` — one cell, across pages and products. */
type CellKey = string

const cellKey = (handle: string, fieldKey: string): CellKey =>
  `${handle}:${fieldKey}`

export interface StoreImportAi {
  /** The cell a call is running for, or null. */
  pending: CellKey | null
  /** The answer waiting on a decision, when the cell already had a value. */
  proposal: { cell: CellKey; value: string } | null
  /** Message key under `products.import.review`, for the cell that failed. */
  error: { cell: CellKey; key: string } | null
  run: (args: {
    product: StoreImportProduct
    field: StoreImportField
    action: AiAction
    /** What the cell will import today — the source, and the thing at risk. */
    own: string
    /** The reference column's value; the English, on a translation row. */
    reference: string
    /** What the merchant has typed. Non-empty means propose, never overwrite. */
    typed: string
    stage: (value: string) => void
  }) => void
  accept: (stage: (value: string) => void) => void
  dismiss: () => void
  /**
   * Why this action is disabled, as a `products.import.review` message key.
   * Null while entitlements load, and when the plan includes it with quota left.
   */
  deniedKey: (action: AiAction) => string | null
}

/**
 * The review screen's AI assist, wired.
 *
 * Three rules, and all three are about not spending or destroying anything a
 * merchant did not ask to spend or destroy.
 *
 * **One call in flight for the whole screen.** Not per row: each call is
 * billed against the shop's plan and counted against a per-user limiter that
 * allows thirty an hour, and a row of sparkle buttons is an invitation to
 * press four of them. A single `pending` key is also what lets every other
 * button disable itself while one runs.
 *
 * **An answer never overwrites a merchant's own words.** Into an empty cell it
 * is staged directly, exactly as if they had typed it — `stageField` does the
 * writing, so Revert, Discard, the save bar and the leave guard all keep
 * working with no special case. Into a cell they have already filled it
 * becomes a *proposal* they accept or dismiss. The distinction is the whole
 * reason this hook holds state at all.
 *
 * **Nothing here saves.** Staging raises the toolbar's Save; the merchant's
 * press is what sends it, and the approval on the progress screen is still the
 * only thing that writes a product.
 *
 * Apollo's own callbacks do the state writing rather than an `await` in the
 * caller, which is the shape the React Compiler's `set-state-in-effect` rule
 * asks for — and the shape that makes the stale-answer check natural: the cell
 * is captured per call, so an answer for a product the merchant has navigated
 * away from is dropped rather than staged into whatever is on screen now.
 */
export function useStoreImportAi(): StoreImportAi {
  const locale = useLocale()
  const [transform] = useMutation<AiTextData>(AI_TEXT_TRANSFORM)
  const rewrite = useFeature("ai.text.rewrite")
  const summarize = useFeature("ai.text.summarize")
  const translate = useFeature("ai.text.translate")
  const generate = useFeature("ai.text.generate")

  const [pending, setPending] = useState<CellKey | null>(null)
  const [proposal, setProposal] = useState<StoreImportAi["proposal"]>(null)
  const [error, setError] = useState<StoreImportAi["error"]>(null)

  const deniedKey: StoreImportAi["deniedKey"] = (action) => {
    const key = aiCapabilityFor(action)
    const state =
      key === "ai.text.summarize"
        ? summarize
        : key === "ai.text.translate"
          ? translate
          : key === "ai.text.generate"
            ? generate
            : rewrite
    return aiPlanDeniedKey(state)
  }

  const run: StoreImportAi["run"] = ({
    product,
    field,
    action,
    own,
    reference,
    typed,
    stage,
  }) => {
    if (pending) return
    const cell = cellKey(product.handle, field.key)
    const gated = deniedKey(action)
    if (gated) {
      setError({ cell, key: gated })
      return
    }
    const source = aiSourceFor({ own, reference, field })
    if (!source.trim()) {
      // Nothing to work from. A translation row whose English is empty is the
      // common case, and spending a call to be told so is worse than saying it.
      setError({ cell, key: "aiNoSource" })
      return
    }

    setPending(cell)
    setProposal(null)
    setError(null)

    void transform({
      variables: aiTextVariables({
        action,
        source,
        // The answer's language: an Arabic target is asked for in Arabic
        // whatever the dashboard is set to, because the field is the Arabic
        // one. Everything else follows the merchant's own locale.
        locale: field.key.endsWith("_ar")
          ? "ar"
          : field.key.endsWith("_en")
            ? "en"
            : locale,
        target: aiTargetFor(field),
        maxLength: field.max_length ?? undefined,
      }),
      // A rewrite is never a cache read, and caching one would hand the same
      // sentence back for a second press of the same button.
      fetchPolicy: "no-cache",
      onCompleted: (data) => {
        setPending(null)
        const raw = data?.aiEditorTransform?.success
          ? (data.aiEditorTransform.html ?? "")
          : ""
        const value = aiAnswerForField(field, raw)
        if (!value) {
          setError({ cell, key: "aiEmpty" })
          return
        }
        // The one branch that matters: a cell the merchant has filled gets a
        // proposal, never a replacement.
        if (typed.trim()) setProposal({ cell, value })
        else stage(value)
      },
      onError: (err) => {
        setPending(null)
        setError({ cell, key: aiErrorKey(err) })
      },
    })
  }

  return {
    pending,
    proposal,
    error,
    run,
    accept: (stage) => {
      if (!proposal) return
      stage(proposal.value)
      setProposal(null)
    },
    dismiss: () => {
      setProposal(null)
      setError(null)
    },
    deniedKey,
  }
}
