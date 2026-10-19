import { CombinedGraphQLErrors, ServerError } from "@apollo/client/errors"

/**
 * Deploy-order safety for a field the API gained after this dashboard shipped.
 *
 * Vercel ships this app minutes after a push; the API image is rebuilt on its
 * own schedule. An operation that selects a field the running API does not
 * have is refused at GraphQL validation — the whole operation, not the one
 * field. So an operation refused *for an unknown field* is sent again as the
 * "legacy" document it was before the field existed, and the screen behaves
 * as it did then. A request that fails validation is never executed, so the
 * retry cannot repeat a side effect.
 *
 * Neither global error link reacts to that first refusal: the back-end's
 * `formatError` answers it as `VALIDATION_ERROR`, which the link keeps silent
 * (it is in `SILENT_CODES`) and does not sign anyone out over.
 *
 * Each use keeps its legacy documents in a file of its own, marked
 * transitional, to be deleted once every API it can reach has the field
 * (`features/auth/lib/legacy-code-length.ts`,
 * `features/ai/lib/legacy-share-currency.ts`).
 */

const UNKNOWN_FIELD = /Cannot query field/

/**
 * The API does not know a field the operation selected. Apollo Server calls
 * that `GRAPHQL_VALIDATION_FAILED`; ours rewrites it to `VALIDATION_ERROR` and
 * keeps graphql-js's message, so the message is what is matched. A 400 that
 * arrived without a GraphQL content type is read from its body.
 */
export function isUnknownFieldError(err: unknown): boolean {
  if (CombinedGraphQLErrors.is(err)) {
    return err.errors.some(
      (e) =>
        e.extensions?.code === "GRAPHQL_VALIDATION_FAILED" ||
        UNKNOWN_FIELD.test(e.message),
    )
  }
  if (ServerError.is(err)) {
    return err.statusCode === 400 && UNKNOWN_FIELD.test(err.bodyText)
  }
  return false
}

/**
 * Run `current`; if the API refused it for a field it does not know, run
 * `legacy` once instead. Any other failure is the caller's, unchanged.
 */
export async function withLegacyFallback<T>(
  current: () => Promise<T>,
  legacy: () => Promise<T>,
): Promise<T> {
  try {
    return await current()
  } catch (err) {
    if (!isUnknownFieldError(err)) throw err
    return legacy()
  }
}
