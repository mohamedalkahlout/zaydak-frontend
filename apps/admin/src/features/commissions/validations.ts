import { z } from 'zod'

/**
 * The decimal rule and both write conversions come from
 * `@/shared/lib/format`, which mirrors the back-end's `money.helper.ts`
 * rounding. This module used to carry its own copy of the rule and to round
 * inline at the mutation, so the write boundary was greppable on the plans
 * side and invisible here.
 */
export { hasAtMostTwoDecimals, toCents, bpsOf } from '@/shared/lib/format'
import { hasAtMostTwoDecimals } from '@/shared/lib/format'

const decimalMessage = (label: string) =>
  `${label} cannot have more than 2 decimal places`

/**
 * Mirrors `CreateCommissionInput`. Units match the GraphQL boundary: `commission`
 * is a percent (stored as `commission * 100` bps) and the balance thresholds are
 * major units (stored as cents).
 *
 * The number fields are plain `z.number()` rather than `z.coerce.number()`: the
 * inputs register with `valueAsNumber`, so react-hook-form hands zod a number
 * already, and coercion would erase the schema's input type for `zodResolver`.
 *
 * `max_balance` is nullable in the schema — an open-ended top tier — so the form
 * treats a cleared field as "no ceiling" rather than zero.
 */
export const commissionSchema = z
  .object({
    level: z.string().trim().min(1, 'Level is required'),
    sub_level: z.string().trim().optional(),
    description: z.string().trim().optional(),
    language: z.string().trim().min(1, 'Language is required'),
    min_balance: z
      .number('Minimum balance must be a number')
      .min(0, 'Minimum balance cannot be negative')
      .refine(hasAtMostTwoDecimals, decimalMessage('Minimum balance')),
    max_balance: z
      .number('Maximum balance must be a number')
      .min(0, 'Maximum balance cannot be negative')
      .refine(hasAtMostTwoDecimals, decimalMessage('Maximum balance'))
      .nullable(),
    commission: z
      .number('Commission must be a number')
      .min(0, 'Commission cannot be negative')
      .max(100, 'Commission cannot exceed 100%')
      .refine(hasAtMostTwoDecimals, decimalMessage('Commission')),
  })
  .refine(
    (data) => data.max_balance === null || data.max_balance > data.min_balance,
    {
      message: 'Maximum balance must be greater than the minimum',
      path: ['max_balance'],
    },
  )

export type CommissionInput = z.infer<typeof commissionSchema>
