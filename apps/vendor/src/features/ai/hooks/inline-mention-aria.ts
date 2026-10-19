/**
 * The ARIA contract between the panel's composer textarea and its @-mention
 * picker — the ids they have to agree on, and the combobox attributes the
 * textarea carries while the picker is open.
 *
 * It lives in its own module, with no React and no UI imports, because three
 * places need the same answer and two of them must not import the third: the
 * picker (`inline-mention-menu.tsx`) renders the ids, the composer input
 * (`mention-textarea.tsx`) points at them, and the state machine
 * (`lib/use-inline-mention-composer.ts`) decides which option is active. A
 * constant shared by the first two is what lets the relationship hold without
 * the panel threading an id through both — the textarea's `aria-controls` and
 * the listbox's `id` are the same string by construction rather than by
 * convention.
 *
 * One document holds one slide-in panel, so one fixed id is unambiguous; both
 * components still take an override, so a second composer on a page would not
 * have to duplicate ids.
 */

/** The picker's `<ul role="listbox">` id, and the textarea's `aria-controls`. */
export const INLINE_MENTION_LISTBOX_ID = "inline-mention-listbox"

/**
 * Marks a textarea whose combobox attributes React is rendering. The composer
 * hook writes the same attributes imperatively for a caller that does not pass
 * them (see `use-inline-mention-composer.ts`), and this is how it stands down
 * rather than fighting React for the element — one owner at a time.
 */
export const INLINE_MENTION_MANAGED_ATTR = "data-mention-combobox"

/**
 * A row's id. Keyed by index rather than by `type:id` because the index is
 * what the state machine tracks: `aria-activedescendant` has to name the row
 * `activeIndex` highlights, and both levels of the picker (categories, then
 * that category's entities) are indexed the same way.
 */
export function inlineMentionOptionId(
  index: number,
  listboxId: string = INLINE_MENTION_LISTBOX_ID,
): string {
  return `${listboxId}-option-${index}`
}

export interface InlineMentionComboboxState {
  /** The picker is on screen. */
  open: boolean
  listboxId: string
  /** The highlighted row's id, or `null` when there is no row to name. */
  activeOptionId: string | null
}

export interface InlineMentionComboboxAria {
  role: "combobox"
  "aria-haspopup": "listbox"
  "aria-autocomplete": "list"
  "aria-expanded": boolean
  /** Only while open: the listbox does not exist when the picker is closed,
   *  and a relationship pointing at a missing element is worse than none. */
  "aria-controls": string | undefined
  "aria-activedescendant": string | undefined
}

/** The attributes a combobox textarea carries, for the given picker state. */
export function inlineMentionComboboxAria(
  state: InlineMentionComboboxState,
): InlineMentionComboboxAria {
  return {
    role: "combobox",
    "aria-haspopup": "listbox",
    "aria-autocomplete": "list",
    "aria-expanded": state.open,
    "aria-controls": state.open ? state.listboxId : undefined,
    "aria-activedescendant":
      state.open && state.activeOptionId ? state.activeOptionId : undefined,
  }
}

/**
 * The same attributes, written straight onto an element. `undefined` removes,
 * so a closed picker leaves no dangling `aria-controls` behind it.
 */
export function applyInlineMentionComboboxAria(
  el: HTMLElement,
  state: InlineMentionComboboxState,
): void {
  for (const [name, value] of Object.entries(inlineMentionComboboxAria(state))) {
    if (value === undefined) el.removeAttribute(name)
    else el.setAttribute(name, String(value))
  }
}
