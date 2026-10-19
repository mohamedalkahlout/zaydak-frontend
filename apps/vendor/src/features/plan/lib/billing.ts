import type { PlanEntry } from "../types"

/** Twelve monthly charges is what a yearly price is compared against. */
const MONTHS_PER_YEAR = 12

/**
 * The discount the yearly interval buys, as a whole percent, or null when there
 * is nothing honest to claim.
 *
 * **The minimum across plans, not the maximum.** The badge sits on one switch
 * that applies to every plan in the picker, so it has to be true for whichever
 * plan the vendor then clicks. Taking the best plan's discount would advertise
 * a saving that the plan they actually pick does not give them.
 *
 * Plans priced for only one interval are skipped rather than counted as zero —
 * a monthly-only tier is not a plan that saves nothing yearly, it is a plan
 * with no yearly price, and letting it collapse the badge to null would hide a
 * real discount on every other tier.
 */
/**
 * What a yearly plan costs per month, in cents.
 *
 * The pricing table quotes every tier per month whichever interval is selected,
 * because "$299/mo billed yearly" is the number a vendor compares against the
 * monthly column — "$3,588/yr" is not. Rounded to the cent so twelve of them
 * cannot read as less than what is actually charged.
 */
export function monthlyEquivalentCents(plan: PlanEntry): number {
  return Math.ceil(plan.yearly_price_cents / MONTHS_PER_YEAR)
}

export function yearlySavingPercent(plans: PlanEntry[]): number | null {
  let lowest: number | null = null

  for (const plan of plans) {
    if (plan.monthly_price_cents <= 0 || plan.yearly_price_cents <= 0) continue

    const full = plan.monthly_price_cents * MONTHS_PER_YEAR
    const saved = full - plan.yearly_price_cents
    // A yearly price at or above 12x monthly is not a discount. One such plan
    // is enough to make the badge false, so it wins outright.
    if (saved <= 0) return null

    const percent = Math.floor((saved / full) * 100)
    if (percent <= 0) return null
    if (lowest === null || percent < lowest) lowest = percent
  }

  return lowest
}
