"use client"

import { useEffect, useRef } from "react"
import type { FieldPath } from "react-hook-form"
import { useVendorAgentPrefillStore } from "@/features/ai/store-prefill"
import {
  EDIT_TARGETS,
  useLiveFormStore,
  type LiveFormOutcome,
  type LiveFormTarget,
} from "@/features/ai/store-live-form"
import type {
  ProductFormApi,
  ProductFormInput,
} from "@/features/products/validations/product"
import type { FormPatchResult, VendorAgentToolEvent } from "./types"

/**
 * The live form channel, dashboard side: what the open product form tells the
 * assistant on each message, and how a `patch_form` result gets back into it.
 *
 * The allow-list below MIRRORS `back-end/src/vendor-agent/tools/lib/live-form.ts`.
 * The back-end is not a workspace, so the two cannot share an import; each has
 * a spec, and the server re-checks everything this side sends anyway.
 */

/** Fields `patch_form` may write. */
export const PRODUCT_PATCH_FIELDS = [
  "name",
  "description",
  "seo_title",
  "seo_description",
  "price",
  "sale_price",
  "cost_per_item",
  "quantity",
  "sku",
  "barcode",
  "status",
  "track_quantity",
  "continue_selling_when_out_of_stock",
  "requires_shipping",
  "weight_grams",
  "system_category_id",
] as const

/** `{ en, ar }` fields. A patch carries only the locale that changed. */
export const TRANSLATABLE_FIELDS: ReadonlySet<string> = new Set([
  "name",
  "description",
  "seo_title",
  "seo_description",
])

const PATCH_FIELDS: ReadonlySet<string> = new Set(PRODUCT_PATCH_FIELDS)

/**
 * The blank each field `patch_form` may empty is written as — what the
 * server sends as `null` (its `clear` argument). Keyed by the server's
 * `PRODUCT_CLEARABLE_FIELDS`; a `null` for any other field is ignored.
 *
 * Numbers go to `null` rather than `undefined`: the schema reads both as
 * empty, react-hook-form shows both as an empty input, but only `null`
 * survives the JSON round trip into the ticket — so a reload of the edit form
 * does not bring the saved sale price back over the clear.
 */
export const CLEARED_VALUE: Readonly<Record<string, unknown>> = {
  description: { en: "", ar: "" },
  seo_title: { en: "", ar: "" },
  seo_description: { en: "", ar: "" },
  sale_price: null,
  cost_per_item: null,
  weight_grams: null,
  sku: "",
  barcode: "",
  system_category_id: "",
}

/** Per-field caps, matching the server's. A longer value ends in "…". */
const CAPS: Record<string, number> = {
  name: 120,
  description: 160,
  sku: 64,
  barcode: 32,
  system_category_id: 40,
}

const NUMBER_FIELDS = [
  "price",
  "sale_price",
  "cost_per_item",
  "quantity",
  "weight_grams",
] as const
const BOOLEAN_FIELDS = [
  "track_quantity",
  "continue_selling_when_out_of_stock",
  "requires_shipping",
] as const
const STRING_FIELDS = ["sku", "barcode", "system_category_id"] as const
/** Not patchable: they decide which cards the form shows, which is what the
 * server checks a patch against. */
const ENUM_FIELDS = ["status", "product_type", "sale_type"] as const

/** Matches the prefill ticket's own TTL (`DEFAULT_TTL_MS` in store-prefill). */
const RESTASH_TTL_MS = 15 * 60 * 1000

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** `text` cut to `max` characters, the last of them "…" when it was cut —
 * the server's own cap, so a snapshot is not truncated twice. */
export function cap(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/** The rich-text description as the words in it. */
function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
}

/** A number the form holds, as a number. Inputs registered without
 * `valueAsNumber` hold the string the vendor typed ("300"). */
export function toNumber(value: unknown): number | undefined {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

function translatableSnapshot(
  value: unknown,
  max: number,
  rich: boolean,
): Record<string, string> | undefined {
  if (!isPlainObject(value)) return undefined
  const out: Record<string, string> = {}
  for (const locale of ["en", "ar"] as const) {
    const raw = value[locale]
    if (typeof raw !== "string") continue
    const text = rich ? plainText(raw) : raw.trim()
    if (text) out[locale] = cap(text, max)
  }
  return Object.keys(out).length ? out : undefined
}

/**
 * The product form's values, reduced to what the assistant is told: the
 * allow-list plus `product_type` and `sale_type`, numbers as numbers, the
 * description as plain text, long text capped, and empty fields left out.
 * SEO fields are patchable but not sent, to keep the prompt small.
 */
export function productSnapshot(
  values: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  const name = translatableSnapshot(values.name, CAPS.name, false)
  if (name) out.name = name
  const description = translatableSnapshot(
    values.description,
    CAPS.description,
    true,
  )
  if (description) out.description = description

  for (const key of NUMBER_FIELDS) {
    const n = toNumber(values[key])
    if (n !== undefined) out[key] = n
  }
  for (const key of BOOLEAN_FIELDS) {
    if (typeof values[key] === "boolean") out[key] = values[key]
  }
  for (const key of STRING_FIELDS) {
    const v = values[key]
    if (typeof v === "string" && v.trim()) out[key] = cap(v, CAPS[key])
  }
  for (const key of ENUM_FIELDS) {
    const v = values[key]
    if (typeof v === "string" && v) out[key] = v
  }
  return out
}

/** The request body's `form` field. */
export interface LiveFormPayload {
  form_id: string
  target: LiveFormTarget
  entity_id?: string
  values: Record<string, unknown>
}

/**
 * The form to send with this message, if one is live.
 *
 * Only while the ticket it was opened from is still the pending one. Read
 * from `pending` directly rather than through `peek`, so the channel outlives
 * the ticket's 15-minute TTL for as long as the form is on screen; it ends
 * when the save consumes the ticket (`takeHandoff`), when leaving the form
 * releases it, or when a newer card replaces it.
 */
export function currentLiveForm(): LiveFormPayload | undefined {
  const reg = useLiveFormStore.getState().current
  if (!reg) return undefined
  const ticket = useVendorAgentPrefillStore.getState().pending[reg.target]
  if (ticket?.handoffId !== reg.formId) return undefined
  return {
    form_id: reg.formId,
    target: reg.target,
    ...(reg.entityId ? { entity_id: reg.entityId } : {}),
    values: reg.snapshot(),
  }
}

type ProductPath = FieldPath<ProductFormInput>

/**
 * What a form says about itself so a patch can be staged into it: which of
 * its fields a patch may write, which of those are `{ en, ar }`, and what an
 * emptied field holds. Each live form binds its own — the product form below,
 * the coupon and collection forms in their own features.
 */
export interface PatchSpec {
  /** Form fields a patch may write. Any other key in a patch is ignored. */
  fields: ReadonlySet<string>
  /** The `{ en, ar }` fields, merged per locale over the form's own value. */
  translatable: ReadonlySet<string>
  /** The blank a `null` is written as. A `null` for a field with none is
   * ignored. */
  blanks: Readonly<Record<string, unknown>>
}

/** The three calls staging needs, for any react-hook-form form. */
interface StagingForm {
  getValues: (name: never) => unknown
  setValue: (
    name: never,
    value: never,
    options: { shouldDirty: boolean },
  ) => void
  trigger: (names: never) => unknown
}

/**
 * Stage a patch into a form — the save-bar contract: every key is written
 * with `setValue(..., { shouldDirty: true })`, so the fields turn dirty and
 * the bar shows; nothing is saved.
 *
 * Not `resetField`: it returns early for a name with no mounted control, and
 * a field inside a collapsed panel, or behind a switch that is off, has none.
 * `setValue` writes the form value either way, and the input picks it up when
 * it mounts.
 *
 * A translatable arrives as only the locale that changed and is merged over
 * the form's own value, so a one-language patch never blanks the other. A
 * `null` empties the field (`spec.blanks`), both locales of a translatable
 * included. Returns what was written, translatables in full.
 *
 * @param alsoValidate fields to re-validate beside the written ones — a
 *   field whose rule reads one that was just written.
 */
export function stagePatch(
  form: StagingForm,
  values: Record<string, unknown>,
  spec: PatchSpec,
  alsoValidate?: (applied: Record<string, unknown>) => string[],
): Record<string, unknown> {
  const applied: Record<string, unknown> = {}
  const keys: string[] = []
  for (const [key, raw] of Object.entries(values)) {
    if (!spec.fields.has(key)) continue
    let next = raw
    if (raw === null) {
      if (!(key in spec.blanks)) continue
      const blank = spec.blanks[key]
      // A copy, so no form ever holds the shared constant itself.
      next = isPlainObject(blank) ? { ...blank } : blank
    } else if (spec.translatable.has(key)) {
      if (!isPlainObject(raw)) continue
      const current = form.getValues(key as never)
      const locales: Record<string, string> = {}
      for (const locale of ["en", "ar"] as const) {
        const text = raw[locale]
        if (typeof text === "string") locales[locale] = text
      }
      next = { ...(isPlainObject(current) ? current : {}), ...locales }
    }
    form.setValue(key as never, next as never, { shouldDirty: true })
    applied[key] = next
    keys.push(key)
  }
  keys.push(...(alsoValidate?.(applied) ?? []))
  if (keys.length) void form.trigger(keys as never)
  return applied
}

const PRODUCT_PATCH_SPEC: PatchSpec = {
  fields: PATCH_FIELDS,
  translatable: TRANSLATABLE_FIELDS,
  blanks: CLEARED_VALUE,
}

/**
 * Stage a patch into the product form (`stagePatch`). SKU and barcode sit in
 * a collapsible panel that unmounts when closed and `price` is unregistered
 * for anything but a fixed-price product — the cases `setValue` is used for.
 */
export function applyPatchToForm(
  form: Pick<ProductFormApi, "getValues" | "setValue" | "trigger">,
  values: Record<string, unknown>,
): Record<string, unknown> {
  return stagePatch(form as StagingForm, values, PRODUCT_PATCH_SPEC, (applied) =>
    // A new price can make the sale price already there invalid (it has to
    // stay below), so its error is shown or cleared with it.
    "price" in applied && !("sale_price" in applied)
      ? (["sale_price"] satisfies ProductPath[])
      : [],
  )
}

/** The back-end's i18n key for that refusal, sent as its `code`. */
const FORM_ALREADY_OPEN_CODE = "AGENT_FORM_ALREADY_OPEN"

/**
 * `create_product` / `update_product` declining to make a second card for the
 * form already open (`AGENT_FORM_ALREADY_OPEN`) — a refusal the assistant
 * corrects itself, usually with a `patch_form` card right below it, so it is
 * drawn as a quiet row rather than a red "Operation failed" card.
 *
 * Recognised by the refusal's `code` — the i18n key the back-end's
 * `toolRejection` built it from. When a refusal carries a code, the code is
 * the whole answer.
 *
 * A turn persisted before refusals carried one (2026-10-04) has only the
 * vendor's sentence, in their language, and the model's hint, in English. For
 * those the hint is matched instead: it names `patch_form`, the way out it
 * gives the model, and no other refusal from those two tools did.
 */
export function isFormAlreadyOpenRefusal(event: VendorAgentToolEvent): boolean {
  if (event.ok) return false
  const result = event.result
  if (!isPlainObject(result)) return false
  if (typeof result.code === "string") {
    return result.code === FORM_ALREADY_OPEN_CODE
  }
  if (event.name !== "create_product" && event.name !== "update_product") {
    return false
  }
  return typeof result.hint === "string" && result.hint.includes("patch_form")
}

function readFormPatch(result: unknown): FormPatchResult["form_patch"] | null {
  if (!isPlainObject(result)) return null
  const patch = result.form_patch
  if (!isPlainObject(patch)) return null
  if (typeof patch.form_id !== "string" || typeof patch.target !== "string") {
    return null
  }
  if (!isPlainObject(patch.values)) return null
  return patch as unknown as FormPatchResult["form_patch"]
}

/**
 * Apply a `patch_form` result to the live form, when it is the form the patch
 * names. Live stream frames only — a thread reloaded from history never comes
 * through here, so an old patch cannot be re-applied.
 *
 * On a match the patched values are also written back into the ticket, with a
 * fresh TTL, so a reload inside it reopens the draft as patched rather than as
 * first prepared. On no match the patch is dropped and recorded `stale`: the
 * form it was for is gone, and the card says nothing changed.
 */
export function applyFormPatchFromResult(
  result: unknown,
): LiveFormOutcome | null {
  const patch = readFormPatch(result)
  if (!patch) return null

  const store = useLiveFormStore.getState()
  const reg = store.current
  const prefill = useVendorAgentPrefillStore.getState()
  const ticket = reg ? prefill.pending[reg.target] : undefined
  const record = (outcome: LiveFormOutcome) => {
    if (typeof patch.patch_id === "string") {
      store.recordOutcome(patch.patch_id, outcome)
    }
    return outcome
  }

  if (
    !reg ||
    !ticket ||
    reg.formId !== patch.form_id ||
    reg.target !== patch.target ||
    ticket.handoffId !== reg.formId
  ) {
    return record("stale")
  }

  const applied = reg.apply(patch.values)
  prefill.setPending({
    ...ticket,
    values: { ...ticket.values, ...applied },
    expires_at: Date.now() + RESTASH_TTL_MS,
  })
  return record("applied")
}

/**
 * Whether the live form on screen is the form a handoff card for `target`
 * (and, on an edit, `entityId`) would open.
 *
 * Read at click time rather than subscribed to: a card in history only needs
 * the answer when the vendor presses it.
 */
export function isLiveFormFor(target: string, entityId?: string): boolean {
  const reg = useLiveFormStore.getState().current
  if (!reg || reg.target !== target) return false
  return !EDIT_TARGETS.has(reg.target) || reg.entityId === entityId
}

/**
 * Register a mounted form as the live form for as long as it is mounted.
 *
 * Only when it was opened from a handoff (`formId` set): a form the vendor
 * opened themselves is not the assistant's to change. The callbacks are read
 * through a ref written from an effect — the latest-callback shape the
 * `react-hooks/refs` rule accepts, as in `useLeaveGuard` — so the
 * registration depends on the form's identity alone and is not torn down and
 * re-made on every keystroke.
 */
export function useLiveForm(options: {
  formId?: string
  target: LiveFormTarget
  entityId?: string
  /** What the composer's chip calls the form — see `useLiveFormChip`. */
  label?: string
  snapshot: () => Record<string, unknown>
  apply: (values: Record<string, unknown>) => Record<string, unknown>
}) {
  const latest = useRef(options)
  useEffect(() => {
    latest.current = options
  })

  const { formId, target, entityId, label } = options
  useEffect(() => {
    if (!formId) return
    return useLiveFormStore.getState().register({
      formId,
      target,
      entityId,
      label,
      snapshot: () => latest.current.snapshot(),
      apply: (values) => latest.current.apply(values),
    })
  }, [formId, target, entityId, label])
}

/**
 * A `{ en, ar }` title in the dashboard's language, falling back to the other
 * one — what an edit form registers as its `label`.
 */
export function titleIn(name: unknown, locale: string): string | undefined {
  if (!isPlainObject(name)) return undefined
  for (const key of [locale, "en", "ar"]) {
    const text = name[key]
    if (typeof text === "string" && text.trim()) return text.trim()
  }
  return undefined
}

/**
 * The form the next message will carry, for the composer's chip.
 *
 * The same condition as `currentLiveForm` — a registered form whose ticket is
 * still the pending one — but subscribed to, so the chip appears when the
 * assistant's form mounts and goes when it unmounts, is saved, or loses its
 * ticket to a newer card. Null on every screen without such a form, which is
 * nearly all of them.
 */
export function useLiveFormChip(): {
  target: LiveFormTarget
  label?: string
} | null {
  const reg = useLiveFormStore((s) => s.current)
  const pendingId = useVendorAgentPrefillStore((s) =>
    reg ? s.pending[reg.target]?.handoffId : undefined,
  )
  if (!reg || pendingId !== reg.formId) return null
  return { target: reg.target, label: reg.label }
}
