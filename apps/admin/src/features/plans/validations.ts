import { z } from 'zod'

/**
 * The money rules live in `@/shared/lib/format` — one copy for the whole
 * console. This module had its own `hasAtMostTwoDecimals` and `toCents`, and
 * the commissions module had a third and fourth; identical today, but a
 * shared rule kept in four places is four rules waiting to diverge, and the
 * one that had already diverged was `toCents` (see its note there).
 */
export { hasAtMostTwoDecimals, toCents } from '@/shared/lib/format'
import { hasAtMostTwoDecimals } from '@/shared/lib/format'

/**
 * Mirrors `CreatePlanInput` / `UpdatePlanInput`.
 *
 * Numbers are plain `z.number()` rather than `z.coerce.number()`: the inputs
 * register with `valueAsNumber`, so react-hook-form hands zod a number already,
 * and coercion would erase the schema's input type for `zodResolver`.
 */
export const planSchema = z.object({
  /**
   * The server locks this to a slug shape and **refuses to rename it** — it is
   * the stable handle the seed, the fallback lookup and support all key on. The
   * form mirrors the same pattern so the admin finds out before submitting.
   */
  code: z
    .string()
    .trim()
    .min(1, 'Code is required')
    .regex(
      /^[a-z0-9][a-z0-9_-]*$/,
      'Code must be lowercase letters, digits, dash or underscore',
    ),
  name: z.string().trim().min(1, 'Name is required'),
  name_ar: z.string().trim().optional(),
  description: z.string().trim().optional(),
  monthly_price: z
    .number('Monthly price must be a number')
    .min(0, 'Monthly price cannot be negative')
    .refine(
      hasAtMostTwoDecimals,
      'Monthly price cannot have more than 2 decimal places',
    ),
  yearly_price: z
    .number('Yearly price must be a number')
    .min(0, 'Yearly price cannot be negative')
    .refine(
      hasAtMostTwoDecimals,
      'Yearly price cannot have more than 2 decimal places',
    ),
  currency: z.string().trim().min(1, 'Currency is required'),
  trial_days: z
    .number('Trial days must be a number')
    .int('Trial days must be a whole number')
    .min(0, 'Trial days cannot be negative'),
  is_public: z.boolean(),
})

export type PlanFormValues = z.infer<typeof planSchema>

/**
 * One cell of the entitlement matrix, as the form holds it.
 *
 * `limit` is a **string** on purpose. `null` (unlimited) and `0` (an allowance
 * of none) are different answers the server treats differently, and a numeric
 * input cannot distinguish "cleared" from "zero" — an empty `<input
 * type=number>` yields `NaN`, which would have to be guessed at. Keeping the
 * raw string lets `parseLimit` below make that call explicitly.
 */
export interface EntitlementDraft {
  feature_key: string
  enabled: boolean
  limit: string
  config: Record<string, unknown>
}

/**
 * Empty means unlimited (`null`); anything else must be a non-negative whole
 * number. Returns `undefined` for input the admin needs to fix, so the caller
 * can block the save instead of writing a guess.
 */
export function parseLimit(raw: string): number | null | undefined {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  if (!/^\d+$/.test(trimmed)) return undefined
  const n = Number(trimmed)
  return Number.isSafeInteger(n) ? n : undefined
}

/** How a limit reads back into the input: `null` is empty, not "0". */
export function formatLimit(limit: number | null | undefined): string {
  return limit === null || limit === undefined ? '' : String(limit)
}
