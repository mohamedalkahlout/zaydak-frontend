"use client"

import { useRouter, useParams } from "next/navigation"
import { useMutation } from "@apollo/client/react"
import { CombinedGraphQLErrors } from "@apollo/client/errors"
import type { FieldErrors, Path } from "react-hook-form"
import { sileo } from "sileo"
import { useTranslations } from "next-intl"
import { CREATE_COUPON, UPDATE_COUPON } from "@/features/coupons/api"
import type { AnyCouponInput, AnyCouponOutput, CouponFormApi } from "@/features/coupons/validations/coupon"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import { resumeAgentAfterSave } from "@/features/ai/store-followup"
import { takeHandoff } from "@/features/ai/store-prefill"
import { useSaveReceipt } from "@/features/ai/lib/use-save-receipt"
import {
  toCreateCouponInput,
  toUpdateCouponInput,
} from "@/features/coupons/lib/new/transform-coupon-input"

interface CouponMutationResponse {
  createCoupon?: {
    success: boolean
    data: { id: string; code: string }
  }
  updateCoupon?: {
    success: boolean
    message?: string | null
    data: { id: string; code: string }
  }
}

export type CouponSubmitMode =
  | { kind: "create" }
  | { kind: "edit"; id: string }

/**
 * Submit handler shared by every coupon-type form for both create and
 * edit flows. Routes to `createCoupon` or `updateCoupon` depending on
 * the `mode`. When the backend returns `extensions.validation_errors`,
 * they are surfaced as per-field errors via `form.setError` so the user
 * can correct them inline.
 */
export function useCouponSubmit(
  mode: CouponSubmitMode,
  form?: CouponFormApi,
) {
  const router = useRouter()
  const t = useTranslations("coupons.toasts")
  const recordSaveReceipt = useSaveReceipt()
  const params = useParams<{ shopSlug: string }>()

  const [createCoupon, createState] =
    useMutation<CouponMutationResponse>(CREATE_COUPON)
  const [updateCoupon, updateState] = useMutation<CouponMutationResponse>(
    UPDATE_COUPON,
    { refetchQueries: "active" },
  )
  const loading = createState.loading || updateState.loading
  const setUnsavedError = useUnsavedBarStore((s) => s.setError)

  // Mirror every toast-error into the sticky unsaved bar so the header
  // stays visually red until the user retries — a toast alone disappears
  // after 3s but the problem doesn't.
  const reportError = (title: string, description: string) => {
    sileo.error({ title, description })
    setUnsavedError(description || title)
  }

  const submit = async (data: AnyCouponOutput) => {
    setUnsavedError(null)
    try {
      if (mode.kind === "edit") {
        const input = toUpdateCouponInput(data, mode.id)
        const { data: response } = await updateCoupon({ variables: { input } })
        if (response?.updateCoupon?.success) {
          sileo.success({
            title: t("updated"),
            description: response.updateCoupon.data.code,
          })
          // Scoped to this coupon: a ticket staged for a DIFFERENT entity is
          // not this save's to consume. It used to be — the step lived in one
          // global slot, so a coupon edit could eat the step queued for a
          // product the vendor had not saved yet.
          const handoff = takeHandoff("coupon_edit", mode.id)
          resumeAgentAfterSave(handoff, "")
          void recordSaveReceipt(handoff, {
            entity: "coupon",
            action: "updated",
            name: response.updateCoupon.data.code,
            url: `/store/${params?.shopSlug}/coupons/${mode.id}`,
          })
          router.push(`/store/${params?.shopSlug}/coupons`)
        } else if (response?.updateCoupon?.message) {
          reportError(t("updateFailed"), response.updateCoupon.message)
        }
        return
      }

      const input = toCreateCouponInput(data)
      const { data: response } = await createCoupon({ variables: { input } })
      if (response?.createCoupon?.success) {
        const created = response.createCoupon.data
        const handoff = takeHandoff("coupon_create")
        sileo.success({
          title: t("created"),
          description: created.code,
        })
        // Chained AI request: resume the step the ticket carried. Coupons
        // have no downstream @-marker, so pass an empty one — the agent
        // continues the plan from the instruction alone.
        resumeAgentAfterSave(handoff, "")
        void recordSaveReceipt(handoff, {
          entity: "coupon",
          action: "created",
          name: created.code,
          url: `/store/${params?.shopSlug}/coupons/${created.id}`,
        })
        // A save the assistant set up lands on the coupon itself; an
        // unassisted one keeps the list. See use-product-submit for why.
        router.push(
          handoff
            ? `/store/${params?.shopSlug}/coupons/${created.id}`
            : `/store/${params?.shopSlug}/coupons`,
        )
      }
    } catch (err) {
      const handled = applyValidationErrors(err, form, reportError, {
        invalid: t("invalidValue"),
        fixForm: t("fixForm"),
      })
      if (!handled) {
        reportError(
          mode.kind === "edit" ? t("updateFailed") : t("createFailed"),
          err instanceof Error ? err.message : t("tryAgain"),
        )
      }
    }
  }

  const onInvalid = (errors: FieldErrors) => {
    const description =
      firstErrorMessage(errors) ?? t("fieldsNeedAttention")
    reportError(t("fixForm"), description)
    if (typeof window !== "undefined") {
      console.warn("[CouponSubmit] validation errors", errors)
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
 * If `err` is a GraphQL error carrying `extensions.validation_errors`,
 * surface each one on the matching form field via `form.setError` and
 * return true. Returns false when the error isn't a bundled validation
 * payload so callers can fall back to a generic toast.
 *
 * `copy` is the already-localized fallback for an entry that carries no
 * message of its own, and the toast title.
 */
function applyValidationErrors(
  err: unknown,
  form: CouponFormApi | undefined,
  reportError: (title: string, description: string) => void,
  copy: { invalid: string; fixForm: string },
): boolean {
  if (!form || !CombinedGraphQLErrors.is(err)) return false

  let touched = false
  const fieldMessages: Record<string, string> = {}

  for (const gqlErr of err.errors) {
    const raw = gqlErr.extensions?.validation_errors
    if (!Array.isArray(raw)) continue

    for (const entry of raw as BackendValidationError[]) {
      const field = mapBackendFieldToFormPath(entry.field)
      if (!field) continue
      const message = pickMessage(entry) ?? copy.invalid
      fieldMessages[field] = message
      touched = true
    }
  }

  if (!touched) return false

  const firstField = Object.keys(fieldMessages)[0]
  for (const [field, message] of Object.entries(fieldMessages)) {
    form.setError(field as Path<AnyCouponInput>, {
      type: "server",
      message,
    })
  }
  if (firstField) {
    // `setFocus` is a no-op for fields we don't render as inputs (e.g.
    // collection_ids), but harmless when that's the case.
    try {
      form.setFocus(firstField as Path<AnyCouponInput>)
    } catch {
      // ignore — field may not be a focusable input
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
 * Backend fields and form fields mostly share snake_case names. Some
 * fields are UI-only (`minimum_mode`, `applies_to`, etc.) — map those
 * onto the corresponding real field users actually edit.
 */
function mapBackendFieldToFormPath(
  field: string | undefined,
): string | undefined {
  if (!field) return undefined
  // Known 1:1 mappings. Anything else is returned as-is and will no-op
  // if the form doesn't expose that path.
  return field
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
