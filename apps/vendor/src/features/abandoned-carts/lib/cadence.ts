/**
 * Merchant-side copy of the back-end cadence clamp.
 *
 * Writing `abandoned_checkout.steps` without this is a mail bomb: a form that
 * accepts `[1, 2, 3, …]` would schedule a recovery email every minute from the
 * platform's IP. The worker already clamps on read; Settings also clamps on
 * upsert. This copy exists so the editor shows the same envelope the server
 * will store, rather than a list that silently shrinks after Save.
 */

export const DEFAULT_RECOVERY_STEPS_MINUTES: readonly number[] = [
  60, 1440, 4320,
]

export const MAX_RECOVERY_STEPS = 4
export const MIN_STEP_MINUTES = 30
export const MIN_STEP_SPACING_MINUTES = 60
export const MAX_STEP_MINUTES = 30 * 24 * 60

export type CadenceUnit = "minutes" | "hours" | "days"

export interface CadenceStepDraft {
  amount: number
  unit: CadenceUnit
}

export function clampRecoverySteps(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [...DEFAULT_RECOVERY_STEPS_MINUTES]

  const candidates = raw
    .map((entry) => (typeof entry === "number" ? entry : Number(entry)))
    .filter((n): n is number => Number.isFinite(n))
    .map((n) => Math.round(n))
    .filter((n) => n >= MIN_STEP_MINUTES)
    .map((n) => Math.min(n, MAX_STEP_MINUTES))
    .sort((a, b) => a - b)

  const steps: number[] = []
  for (const step of candidates) {
    if (steps.length >= MAX_RECOVERY_STEPS) break
    const previous = steps[steps.length - 1]
    if (previous !== undefined && step - previous < MIN_STEP_SPACING_MINUTES) {
      continue
    }
    steps.push(step)
  }

  return steps.length ? steps : [...DEFAULT_RECOVERY_STEPS_MINUTES]
}

export function minutesFromDraft(draft: CadenceStepDraft): number {
  if (draft.unit === "days") return Math.round(draft.amount * 1440)
  if (draft.unit === "hours") return Math.round(draft.amount * 60)
  return Math.round(draft.amount)
}

export function draftFromMinutes(minutes: number): CadenceStepDraft {
  if (minutes % 1440 === 0) {
    return { amount: minutes / 1440, unit: "days" }
  }
  if (minutes % 60 === 0) {
    return { amount: minutes / 60, unit: "hours" }
  }
  return { amount: minutes, unit: "minutes" }
}

export function draftsFromSteps(steps: number[]): CadenceStepDraft[] {
  return steps.map(draftFromMinutes)
}

export function stepsFromDrafts(drafts: CadenceStepDraft[]): number[] {
  return clampRecoverySteps(drafts.map(minutesFromDraft))
}
