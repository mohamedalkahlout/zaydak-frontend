import type { FieldValues, Path, UseFormSetError } from "react-hook-form"
import { CombinedGraphQLErrors } from "@apollo/client/errors"

export interface BackendValidationError {
  field: string
  code?: string
  messages?: string[]
}

interface ErrorExtensions {
  error_code?: string
  code?: string
  validation_errors?: BackendValidationError[]
  detail?: string
}

/**
 * Extract the normalized `error_code` so forms can branch on the enum rather
 * than the translated message.
 */
export function getErrorCode(err: unknown): string | null {
  if (!CombinedGraphQLErrors.is(err)) return null
  const ext = (err.errors[0]?.extensions ?? {}) as ErrorExtensions
  return ext.error_code ?? ext.code ?? null
}

/**
 * The third party's own words, when the back-end attached them.
 *
 * `err.message` is the translated `error_code` and nothing else — every
 * untranslatable specific ("Connection timeout", "535 authentication failed")
 * travels here instead, which for an integration failure is the whole answer.
 */
export function getErrorDetail(err: unknown): string | null {
  if (!CombinedGraphQLErrors.is(err)) return null
  const ext = (err.errors[0]?.extensions ?? {}) as ErrorExtensions
  return ext.detail ?? null
}

export function getValidationErrors(err: unknown): BackendValidationError[] {
  if (!CombinedGraphQLErrors.is(err)) return []
  const ext = (err.errors[0]?.extensions ?? {}) as ErrorExtensions
  return ext.validation_errors ?? []
}

/**
 * Project the back-end's `validation_errors[]` onto a react-hook-form instance.
 * Anything that doesn't match a known field is returned so the caller can
 * surface it in a toast instead of dropping it silently.
 */
export function applyValidationErrors<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): Array<{ field: string; message: string }> {
  const errors = getValidationErrors(err)
  const knownFields = new Set<string>(fields as readonly string[])
  const unmapped: Array<{ field: string; message: string }> = []

  for (const ve of errors) {
    const message = ve.messages?.[0] ?? ve.code ?? "Invalid value"
    if (knownFields.has(ve.field)) {
      setError(ve.field as Path<T>, { type: "server", message })
    } else {
      unmapped.push({ field: ve.field, message })
    }
  }
  return unmapped
}
