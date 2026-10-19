"use client"

import { useMutation } from "@apollo/client/react"
import { CombinedGraphQLErrors } from "@apollo/client/errors"
import type { Path, UseFormReturn } from "react-hook-form"
import { sileo } from "sileo"
import { useTranslations } from "next-intl"
import { useUnsavedBarStore } from "@/shared/stores/unsaved-bar"
import { CREATE_TARGET, GET_TARGETS, UPDATE_TARGET } from "../api/queries"
import type {
  CreateTargetInput,
  CreateTargetResponse,
  Target,
  UpdateTargetResponse,
} from "../types"
import { metricUnit, toWireValue } from "../lib/targets"
import type { TargetFormInput } from "../validations"

// Server validation `field` → form path. The form calls the value field
// `value`; the API calls it `targetValue`.
const FIELD_ALIAS: Record<string, Path<TargetFormInput>> = {
  targetValue: "value",
  name: "name",
  period: "period",
  end: "end",
  start: "start",
}

interface BackendValidationError {
  field?: string
  code?: string
  messages?: string[] | null
  message?: string | null
}

export function useTargetSubmit(
  form: UseFormReturn<TargetFormInput>,
  target: Target | undefined,
  onDone: () => void,
) {
  const t = useTranslations("targets")
  const setUnsavedError = useUnsavedBarStore((s) => s.setError)

  // Refetch only the targets list — "active" would also re-run the heavy
  // analytics aggregation queries when saving from the analytics overview.
  const [createTarget, { loading: creating }] =
    useMutation<CreateTargetResponse>(CREATE_TARGET, {
      refetchQueries: [{ query: GET_TARGETS }],
    })
  const [updateTarget, { loading: updating }] =
    useMutation<UpdateTargetResponse>(UPDATE_TARGET, {
      refetchQueries: [{ query: GET_TARGETS }],
    })
  const loading = creating || updating

  const reportError = (title: string, description: string) => {
    sileo.error({ title, description })
    setUnsavedError(description || title)
  }

  const submit = async (data: TargetFormInput) => {
    setUnsavedError(null)
    const unit = metricUnit(data.metric)
    const input: CreateTargetInput = {
      name: data.name.trim(),
      metric: data.metric,
      period: data.period,
      targetValue: toWireValue(Number(data.value), unit),
      activate: data.activate,
    }
    if (data.period === "CUSTOM") {
      input.start = new Date(data.start as string).toISOString()
      input.end = new Date(data.end as string).toISOString()
    }

    try {
      if (target) {
        const { data: res } = await updateTarget({
          variables: { id: target.id, input },
        })
        if (res?.updateTarget?.success) {
          sileo.success({ title: t("saved") })
          onDone()
          return
        }
        reportError(t("saveFailed"), t("tryAgain"))
      } else {
        const { data: res } = await createTarget({ variables: { input } })
        if (res?.createTarget?.success) {
          sileo.success({ title: t("created") })
          onDone()
          return
        }
        reportError(t("saveFailed"), t("tryAgain"))
      }
    } catch (err) {
      const handled = applyValidationErrors(err, form, reportError, {
        invalid: t("validation.invalid"),
        fixForm: t("validation.fixForm"),
      })
      if (!handled) {
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
  form: UseFormReturn<TargetFormInput>,
  reportError: (title: string, description: string) => void,
  copy: { invalid: string; fixForm: string },
): boolean {
  if (!CombinedGraphQLErrors.is(err)) return false

  const fieldMessages: Record<string, string> = {}
  for (const gqlErr of err.errors) {
    const ext = (gqlErr.extensions ?? {}) as {
      validation_errors?: BackendValidationError[]
    }
    const raw = ext.validation_errors
    if (!Array.isArray(raw)) continue
    for (const entry of raw) {
      if (!entry.field) continue
      const path = FIELD_ALIAS[entry.field]
      if (!path) continue
      fieldMessages[path] = entry.messages?.[0] ?? entry.message ?? copy.invalid
    }
  }

  const keys = Object.keys(fieldMessages)
  if (keys.length === 0) return false
  for (const [field, message] of Object.entries(fieldMessages)) {
    form.setError(field as Path<TargetFormInput>, {
      type: "server",
      message,
    })
  }
  reportError(copy.fixForm, fieldMessages[keys[0]])
  return true
}
