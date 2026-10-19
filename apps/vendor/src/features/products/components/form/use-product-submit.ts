"use client"

import { useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { useApolloClient, useMutation } from "@apollo/client/react"
import { CombinedGraphQLErrors } from "@apollo/client/errors"
import type { FieldErrors, Path } from "react-hook-form"
import { sileo } from "sileo"
import { useTranslations } from "next-intl"
import { CREATE_PRODUCT, UPDATE_PRODUCT } from "@/features/products/api"
import type { CreateProductResponse, UpdateProductResponse } from "@/features/products/types"
import type { ProductFormApi, ProductFormInput, ProductFormOutput } from "@/features/products/validations/product"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import { resumeAgentAfterSave } from "@/features/ai/store-followup"
import { takeHandoff } from "@/features/ai/store-prefill"
import { useSaveReceipt } from "@/features/ai/lib/use-save-receipt"
import {
  GET_INVENTORY_LEVELS,
  GET_INVENTORY_LOCATIONS,
  SET_INVENTORY_AVAILABLE,
  TRANSFER_INVENTORY,
} from "@/features/inventory/api"
import {
  toCreateProductInput,
  toUpdateProductInput,
} from "@/features/products/lib/form/transform-product-input"
import { clearProductDraft } from "@/features/products/lib/form/product-draft"
import {
  SET_NEGOTIATION_EXCLUDED_OPTIONS,
  SET_NEGOTIATION_OPTION_FLOORS,
  UPSERT_NEGOTIATION_POLICY,
} from "@/features/negotiation/api"
import type { NegotiationDraft } from "@/features/negotiation/components/negotiation-card"
import {
  CLEAR_PRODUCT_COMPOSITION,
  SET_PRODUCT_COMPOSITION,
} from "@/features/products/api"
import {
  compositionDraftsEqual,
  compositionInput,
  type CompositionDraft,
} from "@/features/products/components/form/cards/composition-card"
import { useFeature } from "@/features/plan/lib/use-feature"
import {
  NegotiationFloorMode as NegotiationFloorModeGql,
  NegotiationStrategy as NegotiationStrategyGql,
} from "@/shared/api/generated/graphql"

export type ProductSubmitMode =
  | { kind: "create" }
  | { kind: "edit"; id: string }

export type ProductSubmitNegotiation = {
  getNegotiationDraft: () => NegotiationDraft
  /**
   * What the server last said. Decides whether the options' own minimum
   * prices need saving at all: with none in the draft and none on the server
   * there is nothing to write or to release.
   */
  getNegotiationBaseline?: () => NegotiationDraft
  onNegotiationSaved?: (draft: NegotiationDraft) => void
}

export type ProductSubmitComposition = {
  getDraft: () => CompositionDraft
  getBaseline: () => CompositionDraft
  onSaved?: (draft: CompositionDraft) => void
}

/** UUIDv4 generator with a browser fallback. */
function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  // Fallback — not cryptographically strong, fine for idempotency keys.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Submit hook shared by the create and edit product forms. Routes to
 * `createProduct` / `updateProduct` depending on `mode`. When the backend
 * returns `extensions.validation_errors`, surfaces them as per-field
 * errors via `form.setError` so the user can correct inline.
 *
 * A stable `Idempotency-Key` is generated once per hook lifetime so
 * retries of the same logical submit don't duplicate products — the key
 * rotates only when the component unmounts or the mode switches.
 */
export function useProductSubmit(
  mode: ProductSubmitMode,
  form?: ProductFormApi,
  negotiation?: ProductSubmitNegotiation,
  composition?: ProductSubmitComposition,
) {
  const router = useRouter()
  const params = useParams<{ shopSlug: string }>()
  const t = useTranslations("products.toasts")
  const tSubmit = useTranslations("products.submit")
  const recordSaveReceipt = useSaveReceipt()
  const setUnsavedError = useUnsavedBarStore((s) => s.setError)
  const apollo = useApolloClient()
  const [transferInventory] = useMutation(TRANSFER_INVENTORY)
  const [setInventoryAvailable] = useMutation(SET_INVENTORY_AVAILABLE)
  const [upsertNegotiationPolicy] = useMutation(UPSERT_NEGOTIATION_POLICY)
  const [setNegotiationExcludedOptions] = useMutation(
    SET_NEGOTIATION_EXCLUDED_OPTIONS,
  )
  const [setNegotiationOptionFloors] = useMutation(
    SET_NEGOTIATION_OPTION_FLOORS,
  )
  const [setProductComposition] = useMutation(SET_PRODUCT_COMPOSITION)
  const [clearProductComposition] = useMutation(CLEAR_PRODUCT_COMPOSITION)
  const negotiationFeature = useFeature("ai.negotiation")

  // One key per mount — survives network retries, re-rolls on navigation.
  const idempotencyKey = useMemo(() => uuid(), [])

  const [createProduct, createState] = useMutation<CreateProductResponse>(
    CREATE_PRODUCT,
    {
      context: { headers: { "Idempotency-Key": idempotencyKey } },
    },
  )
  const [updateProduct, updateState] = useMutation<UpdateProductResponse>(
    UPDATE_PRODUCT,
    { refetchQueries: "active" },
  )
  const loading =
    createState.loading || updateState.loading || false

  const saveNegotiationPolicy = async (
    productId: string,
    saleType: string,
    productType: string | undefined,
  ) => {
    // Same gate as NegotiationCard / @RequireFeature('ai.negotiation'): skip
    // rather than let FeatureGuard refuse and paint the save bar red.
    if (
      saleType !== "NEGOTIABLE" ||
      !negotiation ||
      !negotiationFeature.allowed
    ) {
      return
    }
    const draft = negotiation.getNegotiationDraft()
    const { data: response } = await upsertNegotiationPolicy({
      variables: {
        input: {
          product_id: productId,
          enabled: draft.enabled,
          floor_mode: draft.floor_mode as unknown as NegotiationFloorModeGql,
          strategy: draft.strategy as unknown as NegotiationStrategyGql,
          minimum_price_cents: draft.minimum_price_cents,
          max_discount_bps: draft.max_discount_bps,
          minimum_margin_bps: draft.minimum_margin_bps,
          preferred_price_cents: draft.preferred_price_cents,
          max_rounds: draft.max_rounds,
          offer_ttl_seconds: draft.offer_ttl_seconds,
          allow_coupon_stacking: draft.allow_coupon_stacking,
        },
      },
    })
    if (!response?.upsertNegotiationPolicy?.success) {
      throw new Error(tSubmit("negotiationFailed"))
    }
    // Which options keep a fixed price. The whole list every time, so an
    // option switched back on negotiates again; the server ignores an option
    // deleted in this same save.
    let excluded = draft.excluded_variation_ids
    let optionFloors = draft.option_floors
    if (productType === "VARIABLE") {
      const { data: saved } = await setNegotiationExcludedOptions({
        variables: {
          input: {
            product_id: productId,
            excluded_variation_option_ids: draft.excluded_variation_ids,
          },
        },
      })
      if (!saved?.setNegotiationExcludedOptions?.success) {
        throw new Error(tSubmit("negotiationOptionsFailed"))
      }
      excluded = [...(saved.setNegotiationExcludedOptions.data ?? [])].sort()
    }
    // Which options have a minimum price of their own. The whole list on every
    // save that has one to keep or one to release, after the product's own
    // row: the server writes each as a copy of those settings, so a copy never
    // trails a change made above. With none here and none on the server there
    // is nothing to say, and the call is skipped.
    const baselineFloors = negotiation.getNegotiationBaseline?.().option_floors
    const floorsInPlay =
      Object.keys(draft.option_floors).length > 0 ||
      Object.keys(baselineFloors ?? {}).length > 0
    if (productType === "VARIABLE" && floorsInPlay) {
      const { data: floors } = await setNegotiationOptionFloors({
        variables: {
          input: {
            product_id: productId,
            floors: Object.entries(draft.option_floors)
              .filter(([id]) => !excluded.includes(id))
              .map(([variation_option_id, minimum_price_cents]) => ({
                variation_option_id,
                minimum_price_cents,
              })),
          },
        },
      })
      if (!floors?.setNegotiationOptionFloors?.success) {
        throw new Error(tSubmit("negotiationFloorsFailed"))
      }
      optionFloors = Object.fromEntries(
        (floors.setNegotiationOptionFloors.data ?? []).map((f) => [
          f.variation_option_id,
          f.minimum_price_cents,
        ]),
      )
    }
    negotiation.onNegotiationSaved?.({
      ...draft,
      excluded_variation_ids: excluded,
      option_floors: optionFloors,
    })
  }

  const saveComposition = async (productId: string, productType: string | undefined) => {
    if (!composition) return
    const draft = composition.getDraft()
    const baseline = composition.getBaseline()
    const blocked = productType === "VARIABLE" || productType === "DIGITAL"
    if (blocked) {
      if (!baseline.enabled) return
      const { data: cleared } = await clearProductComposition({
        variables: { product_id: productId },
      })
      if (!cleared?.clearProductComposition?.success) {
        throw new Error(tSubmit("compositionFailed"))
      }
      composition.onSaved?.({ ...draft, enabled: false })
      return
    }
    if (compositionDraftsEqual(draft, baseline)) return
    if (!draft.enabled) {
      const { data: cleared } = await clearProductComposition({
        variables: { product_id: productId },
      })
      if (!cleared?.clearProductComposition?.success) {
        throw new Error(tSubmit("compositionFailed"))
      }
      composition.onSaved?.(draft)
      return
    }
    if (draft.groups.some((group) => group.label.trim() === "")) {
      throw new Error(tSubmit("compositionName"))
    }
    if (draft.groups.some((group) => group.parts.length === 0)) {
      throw new Error(tSubmit("compositionParts"))
    }
    const { data: saved } = await setProductComposition({
      variables: { input: compositionInput(draft, productId) },
    })
    if (!saved?.setProductComposition?.success) {
      throw new Error(tSubmit("compositionFailed"))
    }
    composition.onSaved?.(draft)
  }

  const reportError = (title: string, description: string) => {
    sileo.error({ title, description })
    setUnsavedError(description || title)
  }

  /**
   * Move a newly created product's opening stock to the warehouse the
   * assistant asked about.
   *
   * `createProduct` seeds the quantity at the shop's default location — the
   * form has no location control on create — so placing it elsewhere is a
   * transfer, the same two steps a vendor would do by hand. The default is
   * read fresh rather than carried from the chat: minutes may have passed,
   * and moving stock out of the wrong place is worse than not moving it.
   *
   * Never throws. The product exists by the time this runs and the vendor
   * has already been told so; failing the save here would report a create
   * that did happen as a failure. A warning toast names the warehouse so
   * the stock can be moved by hand.
   *
   * `placement` is handed in rather than read here, off the same ticket the
   * rest of the save reads. It used to take itself out of the store, which
   * made the order of two lines load-bearing and invisible: consuming the
   * ticket first — for the step, or for the destination — emptied the
   * warehouse answer before this ever looked for it.
   */
  const placeOpeningStock = async (
    productId: string,
    seeded: number,
    placement: { id: string; name: string; quantity: number } | undefined,
  ) => {
    // `seeded` is what the create actually wrote, NOT the number the chat
    // staged. The form is prefilled precisely so the vendor can change it,
    // and only the saved figure was seeded at the default: moving the staged
    // one instead either throws (they lowered it) or moves part of the stock
    // while the toast says it all arrived (they raised it). Zero covers both
    // "no stock" and a VARIABLE product, where nothing was seeded to move.
    if (!placement || seeded <= 0) return
    try {
      const { data } = await apollo.query<{
        inventoryLocations: {
          success: boolean
          data: Array<{ id: string; is_default: boolean }>
        }
      }>({ query: GET_INVENTORY_LOCATIONS, fetchPolicy: "network-only" })
      const from = data?.inventoryLocations?.data?.find((l) => l.is_default)
      // Already where it was asked to be: nothing to move and nothing to say.
      if (from?.id === placement.id) return
      if (!from) {
        // Every shop is backfilled with a default location, so this is a
        // broken shop rather than a normal path — but it still leaves the
        // stock somewhere the vendor did not choose, so it has to be said.
        sileo.warning({
          title: t("stockNotMoved"),
          description: placement.name,
        })
        return
      }
      await transferInventory({
        variables: {
          input: {
            from_location_id: from.id,
            to_location_id: placement.id,
            product_id: productId,
            quantity: seeded,
            // Stored on the ledger row and read back in the vendor's own
            // inventory history, so it is written in their language.
            note: tSubmit("openingStockNote"),
          },
        },
      })
      sileo.success({
        title: t("stockPlaced"),
        description: placement.name,
      })
    } catch (err) {
      sileo.warning({
        title: t("stockNotMoved"),
        description:
          err instanceof Error
            ? `${placement.name}: ${err.message}`
            : placement.name,
      })
    }
  }

  /**
   * Write the per-location stock the variants table staged.
   *
   * Runs AFTER `updateProduct`, and the order is the whole point: the update
   * writes each variant's `quantity` column straight through, while
   * `setInventoryAvailable` moves a level and lets the back-end recompute
   * that same column from SUM(available). Flushing first would have the
   * update overwrite the ledger's answer with the form's stale one.
   *
   * Never throws, for the same reason `placeOpeningStock` doesn't: the
   * product is already saved and the vendor has been told so. A warning
   * names the first failure instead of reporting the save as failed.
   */
  const flushStagedLevels = async (
    levels: ProductFormOutput["inventory_levels"],
  ) => {
    if (!levels?.length) return
    const failures: string[] = []
    for (const level of levels) {
      try {
        await setInventoryAvailable({
          variables: {
            input: {
              location_id: level.location_id,
              variation_option_id: level.variation_option_id,
              available: level.available,
            },
          },
        })
      } catch (err) {
        failures.push(
          err instanceof Error ? err.message : tSubmit("unknownError"),
        )
      }
    }
    if (failures.length) {
      sileo.warning({
        title: tSubmit("levelsNotSaved", { count: failures.length }),
        description: failures[0],
      })
    }
    if (form) {
      form.setValue("inventory_levels", [], { shouldDirty: false })
    }
    void apollo.refetchQueries({ include: [GET_INVENTORY_LEVELS] })
  }

  const submit = async (data: ProductFormOutput) => {
    setUnsavedError(null)
    try {
      if (mode.kind === "edit") {
        const input = toUpdateProductInput(data, mode.id)
        const { data: response } = await updateProduct({ variables: { input } })
        if (response?.updateProduct?.success) {
          // Rebase `expected_version` on the freshly returned row so the
          // user can keep editing without an intermediate refetch — the
          // next save won't trip the optimistic-lock guard falsely.
          const nextVersion = response.updateProduct.data.version
          if (form && typeof nextVersion === "number") {
            form.setValue("expected_version", nextVersion, {
              shouldDirty: false,
            })
          }
          sileo.success({
            title: t("updated"),
            description: response.updateProduct.data.slug,
          })
          await flushStagedLevels(data.inventory_levels)
          await saveNegotiationPolicy(mode.id, data.sale_type, data.product_type)
          await saveComposition(mode.id, data.product_type)
          // The ticket the assistant minted when it opened this form, if this
          // save is the one it was minted for. Consuming it here is also what
          // stops a rejected draft coming back: the prefill outlived every
          // save until now, so re-opening the form inside the 15-minute TTL
          // re-applied values the vendor had already walked away from.
          const handoff = takeHandoff("product_edit", mode.id)
          resumeAgentAfterSave(handoff, `[product:${mode.id}]`)
          void recordSaveReceipt(handoff, {
            entity: "product",
            action: "updated",
            name: response.updateProduct.data.slug,
            url: `/store/${params?.shopSlug}/products/${response.updateProduct.data.slug}/edit`,
          })
          router.push(`/store/${params?.shopSlug}/products`)
        }
        return
      }

      const input = toCreateProductInput(data)
      const { data: response } = await createProduct({ variables: { input } })
      if (response?.createProduct?.success) {
        const created = response.createProduct.data
        const handoff = takeHandoff("product_create")
        sileo.success({
          title: t("created"),
          description: created.slug,
        })
        // The draft parked for a reload IS this product. Left behind, the
        // next "Add product" would restore it as though it were never saved.
        clearProductDraft(params?.shopSlug ?? "")
        // The vendor answered "which warehouse?" in the chat that opened
        // this form. Nothing on the form carries that answer, so it is
        // honoured here, after the product exists.
        await placeOpeningStock(
          created.id,
          // A VARIABLE product seeds its stock per variation, not at the
          // simple level, so there is nothing here to move.
          data.product_type === "VARIABLE" ? 0 : (data.quantity ?? 0),
          handoff?.placeStockAt,
        )
        await saveNegotiationPolicy(created.id, data.sale_type, data.product_type)
        await saveComposition(created.id, data.product_type)
        // Chained AI request ("create product, then a coupon on it"): the
        // next step rode in on the ticket the vendor's click stashed. Now
        // that the product exists and has an id, auto-resume the chat with
        // that step + the new [product:ID] marker — no "continue" needed.
        // No-op when this save had no ticket, or its ticket had no step.
        resumeAgentAfterSave(handoff, `[product:${created.id}]`)
        void recordSaveReceipt(handoff, {
          entity: "product",
          action: "created",
          name: created.slug,
          url: `/store/${params?.shopSlug}/products/${created.slug}/edit`,
        })
        // Where the vendor lands. A save the assistant set up goes to the
        // product's own page, not the list: the chat is about to speak about
        // "the product", and the list is the one screen where the thing just
        // made is a row among forty. A save nobody assisted keeps the list,
        // which is where a vendor adding products in a row wants to be.
        router.push(
          handoff
            ? `/store/${params?.shopSlug}/products/${created.slug}/edit`
            : `/store/${params?.shopSlug}/products`,
        )
      }
    } catch (err) {
      const handled = applyValidationErrors(err, form, reportError, {
        fixForm: tSubmit("fixForm"),
        invalid: tSubmit("invalid"),
      })
      if (!handled) {
        reportError(
          mode.kind === "edit" ? t("updateFailed") : t("createFailed"),
          err instanceof Error ? err.message : t("tryAgain"),
        )
      }
    }
  }

  const onInvalid = (errors: FieldErrors<ProductFormInput>) => {
    const description =
      firstErrorMessage(errors) ?? tSubmit("fieldsNeedAttention")
    reportError(tSubmit("fixForm"), description)
    if (typeof window !== "undefined") {
      console.warn("[ProductSubmit] validation errors", errors)
    }
  }

  return { submit, onInvalid, loading }
}

interface BackendValidationError {
  field?: string
  code?: string
  messages?: string[] | null
  message?: string | null
}

/**
 * Surface backend `validation_errors` on the matching form fields. Special
 * cases: `STALE_OBJECT` → user must refresh; `SLUG_ALREADY_EXISTS` →
 * suggest appending a suffix; `STALE_VARIATION` → point at variations.
 */
function applyValidationErrors(
  err: unknown,
  form: ProductFormApi | undefined,
  reportError: (title: string, description: string) => void,
  /** Already-localized copy: this runs outside the hook, so it is handed the
   *  words rather than a translator. */
  copy: { fixForm: string; invalid: string },
): boolean {
  if (!form || !CombinedGraphQLErrors.is(err)) return false

  let touched = false
  const fieldMessages: Record<string, string> = {}

  for (const gqlErr of err.errors) {
    const raw = gqlErr.extensions?.validation_errors
    if (!Array.isArray(raw)) continue

    for (const entry of raw as BackendValidationError[]) {
      const formPath = mapBackendFieldToFormPath(entry)
      if (!formPath) continue
      const message = pickMessage(entry) ?? copy.invalid
      fieldMessages[formPath] = message
      touched = true
    }
  }

  if (!touched) return false

  const firstField = Object.keys(fieldMessages)[0]
  for (const [field, message] of Object.entries(fieldMessages)) {
    form.setError(field as Path<ProductFormInput>, {
      type: "server",
      message,
    })
  }
  if (firstField) {
    try {
      form.setFocus(firstField as Path<ProductFormInput>)
    } catch {
      // focus is a no-op for non-focusable fields — ignore.
    }
    reportError(copy.fixForm, fieldMessages[firstField])
  }
  return true
}

function pickMessage(entry: BackendValidationError): string | undefined {
  if (entry.messages && entry.messages.length > 0) return entry.messages[0]
  if (entry.message) return entry.message
  return undefined
}

/**
 * Map a backend validation `field` + `code` to a form path. Most fields
 * are 1:1. The special codes below point at composite/virtual fields so
 * the error lands somewhere the user can actually see it.
 */
function mapBackendFieldToFormPath(
  entry: BackendValidationError,
): string | undefined {
  const { field, code } = entry

  // Concurrency / identity errors — pin to `root` so they surface via
  // the toast + unsaved-bar even when the field name isn't user-facing.
  if (code === "STALE_OBJECT") return "root"
  if (code === "SLUG_ALREADY_EXISTS") return "slug"
  if (code === "DUPLICATE_SKU") return "variation_options"
  if (code === "STALE_VARIATION") return "variation_options"
  if (code === "VARIABLE_REQUIRES_VARIATIONS") return "variation_options"
  if (code === "SALE_PRICE_NOT_LESS_THAN_PRICE") return "sale_price"
  if (code === "INVALID_STATUS_TRANSITION") return "status"

  // Metafields (PRODUCTS.md §16.4). The backend may ship the offending
  // key in `field` (e.g. `attribute_values[2].value_text`,
  // `attribute_values.ram`, or just `ram`). Try to pin to the exact
  // dynamic control; fall back to the parent record so the user at
  // least sees *something* land on the card.
  const attributeCodes = [
    "ATTRIBUTE_UNKNOWN_KEY",
    "ATTRIBUTE_REQUIRED",
    "ATTRIBUTE_TYPE_MISMATCH",
    "ATTRIBUTE_INVALID_OPTION",
    "ATTRIBUTE_KEY_CONFLICT",
    "SCHEMA_DUPLICATE_KEY",
  ]
  if (code && attributeCodes.includes(code)) {
    const key = extractAttributeKey(field)
    return key ? `attribute_values.${key}` : "attribute_values"
  }

  if (!field) return undefined
  return field
}

/**
 * Pull the attribute key out of the backend's `field` descriptor, which
 * varies in shape: `"attribute_values[3].value_text"`,
 * `"attribute_values.ram"`, `"attributes.ram"`, or just `"ram"` (legacy).
 * Returns undefined for numeric-indexed refs we can't resolve without
 * the live submitted payload.
 */
function extractAttributeKey(field?: string): string | undefined {
  if (!field) return undefined

  // `attribute_values.<key>` or `attributes.<key>`
  const dot = /^(?:attribute_values|attributes)\.([^.[\]]+)/.exec(field)
  if (dot?.[1] && !/^\d+$/.test(dot[1])) return dot[1]

  // Bracketed numeric index — backend may need to be consulted to
  // resolve; bail so we fall back to the general bucket.
  if (/^(?:attribute_values|attributes)\[\d+\]/.test(field)) return undefined

  // Legacy shape where only the key is shipped.
  if (/^[a-z0-9_-]+$/i.test(field)) return field

  return undefined
}

function firstErrorMessage(errors: FieldErrors): string | undefined {
  for (const value of Object.values(errors)) {
    if (!value) continue
    if (typeof value === "object" && "message" in value && value.message) {
      return String(value.message)
    }
    if (typeof value === "object") {
      const nested = firstErrorMessage(value as FieldErrors)
      if (nested) return nested
    }
  }
  return undefined
}
