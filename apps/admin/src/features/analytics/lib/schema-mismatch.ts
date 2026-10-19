import { CombinedGraphQLErrors, ServerError } from "@apollo/client/errors"

/** graphql-js's wording when a document names something the schema lacks. */
const NOT_IN_SCHEMA = /(Cannot query field|Unknown type|Unknown argument)/

/**
 * The API refused the operation at validation because its schema does not
 * have something the document selects: it is older than this console.
 *
 * **A mirror of `apps/vendor/src/features/analytics/lib/schema-mismatch.ts`**
 * (the console cannot import vendor code). Vercel ships the console minutes
 * after a push; the API image is rebuilt on its own schedule. Until it is,
 * such a refusal is permanent, so a panel that depends on a new field is left
 * out rather than shown as an error whose retry can never work. A network
 * failure or a server error is different, and keeps its retry.
 *
 * Apollo Server's own code for it is `GRAPHQL_VALIDATION_FAILED`; ours
 * rewrites that to `VALIDATION_ERROR`, which input validation uses too, so the
 * graphql-js message is what tells the two apart. Every error in the response
 * has to be one, or something else went wrong as well.
 */
export function isSchemaMismatchError(error: unknown): boolean {
  if (CombinedGraphQLErrors.is(error)) {
    return (
      error.errors.length > 0 &&
      error.errors.every(
        (e) =>
          e.extensions?.code === "GRAPHQL_VALIDATION_FAILED" ||
          NOT_IN_SCHEMA.test(e.message),
      )
    )
  }
  // A 400 that arrived without a GraphQL content type is read from its body.
  if (ServerError.is(error)) {
    return error.statusCode === 400 && NOT_IN_SCHEMA.test(error.bodyText)
  }
  return false
}
