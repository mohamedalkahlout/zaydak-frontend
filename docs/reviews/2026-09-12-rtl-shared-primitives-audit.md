# RTL audit — shared primitives (T3-20, static half)

**Date:** 2026-09-12
**Scope covered:** `packages/ui/src/components/**`, the two consoles' data-table chrome, and the one storefront workaround that existed because of a defect in the package.
**Status:** the static half is closed. **The browser half of T3-20 is still open** — see "What a human still has to check".

---

## What this pass could and could not do

T3-20 asks for checkout, modals and tables to be walked in a real browser under
`dir="rtl"`. That was not done and no test here replaces it: the suites run in
jsdom, which **performs no layout**. jsdom computes no boxes, resolves no
logical properties, and reports the same zero rectangle for a control on the
correct edge and one hanging off the panel. Anything about *position* is
therefore unprovable here.

What is provable is the thing that actually broke: a **physical** direction
utility written where a **logical** one belongs. That is a source-level fact, it
is greppable, and it is what this pass fixed.

The repo already had the convention — 99 uses of the `rtl:` variant, 43 of them
`rtl:rotate-180`, plus `ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-` throughout. This
pass found the misses; it did not invent a policy.

---

## The confirmed defect, and the workaround it had grown

`SheetContent`'s close button was pinned `absolute top-3 right-3`.

A sheet opens from the edge the reader's text ends at, so its close belongs on
the panel's outer corner — the right in LTR, the **left** in RTL. Pinned
physically it stayed right in both, which on an RTL panel is the *inner* corner,
directly over the title. `SheetTitle`'s own `pe-6` (used by
`apps/vendor/.../file-detail-sheet.tsx`) went on reserving the gap at the
opposite end, so the title was truncated on one side and overlapped on the
other.

`apps/storefront/src/features/cart/components/cart-drawer.tsx` carried the
evidence in a written-out comment and worked around it locally: it passed
`showCloseButton={false}` and hand-rolled its own close in the header row.

**Both halves are now resolved.** The source is `end-3`; the workaround, its
comment and its now-unused `X` import are gone, and the drawer uses the shared
button. Leaving the workaround in place would have re-broken it — the local
correction plus the source correction is two corrections.

One thing had to move for that removal to be lossless: the hand-rolled button
was localized (`aria-label={tCommon("close")}`) while the shared one hardcoded
`Close`. `SheetContent` now takes a `closeLabel?: string` prop (default
`"Close"`), which is the package's stated contract — pass already-localized
strings in, never reach for `next-intl` inside `@repo/ui`.

**Every other `SheetContent` call site was checked for the same workaround.**
There is none. `catalog-page.tsx` uses `side="bottom"`; `file-detail-sheet.tsx`
relies on the default and its `pe-6` title now agrees with it;
`conversations-sidebar.tsx` styles its header but does not reposition the close;
`packages/ui/src/components/sidebar.tsx` hides it (`[&>button]:hidden`) and
draws its own chrome. `DialogContent` had no downstream workaround either.

---

## Fixed

### Behavioural — the control was wrong, not just unmirrored

| File | Was | Now | Why |
|---|---|---|---|
| `switch.tsx` | `translate-x-0.5` → `data-checked:translate-x-[18px]` | `[--switch-dir:1] rtl:[--switch-dir:-1]` on the root, `translate-x-[calc(…*var(--switch-dir))]` on the thumb | The track is a flex row, so the thumb already rests on the **inline** start edge — the right one in RTL. A rightward `translateX` from there put the unchecked thumb 2px past the end of the track and the checked thumb clean off it. Same shape as the storefront's existing `--seg-dir`. |
| `apple-switch.tsx` | thumb `left-0` + motion `x`, drag from raw `clientX` delta | `rtl:-scale-x-100` on the track; drag delta multiplied by a direction sign sampled at pointer-down | The visual never mirrored, and CSS cannot fix the gesture: pointer deltas are viewport pixels, so without the sign an RTL user drags *away* from "on" to switch it on. |
| `sheet.tsx` | close `right-3` | close `end-3`, plus `closeLabel` | Above. |
| `dialog.tsx` | close `right-2` | close `end-2` | Same defect, every dialog in all three apps. |
| `nav-main.tsx` | `aria-expanded:rotate-90` | `aria-expanded:rotate-90 rtl:not-aria-expanded:rotate-180` | The collapsed chevron pointed into the page in RTL. The flip is scoped to the collapsed state because the two rotations otherwise compose into "up" when expanded. `not-aria-expanded` and `aria-expanded` cannot both match, so neither rule has to outrank the other — which matters, because Tailwind v4 compiles `rtl:` to a zero-specificity `:where(…)` and a tie would be decided by stylesheet order. |

### Directional glyphs

| File | Change |
|---|---|
| `breadcrumb.tsx` | default separator chevron gets `rtl:rotate-180` — the trail reads start-to-end. A caller-supplied separator is untouched. |
| `pagination.tsx` | prev/next chevrons get `rtl:rotate-180`. This is the single fix that corrects **both** consoles' list pagination, since `apps/admin/.../data-table-pagination.tsx` and `apps/vendor/.../data-table-pagination.tsx` both render these. |
| `sidebar-toggle-icon.tsx` | the whole glyph gets `rtl:-scale-x-100`. Both paths draw the panel on the left, which is the one place the sidebar never is in RTL. Used by `site-header.tsx`, so it is on every console screen. |
| `sidebar.tsx` (`SidebarTrigger`) | `PanelLeftIcon` gets `rtl:-scale-x-100`, same reason. |

### Physical → logical

| File | Change |
|---|---|
| `table.tsx` | `TableHead` `text-left` → `text-start`; checkbox-cell `pr-0` → `pe-0` on head and cell. The admin console had already spelled `text-start` out in `DataTableHead` with a comment naming the primitive as the reason; that comment is updated, since the reason is gone. |
| `field.tsx` | `FieldDescription` `text-left` → `text-start`. |
| `dropdown-menu.tsx` | `data-inset:pl-7` → `ps-7` (×5); checkbox/radio item `pr-8 pl-1.5` → `pe-8 ps-1.5`; indicator `absolute right-2` → `end-2` (×2); shortcut `ml-auto` → `ms-auto`. |
| `select.tsx` | trigger `pr-2 pl-2.5` → `pe-2 ps-2.5`; item `pr-8 pl-1.5` → `pe-8 ps-1.5`; indicator `right-2` → `end-2`. |
| `command.tsx` | check `ml-auto` → `ms-auto`; `CommandShortcut` `ml-auto` → `ms-auto`; addon `pl-2!` → `ps-2!`. |
| `input-group.tsx` | the `inline-start` / `inline-end` addons were named logically but padded physically: `pl-2`/`ml-*` → `ps-2`/`ms-*`, `pr-2`/`mr-*` → `pe-2`/`me-*`, and the input's own `pr-1.5`/`pl-1.5` → `pe-`/`ps-`. |
| `badge.tsx`, `button.tsx`, `tabs.tsx` | same pattern — `has-data-[icon=inline-end]:pr-*` / `inline-start:pl-*` → `pe-*` / `ps-*`. The data attribute was already spelled `inline-start`/`inline-end`; only the padding it drove was not. |
| `tabs.tsx` | vertical active indicator `after:-right-1` → `after:-end-1`. |
| `tooltip.tsx` | `has-data-[slot=kbd]:pr-1.5` → `pe-1.5`. |
| `avatar.tsx` | `AvatarBadge` `right-0` → `end-0`. |
| `unsaved-bar.tsx` | `pl-3 pr-1.5` → `ps-3 pe-1.5` (message at the start, buttons at the end). |
| `pagination.tsx` | `pl-1.5!` / `pr-1.5!` → `ps-1.5!` / `pe-1.5!`. |
| vendor `data-table-faceted-filter.tsx` | `mr-2` → `me-2` (×2), `ml-auto` → `ms-auto`. |
| vendor `data-table-view-options.tsx` | `ml-auto` → `ms-auto`, `mr-1` → `me-1`. |

---

## Deliberately left alone

A blind `ml-` → `ms-` sweep would have been a regression. These are physical on
purpose:

- **`input-otp.tsx`** — `border-r`, `first:rounded-l-lg`, `last:rounded-r-lg`.
  LTR-locked content. Every call site goes through `AuthOtpGroup`, which sets
  `dir="ltr"` with a written-out reason: a verification code reads
  left-to-right in either locale, like the one in the message. Making the
  rounding logical would round the wrong corners of a deliberately LTR row.
- **`sheet.tsx` / `drawer.tsx` / `sidebar.tsx` `data-[side=*]` geometry** —
  `data-[side=left]:left-0`, `border-r`, the enter/exit translations. `side` is
  a **physical prop the caller chooses**, and the callers that care already flip
  it (`cart-drawer.tsx` and `conversations-sidebar.tsx` both compute
  `side` from the locale, each with a comment). Making the geometry logical
  while the prop stayed physical would invert those call sites.
- **`avatar.tsx` `-space-x-2`** — Tailwind v4 compiles `space-x-*` to
  `margin-inline-start`/`margin-inline-end`, so it is already direction-aware.
  `rtl:space-x-reverse` would *break* it. (Two app-level files still carry that
  class, and it breaks them in exactly that way; listed below.)
- **`dialog.tsx` `left-1/2 -translate-x-1/2`** — centring. Symmetric in both
  directions.
- **`smooth-input.tsx` `absolute top-0 left-0`** — an `invisible` span used only
  to measure text width. Nothing is seen.
- **`images-badge.tsx`, `boarding-pass.tsx`, `glowing-effect.tsx`,
  `shader-background.tsx`, `noise-background.tsx`, `dither-field.tsx`,
  `camera-angle-*`, `link-preview.tsx`** — illustration geometry, canvas/WebGL
  coordinates, and pointer maths from `getBoundingClientRect`. Not text
  direction.
- **`theme-toggle-button.tsx` `"left-right"` / `"right-left"`** — names of
  animation variants the caller picks, not layout.
- **`resizable.tsx`** — its `after:start-1/2 after:-translate-x-1/2` hit strip is
  off by 4px under RTL, but no app imports `ResizablePanelGroup`. Left rather
  than touched blind.
- **`sidebar.tsx` `SidebarRail`** — carries `ltr:-translate-x-1/2
  rtl:-translate-x-1/2`, which is just `-translate-x-1/2` written twice. Not
  wrong, and no app renders the rail.
- **`AppleSwitch`'s `labelSide` prop** — named physically (`"left"`/`"right"`)
  but implemented with `flex-row-reverse` on a direction-aware row, so it
  already behaves logically. A naming inconsistency, not a rendering defect.

---

## Found, not fixed (latent or out of scope)

> **Superseded 2026-09-12:** every item below has since been fixed — see
> "Follow-up pass — 2026-09-12" at the end of this file. This section is kept as
> the record of what the first pass found, not as a description of current state.

- **`data-[side=inline-start]` / `data-[side=inline-end]` slide-in animations**
  in `tooltip.tsx`, `popover.tsx`, `hover-card.tsx`, `select.tsx`,
  `dropdown-menu.tsx` map to hardcoded `slide-in-from-left-2` /
  `slide-in-from-right-2`, and `tooltip.tsx`'s arrow maps them to `-left-1` /
  `-right-1`. Both are backwards under RTL — but **no call site in any app
  passes an inline side** (the only explicit `side` in the three apps is one
  `side="top"`), so this is a dormant path. Fixing it now would be speculative;
  it is recorded here so the next person to reach for `side="inline-end"` knows.
- **`DialogContent`'s close button** still hardcodes the English `Close` in its
  `sr-only` label. `SheetContent` gained `closeLabel` because removing the cart
  drawer's workaround required it; Dialog has no such caller yet.
- **App-level physical utilities outside the audited scope**, left for a
  targeted pass: `apps/vendor/src/features/segments/components/save-segment-dialog.tsx`
  (`absolute right-3` counter inside an input),
  `apps/vendor/src/features/skiper20/components/country-select-dialog.tsx`
  (`absolute right-3` close), and
  `apps/vendor/src/features/segments/components/customers-preview.tsx`
  (raw `<th className="text-left">`, not the shared primitive, so the `table.tsx`
  fix does not reach it).
- **`rtl:space-x-reverse` / `rtl:sm:divide-x-reverse`** in
  `apps/vendor/src/features/files/components/enhance-run-history.tsx` and
  `apps/vendor/src/features/reviews/components/reviews-summary.tsx` — a second
  flip on top of Tailwind v4's already-logical `space-x` / `divide-x`, so both
  render wrongly under `dir="rtl"`. Fixed below.

---

## What a human still has to check — the open half of T3-20

Switch the locale to Arabic and walk these. Every one of them is a *position*
question, which is exactly what jsdom cannot answer.

1. **Storefront checkout, end to end** — `/{shop}/cart` → `/{shop}/checkout`.
   The address form, the order summary's figures, the coupon ticket
   (`DitherField` behind it) and the shipping selector.
2. **The cart drawer.** It now uses the shared close button rather than its own.
   Confirm the X sits on the panel's outer corner, that `pe-12` on the header
   clears it, and that the panel still arrives from the correct edge.
3. **`file-detail-sheet`** (vendor `/files`) — the sheet whose `SheetTitle`
   carries `pe-6`. The title should truncate away from the close button, not
   under it.
4. **`conversations-sidebar`** (vendor `/ai`) — its header has both the shared
   close and its own "Select" action at the same end. They may overlap; that
   overlap predates this change and was not introduced by it.
5. **Every list screen in both consoles** — header alignment (`text-start`),
   the checkbox column, the faceted filter popover, and the numbered pagination
   bar with its now-flipped chevrons.
6. **Toggles.** `Switch` on the settings screens and `AppleSwitch` on the
   product form's inventory and shipping cards, the location dialog and the
   webhook dialog. Check the thumb rests inside the track when off, ends inside
   it when on, and that **dragging** it toward the "on" side works.
7. **Sidebar sub-menus** — the collapsed chevron should point the way the list
   reads and turn down when expanded, not up.
8. **The mobile sidebar toggle** in both consoles' headers — the panel in the
   glyph should be on the same side as the sidebar it opens.
9. **Dropdown and select menus** — the check/indicator on the trailing edge,
   inset items indented from the correct side, shortcuts pushed to the end.
10. **The unsaved bar** on any vendor edit screen — message at the start,
    Discard/Save at the end.

---

## Verification run for this change

| Suite | Before | After |
|---|---|---|
| `packages/ui` | 21 files / 243 tests | **23 files / 254 tests**, all passing |
| `apps/vendor` | 132 files / 1261 tests | unchanged, all passing |
| `apps/storefront` | 57 files / 601 passed + 7 skipped | unchanged, all passing |
| `apps/admin` | 26 files / 271 tests | unchanged, all passing |

Lint is clean in every package touched (`packages/ui` reports its one
pre-existing `no-img-element` warning in `images-badge.tsx`, which this change
does not touch). `packages/ui` typechecks clean.

New tests:

- `packages/ui/src/components/__tests__/rtl-primitives.render.test.tsx` — mounts
  each fixed primitive under `dir="rtl"` and asserts the logical class is
  present **and the physical one it replaced is absent**, since only the second
  half fails when someone pastes `right-3` back in beside `end-3`.
- `packages/ui/src/components/__tests__/apple-switch-rtl.render.test.tsx` —
  drives real pointer events and asserts the drag turns the switch on when
  pulled toward the end of the line in each direction. Confirmed to fail when
  the direction sign is removed.

---

## Follow-up pass — 2026-09-12

Everything under "Found, not fixed (latent or out of scope)" above is now fixed.
Nothing before this line was rewritten; this records what moved and what it
leaves open.

### The app-level misses

Five files, all in `apps/vendor/src/features/`, none of them a shared primitive:

| File | Change |
|---|---|
| `segments/components/save-segment-dialog.tsx` | input `pr-16` → `pe-16`; the character counter `absolute right-3` → `absolute end-3` |
| `skiper20/components/country-select-dialog.tsx` | search icon `left-4` → `start-4`; input `pl-11 pr-12` → `ps-11 pe-12`; the hand-rolled close `right-3` → `end-3`; each result row `text-left` → `text-start` |
| `segments/components/customers-preview.tsx` | search icon `left-3` → `start-3`; input `pl-9` → `ps-9`; three raw `<th className="text-left">` → `text-start` — a hand-rolled `<table>`, which is exactly why the `table.tsx` fix never reached it |
| `files/components/enhance-run-history.tsx` | dropped `rtl:space-x-reverse` from the `-space-x-2` thumbnail stack |
| `reviews/components/reviews-summary.tsx` | dropped `rtl:sm:divide-x-reverse` from the counts grid |

The last two are behavioural fixes rather than tidy-ups. Tailwind v4 compiles
`space-x-*` to `margin-inline-start`/`margin-inline-end` and `divide-x-*` to
`border-inline-start-width`/`border-inline-end-width`, each scaled by
`--tw-space-x-reverse` / `--tw-divide-x-reverse` — which the bare
`space-x-reverse` / `divide-x-reverse` utilities set to `1` on the same
`:where(& > :not(:last-child))` children, emitted *after* the base utility at
equal specificity. So the `rtl:` variant was a second flip on top of a property
that already mirrors itself, and under `dir="rtl"` the second flip won. Both
files rendered wrongly in Arabic because of it. The thumbnail stack moved its
negative margin from each child's inline-end to its inline-start, which hangs
the row 0.5rem past its leading edge and leaves the **last** pair of thumbnails
no longer overlapping. The counts grid moved each divider the same way, which
across its three columns paints a stray rule on the outer leading edge of the
first cell and drops the rule between the last two. Removing the variant changes
what renders, not just how the file reads.

### The dormant inline-side geometry

Fixed rather than left, in `tooltip.tsx`, `popover.tsx`, `hover-card.tsx`,
`select.tsx` and `dropdown-menu.tsx`:
`data-[side=inline-end]:slide-in-from-left-2` → `slide-in-from-start-2`,
`data-[side=inline-start]:slide-in-from-right-2` → `slide-in-from-end-2`, and
the tooltip arrow's `data-[side=inline-end]:-left-1` /
`data-[side=inline-start]:-right-1` → `-start-1` / `-end-1`.

It turned out not to be speculative work: `tw-animate-css` already ships
`slide-in-from-start` and `slide-in-from-end` as `:dir()` utilities, so the fix
is the right class name and no new mechanism. The `data-[side=left]` and
`data-[side=right]` variants stay physical for the reason given above — the
caller picked a physical side. Still no call site in any app passes an inline
side, so nothing on screen changes today; the path is simply correct for the
first one that does.

### `DialogContent`'s hardcoded `Close`

`DialogContent` and `DialogFooter` now take `closeLabel` (default `"Close"`) —
the same contract `SheetContent` gained in the pass above, and for the same
reason: without it a bilingual caller's only option is `showCloseButton={false}`
plus a hand-rolled X, which is a second copy of the shared button to keep in
step. On `DialogFooter` the label is the visible text of its optional outline
button rather than an `sr-only` name.

### What is left

Only the browser walk-through — the ten items under "What a human still has to
check". Nothing here replaces any of them: this is the same source-level class
of fix, and jsdom still performs no layout.
