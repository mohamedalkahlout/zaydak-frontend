import type { SignupStep } from "../types"

/**
 * The rail shows three milestones, but the wizard has four panes: verifying the
 * SMS code is part of "your info", not a milestone of its own — you are not
 * further along for having received a text. So `panes` maps many panes onto one
 * rail row, which is what keeps the rail steady while the OTP screen swaps in.
 */
export interface SignupRailStep {
  /** i18n key suffix under the `signup.steps` namespace. */
  key: "start" | "personal" | "store"
  panes: readonly SignupStep[]
  /** Overall completion once this milestone is done. */
  progress: number
}

export const SIGNUP_RAIL_STEPS: readonly SignupRailStep[] = [
  { key: "start", panes: ["email"], progress: 50 },
  { key: "personal", panes: ["personal", "otp"], progress: 80 },
  { key: "store", panes: ["store"], progress: 100 },
]

export const SIGNUP_PANE_ORDER: readonly SignupStep[] = [
  "email",
  "personal",
  "otp",
  "store",
]

export function railIndexForPane(pane: SignupStep): number {
  const index = SIGNUP_RAIL_STEPS.findIndex((s) => s.panes.includes(pane))
  return index === -1 ? 0 : index
}

/**
 * The headline figure — what is *done*, not what is open. Standing on the first
 * pane reads "0% complete"; the number only moves once a milestone is behind
 * you, which is why an untouched form does not claim credit for itself.
 */
export function completedProgress(pane: SignupStep): number {
  const active = railIndexForPane(pane)
  return active === 0 ? 0 : (SIGNUP_RAIL_STEPS[active - 1]?.progress ?? 0)
}
