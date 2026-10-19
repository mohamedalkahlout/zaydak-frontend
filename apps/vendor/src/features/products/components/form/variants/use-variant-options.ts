"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import type {
  ProductFormApi,
  ProductOptionDefinitionInput,
  VariationOptionInput,
} from "@/features/products/validations/product"

/**
 * A single option axis (like "color" or "size") as managed by the UI.
 * Draft values are kept separate from committed values so the user can
 * freely edit without mutating variants until they click "Done".
 */
export interface OptionAxis {
  id: string               // stable client-side key
  name: string             // committed name (empty when not yet committed)
  values: string[]         // committed values, in order
  isEditing: boolean
  draftName: string
  draftValues: string[]    // chips being built before commit
  /**
   * Set when the axis was created via a metafield "Connect to option"
   * action. Renders as a small DB-icon badge on the axis row so the
   * user knows the axis is linked to a category attribute.
   *
   * `options` is the allowed value set for this attribute — when
   * present, the axis row uses a constrained picker instead of a free
   * text input, so the user can only pick from the schema's options.
   */
  connectedAttribute?: {
    key: string
    label: string
    options: { value: string; label: string }[]
  }
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

function optionsKey(options: Record<string, string>): string {
  return Object.keys(options)
    .sort()
    .map((k) => `${k}=${options[k]}`)
    .join("|")
}

function cartesian(axes: OptionAxis[]): Record<string, string>[] {
  const committed = axes.filter(
    (a) => !a.isEditing && a.name.trim() !== "" && a.values.length > 0,
  )
  if (committed.length === 0) return []
  let rows: Record<string, string>[] = [{}]
  for (const axis of committed) {
    const next: Record<string, string>[] = []
    for (const row of rows) {
      for (const v of axis.values) {
        next.push({ ...row, [axis.name]: v })
      }
    }
    rows = next
  }
  return rows
}

/**
 * Build the initial axes list from any variations already on the form
 * (edit mode), preserving insertion order of keys and values.
 */
function axesFromVariations(variations: VariationOptionInput[]): OptionAxis[] {
  const map = new Map<string, string[]>()
  for (const v of variations) {
    for (const [k, val] of Object.entries(v.options ?? {})) {
      const str = String(val)
      if (!map.has(k)) map.set(k, [])
      const list = map.get(k)!
      if (!list.includes(str)) list.push(str)
    }
  }
  return Array.from(map.entries()).map(([name, values]) => ({
    id: uuid(),
    name,
    values,
    isEditing: false,
    draftName: name,
    draftValues: [...values],
  }))
}

/**
 * Central store for the option-axes UI. Mirrors Shopify's "Variants"
 * editor: each axis is a name + a list of values; the cartesian product
 * of all committed axes is materialised into `variation_options` on the
 * form. Per-variation details (price, SKU, quantity) are preserved
 * across edits by matching on the `options` fingerprint.
 */
export interface UseVariantOptionsConfig {
  /**
   * Open the editor on one blank axis when the product has no variations
   * yet. Set by the "Product with options" choice in the "Add product"
   * dialog, so that kind lands the merchant in the option editor rather
   * than on a form indistinguishable from a simple product.
   *
   * Seeded in the state initializer rather than through `addAxis`, which
   * would run `syncFormVariations` for a draft axis that materialises no
   * variants — a no-op write that would mark the fresh form dirty.
   */
  startWithAxis?: boolean
}

export function useVariantOptions(
  form: ProductFormApi,
  config: UseVariantOptionsConfig = {},
) {
  const [axes, setAxes] = useState<OptionAxis[]>(() => {
    const existing = axesFromVariations(
      (form.getValues("variation_options") as VariationOptionInput[]) ?? [],
    )
    if (existing.length > 0 || !config.startWithAxis) return existing
    return [
      {
        id: uuid(),
        name: "",
        values: [],
        isEditing: true,
        draftName: "",
        draftValues: [],
      },
    ]
  })

  /**
   * Mirror of `axes` so an updater can read the latest list without going
   * through `setAxes(prev => ...)`. Writing the form from inside a state
   * updater is what a `useState` setter must never do: React replays
   * updaters during the render phase, and `syncFormVariations` calls
   * `form.setValue`, whose react-hook-form subscribers (the `useFieldArray`
   * behind `VariantsTable`) then setState while `ProductForm` is rendering.
   * Every write goes through `writeAxes`, which keeps the two in step.
   */
  const axesRef = useRef(axes)

  const syncFormVariations = useCallback(
    (next: OptionAxis[]) => {
      const combos = cartesian(next)
      const existing =
        (form.getValues("variation_options") as VariationOptionInput[]) ?? []
      const byKey = new Map<string, VariationOptionInput>()
      for (const e of existing) {
        byKey.set(optionsKey((e.options as Record<string, string>) ?? {}), e)
      }

      // Shopify-style option_definitions — committed axes only. The backend's
      // `validateVariationsAgainstDefinitions` matches on `name.en` and
      // `values[].label.en`, so we ship the axis name + value list under the
      // English locale. The Arabic locale stays free for the vendor to fill
      // in via a future inline editor without breaking server-side checks.
      const committedAxes = next.filter(
        (a) => !a.isEditing && a.name.trim() && a.values.length > 0,
      )
      const definitions: ProductOptionDefinitionInput[] = committedAxes.map(
        (axis, idx) => ({
          name: { en: axis.name, ar: "" },
          position: idx + 1,
          values: axis.values.map((v) => ({ label: { en: v, ar: "" } })),
        }),
      )

      if (combos.length === 0) {
        form.setValue("variation_options", [], {
          shouldDirty: true,
          shouldValidate: false,
        })
        form.setValue("option_definitions", definitions, {
          shouldDirty: true,
          shouldValidate: false,
        })
        return
      }

      const nextVariations: VariationOptionInput[] = combos.map((combo, idx) => {
        const key = optionsKey(combo)
        const match = byKey.get(key)
        if (match) return { ...match, options: combo, position: idx }
        const title = Object.values(combo).join(" / ")
        return {
          id: undefined,
          title: { en: title, ar: "" },
          options: combo,
          price: 0,
          quantity: 0,
          position: idx,
          is_disable: false,
        }
      })

      form.setValue("variation_options", nextVariations, {
        shouldDirty: true,
        shouldValidate: false,
      })
      form.setValue("option_definitions", definitions, {
        shouldDirty: true,
        shouldValidate: false,
      })

      // Product becomes VARIABLE once variants exist; revert to SIMPLE only
      // if the user is currently on VARIABLE (don't override DIGITAL/SERVICE).
      const currentType = form.getValues("product_type")
      if (nextVariations.length > 0 && currentType !== "VARIABLE") {
        form.setValue("product_type", "VARIABLE", {
          shouldDirty: true,
          shouldValidate: false,
        })
      } else if (nextVariations.length === 0 && currentType === "VARIABLE") {
        form.setValue("product_type", "SIMPLE", {
          shouldDirty: true,
          shouldValidate: false,
        })
      }
    },
    [form],
  )

  /**
   * Single write path for the axes list. `sync` decides whether the change
   * materialises variants on the form — draft edits (typing a name, adding a
   * chip) must not, since nothing is committed until "Done".
   */
  const writeAxes = useCallback(
    (updater: (prev: OptionAxis[]) => OptionAxis[], sync: boolean) => {
      const next = updater(axesRef.current)
      axesRef.current = next
      setAxes(next)
      if (sync) syncFormVariations(next)
    },
    [syncFormVariations],
  )

  const updateAxes = useCallback(
    (updater: (prev: OptionAxis[]) => OptionAxis[]) => {
      writeAxes(updater, true)
    },
    [writeAxes],
  )

  const addAxis = useCallback(() => {
    updateAxes((prev) => [
      ...prev,
      {
        id: uuid(),
        name: "",
        values: [],
        isEditing: true,
        draftName: "",
        draftValues: [],
      },
    ])
  }, [updateAxes])

  const removeAxis = useCallback(
    (id: string) => {
      updateAxes((prev) => prev.filter((a) => a.id !== id))
    },
    [updateAxes],
  )

  const startEdit = useCallback(
    (id: string) => {
      updateAxes((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, isEditing: true, draftName: a.name, draftValues: [...a.values] }
            : a,
        ),
      )
    },
    [updateAxes],
  )

  const setDraftName = useCallback(
    (id: string, name: string) => {
      writeAxes(
        (prev) => prev.map((a) => (a.id === id ? { ...a, draftName: name } : a)),
        false,
      )
    },
    [writeAxes],
  )

  const setDraftValues = useCallback(
    (id: string, values: string[]) => {
      writeAxes(
        (prev) =>
          prev.map((a) => (a.id === id ? { ...a, draftValues: values } : a)),
        false,
      )
    },
    [writeAxes],
  )

  const commitAxis = useCallback(
    (id: string) => {
      updateAxes((prev) =>
        prev.map((a) => {
          if (a.id !== id) return a
          const trimmedName = a.draftName.trim()
          const values = a.draftValues.map((v) => v.trim()).filter(Boolean)
          // Keep editing if required fields aren't valid yet.
          if (!trimmedName || values.length === 0) return { ...a, isEditing: true }
          return {
            ...a,
            name: trimmedName,
            values: Array.from(new Set(values)),
            isEditing: false,
          }
        }),
      )
    },
    [updateAxes],
  )

  const cancelEdit = useCallback(
    (id: string) => {
      updateAxes((prev) =>
        prev.flatMap((a) => {
          if (a.id !== id) return [a]
          // Discard: if the axis was never committed, drop it entirely.
          if (a.name.trim() === "" || a.values.length === 0) return []
          return [
            {
              ...a,
              isEditing: false,
              draftName: a.name,
              draftValues: [...a.values],
            },
          ]
        }),
      )
    },
    [updateAxes],
  )

  const hasCommittedAxes = useMemo(
    () => axes.some((a) => !a.isEditing && a.name && a.values.length > 0),
    [axes],
  )

  /**
   * Turn a category metafield into a variant axis and open it for
   * editing so the user can review / trim / extend the value set
   * before committing (PRODUCTS.md §16.4 + user request). Does NOT
   * auto-commit — variations are only generated when the user clicks
   * "Done" on the axis row.
   *
   * Any already-selected option values are pre-filled into the draft
   * chips as a convenience; otherwise the chip list starts empty.
   */
  const connectAttribute = useCallback(
    (
      key: string,
      label: string,
      initialValues: string[] = [],
      options: { value: string; label: string }[] = [],
    ) => {
      const trimmedLabel = label.trim() || key
      // Deduplicate allowed options + normalise (preserve incoming order).
      const seenOpts = new Set<string>()
      const normalisedOptions: { value: string; label: string }[] = []
      for (const opt of options) {
        const v = opt.value?.trim()
        if (!v || seenOpts.has(v)) continue
        seenOpts.add(v)
        normalisedOptions.push({ value: v, label: opt.label?.trim() || v })
      }
      const allowed = seenOpts
      // Pre-fill chips with the user's metafield picks, but drop any
      // value that's no longer in the allowed set (defensive — the
      // schema might have changed between selection and connect).
      const deduped = Array.from(
        new Set(
          initialValues
            .map((v) => v.trim())
            .filter((v) => v && (allowed.size === 0 || allowed.has(v))),
        ),
      )
      updateAxes((prev) => {
        const existing = prev.find((a) => a.connectedAttribute?.key === key)
        if (existing) {
          // Already linked — pop it back into edit mode so a second
          // "Connect" click acts like "re-open the editor", and refresh
          // the allowed options in case the schema was edited.
          return prev.map((a) =>
            a.id === existing.id
              ? {
                  ...a,
                  isEditing: true,
                  draftName: a.name || trimmedLabel,
                  draftValues: [...a.values].filter(
                    (v) => allowed.size === 0 || allowed.has(v),
                  ),
                  connectedAttribute: {
                    key,
                    label: trimmedLabel,
                    options: normalisedOptions,
                  },
                }
              : a,
          )
        }
        return [
          ...prev,
          {
            id: uuid(),
            name: trimmedLabel,
            // Leave committed values empty so no variations materialise
            // until the user hits Done — keeps the connect action
            // reversible and matches the Shopify UX the user shared.
            values: [],
            isEditing: true,
            draftName: trimmedLabel,
            draftValues: deduped,
            connectedAttribute: {
              key,
              label: trimmedLabel,
              options: normalisedOptions,
            },
          },
        ]
      })
    },
    [updateAxes],
  )

  /** Drop the axis linked to a given metafield key, if any. */
  const disconnectAttribute = useCallback(
    (key: string) => {
      updateAxes((prev) =>
        prev.filter((a) => a.connectedAttribute?.key !== key),
      )
    },
    [updateAxes],
  )

  const isAttributeConnected = useCallback(
    (key: string) =>
      axes.some((a) => a.connectedAttribute?.key === key),
    [axes],
  )

  return {
    axes,
    hasCommittedAxes,
    addAxis,
    removeAxis,
    startEdit,
    cancelEdit,
    setDraftName,
    setDraftValues,
    commitAxis,
    connectAttribute,
    disconnectAttribute,
    isAttributeConnected,
  }
}

export type VariantOptionsApi = ReturnType<typeof useVariantOptions>
