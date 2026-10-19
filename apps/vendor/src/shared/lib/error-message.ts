/**
 * The sentence to show for a caught throw.
 *
 * Three shipping call sites had each written `catch (err: any)` and reached
 * straight for `err.message`, which is an `any` in a codebase that bans one and
 * a `TypeError` the moment something that is not an `Error` is thrown. The
 * narrowing is one line, but it is the same line every time, so it lives here.
 *
 * This is deliberately *not* `validation-errors.ts`. That module digs the
 * reason out of a back-end validation failure, whose top-level message is
 * always the constant "Validation failed"; this one is the plain fallback for a
 * caller that has no field-level errors to unpack and just needs a string.
 */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message
  return fallback
}
