"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import { useWatch, type Control, type FieldValues } from "react-hook-form"

/**
 * Which fields on this form the assistant filled in, and which of those still
 * hold what it put there.
 *
 * **Why a context and not a prop.** The provenance is thrown away at the one
 * place it could have been kept: a form merges the handoff over its starting
 * values — the product form through `mergeProductPrefill`, one level deep
 * with the `{ en, ar }` fields merged per locale — which produces the right
 * values and no record of where any of them came from. Threading a second
 * "and these keys were the assistant's" prop from the form root down to each
 * of a dozen cards would be a prop nobody adds to the next card.
 *
 * **Why the mark clears on edit.** The vendor's question in front of a marked
 * field is "is this mine or its?". Once they have typed in it, the answer is
 * "yours", and a mark still sitting there is telling them something false.
 *
 * **Why it compares against the proposed value, not against "dirty".** It
 * used to read react-hook-form's `dirtyFields`, which was the same thing only
 * while the assistant's value was also the field's default — true for a
 * handoff at mount, false the moment the assistant could change a field on a
 * form already open (the live form channel). A patched field is dirty by
 * design, since the save bar has to show, so "dirty" no longer means "the
 * vendor touched it". The rule is now the direct one: a field is the
 * assistant's while its value is exactly the one the assistant proposed.
 * Exactly — `===` on primitives, as react-hook-form's own dirty check does —
 * so 200 → "300" → "200" stays cleared: an input yields the string "200", and
 * once the vendor has been in the field it is theirs.
 *
 * **Why an empty proposal marks nothing.** `create_product` used to put
 * `description: { en: "", ar: "" }` in every handoff that had no description,
 * and an empty editor holds exactly that, so the rule above read "Filled by
 * Sidekick" over a field the assistant never wrote in. A proposal of `""`,
 * `null`, or a translatable with every locale blank proposes nothing and is
 * dropped before it can become a mark. Here rather than only at the tool,
 * because turns persisted before the tool stopped sending it still carry it.
 */

interface AiPrefillContextValue {
  /** True when the assistant supplied this field and it still holds the
   * value the assistant proposed. */
  stillProposed: (name: string) => boolean
}

const AiPrefillContext = createContext<AiPrefillContextValue | null>(null)

/** A form that was not opened from a handoff. Shadows a parent form's marks
 * so a nested editor does not inherit them onto its own fields. */
const NO_PREFILL: AiPrefillContextValue = { stillProposed: () => false }

interface WatcherProps<T extends FieldValues> {
  /** What the assistant proposed, keyed by field name — the handoff's
   * prefill plus anything patched in since. */
  proposed: Readonly<Record<string, unknown>>
  control: Control<T>
  children: ReactNode
}

interface Props<T extends FieldValues> extends WatcherProps<T> {
  /** Whether this form was opened from an assistant handoff — fixed for the
   * life of the form. Not derived from `proposed`: a handoff can arrive with
   * nothing in it, and switching from no provider to the watcher when the
   * first patch lands would change the element above the whole form and
   * remount it, throwing away every card's local state. */
  handoff: boolean
}

export function AiPrefillProvider<T extends FieldValues>({
  handoff,
  proposed,
  control,
  children,
}: Props<T>) {
  // No handoff, no subscription. This component calls no hooks of its own —
  // the watcher below is where they live, so an ordinary form pays nothing
  // for this. The empty context is still provided, so a nested form does not
  // inherit the form around it.
  if (!handoff) {
    return <AiPrefillContext value={NO_PREFILL}>{children}</AiPrefillContext>
  }
  return (
    <PrefillWatcher proposed={proposed} control={control}>
      {children}
    </PrefillWatcher>
  )
}

/** A blank string, `null`/`undefined`, or a translatable with every locale
 * blank: a proposal that proposes nothing. */
function isEmptyProposal(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === "string") return value.trim() === ""
  if (typeof value !== "object" || Array.isArray(value)) return false
  return Object.values(value).every(
    (locale) =>
      locale == null || (typeof locale === "string" && locale.trim() === ""),
  )
}

/** Structural equality, strict on primitives. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every((k) =>
    deepEqual(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k],
    ),
  )
}

function PrefillWatcher<T extends FieldValues>({
  proposed,
  control,
  children,
}: WatcherProps<T>) {
  const keys = useMemo(
    () =>
      Object.keys(proposed).filter((name) => !isEmptyProposal(proposed[name])),
    [proposed],
  )

  // Scoped to the proposed fields. An unscoped watch subscribes to every
  // field on the form, which on a product form means re-rendering on each
  // keystroke anywhere in it.
  const watched = useWatch({ control, name: keys as never }) as unknown

  const current = Array.isArray(watched) ? watched : []

  // Memoized on WHICH fields still hold the proposal, not on the watched
  // values: the context then changes only when a mark should appear or go,
  // not on every keystroke inside a field that is already cleared.
  const signature = keys
    .filter((name, i) => deepEqual(current[i], proposed[name]))
    .join("|")

  const value = useMemo<AiPrefillContextValue>(() => {
    const still = new Set(signature ? signature.split("|") : [])
    return { stillProposed: (name) => still.has(name) }
  }, [signature])

  return <AiPrefillContext value={value}>{children}</AiPrefillContext>
}

/**
 * Whether to mark `name` as the assistant's work.
 *
 * False everywhere there is no provider, which is every form the vendor
 * opened themselves — so a mark component can be dropped into a shared card
 * without that card having to know whether a handoff is in play.
 */
export function useAiFilled(name: string): boolean {
  const ctx = useContext(AiPrefillContext)
  return ctx ? ctx.stillProposed(name) : false
}
