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
}

/**
 * Extract the normalized `error_code` from a caught GraphQL error so forms
 * can branch on the enum rather than the translated message.
 */
export function getErrorCode(err: unknown): string | null {
  if (!CombinedGraphQLErrors.is(err)) return null
  const ext = (err.errors[0]?.extensions ?? {}) as ErrorExtensions
  return ext.error_code ?? ext.code ?? null
}

/**
 * Extract backend field errors (VALIDATION_ERROR) in wire form.
 */
export function getValidationErrors(err: unknown): BackendValidationError[] {
  if (!CombinedGraphQLErrors.is(err)) return []
  const ext = (err.errors[0]?.extensions ?? {}) as ErrorExtensions
  return ext.validation_errors ?? []
}

/**
 * Project backend `validation_errors[]` onto a react-hook-form instance.
 * Fields whose names match the form shape get server errors; anything
 * unknown is returned for the caller to surface in a toast.
 *
 * Example:
 *   catch (err) {
 *     const unmapped = applyValidationErrors(err, setError, [
 *       "name", "email", "phone", "password", "password_confirmation"
 *     ])
 *     if (unmapped.length) sileo.error({ title: unmapped[0].message })
 *   }
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
