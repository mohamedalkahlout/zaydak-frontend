/**
 * Reading the reason out of a back-end validation failure in the storefront.
 *
 * **`err.message` is always the literal string "Validation failed".** The API
 * puts the reason in `extensions.validation_errors[]` — a field, a code and the
 * human messages — and the top-level message is a constant. So any screen that
 * toasts `error.message` shows a shopper a sentence that tells them nothing.
 */

export interface BackendValidationError {
  field?: string | null
  code?: string | null
  messages?: string[] | null
}

interface GraphQLishError {
  extensions?: {
    validation_errors?: unknown
    detail?: unknown
    error_code?: unknown
  } | null
  message?: string
  errors?: unknown
  cause?: unknown
  graphQLErrors?: unknown
}

/** Every validation error carried by `err`, from wherever Apollo put it. */
export function validationErrors(err: unknown): BackendValidationError[] {
  for (const candidate of unwrap(err)) {
    const raw = candidate?.extensions?.validation_errors
    if (Array.isArray(raw) && raw.length > 0) {
      return raw as BackendValidationError[]
    }
  }
  return []
}

/**
 * The sentence to show a person, or `fallback` when there is none.
 *
 * Joins every message rather than taking the first.
 */
export function validationMessage(
  err: unknown,
  fallback = "Something went wrong",
): string {
  const messages = validationErrors(err)
    .flatMap((e) => e.messages ?? [])
    .filter((m): m is string => typeof m === "string" && m.trim().length > 0)

  if (messages.length > 0) return [...new Set(messages)].join(" ")

  for (const candidate of unwrap(err)) {
    const detail = candidate?.extensions?.detail
    if (typeof detail === "string" && detail.trim()) return detail
  }

  const message = (err as GraphQLishError | undefined)?.message
  return message && message !== "Validation failed" ? message : fallback
}

/** Whether `err` carries a particular back-end validation code. */
export function hasValidationCode(err: unknown, code: string): boolean {
  return validationErrors(err).some((e) => e.code === code)
}

/**
 * The back-end's `extensions.error_code` on `err`, wherever Apollo put it —
 * what a screen branches on when one failure needs something other than a
 * toast (a fresh quote, say). Null when there is none.
 */
export function errorCodeOf(err: unknown): string | null {
  for (const candidate of unwrap(err)) {
    const code = candidate?.extensions?.error_code
    if (typeof code === "string" && code) return code
  }
  return null
}

function unwrap(err: unknown): Array<GraphQLishError | undefined> {
  const e = err as GraphQLishError | undefined
  const out: Array<GraphQLishError | undefined> = []
  const push = (value: unknown) => {
    if (Array.isArray(value)) out.push(...(value as GraphQLishError[]))
    else if (value) out.push(value as GraphQLishError)
  }
  push(e?.errors)
  push(e?.graphQLErrors)
  push((e?.cause as GraphQLishError | undefined)?.errors)
  push(e?.cause)
  push(e)
  return out
}
