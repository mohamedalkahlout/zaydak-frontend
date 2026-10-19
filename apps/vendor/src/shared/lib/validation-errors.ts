/**
 * Reading the reason out of a back-end validation failure.
 *
 * **`err.message` is always the literal string "Validation failed".** The API
 * puts the reason in `extensions.validation_errors[]` — a field, a code and the
 * human messages — and the top-level message is a constant. So any screen that
 * toasts `error.message` shows a merchant a sentence that tells them nothing,
 * on an action the server refused for a reason it was perfectly willing to
 * state: the location still holds stock, the warehouse has no phone number, no
 * carrier account is connected.
 *
 * Six features had already noticed and each written its own extractor. This is
 * that logic in one place, for the callers that only need the sentence; a form
 * mapping errors back onto named fields still wants the whole array, which
 * `validationErrors()` returns.
 */

export interface BackendValidationError {
  field?: string | null;
  code?: string | null;
  messages?: string[] | null;
}

interface GraphQLishError {
  extensions?: { validation_errors?: unknown; detail?: unknown } | null;
  message?: string;
  errors?: unknown;
  cause?: unknown;
  graphQLErrors?: unknown;
}

/** Every validation error carried by `err`, from wherever Apollo put it. */
export function validationErrors(err: unknown): BackendValidationError[] {
  for (const candidate of unwrap(err)) {
    const raw = candidate?.extensions?.validation_errors;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw as BackendValidationError[];
    }
  }
  return [];
}

/**
 * The sentence to show a person, or `fallback` when there is none.
 *
 * Joins every message rather than taking the first: `enableCarrierPickup`
 * reports each missing field as its own entry, and naming one at a time turns
 * one fix into three round trips.
 */
export function validationMessage(
  err: unknown,
  fallback = "Something went wrong",
): string {
  const messages = validationErrors(err)
    .flatMap((e) => e.messages ?? [])
    .filter((m): m is string => typeof m === "string" && m.trim().length > 0)

  if (messages.length > 0) return [...new Set(messages)].join(" ")

  // `detail` carries the third party's own words where there is one — the
  // carrier's refusal is more use than our generic sentence.
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
 * The error shapes Apollo hands a caller.
 *
 * A `CombinedGraphQLErrors` keeps them on `.errors`, older shapes on
 * `.graphQLErrors`, a link may rethrow with the original on `.cause`, and a
 * single error is itself the candidate. Checked in that order so the most
 * specific wins.
 */
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
