"use client"

import { useMutation } from "@apollo/client/react"
import { CombinedGraphQLErrors } from "@apollo/client/errors"
import type { Path, UseFormReturn } from "react-hook-form"
import { sileo } from "sileo"
import { useTranslations } from "next-intl"
import { majorToCents } from "@/shared/lib/format"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import { CREATE_AD_SPEND, UPDATE_AD_SPEND } from "../api/queries"
import type {
  AdSpend,
  AdSpendInput,
  CreateAdSpendResponse,
  UpdateAdSpendResponse,
} from "../types"
import type { AdSpendFormInput } from "../validations"

// Server validation `field` → form path.
const FIELD_ALIAS: Record<string, Path<AdSpendFormInput>> = {
  date: "date",
  source: "source",
  campaign: "campaign",
  spend_cents: "spend",
}

interface BackendValidationError {
  field?: string
  messages?: string[] | null
  message?: string | null
}

export function useAdSpendSubmit(
  form: UseFormReturn<AdSpendFormInput>,
  spend: AdSpend | undefined,
  onDone: () => void,
) {
  const t = useTranslations("adSpend")
  const setUnsavedError = useUnsavedBarStore((s) => s.setError)

  const [createAdSpend, { loading: creating }] =
    useMutation<CreateAdSpendResponse>(CREATE_AD_SPEND, {
      refetchQueries: "active",
    })
  const [updateAdSpend, { loading: updating }] =
    useMutation<UpdateAdSpendResponse>(UPDATE_AD_SPEND, {
      refetchQueries: "active",
    })
  const loading = creating || updating

  const reportError = (title: string, description: string) => {
    sileo.error({ title, description })
    setUnsavedError(description || title)
  }

  const submit = async (data: AdSpendFormInput) => {
    setUnsavedError(null)
    const input: AdSpendInput = {
      channel: data.channel,
      source: data.source.trim(),
      campaign: data.campaign?.trim() || undefined,
      date: new Date(data.date).toISOString(),
      spend_cents: majorToCents(Number(data.spend)),
      currency: data.currency.trim(),
      exchange_rate_bps: Math.round(Number(data.rate) * 10000),
    }

    try {
      if (spend) {
        const { data: res } = await updateAdSpend({
          variables: { id: spend.id, input },
        })
        if (res?.updateAdSpend?.success) {
          sileo.success({ title: t("saved") })
          onDone()
          return
        }
        reportError(t("saveFailed"), t("tryAgain"))
      } else {
        const { data: res } = await createAdSpend({ variables: { input } })
        if (res?.createAdSpend?.success) {
          sileo.success({ title: t("created") })
          onDone()
          return
        }
        reportError(t("saveFailed"), t("tryAgain"))
      }
    } catch (err) {
      const copy = {
        invalid: t("validation.invalid"),
        fixForm: t("validation.fixForm"),
      }
      if (!applyValidationErrors(err, form, reportError, copy)) {
        reportError(
          t("saveFailed"),
          err instanceof Error ? err.message : t("tryAgain"),
        )
      }
    }
  }

  return { submit, loading }
}

function applyValidationErrors(
  err: unknown,
  form: UseFormReturn<AdSpendFormInput>,
  reportError: (title: string, description: string) => void,
  copy: { invalid: string; fixForm: string },
): boolean {
  if (!CombinedGraphQLErrors.is(err)) return false
  const messages: Record<string, string> = {}
  for (const gqlErr of err.errors) {
    const ext = (gqlErr.extensions ?? {}) as {
      validation_errors?: BackendValidationError[]
    }
    for (const entry of ext.validation_errors ?? []) {
      if (!entry.field) continue
      const path = FIELD_ALIAS[entry.field]
      if (!path) continue
      messages[path] = entry.messages?.[0] ?? entry.message ?? copy.invalid
    }
  }
  const keys = Object.keys(messages)
  if (keys.length === 0) return false
  for (const [field, message] of Object.entries(messages)) {
    form.setError(field as Path<AdSpendFormInput>, { type: "server", message })
  }
  reportError(copy.fixForm, messages[keys[0]])
  return true
}
