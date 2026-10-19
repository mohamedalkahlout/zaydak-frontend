"use client"

/**
 * AI-image error copy — now a thin alias over the general plan/quota
 * translator.
 *
 * The mapping generalized when the entitlements platform landed: the same
 * shape of rejection now comes from every metered capability, not just images,
 * so one table serves them all (`plan-errors.ts`). This file stays so the two
 * existing call sites — `features/files/lib/use-enhance-file.ts` and the
 * product-form AI panel — keep their imports and their behaviour.
 *
 * `isAiQuotaError` and `useAiImageError` are the old names with the old
 * signatures. New code should import `isQuotaError` / `usePlanError` /
 * `isUpgradeError` from `plan-errors.ts` directly.
 */
export {
  isQuotaError as isAiQuotaError,
  usePlanError as useAiImageError,
  isUpgradeError,
  type PlanFailure as AiImageFailure,
} from "./plan-errors"
