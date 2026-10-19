# @repo/ui

Shared React components, design tokens, and `cn` for every app in the monorepo.

This is a **just-in-time** package: it ships raw `.tsx` and is compiled by the consuming app's bundler. There is no build step and no `dist/`.

## Consuming it

1. Declare the dependency: `"@repo/ui": "*"`.
2. Add `transpilePackages: ["@repo/ui"]` to `next.config.ts` — Next otherwise treats it as a prebuilt `node_module` and refuses the TypeScript.
3. In the app's Tailwind entry (`globals.css`), import the tokens and point Tailwind at the package source. Tailwind v4 skips `node_modules`, so without the `@source` line the components' classes are never generated:

```css
@import "tailwindcss";
@import "@repo/ui/styles.css";
@source "../../../../packages/ui/src";
```

## Imports

Exports are per-file — there is no barrel, so an app only pays for what it imports.

```ts
import { Button } from "@repo/ui/components/button"
import { SiteHeader } from "@repo/ui/components/site-header"
import { cn } from "@repo/ui/lib/utils"
import { useIsMobile } from "@repo/ui/hooks/use-mobile"
```

## Layout

| Path | Contents |
|------|----------|
| `src/components/` | 38 shadcn-style primitives plus the app shell (`site-header`, `app-sidebar`, `nav-main`, `settings-rail`, `unsaved-bar`, `locale-switcher`, `sidebar-toggle-icon`), the auth shell (`auth-shell`, `auth-heading`, `auth-form` on the `shader-background` ground; `floating-paths` is the retired backdrop, currently unused — `pixel-field`, the ember canvas it replaced, was deleted 2026-09-08 once nothing but its own test rendered it), and decorative WebGL fields (`dither-field`, `cloud-shader`) |
| `src/hooks/` | `use-mobile`, `use-hydrated`, `use-on-screen`, `use-otp-auto-submit` |
| `src/lib/utils.ts` | `cn` — the single source of truth; the apps re-export it |
| `src/styles/tokens.css` | `@theme`, `:root` / `.light`, `.dark`, and the base layer |

## Light islands

The light palette is declared on `:root, .light`, and the `dark` variant is
narrowed to `&:is(.dark *):not(:is(.light, .light *))`. So a subtree marked
`.light` keeps the light tokens and refuses `dark:` utilities however dark the
document above it is.

There is one consumer, and it is the reason the mechanism exists: `AuthShell`'s
card is a hardcoded `bg-white` on a fixed ink ground, deliberately, because the
entry screens are one committed brand moment rather than a themed surface. Every
token-styled control placed on it — an `Input`, a `Select` trigger,
`text-muted-foreground`, `FieldSeparator`'s `bg-card` "Or" pill — used to resolve
against whatever theme `<html>` carried, so a vendor who had turned the
dashboard dark and signed out got dark chrome painted onto a white card. Marking
the card (and its `color-scheme`, so autofill and native inputs follow) fixes all
of them at once, where tokenizing the card or hardcoding the pill would each have
fixed one.

## The button

`Button` is flat. The face has a fill, a border and a focus ring, and nothing painted beneath it — no ledge, no top sheen, and no travel on press. There is one button component and nothing to opt into: variants, sizes and the focus ring are the whole API.

```tsx
import { Button } from "@repo/ui/components/button"

<Button>Save</Button>
<Button variant="destructive" size="sm">Delete</Button>
```

The press reads through the face colour alone, which is the one thing every variant already has, so feedback belongs in `hover:` and `aria-expanded:` on the variant rather than in a second painted layer. There is deliberately no `--btn-ledge-*` / `--btn-sheen-*` / `--btn-rise` any more, and no press-tracking hook: a call site that wants its own press affordance owns it entirely, and a `transform` or `translate` utility on a button now has nothing underneath to fight with.

Because a button paints no depth, it also never changes height or offset between states — a disabled or loading button sits exactly where the idle one did, and a row of them cannot jump.

### `render` decides `nativeButton` for you

A button that navigates is written `render={<Link href={…} />}`, and the element it ends up as is then an `<a>`. Base UI's `nativeButton` defaults to `true` regardless, which is not only a development warning: the primitive merges `type="button"` onto that anchor instead of `role="button"`, and installs the keyboard model written for a `<button>` rather than the one that steps aside for a link's own Enter. Every screen holding such a button logged a console error.

`Button` derives it instead — anything that is not literally an intrinsic `<button>` in `render` is not a native button — so nothing is asked of the ~190 call sites. The prop is still accepted and still wins when passed, which is what a `render` given as a function needs, since its output cannot be inspected.

```tsx
<Button render={<Link href="/products" />}>Products</Button>   // an <a role="button">
<Button onClick={save}>Save</Button>                            // a <button type="button">
```

## Adding a shadcn primitive

New primitives belong here, not in an app. Run the CLI against this package:

```bash
npx shadcn@latest add dialog -c packages/ui
```

Each app's `components.json` points `ui` at `@repo/ui/components` and `utils` at `@repo/ui/lib/utils` (resolved through the `@repo/ui/*` path in the app's `tsconfig.json`), so a component added from an app directory lands in this package too and never shadows it with an app-local copy. `components` / `lib` / `hooks` stay app-local (`@/shared/*`) — that is where a store-aware or translated wrapper goes.

## `Sheet`: styling the backdrop

`SheetContent` renders its own `SheetOverlay`, so a consumer has no element to
put a class on. `overlayClassName` is that hook, and it exists because the
alternative was a global selector — which would have caught every other sheet
in the same app. The storefront's cart drawer is the one consumer: its backdrop
is a warm gradient rather than the consoles' flat wash. Omit it and nothing
changes.

## The built-in close button: `closeLabel`

`SheetContent`, `DialogContent` and `DialogFooter` each render their own close
control, so the caller has no element to hang an accessible name on.
`closeLabel` is that hook. It defaults to `"Close"`, so an unlocalized console
reads sensibly, and a bilingual screen passes its own already-localized string —
the package's one rule again: no `next-intl` in here.

```tsx
<SheetContent closeLabel={t("close")}>…</SheetContent>
<DialogContent closeLabel={t("close")}>…</DialogContent>
<DialogFooter showCloseButton closeLabel={t("close")}>…</DialogFooter>
```

On `SheetContent` and `DialogContent` it is the `sr-only` name of the icon
button in the corner; on `DialogFooter` it is the visible text of an outline
button that is drawn only when `showCloseButton` is passed — `false` by default
there, `true` on the two content components.

The prop exists because of what a caller had to do without it: pass
`showCloseButton={false}` and hand-roll a localized X, which is a second copy of
the shared button to keep in step. The storefront's cart drawer carried exactly
that until `SheetContent` took the prop; `DialogContent` and `DialogFooter` now
take the same one rather than leaving the next bilingual dialog the same choice.

## A tall dialog: `scroll`

`DialogContent` is pinned to the centre of the window and does not move, so a
dialog taller than the window has to cap its own height and scroll inside
itself. That is right for a confirm or a form with sticky actions, where the
buttons must stay put while the body moves under them. It is wrong for a
dialog that is simply a long panel: the reader gets a scrollbar in the middle
of the screen, inside a box that does not look scrollable, with the primary
action hidden below its fold.

`scroll="viewport"` is the other shape. The dialog goes into a full-window
scroller, so the bar is the window's own at the edge of the screen and the
whole card travels with it:

```tsx
<DialogContent scroll="viewport" closeLabel={t("close")}>…</DialogContent>
```

Short content still sits centred and scrolls nothing — `min-h-full` on the row
inside the scroller is what buys both. The caller adds no `max-h` and no
`overflow` of its own; both would put the inner scrollbar back. The
storefront's sign-in popup is the first consumer: sign-up is five fields tall
and overflowed a laptop.

It is also the mode that **stacks**. A `Dialog` rendered inside another one's
content opens over it, the parent stays mounted, and — in `viewport` mode —
steps back into a visible layer: both cards leave the centre for the top of
their scroller, the one behind lifts by `--nested-dialogs`, narrows a little,
dims a step and drops its own close button, and the one in front starts lower
and casts a shadow over it. Centring is what makes a stack impossible, not
what makes it pretty: two cards centred independently put the taller one over
the shorter one entirely, and a sign-up panel would hide the sign-in panel it
came from. Base UI supplies the rest (see **Nested drawers** below — same
attributes, same single backdrop).

## Nested drawers

A `Drawer` rendered inside another one's content opens over it, and the parent
**stays mounted** and steps back into a stack. That is the point of it: a flow
that has to ask for one more thing — pick a customer, then add an address, then
a country — does not throw away the screen that asked.

```tsx
<Drawer showSwipeHandle={isMobile} swipeDirection={isMobile ? "down" : "right"}>
  <DrawerTrigger render={<Button variant="secondary">Open</Button>} />
  <DrawerContent>
    …
    <DrawerFooter>
      <Drawer swipeDirection={isMobile ? "down" : "right"}>
        <DrawerTrigger render={<Button variant="outline">Open nested</Button>} />
        <DrawerContent>…</DrawerContent>
      </Drawer>
    </DrawerFooter>
  </DrawerContent>
</Drawer>
```

Base UI supplies the wiring and it is worth knowing what it does, because most
of it is what you would otherwise write by hand and get subtly wrong: the child
popup is marked `data-nested`, every ancestor `data-nested-dialog-open`, the
open-child count lands in `--nested-dialogs`, and **a nested dialog renders no
backdrop of its own** — so four deep is one wash over the page, not four
stacked into near-black.

What this package adds is the step back. Each level moves inward off the edge
it is anchored to and narrows slightly, so a strip of every parent shows past
the frontmost drawer's edge: four drawers read as four cards rather than as one
drawer whose content changed. Depth comes from `--nested-dialogs`, so the
strips accumulate rather than every parent sitting in the same place.

The drawer in front is styled as a child too, keyed on its own `data-nested`.
A nested dialog has no backdrop, so nothing separated it from the strip of its
parent: it now casts its shadow toward its **free edge** — the one opposite
where it is anchored, which is the side that strip is on — the same statement
the dialog stack makes with `data-nested:shadow-xl`. A drawer in the middle of
a stack is both a child and a parent and takes both rules. No screen in the
three apps nests drawers today; this is the component being correct, not a
screen being converted.

The popup is also `group/drawer-popup` and carries `data-swipe-axis` (`x` for a
side drawer, `y` for a top/bottom sheet) beside `data-side`, so a call site can
size its own content against the axis without being told which side it is on:

```tsx
<div className="group-data-[swipe-axis=y]/drawer-popup:aspect-video group-data-[swipe-axis=x]/drawer-popup:size-full" />
```

## Popup sides: inline is mirrored, `left`/`right` is not

`TooltipContent`, `PopoverContent`, `HoverCardContent`, `SelectContent` and
`DropdownMenuContent` all style both spellings of a side, and the two are
treated differently on purpose.

An **inline** side is resolved against the writing direction, so the geometry
driven by it is logical too — `data-[side=inline-end]:slide-in-from-start-2`,
`data-[side=inline-start]:slide-in-from-end-2`, and the tooltip's arrow at
`-start-1` / `-end-1`. `tw-animate-css` ships `slide-in-from-start` and
`slide-in-from-end` as `:dir()` utilities, so this costs nothing but the right
class name. Written physically — the `slide-in-from-left-2` /
`slide-in-from-right-2` pair these carried until 2026-09-12 — both invert under
RTL: the popup drifts *toward* its trigger instead of out of it, and the arrow
lands on the edge of the panel facing away from the trigger.

`data-[side=left]` and `data-[side=right]` stay physical, and that is not an
oversight. A caller that writes `side="left"` has named a physical side, so
mirroring the geometry under it would contradict the prop it was handed.

## The one rule

**Everything here is presentational.** No Zustand store, no GraphQL, no `next-intl`, no knowledge of routes. The shell components take slots (`logo`, `center`, `actions`, `userMenu`) and already-localized strings as props; each app wraps them and injects its own data — see `apps/vendor/src/shared/components/site-header.tsx` next to `apps/admin/src/shared/components/site-header.tsx`.

Adding a component that needs a store or a translation means it belongs in the app, not here.

## OTP auto-submit

`useOtpAutoSubmit` is the one exception that is behaviour rather than paint: the 6-box `InputOTP` on the entry screens should fire the existing verify (or continue) the instant the last slot is filled, without the caller inventing a second submit path. It latches the complete value so a paste cannot double-fire, and `submitOnce` is a synchronous in-flight lock so the Verify button cannot stack a second request on the auto-submit. It knows nothing about GraphQL or routes — the screen passes `submit`.

## Sidebar nav: `items` vs `groups`

`AppSidebar` takes either. `items` is one flat list. `groups` is a list of labelled blocks — `{ label?, items, collapsible? }` — for a nav with sections, and it is what `apps/admin` uses to put its integrations under a **Settings** heading.

A group is not the same thing as `NavItem.items`. Sub-items nest links *under* a parent link as an indented, icon-less list, which fits when they are parts of one destination. A group is a heading over siblings that each keep their own icon and full weight, which fits when they are peers and the heading is not somewhere you navigate to. A collapsible group opens automatically when the current route is inside it, so a section can never hide the page you are on.

## `SettingsRail`: the left rail card

`components/settings-rail` is the titled card two screens put beside their settings pane — the vendor dashboard's settings overlay and the admin console's `/integrations/[type]`. It is a header (badge, title, subtitle), a filter box, the list of entries, and an optional footer block.

```tsx
<SettingsRail
  title={shop.name} subtitle={shop.slug} badge={<StoreIcon className="size-4.5" />}
  items={sections.map((s) => ({ id: s.id, label: t(s.id), icon: s.icon, active: s.id === current }))}
  renderItem={(item, props) => <Link href={hrefOf(item.id)} {...props} />}
  searchPlaceholder={t("searchNav")} emptyLabel={t("noNavMatch")}
/>
```

It was extracted because the two rails had drifted into being the same file twice: the entry's class string, the filter box and the empty state were identical character for character, and a hover colour fixed in one would have been fixed in one. The **shells** around it were not extracted and are not the same thing — one is a fixed overlay over the dashboard with a leave guard on its exit, the other a full-height page with the app sidebar dropped; they share a name, an Escape handler and nothing else.

**It knows nothing about navigation, deliberately.** An entry is whatever `renderItem` returns — a `Link`, a `button`, an `<a>` — and which one is lit comes from the caller's `active` flag rather than anything the rail derives. Both call sites happen to render `Link`s today, but a rail whose sections are panes swapped in local state renders `button`s and gets the same face for free; baking in `next/link` would have made the card a router client and closed that case. What the rail hands back is the computed `className`, `aria-current` and the icon-plus-label children, so the two screens cannot drift apart again.

The filter is the rail's own state and matches against each item's already-localized `label` — there is no `next-intl` in here, so labels, the placeholder and the empty line all arrive as props. Render it from a layout rather than a page, as both call sites do, and switching section keeps whatever was typed.

## `FilterBar`: one chip per applied filter

`components/filter-bar` is the segmented filter row the two consoles' list screens share — a chip per filter reading *field | operator | value*, each segment its own menu, plus one dashed button that adds another.

It is fully controlled. `value` is a `Filter[]` and every edit leaves through `onChange`, so a screen can keep its filters in the URL, in TanStack's `columnFilters` or in plain `useState` without the bar knowing which. The one thing a caller must **not** do is *derive* that array on every render: a chip that has just been added carries no values yet, so a derived array drops it the instant it appears and the add-then-pick flow can never complete. Hold the chips in state and derive the query from them, not the other way round.

Three things about it are worth knowing before editing it.

**Each segment owns a Base UI `Popover`** rather than the bar sharing one portal. That is what buys the positioning, the collision flip, the outside press, Escape and the focus return for free — and because Base UI resolves `align` and `side` logically, the menus land correctly under a right-to-left `dir` with nothing here to mirror by hand. A shared portal would also have to track which segment it is anchored to, and an anchor that unmounts while the popup is open — the chip was just removed — takes the popup's position with it.

**Async values are fetched from the handler that opens the menu, never from an effect.** `react-hooks/set-state-in-effect` is an error in this repo, and opening a menu is always something a person did, so there is nothing an effect would be for. Replies are sequence-numbered and one that is not the newest is dropped rather than rendered: `loadOptions` runs per keystroke behind a 250ms debounce, and without the guard whichever request happened to finish last won, which is not the one being typed.

**The applied-value pulse is a transition, not a keyframe.** This package declares no `@keyframes` and must not assume one the consuming app has not, so the segment lands on `bg-primary/15` at `duration-0` and fades back over the base duration. It exists because a multi-select menu stays open over its own chip, and the chip behind it is then the only thing that can say the click registered.

**A field can name a value the menu never listed, and draw one control under the list.** `labelForValue` labels a chip whose value is not an option (a custom date window stored as a token). `valueExtra` renders under the value menu; its `commit` replaces that chip's values and closes the menu, the same close a single-value pick already does. The orders list's date chip is the first caller.

**An option can carry a `hint`, and a field a `hintNote`.** `FilterOption.hint` is already-localized trailing text in the value menu — in practice a count — drawn muted and `tabular-nums` after the label, never searched (cmdk matches the label) and never put on the chip, which says what is applied rather than how many match. `FilterFieldDef.hintNote` is one muted line under the list saying what those numbers count, and it is drawn only while at least one option has a hint. It exists because the obvious source of a count is rarely the filtered list itself: the vendor's abandoned-carts status counts come from the KPI summary, which follows the date range but none of the other chips, and a number that silently disagreed with the list it filters to would read as a bug. Say what a hint counts whenever it is not "the rows the current filters return". The vendor dashboard's `DataTableAddFilter` funnel renders both the same way, so the two menus that offer a value agree.

Segments are addressed for focus by `data-focus-key` rather than through a ref map, because registering one would mean building a ref callback per segment in the render body and `react-hooks/refs` rightly refuses a ref handed to a function during render. The lookup reads the DOM only from an event handler.

Strings are props, as everywhere here: `labels` carries the nine pieces of chrome and the four accessible names. Each app wraps it once — `apps/vendor/src/shared/components/filter-bar.tsx` beside the admin console's copy — so a screen passes only its own fields. Both wrappers default `compactAdd`: the add control is a ghost plus with no dashed border. The primitive itself still defaults to the labelled dashed button; pass `compactAdd={false}` on a wrapper to get that back.

## `Bones`: skeletons that are measured, not drawn

`components/bones` wraps `boneyard-js`'s `<Skeleton>`. Instead of a hand-shaped placeholder you name a region and its bones come from a real measurement of the rendered DOM:

```tsx
<Bones name="analytics-top-products" loading={loading}>
  <div className="flex flex-col gap-0.5">{rows}</div>
</Bones>
```

There is **no `fallback` prop** — the point is that no one hand-draws a skeleton. Bones arrive from either of two places:

| Source | Covers | Cost |
|--------|--------|------|
| Committed capture (`npm run bones` in the app) | A brand-new tab's **first** paint, at every breakpoint | A headless browser + a logged-in session, run manually |
| Runtime self-measurement (this component) | Every load after the content has rendered once in that tab | Nothing |

The runtime path calls the very same `snapshotBones()` the CLI drives, just on the live subtree, and caches per `name` + viewport bucket. So a name works with no build step — it shows nothing only until the content has rendered once.

The cache is an **external store**, not a bare `Map`, and that matters twice. It is mirrored into `sessionStorage` in production, so a reload paints a skeleton immediately instead of measuring again — entries are validated on read, capped, and deliberately **not** written in development, where a reload usually follows a layout edit and serving the pre-edit shape is worse than showing nothing. And because components subscribe to it, a measurement taken by one instance reaches a **sibling of the same name already on screen**; a plain module `Map` left that sibling drawing nothing until its own props changed.

Hydration from storage happens inside `useSyncExternalStore`'s `subscribe` — client-only and post-commit, so it cannot cause a hydration mismatch and needs no `set-state-in-effect` exemption.

Two behaviours here are ours rather than the library's, and both come from one sharp edge: **`boneyard-js` resolves bones only from `initialBones` or its generated registry, and warns about nothing when a name matches neither.** With no fallback that is a silent empty box. So this component adds the runtime measurement above, and a one-line dev warning naming the skeleton when it has nothing to draw.

Sharing a `name` across instances is deliberate and fine when they are the same shape (twenty KPI figures, three identically-columned tables) — the first one in the document is measured and the rest reuse it.

It renders **no wrapper element of its own**, on purpose: call sites style `[&>[data-boneyard-content]]:h-full` to give a recharts `ResponsiveContainer` a parent with height, so `className` has to stay the direct parent of the content node.

Each app supplies its own registry. `apps/*/src/shared/components/bones.tsx` re-exports this component and exists only to carry `import "@/bones/registry"` inside a `"use client"` module — from a server layout that import is evaluated during SSR, where `registerBones` does nothing useful.

## `DitherField`: a shader you can put on a page

`components/dither-field` wraps `Dithering` from `@paper-design/shaders-react` — a generative shape quantised to two colours through an ordered Bayer matrix, so the ramp is carried by a halftone rather than by a smooth gradient. That is the reason to reach for it: on a large flat surface it reads as printed ink, and with only two colours on screen it **cannot band**, which is exactly the failure a full-width dark gradient has.

```tsx
<DitherField
  className="absolute inset-0 -z-10"
  shape="warp"
  colorFront="var(--shop-footer-accent)"
  opacity={0.14}
  fade="top"
/>
```

It has no size of its own — position it absolutely inside a `relative` parent, or pass `children` and let it be the box.

The raw library component is not usable as page furniture, and the four things this adds are the whole point of it:

| | |
|---|---|
| **Costs nothing until looked at** | The canvas mounts only once the host scrolls into view (`hooks/use-on-screen`) and is released when it leaves. WebGL contexts are a browser-wide resource capped around **sixteen**; a decoration at the foot of a page has no business holding one on a visit that never scrolls there. |
| **Takes design tokens** | `colorFront="var(--shop-footer-accent)"` works. See below — without this the component could not live in a themed app at all. |
| **Degrades to what is underneath** | The field layers *over* the host's own background rather than replacing it. No WebGL2, and every paint before it is in view, show the plain surface. |
| **Stops for `prefers-reduced-motion`** | Speed drops to 0, which halts the render loop rather than slowing it — the shader still draws its one static frame, so the texture stays. |

### Why colours are resolved rather than passed through

The shader's own `getShaderColorFromString` parses `#hex`, `rgb()` and `hsl()` **and nothing else**, falling through to *opaque black* for anything it does not recognise. That rules out most of what this design system deals in: a `var(--token)`, the `oklch()` every colour in `tokens.css` is written as, `color-mix()`. Handing it a token and silently getting a black rectangle across the page is a bad way to learn that, so `toShaderColor` substitutes `var()` from `:root`'s computed style, passes through anything the shader already reads, and normalises everything else through a 2D canvas `fillStyle` — which serialises any colour the *browser* understands back into a form the shader does. What still cannot be resolved is drawn transparent and warns once in development, because an invisible decoration beats a black slab.

Two consequences worth knowing. Tokens are read from `:root` only — a token overridden further down the tree is not followed, since that would mean reading a ref during render. And the resolved values are re-derived when `<html>`'s class changes, watched with the same `useSyncExternalStore` + `MutationObserver` pair `theme-toggle-button` uses, so a theme switch moves the field with the rest of the page.

`colorFront` is **required**, and there is deliberately no `currentColor`: a canvas has no inherited colour to resolve it against, so it would come back black.

### The failure that has no error boundary

`ShaderMount` throws out of its constructor when `getContext('webgl2')` returns nothing, and the React wrapper builds it inside an un-awaited async call — so the throw lands on `window` as an unhandled rejection, where no boundary can see it and Next's dev overlay reports a decoration as a page error. `useShaderFailure` claims exactly that message, flips every field on the page to the plain surface, and leaves every other rejection to whoever owns it.

## `ShaderBackground`: the entry ground

`components/shader-background` is a WebGL "Mesh drift" field generated by the 21st.dev Shader Builder, kept close to what the builder emitted: one fullscreen triangle, one fragment shader, and a `UNIFORMS` block at the top of the file that *is* the recipe -- editing the look means editing those numbers, not the shader.

```tsx
<div className="relative">
  <ShaderBackground className="pointer-events-none absolute inset-0" />
  ...
</div>
```

It is the ground under both entry screens -- `AuthShell` (every login, signup, OTP and reset screen in the vendor and admin consoles) and the vendor's `/shops` picker -- so the two screens either side of a sign-in are one picture.

Four things about using it, all of which are the call site's job:

| | |
|---|---|
| **Pair it with a scrim** | The recipe's brightest colour is near-white and its lobes drift across the whole field, so light type over the bare shader loses its contrast wherever one passes. Both call sites layer a fixed dark gradient between the canvas and the content. |
| **`pointer-events-none`** | The canvas fills its parent and would otherwise hit-shadow everything behind it. It costs nothing: the pointer is tracked on `window`, not on the canvas, so the cursor response survives. |
| **It only layers** | The host paints its own background; a browser with no WebGL gets `getContext` returning null and the component renders an inert canvas over that flat surface. Every failure path is the plain ground. |
| **Sized by its parent** | It has no size of its own -- `position: absolute; inset: 0` inside a `relative` parent. |

Like `DitherField`, it holds a WebGL context (a browser-wide resource capped around sixteen) and gives it up when it can: the render loop stops when the canvas scrolls out of view or the tab is hidden, and the context itself is dropped on unmount -- deferred by one task, because React 19's StrictMode double-invokes effects and a synchronous release would kill the context the remount is about to use. Under `prefers-reduced-motion` it draws one still frame with the drift and the pointer response both off, watching the query rather than reading it once. The canvas is `aria-hidden`. `__tests__/shader-background.render.test.tsx` pins that lifecycle against a spy context, since jsdom has no WebGL of its own: the inert no-WebGL canvas, the frame loop stopping out of view and under a hidden tab, the deferred release and the StrictMode remount cancelling it, and the reduced-motion still frame.

## `BoardingPass`: the ticket card

`components/boarding-pass` is the airline-pass card — striped header slab, a white body of hairline-divided rows, a tear line with a bite out of each edge, and the barcode stub under it. Everything is a slot, so it holds no state, fetches nothing and reads no store; strings arrive already localized.

```tsx
<BoardingPass
  brand="Leadlines"
  airline="Qatar Airways"  airlineLogo={<CarrierMark />}
  flightNumber="S1321"     cabin="Premium"  bookingRef="AG7890"
  from={{ city: "Paris", code: "CDG", time: "14:30" }}
  to={{ city: "New York", code: "JFK", time: "17:45" }}
  duration="3h 15m"
  passengerLabel={t("passengerName")} passengerName="Elizabeth Wilson"
  details={[{ label: t("gate"), value: "B12" }, /* … */]}
  barcodeValue="AG7890"
/>
```

Four things about it are decisions rather than markup:

**The notches are cut, not painted.** Two mask layers, each opaque but for one circle, composited with `mask-composite: intersect`, so both circles are punched clean through the card and the page shows through them. Painting two semicircles in the page colour was the simpler option and is wrong the moment the pass sits on anything but a flat ground. The cost to know: **a mask clips `box-shadow`**, so the card cannot be given one — anchor it with the ground behind it instead.

**The tear is one number.** `STUB_H` positions the notch centres, the dashed line and the stub's own height, all from the bottom, so they stay a straight line however tall the content above them grows. Three elements agreeing by hand would have drifted the first time a detail row wrapped; `boarding-pass.render.test.tsx` pins them equal.

**The barcode is derived, never random.** `barcodeBars(seed)` hashes the booking reference into bar widths (FNV-1a plus a mixing step). `Math.random()` there would be a render-body impurity, would hand the server and the client different bars, and would redraw the stub on every unrelated re-render. Pass `barcode` to hand the stub a real Code 128 SVG instead.

**Slots that a non-flight pass has nothing for are dropped, not blanked.** The
carrier band, the duration pill and the times row under the codes each render
only when something was passed — an order has no airline, no departure clock and
often no estimate, and an empty band still claims its height. `durationIcon`
swaps the plane for a parcel or a van; `stubCaption` prints a line under the
bars, the way a ticket prints the number its barcode encodes — and since the
stub is `aria-hidden`, that caption is how the value reaches a screen reader.

**`from` is optional, and omitting it is a design choice rather than a
degradation.** The two 30px slots are sized for three-letter airport codes. Fill
both with place *names* and they truncate — "Ahmed Elect…" beside "Riy…" — so a
pass with one endpoint gives that endpoint the whole row. A delivery has one
place that matters: where it is going. The storefront's `OrderPass`
(`apps/storefront/src/features/orders/components/order-pass.tsx`) is the worked
example, and the origin it drops is the shop, which is already the brand line.

**The palette is fixed, not tokenized** — the same call `AuthShell` makes. This is one committed design, and every consumer re-skins the shared tokens: the storefront redefines `--card` to warm paper and `--foreground` to a brown ink, so a tokenized ticket would quietly stop being this ticket there. The carrier's own mark is a slot with a neutral roundel default, because a real airline logo is a trademark and belongs to the consumer.

## `ScrollImageReveal`: a grid that assembles itself on scroll

`components/scroll-image-reveal` is a CSS grid of images whose tiles each start somewhere else and travel to their slot as the gallery scrolls into view — scrubbed by scroll position, never played on a clock. Recreated from Skiper UI's `skiper32`, which is Codrops' "Scroll3DGrid". Both are built on GSAP + Lenis and this one uses neither: `motion` is already here, its `useScroll` is the same scrubbed timeline, and smooth scrolling is a page's decision rather than a tile's (`smooth` runs progress through a spring for a caller that wants the trailing feel).

```tsx
<ScrollImageReveal
  effect="columns"                 // or "scatter"
  images={[{ src, alt }, /* … */]}
  columns={7}
  aspectRatio="4 / 5"
  className="[--reveal-columns:3] md:[--reveal-columns:5] lg:[--reveal-columns:7]"
/>
```

Two effects. **`columns`** rises every column into place, the middle one first, so the grid arrives as a V. The delay is linear in a column's distance from the centre, and linear matters: a scrubbed scroll shows the whole grid at one instant, so the columns' offsets at that instant *are* the shape the reader sees, and a curve would draw an arch. **`scatter`** starts every tile below its slot, behind the page and turned, and lands each on its own window of the scroll, fading in over the first part of its travel.

Four things about it are decisions rather than markup:

**The grid is CSS; the effect only decorates it.** Every settled pose is the identity, so the gallery at rest is exactly the plain grid — same boxes, same wrapping, same responsive behaviour. `columns` is only the default for `--reveal-columns`, which a class overrides per breakpoint; and because the `columns` effect has to know which column is the middle one, it **measures** the column count from computed `grid-template-columns` (one track per column) on every resize rather than trusting the prop.

**Nothing is random.** Poses and windows are hashed from the tile's index and `seed` (`scroll-image-reveal-geometry.ts`), for the reason `BoardingPass` hashes its barcode: `Math.random()` in a render body hands the server and the client different transforms on every tile, and reshuffles the gallery on any unrelated re-render. Same seed, same gallery; a call site that dislikes an arrangement changes one number.

**`settleAt` is where the reveal ends, and it is early on purpose.** Progress runs from the gallery's top edge entering at the bottom of the viewport to its bottom edge leaving at the top (motion's `["start end", "end start"]`, overridable through `offset`), and every window is scaled onto `[0, settleAt]`. The default `0.5` lands the last tile about as the gallery fills the screen. The reference runs its timelines to `1`, which on a grid shorter than a viewport means half the tiles land after they have already scrolled out of view.

**The root clips on x only, with `clip` rather than `hidden`.** Tiles start well outside their slots, and without the clip a page grows a horizontal scrollbar for the length of the reveal; y is left alone so the 3D travel is not cut off at the gallery's edges. `hidden` would have made the root a scroll container — a tile's image receiving focus, or anything calling `scrollIntoView`, could then scroll the gallery's own content out of place — and `clip` never scrolls.

The default tile is a raw `<img>`, for the reason `LinkPreview`'s is: the sources are whatever the call site holds, and `next/image` throws on a host `remotePatterns` never listed. `renderImage` replaces it — an app's `AppImage`, a link, a caption — while the tile's box, radius and clipping stay the component's. Under `prefers-reduced-motion` every tile renders settled. The playground is `apps/vendor/src/app/scroll-reveal-demo` (`http://localhost:3001/scroll-reveal-demo`, dev-only).

## Tests

`npm test` (Vitest, jsdom). The suites live beside the components in `src/components/__tests__/`.

`bones.render.test.tsx` is worth knowing about because it pins apart states that look alike: registered bones draw an overlay; an unknown name draws nothing **and** warns exactly once; a subtree that has rendered gets measured, so a later load draws bones with no capture; a measurement reaches a same-named sibling already mounted; a production reload draws bones from `sessionStorage` on first paint while a development one deliberately does not; and a malformed persisted entry is rejected rather than handed to the renderer.

`boarding-pass.render.test.tsx` pins the two things a screenshot would not catch: the notch mask, the dashed tear and the stub height all resolve to the same offset, and a booking reference draws the same bars on a second mount — the failure mode there is a hydration reshuffle, not a wrong-looking card.

`settings-rail.render.test.tsx` pins the part that is easy to lose in a later edit: the same rail renders entries as links or as buttons and gives both the identical class string, the caller's `active` flag is the only thing that sets `aria-current`, and the filter narrows by label with the empty line standing in when nothing matches.

`filter-bar.render.test.tsx` pins the reducer under the chips rather than the popovers over them: which edits clear values and which keep the menu open, that narrowing to a single-value operator keeps only the first choice, that a value whose option has gone still renders as its raw id, that an option's `hint` trails its label (a zero included) while the field's `hintNote` appears only when some option has one, and — the case with a real bug behind it — that an async reply a newer query has superseded is dropped instead of rendered. Removal is asserted on what leaves through `onChange`, not on what leaves the DOM, because the chip's exit is an `AnimatePresence` animation and jsdom runs none. It stubs `matchMedia` and `ResizeObserver` for Base UI's popup, and `Element.prototype.scrollIntoView`, which cmdk calls as a menu opens and jsdom does not implement.

`dither-field.render.test.tsx` pins the contract rather than pixels, which jsdom cannot produce: the canvas is not mounted until the host is on screen and is released when it leaves; a `var(--token)` reaches the shader as a literal; an unresolvable colour is drawn transparent and warns once; reduced motion freezes it; and a WebGL-unsupported rejection takes the field off the page while any other rejection passes through untouched.

It also proves the wiring — `registerBones` comes from `boneyard-js` while `<Skeleton>` comes from `boneyard-js/react`, and the registry is a plain module-level `Map` in `dist/shared.js`, so if those entry points ever resolved to separate module instances registration would write somewhere the component never reads. It stubs `ResizeObserver` and `matchMedia`, which jsdom lacks and `<Skeleton>` constructs on mount, and it has to stub layout too: jsdom reports every rect as 0, which the capture guard correctly rejects as a collapsed subtree.

`scroll-image-reveal.render.test.tsx` pins the contract, since under jsdom's zero-sized rects scroll progress can never advance: one tile per image carrying its alt, an omitted alt keeping the picture out of the accessibility tree, `renderImage` replacing the picture but not the tile, every tile starting away from its slot (progress is `0` on mount, so the first DOM is the start pose), the same transforms on a second mount — the failure mode is a hydration reshuffle — and different ones for a new seed, reduced motion rendering the grid settled, and the nested-scroller listener being attached and released. It partially mocks `motion/react` to drive `useReducedMotion` while keeping the real `motion` components. The geometry — column delays symmetric about the centre and evenly stepped, scatter poses always below and behind, every window inside `[0, settleAt]` — is `scroll-image-reveal-geometry.test.ts`.
