"use client"

import { useParams, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useMutation } from "@apollo/client/react"
import { CombinedGraphQLErrors } from "@apollo/client/errors"
import type { FieldErrors } from "react-hook-form"
import { sileo } from "sileo"
import {
  CREATE_SHOP_COLLECTION,
  UPDATE_SHOP_COLLECTION,
} from "@/features/collections/api"
import { formToInput } from "@/features/collections/lib/rules"
import type {
  CreateShopCollectionResult,
  ShopCollection,
  UpdateShopCollectionResult,
} from "@/features/collections/types"
import type {
  CollectionFormApi,
  CollectionFormInput,
} from "@/features/collections/validations/shop-collection"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import { resumeAgentAfterSave } from "@/features/ai/store-followup"
import { takeHandoff } from "@/features/ai/store-prefill"
import { useSaveReceipt } from "@/features/ai/lib/use-save-receipt"

/** Nested `dirtyFields` entries are objects/arrays of booleans. */
function touched(value: unknown): boolean {
  if (value === true) return true
  if (Array.isArray(value)) return value.some(touched)
  if (value && typeof value === "object") {
    return Object.values(value).some(touched)
  }
  return false
}

export function useCollectionEditor({
  form,
  collection,
  onCreated,
}: {
  form: CollectionFormApi
  collection?: ShopCollection
  /**
   * Embedded mode: hand the new collection back instead of navigating to it,
   * because the host still has a half-filled form of its own on screen. Its
   * presence also keeps failures out of the global save bar, which in that
   * mode belongs to the host's form and not to this one.
   */
  onCreated?: (collection: ShopCollection) => void
}) {
  const t = useTranslations("collections")
  const recordSaveReceipt = useSaveReceipt()
  const router = useRouter()
  const params = useParams<{ shopSlug: string }>()
  const setUnsavedError = useUnsavedBarStore((s) => s.setError)
  const embedded = !!onCreated

  const [createCollection, { loading: creating }] =
    useMutation<CreateShopCollectionResult>(CREATE_SHOP_COLLECTION, {
      refetchQueries: "active",
    })
  const [updateCollection, { loading: updating }] =
    useMutation<UpdateShopCollectionResult>(UPDATE_SHOP_COLLECTION, {
      refetchQueries: "active",
    })

  const report = (title: string, description: string) => {
    sileo.error({ title, description })
    if (!embedded) setUnsavedError(description || title)
  }

  const submit = async (data: CollectionFormInput) => {
    if (!embedded) setUnsavedError(null)
    const full = formToInput(data)

    try {
      if (!collection) {
        const { data: response } = await createCollection({
          variables: { input: full },
        })
        const payload = response?.createCollection
        if (!payload?.success) {
          report(t("createFailed"), payload?.message ?? t("fixTheForm"))
          return
        }
        sileo.success({ title: t("created") })
        const created = payload.data
        // A chained AI request resumes with the new id in hand.
        const handoff = takeHandoff("collection_create")
        resumeAgentAfterSave(handoff, created ? `[collection:${created.id}]` : "")
        if (created) {
          void recordSaveReceipt(handoff, {
            entity: "collection",
            action: "created",
            name: created.name?.en ?? created.name?.ar ?? created.slug ?? "",
            url: `/store/${params?.shopSlug}/products/collections/${created.id}`,
          })
        }
        form.reset(data)
        if (onCreated) {
          if (created) onCreated(created)
          return
        }
        router.push(
          `/store/${params?.shopSlug}/products/collections/${created?.id ?? ""}`,
        )
        return
      }

      // Edit: send only what moved. `product_ids` in particular is a whole-set
      // replace server-side, so sending it untouched would drop a product the
      // agent (or the product form) pinned while this screen was open.
      const dirty = form.formState.dirtyFields as Record<string, unknown>
      const patch: Record<string, unknown> = { id: collection.id }
      const keys: Array<[string, string]> = [
        ["name", "name"],
        ["description", "description"],
        ["seo_title", "seo_title"],
        ["seo_description", "seo_description"],
        ["slug", "slug"],
        ["sort", "sort"],
        ["sort_order", "sort_order"],
        ["is_published", "is_published"],
        ["sources", "rules"],
        ["product_ids", "product_ids"],
      ]
      for (const [formKey, inputKey] of keys) {
        if (touched(dirty[formKey]) && inputKey in full) {
          patch[inputKey] = full[inputKey]
        }
      }
      if (touched(dirty.image_url) || touched(dirty.image_alt)) {
        // `image: null` is how the API is told the cover was removed.
        patch.image = full.image ?? null
      }

      const { data: response } = await updateCollection({
        variables: { input: patch },
      })
      const payload = response?.updateCollection
      if (!payload?.success) {
        report(t("updateFailed"), payload?.message ?? t("fixTheForm"))
        return
      }
      sileo.success({ title: t("updated") })
      // No resume here, deliberately. `update_collection` is a direct write
      // with no form handoff, so there is no `collection_edit` target and the
      // agent can never stage a step against this save. The call that used to
      // sit here read a single global slot, so the only step it could ever
      // find was one queued for a different, still-unsaved entity.
      form.reset(data)
    } catch (error) {
      const handled = applyServerErrors(error, report, t("fixTheForm"))
      if (!handled) {
        report(
          collection ? t("updateFailed") : t("createFailed"),
          error instanceof Error ? error.message : t("fixTheForm"),
        )
      }
    }
  }

  const onInvalid = (errors: FieldErrors<CollectionFormInput>) => {
    report(t("fixTheForm"), firstMessage(errors) ?? t("fixTheForm"))
  }

  return { submit, onInvalid, loading: creating || updating }
}

/**
 * Rule errors come back pointed at `rules.sources[0].conditions[2].values`,
 * which no form control is registered under — the panel is rebuilt from one
 * `sources` array. So the message goes to the save bar, where it is read.
 */
function applyServerErrors(
  error: unknown,
  report: (title: string, description: string) => void,
  fallback: string,
): boolean {
  if (!CombinedGraphQLErrors.is(error)) return false
  for (const gqlError of error.errors) {
    const extensions = (gqlError.extensions ?? {}) as {
      validation_errors?: Array<{ messages?: string[] | null; field?: string }>
    }
    const first = extensions.validation_errors?.[0]
    const message = first?.messages?.[0] ?? gqlError.message
    if (message) {
      report(fallback, message)
      return true
    }
  }
  return false
}

function firstMessage(errors: FieldErrors): string | undefined {
  for (const value of Object.values(errors)) {
    if (!value) continue
    if (typeof value === "object" && "message" in value && value.message) {
      return String(value.message)
    }
    if (typeof value === "object") {
      const nested = firstMessage(value as FieldErrors)
      if (nested) return nested
    }
  }
  return undefined
}
