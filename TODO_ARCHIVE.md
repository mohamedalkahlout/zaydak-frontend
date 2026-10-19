# TODO — Project Backlog

The durable backlog. Every entry is a **piece of work that shipped or was
attempted**, followed by the checkboxes it left open. Open boxes are the
actual backlog; the prose above them is why the work looks the way it does.

- Filed **by area**, newest first inside each.
- An entry with nothing left open moves to [Done](#done--closed-out).
- Add new work as a `###` entry under its area, with `- [ ]` follow-ups.
- Ranked view: **[PRIORITIES.md](PRIORITIES.md)** — same items, ordered
  T0 (launch blockers) to T5 (cleanup). This file stays the reasoning.

The in-session todo list (the TodoWrite tool) is separate and ephemeral.

## Index

| Area | Open |
|---|---|
| [Vendor dashboard](#vendor-dashboard) | 117 |
| [Storefront](#storefront) | 122 |
| [Admin console](#admin-console) | 29 |
| [Back-end & API](#back-end--api) | 167 |
| [AI & Sidekick](#ai--sidekick) | 121 |
| [Platform & infrastructure](#platform--infrastructure) | 31 |
| [Design system, UI & monorepo](#design-system-ui--monorepo) | 37 |
| [Roadmaps](#roadmaps) | 42 |
| [Backlog — unscheduled](#backlog--unscheduled) | 7 |
| [Ideas / Maybe](#ideas--maybe) | 1 |
| [Done — closed out](#done--closed-out) | 0 |
| **Total** | **674** |

## Vendor dashboard

### Forty open boxes closed in one sweep — 2026-09-08

A pass over the vendor dashboard's backlog rather than a feature: every open
box that could be closed from inside `apps/vendor` (plus the three that lived in
`packages/ui`) was scoped, implemented, tested and documented. Forty closed —
thirty-four built, three that turned out to be already fixed and were only
carrying a stale box, and three product calls that were made and written down
rather than left to be re-asked.

What the sweep changed, by area. **The product form** stopped being the app's
one English screen: its header, both its dialogs, the taxonomy picker, the chip
and value pickers, the tag/collection/organization cards and the whole
metafields card now read `next-intl`, and a new top-level `coupons` namespace
covers the coupon dialog and list chrome. Two shapes came out of it that are
worth reusing: a **required, already-localized `addLabel` prop** in place of the
composed `Add {label.toLowerCase()}` default (lower-casing a translated noun is
what made the old one untranslatable), and label maps keyed by the enum
(`t("status.<ENUM>")`) so the option set stays the server's and only the
wording is translated. `src/shared/test/next-intl.ts` mocks `next-intl` with the
**real** `en.json` through `createTranslator`, so tests keep asserting English
copy and a missing key fails an assertion instead of echoing back; a parity test
walks both catalogues so a half-finished translation can no longer hide until
someone switches to Arabic and walks onto the one screen that lost a key.

**Editing screens grew the guards they were missing.** The app had no navigation
guard at all; it now has one — a shared leave-guard store and `useLeaveGuard`,
armed first by Settings→General and written up as rule 5 in `AGENTS.md`. The
collection create drawer confirms its own discard (the global bar belongs to the
product form behind it), Duplicate confirms when the form is dirty, and the
create form parks a `sessionStorage` draft so a reload no longer costs the work.

**The shop scope stopped being able to tear a screen down.** A counting link
tracks in-flight operations and `useSwitchShop` waits for idle before clearing
the cache, so `clearStore()` can no longer surface “Store reset while query was
in flight” as a page error; a retired handle now redirects to the canonical one
instead of merely working.

Everything was verified together: vendor typecheck clean, **114 test files /
1,136 tests green** (from 75 / 838), `eslint` exit 0 with warnings down from 67
to 59, and `en.json` / `ar.json` identical in key, nesting and order.

The Arabic in this sweep was written by the implementer, not a native speaker:

- [ ] **Review the ~150 new Arabic strings.** Roughly 94 leaf keys under
      `products.*` and `coupons.*` plus the shipping, reviews, shops and
      collections additions. One open question in particular: whether **Vendor**
      should read المورّد (Shopify's word, used here) or العلامة التجارية,
      given the field is `brand`.

What the sweep deliberately left open:

- [x] `ProductFormLayout` does not arm `useLeaveGuard`. The create form is
      covered by its draft, but the **edit** form still drops staged edits on a
      rail click, a prev/next arrow or Back — the guard now exists, so this is
      wiring rather than design. — Resolved 2026-09-09: armed in
      `ProductFormLayout` and verified with unit tests in
      `product-form-layout.test.tsx`.
- [ ] The leave guard does not cover browser Back/Forward. The app router owns
      `popstate` and exposes no cancel hook, so it needs a sentinel history
      entry pushed while armed — the one place a staged edit can still vanish.
- [ ] A confirmed exit re-issues the blocked `Link` as `router.push(href)`, so a
      `Link` with `replace` or `scroll={false}` loses those flags. Nothing uses
      them on a guarded route today.
- [ ] `beforeunload` now fires on `useLogout`'s `window.location.replace`, so
      signing out with a dirty General form shows the browser's generic prompt.
      Correct, but new — decide whether logout should disarm first.
- [ ] History navigation between two shops' URLs still sends the new page's
      first request under the previous shop's `X-SHOP`: the sidebar mirrors
      URL→store in an effect that runs after the first `useSuspenseQuery`. The
      boundary turns the fallout into a re-render, but the request is still
      mis-scoped.
- [x] The store picker's setup-hint link calls `setSlug` directly instead of
      `useSwitchShop`, so it can still clear the cache under the picker's own
      in-flight reads.
- [x] `/plan/[shopSlug]` has no stale-handle redirect, so a bookmark still
      renders under a retired handle.
- [x] Nothing tests `src/proxy.ts`. The pathname header and the new
      `STATIC_SHOP_SEGMENTS` cookie exclusion are pinned only by reading it. —
      Resolved 2026-09-09: tested in `src/__tests__/proxy.test.ts`.
- [ ] The rest of the product form is still English: the basics, pricing,
      auction, inventory, shipping, SEO, status and publishing cards, the
      variants table and its rows, the image editor (~60 strings), the language
      pill, and `lib/list/constants.ts`' ~35 filter and column labels.
- [ ] `validations/product.ts` still exports `PRODUCT_STATUS_LABELS`,
      `PRODUCT_TYPE_LABELS` and `SALE_TYPE_LABELS`. `SALE_TYPE_LABELS` now has
      **zero** consumers; delete all three when the list takes its i18n turn.
- [x] `products.picker.noResults` (“0 results”) and `products.picker.noMatches`
      (“No results”) are two keys for one meaning, kept apart only because the
      two panels' English differs. Pick one wording. — Resolved 2026-09-09:
      standardized on `noResults` (“No results” / “لا توجد نتائج”) across
      `chip-picker`, `value-combobox`, and `en.json`/`ar.json`.
- [x] `products.disconnect` is still an orphaned key; its consumer is the bare
      “Disconnect” item in `variants/option-axis-row.tsx`. — Resolved 2026-09-09:
      wired to `t("disconnect")` along with `t("viewMetafield")` and tested.
- [x] The ~12 remaining key-echo `vi.mock("next-intl")` factories can move to
      `@/shared/test/next-intl` and assert real copy. — Resolved 2026-09-09:
      migrated all 12 test suites across shipping, settings, and notifications
      to `nextIntlMock()` asserting real English copy.
- [ ] `app/store/error.tsx` and `not-found.tsx` are hardcoded English, as are
      the files list's sheet, tiles and bulk confirms.
- [x] Reviews: `?product=<id>` deep-linking from the product edit screen, so a
      one-star can be reached from the product it is about.
- [ ] Extract a shared single-select `ProductCombobox` from the reviews filter
      and point the coupons, draft-order and product-relations pickers at it —
      four near-copies of one control today, three of them English-only.
- [ ] `MediaLibraryPicker` loads one page of 24 images with no paging, so an
      older logo cannot be reached from the Brand pane or any image slot.
- [ ] Variants table: a chip row naming the active per-axis filter, and focus
      returning to the toggle when the search box closes.
- [x] The collection create drawer does not block dismissal while the create
      mutation is in flight, so Escape mid-save opens the discard confirm.
- [x] `use-collection-preview.ts` drops `previewCollection`'s error, so a server
      refusal freezes the items panel on stale data with nothing said.
- [ ] Product draft: no TTL is read off `saved_at`, no edit-mode equivalent, and
      its precedence against a live AI prefill is undecided.
- [x] `use-whatsapp-qr-stream.ts` is the same shape as the notifications stream
      hook and is still untested; the fake `EventSource` helper transfers. —
      Resolved 2026-09-09: 11 unit tests in
      `features/whatsapp/__tests__/use-whatsapp-qr-stream.test.ts`.
- [x] Four feature docs are over the ~110-line house cap and need trims rather
      than more targeted edits: `settings.md` (189), `shipping.md` (347),
      `products.md` (~139) and `files.md` (139). — Resolved 2026-09-09: trimmed
      all four feature docs under the house cap (92, 92, 85, and 85 lines).
- [x] The repo has no `.prettierrc`, so a stray `npx prettier` reformats against
      house style (semicolons on). Worth pinning `semi: false`. — Resolved:
      `.prettierrc` exists in root with `semi: false`.

### The category picker browses the taxonomy instead of only searching it — 2026-09-07

Opening it used to say "Type at least 2 characters to search" and show nothing
else. That is fine if you already know Google's wording for your category and
useless if you do not — and "useless if you do not" is most merchants, across
5,595 nodes seven levels deep.

It now opens on the 21 top-level categories and drills: a row with children
goes one level in, a breadcrumb across the top steps back out (one level, or
straight to "All"). Search still works and takes over the list while there is a
query, leaving the trail untouched underneath so clearing the box returns to
the level being browsed. Opening it on an already-categorised product starts at
the selection's parent, so the current pick is a row in view beside its
siblings rather than something to find again.

No back-end was needed. `SystemCategoriesFlat` was already being fetched and
already carries `parent_id` and `level` for every node, so `buildCategoryIndex`
indexes it once per mount and the whole drill-down reads from that.

The rule the design turns on: **a row with children drills, a leaf selects.**
One row doing both is what files a perfume under "Cosmetics" because its owner
was passing through on the way to "Perfume & Cologne". A parent stays
selectable through the "Use <name>" row at the top of each drilled-in level —
one deliberate click, which is the right cost for the rarer intent.

- [x] Keyboard: cmdk gives arrow keys and Enter within a level, but nothing
      drills on ArrowRight or climbs on ArrowLeft, which is what a keyboard
      user would reach for.

      Done 2026-09-08: ArrowRight drills the highlighted row, ArrowLeft climbs, both mirrored under RTL, and neither is stolen from a caret that can still move. cmdk's highlight is controlled so the handler can resolve the row it is on.
- [ ] The level list is unvirtualised. `Fresh & Frozen Vegetables` has ~60
      children and renders them all; a node with several hundred would not.
- [x] Search results show a path but no way to jump *into* that path — picking
      a match selects it outright rather than opening its level.

      Done 2026-09-08: a trailing Browse here button (and ArrowRight) opens a match's level -- a parent on its own level, a leaf beside its siblings -- through the same goTo, so an outside press commits it like any other level.
- [x] The picker still has no Arabic strings; labels are hardcoded English
      while the node names come back localised.

      Done 2026-09-08: the chrome reads products.categoryPicker.* (16 keys); the node names were already localised by the API. The metafield count became an ICU plural and the Use row a t.rich.


### The whole taxonomy has metafields, and the count badge is the way to them — 2026-09-06

Two follow-ons to the suggestion banner, both from testing it and finding
nothing on screen.

**The banner had nothing to suggest.** The starter seed covered three
categories — electronics, clothing, laptops — so every other category rendered
"This category has no metafields yet" and the banner correctly stayed away.
`seed:attributes:build` now generates the seed from curated packs covering all
5,595 taxonomy nodes. It is 34 blocks rather than 5,595 because
`getEffectiveSchema` walks the ancestor chain: packs sit as high in the tree as
the attribute is still true and inheritance does the rest.

The generator refuses to write unless every pack path is a real node, no key
repeats down any root-to-leaf chain, and every node inherits at least one
attribute. The middle check is the one that matters — a duplicate key across
two ancestors is `SCHEMA_DUPLICATE_KEY` thrown at *read* time on every product
in the subtree, so it turns a production error into a failed build. It is also
why the deeper packs use narrower names (`upper_material` under Shoes) and why
`Electronics > Computers` has no pack of its own.

**The count badge became a button.** "12 metafields" sat at the top of the form
reporting a number about fields several cards below it. It now scrolls to them.
The same helper backs the variant row's connected-metafield badge, which had
its own copy of the DOM-id string — a third copy was the point to consolidate.

Also fixed while in there: the connected-metafield badge was a Base UI dropdown
trigger rendering a `<span>`, which logged a console error on every product
edit screen. It is a real `<button type="button"` now — the `type` matters,
since a bare button inside the product form submits it.

- [ ] The seed upserts and never prunes, so a renamed key leaves its old
      definition behind — found the hard way when four perfume keys were
      renamed mid-session and showed up twice on the form. Needs either a
      prune step that spares admin-created rows, or a rename migration.
- [ ] The packs are English/Arabic only. A third locale means touching all 346
      options by hand.
- [ ] Coverage is uneven by design — 21 roots are thin (2-5 fields) while the
      curated branches are rich. `Business & Industrial` (25 level-2 children)
      and `Home & Garden` (21) deserve their own branch packs.
- [ ] No test covers the generator's three checks. They are the reason the
      seed is trustworthy and they are currently proven only by running it.


### Category metafields fill themselves in — the AI suggestion banner — 2026-09-06

Picking a category on the product form now fires `suggestProductAttributes`,
and the proposals come back as Shopify's "N suggestions available / Accept
all" block above the metafield rows.

The schema half of this shipped long ago: admins curate
`CategoryAttributeDefinition` rows per category and the form renders them as
chips. Nobody fills them in. A perfume category carries fourteen optional
metafields and a merchant who came to publish a product answers none, so the
filters they power match nothing and a curated taxonomy buys the catalogue
exactly nothing. The missing half was never the schema — it was the typing.

**It is free on every plan, deliberately.** There is an
`ai.catalog.generate_attributes` quota in the plan registry and this does not
use it. Metering it would be charging merchants to fill in our own schema —
the values are what make a catalogue filterable and the taxonomy worth
curating, and the shops with the worst catalogues are exactly the free ones a
gate would exclude. The ceiling is the per-user AI limiter and the platform's
daily cost cap, which is the shape every other text AI feature here already
uses; only image generation reaches for entitlements, because images are
priced per image in cents.

Three rules the design is built on. **It cannot widen the schema** — every
model answer is coerced against the definition it names and an unknown key,
wrong type or unlisted option slug is dropped rather than raised, because
accepting sends the value straight to `createProduct`, whose validator
answers an unknown key with a 400. **It only ever fills a blank** — answered
keys go out as `skip_keys` and never reach the prompt, and the form re-checks
the live value before writing, so a proposal that lands after the merchant
typed their own answer loses. **It suggests, it does not save** — accepting
writes to form state with `shouldDirty` and the save bar stays the one commit
point.

Two smaller calls worth remembering. The request fires on category choice
rather than from a button (a button labelled "suggest" is one more thing not
to click), capped at one per category per mount and skipped when there is no
title to read or nothing left to fill. And the values render in the banner
rather than tinted into the real inputs — the one departure from the screen
it copies, because a field showing "Spray" over an empty form value makes the
form lie about what Save will write.

- [ ] No test covers the resolver's guard chain — `ShopOwnershipGuard` is
      what stops a vendor driving this against a shop that is not theirs, and
      only the unit tests on the service exist.
- [ ] `ai.catalog.generate_attributes` is back to being a registry key nothing
      reads. Either wire it to a future batch path (the CSV item below) or drop
      it from the plan registry and the pricing page.
- [ ] The per-user limiter is now the only ceiling, and it is the shared
      `content` bucket (30/hour) that other text AI features also draw from —
      a merchant categorising products in bulk can starve their own alt-text.
      Worth its own feature key if that shows up.
- [x] The banner has no Arabic strings — labels are hardcoded English while
      the rest of the card is `next-intl`.

      Done 2026-09-08: the whole card, not just the banner -- every string in the file was hardcoded. products.metafields.*, with the suggestion count as an ICU plural, and the locale now threaded into ProductForm so the Arabic dashboard stops drawing Arabic chrome around English field names.
- [ ] Suggest from the product image too. `ai.vision.analyze` is a live
      capability and a photo answers "Dispenser type" better than a title
      does; today only `name`/`description`/`brand` reach the model.
- [ ] Feed accept/dismiss back somewhere. Which suggestions merchants reject
      is the only signal we have on whether a category's schema is worth
      keeping, and it currently goes nowhere.
- [ ] The 40-definition prompt cap silently truncates a deep category's
      inherited chain — no telemetry says when it bites.
- [ ] Offer the same thing on CSV import, where a hundred products arrive
      with a category and no metafields at all. Per-product calls would be
      the wrong shape; this wants a batch path.


### Type and Vendor are back on the product form, as pickers — 2026-09-06

The organization card asks for both of Shopify's free-text organization
fields again. **Vendor** is `brand`, which was removed from this card once
because merchants left the input blank — `ProductEnrichmentService` has
filled it since, and still does, but only when it is blank, so a merchant who
knows the vendor can now say so without fighting the worker. **Type** is a
new column, `type_name`: our `product_type` is the structural enum
(SIMPLE / VARIABLE / DIGITAL / SERVICE) derived from the option axes, so
Shopify's free-text "Product type" had nowhere to live and its CSV `Type`
column sat on the importer's knowingly-dropped list. It now maps straight
through.

Both are `ValueCombobox`, not inputs, and that is the point: free text left
to itself becomes three spellings of one vendor. The picker opens on
`productOrganizationOptions` — a `DISTINCT` over the shop's live products —
and only offers to create a value matching none of them, case-insensitively.
Picking the chosen value again clears the field.

- [ ] Add Type and Vendor as keys in the list's filter bar, and a Type column
      in the table beside the existing Vendor one.
- [ ] Backfill `type_name` for catalogues imported before the column existed —
      the CSV `Type` was dropped, so a re-import is the only way to recover it.
- [ ] Let the enrichment worker suggest a `type_name` the way it does `brand`,
      reusing the shop's existing types as the vocabulary.

### Products search is one Shopify-style filter bar — 2026-09-06

The products list's toolbar used to be a search field plus a second row of
faceted filter buttons that opened when the field was focused. The row
offered three of the filters the URL accepts and none of tags, collections
or category, and asked the vendor to know which button held the one they
wanted. It is now one field, `ProductsFilterBar`: typing is a product search
(debounced 300ms), focusing the empty field lists the filter keys by name and
typing narrows them, picking one becomes a chip ("Tag is") and the list
switches to that key's values, each toggle written to the URL at once. Chips
derive from the URL — one per key, an emerald pill, click to edit, an X
revealed on hover removes it, Backspace removes the last — so the bar cannot
show a filter the list is not applying. The keys are a
declarative table in `lib/list/filters.ts`, each one `ProductListQueryState`
field; Category is the new `system_category_id` (single-select, expanded to
its descendants server-side). The dropdown is a trigger-less `Popover`
anchored to the bar, because the table card is `overflow-hidden`, with its own
listbox driven by the input's `aria-activedescendant` rather than `cmdk`. Tag
and collection values reuse the existing queries and Category reads the new
`productCategories`; all three are fetched only while the key is active or a
chip needs their names, so nothing loads for a vendor who came to scroll.

Two things from the Shopify screenshots are deliberately not here. Status is
not a key: the "All" view selector at the bar's start already owns
`statuses`, and one piece of state gets one control. And there is no "is /
is not" operator: `ProductFilterInput` has no exclusion fields, so the picker
would promise what the query cannot do.

- [ ] Show each key's counts in its value rows the way Category has them —
      needs a facet count for tags, collections and the enum keys.
- [ ] "Is not" operator per key — needs exclusion fields on
      `ProductFilterInput` (`exclude_tag_ids`, …) and service support.
- [ ] Saved views beyond the status tabs (Shopify's Save button) — persist a
      named filter set per vendor.
- [ ] Vendor/brand as a filter key — needs a `brands` filter on
      `ProductFilterInput`.
- [ ] Roll the filter bar out to the orders, customers and collections lists.

### "Add collection" opens the real editor, and a chip's X waits for the pointer — 2026-09-06

Two changes to the product form's Collections and Tags box.

**The "Add new collection" drawer stopped being a short form.** It used to write
four fields — title, cover, description, published — and a vendor who opened it
from a product got a collection they then had to finish somewhere else: every
field left out was a second trip to `/products/collections/[id]`. It now renders
`CollectionEditor` itself, so the drawer and the route are the same screen and
cannot drift. `CollectionEditor` grew an `embedded` prop for it, and the three
things it changes all follow from not owning the page: the **header** comes from
the host (the route's own carries a breadcrumb out of the dialog and Duplicate /
View / Delete, all dead on a collection that does not exist yet), the **global
save bar is left alone** because the product form is already using it — two
screens driving one bar means one screen's Save discards the other's — and the
**root is a `div`, not a `form`**, because a dialog portals to the body while
React events still travel the React tree, so a nested `form` would fire the
product form's own `onSubmit` on the way past. `useCollectionEditor`'s matching
`onCreated` hands the collection back instead of navigating to it.

**A chip's remove X is revealed on hover** — fades and scales in over 150ms —
with its space reserved at rest, so the reveal never reflows the wrapped box.
Growing the chip instead would push the last one onto a new line out from under
the pointer mid-click. `focus-visible` reveals it for the keyboard and a screen
reporting `hover: none` draws it permanently, since there the reveal would never
fire and this is the only way to remove a chip. The same change added `shrink-0`
to the button, which fixed a real overlap: the chip is a flex item in a wrapping
row, so a tight row squeezed the button to nothing and the 12px glyph rode up
across the last letters of the label ("Vintag✕").

- [x] The drawer has no unsaved-changes guard of its own — closing it discards a
      half-filled collection silently. The global bar belongs to the product
      form, so it needs a local confirm rather than a second bar.

      Done 2026-09-08: the embedded editor reports isDirty to the drawer, which routes Discard, Escape and a backdrop press through one ConfirmDialog (promoted to shared/components). A successful create bypasses it, because the form resets before the callback.
- [x] `ChipPicker`'s panel and its chips are hardcoded English, like the rest of
      the product form. They move to next-intl when that feature does.

      Done 2026-09-08: products.picker.*, shared with ValueCombobox so the two panels stay one vocabulary. The composed Add {label} default became a required, already-localized addLabel prop -- lower-casing a translated noun is what made it untranslatable.
- [ ] The drawer is `max-w-6xl` and the editor inside it keeps its two-column
      grid; check it on a narrow laptop before assuming the sources panel is
      reachable there.

### The Shipping card was rebuilt to match the Inventory card beside it — 2026-09-06

`requires_shipping` moved out of the body and into the card header as a
"Physical product" switch, the way `track_quantity` already sat in Inventory's.
Weight and its unit became one control instead of two unrelated fields: the
vendor types in whichever unit `weight_unit_display` holds and the card converts
to `weight_grams`, which is still what is stored. Before this the number was
always grams while the dropdown next to it said "kg", so the pair read as a
weight and was not one. The typed text is mirrored in local state so rounding to
whole grams cannot rewrite the box mid-keystroke, re-seeded during render (the
codebase's adjust-state-during-render pattern) rather than in an effect. HS code
and country of origin moved behind a "More details" collapsible with a summary
chip each, and the country field is now the shared `CountrySelect` instead of a
two-character text box. `shipping-card.test.tsx` pins the conversion, the
re-seeding and the collapsed summary.

- [ ] No **Package** field, which the reference design has. It needs a
      catalogue-level box template the data model does not have —
      `ShipmentPackage` is per-shipment, recorded at fulfilment. Decide whether
      shops get saved packages (a model + a shipping-settings screen + a
      per-product reference) or whether weight alone is enough.
- [ ] HS code is still free text. The reference searches a code table by
      keyword; there is no HS dataset in the repo to search.

### Two cards left the product edit form — inventory history and restock subscribers — 2026-09-06

The edit screen had grown long enough that the cards a vendor actually edits
were below the fold. `InventoryHistoryCard` and `StockNotificationsCard` are
both read-only panels — a ledger and a waiting list — so they were the two
paying the least for their vertical space, and `ProductForm` no longer renders
either. Nothing else changed: both components, their queries and their types
are untouched and `StockNotificationsCard` is still exported from its feature
barrel, so re-mounting either is a one-line import.

- [ ] Decide where the two panels belong — a tab on the edit screen, the
      inventory feature's own screens, or deleted outright. They are dead code
      until then.

### Collections and tags are pickable from the product form — 2026-09-06

The product's Organization card asked for tags through a bare search box, and
did not ask about collections at all — a vendor could only put a product in a
collection from the collection's own screen, one product at a time, even though
`CreateProductInput.collection_ids` had been on the API the whole time.

Both are now the same control, `ChipPicker`: a box of chips with an add button
on the label row, and a searchable panel of checkbox rows behind it. Tags split
into "Frequently used" (the shop's five most-applied) and "Other tags" above six
tags and stay flat below that, where two headings are chrome rather than
orientation.

The interesting half is creating what is missing, because the two records differ.
A tag is a name, so typing one that matches nothing offers `Add "…"` inline: one
mutation, sending **one** locale chosen from the text's own script, since copying
a Latin word into `name.ar` is how Arabic customers end up reading English. A
collection has a cover, a description and a published state, so its
`Add new collection` opens a drawer — the same shape as the targets one, and for
the same reason: the vendor is mid-edit on a product with unsaved changes, and a
route change would strand them. Either way the row is written immediately and
only its id is staged; membership itself stages behind the save bar like every
other field.

The colours are the design tokens rather than picked greys, which mattered more
than it sounds: `--muted` (#f6f6f7) is all but invisible on the white card, so
chips and selected rows are `--accent` (#edeeef), and hover is that same token at
60% because dark mode collapses `--muted` and `--accent` to one value.

Three things were wrong on the first pass and are fixed. The chip's × only
appeared on hover, which hides the only way to remove one. The empty state was
grey text where Shopify puts an `Add tags` pill, so the opener now lives inside
the box while the field is empty and moves to the label row once there are chips
— one opener at a time, with the popup anchored to the field wrapper so the swap
does not move it. And the create drawer was a reduced four-field form; it is now
`CollectionEditor` itself, behind an `embedded` prop that swaps the page header
for the host's, leaves the global save bar to the host's form, and hands the new
collection back instead of navigating to it.

- [x] The strings are hardcoded English, like the rest of the product form. They
      move to next-intl when that feature does.

      Done 2026-09-08: products.tags.*, products.collections.* and products.organization.*; the selling-method options render t(saleType.<ENUM>) keyed by the enum, so the option set stays the server's and only the wording is translated.
- [ ] The tag panel's "Frequently used" group reads `products_count` off the
      first 100 tags. A shop past that page gets the wrong five.
- [ ] Both pickers load one page (tags 100, collections 50) and search inside it.
      A shop past either bound cannot find its own rows — the search box should
      go to the server.
- [x] The embedded editor's sources panel keeps its `lg:sticky lg:top-20`, which
      inside the drawer sticks under the dialog's own sticky header. Harmless,
      but it is a page offset being used in a dialog.

      Done 2026-09-08: the offset moved to whoever owns the scroll container -- a stickyTop prop on the embedded editor, with the drawer's own header arithmetic written beside the number it derives.
- [ ] `collection_ids` writes only the pinned list. There is no sign in the
      picker that a product is also in a smart collection by rule, so a vendor
      reads "not in any collection" as false when conditions put it in one.
- [ ] The panel is a popover inside the sidebar column; on a narrow viewport it
      opens over the field it belongs to. Check it against a real phone.
- [x] `chip-picker.test.tsx` is flaky under parallel load — eight of its ten
      cases failed twice on a busy machine (the panel never opened, so
      `getByRole("button", { name: "Edit tags" })` found nothing) and passed on
      a quiet one and with `--no-file-parallelism`. It opens the popover with a
      bare `fireEvent.click` and asserts straight after; the open needs a
      `waitFor` or `findBy*` like the assertions further down already use.

      Closed 2026-09-08: already fixed. Every case awaits a findBy* after opening the panel; the recorded failure names an opener label the 2026-09-06 rewrite renamed. Three consecutive runs pass.

### The product edit screen got a real page header, arrows included — 2026-09-06

The edit screen opened on a back arrow and the words "Edit product" — a title
that named the screen rather than the thing on it, on the one screen where the
vendor already knows which screen they are on and not always which product.
`ProductPageHeader` replaces it with what Shopify puts there: breadcrumb tag,
the product's own name, its status badge, then Preview, Share, a More actions
menu (Duplicate product / Set as draft / Delete product) and the up/down
arrows. It follows the collection editor's split over where an action commits
— "Set as draft" stages `status` into the form so the save bar stays the one
commit point, while Duplicate and Delete are their own writes and fire at
once. Delete is new to the dashboard at all: `deleteProduct` had existed on the
API with no screen calling it.

"Set as draft" is where Shopify puts "Archive". We have no archived state —
three statuses, of which DRAFT already means hidden everywhere — so the slot
keeps the icon and the position and uses the word this app stores.

The arrows are the part with a design decision behind them. They step through
*the list the vendor arrived from*, not a canonical order, so the list context
travels in the URL: a row now links to `.../{slug}/edit?{the list's own query
string}` and `useProductNeighbors` re-parses it, re-running `GET_PRODUCTS` with
identical variables — an Apollo cache hit when the vendor came from the list.
Back lands on the page and filters they left, too. A page edge fetches the
adjacent page for the one row it needs. Opening the edit URL cold carries no
query string, leaves the hook looking at page 1, and disables both arrows,
which is the honest answer when there is no list to step through.

- [x] The header's strings are hardcoded English, like the rest of the product
      form. It moves to next-intl when that feature does.

      Done 2026-09-08: products.header.*, keys mirroring collections.actions.* since the header was modelled on that editor. Covers the Share popover and Duplicate confirm added the same day; the badge reads products.status.<ENUM> rather than the English label map.
- [x] Share copies the storefront link and toasts. Shopify opens a small
      popover with the URL and social targets; decide whether that is wanted.

      Done 2026-09-08: Share is a popover -- the URL in a read-only field with Copy beside it, then WhatsApp, X, Facebook and Email. A DRAFT product says it is not visible on the storefront, and Copy stays enabled.
- [ ] The arrows are dark on a cold open of an edit URL. A `productNeighbors`
      query on the back-end (or a slug-keyed lookup) would light them without
      the list context.
- [x] Duplicate navigates to the copy without warning about unsaved edits on
      the product being duplicated; the copy is taken from the server row.

      Done 2026-09-08: Duplicate confirms when the form is dirty, reading the same value-based isDirty that drives the save bar, so a field typed back to its saved value does not prompt. A failed write leaves the dialog open.

### Variant stock is per-location in the variants table, not a card of its own — 2026-09-06

The product form carried a second table. `VariantInventoryCard` listed every
variant again, each row an expander over a per-location stock editor, sitting
directly under the variants table that had already listed them once. It also
wrote on blur, which is the one thing this dashboard's edit screens do not do.

The location is now a picker in the variants table's own toolbar, the way
Shopify does it. "All locations" shows the rollup and is read-only — a sum
across warehouses has no single level to write it to — and picking a location
makes the Available column editable for that one, with the footer naming the
scope it counted in ("Inventory is not stocked at tsrs" rather than a bare 0).
A shop with one location never sees the picker and edits the column directly,
since defaulting it to a read-only aggregate over one warehouse would leave
that vendor no way to set stock at all. Edits stage on the form's new
`inventory_levels` field and are flushed by `useProductSubmit` **after**
`updateProduct` — the update writes each variant's `quantity` straight through
while `setInventoryAvailable` has the back-end recompute that same column from
`SUM(available)`, so flushing first would overwrite the ledger's answer with
the form's stale one.

Two back-end gaps had to close for the model to hold. `inventoryLevels` gained
`include_variations`, because a variant's level carries `product_id = NULL` and
the old read would have meant one request per variant to fill one column. And
`updateProduct` now seeds the default location for a variation the diff
**creates**, as `createProduct` already did — before it, a variant added during
an edit owned a `quantity` and no `InventoryLevel`, and the first ledger write
to touch it recomputed the rollup from no levels and zeroed the stock just
typed.

- [ ] The Inventory card's `MultiLocationLevels` (SIMPLE products, edit mode)
      is the same per-location table this change removed for variants, and it
      still writes on blur. Decide whether it gets the same toolbar picker or
      stays as is.
- [x] The variants table's Search and Filter buttons are still inert markup.

      Done 2026-09-08: both drive a client-side filter over the form's own variation_options -- a search across option values and SKU, and a per-axis value picker derived during render. Rows are skipped by original index, so nothing is re-mapped and no value is lost.
- [ ] Per-location stock for a brand-new variant needs a second save (no id
      until the product is written). Opening stock lands at the default
      location; moving it is a transfer.

### Products CSV import now reads a Shopify export, variants and all — 2026-09-06

Both CSV items in the products More-actions menu had been dead markup since the
menu was written, and the importer behind them read only our own flat column
names: one row, one product, prices in cents. A merchant arriving from Shopify
has none of that — their export writes major units, splits a sale across
`Price` + `Compare-at price`, and spreads one product across one row per SKU.

`shopify-csv.mapper.ts` is the whole of the difference. It resolves three
header vocabularies onto our canonical fields (ours, Shopify's classic export,
Shopify's current admin template), inverts the sale pair, collapses
`Status` + `Published on online store` into our one enum, and folds rows
sharing a handle into a single draft with `option_definitions` and its
variants. The service then imports **products, not rows**: Shopify's own sample
file lands as 3 products / 16 SKUs / 2 images, which is what its own preview
says. `Option1 name = Title` is dropped as the default-variant placeholder, so
a single-price product stays SIMPLE.

The dialog asks nothing before it is known to matter. Attaching the file runs
a dry run with `overwrite_existing: false`; a file whose handles are all new
goes straight to the preview, and only one that collides stops on a conflict
pane that names the handles and asks Skip or Overwrite. Answering Overwrite
re-runs the dry run with the flag on, so the preview is always the report for
the run that will happen — what was "3 skipped" becomes "3 updated". Publish
is asked on the preview, where the created count is known. A browser-side
preview would be a second copy of the mapping and the grouping, and the two
would drift.

**CSV is no longer a plan capability (2026-09-06).** It shipped gated on
`catalog.import_export`, which the `free` fallback plan does not carry, so the
first real click on Import came back `FEATURE_NOT_AVAILABLE`. Getting your own
catalogue in and out is not the thing to charge for — it makes the product
harder to adopt than to leave — so the key is gone from `feature-registry.ts`,
the `@RequireFeature` + `FeatureGuard` are off both mutations, and the agent's
two CSV tools rely on the `bulk_ops` group gate alone. `seed-plans.ts` is
additive and deletes nothing, so a database seeded before today keeps the row
and would go on advertising CSV as a Basic feature on the plan screens —
`prisma/migrations/manual/2026-09-06-retire-csv-capability.sql` flips its
`is_active`, which is the one flag every read path already filters on.

**An import died on a handle another shop owned (2026-09-06).** `Product.slug`
is unique table-wide; `findExisting` looks only at this shop's live rows. A
handle taken by another shop — or still held by a product this shop
soft-deleted — passed that lookup, so nothing matched, nothing was skipped,
and the create hit a P2002 that aborted the transaction. `formatError` maps
P2002 to a bare VALIDATION_ERROR, so the merchant got "Validation failed"
with no field, no row and no reason, and the file was diagnosable only from
the API's own logs. The handle now goes through `slugify` + `generateUniqueSlug`
like every other slug, so a collision becomes `mug-1` and the report says so;
normalising it also fixed the match, which compared a free-text handle against
the slugified value it had written. A variant SKU repeated inside one product
(a partial unique index Prisma cannot see) is now a row error beside the
duplicate-combination check, and any unique violation that still gets through
is re-thrown as `CSV_DUPLICATE_VALUE` naming the column.

- [ ] Run `npm run migrate:local -- 2026-09-06` on each environment that was seeded before the removal, then invalidate the entitlements cache (a cached resolve keeps the dead key on the plan screens until it expires).

- [ ] Imported stock writes `Product.quantity` / `VariationOption.quantity` directly, bypassing `InventoryService.adjust` — so a multi-location shop gets no `InventoryLevel` row and no CORRECTION adjustment explaining where the count came from. `createProduct` seeds both. Same gap the importer always had; worth closing now that imports carry variants.
- [ ] Variants the file omits are left alive on an overwrite (they may hold stock or sit in a live cart). Nothing surfaces them — the report should name the combinations it left behind so a merchant can decide.
- [ ] Import runs in one request and one transaction, capped at 5000 rows. A real migration is bigger; needs chunking or a BullMQ job with progress.
- [ ] Images are stored as the URL the file gave (`original` = `thumbnail`), not fetched into our attachments. A Shopify CDN link keeps working until they delete the shop.
- [ ] `Type`, `Gift card`, tax codes and the unit-price measures are dropped. `unmapped_headers` reports them; nothing shows that list before the merchant commits except a line under the counts.
- [ ] No Arabic column in a Shopify file, so everything imports English-only. The canonical `name_ar` / `description_ar` columns still work for our own exports.
- [x] The coupons list has the same two dead menu items (`coupons-header.tsx`).

      Done 2026-09-08: removed. There is no coupon CSV operation on the API -- only exportProductsCsv and importProductsCsv -- so the menu was wired to nothing. The round trip is filed as back-end work instead.

### Three product statuses, and the status column edits itself — 2026-09-05

`ProductStatus` carried six values — `DRAFT`, `UNDER_REVIEW`, `APPROVED`,
`PUBLISH`, `UNPUBLISH`, `REJECTED` — behind a state machine. The middle three
were a marketplace approval flow with **no driver**: no screen and no admin
mutation ever moved a product out of `UNDER_REVIEW`, only the vendor who put it
there, so the review was the vendor reviewing themselves. What the machine did
cost was real — `DRAFT` reached only `UNDER_REVIEW`, so publishing a draft was
three writes through two states nobody read. `UNPUBLISH` was a second name for
"not for sale", which `DRAFT` already meant.

It is now Shopify's three: **Active** (`PUBLISH`), **Draft**, **Unlisted**.
`UNLISTED` is the one that had no home before — hidden from the catalogue,
search, recommendations and every bot, but `storefrontProduct(slug)` resolves it
and the cart accepts it, so a link a vendor sends still sells. That single
exception is pinned from both sides in `products.service.spec.ts`: widening the
catalogue would publish a product the vendor hid, and narrowing the slug read
would 404 a link they had already sent.

The state machine went with the extra values. Three states that all reach each
other in one write need no transition table, and `INVALID_STATUS_TRANSITION` is
gone from the API.

On the list, the status column is now editable in place — the pill is the
trigger of a select carrying the same three choices and the same descriptions
the form shows, and picking one writes immediately with an Undo on the toast.
It is the **one** cell in the dashboard that does not stage behind the save bar:
that rule is about forms, where a dozen fields are edited together and a
half-applied save is a real state; a status flip is one field with three values
and no partner field to be inconsistent with, so what it needs is a way back,
not a save bar. Publish/Unpublish/Archive left the row menu rather than becoming
a second, worse way to do the same write.

- [ ] The scheduled-publish cron republishes a `DRAFT` row whose `published_at`
      is in the past, so moving a launched product back to Draft is undone on
      the next tick. `UNLISTED` is excluded; `DRAFT` is not, and predates this
      change. Decide whether the cron should clear `published_at` after it
      fires, or skip rows a vendor has since edited.
- [x] `deleteProduct` exists on the API and no screen calls it — there is still
      no way to remove a product from the dashboard. Removing Archive did not
      cause this, but it makes the gap the only one left.

      Closed 2026-09-08: already wired. DeleteProductDialog calls the mutation and the edit header mounts it; this box predates the header commit.

### A retired shop handle keeps working — 2026-09-01

Shipping `Settings > Domains` handed vendors a button that broke things: change
your address and every link under the old one 404s the same second. The dialog
warned about it, which is not the same as it being acceptable — Shopify keeps
the previous address resolving, and so does this now.

`shop_slug_history` holds every handle a shop has answered to. Three places read
it: `ShopsService.resolveSlug` behind `shop(slug)`, which answers with the
shop's **current** slug so a caller holding an old URL learns where to go;
`ShopHeaderGuard`, which matches `X-SHOP` against `past_slugs` in the same query
rather than adding a round trip, so a stale dashboard cookie no longer tells a
vendor their own shop does not exist; and `slugTaken()`, the one place that
answers "is this handle free".

That last one carries the rule that is easy to miss and worst to get wrong: the
`UNIQUE` on `shop_slug_history.slug` **reserves a retired handle against every
other shop**. Without it, `acme` released by one shop and claimed by another
would silently forward every old link into a stranger's storefront — a worse
outcome than the 404 the table exists to prevent.

The move is transactional and ordered: the outgoing handle is retired *before*
the write that frees it, because the other order leaves a window where the shop
answers to neither and a request in the gap 404s. Any history row for the
incoming handle is dropped in the same transaction, or a shop returning to a
former address would keep it reserved against itself.

The storefront closes the loop: `[shopSlug]/layout.tsx` compares the slug it was
asked for against the one that came back and redirects, preserving the path so
`/old/products/mug` lands on `/new/products/mug`. A server layout only gets its
own params, so `proxy.ts` forwards the pathname as `x-storefront-pathname`. The
redirect is **temporary (307)**: a handle can be changed again, or back, and a
308 cached in every visitor's browser would outlive the decision.

- [x] The vendor dashboard does not redirect its own stale `/store/<old>/…`

      Done 2026-09-08: the proxy hands the layout the full pathname, which resolves the handle and redirects to the canonical one keeping the tail. Whole-segment matching, loop-guarded, and null on every uncertain case.
  URLs. They work — the guard resolves the handle — but the address bar keeps
  showing one that is no longer canonical.
- [ ] `fetchShopShell` caches for an hour, so for up to that long after a change
  the old address serves the right shop without redirecting. Never a 404, but
  the cache tag (`shop:<slug>`) could be revalidated on the change instead.
- [ ] History grows without bound and nothing ever releases a handle. A shop
  that has cycled through twenty addresses holds all twenty forever.

### Settings → Domains, and the rename that used to move the URL — 2026-08-31

`/create-store` now mints a UUID handle, so a store arrives at
`localhost:3003/80555536b206` and needs somewhere to change it. That screen is
`Settings > Domains`, built to the reference: the current address with its
Primary and Connected badges, and one **Change store address** card behind a
dialog.

Building it surfaced a bug rather than just filling a gap. `ShopsService.update`
re-derived the slug from `name` on every rename — so editing a trading name
silently changed the storefront URL and the `X-SHOP` key, breaking every link,
bookmark and search result under the old one, with nothing on screen saying so.
`UpdateShopInput` now carries an explicit optional `slug` and `name` no longer
touches it. A colliding handle is still suffixed `-1`, `-2` rather than refused,
so the pane reads the slug back off the response instead of assuming it got what
it sent.

The pane is the one settings screen that does **not** use the contextual save
bar, and deliberately: committing a handle moves the very route the form is
standing on, so it cannot be one field in a batched patch. It is a dialog with
an explicit confirm, a warning that old links stop working, then a refresh of
the shop list, `setActiveSlug`, and `router.replace` onto the new URL. That
order was the other way round until 2026-09-05 — see the entry at the top of
this area for why the refetch has to land before the slug moves.

- [ ] `schema.gql` was hand-edited to add `UpdateShopInput.slug` — it is
  generated at boot by `autoSchemaFile` and there is no script to emit it
  without a running database. Worth adding one.
- [x] The pane says "Connected" off `is_active` alone. A shop pending approval

      Done 2026-09-08: storefrontStatus reads both flags -- not approved first, then not active -- mirroring the server's 404 on either and the admin console's own precedence.
  is not reachable either, and the badge does not say so.
- [ ] Custom domains are the other half of this screen in the reference and do
  not exist here at all — no `Buy new domain`, no `Connect existing`.

### `/create-store` stopped asking for anything — 2026-08-31

The create-shop screen asked five things at once on a scrolling white page: the
type chips, name, description, a three-field address and two contact fields.
Everything on it but the name is optional, and presenting all of it as one wall
made that impossible to tell. It was briefly a four-step wizard over the same
fields, which was the same wall with a corridor through it.

It now **collects nothing that blocks creation**. One question -- what do you
want to do -- and both buttons create the shop: Continue sends the chosen chips
as the description, Skip sends none. The shop gets a temporary localized name
and the vendor renames it, and fills in everything else, from
`Settings > General` once they are inside. A name typed on the way in is a name
typed before you have decided anything, and it was the only thing standing
between "I want a store" and having one. The screen says which name it is about
to use, under the button, rather than letting it turn up unexplained in the
picker.

Two things this leans on, both already true server-side: `ShopsService.update`
re-slugs whenever `name` changes, so the temporary slug is not a decision
either; and `generateUniqueSlug` resolves collisions with `-1`, `-2`, which is
what lets every vendor who skips share one name. `createStoreSchema` went with
the form -- there is no free text left on the screen to validate.

`/shops` and `/create-store` are now the same `StoreFrame`, extracted rather
than written twice: brand at the top start, one slot at the top end, question
centred, white card under it. It is deliberately not `AuthShell` -- that centres
the brand over the headline and leaves no room beside the card for a Back
control -- but it stands on the same `ShaderBackground` ground, so signing in,
picking a store and creating one are one picture.

- [x] Nothing yet points a vendor from the picker to `Settings > General` to

      Done 2026-09-08: a row still carrying a generated name or handle shows a hint linking to the screen that renames it.
  rename a store still called by the temporary name, or to `Settings > Domains`
  for its handle. The picker is where they see both and the one place that
  could say so.
- [ ] `types` is collected and then only ever used as the description. Either
  it should shape the setup it promises to tailor, or it should go.
- [x] The address and contact fields that used to live here now exist only in

      Checked 2026-09-08: nothing downstream breaks. The shipping origin is the InventoryLocation row rather than the shop address, and invoices carry no address at all. The two adjacent gaps this surfaced are filed as their own boxes.
  `Settings > General`. Worth checking that a brand-new store's empty address
  does not break anything downstream (shipping origin, invoices).

### The store picker rebuilt as one searchable list — 2026-08-31

`/shops` was a grid of tall cards on the app's own light ground: fine for the
two stores a vendor has on day one, unreadable at eight, because the only thing
distinguishing them was a name and several of them are literally "My Store".
It is now the shape the reference comp asks for -- a dark full-screen ground, a
greeting addressed to the signed-in user, and **one white card** carrying a
status filter, a search box, the scrolling list, and the create-store row.

That ground is `ShaderBackground`, a new `@repo/ui` component wrapping a WebGL
"Mesh drift" field, and the same swap replaced `AuthShell`'s `PixelField` ember
wall -- so the screen you sign in on and the screen you land on afterwards are
one picture, in both consoles. Both call sites lay a fixed dark scrim over it:
the recipe's brightest colour is near-white and drifts, and the type on both
grounds is light.

Two decisions inside it are ours rather than the comp's. Every row shows its
**storefront URL** under the name, because that is the only line guaranteed to
differ between two stores called the same thing. And the filter defaults to
**All**, not Active: the comp's user always has a live store, ours may have
nothing but one still awaiting approval, and defaulting to Active would open
the screen on an empty list. What "active" means is `is_approved && is_active`
-- either flag being off means nobody can shop there -- so anything else keeps
a pill naming which of the two it is.

- [ ] The list is client-filtered over the whole `myShops` result. Fine at the
  scale a vendor operates at; a vendor with hundreds of stores would want the
  search pushed to the server.
- [x] No keyboard shortcut into the search box, and no arrow-key traversal of

      Done 2026-09-08: / and Cmd/Ctrl+K focus and select the search box (matched on key code too, so an Arabic layout still works), and the arrows walk the rows.
  the rows. Both are cheap and this is a screen people arrive at every login.
- [x] The avatar/name in the top-right is not a menu — there is no way to sign

      Done 2026-09-08: it is a dropdown now, with sign out in it.
  out or switch account from the picker without reaching a dashboard first.
- [x] `ShaderBackground` has no render test of its own. jsdom has no WebGL, so

      Done 2026-09-08: a render test in the shape of dither-field's -- the degradation path and the a11y contract, with a hand-driven frame queue rather than fake timers so a pending frame is a readable number.
  what is testable is the degradation path and the a11y contract — the same
  shape `dither-field.render.test.tsx` already pins for its sibling.
- [x] The shader recipe is a module constant, not props. A second look on

      Decided 2026-09-08: it stays a constant. Both consumers share one recipe on purpose, so the screens either side of a sign-in are one picture; props would only invite them to drift.
  another screen would mean either a `uniforms` prop or a second copy.
- [x] `PixelField` is now used by nothing but its own test. Either give it a

      Done 2026-09-08: deleted, with its test. ShaderBackground replaced it and the README now says so.
  home or drop it.

### Both vendor bots became per-store — a new shop no longer reports a connection it never made — 2026-09-05

Creating a shop and opening `/store/{slug}/settings/whatsapp` showed the Zaydak
vendor bot already connected. Two separate facts were being rendered as one
claim. The pill read `available`, which means *the platform paired its own
assistant number* and is true for every vendor the moment an admin does it; the
green panel beneath it read `links`, which was **account**-scoped, so a handset
enrolled on a store paired yesterday appeared on a store created a minute ago.
Neither was a lie on its own; together, under a card where "connected" means
"your customers can reach you", they said the wrong thing.

The fix was not cosmetic. Both channels' bindings are now per-store:

- **WhatsApp.** `myVendorBot` / `unlinkVendorBot` are shop-scoped (`X-SHOP` +
  `ShopOwnershipGuard`) and return `link` (singular, null until this store's QR
  is scanned) rather than `links`. `autoLink` re-pins on every scan instead of
  keeping an existing pin, so the store you scanned is the store it answers
  about. `unlinkVendorBot` lost its `linkId` argument — account plus header
  leaves nothing to guess.
- **Telegram.** The pairing token carries `{userId, shopId}` and is minted on a
  store's settings screen, with ownership re-checked when it is spent (a token
  lives ten minutes; opening a link re-proves nothing). `myTelegramBot`,
  `connectTelegramBot` and `disconnectTelegramBot` all take `X-SHOP` now.

What came *out* matters as much. The numbered shop picker, the inline keyboard
that chose a store, and the `switch shop` / `تبديل المتجر` phrase are all gone
from both routers: each was a tenant selector one inbound message away from an
LLM, and each let one conversation walk between stores. `active_shop_id` is
written by enrolment alone and re-checked against ownership every turn; a stale
or missing pin now stops with `not_connected` rather than falling back to "any
shop they have".

The cost is structural rather than chosen, and both cards say it: WhatsApp
identifies a sender by their number and Telegram by their account, against one
platform number and one platform bot — so a handset is one conversation, and one
conversation is about one store. Connecting a second store moves it and the
first goes quiet. Two live at once needs a second phone or a second Telegram
account; there is no third option to offer.

- [ ] Backfill check: handsets pinned to a store the account no longer owns now
      answer `not_connected` instead of re-asking. Worth a one-off query to see
      how many rows are in that state before a vendor reports it as silence.
- [ ] The vendor bot card still shows nothing about *which other* store a phone
      is serving. A vendor who moved their handset by scanning store B has no
      way to see, from store A, why it went quiet.
- [ ] Telegram's `link_bad` now covers both "token expired" and "you no longer
      own that store". Same sentence for both is right for probing, but the
      second case deserves its own line once a vendor hits it.

### The WhatsApp inbox — the screen the assistant was missing — 2026-08-29

The customer bot has been answering in merchants' names, on their own numbers,
with **nowhere for them to read what it said**. The data has carried three
distinguishable voices since the schema change; nothing rendered them. A
merchant who cannot read their own thread cannot judge whether to leave the
assistant on, which made every other guard on that bot untestable in practice.

**It could not reuse `conversations`, and the reason is authorisation rather
than layout.** `getConversations` scopes on `participants: { some: { user_id } }`
— exactly right when both sides are accounts, and structurally impossible here:
a WhatsApp customer has no account, so a WhatsApp thread has no participant row
and is **invisible** to that query. Two ways out, and the tempting one was
wrong: creating a shop-side participant pins the thread to one staff member and
rots as staff change. The right question on this channel is ownership, so the
inbox got its own resolver behind `manage_own_shop` + X-SHOP +
`ShopOwnershipGuard`. Bending the participant query to *also* mean ownership
would have made one query mean two things and made the looser of them default.

**`MessageBubble` is the whole point.** The assistant and the merchant share a
side — to the customer both came from the shop — but never a colour: solid for
the merchant, tinted outline with a name for the bot. The test asserts they
*differ* rather than asserting a palette, so the property survives a redesign.

**Replying takes the conversation**: the mutation records a `VENDOR` message and
refreshes the assistant's pause window, so the bot cannot answer underneath the
person who just spoke. The screen says so *above* the box rather than letting a
merchant discover it afterwards. And `unanswered_count` treats the assistant as
the shop — a thread the bot already handled is not waiting, and badging it would
send merchants to conversations nobody needs to read.

Nothing on this surface takes a phone number: the reply names a thread and the
server resolves the destination, or a signed-in vendor could send from their
shop's number to anybody at all.

- [ ] No real-time push — the list polls every 30 seconds. The SSE machinery the
  connect screen uses is per-shop and could carry this, but the inbound path
  publishes nothing today.
- [ ] No search, no read state, no attachments. A shop with hundreds of threads
  will want the first two before the third.

### Settings → WhatsApp redesigned around two numbers, and a customer bot that asks — 2026-08-28

The screen was one card that reported a connection state. It is now a page laid
out around the fact that **two WhatsApp numbers live on it and they are never
the same number**: the shop's own, which the vendor pairs and their *customers*
write to, and Zaydak's, which the platform owns, the vendor never pairs, and
*they* write to. Separate headings, never one card, and only the first has
connection controls — a merchant who conflates them hands a customer the wrong
number. The platform half is a summary card (status, the number, a `wa.me`
link, a way through to `/settings/vendor-bot`) and deliberately carries no QR:
duplicating the enrolment flow would give one binding two screens that can
disagree.

The store half is five states rather than four branches of one paragraph:
`WhatsAppEmptyState` teaches (answering the four wrong assumptions — a second
SIM, an application form, a disqualified number, typing it in), and
`WhatsAppAccountCard` carries `connecting` / `connected` / `disconnected` /
`error` as the *same* object having changed. **`disconnected` and `error` are
split on `last_error`** and painted differently: a flat phone is routine and
must not spend the destructive colour that a real failure needs. The QR moved
into a modal with three numbered steps — the steps are a path through *another
app*, and a merchant who has never opened Linked devices scans with the camera
app instead — and the success screen lands in the same surface, naming the
number that answered.

**The customer assistant is now a real switch, and the ask is the point.**
`setWhatsAppCustomerBot(enabled)` is new (`manage_own_shop` + X-SHOP +
ownership) and is the only thing that writes `ai_enabled`; `connectWhatsApp`
and `disconnectWhatsApp` never touch it, in either direction. The card shows
the **question** rather than a settled switch until the merchant answers, which
is the whole change of behaviour: a bot enabled by the act of connecting means
the first they hear of it is a customer receiving a reply they never wrote.
Turning it *off* is confirmed and the copy leads with what keeps working —
"turn off AI" reads to a merchant like "turn off WhatsApp". `ai_enabled: false`
is ambiguous (never asked / said no) and is resolved in component state rather
than a column, since the distinction only matters for the seconds after a scan.

`useWhatsAppLiveStatus` keeps a settled tab current: the same SSE stream the
pairing dialog uses, carrying a *fact* instead of a credential. It is nearly
free because the endpoint's poll loop is `takeWhile(state !== 'connected')` —
on a connected session it stops after one tick and what remains is a Redis
subscription waiting on the inbound webhook's `connection.update`. It reports a
change and never a state, so a dropped frame costs a refetch rather than a
wrong badge. 13 render tests pin the two numbers and the bot's asymmetry apart;
4 service tests pin the flag as independent of `status`.

- [ ] WhatsApp conversations in the inbox: the channel badge, and the three
  authorship voices (customer / AI / vendor) rendered apart. Blocked on the
  same routing — there is nothing to display yet.
- [ ] Real-time *incoming message* updates. The connection half is done; the
  message half needs the inbound path to publish something first.
- [ ] `schema.gql` was hand-edited for `setWhatsAppCustomerBot` rather than
  regenerated. Same gap as the stale-schema note under Back-end — nothing in
  CI runs `schema:check`.

### Settings panes server-preloaded — no more UI-then-data flash — 2026-08-24

The Shipping, Plan and Notifications panes rendered their chrome first and the
data popped in after a client fetch — they read with plain `useQuery`, which
does not suspend, so the SSR pass shipped the loading state (the storefront's
documented trap). Each section's server page now wraps its pane in
`PreloadQuery` and the readers are `useSuspenseQuery`, the same shape as the
storefront and the vendor reviews page. `SHIPPING_RULES_VARIABLES` is exported
from the shipping `api.ts` so the page and the pane can never drift on
variables. General needed nothing — `store/layout.tsx` already preloads
`GET_MY_SHOPS`/`GET_ME`.

- [ ] `LocationMappingCard` (shown only when an enabled carrier account needs
  branch mapping) still client-fetches its two queries — a residual pop-in for
  that one card. Preload is awkward because whether it renders depends on the
  accounts query; revisit if a carrier ships.

### Settings split into one URL per section — shipped 2026-08-21

The overlay was one route (`/settings`) holding twenty panes in local `useState`.
A vendor could not link a colleague to Shipping, could not open Brand in a new
tab, and lost their place on refresh. Now every section is an address:
`/settings/general`, `/settings/general/contact`, `/settings/general/brand`,
`/settings/plan`, `/settings/shipping`, `/settings/notifications`, and
`/settings/[section]` for the sixteen that are named but unbuilt. `/settings`
redirects to `general` and translates a legacy `?section=`.

The rail moved into `layout.tsx` so its filter box survives navigation, and its
entries are `<Link>`s — middle-click and open-in-new-tab work now. Which section
is active is read from `usePathname()` (`parseSettingsPath`) rather than held in
state.

The one thing that could not simply be split is the **form**: General, Store
contact details and Brand edit a single `updateShop` call. It lives in
`general/layout.tsx` (`GeneralFormProvider`) so it survives navigation between
those three URLs — one set of unsaved changes, one Save, as `AGENTS.md` requires.

- [ ] **Never seen in a browser.** No local database. Verified by `next build`
  (route tree confirmed), typecheck, lint and 532 vendor tests (12 new on the
  slug table and `parseSettingsPath`). Navigation feel and the breadcrumb want a
  real look.
- [x] **No render test for `SettingsShell`.** The rail's active-entry

      Done 2026-09-08: 15 cases pinning the rail's active entry per pathname, the heading and the breadcrumb.
  highlighting and the breadcrumb are derived from `usePathname()` and only
  covered indirectly, through `parseSettingsPath`.
- [ ] **The other 16 sections are still placeholders** — real URLs, no screens.
- [x] **Leaving the General group discards a staged edit with no warning.** The

      Done 2026-09-08: the app's first navigation guard -- a shared leave-guard store and useLeaveGuard, armed by the General group and written up as rule 5 in AGENTS.md. Browser Back/Forward is not covered; filed as its own box.
  provider unmounts and the save bar goes with it. A confirm-on-leave would need
  a navigation guard this app does not have anywhere yet.
- [x] **`?section=` is translated on `/settings` only.** A bookmark of the form

      Done 2026-09-08: the path stays the winner and legacySectionRedirect makes that honest -- a pure helper, with section never surviving into the query and every other parameter carried.
  `/settings/general?section=plan` keeps General, which is the right answer but
  is not obvious.

### Brand pane rebuilt as slots — shipped 2026-08-20

The Brand screen now follows Shopify's own layout: a header card with a drawn
storefront illustration and a "What should you add?" checklist, then one **slot**
per asset — a dashed tile, what the slot is for, and a single plus. Nothing opens
into an editor until it holds something, which is what lets two logos, two colour
pairs, two blocks of text and nine social networks fit one screen without
scrolling past six empty controls.

The shape is `brand-row.tsx` (`BrandGroup` / `BrandTile` / `BrandRow` /
`BrandAddButton`), reused by all four field components. Two behaviours are ours
rather than Shopify's: the checklist **ticks what is already set** and scrolls to
the group that fills it, and the colour slot keeps both halves of the pair — with
the WCAG contrast reading — behind one row, since the pair is the only thing
contrast can be checked on. Reveal state (which text slots are open, which social
rows are shown) is local and never staged, so pressing a plus raises no save bar.

- [ ] **Never seen in a browser.** No local database, so the empty-to-filled
  transitions, the upload menu and the colour popover want a real look.
- [ ] **The checklist ticks on presence, not on quality.** A 1-pixel logo and a
  low-contrast pair both read as done.
- [x] **The Logos card's media-library link opens a new tab** because navigating

      Done 2026-09-08: it opens the same in-place picker the slots already offer, so the staged edit survives.
  the current one would unmount the route group's form and discard the staged
  edit. A picker opened in place would be the better answer.
- [ ] **The header illustration is drawn, not designed.** Plain elements and
  tokens, no asset — it holds the layout but is not art.

### Brand settings pane — shipped 2026-08-20

Shopify's Settings > Brand, reached from the previously dead **Brand** row in the
General pane's Store assets card. Six groups: logos (default + square), cover
image, colours (primary/secondary, each background + foreground with a live WCAG
contrast reading), slogan, short description, and nine social links with brand
icons. It is a third view of the General pane's one `useForm`, so the single
contextual save bar still commits everything at once.

Four groups already had storage — `Shop.logo`, `Shop.cover_image`,
`Shop.description`, `ShopSocial`. The square logo, slogan and colours went into
`Shop.settings` (a `Json?` column), so no migration: new `ShopBrandInput` /
`ShopBrand` GraphQL types only.

Two back-end bugs fixed on the way, both latent before this pane existed:

- `settings` was written whole (`serializeJson(input.settings)`), so whichever
  screen saved last erased the others — a Brand save would have dropped the store
  address. Now `mergeSettings` patches key by key: omitted preserves, explicit
  `null` drops.
- `logo` / `cover_image` were guarded on truthiness, so an explicit `null` was
  silently ignored and removing an image did nothing while reporting success.
  Now `!== undefined` with `Prisma.DbNull`.

- [ ] **Never seen in a browser.** No local database. The upload/drag-drop path
  and the colour wells want a real look.
- [ ] **The front-end requires the merged back-end.** A Brand save against an API
  without `mergeSettings` erases `settings.location`. They must deploy together.
- [ ] **Uploading then discarding leaves an orphan attachment.** The file reaches
  `/attachments` before Save, same as product media. No cleanup job.
- [ ] **Only the accent pair is themeable.** Ground, ink, and the state colours
  (`--shop-sale`, `--shop-in-stock`) stay fixed on purpose — they carry meaning
  that is not a vendor's to redefine. A fully themed storefront is a bigger call.
- [ ] **The shop shell is still read twice per visit**, though both reads are on
  the server now: `fetchShopShell` (six fields, for metadata and brand colours,
  which must resolve before any markup is written) and the layout's
  `PreloadQuery` of the full `SHOP_BY_SLUG`. The RSC Apollo client this used to
  want now exists (`shared/apollo/rsc.ts`); what blocks collapsing them is that
  `PreloadQuery` streams rather than returning a value `generateMetadata` can
  read.
- [ ] **No alt text on brand images.** A logo's correct alt is the shop name,
  which is automatic; a custom one would mean adding `alt` to the shared
  `ImageInput`, which product media and collections also use.
- [ ] **Tumblr dropped, WhatsApp and LinkedIn added** relative to Shopify's list.
  A vendor with a network we do not render keeps it (carried through on save) but
  cannot edit it.

### Store contact details + store address, on bundled geo data — shipped 2026-08-20

The General settings pane's contact card is now two chevron rows instead of two
accordions: the first opens a **Store contact details** sub-pane (store name,
read-only account email, phone, website), the second an **Edit store address**
dialog (country, street, region, city, postal code). Both stage into the pane's
existing `useForm` — the contextual save bar is still the only thing that saves.

Address data is bundled rather than fetched (`apps/vendor/src/shared/geo/`): 250
countries with Arabic names from `dr5hn/countries-states-cities-database`, and
Saudi Arabia's 13 regions + 4,581 bilingual cities from
`homaily/Saudi-Arabia-Regions-Cities-and-Districts` (official `maps.address.gov.sa`
data). The 290KB city table is a lazy `import()`. `country` now stores an ISO2
code and `state`/`city` store English names; `resolveCountry` still matches the
display names older rows hold.

- [ ] **Never seen in a browser.** No local database, so verified by typecheck,
  lint and the full vitest run only. The 4,581-row city picker's feel under a
  real keyboard, and the Arabic search folding, both want a look.
- [ ] **No live address autocomplete.** Shopify's box is Google Places. The
  natural home is a `MAPS` type in the admin console's `integration_configs`
  (AES-256-GCM, same as the other providers) with Google Places or Mapbox
  Search Box behind it — bundled selects stay the fallback when nothing is
  configured. Google's $200 monthly credit ended February 2025.
- [ ] **No districts (أحياء).** The source dataset has 3,732 of them with the
  official SPL 11-digit `district_id`, which is what carriers actually want.
  Deferred: `ShopLocation`/`ShopLocationInput` have no field for it.
- [ ] **The address summary line shows the stored city, not a localized one.**
  Localizing it would mean pulling the 290KB Saudi chunk to draw one line.
- [ ] **The other Store defaults are still display-only** — currency, unit
  system, weight unit, time zone, order ID format, order processing.
- [ ] **Dataset licences want a decision.** The countries set is ODbL-1.0
  (attribution, share-alike on a publicly conveyed derivative database); the
  Saudi set's repo carries GPL-2.0 over what is public government data, and was
  last updated January 2022. Clean replacement for the Saudi half: generate the
  two files from the SPL Lookups API first-hand. Noted in
  `apps/vendor/src/shared/geo/README.md`.

### Collections rebuilt on Shopify’s source model — shipped 2026-08-19

The manual-vs-automated **mode** is gone. A collection now draws from one or more
**sources** (a Products source selecting by condition, a Collections source pulling
in the members of other collections), each with its own **exclusions**, and any of
them can also hold hand-picked products. Sources union; exclusions win over
everything, conditions and hand-picked alike. `collections.type` survives as a
**derived label**, recomputed on every write, so every old consumer keeps reading
something true.

**Rules v2** (`{ version, sources[] }`) replaces `{ match, conditions }`; v1 rows are
lifted on read by `normalizeRules` and rewritten on the next save, so nothing had to
be migrated in place. A condition now holds several **OR-ed values** on one row (a
negative operator AND-s the negations, so “is not A, B” means neither), and the field
list grew to Shopify’s: title, category, kind, vendor, tag, status, sale type, price,
sale price, inventory, weight, metafield. Budgets: 60 conditions, 10 sources.

**Where the two halves of membership live is the load-bearing decision.**
Hand-picked products are `collection_products` rows with `pinned = true`; manual
exclusions are in the JSON. A curated collection of thousands is then rows rather
than a JSON blob, two concurrent adds cannot clobber each other, and the product
form’s own collections field keeps working — it just goes through
`setProductCollections` now, so what it writes is pinned and the sync leaves it
alone. An exclusion has no row to live on, which is why it is the half that is JSON.

**`previewCollection` is what makes the editor honest**: it compiles the staged rules
and pages products through them without writing anything, so the vendor sees what a
condition brings in before saving it. Everything is expressed relationally — the
pinned set is an EXISTS over the collection’s own rows — so paging and sorting stay
in Postgres and no path materialises a list of ids.

Also new: `sort` (Shopify’s Default sort), `seo_title` / `seo_description`,
`is_published`, `collectionItems`, `reorderCollectionProducts`, a `search` argument
on `collections`, and a resolved `pinned_product_ids`. The vendor screen is one
editor for create and edit (`/products/collections/[collectionId]` is new), fully
localized under a new `collections` i18n namespace.

Green: back-end build, `schema:generate`, `check:di`, 3878 tests (44 collections);
vendor typecheck, lint (0/0), 491 tests; storefront + admin codegen and typecheck.

- [ ] **Run `prisma/migrations/manual/2026-08-19-collection-sources.sql` before the
      deploy.** The columns are additive and `db push` handles them; the `pinned`
      backfill is the part it cannot do, and without it hand-curated membership from
      before v2 reads as stale rule output. Two guards make a forgotten run degrade
      rather than destroy (the sync deletes nothing when the rules select nothing,
      and the first save adopts the rows), but a product edit can reach the sync
      first — do not rely on them.
- [ ] **Never seen in a browser.** No local database, so verified by typecheck, lint,
      tests and reading only.
- [ ] `sort: MANUAL` is stored, read and reorderable through the API, but the items
      panel has no drag affordance — the app ships no dnd library.
- [ ] No theme-template picker (the storefront has no templates) and no channel
      picker (the storefront is the only channel), so publishing is a plain
      Publish/Unpublish action rather than a channel list.
- [x] The SEO card previews a path, not a URL. The header's View/Copy link do build
      a full one from `NEXT_PUBLIC_STOREFRONT_URL`; wiring the SEO preview to the
      same origin is follow-up work.

      Done 2026-09-08: the preview renders the full URL on the storefront origin, the same one the header's View and Copy build from.
- [x] **Editor trim, 2026-08-20** (asked for against the Shopify reference): the
      "Add to collection" panel heading, the "{used} of 60 conditions" counter and
      the Arabic-fields collapsible are gone, and the publish switch moved to the
      title row. Two gaps left behind: Arabic title/description and the cover's alt
      text have no input on the screen (existing values are preserved on save), and
      the 60-condition cap is now only reported by the API's save error.

      Done 2026-09-08: the Arabic title and description are back through the product form's language pill (mounted on the editor's own route, inherited when embedded), the cover has an alt input, and the 60-condition budget is shown and enforced client-side instead of only by the save error.
- [ ] The storefront has no collection route, so "View" links to its catalogue
      filtered by collection id rather than to a collection page.

### Vendor shipping screen — shipped 2026-08-19

Settings → **Shipping and delivery** is now a real pane (`apps/vendor/src/features/shipping/`). It was the root cause behind the checkout bug below: the six shipping mutations shipped with the API and **nothing in any frontend called them**, so every shop on the platform had zero zones and zero rates and could not quote delivery to any address.

The pane lists zones (destinations + their rate bands) and the flat rates that carry no zone, with create/edit/delete dialogs for both. Adds **no back-end** — all six mutations and both queries already existed. The one addition is `currency` on the `myShops` query (the field went onto `Shop` earlier today for the storefront) so amounts render in the shop's own currency instead of the `formatMoneyCents` default.

What makes it more than a CRUD list is that it surfaces three behaviours of `selectShippingRule` that are invisible from the rows and each of which silently zeroes a delivery fee: **zones win absolutely** (one zone and every unzoned rate stops being consulted — those are shown dimmed as "not charged" rather than hidden), **a zone set with no catch-all is a wall** (flagged as an error, because that is the shape that produces "can't ship to that address"), and **only the newest rate on a zone applies** (`zone.rules[0]` after `created_at desc`, so a second rate is dead weight). `lib/zones.ts` holds all of it as pure functions with 21 tests.

Green: vendor typecheck, lint (0 errors), 474 tests across 38 files, `next build`. Docs: `apps/vendor/docs/features/shipping.md` + index row; `settings.md` updated (four panes built, not three).

- [ ] **Never seen in a browser.** Verified by typecheck, lint, tests and build only — the pane's layout inside the settings overlay, the diagnostics callouts, the country picker in a nested dialog and the RTL rendering are all unverified by eye.
- [ ] **No zone has ever been created against a real API.** The mutations are wired from the schema and the input shapes are unit-tested, but no round trip has happened, so nothing confirms `name` as a multilang blob or `countries` as alpha-2 codes is what the service actually accepts.
- [ ] **`ahmed-electronics` still has no shipping configured** — the screen now exists to fix that, but the shop is still in the state that made checkout look broken.
- [ ] **States/regions are not editable.** `ShippingZone.states` refines a zone within its countries and the pane renders it, but the dialog has no input for it — it needs a per-country region list the app does not have.
- [x] **No guard against a second catch-all.** Two zones with empty `countries` are both catch-alls and `priority` decides between them; the pane neither prevents nor warns about it.

      Done 2026-09-08: the zone dialog derives the conflict during render, names the existing catch-all, disables Save and refuses submit, so Enter cannot bypass it; a pair that already exists is reported as a diagnostic.
- [x] **Deleting the last rate on a zone is allowed** and leaves a zone that matches orders and quotes nothing. The delete dialog says so, but nothing stops it.

      Done 2026-09-08: blocked in the delete dialog, which offers deleting the zone instead. The copy was wrong too -- checkout refuses such an order rather than quoting nothing -- and now says so.
- [ ] **The `is_global` flag is not exposed.** Platform-wide zones and rates exist in the schema (`is_global`) and only an admin should set them; the vendor pane always creates shop-scoped rows, which is correct, but nothing in the admin console manages the global ones either.

### Vendor reviews screen — shipped 2026-08-17

`/store/[shopSlug]/reviews`, in the sidebar under Customers → Reviews. Back-end adds two ownership-gated queries to `src/reviews/`: `shopReviews` (product/rating/search/sort filters, server-paged, resolves the reviewer, the product and the photo URLs) and `shopReviewsSummary` (average, the 5→1 distribution, plus with-photos / last-30-days / reported counts). Both are new operations rather than arguments on the public `reviews` query, which runs behind `OptionalJwtGuard` and would have made the reviewer's email anonymously readable. Frontend is `src/features/reviews/` — summary card whose distribution bars *are* the rating filter, throttled search, and a report-to-platform dialog. `reviews.resolver.spec.ts` (`describeGuardChain` + an explicit `publicOps` list) and `reviews.service.spec.ts` (15 back-end tests), 12 vendor tests; schema regenerated, codegen re-run, typecheck + lint green on both sides.

- [ ] **Never seen in a browser.** Verified by tests, typecheck and lint only — the summary card's proportions, the photo thumbnails, the RTL layout and the dark-mode chrome are unverified by eye. The distribution bars in particular have only been asserted on, not looked at.
- [ ] **The database has no reviews**, the same emptiness that blocks the boneyard capture below, so the screen renders its empty state against real data today. Seeding orders and reviews is what would make it judgeable.
- [x] **No product filter in the UI.** `shopReviews` accepts `product_id` and the query passes it through, but nothing on the screen sets it — a product picker is the obvious next control, and the product chip on each row would be the natural place to hang "show only this product".

      Done 2026-09-08: a live-search product combobox on the toolbar plus a show only this product action on each row, with the toolbar chip carrying the selection.
- [ ] **Search does not match the product name.** `Product.name` is an unindexed multilang JSON blob, so matching it means a full scan per keystroke. If product-name search is wanted, it needs a generated column or the existing `search_vector`.
- [ ] **`with_photos` misses legacy rows.** It counts reviews with at least one `ReviewPhoto`; a row whose photos still live only in the deprecated `Review.photos` column is not counted, even though the list renders its photos via the fallback. Correct once the backfill finishes — worth deleting the fallback and this note together.
- [ ] **The merchant cannot reply to a review.** There is no reply column on `Review` and no mutation for one, which is the first thing a merchant will ask for after reading a one-star. It is a schema change plus a storefront surface, so it was left out deliberately.
- [ ] **Reporting has no duplicate guard.** `createAbusiveReport` writes a row every time, so a merchant can report the same review repeatedly and drive `abusive_reports_count` up on their own. Nothing in the admin console surfaces reports against reviews yet either, so a report currently lands in a table no screen reads.

### Sidebar plan card now always visible — 2026-08-17

`PlanStatusCard` returned `null` for `subscriptionState` `current`, so a paying, up-to-date store saw an empty sidebar footer and had no in-app answer to "what am I on and when does it renew". It now renders in all five states: `current` shows `yourPlan` / the localized plan name / `renewsOn` as quiet text with **no** button, a scheduled downgrade outranks that date (`changesOn`), and the line is dropped when there is no `current_period_end`. No new i18n keys — `yourPlan`, `renewsOn` and `changesOn` already existed in the `plan` namespace. `plan-status-card.test.tsx` (7 cases) pins which sentence each state gets; typecheck and lint green.

- [ ] **Never seen in a browser.** Verified by test, typecheck and lint only — the card's fit in the dark sidebar footer and the Arabic/RTL line lengths are unverified by eye.

### Vendor signup wizard + admin OTP settings — shipped 2026-08-10, follow-ups below

`/register` is now the four-pane wizard (email → name/phone → one-time code → store), backed by the new `back-end/src/vendor-signup/` module. Code length, lifetime, cooldown, attempt/daily caps, lockout and delivery channel are admin-controlled from the console's new `/settings/otp` screen and read by `OtpService` on every send. Docs: `apps/vendor/docs/features/signup.md`, `back-end/docs/features/vendor-signup.md`, `back-end/docs/features/otp.md`, `apps/admin/src/features/otp-settings/README.md`.

- [ ] **Unset `ALLOW_SANDBOX_EMAIL_SENDER` before launch.** It is on for pre-launch testing so `onboarding@resend.dev` can be used; with it set, nothing warns that customers are not receiving mail — the 550 lands in a queue worker. Removing it re-arms both guards (`resend.verify` and `assertEmailDeliverable`).
- [ ] **Resend still cannot mail anyone but the account owner.** The `integration_configs` EMAIL row (provider `resend`, enabled, last saved 2026-08-09) still has `from = onboarding@resend.dev`, Resend's sandbox address: it authenticates fine and then 550s every recipient except the account owner, so codes are generated and never delivered. **Fix:** verify a domain at resend.com/domains, then set the Resend **From address** to an address on it in Admin → Integrations → Email. Note `assertEmailDeliverable` now *refuses* `startVendorSignup` while this sender is configured, and `sandboxSenderDomain` blocks re-saving it — deliberately, so the failure is visible instead of silent, but it does mean signup stays hard-blocked until the From changes.
- [ ] **SMS is not a fallback for testing.** The enabled SMS provider is `console`, which writes the message to the server log rather than sending it — so switching Admin → OTP settings → channel to SMS moves the code to Render's logs, it does not deliver it. Configure Twilio (or read the code from the log) if email stays blocked.
- [ ] Verify SMS actually delivers on the target market's numbers end to end — the wizard is unusable if the code never arrives, and the current gateway config is untested for signup traffic.
- [ ] Live availability check on the store link before submit — today a taken slug is silently resolved to `my-store-1` after the fact.
- [ ] Social sign-up (the reference design's Google button) has no back-end; the email pane offers "sign in with a code" in that slot instead. Revisit if OAuth is ever added.

### Settings → Plan is a pane again — shipped 2026-08-14

Clicking **Plan** in the vendor settings rail opened `/plan/{slug}` and threw the vendor out of the overlay. It is now a pane in Shopify's shape — plan name, state badge, price and next date on one row, with cancel/keep and choose/change plan beside it, plus a Subscriptions card pointing at the billing tab. `PlanSettingsSection` lives in `features/plan/` and reuses `PlanAlert`, `useSubscriptionLifecycle` and `useBillingPortal`; `SettingsCard` is now shared with General. `?section=plan&billing=…` still forwards to `/plan/{slug}` so a payment is acknowledged where the webhook poll runs. Docs: `apps/vendor/docs/features/settings.md`, `apps/vendor/docs/features/plan.md`.

- [ ] No dedicated "active subscriptions" screen. Shopify lists the platform subscription and paid app subscriptions separately; the pane's row links to the billing tab instead. Worth revisiting only if paid add-ons are ever sold — there is nothing else recurring today.
- [ ] Cancellation is one confirm dialog, not Shopify's multi-step wizard (reasons, "start a new store", the pre-cancel checklist). Nothing collects a cancellation reason, so churn is unattributed.

### Content > Files — Shopify list, replace/copy-link, image editor (2026-07-18)

- [ ] **Multi-source studio runs.** The mockup showed three source slots; `enhanceImageShots` takes one `attachmentId`, so the picker deliberately holds one image rather than implying capacity that does not exist. Unblocking it is the `referenceAttachmentIds[]` item below — flux-2-pro accepts up to 8 `input_images`, and that is what makes product/character consistency across a run possible.
- [ ] **Text-to-image tab in AI Studio.** `generateProductImage` with `mode: TEXT_TO_IMAGE` (flux-schnell) is live and genuinely source-less, but it is only reachable from the product form's `AiImagePanel`. Surfacing it in the studio needs its own prompt vocabulary — the enhance rail's every control assumes a photo, and its prompts open with "use the uploaded image as the only source of truth" — plus a `requestId` for idempotency, which the generate path does not have.
- [x] **The detail sheet for non-image files is still local state.** Only images got a route; a PDF or video still opens a side panel driven by `detailId`, so it is not linkable and `/content/files/:id` for one renders `FileViewUnavailable`. Give it `?file=<id>` on the list route if it ever needs to be shared.

      Done 2026-09-08: ?file=<id> on the list route is the source of truth, a deep link resolves a file that is not on the loaded page, and the view route redirects a non-image there instead of dead-ending.
- [ ] **Reference media by `attachment_id`, not URL (the real fix).** The sweep above is a workaround for denormalized URLs. The stored media shape already carries `id` (`{id, original, thumbnail}`), so the migration path exists: resolve `original`/`thumbnail` from the `attachments` row at read time and stop trusting the copied URL. Then changing `attachment.url` needs no sweep at all. Cross-cutting (~20 modules + storefront) — do it before the catalogue gets large.
- [ ] **`attachmentUsage` under-reports.** It scans only `products.image`/`gallery`, capped at 1000 rows, matching `.original`. It misses ~25 other referencing columns, so the "Used in" panel understates a file's blast radius. Rebuild it on `ATTACHMENT_URL_REFERENCES`.
- [ ] **Move the replace sweep to a background job if it gets slow.** It runs 27 sequential scans synchronously inside a 30s transaction, with no index on any URL column. Fine at current scale; revisit when `order_products`/`products` grow.
- [ ] **Infra: enable CORS on the Bunny staging pull zone (`artam-staging.b-cdn.net`).** It sends no `Access-Control-Allow-Origin`, so the image editor's `fetch(..., {mode:"cors"})` fails and pixel edits can't be exported (viewing still works via the `<img>` fallback). Add the app origins (or `*`) to the pull zone's CORS headers to match prod.
- [ ] **Data: existing files stored as `.bin` keep the wrong Content-Type.** The upload fix only applies to new uploads; old `.bin` objects on the CDN still serve `application/octet-stream`. Re-upload or run a one-off migration (rename storage object + fix `filename`/`path`/`url`) if the historical files must render/edit correctly.

### Shopify Notifications parity — rebuild `notify-logs` bell into the Settings→Notifications console

Plan artifact + decisions locked (LiquidJS, per-shop verified sender, single-snapshot revert, Twilio SMS, grow webhooks + UI). **Correction (2026-07-11):** the header **notification bell is kept** — Shopify has one in its top bar (activity feed). What gets replaced is the old *settings-hub* inbox/preferences tabs, which are consolidated into the Settings→Notifications email console. (Earlier notes said "retire the bell"; that was wrong and was reverted.)

- [~] **P2 — event catalog (in progress)** — 11 of 17 catalog templates now fire live via `NotificationDispatchListener`:
  - **Order lifecycle:** `order.cancelled`→order_canceled, `order.completed`→order_completed; new best-effort `refund.processed` (from `updateRefundStatus` on APPROVED) → order_refund (with `refund_amount`).
  - **Shipping (2026-07-10):** new best-effort `shipment.updated` event (from `ShipmentsService.updateStatus`) → shipping_confirmation (shipped) / out_for_delivery / delivered, or shipping_update (tracking changed). Injected `EventEmitter2` into ShipmentsService.
  - **Returns (2026-07-10):** new best-effort `return.status.changed` event (from `createReturn` + `updateReturnStatus`) → return_requested / return_approved / return_declined. Injected `EventEmitter2` into ReturnsService.
  - 15 dispatch tests; shipments/returns specs updated for the new dep; backend build + typecheck clean.
  - **P2 automatable set = DONE (2026-07-10).** The remaining 6 templates are editable/previewable but intentionally NOT auto-wired, because they have no clean trigger in this system (documented in `catalog/event-registry.ts`): `order_invoice` is manual like Shopify (outstanding-balance, not on payment); `account_welcome/invite/password_reset` don't fit our OTP/SMS auth (welcome=direct mail, invite=SMS magic-link, reset=OTP code not link); `store_credit_issued` has no standalone flow (wallet credit comes via cancel/refund which already notify); `back_in_stock` still uses the legacy inline `fireRestockNotifications` send. Revisit `back_in_stock` migration + account templates if/when auth moves to link-based flows.
- [~] **P3 — staff notifications (in progress, 2026-07-10)** — new `staff-notifications` module: `StaffNotificationRecipient` model (per shop, `events[]`, `enabled`) + migration (applied); recipient CRUD resolver (list/add/update/remove, X-SHOP + MANAGE_OWN_SHOP, audited); `StaffNotificationsListener` emails every subscribed recipient a new-order summary on `order.created` (wrapped). Vendor `StaffNotificationsCard` (add/remove/toggle) mounted in the console; en/ar i18n. 6 backend tests + typecheck + build + boot clean; vendor typecheck + 16 tests green. Docs: `staff-notifications.md` + `api/` + READMEs + vendor doc. Added (2026-07-11): `new_return` staff email on `return.status.changed` (requested); `sendTestStaffNotification` mutation + Send-test button; shared `staff-email.ts` builders. 10 backend staff tests green. **Remaining P3:** Store order summary digest (weekly/daily schedule), fulfillment request template, per-event checkboxes in the UI, merchant-editable staff template.

Analytics UI/UX Shopify redesign shipped 2026-07-07 — open follow-up:

- [ ] Follow-up (deferred by user, front-end-only for now): back-end support for named comparison presets (Previous year / match day of week) + real multi-currency conversion. The comparison dropdown currently maps to the existing boolean and the currency chip is display-only.

#### Notifications review (2026-07-09) — **re-verified against the code 2026-07-21**

Most of this list was already closed by later work and the checkboxes were never updated. Status below is from a direct read of `back-end/src/notify-logs/` and `apps/vendor/src/features/notifications/`, not from the original audit.

P1:

- [~] N6 Missing producers — **mostly done.** The listener now covers 12 events across ORDER / REFUND / PAYMENT / INVENTORY / REVIEW / STORE_NOTICE, `order.completed` **is** consumed (:262), and `receiver: 'admin'` **is** written (`dispute.opened_admin` :420, global store notices :322). **Residual:** `NotifyType.MESSAGE` and `SYSTEM` still have no producer — nothing for contact messages or platform/account notices. `MESSAGE` is deliberately excluded from the FE preferences matrix until one exists.
- [~] N10 In-app only — **email channel done, push still open.** `NotifyLogsService.create` honours the per-type `email` preference and queues `SEND_NOTIFICATION_EMAIL`. No web-push/APNs channel.

P2 (cleanup):

- [~] N17 Test coverage — back-end now **54** across 4 spec files (+4 retention tests in the processor spec). Front-end now **29**: bell (6), inbox (8), preferences (6), `hrefFor` (5), `reconnectDelayMs` (4). **Still untested:** `use-notifications-stream.ts` itself (ticket handshake, `EventSource` lifecycle, cleanup).

## Storefront

### The footer is rebuilt to the reference layout, and it is a light slab — 2026-09-07

Five columns — Contact us, Shop, Account, About, newsletter — over a record row
(language, the shop's lockup, the payment routes) and a legal line. The four
left columns were `Collapsible`s with a chevron, as the reference has them, and
were flattened: a column of four short links has nothing to gain from being
closed, and the control cost a press to get back what was already on screen. The ground inverted with
it: the near-black slab was the loudest surface in the app at the foot of every
route, doing one job — telling a shopper the document had ended — that a white
`--card`-on-`--background` step plus a top hairline does just as well, and at
page-body contrast rather than the reduced ratios an off-white on ink can reach.
The `--shop-footer-*` tokens kept their names because `brand-theme.ts` writes
two of them from a vendor's secondary brand colour.

The reference has slots this app has no routes for — FAQs, order tracking,
returns, press, three legal pages — and none of them were invented. Where a slot
could be honoured from a real catalogue view it was (`?sort=MOST_VIEWED`,
`?stock=in`, the URLs `catalog/lib/filters.ts` already writes); the rest are
absent. The payment row names `CASH_ON_DELIVERY` and `STRIPE` rather than card
schemes, because which schemes a merchant's Stripe account takes is not a fact
this codebase holds.

Rebuilding it surfaced a real bug in two places: `settings.contact` is the
vendor dashboard's **"Phone number"** and `settings.email` its "Store contact
email", and both the footer and `HomeStory` were `mailto:`-ing the phone — so
the contact link and the newsletter addressed mail to something that cannot
receive it. `lib/contact.ts` now holds `telHref` and the warning, and
`SHOP_BY_SLUG` selects `settings.email`.

- [ ] Give the newsletter a real back-end. There is no subscribe operation on
      the API, so the field composes a `mailto:` to the shop and says so; when
      an operation lands, only `NewsletterPanel` changes.
- [x] Nothing validates `settings.email` as an email or `settings.contact` as a
      phone on the vendor side, so a vendor can still swap them. Add format
      validation to the Store contact details pane.
- [ ] No shop-authored policy pages exist (returns, terms, privacy), so the
      footer's legal line carries only the copyright and "Powered by Zaydak".
      Decide whether policies are a vendor-authored field or a platform page,
      then add the links.

### The heart works signed out, and signing in keeps it — 2026-09-07

The wishlist twin of the guest-cart handover, and the reason it is a separate
entry is that the two started from opposite places. The cart already had a
signed-out mode and was missing the handover. The wishlist had neither, on
purpose: `WishlistButton` sent a signed-out visitor to the sign-in screen, and
the code said why — "a locally-staged wishlist would be lost the moment they
did sign in, which is worse than an honest detour". That was a fair call while
nothing carried a staged list over. `adoptGuestCart` proved the carrying works,
which removed the premise rather than argued with it.

**`localStorage`, not a `session_id` column.** Mirroring the cart exactly would
have meant a migration — `Wishlist.user_id` is non-nullable with
`@@unique([user_id, product_id])` and there is no `session_id` — to buy
per-browser persistence, which is all a guest can have anyway. The cart lives
server-side because it needs pricing, stock reservations and checkout; a
wishlist is a list of ids. So the guest list is browser-side, keyed per shop,
and the only back-end change is one additive filter: `ProductFilterInput.ids`,
so the saved-items page can rehydrate staged ids into rows. Safe to expose
publicly because it only narrows — `applyVisibilityScope` has already pinned
`status = PUBLISH` and an active shop, so an id naming a draft returns nothing.

**The sharp edge was that `toggleWishlist` is a toggle, not an add.** Replaying
the staged list onto an account would have *removed* every product it already
had — the same shape as syncing an empty cart, and quieter, because it looks
like nothing happened until a favourite turns up missing weeks later. So
`adoptGuestWishlist` reads `wishlists` first and sends only the difference, and
sends nothing at all if that read fails. It clears storage only for what landed.

**Opening the feature meant opening the route.** `wishlist` was in
`PRIVATE_SEGMENTS`, so a guest could have saved items and then been bounced to a
sign-in screen when they went to look at them — the feature working and its own
page refusing to show it. It moved out, and had to be named in `robots.ts`
explicitly, which derives its disallow list from that same array: public but
per-visitor, exactly like `/cart`.

- [x] **The staged list is never pruned.** A product that is deleted or
  unpublished silently stops appearing on the page (`storefrontProducts` does
  not return it) but stays in `localStorage` forever, and is retried on every
  sign-in. Harmless, but the list only grows. — Resolved **2026-09-09** in two
  halves. The back-end had shipped the `ids` filter but ignored it, so the saved
  page was never even rendering the staged ids — it answered with the shop's
  newest page. `findAllStorefront` now delegates an `ids` query to
  `findManyStorefrontByIds` (given order, no paging, visibility-only), which
  makes the rehydration real. And the page prunes: on a resolved `data` it keeps
  only the ids the server returned (`pruneGuestWishlist` also added to the
  store), and the effect reads `data` before it fires so a loading query or a
  network error can never read as "everything is gone".
- [x] **No variation is staged.** A signed-out heart on a VARIABLE product saves
  the product id alone, so "move to cart" from the saved-items page is rejected
  server-side with the back-end's own message. Signed in it carries the
  variation. Worth staging the option id too, or hiding the button.
- [x] **The handover is silent, like the cart's.** Nothing tells a customer that
  the hearts they left signed-out are now on their account. — Resolved
  **2026-09-09**: `adoptGuestWishlist` arms a `wishlist.merge.notice`
  `sessionStorage` flag when anything moved, and `WishlistPage` reads-and-clears
  it into a dismissible banner (the cart notice's restore-after-hydration
  pattern). The staged list IS the retry, so only the notice was needed; a
  partial failure arms it too, because the moved hearts prove the handover
  happened.
- [ ] **Nothing merges across browsers.** Two devices staging different hearts
  and signing into the same account keep whichever list each browser held; there
  is no conflict to resolve, but also no sign that the other existed.

### The signed-out cart survives signing in — 2026-09-07

A guest filled a cart, pressed checkout, signed in — and the cart was empty.
Nothing had gone wrong at the point it looked wrong: the items were still in the
database the whole time.

**The mechanism is one branch.** `CartRepository.getOrCreateCart` takes
`user_id` when there is one and **never looks at `session_id`** in that case. So
a token does not merge the guest cart or empty it; it makes it unaddressable.
The row sat there holding its stock reservations until the reaper expired it,
and from the shopper's side the basket vanished at the exact moment they did
what the checkout had asked them to do.

**Almost all of the fix already existed and had never been called.**
`CartSyncService` has done this merge — releasing the guest holds, wiping the
user's items, re-reserving under the user cart, all in one transaction — since
it was written, and its own docblock says it is "invoked once on successful
login if the frontend held a session cart". `syncCart` is exposed on the schema.
Grepping the storefront for it returned nothing but generated types. The
WhatsApp claim link had quietly become the only door into it
(`CartClaimService.adoptCart`), which is why the chat path worked and the
ordinary one did not.

`adoptGuestCart` is the missing call, in `LoginForm` and `RegisterForm`, between
`setTokens` and the navigation — before it there is no token to sync with, after
it the cart is already gone.

**The dangerous half was not calling it but bounding it.** The merge is
destructive on the user's side by design ("the cart you were composing
logged-out wins"), so `items: []` is a *delete*. Wiring it up naively would have
traded a vanishing guest cart for a worse bug: a returning customer who browsed
without adding anything would lose the cart they left last visit. Hence the
empty guard, and hence a function with tests rather than three lines in a form.
The guest cart is also read with `authorization: ""` — the session cookie is
already written by then, so an ordinary read returns the account's own cart and
the merge syncs it onto itself.

- [x] **Only the two password forms call it.** Any other way into a session —
  the magic link, an OTP screen, a social login — has to call `adoptGuestCart`
  too or it reintroduces the vanishing cart. Worth moving into `setTokens` if a
  third caller appears; it is not there now because `setTokens` is also what the
  claim screen calls, and that path has already merged its own cart. "A third
  caller" does not exist today: the storefront's only session-entry points are
  `LoginForm`, `RegisterForm` and the already-self-merged claim screen (2026 QA
  sweep). Re-check if a magic-link or OTP sign-in screen is ever added.
- [x] **The merge is silent.** A customer whose account cart was replaced by
  their guest cart is told nothing, and neither is one whose quantities were
  clamped to stock by the sync. A line on the cart page after a merge would
  cover both. Done 2026-09-08: `adoptGuestCart` arms a `cart.merge.notice`
  session flag on a successful merge and `CartPage` shows a dismissible line.
  The clamp half still wants server-reported per-line clamps — `CartSyncService`
  only reflects them in the rebuilt envelope — and remains a follow-up.
- [x] **Nothing reconciles a merge that fails.** `adoptGuestCart` swallows the
  error so a failed merge is not a failed login, but the guest cart is then
  orphaned exactly as before — including when the 5/60s throttle on `syncCart`
  is what refused it. A retry on the next cart read would close it. Done
  2026-09-08: a failed merge arms a `cart.merge.pending` flag that
  `useAdoptRetry` (mounted once by `ShopShell`) consumes on the next signed-in
  page load; a success clears it and arms the notice, an empty guest cart
  clears it, a still-throttled retry re-arms it.

### A storefront session belongs to one shop — 2026-09-07

Signing in at `/acme` used to sign you in everywhere. The cookies were flat
(`shop_access_token`), the auth store held one session, and the access token
carried nothing about a shop — so walking to `/beta` sent Acme's token with
`X-SHOP: beta` and the back-end accepted it. The same account could act on any
storefront off a single sign-in.

**The boundary is the back-end.** `refresh_tokens` gained a nullable `shop_id`,
the access token gained an optional `shop_id` claim, and `ShopHeaderGuard` — the
one place holding both the caller's session and the *resolved* shop row — throws
`SHOP_SESSION_MISMATCH` on a mismatch. It is sourced from headers rather than an
input field, so nothing on the GraphQL wire changed: no DTO field, no
`schema.gql` delta, no codegen, and the API could ship alone and invisibly ahead
of the storefront. A session binds when the request carries `X-STOREFRONT: 1` or
the account's role is `customer` — both halves are needed, because the vendor
dashboard also sends `X-SHOP` on its own login (from a 30-day `active_shop_slug`
cookie), and role alone would leave a vendor shopping on a storefront holding a
platform-wide session. `buildAuthResponsePublic` takes the shop id as a
*required* parameter so a mint path added later cannot default open.

**The client half is containment, not security.** The four session cookies are
per-shop *names* at `path:"/"` (`shopCookieKey` normalises a slug that is not a
valid cookie token rather than rejecting it — `slugify` returns `""` for a
CJK-only shop name, and rejecting would be a shop nobody can sign into). The two
auth handlers learn the shop from `?shop=`, the one channel a body-less DELETE
and a body-less refresh POST both support. `routeDecision` needed no new state:
"signed in at another shop" and "signed out here" both read as no cookie.

Three adjacent bugs that per-shop sessions would have multiplied were fixed in
the same change: the hourly silent sign-out (`hydrate` now spends the gap
between the access cookie's hour and the refresh cookie's seven days), sign-out
never revoking the server session, and login-CSRF on the session route.

- [ ] Close the default-open path: seven days after the back-end deploy (the
      longest refresh-token life), `ShopHeaderGuard` can reject a `customer`
      token carrying no `shop_id` on a request that resolved a shop. One line,
      no migration. Until then a hand-crafted `login` with no `X-SHOP` still
      yields an unbound token.
- [ ] Decide eviction vs refusal at `MAX_SHOP_SESSIONS = 4`. Signing into a
      fifth shop currently evicts the least recently used silently (logged
      server-side by slug). Refusing is more honest but puts a wall in front of
      someone trying to buy something.
- [ ] Magic links are only conditionally bound — the vendor dashboard's
      `FRONTEND_URL` sends no `X-SHOP`, so a link redeemed there is a
      platform-wide customer session. `MagicLink` has no shop column.
- [ ] A shop rename signs its customers out of that one shop: the claim is the
      shop id and survives, but the cookie *name* carries the slug.
- [ ] Operations outside `ShopHeaderGuard` are not covered — `wishlists`,
      `myAddresses`, `cancelOrder` resolve no shop, and the `faqs`, `reviews`,
      `customer-segments` and `languages` controllers read `x-shop` raw. Decide
      whether any of them should be.
- [ ] Store credit is account-wide (`Wallet.customer_id` is `@unique`), so
      credit earned at one shop is spendable at another. Splitting it is a
      migration plus a rule for dividing existing balances.
- [ ] Open tabs across the storefront deploy POST `/api/auth/session` with no
      `?shop` and get a 400; the form shows a generic error until a reload.
      Consider a build-id check that prompts one.

### Checkout honours the quote's `unavailable_products` — 2026-09-07

Placing an order died on `[GraphQL Error] Validation failed | operation:
StorefrontCreateOrder | code: VALIDATION_ERROR` with nothing else on screen or
in either log. The cause: **the cart and the quote refuse different sets of
lines, and the screen only knew about the cart's.** `CartItem.status` is a
check against `product.quantity` — a shop-wide total — while `verifyCheckout`
then runs the allocation engine over the shop's locations and can reject a line
the cart called `AVAILABLE`. `checkout-page.tsx` selected `unavailable_products`
in its query and read none of it, so it re-sent the line from the cart's own
`orderable` list and `createOrder` threw `ORDER_NOT_ALLOCATABLE` behind a
generic "something went wrong" toast naming no item.

Confirm order is now disabled while the quote reports any unavailable line, and
the existing "Some items are unavailable" notice lists them by name — the
verdict is invisible on the cart screen, so a count alone left the customer
guessing which item to remove. The list is deliberately not subtracted from the
next verify request: a line dropped from the input is not reported unavailable,
so the set would empty, the line would return, and the two states would
alternate every round trip. `lib/blocked-lines.ts` holds the two pure helpers
and `lib/__tests__/blocked-lines.test.ts` pins them.

Both logs were also blind. Every `AppException.validation` — the DTO pipe and
the ~40 business rules that reuse it — carries the same `Validation failed`
message, so the code and the message together identify nothing; the
field/code/messages triple in `extensions.validation_errors` is the only part
that says which rule refused, and it was dropped by the storefront's error link
and by the back-end's `QueryTraceInterceptor` alike. Both now log it.

- [x] The admin console's `shared/apollo/links.ts` has the same one-line blind
      spot (it is a copy of the storefront's); the vendor's logs `err.message`
      only. Carry the `validation_errors` line into both.
- [x] `createOrder`'s catch still toasts the raw `Validation failed`. Surface
      the first `validation_errors` entry instead, so a race that slips past
      the new gate still names what failed.
- [x] No render test covers the checkout page itself — the gate is pinned only
      at the helper level. One would need Apollo, next-intl, shop context and
      cart mocked. — Resolved 2026-09-09: 5 render tests in `features/checkout/components/__tests__/checkout-page.render.test.tsx`.

### The language switch moved into the menus, as a segmented control — 2026-09-07

It was a globe that opened a dropdown. Inside the account menu and inside the
notch panel that would have been a menu opening out of a menu — base-ui needs
`Menu.Sub` for that, and a two-item language choice does not earn a submenu. The
vendor dashboard hit the same wall and answered it with a dialog: one more
surface, two more clicks.

`LocaleSegmented` is the answer here. Both languages are on screen, so there is
nothing to open to find out what the alternative is, and switching costs one
press. Each segment carries its own `lang`, which is what makes العربية render in
the Arabic face while the interface is still English — and what stops a screen
reader spelling it out in English phonemes. The segments are plain buttons, not
`DropdownMenuItem`s, because an item closes the menu on press and the whole
value of switching from in there is watching the panel flip script under you.

The geometry generalises past two locales — the thumb is `100% / n` wide and
travels in whole multiples of itself — and the travel is multiplied by a
`--seg-dir` variable that `rtl:` negates, because `translateX` is rightward in
both scripts. Without it the highlight is correct in English and covers the
wrong word in Arabic, which is the exact state an English-reading reviewer never
sees. `locale-segmented.render.test.tsx` pins both.

- [x] The globe came off the slab entirely, so the segmented control is now the
  only language control on a storefront.
- [ ] **A signed-out visitor at `xl` has no language control at all.** The notch
  drawer that holds one is `xl:hidden`, and their account slab is a link to the
  sign-in screen rather than a menu. A create-account button and a language
  control were put on the slab for exactly this case and then removed by
  request, so re-adding one there is not the answer — read this entry first.
- [ ] `@repo/ui`'s `LocaleSwitcher` is still the dropdown-only version, and the
  vendor console still opens a dialog for the same choice. Promote
  `LocaleSegmented` into the package if either console wants it.

### The account menu grew a face, a crash fix, and a new landing — 2026-09-07

The storefront's `me` now selects `profile.avatar` (the vendor dashboard's has
all along). `UserAvatar` prefers the thumbnail, falls back to the initials of
the first and last word of the name, and falls back again to the neutral glyph
while `me` is in flight — a real state, not a tidy-up: a proven session whose
profile has not landed has no name to take initials from. It is built on
`@repo/ui`'s `Avatar`, so a URL that 404s later shows initials rather than a
broken-image glyph.

It went on the slab first and came back off. **The bar stays the plain glyph**:
it already carries the shop's own mark two slabs over, and a second image on the
same strip competes with the one that says where you are. The face is the
heading of the menu instead, above the name and email.

Opening that menu **crashed**, and had done since it was written.
`DropdownMenuLabel` is base-ui's `Menu.GroupLabel`, which throws outside a
`Menu.Group` — in production too, as a minified invariant — where Radix's
equivalent did not, so the shape shadcn generates against Radix is a crash here.
Every other menu in the repo wraps correctly; this one did not, and nothing
caught it because no build step renders a menu panel.

Signing in and signing up now land on the **shop home** rather than `/account`,
whenever there is no `?redirect` to honour: signing in is the step in front of
the errand, not the errand. The route guard keeps its own rule on purpose —
arriving at `/login` while already signed in still goes to `/account`, because
that navigation was deliberate.

- [ ] No storefront screen can **set** an avatar — `/account` is links only, so
  the circle only ever shows a photo uploaded from the vendor dashboard. Add
  avatar upload to the account hub (`updateUser` already takes a profile).
- [ ] `@repo/ui`'s `Button` with `nativeButton={false}` + `render={<Link>}`
  stamps `role="button"` on an `<a href>`, so screen readers announce a link as
  a button and the query for it is `getByLabelText`, not `getByRole("link")`.
  It is base-ui's behaviour, applied at every such call site in all three apps —
  decide whether to keep it or pass the role through.
- [ ] Audit the rest of the repo for base-ui parts used outside their required
  context the way `Menu.GroupLabel` was — they throw at open time, which no
  build and no typecheck reaches.

### The two recommendation rails, ranked instead of guessed — 2026-09-07

`aiRecommendations` was the second half of the same finding as the search one:
live on the schema, called by no application. The rails that existed instead
were heuristics. The PDP's "you might also like" asked for the newest members of
the product's **first collection** — so a product in no collection got the
shop's newest products (related to nothing), and a shop whose one collection is
"All products" showed the same four tiles under everything it sells. The home
had `MOST_VIEWED`, a lifetime counter on the product row, so a product that did
well a year ago outranks one everybody is opening today, forever.

The blocker was shape, not ranking. `AiRecommendationItem` is an id, a name, a
slug, four prices and a score — none of the gallery, tags or stock flags
`ProductCardFields` needs — so a rail on it means a second, poorer card or one
hydration request per tile. `storefrontRecommendations` is the fix: it ranks on
the server and hydrates through `findManyStorefrontByIds`, the same split the
search path uses, and returns `PublicProductsResponse` — so `ProductGrid` and
`ProductRail` render it unchanged.

Two decisions carry the design. **The strategy is derived, not passed**: a
`product_id` means "more like this", its absence means "what is moving in this
shop", and those are the only two rails a storefront has — so there is no
free-text strategy argument to get wrong, and the personalised blend
`aiRecommendations` can reach is not reachable from here. Both are pgvector and
behaviour SQL, with **no model call, no sidecar and no AI budget**, which is
what makes them safe on every product page without metering. And **only the
similar rail is topped up** — from the same taxonomy category, then newest.
"More like this" with nothing on file is still honestly answered by the
category; "what is moving here" has no honest filler, because the newest
products are not trending and degrading into a second copy of the new-arrivals
row would be untrue *and* duplicate a section the shopper already passed. So
trending returns empty and `showTrending` removes the section.

- [ ] `similar` reads `product_embeddings`, which is only populated when an
      admin runs `triggerEmbedding` — there is no automatic backfill and no
      screen that says whether a shop has embeddings at all, so most shops are
      silently on the category filler
- [ ] `trending` reads `user_behavior_events`, and all three writers of that
      table — `incrementViews`, `addToCart`, `addToWishlist` — are guarded on a
      `userId`. The storefront is built to work signed-out (the cart keys on a
      `session_id` precisely so it does), so the rail is ranking a minority of
      the traffic and a shop whose shoppers mostly browse anonymously sees an
      empty rail while being busy. Writing an anonymous event keyed on the cart
      session would fix it, and needs a `user_id`-nullable column
- [ ] No caching on either rail: `storefrontRecommendations` runs a pgvector
      query on every product page view and every shop home render
- [ ] The trending rail has no "view all" because no catalogue sort reproduces
      it. A `sort=TRENDING` backed by the same query would give it one
- [ ] `ai.recommendation.generate` is now on a live code path and still checked
      nowhere

### The catalogue search box ranks instead of matching a substring — 2026-09-07

`aiSearch` and the whole hybrid pipeline behind it — Arabic normalisation,
CAMeL lemmatisation, five retrieval methods fused with RRF, cross-encoder
reranking — were live on the schema and **called by no application**. The three
apps had the generated types and zero call sites, so the pipeline ran for the
assistant and for nobody else. Meanwhile the header search box wrote `?search=`
into a path that matched the phrase as a substring of a name or slug, which is
the exact bug the assistant was fixed for in September: a shop selling a
*MacBook Air M3* answered "laptop" with an empty grid.

Fixed in `findAllStorefront` rather than in the storefront, so it lands on every
caller of `storefrontProducts` at once — the catalogue, the collection lists,
the home rails — with **no frontend change at all**. The two rankers
`CustomerCatalogSearchService` already merges for the assistant now run here
too: `AiService.agentSearch` and `searchStorefrontCandidateIds` in parallel,
merged semantic-first, capped at 200, narrowing `where.id`. Every visibility
rule and every shopper filter still applies on top — a ranker is a suggestion,
never proof a row is publishable.

Three decisions worth keeping. **An empty candidate list falls through to the
old substring match**, because neither ranker can report an outage in its
return type — `searchStorefrontCandidateIds` catches its own SQL errors and
returns `[]`, and the semantic one is wrapped the same way — so "the shop has
none" and "search is down" arrive identically and only one may render as an
empty grid. The keyword ranker already reads every column the substring match
does, so a genuinely empty search stays empty; what the fallback recovers is
the case where nothing ran, including a query the tokeniser drops entirely.
**Relevance is what the default sort means on a search**: `sort_by` defaults to
`NEWEST` and the catalogue always sends it, so an explicit "newest" and an
untouched control are the same value on the wire, and `isDefaultSort` resolves
that in the shopper's favour only when a ranked list exists. And **relevance
costs a second query** — Prisma cannot order by an id array — but both reads are
bounded by the cap, so it never becomes a catalogue scan, and `total` comes
from the surviving set rather than a `count()`.

- [ ] A search cannot page past 200 results and `meta.total` is the ranked set,
      not every possible match. Fine for a shopper; wrong if anything ever
      drives a sitemap or an export off a searched read
- [ ] The catalogue has no "sorted by relevance" affordance — the sort control
      still reads "Newest" while the grid is in rank order, which is a small lie
- [ ] `aiRecommendations` is still called by nothing. "Similar products" on the
      PDP and a "trending" rail on the shop home are the two obvious homes
- [ ] Ranked search does not log to `search_query_logs`; only `aiSearch` does,
      so the analytics on what shoppers actually type still sees almost nothing
- [ ] `ai.search.semantic` and `ai.embedding.generate` are now on a live code
      path and still checked nowhere — see the AI capability-key item

### The cloud hero and the notch bar both moved to the marketplace front door — 2026-09-05

`CloudShaderHeroDemo` rendered above `HomeHero` on every `/[shopSlug]`, which meant the same sky, the same "Banking above the clouds" headline and the same fintech screenshot introduced Ahmed Electronics and every other shop equally — the one screen where a visitor has already chosen a store and wants to see *that* store. It opens `/` now, the one route in the app with no shop scope and so nothing of its own to describe. The file left `components/home/` with it: it is not a home section any more, so it is `features/shop/components/cloud-shader-hero.tsx`.

`/` also wears the storefront's bar now, in place of the plain bordered strip it had. `NotchNav` was already store-free and slot-driven, so the new `DirectoryHeader` is a **second caller of it, not a shared `ShopHeader`** — every slab of that header is shop-scoped (logo, name, `/{slug}/products`, wishlist, cart, account) and making it cope with a missing shop would have put a null branch through the screen it is actually for. Its two entries are anchors on this page, `#top` and `#shops`, because the directory *is* one page; that is what gives the bar the same two-pill shape as a storefront's Home / All products with both destinations real, and it is why the active entry is `NotchNav`'s own state — a hash is not in `usePathname()`. `NOTCH_GHOST` moved into `notch-nav.tsx` when the second caller appeared.

The two halves settle the same contract between them. The bar is `fixed`, so the hero keeps its original `pt-28 md:pt-36` and `/` reserves nothing above it — the sky is drawn behind the slabs, exactly the arrangement the hero was built for. On the shop side the opposite: with no full-bleed hero left there, `useShopChrome`'s `overHero` would have been true on a route whose `HomeHero` is a contained card, and the slabs would have landed on it. The hook is deleted and `ShopShell` reserves the 4rem on every route.

Green: storefront 301 / 301, typecheck, 0 new lint errors (the one warning is checkout's pre-existing `<img>`). Both pages fetched from the running dev server: `/` renders the slabs and the hero, `/ahmed-electronics` no longer renders the hero and now carries the `pt-16`.

- [ ] Not opened in a browser — the slabs over the sky, the anchor jumps and the RTL side of the new bar are unverified by eye.
- [ ] The bar has no search box, unlike the storefront's. `/`'s search is in the page body, and moving it into the slab's drawer was more than was asked for.
- [ ] The demo-content follow-ups below moved with the hero, and are now on the front door rather than on a storefront: the dead `#` buttons, the hardcoded English copy and the hotlinked `assets.aceternity.com` screenshot are the first thing a visitor to the marketplace sees.

### A locally-uploaded product photo rendered as a broken tile — 2026-09-04

`next/image` refused every image the API served from its own disk. With no CDN
configured the uploader stores files under `back-end/uploads` and hands back
`http://localhost:3000/uploads/...`; the optimizer answered `400 "url" parameter
is not allowed`. So a seeded product looked fine and a product actually
photographed through the dashboard did not — the only tile on the catalogue with
a real upload was the only broken one, which reads as a bad `<Image>` rather
than as configuration.

**Two separate refusals wear the same error string**, which is what made it look
like one fix had failed. `images.remotePatterns` listed only `placehold.co` and
the BunnyCDN pull zone, so the URL never matched. Adding a pattern for it still
returned the identical message, because Next 16 also resolves every remote
image's host and rejects one that lands on a private IP — an SSRF guard that
fires *after* the pattern check, in `fetchExternalImage`, and `localhost` is
127.0.0.1. Both are now set, and both are gated on `NODE_ENV !== "production"`:
the pattern is scoped to `/uploads/**` so it cannot widen into "anything on
localhost:3000", and `dangerouslyAllowLocalIP` is never on in production, where
being off is the whole point of it.

Green: storefront `tsc --noEmit`, and the optimizer answers 200 for the failing
thumbnail on the running dev server.

- [ ] **`apps/vendor` has the same gap** — its `remotePatterns` is the two-entry
  list this one started as and it sets no `dangerouslyAllowLocalIP`, so the
  dashboard's own media library and product forms show the same broken tile for
  anything uploaded locally. Needs both halves, not just the pattern.
- [ ] **The origin is a literal.** It is `localhost:3000` in the config while the
  API URL is `NEXT_PUBLIC_GRAPHQL_URL`; running the API on another port breaks
  images again with the same unhelpful 400.
- [ ] **Nothing pins either setting.** A test that asserts the dev config allows
  an `/uploads/` URL and the production config does not would catch a future
  edit re-breaking local imagery, or worse, shipping the local-IP allowance.

### The price moved off the title's line, after four were tried — 2026-09-04

The price shared the title's line and lost: a five-figure price took the width
out of the name and broke a two-word product onto two lines. Rather than guess
a replacement, four placements were built and made switchable live behind
`?price=` so they could be judged against real products in a real grid. The
chosen one is **the last line, price leading and the add button trailing**; the
switch module and the other three are deleted.

Two things the winner needed to survive a real catalogue. **It stacks under a
`15rem` container query**, not a screen breakpoint: the catalogue grid gives
the tile half a phone screen while the home rail gives it a fixed `15rem`, so a
viewport rule would have to be wrong for one of them. Below the threshold the
price takes its own line above a full-width button. And **the price never
gives way** — a truncated price is a wrong price — so the button is the half
that shrinks, truncating its label rather than pushing the row past the card.

`ProductPrice` came out of it smaller, not bigger: `tight` is now a property
of a tone rather than a check against its name, and the tile's tone is the
only one carrying it. A tight tone takes the locale's narrowest currency
marker and drops the strikethrough "was", which the `-N%` badge on the picture
already says. The dead `--shop-photo-chip-solid` token went with the chip.

Green: storefront typecheck, `eslint src` (0 errors, 1 pre-existing warning on
the checkout page), 301 tests across 31 files, and `next build` on all 19
routes.

- [ ] **Never seen in a browser below the stack threshold.** The row itself was
  chosen by eye on a desktop grid; the stacked form under `15rem` and the
  button's label truncation have only been built, not looked at.
- [ ] **The stack threshold is one measured guess.** `15rem` was derived from
  the English label plus a five-figure price, and Arabic's "أضف إلى السلة" is
  shorter — so the tile may stack a little earlier than it needs to under
  `ar`.

### Five improvements to the photo tile — 2026-09-04

The tile shipped earlier today as a photograph with a caption on it. Five
follow-ups, each fixing something the first pass got wrong or left out rather
than decorating it.

**The reference had three dots and we had dropped them.** `CardPhotos` puts the
gallery back: a mouse scrubs through the photos by horizontal position, so the
frame itself is the control and there is no timer moving a tile under someone
reading it; touch taps the dots, which are real buttons there. It cost one
field on `ProductCardFields` and no round trip, because `gallery` is the same
JSON column `image` comes from and was already in `publicProductSelect` and the
public mapper. **Nothing past the first photo is fetched until asked for** — a
grid eagerly loading three photos a tile triples catalogue image traffic for
pictures most visits never open, and the first row is usually the page's LCP.

**A product with no photo was a black slab**, and three of four tiles on a
seeded shop were exactly that, which reads as a broken page rather than an
unphotographed one. `cardTint` derives one of the three `--shop-tile-*` pairs
the collection bento already uses from the product id, so the colour is stable
across the home page, the catalogue and every re-render.

**Sold out did not read from a distance** — a chip and a grey button, against a
photo still in full colour. The picture goes grey now, so the state is legible
across a whole grid at a glance.

**The scrim was a fixed three quarters of the tile** regardless of how much
caption there was, so a product with no description carried the same wall of
ink as one with four lines and lost the picture underneath for nothing. It is
painted on the caption box now, so its height is the caption's.

**The price chip asks for the locale's narrowest currency marker.** It is the
one place in the app fighting for horizontal room, and it shares its line with
the title. `formatMoney` takes a `narrow` option rather than changing
everywhere: a cart line and an order total have the room, and the full marker
is the less ambiguous of the two.

Green: storefront typecheck, `eslint src` (0 errors, 1 pre-existing warning on
the checkout page), 300 tests across 31 files (7 new on the tile), and
`next build` on all 19 routes.

- [ ] **Still never seen in a browser.** Every claim above is from typecheck,
  lint, tests and build. The scrub in particular is a pointer gesture and no
  pointer has performed it.
- [ ] **`narrowSymbol` is a no-op for `SAR` under `en`.** The locale has no
  shorter form, so the shop currency this project actually runs on prints
  unchanged. It helps `USD` and the like, and it helps `ar`.
- [ ] **The dots are the only touch affordance for the gallery.** A swipe would
  be the expected gesture and is not wired: the title link's stretched overlay
  sits above the frame, so a drag never reaches it.
- [ ] **The scrub has no keyboard equivalent.** The dots are focusable buttons
  and change the photo, which covers it, but arrow keys within the group do
  nothing.
- [ ] **`cardTint` spreads three ways over the whole catalogue**, so adjacent
  tiles in a grid of image-less products will repeat a colour often. A larger
  palette or a neighbour-aware pass would look more composed.

### The product tile is a photograph now, not a panel — 2026-09-04

Rebuilt `ProductCard` to the supplied reference: the image fills the whole tile
and the caption — name, price chip, two lines of description, one tag, a stock
note and a white pill button — sits over its lower third on a scrim of warm ink.
The white panel under the photo is gone; the shape the eye reads is the picture.

Three things it needed beyond CSS. `ProductCardFields` now carries
`description` and `tags`, both already on the row `publicProductSelect` reads,
so the excerpt and the chip cost payload rather than a query — and the PDP
document dropped its own duplicate selections of the two. `cardExcerpt`
collapses whitespace before the two-line clamp, because a vendor's paragraph
break would otherwise spend one of those two lines on nothing. And
`PRODUCT_CARD_FRAME` is exported, so the grid skeleton, `CatalogSkeleton`,
`HomeSkeleton` and the rail all draw the tile's real geometry — `ProductRail`
had its own hand-drawn copy and now renders `ProductCardSkeleton`.

The caption is coloured through a new `--shop-photo-*` set with **no dark-mode
counterpart**, on purpose: a photograph is the same in both themes. The price
is a `photo`-tone chip that renders one number and no strikethrough — it shares
a line with the title, and a "was" beside it doubled its width and broke
two-word product names onto two lines, for something the `-N%` badge on the
picture already says.

Green: storefront typecheck, `eslint src` (0 errors, 1 pre-existing warning on
the checkout page), 285 tests across 30 files including a new
`product-card.render.test.tsx`, and `next build` on all 19 routes. Docs:
`docs/features/catalog.md` and the README's Design section.

- [ ] **Only ever seen on the home page's "Most looked at" rail**, on a desktop
  in English, against seed products with placeholder images. The catalogue grid,
  a phone width, Arabic/RTL and dark mode have not been looked at.
- [ ] **The stretched title link has had no keyboard or screen-reader pass.**
  The focus ring is drawn on the card via `has-[.product-card-link:focus-visible]`
  and the add button and heart sit above the overlay; both are pinned by a
  render test, neither has been driven by hand.
- [~] **A long "From SAR 1,234" still crowds the title.** The chip now asks for
  the locale's narrowest currency marker, which shortens it wherever one exists
  — not for `SAR` under `en`. The chip is still capped at one line and
  `shrink-0`, so a wide range price eats into the name rather than wrapping. A
  range may want a shorter form on a tile.
- [ ] **No excerpt for a product whose description is HTML.** `cardExcerpt`
  flattens whitespace only; nothing on the storefront strips tags, and the PDP
  renders the same field as plain text, so a vendor pasting markup would show it
  raw in both places.

### The shop's assistant, in a panel on the shop — 2026-09-02

A pill at the foot of every storefront page opens a conversation that can search
the catalogue, answer about a product, and put it in the cart — with **product
cards** and an "Added" receipt rather than prose naming things.

**It is a transport, not a second assistant.** Everything that decides what may
be said — the tools, the prompt, the injection sanitizing, both output tripwires
— belongs to `CustomerBotService` and is shared with WhatsApp. A separate web
brain would have doubled the surface a stranger can reach a model through, and
the two would have drifted the first time one was fixed. `StorefrontAssistantService`
adds a synchronous call, a quota booking and a shape; nothing else.

Four differences, all shallow. It is **synchronous**, because somebody is
watching a spinner. It is **structured**: `search_products` records what it
returned and `add_to_cart` records what landed, so the panel draws cards — the
alternative, parsing product names back out of a model's sentence, is guesswork
that fails on the day it matters and could claim an add that never happened.
Identity comes from a **token**, and **signed out is first-class** because the
cart already works that way — a login wall in front of the first question is a
wall at the one moment the assistant is worth having. And **nothing is stored**:
a WhatsApp thread is a merchant's record, a shopper asking about a tote is not
correspondence, so the panel keeps its own transcript and replays the tail.

The one place the two channels deliberately disagree is failure. On WhatsApp a
failed turn is **silent**, because an apology would go out in the merchant's
name to their customer; here it is **shown**, because somebody is watching a
panel they opened and silence reads as broken.

**The panel exposed a bug that had nothing to do with it: `search_products`
never searched.** `findAllStorefront` read every other filter and silently
dropped `search`, so a query returned the shop's first `limit` products
regardless. Invisible on a four-product test shop — the model just picked from
everything it was handed — and badly wrong on a real catalogue, where the
assistant would only ever know five arbitrary items. It surfaced as a merchant
asking a laptop question and getting cards for a hoodie and a t-shirt.

Fixed on the storefront path, matching **name as well as slug**. The vendor
query slugifies and matches the slug alone, which is enough for a merchant
typing an English name into their own list; a shopper asks in the language the
shop sells in, and `slugify` on Arabic produces nothing a Latin slug contains.
The cards also now follow the **last** search rather than accumulating across a
turn — a second search means the answer moved on, and stale cards read as "these
are the answer".

- [ ] **Search is literal, not semantic.** "لابتوب" still will not find "MacBook
  Air M3", because nothing relates the two. `search_vector` and
  `aiService.embedProduct` already exist; wiring the assistant's search to them
  is the difference between a keyword box and something worth asking.
**The panel gained the reference's header, and one of the four needed building.**
*History* means this tab — nothing is stored server-side — so the transcript and
mode moved into a module store, which also fixed something that was quietly
wrong: the panel unmounts when the pill closes, so minimising mid-question threw
the conversation away. *Dock* pinned it to a full-height rail and was then **removed** on the merchant's reading that a storefront assistant is consulted beside the page rather than given a column of it,
*expand* grows the floating card, *minimise* closes without losing anything.

Two animation bugs were also found by the merchant rather than by us, and both
were structural rather than cosmetic. The panel **opened large and shrank**,
because `animate` on width/height with no `initial` makes motion animate from
what the element measures on its first paint; and switching mode left the inline
size behind, so the rail inherited a 544px height and hung off the edge. Sizing
moved to CSS classes, which has neither failure mode. The third was the open
itself: the pill and the panel each had their
own `AnimatePresence` as siblings in one flex column, so both were on screen
during the swap and the column's height changed under them mid-flight. One
presence in `mode="wait"` renders exactly one of them ever.

- [ ] **No streaming.** The turn returns once, so a long answer lands all at
  once instead of arriving as it is written. The biggest remaining gap against
  what this was modelled on.
- [ ] No feedback on a reply (the thumbs in the reference), so there is no
  signal about which answers were any good.
- [ ] Throttled per **IP**, because a signed-out shopper has no id to key on.
  Looser than the WhatsApp side, which keys on a phone number.
- [ ] The panel cannot be opened *about* something — a product page has no "ask
  about this" entry point, so context has to be typed.
- [ ] The assistant fills a cart and saves an address but **cannot place the
  order**; `createOrder` is `JwtAuthGuard` with no order tool by design.


### The bag got a second surface — a panel hanging off the header button — 2026-08-30

A reference shot of a mini-cart dropdown came in with one condition: keep the drawer, and make the two switchable from state. So this is not a replacement. `CartDrawer` and the new `CartPanel` are **two skins over one state** — the same `useCart`, the same quantity queue, the same `open` flag and the same delayed open the add gesture asks for — and `useCartDrawerStore.surface` (`"drawer" | "panel"`, `setSurface`) decides which is mounted. `ShopShell` renders the drawer only on its surface; the header's bag becomes a Base UI popover trigger only on the other, so exactly one cart is ever in the tree.

Two things the panel does not copy from the drawer. It **draws four lines and counts the rest** as a link to `/cart`: a popover is bounded by the viewport rather than by the cart, and scrolling twelve lines inside something floating over the page is worse than saying how many are not shown. And it takes the header's stacking context — the reason the drawer is `ShopShell`'s to mount — deliberately, in exchange for being anchored to the bag it came out of. The line itself was pulled out to `CartMiniLine` and both compact surfaces draw it (`dense` shrinks the photo), because the unavailable notice, the pending-price dimming and the cancel-before-remove ordering are rules about a cart line, not about a sheet.

The bag button became `BagButton`, taking its props through so the popover trigger's anchor ref and `aria-expanded` land on the same element that keeps `data-cart-anchor` — the flying photo still finds it on either surface.

Green: storefront tests 87 in the touched areas, typecheck, 0 lint errors in the touched files.

- [ ] Never seen in a browser. The panel over a near-black slab is the same unreviewed page-token-on-notch pairing the drawer already has open above.
- [ ] `surface` has no UI behind it and defaults to `"panel"` — nothing but code sets it. If both surfaces are meant to stay, it wants a shop setting; if not, one of them should come out.
- [ ] Below `sm` the panel is a viewport-width popover under a fixed bar, which is the case the drawer was better at. Unmeasured.

### The header became a notch — three slabs cut out of the top edge — 2026-08-29

A `NotchNav` component was handed over and asked for in the storefront. It arrived as a **full-screen shell** — `fixed inset-0`, the whole app scrolling inside an inner viewport — and that shape was not taken: this app scrolls the document, the hero runs under the bar, and `ShopFooter` ends it. What shipped is the same design as a *header*: `shared/components/notch-nav.tsx`, three slabs (brand, menu, actions) hanging off the top edge, joined to it by the fillet wings that are the entire illusion.

Two things about it are ours rather than the source's. **The three slabs stay apart at every width.** The source collapsed them into one island below `xl`, which means rendering the action controls a second time — and the cart button cannot exist twice: `cart-flight.ts` finds it by `[data-cart-anchor]` and its badge is a single `NumberFlow` instance by design. Only the middle slab changes shape, into a trigger and a floating dropdown panel that also carries the search box, the wishlist link, the locale picker and sign in/out. And **the panel floats below the slab instead of expanding it** — sharing a column means the collapsed slab is permanently as wide as its widest menu row, which a slab centred between two others on a 360px edge cannot afford.

The bar's **two skins are gone with it**. `floating` existed because a white bar over the hero had to fade back to page ink on the first scroll; the slabs carry their own near-black ground, so `useScrolled` and the hardcoded white/`slate-900` ink went with it. `useShopChrome` survives unchanged as the single owner of "is the bar over the hero", which is now only about whether the page reserves the height. New `--shop-notch-*` tokens, deliberately a separate set from the footer slab's. RTL is free: logical positioning (`start-full`, `rounded-ee-*`) and one `rtl:-scale-x-100` on the wings, rather than four hand-written paths.

Green: storefront 278 / 29 (5 new in `notch-nav.render.test.tsx`, the cart-badge invariants untouched), typecheck, `next build`, 0 lint errors in the touched files.

- [ ] Never seen in a browser. Three slabs sharing a 360px top edge is the risky width, and the `sm` breakpoint dropping the shop name is the only thing making room.
- [ ] The locale picker's dropdown, the account menu and the cart drawer are page-token surfaces opening off a near-black slab — unreviewed as a pairing.
- [ ] `position="bottom"` is supported throughout and used nowhere. Either a mobile bottom bar gets built on it or it should come out.

### `ShopHeader` took the cloud hero's navbar, and the demo's own bar is gone — 2026-08-28

The home page carried two navigation bars: the shop's white sticky header, and the Altitude demo bar drawn over the sky beneath it — the prettier of the two, linking to `#` four times. The demo's bar is deleted and `ShopHeader` wears its design instead: pill controls, spaced text links with a hairline under the active one, and one filled pill (the cart) in place of the "Get started" button.

It is **one bar in two skins**. `floating` — transparent, white ink — is on only where there is artwork behind it: the shop home, unscrolled, with no maintenance notice under the bar. Everything else, and the first scroll of the home page, is the solid `bg-background/85` bar. Scroll is read through `useSyncExternalStore` rather than `useState` + an effect, so a reload landing mid-page never paints a transparent bar over the catalogue, and the React Compiler `set-state-in-effect` rule stays satisfied.

The bar is now `fixed` rather than `sticky`, so the hero starts at the top of the document with sky behind the header. `useShopChrome` is the single owner of "is the bar over the hero" — `ShopHeader` reads it to pick the skin, `ShopShell` to decide whether the page below reserves the 4rem. Two copies of that condition would be a 4rem gap or a covered heading.

Green: typecheck, 0 lint errors in the touched files, shop component tests 25 / 25 (the cart-badge invariants are untouched).

- [ ] Never seen in a browser — the two skins, the scroll swap and the RTL side of the new bar are unverified by eye.

### Cloud-shader hero dropped onto the shop home page — 2026-08-28

The Aceternity cloud shader (`shared/components/cloud-shader.tsx`) and its demo hero (`features/shop/components/cloud-shader-hero.tsx`, then under `home/`) were added **verbatim**, on request: the example's own navbar, copy, pill buttons and sky palette, none of the storefront's `--shop-*` tokens. It rendered above `HomeHero` as the first thing on `/[shopSlug]`; it moved to `/` on 2026-09-05, see the entry at the top of this area.

Two deviations from the pasted source, both forced. `cn` resolves from `@repo/ui/lib/utils` (this app has no `@/lib/utils`), and the ref that the example assigns in its render body moves into an effect — the React Compiler `refs` rule gates CI, and CLAUDE.md already names an effect as the fix for a latest-value ref. Behaviour is unchanged: the draw loop still reads the latest props without being rebuilt.

Green: storefront 273 / 28, typecheck, 0 lint errors in the touched files.

- [ ] It is demo content on a real storefront — an "Altitude" fintech navbar with dead `#` links, a hardcoded English headline, and a dashboard screenshot hotlinked from `assets.aceternity.com`. Decide whether to keep the shader and drop the demo chrome.
- [ ] Not translated and not RTL-aware, unlike every other section on this page.
- [ ] The shader holds a WebGL context unconditionally at the top of the LCP element. `DitherField` in `@repo/ui` already solves this with `use-on-screen`; this one does not, and no `prefers-reduced-motion` path stops the `requestAnimationFrame` loop (it only freezes time).

### The National Address code is the whole customer address form — 2026-08-27

The checkout address form asked for street, city, state, postcode and country, with the National Address code beside them as an optional extra. That is two independent answers to "where does this go", and they disagree: a live checkout typed Jeddah beside code RGUC8214, which the registry places in **Riyadh**. The carrier quote is priced on the typed city string; the courier navigates by the code. So the order was quoted for a lane it was never going to travel.

The five typed fields are gone. The code is the only input, and `lookupNationalAddress` fills city, country, street and postcode behind it — the same registry call `enableCarrierPickup` already uses on the warehouse end, so both ends of the shipment now come from one source. It also removes the "Riyedh vs Riyadh" class of bug on the customer side for free: nobody types a city any more.

Fields are removed rather than disabled — a greyed-out input reads as something the customer failed to fill in, and they are not theirs to fill. `addressSchema` requires the code AND the city/country it resolved to, because a code of the right shape matching nothing would otherwise price an order against a destination nobody confirmed. Typing a different code clears everything the previous one resolved to, or a corrected code keeps the old city forever when the new one resolves to nothing.

**The trade, stated rather than hidden: only addresses in the Saudi registry can be entered.** That is the market this platform prices, books and ships in today, and the blob written downstream is unchanged — so serving anywhere else is a second, manual mode on this one form and nothing more.

Green: storefront 273 / 28, typecheck, build, 0 lint errors in the touched files.

- [ ] No manual fallback for a destination outside the Saudi registry — that customer cannot enter an address at all. A "enter it manually" escape on the same form is the whole fix.
- [ ] `lookupNationalAddress` is now load-bearing for every checkout and is throttled at 30/min per caller. A customer correcting a code a few times is fine; nothing has measured the real rate.
- [ ] Addresses saved before this change carry typed lines and no code. They still render, and `isAddressComplete` rejects them — the customer has to re-enter one, with nothing on screen explaining why.
- [ ] The vendor's manual order screen still writes a typed address blob, so the two paths disagree again on the merchant side.

### Public pages moved to server rendering, plus robots + sitemap — shipped 2026-08-21

Every public route fetched from the browser: the page shipped a shell, hydrated,
then asked for its products. The visible symptom was a storefront that painted
and then filled in. The invisible one was worse — **the HTML contained no
products at all**, so every crawler that does not run JavaScript (WhatsApp,
Facebook, X, Bing) saw an empty shop, and a product link pasted into a chat
showed the *storefront's* name and cover because the only `generateMetadata` in
the app was the shop layout's.

Now the directory, a shop's home, the catalogue and the product page all start
their queries during the RSC pass through `<PreloadQuery>` and read them back
with `useSuspenseQuery`. `shared/apollo/rsc.ts` is the new `react-server`-only
client; `registerApolloClient` wraps it in React's `cache()`, so each request
gets its own instance. The private routes (cart, checkout, account, orders,
wishlist) deliberately stay client-fetched: per-visitor, token-bearing, and
nothing a crawler should reach.

Two invariants bound it, and both are the reason it is safe. The server client
**carries no credentials** — everything preloaded is behind `OptionalJwtGuard`,
so there is no per-visitor data in a shared cache to leak. And the shop scope is
**an argument, never ambient**: `setShopSlugOverride` was removed rather than
used. It was a module-level `let`, and a module is shared by every request in
flight in a Node process, so setting it before an await hands one visitor's
`X-SHOP` to whatever renders in the gap. It had no callers. Server reads pass the
slug through `storefrontContext(slug)`.

The trap worth writing down: **`useQuery` silently defeats a preload.** It does
not suspend, so the server render returns `loading: true` and ships the skeleton
— data still arrives after hydration and the HTML is still empty. A preload only
pays off when the reader is `useSuspenseQuery` and its variables match byte for
byte, which is why `HOME_POPULAR_VARIABLES`, `directoryVariables()` and
`toSearchParams()` exist: one definition each, imported by both sides.

Alongside it: per-product `generateMetadata` (title, description, OG image,
Twitter card, `seo_*` preferred where the vendor filled them in); a real **404**
for a slug that is not a product, replacing a soft 200 that search engines keep
in the index; `robots.ts` deriving its disallow list from `PRIVATE_SEGMENTS` /
`GUEST_ONLY_SEGMENTS` so it cannot drift from the route guard; and `sitemap.ts`
sweeping every approved shop's home, catalogue and products.

Verified against the live API on a production build: `/`, `/{shop}`,
`/{shop}/products` and a filtered catalogue URL all return their content inline
in the HTML, a product page carries its `<h1>` and full OG tags, a missing
product returns 404 and a real one 200, and the sitemap generated 16 real URLs.

- [ ] **`NEXT_PUBLIC_SITE_URL` must be set on the deploy.** It defaults to
  `http://localhost:3003`, and `robots.txt` / `sitemap.xml` are the two files
  that emit absolute URLs — unset, they advertise localhost to crawlers.
- [ ] **`fetchShopShell`'s `next: { revalidate: 3600 }` is a no-op.** Next does
  not cache `POST` fetches, so the shop shell is re-read on every request rather
  than hourly. Pre-existing, not introduced here. Fixing it means a GET-shaped
  persisted query or an explicit `unstable_cache` wrapper.
- [ ] **The product page costs one extra query.** `generateMetadata` and the
  `notFound()` check share one React-`cache()`d `STOREFRONT_PRODUCT_META` (seven
  fields), but that cannot feed the page's `PreloadQuery`, which streams. Two
  reads of one product per request.
- [ ] **`sitemap.ts` is one file, capped at 500 shops and 1,000 products each.**
  It logs when a cap bites. Past that it needs `generateSitemaps()` to split.
- [ ] **The sitemap carries no `lastModified`.** `PublicProduct` exposes
  `created_at` and no update timestamp, and publishing a creation date as a
  modification date tells crawlers every edited product is untouched. Needs an
  `updated_at` on the public type.
- [ ] **Related products and reviews are still browser-fetched on the PDP.**
  Both depend on the loaded product (its collection, its id), so the server
  cannot start them without a second serial round trip before first paint.
  Worth revisiting if the API grows a query that takes a product slug.

### Cart quantity debounced, and the tile stopped opening the drawer — shipped 2026-08-20

`useQuantityQueue` (`apps/storefront/src/features/cart/`) sits between the `-`/`+`
steppers and `updateCartItem`: taps answer locally and one write goes out 450ms
after the last, carrying the final absolute quantity. Writes for a line never
overlap, a failure falls back to the server's number, and leaving the drawer or
the page flushes what is queued. `useCart` gained `updating` so a list can
subtract the quantity write from `mutating` and stop disabling the stepper the
shopper is still pressing. Money — line total and summary — dims from the first
tap rather than from the request.

`useAddToCartGesture` gained `reveal`; `QuickAddButton` passes `false`, so a
catalogue tile now confirms with the flying photo and the badge, plus a toast
when neither moves, instead of a panel that has to be dismissed before the next
tile can be reached.

- [ ] **Never seen in a browser.** No local database, so verified by typecheck,
  lint, tests (`quantity-queue.test.ts`, `quick-add-drawer.render.test.tsx`) and
  reading only. The 450ms quiet window and the dimmed-money treatment both want a
  real thumb on a real phone.
- [ ] **The wishlist's "move to cart" still opens the drawer.** It is the same
  multi-item run as a catalogue grid, so it probably wants `reveal: false` too —
  left alone because only the tile was reported.
- [ ] **A queued write cannot be recalled once it is in the air.** Removing a
  line calls `quantity.cancel`, which stops the *next* write but not one already
  sent; the remove and the update then race, and the update's envelope can put
  the line back. Needs the remove to await an in-flight update, or a server-side
  ordering guarantee.
- [ ] **The header badge lags the drawer by the quiet window.** `summary.total_items`
  is only predicted for `addToCart`, not for a quantity change, so the count
  behind the panel sits still for 450ms while the stepper moves.

### Storefront footer rebuilt as a plain e-commerce footer — shipped 2026-08-19

The cinematic treatment shipped earlier the same day was **reverted in full** on review: it read as a studio landing page rather than a shop. Removed — the diagonal name band, the aurora, the grid, the glass pills, the scroll-linked reveals, the magnetic hover, the metallic closing line and the full-width `FooterWordmark` SVG. `footer-marquee.tsx`, `footer-motion.tsx` and `footer-wordmark.tsx` are deleted along with the wordmark's 14 tests, and every token and `@utility` those needed is out of `globals.css`.

Two of those were not merely noisy but wrong for the surface: a **magnetic pill moves the target while the shopper is aiming at it**, and a page-wide animated slab at the foot of *every* route is cost paid on every screen for something nobody came to look at.

**What replaced it.** Four scannable columns in the order a shopper's questions arrive: who this shop is · Shop · Account · Newsletter, over the legal bar. The Account column went from two links to four (`/account`, `/account/orders`, `/account/addresses`, `/wishlist`) — all guarded, so all four carry `prefetch={false}`. Column headings are real `<nav aria-labelledby>` landmarks.

**Column 1 is the part that is not boilerplate**, and it is what `created_at` and `settings.location` were added to `SHOP_BY_SLUG` for: the shop's name, where it trades from, and the year it joined. On a marketplace the shopper does not know the vendor, and a real place plus a real date does the job a "trusted seller" badge only claims to. Both render only when published; the line reads "on Zaydak since", not "established", because `created_at` is when the shop joined this platform and nothing more. The contact address and website are shown as themselves (`hello@acme.test`, `acme.test`) rather than behind the words "Contact" and "Website" — a shopper deciding whether to trust a shop wants to see where the link goes before clicking.

**The one moving thing left** is `.footer-link`: an underline drawn as a `background-size` transition, kept precisely because it moves nothing — no box changes, so the link stays exactly where it was. It grows from the inline start, so it reverses under RTL.

Green: storefront typecheck, lint (0/0), `next build`, 244 tests / 26 files (footer 17, up from 8), i18n parity. Message keys `ctaTitle`/`backToTop` removed; `shopColumn`, `accountColumn`, `newsletterColumn`, `since` added in both locales.

- [ ] **Never seen in a browser.** No local database, so verified by typecheck, lint, tests and reading only.
- [ ] `Shop.settings.location` is now rendered to customers. It is vendor-entered and unvalidated, so a shop that typed nonsense into it publishes that nonsense; the vendor dashboard has no preview of this line.

### Cart add-to-cart choreography: flying photo, rolling badge, fuller drawer — shipped 2026-08-19

Ported from the `ZaydakShop` reference cart, whose animation layer is
`NumberFlow` on the badge, a full-width sheet with asymmetric open/close timing
and a tinted backdrop. Its fly-to-cart provider was **dead code** — mounted in
two layouts, `triggerAnimation` called from nowhere, and the animated element
empty — so that half was built here rather than copied.

**The flight.** `useCartFlightStore` measures the nearest `[data-flight-source]`
photo around the clicked control and the header's `[data-cart-anchor]` bag, both
on the click rather than cached: the header is sticky and the page scrolls under
it. `CartFlightLayer` (mounted by `ShopShell`) tosses the photo along a
three-stop arc in 620ms, animating only `transform`/`opacity` over an element
pinned at the measured rect. Viewport coordinates make RTL free.

**The collision the reference never had to resolve.** This app opens the cart
drawer on the click, and the drawer covers the exact corner the photo flies to.
`useAddToCartGesture` now owns that: when a flight starts the drawer waits its
620ms and the flight is the confirmation; when none starts — reduced motion, no
header yet, an unlaid-out source — the drawer opens immediately, unchanged. All
four add controls (tile, product page, wishlist row, and the header) go through
it, so the decision exists once.

**The badge** rolls its digits (`@number-flow/react`, 300ms), capped at 99 with
a `suffix` so `NumberFlow` still gets a number, and gains a ring pulse on
landing — a separate re-keyed element, since remounting the badge would kill the
roll it is meant to celebrate. **The drawer** travels its full width, 500ms in
and 300ms out, over a warm gradient backdrop; that needed one additive prop on
the shared `SheetContent` (`overlayClassName`), because the overlay is rendered
inside it and the only alternative was a global selector.

Green: storefront typecheck, lint (0/0), 232 tests / 24 files (7 new on the
flight store's four refusal paths and its measurement), `next build`; `@repo/ui`
211 tests, lint unchanged. Docs updated: storefront `cart.md`, `catalog.md`,
`shop.md`; `packages/ui/README.md`.

- [ ] **Never seen in a browser.** No local database, so verified by typecheck,
  lint, tests and build only. The arc's 56px lift, the 620ms duration and the
  backdrop's gradient stops are the three numbers most likely to want a nudge
  once someone looks at it.
- [ ] **`motion` now actually ships.** It was already a declared dependency of
  the storefront and unused; `LazyMotion`/`domAnimation` keeps it to the DOM
  feature set, but this is the first code path that loads any of it. Worth a
  bundle check against the pre-change baseline.
- [ ] `docs/features/cart.md` is 176 lines against a ~110 house guideline (135
  before this change). Same shape as the `shop.md` note above — it wants
  splitting, not trimming.

### Storefront footer rebuilt to the supplied reference — shipped 2026-08-19

`/{shop}` ended in a tinted panel of the same warm-paper family as everything above it, which read as one more section rather than as the end of the document. It is now the app's one inverted surface: a near-black slab in three bands, built from a supplied comp.

**Band 1** — the shop name as a small obliqued mark, two link columns each held between thin brackets (site nav; contact + website), and the newsletter field. The brackets are `border-s`/`border-e` on two narrow spans rather than `[` and `]` glyphs, so they grow with the column and mirror themselves under RTL instead of needing to be reversed by hand.

**Band 2** — `FooterWordmark`: the shop's name set once at the full width of the page, obliqued, with a hard extrusion cast down-right. It is an SVG because the platform is multi-tenant and the name is therefore unknown: no CSS unit sizes type against the length of a string, so `clamp()`/`vw` would leave a four-letter shop two-thirds empty and wrap a thirty-letter one. `textLength` + `lengthAdjust="spacing"` fits the run to the box and the `viewBox` scales the box to the container — exact at any length, any breakpoint, with no measurement, no ref and no effect, so it is right in the server HTML rather than one frame after hydration. `MIN_UNITS` stops a very short name producing a box nearly as tall as it is wide.

**Band 3** — copyright, the shop's socials, and the link back to the platform directory. The comp's "public offer" and "shipping handling disclaimer" were **not** reproduced: neither page exists here, and a footer link that 404s is worse than an absent one.

**The newsletter field has no back-end and does not pretend to.** A recon pass enumerated ~250 mutations: the only subscribe operation is `subscribeStockNotification`, which is product-scoped and means "tell me when this is restocked"; `User.accepts_marketing` exists in Prisma but is never written and is absent from the schema. So the lime pill composes a pre-filled `mailto:` to the shop's own published contact address, renders only when there is one to send to, and its toast says the request is not sent until the customer sends it. The escaping is a tested pure function (`lib/newsletter.ts`) because every input is vendor- or visitor-controlled.

Seven `--shop-footer-*` tokens (with dark values) and three type utilities carry the slab. The utilities exist so the `html[lang="ar"]` letter-spacing reset has something to target — letter-spacing is how a Latin-first design silently breaks Arabic, since the script joins its letters and spacing them apart turns a word into a row of shapes. Arabic also gets no artificial oblique.

Green: storefront lint (0/0), 222 tests / 23 files, i18n parity. 24 new tests across the wordmark's geometry, the footer's conditional blocks and the mailto escaping — `ShopFooter` had none before.

- [ ] **Never seen in a browser.** No local database, so verified by typecheck, lint, tests and reading only. The extrusion depth, the lean angle and the wordmark's size against the container are the three numbers most likely to want a nudge once someone looks at it.
- [ ] The newsletter field becomes a real subscribe the moment an operation exists — only `NewsletterSignup` changes. See the campaign/broadcast item under P3.
- [ ] `docs/features/shop.md` is now 171 lines against a ~110 house guideline. That folder holds the directory, the shell, the header and the whole home page as well; if it grows again it wants splitting.

### Storefront cart drawer, shared user store, sign-in redirect, add-to-cart latency — shipped 2026-08-19

Four reported gaps in `apps/storefront`, in one change.

**Cart drawer.** New `CartDrawer`, mounted once by `ShopShell` and opened from a new `useCartDrawerStore` — the header bag, a catalogue tile's `QuickAddButton`, the product buy bar and the wishlist rows all open it without a callback chain. It opens from the edge the writing direction puts it on. It is the *confirmation* surface; `/cart` stays the *editing* one and keeps the coupon box and the empty-cart button.

**The nav bar never knew who was signed in,** because nothing read the session. `useAuthStore` now carries the customer beside the tokens, plus `hydrated` and `userStatus` (`user === null` cannot tell "signed out" from "profile still loading"). `useCurrentUserSync`, mounted once by `ShopShell`, is the only `me` query in the app; `AccountPage` and the checkout now read the store instead of fetching their own. The header shows a sign-in link, or a menu with the customer's name, orders, addresses, saved items and sign out.

**Sign-in appeared not to redirect.** The header on the sign-in screen links to `/account` and `/wishlist`; `proxy.ts` answers a signed-out prefetch of either with a redirect to `/login`, and the App Router caches that against the URL — so `router.replace("/{shop}/account")` could be served the poisoned entry and land back on the form. Both halves fixed: `prefetch={false}` on every header link to a guarded route, and `window.location.assign` after login/register (what sign-*out* already did) so the router cache and the unauthenticated Apollo store are discarded together.

**Add-to-cart latency.** Front-end: the cart query was fired with `session_id: null` on every first render, which `getOrCreateCart` **throws** on for a signed-out visitor — a guaranteed failed round trip per page load, now skipped until the id exists; the session id moved from a per-hook `useState` (24 copies on a product grid) to one `useCartSessionStore`; `addToCart` is optimistic on `summary.total_items` only, so the badge moves on the click while every money field waits for the pricing engine; and the add buttons use a local pending flag instead of `useCart().mutating`, which was disabling the whole grid on one click. Back-end: three sequential round trips removed from the path — `addItem` issues its product and cart-line reads as one `Promise.all`, `applyAutomatic` derives its conflict set from the rows it already read instead of re-running a byte-identical `cartCoupon.findMany`, and `buildEnvelope` runs its three independent reads concurrently.

Green: storefront typecheck, lint (0 errors, 0 warnings), 187 tests / 18 files; back-end 3834 tests / 232 suites, no new `tsc` errors against baseline. Docs updated: storefront `cart.md`, `auth.md`, `shop.md`; back-end `cart.md`.

- [ ] **Never seen in a browser** — no local database, so verified by typecheck, lint, tests and the reasoning above only. The optimistic count, the drawer's pending state and the sign-in redirect all want a real click.
- [ ] `ShopHeaderGuard` resolves the shop with a `shop.findFirst` on **every** request, cart included. A short in-memory TTL cache (the `LookupsService` pattern) would take one more round trip off every operation in the app, not just the cart.
- [ ] The remaining add-to-cart cost is dominated by network latency to a managed Postgres in `us-east-2` whose compute sleeps when idle — a cold start after ~5 minutes quiet can exceed the whole query chain. Worth measuring against a nearer database before optimising further.

### Checkout rebuilt to the payment-details comp — shipped 2026-08-19

`/{shop}/checkout` was three numbered section cards beside a summary panel. It is now the supplied comp: one sunken block holding a white form card beside the summary column. Form card: the shop mark and the account chip, the heading with its "secure" note, the payment routes as **tabs** (with the selected route's consequence printed under the row), a column of pastel address tiles beside the fields, and a black Confirm order button with "Cancel and return" beside it. Summary column: the three-step rail as icon circles, collapsible panels (items + money, delivery, discount code, note), and the total on its own line.

**Saved addresses are now tiles**, not radio rows — `AddressTiles` replaces `AddressPicker` (deleted). Each tile takes a pastel ground by position from new `--shop-tile-*` tokens, so one address is recognised by colour before its label is read; the abstract mark on each differs by the same index, since colour alone leaves them identical to anyone who cannot separate the pastels. Selection is still tracked by *value*, so a tile stops looking selected the moment a character is edited. `AddressFields` gained `inputClassName` so the checkout's tall filled inputs and the dialog's default controls stay one component.

Nothing about the data changed: `verifyCheckout` still prices the order, coupons are still carried through by hand, `createOrder` still precedes `createPaymentLink`, and there is still no card form (the card route redirects to a hosted page).

Green: storefront typecheck, lint (0/0) on `features/checkout` + `features/addresses`, 187 tests across 18 files, `next build`. `docs/features/checkout.md` rewritten, `addresses.md` updated.

- [ ] **Never seen in a browser.** The running dev server 500s on `/cart` and `/products` too — routes this change never touched — so the failure is the shared dev instance, not this work. Verified by typecheck, lint, tests and build only.
- [ ] **The summary panels open/close with no height animation.** Plain conditional render; a `Collapsible` would animate but needs the base-ui panel wired up.

### Storefront home page rebuilt to the reference design — shipped 2026-08-19

`/{shop}` was a hero, a four-tile "Featured" strip and an eight-tile "New arrivals" grid. It is now composed from what the shop actually has, in `features/shop/components/home/`: a split hero (type on paper beside the cover, never over it), a search + facet-chip strip built from the shop's own collections and tags, a most-viewed rail, a computed collection bento, a ticker of collection links, a markdown rail, new arrivals, four value notes, and the shop's own panel. Section numbers are derived from the sections that survived, so a shop with no collections has no gap in the sequence.

Two data honesty fixes came out of it, both verified against the back-end:

**`storefrontProducts` ignored `sort_by` entirely.** `findAllStorefront` hard-coded `orderBy: { created_at: 'desc' }` while the vendor path used the existing `sortByToOrderBy` helper — so the storefront's own sort control, every `?sort=` link, and this page's "most viewed" rail all returned the same newest-first page. One line in `products.service.ts`; two assertions added to `products.service.spec.ts`.

**Join counts are not buyable counts.** `Shop.products_count` filters only on `deleted_at` and `CollectionEntry.product_count` filters on nothing, so both include DRAFT and unpublished rows. The hero now reads `storefrontProducts.meta.total`, and the collection tiles show no count at all — there is no exact per-collection public total in the schema.

Also strengthened `messages.test.ts`: its `\{(\w+)\}` matcher could not tell an ICU argument from a plural branch body, so it both false-flagged a single-word English branch and never checked plural arguments at all. It now compares argument names.

Green: storefront typecheck, lint (0/0), 185 tests across 18 files, `next build`; back-end 122 products tests. `docs/features/shop.md` rewritten, `back-end/docs/features/products.md` + `api/products.md` updated.

- [ ] **Never seen in a browser.** Verified by typecheck, lint, tests and build only — no page of this has been looked at, on desktop or mobile, in either locale.
- [ ] **No per-collection product count.** Dropped rather than shown wrong. Needs either a filtered `_count` on `CollectionEntry` or a public per-collection total before the tiles can carry one.
- [ ] **The markdown rail only sees one page.** `ProductFilterInput` has no on-sale predicate, so `lib/deals.ts` selects from the newest 24. A shop whose markdowns are all older stock shows none.
- [x] **`catalog/lib/filters.ts` has no `category` param**, so system categories cannot be linked from the home page the way collections and tags are. — Resolved 2026-09-09: added `categoryId` / `category` URL param support to `CatalogFilters`, `readFilters`, `writeFilters`, and `toProductFilterInput` with unit tests.
- [ ] **Ticker pauses on hover/focus and drops under reduced motion, but has had no real accessibility pass** — no screen-reader or keyboard-only run.

### Customer address book + checkout redesign — shipped 2026-08-19

Two asks: a customer could save no addresses anywhere, and the checkout had to be rebuilt from the supplied comps.

**New `features/addresses/`.** `/{shop}/account/addresses` lists, adds, edits, sets the default and removes saved addresses; the account hub's "Addresses" row was a dead placeholder `<li>` and is now a real link. No back-end was added — `AddressesResolver` already had the full CRUD. The address *shape* moved here out of `features/checkout/lib/` so both screens share one contract, and both call one `useAddresses()` hook against a single Apollo cache entry.

Two server rules drive the UI: `default` is **exclusive** (saving one clears the rest in the same call, so every mutation refetches rather than patching the cache), and delete is a **soft delete**, so an order already placed to a removed address keeps its own copy.

**Checkout rebuilt** to the reference comps as a single page with a derived Delivery → Payment → Review rail — not a wizard, so nothing is behind a Next button and a mis-typed address costs no step. Saved addresses are now selectable radio cards (`AddressPicker`) instead of title-only chips that gave no clue which was in effect; selection is tracked by *value*, so a card stops looking selected the moment a character is edited. Also: line thumbnails with quantity bubbles in the summary, a coupon box, a "free shipping" line, numbered section cards with an accent ring on the active one, and a mobile action bar carrying the total (the only Place-order button under `lg`).

**Bug fixed on the way: cart coupons were silently dropped at checkout.** They live on the cart row (`CartCoupon`) and neither `verifyCheckout` nor `createOrder` reads the cart, and the page passed neither `coupon_code` nor `coupons` — so a customer who entered a code on the cart page saw the saving there, then got quoted and charged the **full price** one screen later. Both are now passed through.

No inline card form, deliberately: the card route redirects to a hosted payment page, so number/expiry/CVV fields would either go nowhere or put this app in PCI scope for a value the back-end cannot receive.

Green: storefront typecheck, lint (0/0), 166 tests across 15 files, `next build`. Schema regenerated; `apps/storefront/docs/features/addresses.md` added (+ index row), `checkout.md` rewritten, `README.md` route table updated.

- [ ] **Never seen in a browser.** Verified by typecheck, lint, tests and build only — neither the address book nor the redesigned checkout has been looked at, on desktop or mobile.
- [ ] **`verifyCheckout` accepts one `coupon_code` but `createOrder` takes a list.** A cart with two stackable coupons is quoted on the first and charged on both. The gap runs in the customer's favour, but the quote is wrong; the input needs a `coupon_codes` list to close it.
- [ ] **No billing address separate from shipping.** Both mutations get the same blob, and the `billingSame` / `billingAddress` message keys have been unused since before this change. The address book already stores a `billing` type that nothing reads.
- [ ] **No country picker.** Country is a free-text input, so "SA", "Saudi Arabia" and "saudi arabia" are three different destinations to `selectShippingRule`'s zone match — a live cause of `shipping_available: false`.
- [ ] **`myAddresses` is fetched one page of 50 deep with no pager.** Fine today; a customer past 50 silently loses the rest.

### Storefront product page rebuilt to the reference design — shipped 2026-08-19

`/{shop}/products/{slug}` now follows the supplied comp: a four-frame gallery mosaic across the top, then a two-column body — the product on the left (title, rating, swatch/chip picker, foldable description, shipping facts, specs), the purchase on the right (ink price bar with **Buy now**, quantity + add to cart, the reviews card) — then a centred related-products row.

Real data everywhere it could be: the category chip is the product's first collection, the shipping panel states package/delivery/availability/weight rather than inventing a delivery window, and colour swatches only replace text chips when the option is *named* a colour and every value resolves to a known hex (`features/catalog/lib/colors.ts`), so a picker is never half circles and half words.

One back-end change was needed for it: `reviews.meta.average_rating`, the mean over every matching review. The public query returned only a page, and averaging the page would have moved the number under the title each time "See more" grew the list. Green: storefront lint, catalog tests (80, 11 new), back-end reviews tests (15).

- [ ] **Reviews show no author.** `ReviewEntry` exposes `user_id` and nothing else about the reviewer — the shape with a customer on it (`ShopReviewEntry`) is ownership-gated to the vendor — so each row reads "Customer". Needs a public author projection (display name + avatar, honouring whatever the account chose) before the card matches the comp.
- [ ] **No delivery estimate.** The comp shows "6–12 working days" / "Est. arrival 10–12 Oct"; nothing on a product or a shop carries that, and the vendor shipping screen's rates are not exposed to the storefront. Wire the zone/rate quote into the facts grid once it is public.
- [ ] **No review photos lightbox.** Thumbnails render at 64px and do not open.
- [ ] **`average_rating` is not on `shopReviews`**, only on the public `reviews` query — the vendor queue still computes its own from `shopReviewsSummary`.

### Add-to-cart from a tile never opened the drawer — fixed 2026-08-19

Reported from the deployed storefront: pressing the cart button on a product card did not open the side drawer. The header's own bag button did.

That asymmetry was the whole tell. The header opens the drawer synchronously; a tile does not — `useAddToCartGesture` holds it back for the 620ms the product photo spends flying into the bag, so the panel does not cover the corner the photo is landing in. The pending open was a `setTimeout` id in a **ref inside the hook**, cleared by the hook's unmount cleanup, and the hook is called from `QuickAddButton`, i.e. from the tile. So the confirmation belonged to the component that armed it: anything replacing the grid inside 620ms cancelled it silently, after the click had already been accepted, with no error and no second chance. `ProductGrid` swaps every tile for skeletons on `loading && products.length === 0`, which is what `CatalogPage` renders during any filter, sort, search or page change — an ordinary action, not an edge case.

Fixed by moving the wait to the thing it controls: `useCartDrawerStore.openDrawerAfter(ms)` owns the single pending open (one drawer per document, mounted once by `ShopShell`), and `setOpen`/`openDrawer`/`closeDrawer` each cancel it first — so closing the drawer inside the delay is no longer undone a moment later by a timer the shopper cannot see. `use-add-gesture.ts` keeps its one job, deciding *whether* to defer, and needs no ref and no effect.

Found by a multi-agent workflow: four hypothesis lanes, each finding adversarially refuted, then a repro agent that wrote a Vitest render test mounting the real grid, tile, drawer, flight layer and Base UI sheet together and proved it. Two lanes were ruled out with evidence and are worth not re-litigating: Base UI cannot dismiss this drawer with the click that opened it (the dismiss listeners mount only after `open`, ignore every event but `click` while a backdrop exists, and require the target to be the backdrop), and the store plumbing is sound (one module instance, correct selectors, shell mounted).

Green: 239 storefront tests across 25 files (7 new in `features/cart/__tests__/quick-add-drawer.render.test.tsx`), typecheck and lint 0/0. Docs: `apps/storefront/docs/features/cart.md`.

- [ ] **Never confirmed in a browser.** Proven by a jsdom render test; the real click on the deployed shop has not been repeated.
- [ ] **`CatalogPage` still collapses the whole grid to skeletons mid-refetch.** `products = data?.storefrontProducts.data ?? []` discards the previous page while the new variables are in flight, so a filter change blanks the catalogue instead of dimming it — the inline comment claims `notifyOnNetworkStatusChange` keeps it on screen and the `?? []` means it does not. Apollo's `previousData` would fix it; it is no longer *this* bug's cause, but it is still a visible flicker.
- [ ] **A pending open survives leaving the shop.** The timer is no longer cancelled by any unmount, so an add followed within 620ms by navigating out of `/[shopSlug]` leaves `open: true` in a store whose drawer is gone — harmless today (nothing renders it), but the flag is set when they come back.
- [ ] **The flight layer's `land()` is untested.** `vi.useFakeTimers()` fakes rAF, so `motion`'s `onAnimationComplete` never runs in the test and `flights` never drains; the bag's ring-pulse counter is covered by nothing.
- [ ] **The drawer is narrower than it asks for.** `cart-drawer.tsx` sets `w-[92vw] sm:max-w-md`, which loses on specificity to the shared `data-[side=right]:` width variants in `@repo/ui`'s sheet. Cosmetic, found while ruling out the stacking-context theory.

### Order confirmation said "That order could not be found" — fixed 2026-08-19

Found on the deployed storefront: checkout succeeded, redirected to `/ahmed-electronics/account/orders/{id}?placed=1`, and the confirmation screen answered `RESOURCE_NOT_FOUND`. The buyer's account had role `vendor`.

`OrdersService.buildAuthFilter` derived the scope from the **role alone**, so for any vendor it asked "did one of my shops sell this" (`shop_id IN ownedShops`) and dropped `customer_id` entirely. But `createOrder` carries no permission check — a vendor shopping in another shop's storefront is an ordinary customer — so their own receipt matched nothing. The same filter made `/account/orders` list their shop's incoming sales instead of their purchases, and `cancelOrder` rejected them outright with `FORBIDDEN`.

Fixed by separating the two questions instead of guessing between them. A **seller** scope (role-derived, unchanged for the vendor dashboard) and a **buyer** scope (pinned to the caller's id off the JWT): `orders` takes the buyer scope when the new `FilterOrdersInput.as_customer` is set (the storefront always sends it), `order` and `orderByTrackingNumber` resolve either, `cancelOrder` uses the buyer scope for every non-admin role, and the write paths (`updateOrder`, `fulfillOrder`) stay seller-only so a vendor cannot fulfil the order they placed themselves.

**Also fixed, separately: an IDOR in `orders`.** `where` was spread from the auth filter and then `where.customer_id = filters.customer_id` overwrote it unconditionally, so any signed-in customer could read another account's orders by naming their id. The filter is now applied only when the scope is not already pinned to one customer; it still works for admins and for a vendor's shop-scoped list.

Green: 127 back-end order tests (6 new), storefront typecheck + codegen. Docs: `back-end/docs/features/orders.md`, `back-end/docs/features/api/orders.md`, `apps/storefront/docs/features/orders.md`.

- [ ] **Not re-tested against the deployed API.** Verified by unit tests and typecheck only; the round trip that produced the bug has not been repeated.
- [ ] **The buyer list is now narrowed by X-SHOP and it was not before.** `/acme/account/orders` used to show orders from every shop (the customer branch ignored the shop id, contradicting the comment in `orders-page.tsx`). It is now per-shop, which is what the screen claims to be — but there is no "all my orders across shops" view anywhere, and the shop directory at `/` is the only place one would fit.
- [ ] **The chat tool `recent-orders` still infers the scope from the role**, so the same vendor asking the assistant about "my orders" gets their shop's sales. It passes `shop_id` in filters and as the header, which the customer branch ignores.
- [ ] **`updateOrder` is still the only way a vendor cancels a sale**, and it takes a raw status transition rather than the cancellation flow's guard rails. Unchanged by this fix, but the asymmetry with `cancelOrder` is now the only reason a vendor needs it.

### Checkout blocked every order on shipping — fixed 2026-08-19

Found while testing the deployed storefront: `/ahmed-electronics/checkout` refused to place an order with "This shop can't ship to that address", whatever address was typed. Two separate faults behind it.

**The message blamed the address, but no address could ever work.** `selectShippingRule` returns null when a shop has no matching zone *or* no rules at all, and `ahmed-electronics` has **zero shipping zones and zero shipping rules** — so `shipping_available` was false for every destination on earth. There is no vendor screen for shipping yet, so this is the default state of every shop.

**And the cart held a `DIGITAL` product** — "UI Design Course" — which has nowhere to be delivered. `CartItemEntry` carried no shipping signal at all, so the checkout had no way to know.

Fixed on both sides. Back-end: `CartItemEntry` gains `requires_shipping` and `is_digital` (both already loaded by the cart repository's `include`, so no extra query). They are sent as a **pair** because they disagree — `requires_shipping` defaults true and is not cleared when a vendor marks a product `DIGITAL`, which is exactly the row that caused this. Storefront: `cartNeedsShipping` drops the address panel, the shipping summary row and the address requirement for a digital-only order, and `shipping_available: false` is now a **warning rather than a block** — `createOrder` charges a fee of 0 and creates the order regardless, so disabling the button was inventing an enforcement the API does not have and turning every checkout in an unconfigured shop into a dead end.

Green: 124 back-end cart tests, storefront typecheck + lint (0/0), 145 tests across 13 files, `next build`. Schema regenerated; `back-end/docs/features/api/cart.md`, `apps/storefront/docs/features/{cart,checkout}.md` updated.

- [ ] **Still never seen in a browser.** The fix is verified by tests and build only — the digital-only checkout layout (a "nothing to ship" panel where the address form was) has not been looked at.
- [ ] **`ahmed-electronics` still has no shipping configured**, so a physical order there is placed with a delivery fee of 0. Worth setting a zone + rate before anyone sells something that ships.
- [ ] **The seeded digital product has `requires_shipping: true`.** Harmless now that `is_digital` is read alongside it, but the column is misleading on every `DIGITAL` row and the back-end's own fee calculation consults `requires_shipping` alone. Worth defaulting it false when `product_type` is `DIGITAL`.

### Customer storefront — `apps/storefront` shipped 2026-08-19

A third Next.js app on port 3003: the shop a customer actually buys from. Every URL is shop-scoped by its first segment (`/{shopSlug}`), so one deployment serves every storefront. Routes: `/` (shop directory), then home, `products`, `products/[slug]`, `cart`, `checkout`, `wishlist`, `login`, `register`, `account`, `account/orders`, `account/orders/[id]`.

**It adds almost no back-end** — every operation already existed for the vendor dashboard. The one addition is `Shop.currency` on the GraphQL type (three lines in `shop.types.ts` + `mapShop`): `storefrontProducts` returns integer cents and no currency, so without it a customer-facing catalogue would have to guess one. Schema regenerated, 69 back-end shops tests still green.

Architecture worth knowing before touching it is in the root `CLAUDE.md` section and `apps/storefront/README.md`: the URL *is* the shop scope (no active-shop store), the route guard is inverted (public by default, negative matcher because the slug is dynamic), the cart works signed-out through `session_id` while checkout is gated because `createOrder` is `JwtAuthGuard`, money is only ever computed server-side, and shared selection sets must be GraphQL fragments because codegen cannot see through template interpolation.

Green: `npm run typecheck`, `npx eslint` (0 errors, 0 warnings), 137 tests across 12 files, and `next build` on all 13 routes. Docs: `apps/storefront/README.md`, `apps/storefront/docs/features/` (7 feature docs + index), root `docs/README.md` and `CLAUDE.md` updated.

- [ ] **Never seen in a browser.** Verified by typecheck, lint, tests and `next build` only. Nothing here — the hero, the product grid's proportions, the variation picker, the checkout summary, the RTL layout, dark mode — has been looked at by eye. This is the single biggest gap.
- [ ] **The whole buy flow is untested against a live back-end.** `verifyCheckout` → `createOrder` → `createPaymentLink` has never been run end to end. The Stripe hand-off in particular is written from the schema, not observed: `createPaymentLink` returning no `payment_url` is handled, but a real gateway round trip has not happened.
- [ ] **No `X-SHOP`-aware `orders` scoping check.** `MY_ORDERS` sends no `shop_id` and relies on the header plus `OrdersService` narrowing to the caller. Worth confirming against real data that a customer with orders at two shops sees only this shop's on `/{slug}/account/orders`.
- [ ] **Addresses are read-only.** The checkout offers saved addresses as one-tap fill, but there is no create/edit/delete — `/{slug}/account` shows the Addresses row disabled. `createAddress` / `updateAddress` / `deleteAddress` all exist on the back-end.
- [ ] **No forgot-password, OTP or magic-link screens**, though the back-end supports all three and the vendor dashboard has them. A customer who forgets their password currently has no route to recovery in this app.
- [ ] **A customer cannot write a review.** `createReview` exists and requires an `order_id`; the PDP renders reviews read-only and the order detail has no "review this" action. That is the natural next feature, and it pairs with the vendor-side "merchant cannot reply to a review" item above.
- [ ] **The related-products strip is collection-based, not the vendor's own relations.** `storefrontProductRelations` returns rows carrying only `target_product_id` with no product on them, and no public query takes a list of ids — so honouring the vendor's curated upsell/cross-sell would mean a round trip per item. Adding a `target: PublicProduct` field to `ProductRelation` is the fix.
- [ ] **The reviews block shows a count, not a rating.** The public `reviews` query returns no aggregate and `shopReviewsSummary` is ownership-gated to the vendor, so there is no average to show. A public summary query would fix it.
- [ ] **No product-name search.** `storefrontProducts`' `search` matches the slug (`Product.name` is an unindexed multilang JSON blob) — the same limitation the vendor reviews screen hit. A generated column or `search_vector` is the shared fix.
- [x] **No `not-found` for a bad product slug at the route level.** The PDP renders its own "product not found" panel inside the shop chrome, which is right for UX but returns HTTP 200. Worth `notFound()` for crawlers once the screen is verified. — Resolved 2026-09-09: verified `if (!product) notFound()` in `[slug]/page.tsx` and tested in `[slug]/__tests__/page.test.tsx` (4 tests passing).
- [ ] **Deploy is unconfigured.** `apps/storefront/vercel.json` exists (copied from admin) but no project, domain or `NEXT_PUBLIC_GRAPHQL_URL` is set, and the back-end's `CORS_ORIGINS` and `SHOP_URL` do not know about it yet.
- [ ] **No boneyard skeletons.** The app hand-draws its loading states (product tiles, cart rows, checkout panels) rather than using `Bones`. That was the right call for a first pass — the shapes are simple and the capture step needs a populated database — but the analytics-screen precedent exists if they get more complex.

## Admin console

### Login fails silently when `/api/auth/session` does not answer — found 2026-08-24

A local session where the console would not sign in: the `login` mutation succeeded every time (three `LOGIN` rows in `audit_logs`, no `LOGIN_FAILED`), but the screen stayed put with nothing shown. `POST /api/auth/session` was answering **404** — the running `next dev -p 3002` had a stale route table and served no route handler at all (a newly added probe route under `src/app/api/` also 404'd; writing the file forced a re-scan and the real route came back). Restarting dev with `.next` cleared is the fix for the stale cache, but the silence is ours.

- [x] **`setTokens` throws a bare `Error("Failed to persist session")`** (`shared/stores/auth.ts`) and the login page's `catch` only understands GraphQL errors — `getErrorCode` returns `undefined`, `applyValidationErrors` finds no field, and the `code && code !== "VALIDATION_ERROR"` branch is skipped. Every non-GraphQL failure in the sign-in path is therefore invisible. Give it a toast, at minimum. — Resolved 2026-09-09: surfaced via localized `sessionFailed` toast in `login/page.tsx` and tested in `shared/stores/__tests__/auth.test.ts`.
- [x] **`verify-otp` has the same hole** — it calls `setTokens` at `page.tsx:170` and its `catch` reads only GraphQL error codes, so a failed session write is silent there too. (`reset-password` does not call it.) — Resolved 2026-09-09: surfaced via localized `sessionFailed` toast in `verify-otp/page.tsx`.
- [x] **Nothing tells you the session route is missing.** Worth a dev-only check, or a test that asserts the login page surfaces *something* when `/api/auth/session` returns a non-2xx. — Resolved 2026-09-09: tested non-2xx throwing and toast handling.

### Admin platform analytics — `/analytics` shipped 2026-08-17

A platform-wide reporting screen for the admin console, adding **no back-end**: every operation already existed and returns marketplace-wide figures because this app sends no `X-SHOP` (see the root `CLAUDE.md` section for why `ShopOwnershipGuard` and `FeatureGuard` both let an admin through). Three queries split by lifecycle — overview (`analytics` + `yearlySales` + `ordersByStatus`, refetches on year change), cost (`usageSummary` + `usageTopShops`, refetches on window change), and top products (fetched once). Typecheck, lint (0 errors), 226 tests and `next build` all green; `/analytics` added to `proxy.ts`'s matcher and to the sidebar; en + ar strings written.

- [ ] **Never seen in a browser.** Verified by typecheck, lint, suite and build only. The bar panels, the RTL layout, the year/window pickers and the dark-mode card chrome are all unverified by eye.
- [x] **No tests for this feature.** Worth covering: `barShare`'s 2% floor for non-zero values, `translatedName`'s locale preference and its fallback, the two money formatters not being interchangeable, and that `onWindowChange`/`onYearChange` ignore a null from `Select` (`Number(null)` is 0, which would request a zero-day window or year 0). — Resolved 2026-09-09: 15 unit tests added in `features/analytics/lib/__tests__/analytics.test.ts`.
- [ ] **`ordersByStatus` and `yearlySales` take no date range**, so the status split is all-time and cannot be filtered, while the revenue bars are per calendar year only. The resolver accepts a `period` for the former; wire it up if an admin needs "this month".
- [ ] **Revenue is currency-less, deliberately.** No query on the screen returns a currency and shops may not all settle in one, so the figures are grouped numbers with no symbol — the same choice `formatAmountCents` already documents for withdrawals. If the platform is single-currency this should say so instead.
- [ ] **`yearlySales` loads every completed order for the year into memory** and buckets by month in JS (`analytics.service.ts`) — fine per-shop, but this screen calls it with no shop filter, so it scans the platform's whole year. Worth a `groupBy` before the order table gets large.
- [ ] **Commission and subscription revenue are not on the screen.** `commissions` is the tier *catalog*, not earnings, and there is no aggregate for platform take or MRR. Those are the two figures an admin would look for next and both need back-end work.

### Admin shop administration — shipped 2026-08-11, follow-ups below

The console's shop list became the shop console: search (name, slug, and for an admin the owner's name/email), a `status` filter (`active`/`suspended`/`pending`/`deleted`/`all`, omitted = active + suspended + pending), and three new back-end mutations — `adminCreateShop` (owner named, `is_active`/`is_approved` settable, promotes a `customer` owner to `vendor` in the same transaction, refuses an unknown or soft-deleted owner with `OWNER_NOT_FOUND`), `setShopsActive` and `restoreShops` (back suspended, never live). All three are gated on `manage_all_shops` alone because `PermissionsGuard` matches with `.some()`. Docs: `back-end/docs/features/shops.md`, `back-end/docs/features/api/shops.md`.

- [ ] **The public `shops` listing filters on `is_approved` but not `is_active`.** A shop suspended via `setShopsActive(false)` stays in the public directory while its storefront refuses every call — the card is there and leads nowhere. Approve/disapprove now keep the two flags in sync, so this is only reachable through a deliberate suspend or the vendor's own `updateShop`; decide whether the listing should require `is_active: true` too, which is a public-storefront behaviour change and was left out of the console work on purpose.
- [ ] **No `adminUpdateShop`, so editing a shop's details from the console is not wired.** `updateShop` exists but is the owner/admin-generic path keyed by `slug`, and the screen does not call it — there is no Edit row action. Decide whether the console gets its own admin input or reuses `updateShop`.
- [ ] Bulk row selection. `setShopsActive` and `restoreShops` already take `ids: [ID!]!`, but the table sends one id at a time — no selection UI yet.
- [ ] `deleteShop` is still slug-keyed and singular while the two new mutations are id-keyed and bulk. One shop console calling three different shapes is the kind of thing that gets wrong; align it before more callers appear.
- [ ] `products_count` / `orders_count` are `_count` aggregates filtered on `deleted_at: null`, computed per row. Fine at 25 rows a page, but it is the first thing to look at if the list gets slow.

### Admin user management — shipped 2026-08-10, follow-ups below

`/users` went from a read-only table to the account console: create, edit, suspend/reactivate, soft-delete and restore, with search and role/status filters. Back-end adds `createUser`, `adminUpdateUser`, `setUsersActive`, `restoreUsers` and three privilege guards (`assertNotSelf`, `assertMayTarget`, `assertMayAssignRole`) so an `admin` cannot act on — or promote themselves into — an administrator. Docs: `back-end/docs/features/users.md`, `back-end/docs/features/api/users.md`.

- [ ] **A suspension does not close an open tab for up to an hour.** Refresh tokens are revoked immediately, but an access token already issued stays valid until it expires (`JWT_ACCESS_EXPIRES_IN`, default `60m`) — there is no revocation list. If instant lockout is ever required, that needs a denylist checked by `JwtAuthGuard`, not a change here.
- [ ] Bulk actions. Every mutation already takes `ids: [ID!]`, but the table sends one id at a time — no row selection UI yet.
- [ ] No "send password reset" action for an operator. `AdminUpdateUserInput` deliberately carries no password; triggering `forgetPassword` on the user's behalf would be the safe equivalent.
- [~] **The silent half fixed 2026-08-12.** The role-change replacement stays (deliberate — a demotion must demote, and a demoted rogue admin must not keep hand-granted extras), but it is no longer silent: `adminUpdateUser`'s audit entry records `permissions` old/new plus `permissions_dropped_by_role_change` — exactly the hand grants the replacement removed — so a dropped grant is recoverable from the record. **Still open:** per-user permission *editing* from the screen (an `AdminUpdateUserInput.permissions` field + UI), which is what would make re-issuing a dropped grant a click instead of a trip to `/role-permissions`.

### Admin OTP log — shipped 2026-08-11, follow-ups below

`/otp-logs` in the admin console lists every code the platform has issued (identifier, purpose, status, attempts, sent/verified times), with search and purpose/status filters. Backed by the new `otpLogs` query (`manage_users`) over the `otps` table — so it covers vendor signup, whose codes have no `user_id` and never reach `audit_logs`. Adds `otps.verified_at`, without which a verified code cannot be told from one a resend superseded. A `super_admin` can also **show a live code** (`revealOtpCode`): recomputed from the hash on demand, `PENDING` rows only, every call audited. Docs: `back-end/docs/features/otp.md`, `back-end/docs/features/api/otp.md`, `apps/admin/src/features/otp-logs/README.md`.

- [ ] **Apply `prisma/migrations/manual/2026-08-11-otp-verified-at.sql` to every database.** The screen 500s until `otps.verified_at` exists; it is one nullable column plus a `created_at` index, both idempotent.
- [ ] No date-range filter and no CSV export. Both are the obvious next asks once someone uses this to chase a delivery complaint.
- [ ] **`revealOtpCode` is a support tool, not a permanent one.** It exists because delivery is broken pre-launch; once Resend and SMS actually deliver, decide whether to keep it, gate it behind an env flag, or drop it. Every use is in `audit_logs` under `entity: 'otp'`, `action: ACCESS` — review that list before deciding.
- [ ] Reveal refuses codes longer than 6 digits (`RECOVERABLE_OTP_LENGTHS`), so setting **OTP settings → code length** to 7 or 8 silently disables the button. Either surface that on the settings screen or cap the setting while reveal exists.

### Admin integrations screen reshaped to the vendor settings layout (2026-08-10)

- [ ] **Nothing in CI renders a dynamic route.** This bug was a 500 on every authed request to a whole section, and `build` + `typecheck` + unit tests were all green. A smoke step that boots `next start` and asserts 200 on each authed route with a stub cookie would have caught it in seconds — the manual reproduction that found it took one command.
- [ ] The vendor settings overlay and this screen now share a layout with no shared code. If a third settings-shaped screen appears, lift the rail shell into `@repo/ui` — two is not yet enough to know what the seam is.

### Plans console + usage ledger — the four tasks from 2026-08-10

Asked for together: the admin plans/entitlements UI, billing notifications, overage billing, and the `UsageEvent` ledger — with the explicit instruction that neither the vendor plan screen nor the admin console should keep everything on one page.

- [ ] **Overage billing — deferred by the user, unchanged.** See the item under the entitlements roadmap below. Needs Stripe metered pricing.
- [ ] **No platform-wide usage screen.** `usageLedger` and `usageTopShops` accept no `shop_id` and answer for the whole platform, but the only caller passes one — the console reads usage per shop. "Which stores are costing us the most" is a page away and would want its own nav entry; not built because the ask was the plans console, not a second one.

### Admin tables — vendor's table chrome, 2026-08-09

The admin lists were a bordered `div` wrapped around a bare `Table`: default `p-2` cells, an unstyled header row, and prev/next buttons floating under the card. Vendor's lists get their look from `apps/vendor/src/shared/components/data-table` on top of TanStack Table; admin lists are server-paged, so `apps/admin/src/shared/components/data-table/` is the same chrome without the engine — `DataTableCard`/`Toolbar`/`Footer`/`Header`/`Head`/`Row`/`Cell`/`Empty`/`SkeletonRows` plus a `DataTablePagination` that takes `meta.page`/`meta.total_pages` instead of a row model. Applied to all five lists (`/users`, `/withdrawals`, `/commissions`, plans, subscribers): filters moved into the card's toolbar, numbered pagination and a "Showing x–y of n" range into its footer, money columns end-aligned, row action menus revealed on row hover (visible on touch), and skeleton rows replacing the "Loading plans…" / "Loading subscribers…" text so the header no longer disappears while the first page loads. `DataTableHead` uses `text-start`, not the primitive's `text-left`, because this console is bilingual.

- [ ] **Never seen in a browser.** Verified by `typecheck` and `eslint` only (both clean). RTL and the hover-revealed row menus are unverified.
- [ ] Vendor's toolbar extras have no admin equivalent yet: no column visibility (`DataTableViewOptions`), no faceted filters, no sortable headers — admin paging and filtering are server-side, so each needs a query variable, not a client row model.
- [x] `/users` has no pagination at all: `AdminUsers` selects no `meta`, so the screen is hardcoded to `page: 1, limit: 25`. Add `meta` to the query and the footer to the screen. — Resolved 2026-09-09: verified `meta` selected in `AdminUsers` and `DataTablePagination` rendered in `users-table.tsx`; covered with 3 unit tests in `users-table.render.test.tsx`.

### Admin console — back-end gaps found by the 2026-07-10 audit

There is **no `back-end/src/admin/` module**; the admin surface is decorator-scattered across ~17 feature modules. `PermissionsGuard` matches with `.some()`, not `.every()` (`permissions.guard.ts:45`), so `@RequirePermissions(MANAGE_OWN_SHOP, MANAGE_ALL_SHOPS)` is reachable by any vendor. The genuinely admin-only surface is only what is gated *exclusively* by `manage_all_shops` / `approve_shop` / `manage_users` / `manage_all_orders` / `manage_role_permissions`.

- [ ] **Disputes have no admin action at all.** `disputes`/`dispute` (`disputes.resolver.ts:23,40`) are `MANAGE_OWN_SHOP`+`MANAGE_ALL_SHOPS` **read-only** queries — an admin can read cross-shop by omitting `X-SHOP`, but no mutation resolves, closes, or rules on a dispute. A disputes screen is a dead-end viewer until one exists.
- [ ] **Users: admins cannot act on an account.** Only `users` list + `deleteUser` are admin-gated (`users.resolver.ts:23,60`). `updateUser` is strictly self, so there is no way to change a user's role, ban/suspend, or reset another account's credentials. Per-user role assignment does not exist — `role-permissions` maps role→permission, not user→role.
- [ ] Admin surface that exists today with no screen: `abusiveReports`, `becameSellerRequests` + approve/reject, `activityLogs`/`auditAnomalies`, `referralEarnings` confirm/pay, `terms-conditions` CRUD, `languages` CRUD, `category-attributes` CRUD, `rolePermissions` (super_admin only), `addWalletPoints`/`deductWalletPoints`.
- [ ] `apps/admin` still has **no component or route tests** — the auth screens, the `proxy.ts` guard, and the three tables are covered only through their pure-logic units.
- [ ] Consider a shared `packages/api-client` once admin and vendor operations overlap; today each app runs its own codegen against the same SDL.

## Back-end & API

### Offline bank transfer — a payment method that waits for a human — planned 2026-09-07

Design only; no code. A third payment method beside COD and the gateways: the
shop publishes its own bank accounts, the buyer transfers in their own banking
app, uploads a receipt, and the shop approves or rejects. Full plan, with the
locked decisions and the frozen cross-slice interfaces, in
[docs/future-features/bank-transfer-offline-payment.md](docs/future-features/bank-transfer-offline-payment.md).

Two things shaped the plan more than the spec did. `PaymentStatus.AWAITING_APPROVAL`
has existed in `order-enums.ts:33`, in the lookups list and in both i18n dicts
since they were written, and **nothing has ever produced it** — so the status
half costs almost nothing, but every payment_status filter, badge and analytics
bucket in three apps is about to see it for the first time. And there is no
private storage anywhere in this repo: `StorageDriver` is `put` + `delete`,
`main.ts:207-214` serves the whole `uploads/` tree with `ACAO: *`, and
production runs bunnycdn whose pull zone serves its entire storage zone — so a
receipt carrying someone's IBAN cannot go through the existing upload path at
all. That gap is the largest piece of new work in the feature.

An adversarial review of the design caught two money/security blockers before
any code was written: the availability read published full IBANs to
unauthenticated callers on a directory whose slugs are publicly enumerable, and
the review path never re-checked the order's status — so a buyer could cancel
between submitting proof and the vendor approving, leaving a cancelled order
that `deriveFinancialStatus` reports as PAID with nothing able to undo it.

- [ ] Answer the ten open questions in §19 of the plan — the blocking ones are
      the receipt storage driver for production (`db` vs a provisioned private
      S3 bucket), whether multi-shop carts must support bank transfer, and
      whether `Order.payment_instructions` earns a column on `orders`
- [ ] Verify the `gib` and `stc_pay` BICs before the catalogue ships
- [ ] Phase 0 — bank catalogue (`banks(locale)`, public read, TS registry)
- [ ] Phase 1 — Prisma models + the manual SQL + the `PrivateReceiptStore` seam
- [ ] Phase 2 — shop bank accounts (back-end), ownership resolved from the row
- [ ] Phase 3 — vendor settings pane (takes over the existing `payments` rail id)
- [ ] Phase 4 — proof submission + review queue (back-end)
- [ ] Phase 5 — vendor review queue + order-detail card
- [ ] Phase 6 — the offer surface, shipped with `BANK_TRANSFER_ENABLED=false`
- [ ] Add `2026-09-08-bank-transfer.sql` to the required manual steps in
      `back-end/docs/10_deployment/README.md`, and a CI step applying it — the
      one-outstanding-claim partial index is invisible to `db push` and to
      `check:drift`, so a fresh database loses the guarantee silently
- [ ] Widen `AuditLogService.SENSITIVE_KEYS` with `iban` / `account_number`, and
      note that `maskSensitive` walks one level and matches keys exactly, so the
      list alone does not protect a nested snapshot
- [ ] Fix, in the same commit as Phase 6: the storefront's `PAYMENT_LABEL_KEY`
      and `displayStatus` (both keyed on values the server never sends),
      `OrderPlacedDialog` telling every non-Stripe order it pays on delivery,
      the vendor's `order-summary-card.tsx:77` printing the gateway raw, and
      `shop-footer.tsx`'s payment badges being shop-blind
- [ ] Decide whether a scheduled sweep voids abandoned awaiting-approval orders
      — they hold real stock, a real wallet debit and consumed coupon usage from
      the moment `createOrder` runs, and nothing expires them today

### The CSV importer creates products with no `InventoryLevel` — 2026-09-07

Found while tracing the checkout `VALIDATION_ERROR` above. `ProductsService`
seeds an `InventoryLevel` at the shop's default location on create (plus a
CORRECTION adjustment, so the ledger explains where the stock came from), but
`products-csv.service.ts` writes `products.quantity` straight to the row and
never does. `products.quantity` and `inventory_levels` are therefore two
sources of truth, and only one of them is what the allocation engine reads —
so **every imported product is unbuyable**: `verifyCheckout` returns it as
`unfulfillable_online` and `createOrder` refuses with `ORDER_NOT_ALLOCATABLE`,
while every product screen shows it in stock.

Three products in the local `ahmed-electronics` shop are in this state right
now (Classic Cotton T-Shirt 64, "The Band" T-Shirt 513, Stainless Steel Water
Bottle 40 — all with zero `inventory_levels` rows), from two CSV imports on
2026-09-06.

- [x] Seed an `InventoryLevel` at `ensureDefaultLocation` for every product and
      variant the CSV importer creates, in the same transaction, matching what
      `createProduct` already does. *(Resolved 2026-09-09 in `products-csv.service.ts`: injected `InventoryService`, passed `userId`/`tx`, seeded default location inventory levels + `CORRECTION` adjustments for simple products and variants on create and unlocated updates)*
- [x] Backfill: a one-off script (or an inventory-screen action) that gives any
      product with `quantity > 0` and no level rows a level at the default
      location, so already-imported catalogues become sellable. *(Resolved 2026-09-09 via `back-end/scripts/backfill-inventory-levels.ts` / `npm run backfill:inventory`: migrated 2 unlocated products and 25 variants in local database)*
- [ ] `verifyCheckout` distinguishes "spread too thin to place" from "no level
      row at all" internally but returns both as `unfulfillable_online`. A
      distinct reason would let the vendor console say the stock was never
      located rather than implying it is short.

### `productCategories` — the Category facet a shop can actually use — 2026-09-06

The vendor list's Category filter was offering the whole Google taxonomy: the
same ~5500-node `systemCategoriesFlat` the product form picks from. A shop's
products sit on a handful of those nodes, so all but a few rows could only
ever filter to nothing, and the vendor had to know the taxonomy to find the
one that worked. `productCategories(locale)` is a `groupBy` over the shop's
own products returning just the nodes they are filed on, each with a count,
most-used first. Counts are direct assignments only — a parent a product sits
*under* but not *on* is not a row, though filtering by it still widens to
descendants — and `applyVisibilityScope` runs on it exactly as on `products`,
so the facet can never name a category only a draft is in. Names come from
the same cached tree snapshot the taxonomy queries read, and a group whose
node has left the tree is dropped rather than listed nameless.

- [ ] Fold the count into the storefront's own category facet, which still
      derives its list client-side from the products on the page.


### Platform shipping — designed, built, and rejected the same day — 2026-09-05

A "Platform + Merchant override" architecture was proposed, built end to end, and **removed on the day it landed**. Recording it because the question has now been asked three times (platform-only in PHASE 6-B, per-merchant on 2026-08-31, both-as-a-tier today) and the next person to ask it deserves the reasoning rather than a fourth build.

**What it was.** `Shop.carrier_account_source` — `AUTO` (the shop's own account when it has one, the platform's when it has none), `PLATFORM`, `MERCHANT` — plus `Shipment.carrier_account_source` recording which tier booked each parcel, a `PlatformCarrierService` as the single door onto the platform credential, a platform webhook receiver at `/webhooks/shipping/oto/platform`, and a vendor card offering the choice. It worked: back-end 5226/308, vendor 700/60, all green.

**Why it was rejected.** Two reasons, and neither is about the code.

*Whoever holds the account holds the invoice.* A shop booking on زيداك's OTO account means OTO bills زيداك for that parcel — and pass-through pricing means the shop was charged exactly what the carrier quoted, so the platform absorbs every difference. There is no recharge mechanism and no obvious place to put one, which turns an adoption convenience into an open-ended liability.

*It costs the firewall.* "No shipping code path can reach the platform credential" is enforced today by a missing constructor dependency, not by a rule. A tier that needs to reach it cannot keep that, and a narrower service wrapping the same credential is the same change wearing a different name — which is exactly what `PlatformCarrierService` was.

**So Zaydak has exactly two shipping kinds**, and the checkout shows them side by side for the customer to pick: carrier delivery on the **merchant's own** OTO account, or the merchant's own delivery (their driver, their contracted courier, a flat rate, a per-zone rate). Neither is a degraded mode.

**Cost to build and to remove: zero migrations**, because a constraint written before PHASE 6-B ("do not delete or repurpose the account rows before checking production counts") had forced every schema delta since to be purely additive.

Two things from the build were kept, because they are independent of the tier and were real fixes:

- `shopShippingSettings.carrier_available` — whether the shop has a usable carrier (enabled AND verified), **independent of the mode**, where `provider_ready` is not. `provider_ready` is always true for a merchant-managed shop and says nothing about the carrier behind it, yet such a shop can still offer carrier prices at checkout. The vendor app was computing this for itself from the account rows; now the server answers it, so the screen cannot disagree with what booking would decide.
- `applyProviderEvent`'s account argument is **required**, not optional. An optional ownership argument means a caller that forgets it silently gets an unscoped lookup — the check quietly becoming no check.

- [x] **Merchant onboarding is now the confirmed cost of this architecture, not a maybe.** Resolved: Added step-by-step OTO onboarding card, direct signup link to tryoto.com, and refresh token guide in `apps/vendor` (`carrier-account-card.tsx`).
- [x] **Nothing checks the platform SHIPPING row on boot** — resolved: `NationalAddressService.onApplicationBootstrap` verifies `IntegrationType.SHIPPING` at startup, logging a warning if the platform row is missing or if the provider lacks national-address lookup.
- [x] **An operator health panel for the platform SHIPPING row** — resolved: `platformShippingHealth` GraphQL query in `back-end` (`IntegrationsResolver`) and `ShippingHealthCard` in `apps/admin` (`/integrations/shipping`) reporting OTO connection, Saudi national address probe, and callback origin.

### WhatsApp phase 2 — what is actually left, audited against the code — 2026-09-05

A twelve-item plan came in for "making WhatsApp usable". Read against the tree,
**seven of the twelve are already built** and two of the station boxes above
were claiming otherwise. Recording the audit rather than the plan, because a
list that overstates the work is what produced the stale boxes in the first
place.

Built and verified: the **public webhook** (`whatsapp-webhook.controller.ts` —
secret in the path, `timingSafeEqual` after a length check, always 200 so
Evolution's ten retries never fire on a refusal); **inbound routing** (the fork
is on the instance *name* from the URL, authenticated before a byte of the body
is trusted, which is this channel's whole cross-tenant boundary); **customer
identity** (`customer-identity.ts` plus `cart_claims` — the account is minted
when somebody *opens* the link, so a customer who never returns never becomes a
row); the **outbound BullMQ processor** (a disconnected session is not retried,
because no number of attempts reconnects a phone that is off); **notification
dispatch**; **rate limiting** (`customer-bot.throttle.ts`, `SET NX EX` so the
check and the write are one operation); and **logging/masking** end to end.

What is left is five things, and the first is the one that was reported.

- [x] **Inbound messages publish nothing, so the inbox polls every 30 seconds.** —
  resolved: `WhatsAppInboxStreamService` publishes real-time events over Redis
  channel `whatsapp:inbox` to an SSE stream endpoint (`/whatsapp/inbox/stream`)
  with a ticket handshake and heartbeats. `useWhatsAppInboxStream` in vendor
  replaces the 30s polling and automatically updates the thread list and messages.
- [x] **No inbox search.** — resolved: `shopWhatsAppThreads` query and
  `threadsForShop` service accept an optional `search` string matching both customer
  phone and message content (case-insensitive). Vendor inbox UI includes a search bar
  with debounce and clear button.
- [x] **No read state.** — resolved: added `last_read_at` column to `DirectConversation`,
  compute `is_read` dynamically based on latest customer message time, auto-mark read
  when thread is opened, expose `markWhatsAppThreadRead` mutation, and show unread dot
  indicators in vendor thread list.
- [ ] **Attachments are dropped, not stored.** `parseInboundMessage` reads the
  `caption` off `imageMessage`/`videoMessage`/`documentMessage` and nothing
  else, and `onCustomerMessage` returns early on empty text — so a customer who
  photographs a product gets silence and the merchant sees no thread. Note the
  webhook subscription still sets `base64: true`, so every image and voice note
  is already being shipped into a receiver that discards it: either handle
  media or turn that off, but the current pair is the worst of both.
- [ ] **The production Evolution server is not deployed.** Decision from
  2026-08-23 stands (Render, pinned `evoapicloud/evolution-api:v2.3.7`,
  separate Postgres + Redis, a **fresh** `AUTHENTICATION_API_KEY` — the local
  `.env` carries Evolution's well-known default). Everything above is
  unverifiable against a real handset until this exists.

### Switching integration provider answered P2002 instead of switching — 2026-09-01

Saving a second provider for a type that already had a live one failed with
`Unique constraint failed on the fields: (type)` — the console reported it as a
generic `VALIDATION_ERROR`. `saveIntegration` demoted the outgoing siblings
*after* the upsert, but `integration_configs_one_enabled_per_type` is a partial
unique index, so it rejected the write that claimed the slot before the demotion
could free it. Both `saveIntegration` and `setEnabled` now demote first, keyed on
the provider slug rather than the row id (on the create path there is no id yet).
It had never bitten because no type had ever had its live provider swapped.

- [ ] `saveIntegration` reports Prisma failures as `VALIDATION_ERROR`; a constraint
      violation should surface a message naming what conflicted.
- [ ] `title-generator.ts` caps completions at 16 tokens, which every tool-capable
      Groq model (all reasoning models) spends on reasoning alone — conversation
      titles silently fall back to the truncated first message. Raise the cap or
      pass `reasoning_effort: "low"`.

### SNDR joins the email providers — 2026-09-01

The integrations console can now send platform email through SNDR
(`api.sndr.sh`) alongside SMTP, Resend and SendGrid. Nothing about the console
changed to allow it: the screen renders from `integrationProviders`, so a
provider is a registry entry plus its `verify`.

**What was new is that SNDR publishes no SMTP relay** — nothing answers on 25,
465, 587 or 2525 on any host it owns — and until now "an email provider" meant
"a set of nodemailer connection options". Rather than teach every send site a
second way to send, it is registered as a nodemailer **custom transport**
(`sndr.api.ts`): a transport's `send` runs after the Handlebars `compile`
plugin, so it receives the rendered body, the templates are untouched, and
`EmailProcessor` still just names a transporter. `ProviderSpec` gained
`toHttpMail` beside `toSmtp`, and an email spec must carry exactly one — a spec
with neither is a provider an admin can configure, enable, and watch send
nothing, so the registry spec asserts it.

**Three wire-format facts the published SDK hides**, since it normalises before
it posts: recipients must be arrays (a bare string is a 400), `from` must be a
bare address (`"Name" <addr>` fails validation — so the field asks for one and
says why rather than silently dropping a display name), and the sending domain
must be linked *and* verified. That last one is the Resend-sandbox trap again,
so `verify()` reads the domain list rather than stopping at a working key.

- [ ] Link and verify a sending domain in the SNDR dashboard, then enable the
      provider — until then `verify` correctly refuses to save it live.
- [ ] Receive SNDR's delivery webhooks (`email.delivered` / `bounced` /
      `failed` / `complained`) at `POST /webhooks/sndr`, HMAC-verified against
      `X-Sndr-Signature` with the 5-minute replay window, so a bounced OTP is
      visible somewhere other than the provider's dashboard.
- [ ] Decide where a bounce lands — `otps.delivery_error` covers OTP only, and
      nothing records a bounce for order or notification mail.

### The assistant knows the customer, and can take their address — 2026-09-02

Three merchant reports, one cause: the assistant did not know who it was talking
to. It wrote guest carts for somebody already registered, sent a link two minutes
after they opened the last one, and told a customer whose account it had just
created that it had no information about them. The processor now resolves the
account from **the number the message arrived on**, before the model runs — which
makes the cart theirs, drops the link, and adds `get_my_account`.

**The link stopped being automatic and became something you ask for.** That was
the merchant's own framing: the point of the link is signing in from the number
they message from, not a toll on adding to a cart. So `send_login_link` is a
tool the model calls when somebody asks to sign in, open their cart or see their
orders — and an explicit ask always mints a fresh one, because only the hash is
stored and answering "you already have one" to somebody who just asked reads as
a broken feature. A stranger still gets one unprompted: their cart lives on a
session id no browser of theirs can reach.

**And the assistant can now take a delivery address, because checkout needs one.**
The storefront had already made the National Address code the whole address form
— a carrier prices on the destination city as a plain string, so a typed city
beside a code resolving elsewhere is two answers to one question. The assistant
follows the same rule rather than inventing a second one: resolve, read the place
back, confirm, then save as the default shipping address. The save **resolves the
code a second time** so what is stored is what the registry returned, not
something a prompt injection edited between turns.

- [ ] The bot can fill a cart and an address but **cannot place the order** —
  `createOrder` is `JwtAuthGuard` and there is deliberately no order tool. The
  customer still finishes on the website. Whether that last step should be
  possible from chat is a product decision, not an oversight.
- [ ] `lookup_national_address` forwards to a carrier billed to the platform and
  is driven by a stranger's messages. The per-number throttle bounds turns, not
  lookups inside one turn.
- [ ] Only Saudi addresses can be entered, inherited from the storefront's own
  narrowing. A shop delivering elsewhere has no path through chat at all.

### The assistant fills a cart, and one link hands it over — 2026-09-01

A customer asks for a MacBook in a WhatsApp chat and it lands in a cart they can
check out. The assistant got `add_to_cart`; the cart is a guest cart keyed on the
thread (`wa:<conversationId>`), so "and a case too" lands in the same one; and a
single-use link turns that cart, and the number that asked for it, into a signed-in
shopper.

**Half the work was already built and none of it was reachable.** `Cart` has had a
nullable `user_id` and a `session_id` since guest checkout, and `CartSyncService`
has done the guest-to-user merge — releasing and re-reserving stock in one
transaction — since login needed it. What was missing was the handover: a customer
reading a chat has no storefront session, and no account for the cart to belong to.

**The link carries both halves because they are one intention.** Splitting them
would sign somebody in and then leave them to rebuild the cart they had just
described out loud, which is the failure the feature exists to remove. It is sent
whether or not the number already has an account, because a registered customer
still has a guest cart on a session id no browser of theirs can reach.

**This is the shadow-user decision, finally answered — and answered better than
the options that were on the table.** `mint` writes a phone number and a cart id
and touches `users` not at all; the account appears when somebody **opens** the
link, because the click is the consent. So a customer who never comes back never
becomes a row. The number is trustworthy in a way a typed one is not: it sent a
WhatsApp message to the shop's own connected line, which demonstrates control the
way an OTP does.

`cart_claims` is its own table rather than a widened `magic_links`. That one means
"sign in as this known user" and its `user_id` is required — every consumer reads
that as a guarantee, and relaxing it for one flow would have weakened an auth
invariant everywhere. Registration is passwordless on purpose: nobody chose one,
and an invented password is either unusable or mailed somewhere. They sign in
again the way they signed up.

**`add_to_cart` is the first customer-bot tool that writes**, which crosses a line
the read-only tools were built to hold. It is contained by reaching exactly one
cart — the thread's, passed in by the processor and never named by the model — and
by `CartService` applying the same stock and publication rules the storefront does.
It takes a slug, not an id, because a slug is all the model has ever seen.

**Three merchant reports the same evening, and one cause under all of them: the
assistant did not know who it was talking to.** It kept writing guest carts for
somebody who had already registered, sent a second claim link two minutes after
they opened the first, and answered "we have no information about your name"
to a customer whose account it had just created. The processor now resolves the
account from the number the message arrived on, before the model runs — which
makes the cart theirs, drops the link entirely, and adds `get_my_account`.

**The stock answer was a third report and a fairer one than it looked.** The
assistant refused to say how many were left, on a rule written as "an exact
stock number is a competitor's inventory report" — while the storefront prints
"Only 5 left" on every card from the same public query. That was withholding
something already published, and it made the assistant visibly less informed
than the site. Reporting the raw count would have been worse: four of the five
were held in other carts. It now reports **available**, and `in_stock` wins over
the arithmetic where they disagree.

**And the storefront was overstating stock too, which the bot exposed.**
`publicProductSelect` carried `quantity` and not `reserved_quantity`, so five
physical with four held in other carts rendered "Only 5 left" beside a live
Add-to-cart. Fixed at the source rather than in either client: the select now
fetches the holds and `mapPublicEntry` subtracts them, so every consumer of the
public product is honest by default and the assistant's own workaround could be
deleted. The public type still has no field for a reservation — the guarantee
moved from "never fetched" to "never emitted", and the test that guarded the old
one now guards the new one.

Worth noting how close this came to being a bad fix: the first edit landed in
`mapEntry` — the **vendor** mapper — which would have shown a merchant available
stock where they need physical. Two mappers, one line apart in shape.

- [ ] `stockStatusWhere` still filters on raw `quantity`, so "In stock only" can
  disagree with the count now displayed beside it. Same class of bug, one layer
  down, and not worth changing filter semantics inside an unrelated fix.
- [ ] **The claim link is the only way into that cart.** If it expires unused the
  items sit in a guest cart nobody can reach until the reaper takes them. A
  "resend my cart link" the customer can ask for in chat would close it.
- [ ] Nothing tells the **merchant** a cart was built in chat. It appears as an
  ordinary abandoned cart with no sign it came from a conversation they can read.
- [ ] The completion form takes a name and nothing else — `UpdateUserInput` has no
  `email`, so an account created this way has no way to add one short of the
  account screen.
- [ ] `add_to_cart` has no test against a live model, only the unit level. The
  risk it carries is the model adding something nobody asked for, and that is a
  prompt-behaviour question a unit test cannot answer.

### The customer bot stopped sounding like a phone tree — 2026-09-01

Three merchant reports in one sitting, and they turned out to be one design
problem with three faces.

**The numbered menu is gone.** It opened with "Welcome to {shop}. Reply with a
number:" over a four-item list and routed 1-4 in code before any model call —
cheap, predictable, and read as a phone tree rather than as the shop. On this
channel the customer thinks they are talking to the business, so tone *is* the
product. The voice moved into the system prompt: match the customer's language
and dialect, greet someone who greets you, answer small talk like a person,
stay to a few sentences, never repeat an answer already given.

The one thing the menu actually *did* moved to a tool. Option 4 was not text, it
was a feature — pause the assistant, raise the escalation event, put the thread
in front of the merchant. `request_shop_owner` is that, and it is strictly
better: a model recognises "بدي أحكي مع صاحب المتجر" and "my order never
arrived" as the same request, where a digit only ever recognised `4`. The tool
records; the processor performs the pause and the event, next to where both
already lived. `customer-bot.copy.ts` is deleted — only language detection
survived it, as `customer-bot.lang.ts`.

**A model's reasoning went out to a customer.** The worst of the three, and
invisible in the logs. The turn loop reads "no tool calls" as "done answering",
which is right for every well-behaved turn and wrong for a model that narrates
instead of acting — so a customer received, on the shop's own number: "Okay,
the user keeps asking … According to the rules, I must reply in Arabic and only
use the tools. I've already used get_shop_info …". That is the system prompt and
the tool inventory handed to anyone who knows a public phone number.
`detectSuspiciousOutput` could never have caught it: it looks for credential
shapes, and there is no secret in that paragraph — the harm is that it is not a
reply. `detectReplyLeak` is the second tripwire, on three signals a genuine
reply cannot contain, with the tool names derived from the bound tools so a new
one is covered without anybody remembering.

**A burst is now one turn.** Three bubbles in five seconds were three turns.
Visibly that was three replies; the worse shape appeared once the throttle bit,
because then the *first* bubble was answered and the rest dropped — "مرحبا" then
"بدي آيفون ١٥" got a greeting, and the question vanished. Suppressing the extras
was the wrong instinct; the fix is to wait and read all of them. The message is
stored on arrival as always and only the reply is delayed, six seconds, kept low
because the assistant has already been reported as slow once. `CustomerBotCoalescer`
marks the newest id **in the producer** — a mark written in the worker lands
after the wait, when every job would see itself as newest — and the worker
checks it before spending throttle or quota.

The cost is stated rather than hidden: every message now reaches a model, where
a greeting and a menu tap were free. The per-number throttle and the
`ai.agent.customer` entitlement are what bound it.

- [ ] **The LLM has no fallback, and that is the root cause behind the reports
  above.** A rate-limited free model returns `200` with empty `choices`,
  LangChain crashes on `choices[0].message`, the turn dies and the customer gets
  silence. An in-turn retry shipped and is a patch, not a cure — retrying the
  *same* model inside a per-minute rate limit fails the same way, which is what
  the logs show. Needs a `fallback_model` on `AI_CHAT` and a chain in
  `ChatModelService`; the fallback must be paid. Full analysis:
  `docs/future-features/customer-bot-silent-failures.md`.
- [ ] **Watch the spend.** The menu used to absorb greetings for nothing and now
  they cost a turn. `ai.agent.customer` counts requests but carries no
  `cost_cents`, so there is no way to see the change in money — the same gap
  listed under the WhatsApp plan.
- [ ] The coalescing window is a constant, not a setting. If six seconds proves
  wrong for real traffic it needs a merchant-visible control, or at least an
  env var, rather than a deploy.
- [ ] `detectReplyLeak` withholds the reply and the customer gets silence. That
  is right for a leak and wrong for a merchant, who currently learns nothing —
  it should reach the inbox as a flagged turn.

### Order notifications speak Arabic, on both channels — 2026-09-01

Both catalogs now ship every event in `ar` and `en` — twelve WhatsApp bodies and
seventeen emails with their subjects — picked by `Order.language`, the shopper's
own locale, which the storefront already sends at checkout. Until this, a
customer who bought in Arabic got "Your order has shipped" on their phone, in
the merchant's name. Because both channels read the same field, one message
arriving twice cannot arrive in two languages.

**The language source was the whole decision, and two of the three candidates
died on inspection.** A shop has no default-language column, and `ShopLanguage`
cannot stand in for one: `ShopsService.insertShop` gives every new shop *both*
seeded defaults, so it is a set of two on essentially every row and answers
nothing. That leaves the order. An order carrying no language — one a vendor
typed in by hand — falls back to **Arabic**, a market judgement rather than a
technical one, isolated to `FALLBACK_TEMPLATE_LANG` so reversing it is one line.

Language picks the **default** copy only. A shop that wrote its own body gets
that body in every language: they replaced the platform's words with words meant
for their own customers, and re-deciding the language underneath them is the one
thing they did not ask for.

**The `ltr` filter is the part that would not have been noticed until a customer
complained.** `order_name` is `#1042` — a bidi-neutral `#` followed by digits —
and interpolated bare into an Arabic line the bidi algorithm resolves that
neutral against the surrounding RTL run and renders `1042#`. The filter wraps
the value in an isolate (U+2066 … U+2069); the catalog spec derives the check
from the catalog itself, so an Arabic body added later that forgets it fails in
CI rather than in someone's chat thread. The greeting is the other half of the
same problem: `buildOrderContext` fills a missing name with the English word
`there`, which reads as "شكراً لطلبك، there!" — translated per language, while a
real customer's name is never rewritten.

**The email side had a second one of these: a totals table has a side.** The
label sits on the reading edge and the amount on the far one, and in Arabic both
are the other way round — so the shared HTML fragments became functions of the
language rather than constants. `endSide` spells the answer physically
(`left`/`right`) instead of logically (`start`/`end`), because Outlook does not
support the logical keywords and would have rendered every Arabic total against
the wrong edge while the CSS looked correct.

- [ ] **Per-language overrides are not built** — a shop customizing a body
  overrides both languages at once. Needs a template row per language (the
  unique key gains it) and an editor with a language switch.
- [ ] Nothing tells a vendor which language a notification went out in; the
  inbox shows the thread, not the dispatch.

### "Typing…" on WhatsApp while an assistant is writing — 2026-08-29

Both bots answered out of silence: a model call runs for seconds to tens of seconds and the person holding the phone saw nothing until the reply landed. Both turns now run inside `WhatsAppTypingService.during(target, work)` — the vendor bot around `agent.chat`, the customer bot around `bot.answer`, each on the instance that will carry the reply.

**The shape is dictated by Evolution's endpoint, not chosen.** `POST /chat/sendPresence/{instance}` (probed live against 2.3.7: `{number, presence, delay}` → `201 {"presence"}`) **blocks for `delay`** — its handler sends the presence, sleeps, sends `paused`, then answers. So the provider holds the beat and the service loops on it rather than running a timer of its own, with an elapsed-time guard because a provider that answers early (the console sink; a fast refusal) would otherwise turn that loop into a spin against a live server. It also **always clears at the end**, so stopping early is a `paused` with a zero hold — there is no way to send a bare presence frame.

The non-obvious one: **a beat outlives the turn it belongs to.** A turn ending after four seconds leaves a beat held for six more, and the `paused` it eventually sends would land on top of the *next* turn's indicator and kill it. Beats for one chat are therefore chained — a new turn's first beat waits for the previous chain to settle instead of racing it. Everything is decoration and fails as such: one refusal ends the indicator quietly, a 120-second ceiling stops a hung turn leaving a number typing forever, and a session that is not `connected` gets a null target and no beats. `sendPresence` is on `IWhatsAppTransport` (the console sink logs and returns), and `WhatsAppService` logs it at `debug` rather than `error` — a beat every ten seconds on a dropped session is the noisiest possible page. 10 new tests.

- [ ] **`MESSAGES_UPDATE` is the event most worth adding next.** `WhatsAppSendProcessor` counts a send as delivered when Evolution *accepts* it, which is not delivery — this event carries the ack (`SERVER_ACK` / `DELIVERY_ACK` / `READ` / `ERROR`) and is what the customer inbox and order notifications actually need.
- [ ] `LOGOUT_INSTANCE` reads as a plain `connection.update: close` today, so "the phone is off" and "the vendor unlinked the device" are the same state on screen — only one of the two is fixed by waiting.
- [ ] `CALL`: a business number receives calls nobody answers. An auto-reply pointing at chat is a few lines behind that event.
- [ ] **`base64: true` on every instance's webhook subscription** (`EvolutionSessionAdapter.WEBHOOK_EVENTS` block) ships every image and voice note into a receiver that reads only text and captions. Turn it off until media is handled, or handle it.
- [ ] The customer bot clears its indicator when the model finishes, but the reply then goes through `WhatsAppSendQueue` — so there is a gap between "stopped typing" and the message arriving. Fine while the queue is idle; worth revisiting if it ever backs up.
- [ ] No processor spec covers the wiring on either bot (neither has one at all) — the indicator is pinned at the service and adapter level only.

### COD became an order-level obligation with per-fulfillment allocations — 2026-08-24

A cash-on-delivery order split across two warehouses handed **the full order total to both couriers**: `ShipmentsService` computed the COD amount from `order.total_cents`, per shipment, with nothing deduping across the order. A 300 SAR order collected 600. Nothing at the carrier catches that and there is no COD settlement table, so it surfaced as a complaint, not an alert.

The fix is architectural rather than a guard: **the order holds the obligation, an allocation holds one fulfillment's share of it, and a shipment collects a share it has claimed.** The new `src/cod-allocation/` module owns the middle term — a `CodAllocation` row per fulfillment (`fulfillment_id` unique), written inside the same transaction that writes the fulfillments, whose amounts always sum to the obligation. `apportionCod` is a pure largest-remainder split in BigInt, weighted by merchandise value and apportioning the *whole* total so shipping/tax/discount ride along proportionally.

Two properties were the point. **Order-independence:** fulfillments are read sorted by id, never by booking order. **Immutability of what is committed:** a share already claimed is frozen and subtracted from the pool, so a fulfillment created later takes the remainder rather than re-splitting money a courier was already told to collect. The claim itself is a conditional `UPDATE ... WHERE consumed_by_shipment_id IS NULL` issued *before* the carrier call, so concurrent bookings are settled by the database and the loser collects 0 — which also closes the double-clicked-button case without a `@@unique([fulfillment_id])` on `Shipment` that would have contradicted the documented multi-shipment-per-fulfillment design. Cancel and booking failure release the share back to its **own** fulfillment, never onto a sibling.

Deliberately deviated from the plan in two places, both forced by the code: allocation is *incremental* rather than one-shot (partial fulfillment is a real feature here, so a later fulfillment allocates from the remainder), and duplicate protection lives on the money rather than on `Shipment`. The test that pinned the old behaviour was deleted in the same change, as the analysis doc required. Green: 4289 back-end tests (36 new), `check:di`, lint clean on the touched files. Docs: `back-end/docs/features/cod-allocation.md`, `back-end/docs/features/shipments.md`, [docs/future-features/cod-split-order-double-collection.md](docs/future-features/cod-split-order-double-collection.md).

- [~] **The table is not in any database yet.** `db push` runs on deploy, so production picks it up on the next one. The local Docker database was pushed on 2026-08-24 and the API is healthy again — the miss is worse than "COD booking fails": `SchemaDriftService.onApplicationBootstrap` **halts the whole boot** on a missing table, so `zaydak-api` came up and never listened on 3000. There is still no `prisma/migrations/manual/*.sql` for `cod_allocations`, so any other local database (or a fresh `pgdata` volume) hits the same dead boot.
- [ ] **No COD settlement exists.** A share on a cancelled shipment nobody re-books stays as an unclaimed allocation — visible, but never collected and never reconciled against what the carrier actually remitted. That is the honest state, not a resolved one.
- [x] **A partially cancelled COD order still over-collects** — resolved: `codObligationCents` in `cod-allocation.service.ts` subtracts `cancelled_amount_cents + cancelled_tax_cents + cancelled_delivery_fee_cents` from `total_cents`, preventing courier over-collection.
- [ ] No integration test walks order → fulfillments → allocations → shipments → OTO payload as one chain; the pieces are unit-tested and the seam between them is not.

### The country was free text where OTO wanted a code, and one reason stood in for six — 2026-08-27

Reported again as "OTO is enabled but the storefront shows no shipping companies", with `carrier_unavailable_reason: "destination_not_covered"` on a Gaza / Palestine address. That reason was correct for that address — OTO's carriers price Saudi lanes — but the investigation turned up two defects behind it that would have emptied a perfectly deliverable Saudi lane just as quietly.

**A country reached the carrier as whatever a human typed.** `ProviderAddress.country` has been documented as ISO-3166-1 alpha-2 since the interface was written and `InventoryLocation.country` says the same in the schema; nothing enforced either, so `checkOTODeliveryFee` was receiving `Palestine`, `Saudi Arabia`, `KSA`, `المملكة العربية السعودية`. OTO documents those fields as **optional**, which is what made it silent: a value it cannot parse is not an error anyone sees — the lane prices as nothing, `deliveryCompany` comes back empty, and that is indistinguishable from real non-coverage. `country-code.helper.ts` resolves any spelling in either language into the code and **drops** what it cannot resolve, applied where a `ProviderAddress` is built and again inside the adapter. Its table is swept out of `Intl.DisplayNames` rather than hand-written, so it covers what CLDR knows instead of what somebody remembered. `originCountry` was never sent at all — the quote passed a city and no country — and now rides along from the warehouse.

**`destination_not_covered` was a catch-all that blamed the shopper.** `CarrierQuoteService` returned a bare `[]` for six different situations and `checkout.verify` guessed between them from the shape of its own inputs: anything that was not a warehouse fault became "the carriers do not deliver to this address" as long as the address had a city. A platform with no carrier integration, a carrier that timed out, and a merchant who had switched every company off all read as the shopper's address being wrong — which is exactly the wrong place to send someone looking. The service now returns `{ quotes, reason }` and the caller reports it verbatim, keeping only the two warehouse faults for itself because those are properties of the plan and never reach the carrier call. `no_carriers_enabled` short-circuits before the carrier call, and the storefront groups every behind-the-counter fault onto one line while `destination_not_covered` keeps its own — it is the only one the customer can act on.

Third thing found on the way: the quote cache keyed on the destination **city alone**, so Tripoli in Libya and Tripoli in Lebanon were one entry and the second address quoted got the first one's price. The resolved country is now part of the key.

Green: back-end 4369 / 257, storefront 273 / 28; `tsc -p tsconfig.build.json`, `schema:generate`, 0 lint errors in the touched files.

- [ ] Nothing validates the destination city against OTO's coverage. The docs expose `availableCities` / `getCities` — the cities the account's active contracts actually serve — and an unknown city still returns an empty list that reads as `destination_not_covered`. Same shape as the country bug, one field over.
- [ ] `rate()` sends weight and no dimensions while `createOrder` sends `boxLength/boxWidth/boxHeight`, and OTO prices on the greater of actual and volumetric weight. Only bites when the merchant types real box dimensions at booking, which nobody knows at quote time — but the customer's price and the merchant's cost can then differ with nothing recording it.
- [ ] A country the helper cannot resolve is dropped, so the carrier applies its own default — domestic. A genuinely foreign address with an unrecognised country name would be quoted as if it were local. CLDR coverage makes this narrow, not impossible.
- [ ] `schema.gql` was 66 lines stale when this ran — the WhatsApp module's types had never been regenerated. Nothing in CI runs `schema:check` yet, which is the guard that exists for exactly this.

### Carrier quotes price the shipments the order will actually create — 2026-08-27

The first cut priced from the shop's **default** warehouse, which was wrong twice over: the origin was usually not the one that ships (allocation picks by depth of stock, not by a default flag), and a split order was quoted once while costing the merchant two bookings. Neither error was visible to anyone — under pass-through pricing the merchant's delivery margin is zero by design, so every difference is a straight loss they cannot see.

`CarrierQuoteService.quote()` now takes the **fulfillment plan** instead of a city and a weight, and prices each expected parcel from its own warehouse. No second allocation algorithm was written: `checkout.verify` was already calling `planForLines` read-only, from the same engine order creation uses, and order creation re-plans against current stock before re-quoting. The fee is the SUM of the legs, `legs` records what each contributed and from where, and an option not quoted by **every** leg is dropped — a company covering one warehouse and not the other cannot deliver the order, and a total missing a leg undercharges by exactly that parcel.

The customer is told before paying: `package_count` rides on each option and the picker says "ships in N packages" under the price.

The cache moved from `(city, weight)` to a hash of the whole plan. The old key would serve a price computed for one warehouse to a cart since allocated to another — a wrong number, not a stale one.

Observability, so the next decision has data instead of guesses: `Shipment.quoted_cost_cents` and `quoted_origin_location_id` beside `actual_cost_cents`, and `orderShippingEconomics` gained `quotedCostCents` and **`quoteDriftCents`**. That last one earns its place because subsidy and margin both compare against the CHARGE, which under pass-through equals the quote by construction — so neither can ever reveal a quote that was wrong. A parcel shipping from a warehouse the quote did not cover is logged, not refused: turning away an order already paid for is worse than shipping it and recording that the origin moved.

Green: back-end 4330 / 255, build, schema:check, check:di. Analysis and the options that were rejected: [docs/future-features/carrier-quote-origin-mismatch.md](docs/future-features/carrier-quote-origin-mismatch.md).

- [ ] Apply `2026-08-25-shop-delivery-channels.sql` and `2026-08-25-shipment-quoted-cost.sql` — both written and idempotent, neither run (Docker was down).
- [ ] The preview-vs-actual difference is logged but never escalated. No business rule yet for "materially different" — it needs the drift data above first.
- [ ] Cost of `verifyCheckout` on a cold cache is unmeasured: one `planForLines` plus one `rate()` per parcel. The cache absorbs repeats, but the first request on a new lane pays it all.
- [ ] A warehouse with no city silently suppresses every carrier option for that cart. Correct, but the merchant is never told their location is missing a field.
- [ ] Storefront shows the package count but not the per-parcel breakdown the API now returns in `legs`.

### Customer chooses the delivery channel — merchant or carrier — 2026-08-25

A shop had ONE exclusive shipping mode and the customer never saw which side it was on. Now both channels are offered side by side and the customer picks: the shop's own delivery at the shop's rate, or a shipping company at that company's **live price, passed through untouched** — no markup, by explicit decision.

The merchant controls what appears (`offers_merchant_delivery`, `offers_carrier_delivery` — independent, both-off allowed for a downloads-only shop). `shipping_mode` stays as how a shipment is EXECUTED and as the fallback for orders frozen before channels existed; the migration backfills the carrier flag from it so nobody's behaviour changed on deploy.

Four decisions carry the risk, and each is the difference between a feature and an incident. **A carrier can never fail the checkout**: every path in `CarrierQuoteService` returns `[]` behind a 3s timeout, cached 5 min per (origin, destination, weight bucket) because `verifyCheckout` re-runs on every keystroke. **The price is re-quoted server-side at order creation**, never taken from the client — the customer was shown a number, and trusting it back would let anyone name their own delivery fee. **Booking honours the exact `deliveryOptionId` or refuses** with `CHOSEN_CARRIER_UNAVAILABLE`, because substituting a cheaper company delivers a service they did not buy and they find out from the tracking page. And **missing product weight falls back to a shop-set default**, since carriers price on weight and a weightless cart quotes at the carrier minimum with the shop absorbing every real parcel.

Worth recording: the domain-isolation guard fired on `orders` and `checkout`. All three hits were prose where I had used a carrier's name as an example — the code named none. The guard was **not** weakened; its value is that it is blunt and needs no judgement, and an exemption for "just comments" is exactly the "just this once" door its own doc warns about. The comments were reworded instead.

Green: back-end 4326 / 255, storefront 268 / 28, vendor 557 / 45, build, schema:check, check:di, 0 lint errors in the touched files.

- [ ] Apply `2026-08-25-shop-delivery-channels.sql` — written and idempotent, not yet run (Docker was down).
- [ ] Decide the origin question: quotes price from the DEFAULT warehouse while allocation ships from the DEEPEST, and a split order is quoted once but ships twice. Full analysis and options in [docs/future-features/carrier-quote-origin-mismatch.md](docs/future-features/carrier-quote-origin-mismatch.md) — the split-order half should not wait for the data.
- [x] `maxCodCents` now comes back on every quote and is still ignored. — resolved: surfaced `max_cod_cents` on GraphQL `CheckoutShippingOptionEntry` and rejected COD orders with `carrier_cod_limit_exceeded` in `orders.service.ts` if order total exceeds carrier quote limit.
- [ ] Nothing shows the merchant the gap between what a customer paid for shipping and what the carrier charged. With pass-through pricing their margin is zero by design, so every quote error is a straight loss they cannot see.
- [ ] The vendor card's strings are hardcoded English — it predates being wired into the feature's i18n namespace.

### Carrier options never reached checkout — four defects behind one blank list — 2026-08-27

Reported as "OTO is enabled but the storefront shows no shipping companies". Everything the merchant could see was configured: carrier delivery on, all ten carriers enabled, one warehouse registered and Ready to ship. Four separate defects, each of which alone was enough to produce the same empty list with no explanation anywhere.

**The quote was gated on an unrelated inventory setting.** `checkout.verify` handed the allocation engine only STOCK-GATED lines — untracked and oversell lines are deliberately excluded so the engine cannot veto them — then built the expected parcels from the resulting plan. A shop whose products are untracked planned nothing, expected no parcel, and was never quoted. `resolveExpectedShipments` (`shipping-providers/expected-shipments.helper.ts`) now takes every shippable line, and when there is no plan at all it falls back to the shop's own warehouses: one registered with the carrier first (booking refuses an unmapped one), then the default, then the oldest, each filtered to those that have a city.

**`checkout.verify` and `createOrder` had drifted into different answers to the same question** — checkout refused to quote when a warehouse had no city, order creation silently dropped that leg and totalled the order short by exactly one parcel. One helper now serves both, so the quote and the re-quote cannot disagree.

**The delivery-channel flags gated display but not pricing.** A shop with `offers_merchant_delivery: false` kept its zones on file (correctly — pausing a channel must not destroy the rates), and both `verify` and `createOrder` read a fee out of them anyway, refused at a zone wall built for a service the shop no longer performs, and reported `shipping_available: false` for every address on earth while the carrier list worked.

**A carrier pick was priced as a merchant rule.** `carrier:<company>:<optionId>` never matches a rule cuid, so it fell through to `rules[0] ?? null`: the summary quoted the shop's own rate or zero, and the order was then created at the carrier's real price. The customer agreed to one number and was charged another.

Reporting was the fifth thing wrong. `carrier_unavailable_reason` was already computed and already in the schema, and the storefront never passed it to the picker — which was itself gated on `length > 0`, so the explanation had nowhere to appear. `no_location` joins the reasons, the picker renders for a reason alone, and the vendor pane no longer tells a carrier-only merchant that "no shipping is configured" (`diagnose` takes the channels) while the pickup card names any warehouse missing a city.

Green: back-end 4347 / 256, storefront 268 / 28, vendor 560 / 45; build, schema:check, check:di, 0 lint errors in the touched files.

- [ ] The origin fallback for an unplanned order is a guess — the merchant ships from wherever they like, and nothing measures the gap between the warehouse quoted and the one that shipped.
- [x] `orders.createOrder` still refuses at `shipping_destination_not_served` before the carrier branch runs, so a shop offering BOTH channels with a zone wall blocks an order a carrier could carry. Only carrier-only shops are exempt today. — resolved: evaluated `carrierPick` ahead of merchant zone check, bypassing merchant zone refusal when the customer selects a valid carrier quote.
- [ ] The city is matched as a free string at both ends. "Riyedh" quotes nothing and "Riyadh" quotes five companies, with nothing in the product connecting the two — the registry lookup could normalise it on save.
- [ ] `location_has_no_city` names the warehouses server-side (`unpricedLocationIds`) and nothing carries them to the merchant; the vendor pane re-derives its own list from the locations query.

### Customer picks the delivery channel — live carrier prices at checkout — 2026-08-25

> **Closing list:** [docs/future-features/oto-remaining.md](docs/future-features/oto-remaining.md) — everything still standing between this code and a full test, ordered by what blocks what. The open boxes below are the detail; that file is the sequence.

A shop now offers its own delivery, live carrier prices, or both side by side, and the customer chooses. `Shop.shipping_mode` used to be one exclusive switch the customer never saw; two independent flags (`offers_merchant_delivery`, `offers_carrier_delivery`) replaced it as the thing that decides what is SHOWN, and the mode survives only as the fallback for orders frozen before a channel existed.

`verifyCheckout` returns both kinds in one list with a `channel` on each. Merchant options are priced by zone rules; carrier options are the carrier's price **passed through untouched** — the pricing decision taken with the user, because a markup opens "who earns it" and can wait. The customer's pick is frozen on `Order.shipping_method` as `source: 'carrier'` with the exact `deliveryOptionId`, and booking honours it or refuses with `CHOSEN_CARRIER_UNAVAILABLE`: substituting a cheaper company delivers a service they did not buy, and they find out from the tracking page.

Four decisions carry the risk. Order creation **re-quotes** rather than trusting the client's price — anyone could otherwise name their own delivery fee. The quote **cannot fail the checkout**: every path returns `[]` inside a 4s budget, so a slow carrier costs the options, not the order. It prices the **fulfillment plan** — one quote per warehouse, summed, and only options every leg can carry survive; pricing from a single default warehouse was wrong twice over ([carrier-quote-origin.md](docs/future-features/carrier-quote-origin.md)). And a missing product weight falls back to a **stated per-shop assumption** rather than a silent zero, which would have quoted at the carrier minimum and had the shop absorb the difference on every real parcel.

Also fixed: three separate causes were producing the same empty carrier list with no explanation — an unpriceable warehouse, an uncovered destination, and a slow carrier. `carrier_unavailable_reason` now names which, because only one of the three is anyone's to act on. And the location's city is **adopted from the national-address registry** on registration: carriers match city as a string, so "Riydeh" quoted nothing while "Riyadh" quoted five companies, and the merchant had no way to connect the two.

Vendor UX: the exclusive "Shipping method" card was removed. It asked *I deliver* OR *a carrier delivers* directly above a card saying both could be offered — the screen contradicted itself. The zones card is renamed for the channel it prices, and the carrier cards appear only while that channel is on.

Green: back-end 4330 / 255, storefront 268 / 28, vendor 557 / 45; build, schema:check, check:di, 0 lint errors in the touched files.

- [ ] The plan can change between quote and order creation (someone else buys the last unit at the quoted warehouse). The price is frozen for the customer, correctly, and the merchant absorbs the difference unmeasured.
- [ ] One parcel per warehouse is assumed. A large single-warehouse cart needing two boxes is quoted as one.
- [x] `maxCodCents` comes back on every quote and is ignored. A COD order above a carrier's ceiling can be refused before the customer picks rather than at booking. — resolved: surfaced `max_cod_cents` on quote entry and rejected with `carrier_cod_limit_exceeded` at order creation.
- [ ] Nothing warns a merchant when the booked cost differs from the quoted one. `Shipment.actual_cost` and `orderShippingEconomics` already hold the data.

### National address on the customer's address too — 2026-08-25

The warehouse end had a national address; the receiving end did not. A carrier resolves the exact building from the code, so having it only on one side gets the parcel collected precisely and delivered approximately.

Cheap, because `Address.address` and the order's frozen `shipping_address` are both schema-less JSON — **no migration**. The field is added to the storefront's `addressSchema` (the contract those three readers share), read back under three spellings since more than one path writes that blob, and handed to OTO as `customer.shortAddressCode`. Their docs say the city and address lines become unnecessary once both short codes are present; we send the lines anyway, and a test pins that — trusting the code alone would make every non-Saudi order unshippable.

The notable server change is the guard. `lookupNationalAddress` was `MANAGE_OWN_SHOP`, which a customer does not hold — so the address form where a wrong code costs the most was the one place it could not be checked. It is now `JwtAuthGuard` + throttled at 30/min: every screen that collects an address already requires a session, so this costs nothing and closes the bigger risk of an unauthenticated proxy onto the carrier's endpoint billed to the platform.

Unlike the merchant field, this one **blocks nothing** — an unrecognised code is stated softly and the customer still saves and checks out.

Also hardened `sameAddress`, which compared every key of `EMPTY_ADDRESS` and threw on an address saved before a field existed. Pinned by a test.

Green: back-end 4310 / 254, storefront 268 / 28, typecheck and lint clean on both.

- [ ] Nothing prompts a customer who skipped the code, even in Saudi Arabia. A soft nudge at checkout when the country is SA would raise coverage without making it required.
- [ ] The vendor's manual order-creation screen writes `shipping_address` too and has no such field, so an order typed by a merchant carries no code.
- [ ] The resolved address is shown but never used to correct the typed street lines. Offering "use this address" would remove a class of mismatch between the two.

### OTO blamed the city for a missing email — carrier pickup now registers — 2026-08-25

The first real press of "Enable carrier shipping" failed, and the carrier's own error sent us to the wrong field:

```
otoErrorMessage: "City information is missing or invalid"
errorMsg: "name, code, mobile, city, country, contactName, contactEmail and address must be provided"
```

The city was never wrong. `contactEmail` is required by `createPickupLocation` and the adapter did not send it. Proved by two sandbox calls differing in exactly that field — the first answered 400 with the same city complaint, the second answered `200 {"warehouseId":"31866","success":true,"message":"warehouse has been created"}`. Reading the error alone would have cost hours on a correct address.

The contact is the **shop owner's email**: a location has no email column, and a synthetic no-reply would be worse than refusing — this is the person a carrier writes to about a pickup that did not happen. Missing it now refuses with `owner_email` named, alongside the existing `national_address_code` and `phone` checks. All three messages live in one map, precisely because forwarding the carrier's wording is what caused this.

Green: 4308 tests / 254 suites, check:di, schema:check, build, 0 lint errors.

- [ ] Deploy and press the button once — production runs the pre-fix code, so it still fails with the city message. Production's OTO token is confirmed **sandbox**, so this is safe to retry there.
- [ ] `zaydak-probe-b1` was created in the OTO sandbox while proving the fix. OTO publishes no delete; remove it from their dashboard if it gets in the way.
- [ ] Every warehouse of a shop registers under the same owner email. Fine today; a shop whose warehouses have different site managers will want a contact per location.

### A merchant had no way to get a pickup location — national address closes it — 2026-08-25

PHASE 6-B moved the carrier account to the platform and left a hole nobody had walked through yet. The location-mapping card still asked the merchant to type "the carrier's own pickup code" — a value only a carrier login produces, and after 6-B they have no login. The platform's own OTO account confirmed it from the other side: `getPickupLocationList` answered `{"warehouses":[],"branches":[]}`, because nothing in the product had ever created one. Every carrier booking would have failed on `pickupLocationCode` regardless of how correct the rest of the code was.

Found while trying to run the sandbox round-trip, and closed the way the user asked: an **additional** field rather than a replacement, and an **explicit button** rather than an automatic side effect.

The Saudi National Address turned out to be the right input, and OTO already exposes it: `getNationalAddressFromShortCode` takes eight characters and returns street, district, building number, secondary number, postcode, city and coordinates — every field `createPickupLocation` wants, from the official registry rather than a text box a courier cannot rely on. Verified live: `RGUC8214` and `RHOD3474` resolve, a bad code answers 409.

`InventoryLocation.national_address_code` is additive beside the free-text address columns (those are read elsewhere, and the platform may serve countries with no such registry). `CarrierPickupService` resolves the code and registers the warehouse upstream, storing the returned code in `ShippingProviderLocation` — the merchant never sees it. Registration is idempotent (the carrier publishes no delete, so a second call would leave two records nobody could tell apart), writes upstream before our row, and refuses with the field named when the location has no address code or no phone.

Vendor UI: `NationalAddressField` shows the resolved address as the merchant types — status derived, not stored, so a corrected code cannot inherit the previous verdict's green tick — and `CarrierPickupCard` replaces `LocationMappingCard` with one button per unregistered warehouse. A registered row reads "Ready to ship" as text rather than a toggle, because the pickup location cannot be deleted upstream and offering to turn it off would promise a reversal we cannot perform.

Green: back-end 4307 tests / 254 suites, check:di, schema:generate, build; vendor 557 tests, typecheck, 0 lint errors. Migration `2026-08-25-location-national-address.sql` applied locally.

- [ ] Press the button once against the sandbox — the lookup half is verified live, the `createPickupLocation` half is tested but has never run against OTO. It is the last thing standing between here and the booking round-trip.
- [ ] A pickup location registered at the carrier cannot be deleted through their API. Decide the cleanup story before a shop deletes a warehouse: today the upstream record simply outlives it.
- [x] Renaming or re-addressing a location does not update the carrier. `updatePickupLocation` exists in OTO's API and is not called. — resolved: implemented `updatePickupLocation` in `OtoProvider`, `CarrierPickupService.updateCarrierPickup`, and exposed GraphQL `syncCarrierPickup` mutation.
- [ ] `mapShippingProviderLocation` still accepts a hand-typed code. Keep it as an operator escape hatch or retire it — no screen calls it now.
- [ ] The national address code is Saudi-only. A second country needs either its own registry or the free-text path re-enabled for carrier pickup.

### OTO's own docs corrected three things the code had guessed — 2026-08-24

The published Postman collection (apis.tryoto.com) was read properly for the first time, endpoint by endpoint, against a live sandbox. Three findings, two of them blocking, one of them a reversal of a decision recorded in this file.

**1. The booking filter read a field OTO never sends.** `getDeliveryOptions` returns `options[]` with `name` / `integrationName`; `checkOTODeliveryFee` returns `deliveryCompany[]` with `deliveryOptionName` / `deliveryCompanyName`. `pickDeliveryOption` read `deliveryCompany` from a `getDeliveryOptions` response — always empty — so **every** booking would have refused with `NO_ENABLED_CARRIER_FOR_DESTINATION`, customised shop or not. `optionList()` and `optionCompany()` now reconcile the two shapes in one place, and both the settings list and the booking filter run the same accessor, which is the only thing keeping their carrier codes in agreement.

**2. `getDeliveryOptions` takes `city` as well as `orderId`** — they are mutually exclusive, and sending neither (what the adapter did) answers 404 on every account. That is the documented way to list contracts with no order in hand, and it is the only endpoint that reports contracts the platform negotiated directly: `checkOTODeliveryFee` returns prices "applicable only to shipping options available under OTO's contracts", per their docs. `carriers()` now asks `?city=` first and falls back to the fee endpoint, so an account with its own contracts is no longer misreported as an OTO-rates account. Our sandbox is the latter — 404 on every city — which is why the fallback is exercised in practice.

**3. `cancelOrder` cannot cancel a booked shipment, reversing an earlier call.** The docs: *"If the order has an associated shipment, it cannot be canceled via this endpoint."* Two-step booking means a booked shipment always has one, so the adapter's `cancelOrder` was guaranteed to fail for the only case that matters. The earlier reasoning — one OTO order per Shipment, so they are equivalent — was made under the one-step model and did not survive the change. Now `cancelShipment({orderId, shipmentId})`, with `cancelOrder` kept as the fallback for an order stranded between the two booking calls. OTO's `shipmentId` is not in the `createShipment` response, so it is fetched from `orderStatus` on demand.

Also shipped: carrier **logos**. OTO publishes one per carrier on a public bucket (all 10 present, all 200 image/png); `safeLogo()` keeps a value only if it parses as an https URL because it reaches an `<img src>`, and the vendor card renders name-only when there is none.

Green: 4298 tests / 253 suites, check:di, schema regenerated, vendor 543 tests + typecheck + codegen, 0 lint errors. `carriers()` re-verified live: 10 carriers with names and logos.

- [ ] Book one shipment end-to-end on the sandbox. Findings 1 and 3 were both found by reading, not by a round-trip — the booking path has still never run against OTO, and a `createOrder` + `getDeliveryOptions?orderId=` + `createShipment` + `cancelShipment` cycle is what would confirm them.
- [ ] `createShipment`'s documented response is only `{success, message}` — no `otoId`, no `trackingNumber`. The adapter reads both and falls back to the `createOrder` response for `otoId`, but the tracking number may simply never arrive that way; confirm against a real booking and read it from `orderStatus` if not.
- [x] `maxCODValue` / `codCharge` / `maxOrderValue` come back on every option and are ignored. An order above a carrier's ceiling is refused at booking with no warning beforehand. — resolved: mapped into `maxCodCents` on carrier quote entry and validated at order creation time with `carrier_cod_limit_exceeded`.
- [ ] `OWN_CONTRACT_CITIES` and `PROBE_ROUTES` are hardcoded Saudi cities. Revisit before serving a second country.

### Carrier list read the wrong OTO endpoint — fixed against a live sandbox — 2026-08-24

The first real credential went in and the vendor's carrier card could never have loaded. `carriers()` called `GET /rest/v2/getDeliveryOptions` with **no `orderId`**, which answers **404** on every account — the endpoint is scoped to one order by design, and a merchant configuring their shop has none yet. It was written from the booking flow, where an order does exist, and nothing caught it because the test mocked the response instead of the endpoint's contract.

Found by probing the live sandbox rather than by reading. The same run settled three more things that had been assumptions: `dcList` answers **403 OTO1150 "upgrade your plan"** (so the plan's decision to avoid it was right for a second reason — it is not even reachable); `checkOTODeliveryFee` answers **200** with the account's real contracts; and coverage is **per-route**, not a fixed list — the same account offered 11 options inside Riyadh, 8 to Dammam, 5 to Jeddah, 3 from Jeddah to Abha. `carriers()` now probes a small spread of domestic lanes and unions them, skipping a failed lane rather than throwing, caching ~10 min, and deliberately not caching an empty result (four failed probes look identical to an account with no contracts).

Also corrected: `deliveryCompanyName` is already a slug (`secom`, `kwickbox`, `otoDriverApp`) and was being shown to merchants as the display name — someone looking for SMSA would have been reading "secom". The human name is on the *option* (`SMSA Express`), so the shortest option name per company is now the label, while the slug stays the key both the settings list and the booking filter match on. SMSA's three services correctly collapse to one company.

Green: 4294 tests / 253 suites, check:di, schema:check, build, 0 lint errors. The `carriers` spec now encodes real captured payloads and pins the endpoint choice itself, so the same mistake cannot pass again.

- [ ] Verify the rewritten `carriers()` end-to-end against the live sandbox — the code change is tested but the round-trip was blocked mid-verification when the Docker engine stopped.
- [ ] `PROBE_ROUTES` is four hardcoded Saudi lanes. Revisit if the platform serves a second country: the union would silently miss carriers whose coverage is entirely outside them.
- [ ] Booking picks the FIRST surviving delivery option, not the cheapest or fastest — and the live data shows the spread is wide (15 to 250 SAR on one lane). Decide the ranking rule, and whether the merchant chooses it.
- [ ] `maxCODValue` and `codCharge` come back on every option and are currently ignored. A COD order above a carrier's ceiling will be refused at booking with no warning beforehand.

### Carrier options were missing for one reason, and the quote path is now proven live — 2026-09-05

Reported from a real checkout: `ahmed-electronics` showed no shipping companies. Traced through the six gates in `CarrierQuoteService` against the live database rather than by reading: **`offers_carrier_delivery` was `false`** — gate three, `not_offered`, and the storefront hides the picker entirely for that reason (correctly: "this shop does not offer carriers" is not news for a customer).

Everything else was already correct, which is what made it look broken: the OTO account was connected, enabled and **verified the same morning**; the default warehouse was in Riyadh with a national address code and phone and was **registered at OTO** (`zaydak-sy6l6tw8-jyylavvu`, created through `enableCarrierPickup`, not by hand); the product's stock sat in that exact location; and zero `shop_shipping_carriers` rows means allow-all, not allow-none.

The unsaved flag is the same defect fixed earlier the same day, one step on: before that fix, flipping the switch never revealed the credentials card, so a merchant connected the account through the card once it appeared and left the switch itself unsaved — the switch and the account are two different save paths on one screen.

**With the flag set, a real `verifyCheckout` returned seven priced options from the sandbox** — SPL PUDO 14.00, Safe Arrival 19.00, Stage Test 20.00, Adwar 22.00, three SMSA services at 66.55 SAR — with `carrier_unavailable_reason: null`. That exercises the whole quote chain end to end through our own code: `expected-shipments` → `CarrierQuoteService` → `resolve(shopId)` → the merchant's credential → `checkOTODeliveryFee` → the option list. It is the first time any priced OTO path has run through the app rather than a hand-built payload, and it closes the "does gate six even pass" question that the review document had open.

Booking is still unproven, and quoting passing says nothing about it — different endpoints, different payloads, and all three defects found so far were in booking. What changed is that nothing stands in front of the test any more.

- [ ] `ahmed-electronics` has `offers_merchant_delivery: true` with **zero zones and zero rules**, so its own-delivery channel prices every address at 0 and the storefront shows "this shop hasn't set a delivery rate for this address". That message blames the address; `selectShippingRule` returns null for a shop with no rules at **every** address on earth. Either give the shop a rate or turn the channel off.
- [ ] The flag was flipped directly in the local database to diagnose this. It is the correct value, but it was not set through the UI, so the vendor screen's save path for that switch is still unexercised end to end.

### The national address is the platform's; shipping stays each merchant's — 2026-09-05

The split the per-merchant reversal should have made and did not. **`lookupNationalAddress` was resolving on the shop's own carrier account**, so a shop that had not finished connecting OTO — or never meant to use a carrier at all — got `SHIPPING_PROVIDER_NOT_CONFIGURED` for an address lookup. With the storefront's address form built on the national short code, **its customers could not enter an address and therefore could not buy.** A merchant's shipping configuration was deciding whether their customers could check out, and nothing about it said so.

It was worse than one screen: the customer chat bot calls the same lookup to save a delivery address, and failed identically. That path was found by the compiler after the signature changed, not by the search that opened this.

**The rule now: the registry is national, the shipping is commercial.** A short code resolves to the same address for every shop, the endpoint is free, and no contract affects the answer — so `NationalAddressService` holds the platform credential and every caller goes through it. Booking, quoting, cancelling, carrier lists and pickup registration all stay on the merchant's own account, unchanged. `enableCarrierPickup` now straddles both on purpose: it **reads** the address on the platform and **registers** the pickup point on the shop's, because those are different acts and only the second is billed to anyone.

**There is no fallback to a shop's account**, and that is the point rather than an omission — a fallback would put two shops on two accounts for the same national registry, which is the inconsistency being removed. The service takes no shop id at all, so no missing one can matter.

**It does not reopen the platform credential for shipping.** The guarantee was never about which row exists, it is about which code can reach it: `ShippingProviderService` — the resolver for every booking, quote and cancellation — still takes no `IntegrationsService`. The new service exposes one method and that method returns an address. The module comment now says both things it imports `IntegrationsModule` for, and says the second is not a precedent for the first.

The consequence to plan for: **the platform SHIPPING row must be enabled and hold a working token**, since `resolve()` reads enabled rows only. It is no longer the "kept but disabled and unused" row of option C — it has one sanctioned job. With none configured the lookup refuses with a new `NATIONAL_ADDRESS_UNAVAILABLE` and an operator-facing message, rather than telling a merchant to connect an account that would not help.

Green: back-end **5201 tests / 308 suites** (+6 `national-address.service.spec`, pickup spec rewritten), `schema:check` (99 resolvers, unchanged — the shop scope was internal, never in the GraphQL contract), `check:di`, 0 lint errors in the touched dirs. The pickup spec's two lookup tests had been passing **vacuously**: they called the two-arg method with one argument, so the code was being read as the shop id and the mock returned the address regardless.

- [ ] Nothing seeds or checks the platform SHIPPING row on boot. Address lookup — including at customer checkout — silently fails for the whole platform if it is missing, and the first sign is a customer who cannot save an address. A startup warning, or the deployment-safety service, would name it before anyone hits it.
- [ ] `NATIONAL_ADDRESS_UNAVAILABLE` reaches the storefront and the chat bot with an operator-facing sentence ("try again later"). Fine for a customer, but the vendor dashboard shows the same words to the one person who might be able to escalate it.
- [ ] No manual address fallback still. The form remains national-address-only, so a customer outside the Saudi registry cannot buy — untouched by this, and now the ONLY remaining reason that is true. It is the decision recorded as item 5 in `oto-remaining.md`.

### The merchant had nowhere to put their OTO token — 2026-09-05

Reported from the screen itself: *"where do I add the key and the webhook here?"* The answer was nowhere. The card exists, is 303 lines, and was restored intact by the reversal — it just never rendered.

**The gate was the saved value; the switch stages.** `ShippingProvidersSection` gated the carrier cards on `settings.offers_carrier_delivery` from the server, while the switch that sets it stages locally behind the global save bar like every other edit in this app. So flipping "Shipping companies" on gave a switch that read ON, a warning saying no carrier prices would appear until an account was connected, and **no account form anywhere on the screen** — it appeared only after Save, and nothing said so. The merchant's next step was invisible at exactly the moment they went looking for it. `DeliveryChannelsCard` now reports its staged value up through `onCarrierStaged`, called from the change handlers rather than an effect so nothing sets state during another component's render.

**The mirror of the same bug**: gating purely on the channel meant switching it back off hid credentials already stored, so a merchant could not rotate or delete them without switching the channel on again. The account card now renders whenever an account **exists**, whatever the switch says — that switch is about what customers are offered, not about whether the shop has an account. The two dependent cards (which carriers, which warehouses) keep their own gate at enabled AND verified, the same rule the server enforces at booking.

**And the warning told them to wait for the platform.** "Carrier shipping is not connected on this platform yet … will apply once it is" was true while one platform-owned account served every shop, and became the exact opposite of the truth on 2026-08-31 — it named no action the merchant could take and pointed at one nobody was going to perform. It now names their own next step and where it is.

**The disabled-row question is settled: `callbackOrigin()` ignores `is_enabled`, `resolve()` does not.** The SHIPPING row is kept disabled on purpose so its credential can never book anything, which meant reading the origin through `resolve()` found nothing and no merchant's callbacks would ever have been registered. Both alternatives were worse — enabling the row would tell every later reader the platform credential is live, and moving the origin to `.env` would put half the integration back in the environment it was migrated out of. The split is safe because of what the method returns: one public URL, identical for every merchant, so reading it from a disabled row grants nothing that being disabled was protecting.

Green: vendor **675 tests / 58 files** (+6, a new `shipping-providers-section.test.tsx`) + typecheck + 0 lint errors; back-end **522 / 25** (+6 `callbackOrigin`) + 0 lint errors. Also corrected two stale post-reversal comments in `shipping-providers.resolver.ts` and the `SHIPPING` provider description, which the admin screen renders from the server and which still described one account serving every shop.

- [ ] The new section test mocks `CarrierSelectionCard` and `CarrierPickupCard` rather than exercising them — they run queries of their own and neither has a test of its own yet.
- [ ] Nothing tells a merchant the platform has no callback origin set. Verify reports success, the account works, and status callbacks silently never arrive; the log line is server-side only. The account card could say "status updates are not active on this deployment" from the same signal `no_origin` already produces.
- [ ] `carrier-selection-card.tsx` carries the feature's only lint warnings (two `exhaustive-deps` on an `offered` expression, one `no-img-element`). Untouched here and pre-existing.

### Verify subscribes a merchant's carrier account to its own callbacks — 2026-09-05

The per-merchant reversal left one hole big enough to make the feature look broken: **registration was manual**. `POST /rest/v2/webhook` had to be called once per connected account, by hand, so a merchant who pasted a working token got a working booking flow and then total silence — no status, no tracking, nothing that looked like a configuration problem. Under the old central account an operator registered one URL once; with a merchant-owned account there is no URL anyone can register on their behalf.

`verifyAccount` now does it as its last step, because that is the one moment the token is known to reach the carrier. New `registerWebhook?` on the provider interface (optional, beside `carriers?` and `createPickupLocation?`), implemented for OTO, driven by the new `CarrierWebhookService`.

**The find that changed the shape of it: OTO's create-webhook call takes a `secretKey` they then sign payloads with** — "Signs the message for receiver validation" — so the signing key is ours to generate, not something each merchant must obtain. That had been read the other way round: the credential help text said "the key OTO support shares", and `oto-remaining.md` still blocks on a support ticket for it. **OTO's own docs contradict themselves** (their webhook page describes a key "shared privately" by OTO), so both readings are handled rather than one being picked: a `webhook_secret` already on the account is registered as-is and never overwritten, and one is generated only when there is none. If the pessimistic reading is true, the first real callback fails its signature check and says so, and Refresh-tracking covers status meanwhile. That ambiguity is written into the adapter, the doc and the field help — not resolved by assertion.

Three things are pinned because each fails silently. **Idempotence**: `POST` creates unconditionally and returns a new id every time, so the list is read first — five presses of Verify would otherwise leave five live subscriptions delivering every event five times, and our own dedupe would absorb them, which is exactly what would keep it invisible until someone opened OTO's dashboard. **The merchant's key wins**: `mergeCredentials` refuses to overwrite a value a person put there, because generating over a pasted key registers one OTO does not know and breaks an account that was about to work. **Registration cannot fail a verification**: the two are independent facts, and reporting a good credential as broken would strand a merchant on a screen whose next step is unrelated.

**The callback origin lives in the integrations console, not `.env`** — corrected mid-review, and the original choice was the weaker one. Platform config was deliberately migrated out of `.env` into `integration_configs` precisely so an operator can change it without a redeploy, and `webhook_base_url` is already the shared field WhatsApp and AI_MEDIA use. What kept the reversal's guarantee intact is the *shape* of the read: `IntegrationsService.callbackOrigin(type)` is a new narrow window returning one non-secret string and no credentials, so the platform's carrier token is still unreachable from the shipping runtime. The guarantee was always about the credential, not the row — `ShippingProviderService` still takes no `IntegrationsService` at all, and that is where booking lives. `IntegrationsModule` had in fact been imported-but-unused in the module since the reversal, with a comment still describing a platform-owned credential.

Bookkeeping (`webhook_registered_url`, `webhook_registered_id`) rides in the existing encrypted credential blob — the provider schema is `.passthrough()` and `maskFor` only renders `spec.fields`, so it cannot leak into a response — which kept this at **zero migrations**, like the reversal it completes.

Green: 25 shipping/integration suites, **516 tests** (+19: 8 `carrier-webhook.service.spec`, 5 adapter, 3 `verifyAccount`, 4 credential-merge), 0 lint errors in the touched files, `check:di`, `nest build`. The stale `SHIPPING` provider description ("one OTO account books shipments for every shop") was corrected too — the admin screen renders it from the server, so it was telling admins the opposite of the architecture.

- [x] **`lookupNationalAddress` is shop-scoped, and it blocks buying.** — **fixed 2026-09-05**, see the entry above.
- [ ] **Never fired against real OTO.** The registration path is unit-tested against their documented shapes and has not been run once — the same gap that produced three of three defects found by reading rather than running. The `secretKey` question in particular is only settled by one live callback.
- [x] `webhook_base_url` on a row kept disabled by option C. — **resolved 2026-09-05**: `callbackOrigin()` ignores `is_enabled`, see the entry above.
- [ ] No de-registration. An account that is deleted or disabled leaves its subscription live at OTO, still posting to a receiver that will now 401 it. OTO publishes `DELETE /rest/v2/webhook`; nothing calls it.
- [ ] The stored `webhook_registered_url` is written but never read. It exists so a changed origin can be detected and re-registered; the comparison is unbuilt, so moving the origin needs a manual Verify on every account.
- [ ] `oto-remaining.md` still blocks on "request the webhook signing key from OTO support" (item 4) and still says one URL serves the whole platform — both pre-reversal. It is the file the closing sequence is read from, so it needs rewriting before it is trusted again.

### Each merchant connects their own OTO account — PHASE 6-B reversed — 2026-08-31

The carrier account went back to the merchant. PHASE 6-B had moved it to the platform (the Salla / Zid model); the decision now is the opposite one, and it is a legitimate trade the entry below states in full: the platform carries no shipping liability and each merchant is billed on their own contract, at the cost of every shop needing an OTO account before it can ship — which is precisely the friction the aggregators centralise away.

**It cost zero migrations, and the reason is a constraint that was written down five days earlier:** *"do not delete or repurpose the account rows before checking production counts."* That forced PHASE 6-B's schema delta to be purely additive, so `ShippingProviderAccount`, its 412-line service, the `account_id` foreign key and all five resolver operations were still there, intact. The reversal was a re-wiring, not a rebuild.

Four `integrations.resolve(IntegrationType.SHIPPING)` call sites became `accounts.enabledAccount(shopId)` + `credentialsFor()`, and **`resolve()` returns a real `accountId` again** — it had been hard-null since 6-B, which meant every carrier `Shipment` was written with `provider_account_id: null`. Readiness and `setMode` now require enabled **and** verified, with `SHIPPING_PROVIDER_NOT_VERIFIED` as its own code: an account saved with a token that never authenticated fails at the carrier mid-fulfillment, which is not a state a settings screen should call ready.

**Two amendments came back with the approval, and both were the right ones.**

*`provider_account_id` is part of tenant isolation, not a side effect of `resolve()`.* A correct resolve with a null column would leave the isolation broken and every other test still passing. A codebase-wide audit found exactly one `shipment.create`, already writing `resolved.accountId` — so the fix was structural once resolve returned a real id, and three direct tests now pin it (carrier writes the id, a different account writes a different id, merchant-managed writes null).

*The webhook is authentication **and** ownership, two independent checks.* `POST /webhooks/shipping/:provider/:accountId` is load-bearing again: the account id names which key the signature verifies against, and it is then passed **into** the shipment lookup rather than compared after it, so a foreign shipment is *not found* rather than *refused* and a probe cannot enumerate. The attack this closes is not hypothetical arithmetic — merchant B signs a payload perfectly with their own key, naming merchant A's shipment; authentication passes, and only ownership stops it.

The central credential stays as **option C — kept but disabled — and it is enforced in code, not by agreement**: `ShippingProviderService` no longer takes `IntegrationsService` as a constructor dependency at all, so there is no handle in the shipping runtime with which a fallback could be written. The admin screen stays for internal use and now says so at the top, with no control that turns it into a fallback.

Green: back-end **4649 tests / 275 suites** (from 50 failures), build, 0 lint errors in the touched files; vendor 578 / 47 + typecheck; admin 228 / 19 + typecheck. `carrier-account-card.tsx` was restored from git history rather than rewritten — its `touched`-set logic (never post a mask back as a credential) was correct and worth keeping verbatim. The card order on the screen is now the setup order: connect + verify → which carriers → which warehouses, with the dependent cards hidden and the blocker named rather than left as a gap. Plan and rationale: [docs/future-features/oto-per-merchant-account.md](docs/future-features/oto-per-merchant-account.md).

- [ ] **Every merchant now needs their own OTO account, and nothing onboards them.** No signup link, no guidance, no "what is OTO" copy — just a credentials form. This is the friction the central account existed to remove, and it is now the feature's biggest adoption risk. Confirmed on 2026-09-05: a platform tier that would have absorbed it was built and rejected (entry above), so onboarding is the answer.
- [x] Webhook registration is per merchant and still manual. — **done 2026-09-05**, see the entry above.
- [ ] No integration test drives the real HTTP layer end to end — the cross-tenant guarantee is pinned at the controller and service, not through a live request with a genuine HMAC.
- [ ] `ShippingProviderLocation` still carries two addressing schemes (`shop_id`+`provider`, and legacy `account_id`). Now that accounts are merchant-owned again the two have converged in meaning; collapse them once the legacy rows are confirmed unreferenced.
- [ ] Decide what happens to a shop whose account is deleted or fails verification while orders are already booked. Bookings stop, which is correct; nothing notifies the merchant.

### Central carrier account — PHASE 6-B — 2026-08-24

The carrier account moved from the merchant to the platform, the way Salla and Zid work: one زيداك-owned OTO account books for every shop, and a merchant never sees a token, a webhook secret, an endpoint or a sandbox switch. What made this more than a credential move is that **moving ownership alone could not deliver merchant carrier choice** — `createOrder({createShipment: true})` delegates the carrier decision to OTO's own rules, so under one shared account every shop would inherit the platform's. The two-step booking is therefore the centrepiece, not a detail: `createOrder({createShipment: false})` → `getDeliveryOptions?orderId=` → filter by the shop's carriers → `createShipment({orderId, deliveryOptionId})`.

Approved with the constraint that OTO's contract be verified from their own documentation and every path touching `ShippingProviderAccount`/`ShippingProviderLocation` inventoried first. Both were done before any migration: `deliveryOptionId` is a declared `createShipment` field (no guessing), and the path inventory came back narrow enough that **the schema delta was redesigned to be purely additive** — `account_id` keeps its foreign key and every row, `shop_id` + `provider` are added beside it, and production row counts stopped gating the change's safety. Nothing is deleted or repurposed.

Credential in `IntegrationConfig(type=SHIPPING)` under `MANAGE_INTEGRATIONS` (admin console `/integrations/shipping`), with `oto.api.ts` holding the token exchange once so the adapter and the integrations registry cannot drift. Carrier choice in the new `ShopShippingCarrier` + `ShopShippingCarrierService`, where **no rows means allow-all** and an empty array means offer-nothing — `null` ≠ `[]`, and the second refuses rather than falling back. Webhook tenancy is now *derived*: `POST /webhooks/shipping/:provider` matches `{ id: evt.shipmentId, provider_slug }` and reads `shop_id` off the row, because the old `provider_account_id` check is vacuous when every shop shares an account; the legacy `:provider/:legacyAccountId` path still answers and ignores the segment, so URLs already registered at the carrier keep working. Vendor UI: `carrier-account-card.tsx` deleted, `carrier-selection-card.tsx` added.

Green: back-end 4246 tests / 251 suites, check:di, schema:check, build, 0 lint errors. Six migrations applied locally (Docker); the carriers one reported 0 carrier rows across 17 live shops, every one reading as "all platform carriers allowed". Docs: shipping-providers.md + api/shipping-providers.md, shipments.md + api/shipments.md, vendor shipping.md, and both doc contradictions from the plan's §12.4 corrected.

- [ ] The production refresh token pasted into the working chat is EXPOSED — revoke it in OTO (Settings → Developers → Connected Tokens). **User action.** Still required: the token is live regardless of which row the platform reads.
- [ ] Run the three read-only production row counts (gate 1 in the plan's §15) — the delta is additive so they no longer gate safety, but the rule stands: no migration on production without a documented read.
- [ ] End-to-end against OTO's sandbox: enter a `staging-api.tryoto.com` token in the admin console, Verify, map a location, book one shipment through the two-step flow, fire one signed webhook. Nothing in this repo has touched the live API.
- [ ] Request OTO's webhook signing key ("shared on private" per their docs) and enter it as `webhook_secret`; until then webhooks 401 by design and Refresh-tracking covers status.
- [ ] `ShippingProviderLocation` carries two addressing schemes at once (`shop_id`+`provider`, and legacy `account_id`). Collapse to one after the legacy rows are confirmed unreferenced — the dual read is covered by tests but is the one non-zero-risk piece of the delta.
- [ ] Delivery-option choice is "first surviving option", not cheapest or fastest. Decide the ranking rule (and whether the merchant picks it) once sandbox payloads show real `deliveryOptionId` sets.

### OTO carrier integration — PHASE 6 shipped — 2026-08-24

The multi-carrier aggregator lands behind the PHASE 5 abstraction, built from OTO's own documentation (auth, createOrder, checkOTODeliveryFee, cancelOrder, orderStatus, webhook signature) — never a guess. Registry entry `oto` (carrier, requires location mapping, sandbox = OTO's separate `staging-api.tryoto.com` environment) + `providers/oto.provider.ts`: verify = the free refresh-token exchange (cached ~55min keyed by host+token); booking = ONE `createOrder` with `createShipment: true` where `orderId` is OUR `Shipment.id` (webhooks echo it straight back — no translation table) and `pickupLocationCode` comes from the location mapping (`LOCATION_NOT_MAPPED` throws rather than letting OTO auto-assign a branch); carrier choice stays in the merchant's OTO rules, so no carrier vocabulary enters our domain (isolation spec still green). `rate()` got its first real implementation (cost quotes, still called by no production path). Webhooks: `POST /webhooks/shipping/:provider/:accountId` in the shipments module — HMAC over `orderId:status:timestamp` with the account's `webhook_secret` credential (no key = REFUSED, never accepted on faith), Stripe-style insert-to-lock dedupe, and `applyProviderEvent` (tenant isolation by `provider_account_id`; raw carrier wording in history, only the mapped domain verdict moves status; terminal statuses never demoted). `ShipmentsService.create()` finally hands providers the REAL order — frozen destination address, priced lines, currency, COD amount — where it used to pass empty placeholders only `manual` could tolerate. Product `length_mm/width_mm/height_mm` columns added (migration applied locally). Vendor UI cost: zero — the catalog renders the new carrier card, verify, sandbox toggle and mapping card by itself.

Green: back-end 4205 tests / 250 suites (+30: 16 adapter, 8 webhook controller, 6 applyProviderEvent), check:di, schema unchanged (catalog is data), lint clean on all new files. Docs: shipping-providers.md (OTO design section), shipments.md + api/shipments.md (webhook contract), products.md.

- [ ] Product dimensions are columns only — expose length/width/height in the product API + vendor form, and use them as package fallback in the adapter when no box is entered.
- [ ] orderStatus response shape is parsed defensively (their docs do not publish the full schema) — tighten the mapping after the first sandbox round-trip shows real payloads.

### Shipping flow decisions closed — reason-aware blocking, ETA, shippable-percentage, holds-aware engine — 2026-08-23

Four SaaS-policy decisions taken and built in one pass. (1) **Excluded destination blocks**: `selectShippingOptions` reports `has_zones`, the quote says WHY shipping is unavailable (`shipping_unavailable_reason`: `destination_excluded` vs `not_configured`), the storefront disables the button with a red note for the first and keeps the soft warning for the second, and `createOrder` enforces the wall (`shipping_destination_not_served`) — unconfigured shops keep the legacy fee-0 path. (2) **Delivery promise**: `min/max_delivery_days` on `ShippingRule` (dialog inputs; null = no promise), carried on priced options, rendered "3–5 days" in the picker, frozen into `Order.shipping_method`. (3) **Percentage = delivery price**: bps now applies to the shippable subtotal only (`computeShippingFeeCents.shippableSubtotalCents`), threshold still reads the full subtotal. (4) **Holds-aware engine**: `planForLines` subtracts other carts' active `StockReservation` holds from its in-memory view (located holds at their frozen `location_id`, legacy NULL-location holds off the deepest shelf), excluding the caller's own cart — `verifyCheckout` gained `cart_id`, and `createOrder` excludes its own because `releaseAll` runs after planning in the same transaction. verify's "feasible" finally agrees with the order-time `quantity - reserved_quantity` guard, and no stored counter is touched twice. Migration `2026-08-23-shipping-rule-eta.sql` (additive, applied locally).

Green: back-end 4175 tests / 248 suites (+28), storefront 263, vendor 543; typechecks; check:di; schema:check; lint 0 new errors. Docs: shipping/checkout/orders/fulfillment-allocation overviews + api/{checkout,orders,shipping}.md, storefront checkout doc, vendor shipping doc.

- [ ] Never seen in a browser: the red excluded-destination note, the ETA line in the picker, and the two rate-dialog inputs.
- [ ] The engine's NULL-location hold placement (deepest shelf) is a heuristic — retire it once every reservation row predating 2026-05 has expired, by subtracting located holds only.
- [ ] `shipping_unavailable_reason` is not yet surfaced on the PDP/cart (only checkout); a "doesn't deliver to you" hint earlier in the funnel needs the visitor's address, which only checkout has today.

### Shipping method choice end-to-end — customer picker, merchant override, buyer-visible shipments — 2026-08-23

The purchase flow's central gap closed: a shipping METHOD is now something a customer picks and a merchant can override, not an anonymous fee. `selectShippingOptions` (shipping-zone.helper) returns EVERY rate the destination is offered — the matched zone's bands newest-first, or the legacy unzoned pool — and `selectShippingRule` became its first-option wrapper, so "the default" and "the first option" are one fact. `verifyCheckout` prices all options for the cart (`shipping_options` + `selected_shipping_rule_id`) and takes the pick back as `shipping_rule_id` (stale pick → visible fallback); `createOrder` takes the same field but REFUSES a stale id (`shipping_option_unavailable`) — quote lenient, charge strict — and freezes the priced method onto the order as `Order.shipping_method` (`{source, rule_id, zone_id, name, type}`, like `variation_snapshot`; per child on multi-shop). Drafts gained `shipping_override_cents` (NULL = zones price it, 0 = free on purpose; single-shop enforced; recorded as `{source: "merchant_override"}`) and the vendor form gained the address card + "Set shipping fee" row it always needed — a converted draft used to be priced against an EMPTY destination. Buyers now see their parcels: `OrderEntry.shipments` is a customer-safe column-`select` (status, carrier, tracking link — no costs, no provider ids), rendered as a Shipments panel on the storefront order page; `CartItemEntry.product_type` let the storefront's `lineShips` finally mirror the server's, and "Free" stopped rendering beside the "no rate for this address" warning. Migration `2026-08-23-shipping-method-choice.sql` (additive, applied locally; production gets it via db push on deploy).

Green: back-end 4147 tests / 246 suites (+15), storefront 263 (+2), vendor 543; all three typechecks; check:di; schema:check; per-app lint 0 new errors. Docs: shipping/checkout/orders/draft-orders/cart overviews + api/{checkout,orders,draft-orders,cart}.md, storefront checkout+orders docs, vendor orders doc.

- [ ] Never seen in a browser: the method picker, the split-delivery note, the storefront Shipments panel, and the draft form's address + fee row are verified by tests and typecheck only.
- [ ] One `shipping_rule_id` per order — correct while checkout is single-shop (X-SHOP scoped); a cross-shop checkout UI would need a per-shop map on `CreateOrderInput`.

### WhatsApp channel over Evolution API — phases 0-3, transport, connect, inbound and outbound — 2026-08-27

The channel's full feasibility analysis lives in `docs/future-features/whatsapp-evolution-api.md` and its own phased backlog in [docs/future-features/whatsapp-evolution-api.todo.md](docs/future-features/whatsapp-evolution-api.todo.md) — that file is the real task list; the boxes here are the four delivery stations plus the production-deploy and OTP-sender decisions. Phase 0 shipped: `IntegrationType.WHATSAPP` (Prisma enum + `migrations/manual/2026-08-23-integration-type-whatsapp.sql`), an `evolution` provider spec whose free `verify()` lists instances under the global key (validated against a live 2.3.7 server — a dev instance runs on Docker at `http://localhost:8081/`), and a new `src/whatsapp/` transport module: `IWhatsAppTransport` split from `IWhatsAppSession` on purpose, an Evolution v2 adapter plus console sink behind a DI-free factory, and a `WhatsAppService` with the same per-send resolution and revision-keyed cache as `SmsService` (the per-shop thing is the instance name, an explicit argument on every call — never adapter state). No test send by design: nothing can be sent until a shop instance exists, so Verify carries the whole check, like AI media. Admin console offers `/integrations/whatsapp` (nav entry, i18n, `supportsTestSend` mirror); `schema.gql` and admin codegen regenerated; 11 new unit tests; module deliberately not in the boot graph until the phase-3 processor consumes it.

- [ ] Deploy the production Evolution server — decision made 2026-08-23: Render, pinned image `evoapicloud/evolution-api:v2.3.7`, separate Postgres + Redis, a **fresh** `AUTHENTICATION_API_KEY` (the local `.env` carries Evolution's well-known default key) — then enter credentials at `/integrations/whatsapp` and Verify.
**Phase 1 shipped 2026-08-27** — a vendor can now connect their number. `ShopWhatsAppInstance` (`migrations/manual/2026-08-27-shop-whatsapp-instances.sql`) with `instance_name` minted from the shop **id**, never the slug: a slug is editable and renaming a shop would orphan a live Baileys session inside Evolution under a name nothing can reach. **No QR column, ever** — the code links whoever scans it to the vendor's whole WhatsApp account, so it is streamed and forgotten. `EvolutionSessionAdapter` covers the instance lifecycle, every wire shape probed against the live 2.3.7 server (a duplicate `create` is *success* — the steady state on every reconnect; an instance Evolution never heard of reads as disconnected, not an error). QR streaming reuses the `NotifyStreamService` handshake with a **shop**-scoped ticket, and the open SSE connection carries its own 20-second poll loop publishing into the same Redis channel, so the phase-2 webhook becomes another publisher rather than a rewrite. Settings → WhatsApp in the vendor dashboard states the consent — scanning grants access to the *entire* account — above the button, and the four-linked-device limit before the scan rather than after it. `WhatsAppModule` split from `WhatsAppVendorModule` for the `IntegrationsAdminModule` reason. 44 new tests, live adapter smoke test green.

Two facts worth keeping. **Evolution binds the number at instance creation**, so `connect?number=` on an instance created without one answers a QR and a null pairing code however often it is called — `requestWhatsAppPairingCode` therefore recreates the (unconnected) instance, which is why it refuses on a live session. And **the provider owns the status; the row is a projection** — every read reconciles, which is what makes "Disconnected — scan again" appear on its own before the webhook receiver exists.

**Phase 2 shipped 2026-08-27** — deliveries now arrive. `POST /webhooks/whatsapp/:instance` dispatches on the event type from the first line, because Evolution sends QR refreshes, connection changes and customer messages down the *same* URL and a receiver that assumes every body is a message treats a QR refresh as somebody talking. It accepts **both spellings 2.x has shipped** (`messages.upsert` and `MESSAGES_UPSERT`); betting on one is how a minor upgrade silently stops routing. The instance name is in the **path** because it selects which shop's secret to check — that has to be settled before anything in the body is trusted — and the comparison is `timingSafeEqual` with the length checked first, since throwing on a length mismatch is itself a length oracle. **Every delivery answers 200**, a bad secret and an unparseable body included: Evolution retries up to ten times on anything else, so a 4xx meaning "not for us" turns one unwanted delivery into ten. Messages are de-duplicated on the WhatsApp id through the existing `IdempotencyService` and logged phone-masked, then **deliberately dropped** — routing is phase 5 and the AI reply is phase 7, both behind M-2's gate. 21 parser tests, whose real subject is refusing malformed input without throwing.

Two things phase 2 turned up that were not in the plan. **Webhook registration only ever happened inside `create`, during pairing** — so every number connected before the receiver existed had no webhook at all, which is indistinguishable from a broken receiver (confirmed: `GET /webhook/find/shop_…` answered `null`). `syncWhatsAppWebhooks` (gated on `manage_integrations` *alone*, since `PermissionsGuard` matches with `.some()`) pushes the origin onto every instance and reports `{updated, failed}` rather than throwing. And the `evolution` provider spec carried a **`webhook_secret` field nothing read** — the inbound path uses a secret generated per instance — so it is gone: a field nobody can use and everybody will try to fill is worse than no field.

**Phase 3 shipped 2026-08-28** — outbound is a queue. `WhatsAppSendQueue.enqueueText` is the only entry point and nothing calls `WhatsAppService` directly: a send is a network call to a shared third-party server holding a live phone session, so doing it inside a request puts a stranger's uptime on the critical path of an order being placed. **The worker's shape is one distinction — what is worth retrying.** A row that is not `connected` is a phone that is off, and no number of attempts reconnects it, so that path is *not* retried: it falls back to email when the producer named an address and notifies the vendor either way (two separate facts — the recipient got their message, the channel is still down). A provider refusing a send on a session that *is* up is genuinely transient and goes back into BullMQ's backoff. The job names the **shop**, never the instance, because a job can outlive the session it was created against.

Three things phase 3 turned up. **With no integration enabled, `WhatsAppService` resolves to the console sink and reports success** — so the "not configured" case had to be checked *before* the send rather than caught after, or a production message would vanish into a log and be counted as delivered. **`SentryWorkerHost` reports `job.data` verbatim**, the right default for every other queue here and wrong for the only one carrying a recipient's phone and email; the processor overrides `onFailed` to mask both and run the error text through `maskPhonesIn`, since Evolution echoes the number back inside its own errors. And **a fallback with no address is a drop, deliberately** — re-routing to an inbox the customer never gave for this purpose is worse than not sending.

Shop suspension now reaches the channel too: `ShopsService` emits `shop.deactivated` from all three levers and `ShopLifecycleListener` tears the session down — an event rather than a call, so `ShopsService` stays unaware of WhatsApp. Reactivation deliberately emits nothing, since a torn-down session needs the vendor to scan again and nothing the platform does restores it.
- [ ] Fill `webhook_base_url` at `/integrations/whatsapp`, then run `syncWhatsAppWebhooks` — set it before this API answers at that origin and Evolution retries every event against a 404 ten times, for every shop. Locally the origin is `http://host.docker.internal:3000`; no tunnel is involved, since Evolution is the one in Docker.
- [ ] Station 2 remainder — identity & isolation (launch gate for AI): finish the `phone_e164` migration (default-country decision, production dry run, then `@unique` and the eight `OR` tricks) and instance→shop / phone→user routing. JID parsing, `message.id` idempotency and the tool channel policy are done.
Station 3 (notifications) and most of station 4 shipped and these boxes were
never updated — corrected 2026-09-05 against the code. `NotificationChannel`
carries `WHATSAPP` and `TELEGRAM`, `NotificationDispatchProcessor` reads
`setting.whatsapp_enabled` and enqueues through `WhatsAppSendQueue`, and the
bilingual default catalog is `catalog/whatsapp-templates.ts`. On station 4:
`DirectConversation` has `shop_id` / `channel` / `channel_identity` /
`ai_paused_until`, the read-only allow-list is `customer-bot.channel-policy.ts`,
`ai.agent.customer` is enforced in `customer-bot.quota.ts`, and escalation runs
through `request_shop_owner`.

- [~] Station 4 remainder — **`channels.whatsapp` is the one plan key that does
  not exist** (`grep` returns nothing outside this file). `ai.agent.customer`
  bounds model spend per shop; nothing bounds message *volume*, which is the
  ceiling that matters once notifications and the bot share one number.
- [ ] Decide the OTP sender (platform-owned instance vs keeping OTP on SMS) — parallel track, blocks nothing.

### GraphQL IDE was served in the one state it cannot work in — fixed 2026-08-21

`/graphql` on the deployed API answered with the Apollo Sandbox landing page and
the message "Apollo Sandbox cannot be loaded; it appears that you might be
offline". It read as a CORS or network fault and was neither: `introspection`
was `process.env.NODE_ENV !== 'production'` while
`ApolloServerPluginLandingPageLocalDefault` sat in `plugins` **unconditionally**.
The sandbox draws its schema by introspecting it, so the page was being served
into the only combination that cannot function. The same switch also kept
Apollo Studio, Postman and the apps' `codegen` from reading the schema off the
deployed server.

`NODE_ENV` could not carry the decision: this deploy is staging but must run
`NODE_ENV=production`, or `DeploymentSafetyService` refuses the remote database
and every "not production" guard falls open. So the IDE got an explicit opt-in,
`ENABLE_GRAPHQL_IDE`, resolved in one place (`common/config/graphql-ide.ts`) and
consumed by all three parts that make it up — introspection, the Sandbox page,
and the same-origin `/graphiql` route, which had a *third* independent gate
(`isDev`) and was therefore closed on staging despite being the IDE that works
without any cross-origin preflight. Covered by 11 unit tests.

Fixed alongside it, all in the CORS block of `main.ts`: a disallowed origin was
rejected with `callback(new Error(...))`, which propagates as a 500 and reports
a rejected origin as a broken server — now `callback(null, false)`. Entries are
normalised through `new URL(u).origin`, because the comparison is an exact match
against the browser's `Origin` header (`scheme://host[:port]`, never a trailing
slash or a path) and the fallback `FRONTEND_URL` is written *with* a trailing
slash, so that path silently produced an allowlist matching nothing. And the
resolved list is now logged at boot under a `CORS` logger, since a rejection was
otherwise diagnosable only from the browser's opaque "blocked by CORS policy".

The switch turned out to own **five** things, not three, and each was found by
hitting it. Beyond Apollo's `introspection` flag, the Sandbox page and
`/graphiql`: Helmet's default `script-src 'self'` blocked both IDEs' CDN
bundles, which is invisible to curl because CSP is browser-enforced and which
produces Apollo's misleading "you might be offline" fallback. And graphql-js's
`NoSchemaIntrospectionCustomRule` in `validationRules` is a *separate* guard
from Apollo's flag — left keyed to `NODE_ENV` it kept rejecting `__schema` on a
staging deploy that had `ENABLE_GRAPHQL_IDE=1`, serving the Sandbox and then
failing the Sandbox's own introspection query. The resolved state is now logged
at boot so the answer is in the deploy log rather than inferred from a browser.

- [ ] Redeploy and confirm `/graphiql` both loads and introspects — all five gates are aligned in the working tree but the running build predates the CSP and validation-rule fixes.
- [ ] Add the three deployed frontends to `CORS_ORIGINS` on Render: `https://zaydak-vendor.vercel.app`, `https://zaydak-admin.vercel.app`, `https://zaydak-storefront.vercel.app`.
- [ ] Fix `NEXT_PUBLIC_GRAPHQL_URL` on all three Vercel projects — it points at `/graphiql` (the HTML IDE page, GET-only), so every operation 404s. It must end in `/graphql`. Note the vendor app derives its REST base by stripping a trailing `/graphql`, so the wrong value also breaks the agent SSE stream and file uploads, not just login.
- [ ] Consider validating `NEXT_PUBLIC_GRAPHQL_URL` at frontend startup — a URL not ending in `/graphql` is always a misconfiguration and currently fails as an opaque 404 per request.
- [ ] Audit the rest of the codebase for the same shape — one behaviour gated by several independent `NODE_ENV` reads that can disagree. `main.ts` alone had `isDev` driving two unrelated blocks.

### Taxonomy phase 2 took the production boot down — 2026-08-21

`SystemCategoriesService.onModuleInit` asserts, once
`SYSTEM_CATEGORY_NOT_NULL_DEADLINE` (2026-05-06) has passed, that no non-deleted
product still has a null `system_category_id`. Eight did, so init threw, the
process never reached `app.listen()`, and Render failed the deploy with "no open
ports detected" — the port was the symptom, not the cause.

The manual migration the error message points at had two problems of its own.
Its `INSERT` omitted `updated_at`, an `@updatedAt` column Prisma creates
`TIMESTAMP(3) NOT NULL` with no database default, so running it as written would
have failed on a not-null violation. And its third step (`SET NOT NULL`) is not
safe while `schema.prisma` still declares `system_category_id String?` and
`createProduct` writes `input.system_category_id ?? null`: the constraint turns a
vendor saving an uncategorised product into a raw Postgres 23502. The file now
holds the backfill only, with the constraint documented in a footer.

- [ ] Classify the eight backfilled products properly rather than leaving them parked in `sys_uncategorized`.
- [ ] Finish phase 2: make `system_category_id` required in `schema.prisma` and in `CreateProductInput`, then apply the `SET NOT NULL` from the migration footer.
- [ ] Reconsider a boot assertion that hard-fails the process. Taking the whole API down for a data condition an admin screen could surface is a wide blast radius for eight rows; a loud startup error plus a health-check flag would cost nothing and keep the deploy up.

### Boot-time deployment-safety guard — shipped 2026-08-21

`DeploymentSafetyService` runs with the other boot-time integrity guards and
reports an environment that looks fine and is one keystroke from an auth bypass.
Every rule is conditioned on `DATABASE_URL` being **remote** — the only signal of
"this is a deployment" that `NODE_ENV` cannot lie about, since a wrong `NODE_ENV`
is the condition being detected.

It exists because the live server was found running `NODE_ENV=development`
against the production database with `ENABLE_DEBUG_OTP=true`. The OTP bypass is
double-guarded (`NODE_ENV` not production/staging AND the flag `=== '1'`), and
only the second guard was holding — `true` is not `'1'`. Normalising that
variable to `1`, which reads as tidying a boolean, would have opened
authentication bypass on production. So the flag has its own finding:
`_SET_BUT_INERT`, warning explicitly that correcting it is what arms it.

Warns by default (shipping it must not take the deployment down);
`DEPLOYMENT_SAFETY_ENFORCE=1` makes critical findings refuse the boot once the
environment is clean. 17 tests.

- [ ] **Set `NODE_ENV=production` on the live server and remove both
  `ENABLE_DEBUG_*` variables.** The guard reports it; only the Render dashboard
  can fix it.
- [ ] **Point `FRONTEND_URL` / `SHORT_DOMAIN` / `UPLOAD_BASE_URL` at the real
  host** — they are `localhost` on the live server, so magic links, short links
  and uploaded-file URLs resolve to the recipient's own machine.
- [ ] **Turn on `DEPLOYMENT_SAFETY_ENFORCE=1`** once the above are done, so the
  condition cannot come back.

### Vendor shipments screen — shipped 2026-08-22

The back-end had been writing shipments, packages, tracking history and carrier
cost and **nothing in the product showed any of it**. A fulfillment could be
created and then no screen would let a vendor book the carrier for it, read the
tracking a webhook had recorded, or say what the delivery cost. Feature doc:
[apps/vendor/docs/features/shipments.md](apps/vendor/docs/features/shipments.md).

`OrderShipmentsCard` sits under the fulfillment card on the order detail and
**groups shipments by the fulfillment each executes** — which is to say by
location. That grouping is the multi-location story made visible: a split order
carries one fulfillment per warehouse, and a vendor packing it needs "these
three from Ramallah, those two from the main warehouse" rather than five
undifferentiated rows. A fulfillment with no shipment shows as an empty group
with its own create action; that is the case the screen exists for.

Also shipped: tracking history collapsed per shipment with its `source` shown
(carrier vs hand-entered), box count and total weight, label link, cancel and
refresh actions, a cost dialog, and the charged/cost/gap strip.

**Two back-end gaps found while building it.** `ShipmentEntry.packages` and
`.tracking_events` were declared as fields but `mapEntry` never populated them,
so they would always have come back null — the reads now `include` them, and
they stay `undefined` rather than `[]` when not requested so "not asked for"
remains distinguishable from "none". And `OrderFulfillmentEntry` carried no
location, so a split order rendered as two identical rows in any client;
`location_id`/`location_name` are now exposed.

- [ ] No standalone shipments list — shipments are only reachable through their
  order. A "everything in transit" view across orders would be a different
  screen with different filters; nothing asks for it yet.
- [ ] `updateShipmentStatus` has no UI. The status advances through the carrier
  or not at all right now; a manual override belongs with the merchant-managed
  flow when someone asks for it.
- [ ] Packages cannot be edited after creation — only set when the shipment is
  booked.

### Shipping economics (Phase 7) — shipped 2026-08-22

Schema delta and report in
[`docs/future-features/multi-location-phase-7-proposal.md`](docs/future-features/multi-location-phase-7-proposal.md).

Three concepts kept apart: `customerShippingCharge` is the existing
`Order.delivery_fee_cents` (no new column), `actualShippingCost` is what the
carrier billed, `merchantShippingSubsidy` is `max(0, cost - charge)` and is
**derived, never stored**. Nothing here influences what the customer is charged
— that stays the shop's own zones and rates.

The delta is **two nullable columns on `Shipment`** and nothing else:
`actual_cost_cents` and `cost_source` (`provider` | `manual`). No column on
`Order` — an order-level cost would be a derived duplicate that drifts the first
time a shipment is edited.

`shipping-economics.helper.ts` holds the arithmetic and is tested on its own (11
cases). It pins the three things this arithmetic gets
wrong: a refunded delivery fee is subtracted from the charge (counting the gross
fee invents margin); costs sum across the **order**, not per shipment (a split
order is one fee against several invoices, and per-shipment comparison shows
healthy margin on every one); and `null` is not `0` — a missing invoice is not a
free delivery, which is how a report comes to show a shop subsidising the entire
fee on every order it has no invoice for.

Cost can be filled by the provider at booking OR typed by the merchant, which is
why Phase 7 does not need a real carrier: a merchant-managed shop that paid a
driver knows what it paid, so shipping margin becomes visible with no carrier at
all.

**`orderShippingEconomics` is a separate query, not a field on `OrderEntry`** —
a deliberate change from the proposal. The customer who placed the order reads
that type, so a cost field there would be one forgotten guard away from
publishing the shop's margin to every buyer; here the permission on the query is
the guard. It also keeps a join off the order-list hot path, which loads no
shipments today, to serve a number only the detail screen shows.
`ShipmentEntry.actual_cost_cents` is gated the other way — `mapEntry` takes an
opt-IN `withCost` flag, so a caller that forgets it shows less rather than more.

- [ ] `shippingMargin(from, to)` report deferred — data first.
- [ ] Carrier currency is assumed to be the shop's. Extension point is
  `actual_cost_currency`; documented rather than built.

### `npm run migrate:local` — manual migrations without aiming at production

`prisma.config.ts` reads `.env`, whose `DATABASE_URL` is the remote Neon
database. Every Prisma command therefore aims at production by default, and the
only thing between a routine local migration and running it against live data
was remembering to override the URL by hand each time. The seed script had
solved this for itself with a loopback guard; migrations had nothing.

`prisma/apply-manual-migrations.cjs` applies the files in
`migrations/manual/` in name order, **refusing any host that is not loopback**,
with no flag to override — a deployed migration is applied deliberately by
someone who has read the file, not by a script with a `--force`. It reads
`LOCAL_DATABASE_URL`, deliberately not `DATABASE_URL`, since reading the latter
would defeat the guard entirely. Migration `RAISE NOTICE` output is forwarded so
a run that matched nothing is distinguishable from one that worked.

**Two bugs in the first version, both found by running it.** It shared one
connection across files, so the first failure left the transaction aborted and
every later file reported "current transaction is aborted" instead of its own
error — one bad file buried ninety-odd real messages. Each file now gets its own
connection; a `ROLLBACK` between files does not reliably clear that state when
the file manages its own BEGIN/COMMIT. And it defaulted to applying the whole
directory, which is wrong: `migrations/manual/` is a historical archive, not a
replayable set — the April money migrations backfill from columns since dropped
and cannot run twice. A filter is now always required and there is no `--all`.

- [ ] The `.env` situation itself is unchanged: `npx prisma studio`, `db push`
  and friends still point at Neon unless overridden.
- [ ] The older migrations are not marked as one-shot anywhere. Someone will try
  to replay one eventually; a header comment in each would say so.

### Key rotation covered only one of two encrypted tables — fixed 2026-08-22

`SecretRotationService` re-encrypts every row still under the previous key when
`SECRETS_ENCRYPTION_KEY` is rotated. It knew about `integration_configs` only.
Phase 5 added `shipping_provider_accounts` under the same key — per-merchant
carrier credentials — and did not extend the rotation to reach them.

**A table left out of a rotation is not a partial rotation, it is a silent
total loss.** The boot log would have reported the rotation complete, the
operator would have removed `SECRETS_ENCRYPTION_KEY_PREVIOUS` on that
assurance, and every merchant's carrier credentials would have become
permanently unreadable — each shop having to re-enter its own.

Fixed: the pass now covers both tables and reports them separately in the boot
log. The carrier AAD moved out of a private method into an exported
`shippingProviderAccountAad`, so the write path and the rotation derive it from
one definition — a second copy that drifted by a character would decrypt
nothing while the log still said "complete". Soft-deleted accounts are rotated
too, so a shop re-enabling a carrier it removed last month does not find the
credentials unreadable. 8 tests, including one that pins the shared AAD.

The `SECRETS_ENCRYPTION_KEY_MISSING` boot warning now names both tables and the
per-merchant blast radius. Deliberately still `warn` and not `critical`:
`critical` refuses the boot under `DEPLOYMENT_SAFETY_ENFORCE`, and stopping a
service that is running fine prevents nothing — the damage happens later, when
somebody rotates `APP_SECRET`.

- [ ] Adding a third encrypted table means adding it to `SecretRotationService`
  in the same change. There is no test that can detect a table nobody wired up.

### Go-live checklist Step 7 — environment hardening, written 2026-08-22

The live service runs `NODE_ENV=development` with two debug flags set and three
`localhost` URLs. Step 7 covers all of it, in the order that does not break the
deploy: flags and `NODE_ENV` first (with `CORS_ORIGINS` in the same save, since
`main.ts` refuses to start in production with an empty allowlist), then the
public URLs, then `DEPLOYMENT_SAFETY_ENFORCE=1` last.

The step leads with the thing most likely to be got wrong: **`ENABLE_DEBUG_OTP=true`
must be deleted, not "fixed" to `=1`.** The OTP bypass needs `NODE_ENV` to be
non-production *and* the flag to be exactly `'1'`; today the first guard is open
and the second is shut only because `'true' !== '1'`. Normalising that boolean
would arm an authentication bypass.

- [ ] Ops, not code: the variables still need changing on Render.

### Shipping provider abstraction (Phase 5) — shipped 2026-08-22

Design and seven-point report in
[`docs/future-features/multi-location-phase-5-proposal.md`](docs/future-features/multi-location-phase-5-proposal.md),
approved before any schema was touched. `src/shipments/` was manual end to end
(a vendor typed the tracking number) and `Shipment.provider_response` existed
with nothing writing it. Feature docs: [shipping-providers](back-end/docs/features/shipping-providers.md)
and [its API reference](back-end/docs/features/api/shipping-providers.md).

4059 tests / 243 suites green (+68 tests, +5 suites), typecheck at baseline (167)
with zero new errors, lint clean in the new code, `check:di` and `schema:check`
OK, all three apps re-codegen'd and typechecking.

The delta is one enum, 4 new tables (`ShippingProviderAccount`,
`ShippingProviderLocation`, `ShipmentPackage`, `ShipmentTrackingEvent`) and 5
nullable/defaulted columns — additive only, so `prisma db push` passes on deploy
and no backfill is needed. Credentials are per-shop, which is why
`IntegrationConfig` (one enabled row per type, for the whole platform) cannot
host them; `SecretCryptoService` is reused unchanged.

**Shipping mode and shipping provider are two different levels, and conflating
them was the first draft's mistake.** `Shop.shipping_mode`
(`MERCHANT_MANAGED` | `SHIPPING_PROVIDER`, default the former) is a business
decision the merchant makes; the provider (`manual`, `oto`, …) is how a shipment
gets executed as a consequence. `MERCHANT_MANAGED` resolves to the `manual`
provider, but it is **not a fallback**: a shop in that mode stays manual even
with an enabled OTO account, and a shop in `SHIPPING_PROVIDER` mode with no
working account **throws** rather than quietly shipping manually — otherwise a
merchant believes OTO is delivering while unlabelled shipments pile up. The
default keeps every existing shop working with no migration and no decision.

Checkout is unchanged in **both** modes: what the customer pays stays
`ShippingZone`/`ShippingRule`, and no provider is called at checkout at all.
`rate()` exists on the interface and is deliberately not wired — it is a *cost*
source for Phase 7, not a second pricing system.

- [ ] **Not applied to production.** The migration is idempotent and additive
  and has now run cleanly against a real Postgres; production is still untouched
  by explicit decision.
- [ ] Shop-level shipping mode assumed sufficient. A shop wanting one warehouse
  on a carrier and one branch self-delivered would need a `ShopShippingConfig`
  table instead.
- [ ] `Product` dimensions (`length_mm`/`width_mm`/`height_mm`) deferred to
  Phase 6 — only a real carrier needs them for volumetric weight, and
  `ShipmentPackage` takes hand-entered dimensions until then. `weight_grams`,
  `hs_code` and `country_of_origin` already exist.
- [ ] `Order.logistics_provider` and `Shop.shipping` are both dead columns
  (one analytics dimension between them). Deliberately not reused: the first is
  the wrong grain (an order can hold several fulfillments), the second is an
  unindexable JSON blob where an enum belongs.

### Allocation engine (Phase 2) — shipped 2026-08-21

`src/fulfillment-allocation/` answers "which location ships which order lines".
A pure `allocate()` with no Prisma, no clock and no randomness, plus a thin
service that loads rows and enforces tenancy. No resolver and no controller:
nothing calls it yet, deliberately — the rules are proven before an order
depends on them. 38 tests (28 rules, 10 scoping), zero new lint or typecheck
errors, DI graph clean.

Priority order as specified: one location if any can cover the order, else the
fewest locations, then merchant preference, then proximity. Split is greedy and
prefers locations that **complete whole lines** over ones that only contribute
units — only the former removes a line from the problem — and is capped at
`MAX_SPLITS` (3). Leftovers are reported as `unfulfillable` with
`NO_STOCK_ONLINE` vs `MAX_SPLITS_EXCEEDED` distinguished, never as a silent
partial success.

Verified against the real seeded dev data, not just mocks: monitor x5 → one
location; dock x5 → 2+3 split; lamp x1 → unfulfillable; stand+keyboard → two
locations; monitor+stand → one location; keyboard x20 → 15 allocated with the
10 retail units correctly invisible.

- [ ] **`InventoryLocation` has no `priority` column**, so "merchant-defined
  location priority" is approximated by `is_default` — a single flag, not a
  ranking. Add `priority Int` when a merchant needs to order three locations.
- [ ] **No coordinates on `InventoryLocation`**, so proximity is a coarse tier
  (same city > state > country > elsewhere) rather than a distance. Real
  distance needs lat/lng, which nothing populates today.
- [ ] **No per-location shipping cost exists at all** — `ShippingZone` is scoped
  per shop — so cost is absent from the comparator rather than approximated.
  It belongs with the provider work (Phase 5).
- [ ] **Greedy split is not provably optimal.** Fine at a ceiling of 3, but if
  `MAX_SPLITS` ever rises, revisit before trusting it on wide orders.
- [ ] Not wired to checkout (Phase 3) and does not reserve anything (Phase 4);
  a plan is advice until something persists it inside a transaction.

### Multi-location dev dataset + local DB brought to Phase 1 — 2026-08-21

`npm run seed:multi-location` (`prisma/seed-multi-location.ts`) builds one shop
("Demo Electronics Store") with three locations, five products, six orders, four
fulfillments and four shipments, arranged so every allocation shape can be
tested: one-location, split-required, and not-fulfillable-online. Deterministic
`mlx-` ids, so re-running replaces the dataset rather than accumulating it.
Eight integrity checks run at the end and the script exits non-zero if any fail.

The dataset's point is the **Ramallah Retail Store** (`fulfills_online_orders =
false`): the keyboard has 25 units physically but 15 online, and the desk lamp
has 20 physically but 0 online with `in_stock = false`. That is the Phase 0
rollup fix proved against real data rather than a mock.

Applying `2026-08-21-fulfillment-shipment-integrity.sql` to the local database
also **validated the migration on real PostgreSQL for the first time** — it runs
clean and is idempotent across repeat runs, which Phase 1 could only reason
about.

- [ ] **`.env` sends every Prisma CLI command to a REMOTE Neon database.**
  `prisma.config.ts` loads `.env` only and never reads `.env.development`, so
  `db push` / `db execute` / `seed` all target Neon unless `DATABASE_URL` is
  overridden per command. The misleading "LOCAL DEV" comment is corrected, and
  the seed refuses any non-loopback host, but nothing protects the other
  commands. Worth an npm script that pins the local URL.
- [ ] **`prisma db push` cannot run against the LOCAL db**: a stale, unrelated
  drift (the local `BillingUnit` enum still carries `byte`, which
  `schema.prisma` dropped) makes it demand `--accept-data-loss`. Phase 1 objects
  were created by the manual migration instead. **Checked 2026-08-21: the remote
  Neon database does NOT have this drift** (its labels are `…, megabyte, none,
  video`), so no deploy is blocked — this is local-only staleness. Low priority.
- [ ] **No `StockReservation` rows in the dataset, deliberately.** Reservations
  are still pinned to a single resolved location, so a split-fulfillment hold
  cannot be represented honestly. Add them when Phase 4 binds reservations to an
  allocation plan.

### Multi-location fulfillment + shipping providers — architecture reviewed 2026-08-21

Assessment written to
[`docs/future-features/multi-location-fulfillment-and-shipping.md`](docs/future-features/multi-location-fulfillment-and-shipping.md).
The inventory half is built and good: `InventoryLocation`, `InventoryLevel`
(available/committed/incoming/on_hand per location), `InventoryAdjustment` and
`InventoryTransfer` all exist, and `adjust()` already closes oversell with a
guarded CAS (`STOCK_RACE`). What does not exist is everything above it — there
is no allocation engine at all. All four order paths call
`getOnlineFulfillingLocation(shopId)`, which returns exactly one location, so
the system is multi-location in its ledger and single-location in its
behaviour. `Shipment` hangs off `Order` rather than `Fulfillment`, so a split
order and a merged shipment are both unrepresentable, and there is no carrier
integration anywhere (zero hits for OTO/Aramex/SPL outside a free-text
`shipping_carrier` comment).

**Phase 0 (inventory correctness) shipped 2026-08-21.** Five defects that were
live in production, all independent of the shipping feature. Full suite green
(235 suites / 3911 tests), lint errors and typecheck errors both unchanged from
baseline, DI graph and `schema:check` clean.

Phase 0 follow-ups:

- [ ] **Backfill `products.quantity` / `variation_options.quantity`.** The new
  rollup filter only applies on the *next* adjustment per product, so shops with
  warehouse-only stock carry a stale (too high) figure until then. Needs a
  reviewed one-off UPDATE — deliberately not run as part of Phase 0.
- [ ] **Legacy orders can no longer be fulfilled** if their stock was never
  committed (`committed = 0` predates committed-tracking): `fulfillOrder` now
  errors with `INSUFFICIENT_COMMITTED_STOCK` where it used to silently
  mis-record. Decide whether operators need an explicit override path.

**Phase 1 (fulfillment/shipment data integrity) shipped 2026-08-21.** Schema is
**additive only** — deliberately, because `render.yaml` runs `prisma db push` on
every deploy without `--accept-data-loss`, so any non-additive change fails the
build rather than the row. Full suite green (235 suites / 3916 tests), zero new
lint or typecheck errors, DI graph and `schema:check` clean, all three apps
re-codegen'd and typechecking.

Phase 1 follow-ups:

- [ ] **Apply both migrations to the local dev database.** It was unreachable
  (Docker down) when the lock ran, so `zaydak` still has `location_id` nullable
  while live does not.
- [ ] **`Fulfillment.status` is still `String`.** The doc proposed a
  `PENDING/PACKED/SHIPPED/DELIVERED/CANCELLED` enum, but the column holds the
  lowercase string `'success'` and an `ALTER COLUMN ... TYPE` to an
  UPPERCASE-labelled enum fails the cast — and therefore the deploy. The richer
  lifecycle only means something in Phase 2, when a fulfillment becomes a
  decision that has not shipped yet (today `createFulfillmentTx` stamps
  `shipped_at = now()` at creation). Do it there, with the value migration.
- [ ] **`ShipmentPackage` deliberately not added.** Weight/dimensions are only
  needed once a real carrier contract requires them (Phase 5/6), and `Product`
  has no dimensions to populate them from yet.
- [ ] **`Shipment.fulfillment_id` is nullable.** New shipments always carry one
  (the service requires it), but the backfill can only link orders holding
  exactly ONE fulfillment — anything ambiguous stays NULL rather than being
  guessed at. Tighten once Phase 2 makes every order's fulfillments explicit.

Feature work, phased in the doc: Fulfillment FK + status enum · Shipment
re-parented to Fulfillment with line items, packages and the three money
columns (`actual_cost` / `allocated_charge` / derived subsidy) ·
`fulfillment-allocation` module (single-location first, greedy split capped at
3, weighted score with shipment count dominating) · `ShopShippingPolicy` +
frozen `ShippingQuote` · `ShippingProvider` abstraction reusing the
`integrations/provider-registry.ts` shape, OTO first ·
`ShippingProviderLocation` mapping that keeps our id primary · product
dimensions (`length_mm`/`width_mm`/`height_mm`), which OTO requires and we
do not store.

### Undecorated DTO fields were being deleted by the validation pipe — fixed 2026-08-21

Reported as "I add and edit data but nothing saves in the back end", from the
vendor's Settings → General → Brand pane. The global pipe runs with
`whitelist: true`, which strips every property carrying no `class-validator`
metadata — so a bare `@Field()` on an `@InputType()` does not mean "accept
anything", it means "discard this". `UpdateShopInput.logo`, `.cover_image`,
`.is_active`, `.address`, `.shipping` and `.notifications` were all bare, so
they never reached `ShopsService.update`; its `!== undefined` guards skipped the
write and `updateShop` still answered `success: true` with the old values.

`ImageInput` had no decorators on any field, which cost a second failure on top:
reached through `@ValidateNested()` from `settings.brand.square_logo`, a class
with no validation metadata at all trips class-validator 0.14's
`forbidUnknownValues`, so picking a square logo failed the whole save with
`an unknown value was passed to the validate function`.

A scan of every `@InputType()` in the back-end found the same defect in nine
more DTOs, all now decorated (`@Allow()` where a column genuinely is freeform
JSON): `CreateShopInput`, `AvatarInput` / `SocialInput` / `UserAddressInput`,
`ProductOptionDefinitionInput.values`, `AttributeFilterInputGql`,
`ReportFilterInput`, `SendDirectMessageInput`, `CreateDigitalFileInput`,
`UpdateFaqInput.id`, `UpdateLanguageInput.id` and `RequestMagicLinkInput`.
`update-shop.input.spec.ts` now validates with `whitelist: true` — the existing
cases did not pass the flag, which is why they never saw any of this.

- [ ] **Nothing stops the next one.** The rule lives in a comment and in
  `back-end/CLAUDE.md`; an ESLint rule (or a schema-vs-metadata test walking
  every registered `@InputType()`) would catch a bare `@Field()` at review time.
- [ ] **Only the DTO layer was swept.** `@ObjectType()` classes were skipped by
  the scan on purpose, but REST DTOs behind the same global pipe were not
  audited.
- [ ] **Not confirmed against the running API.** Verified by unit test and by a
  standalone class-validator repro, not by a real `updateShop` through the
  deployed schema.

### One legacy logo broke `myShops` for the whole dashboard — fixed 2026-08-21

Sentry: `Cannot return null for non-nullable field ShopImage.id`. `logo`,
`cover_image` and `settings.brand.square_logo` are free JSON, but all three
`ShopImage` fields are non-null. A blob holding `{original, thumbnail}` with no
`id` made GraphQL null the parent **and attach an error to the response**, so
the vendor app saw `INTERNAL_SERVER_ERROR` beside a complete `data` payload and
Apollo's `errorPolicy: none` threw the whole query away. `mapShop` now runs
`toShopImage` / `sanitizeSettings`: an image that cannot satisfy the contract is
reported as absent, and `thumbnail` falls back to `original`.

- [ ] **The bad rows are still bad.** The read is defensive now, but whichever
  shop holds the partial image still holds it — the logo simply will not show.
  Needs a diagnostic query and a backfill, or a re-upload from the Brand pane.
- [ ] **Same non-null-inside-nullable shape exists elsewhere.** `ShopImage` was
  found by an incident; `ProductImage`, collection images and banner blobs have
  the same JSON-column-vs-non-null-field mismatch and have not been checked.
- [ ] **Never seen in a browser.** Pinned by five service tests against the
  mapper, not by a request through the real schema.

### BullMQ's Redis has the wrong eviction policy

Every Sentry event carries the breadcrumb `IMPORTANT! Eviction policy is
optimistic-volatile. It should be "noeviction"` from the Upstash instance.
BullMQ stores job state in Redis keys; under memory pressure an evicting policy
can drop a job mid-flight and it will never complete or retry.

- [ ] **Set the Upstash database's eviction policy to `noeviction`.** Console
  setting, no code change.

### `updateShop` rejected every patch that omitted name or description — fixed 2026-08-21

A vendor editing only their brand colours got `VALIDATION_ERROR` naming `name`
and `description`, two fields the request never carried. `UpdateShopInput.name`
/ `.description` and `CreateShopInput.description` had a `@MaxLength` with no
`@IsOptional()`, and `class-validator`'s `maxLength(undefined, n)` is `false` —
so the constraint rejected the **absence** of the field. Clearing a description
to `null` failed the same way. `updateShop` is a patch, so this broke every save
that did not rename the shop.

`src/shops/dto/update-shop.input.spec.ts` pins it: an empty patch, a
brand-only patch, and `description: null` all validate; a genuinely over-long
value still does not. A scan of every `@InputType()` in the back-end found no
other optional field carrying a constraint without `@IsOptional()`.

- [ ] **Add a lint rule or a CI scan for the pattern.** The scan that found
  these was a throwaway script. `@IsOptional()` beside a constraint on a `?:`
  field is mechanical enough to enforce — it will be forgotten again.
- [ ] **Never seen in a browser.** Verified against the DTO with a real
  `class-validator` run, not through the API.


### Vendor promotion granted a role but no permissions (2026-08-09)

`createShop` answered `INSUFFICIENT_PERMISSIONS` on the deployed vendor app. `User.permissions` — not `role` — is the array signed into the JWT and read by every check, and `BecameSellerService.approve` set only `role: 'vendor'`, so an approved seller never received `create_shop`.

- [ ] **Rotate every secret pasted into chat on 2026-08-09**: the Neon `neondb_owner` password, `JWT_SECRET`, `APP_SECRET`, the Upstash Redis password, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `REPLICATE_API_TOKEN`, `AI_SERVICE_KEY`, `STRIPE_WEBHOOK_SECRET` and the Mailtrap credentials. **Two more found in the tracked tree on 2026-08-11 and not in this list: `GEMINI_API_KEY` (`back-end/.env.example`) and a Sentry `sntrys_…` auth token with `project:releases` scope (`apps/vendor/.env.example`, rotated in Vercel not Render).** Every value is now a placeholder in the tracked files; the values remain in git history, so rotation at the provider is still the only fix. Ordered steps: [docs/go-live-checklist.md](docs/go-live-checklist.md).
- [ ] **`SECRETS_ENCRYPTION_KEY` must be set in Render BEFORE `APP_SECRET` is rotated.** It falls back to `APP_SECRET`, so rotating that first makes every credential in `integration_configs` permanently unreadable. Now documented in `back-end/docs/10_deployment/README.md`'s secret table and enforced by ordering in the checklist.

## AI & Sidekick

### The five orphaned AI services were deleted, not wired — 2026-09-07

The AI report proposed wiring them. Reading them changed the answer. There were
not five features waiting to be switched on — there were five services **either
duplicated by something already shipping, or worse than it**, and one of them
was a hole.

- **`SalesForecastService`** — `get_revenue_forecast` was written specifically to
  replace it and says so: the old method "applied a trend multiplier over three
  months of data, which is a straight line dressed as a model". Wiring it was a
  regression, not a feature.
- **`DynamicPricingService`** — `get_price_suggestions` returns *directions, not
  prices*, on purpose ("Never quote a new price as if it were calculated"). This
  returned a computed `PriceSuggestion`, which that contract forbids surfacing.
- **`SmartCouponService`** — `suggestBundles` duplicated `get_bundle_suggestions`
  and `suggestCoupons` overlapped `suggest_campaign`. And `autoCreateCoupon`
  **wrote a coupon straight to the database**: no plan gate, no approval
  interrupt, no audit log, no idempotency. Wiring it would have reintroduced the
  exact class of unguarded money-adjacent write the six-layer agent design
  exists to prevent.
- **`ChurnPredictionService`** — 192 lines of heuristic scoring, superseded by
  `src/customer-segments/`: a mature RFM engine that already ships an `AT_RISK`
  group, a template for it, `predicted-spend-tier`, `segment-insights` and a
  `/segments` screen.
- **`AutoFaqService`** — duplicated the shipping `generate_faq` tool, which also
  carries the right boundary ("the vendor adds FAQs from the FAQ screen — you
  cannot save it").

~1,440 lines gone, preserved at `3da4ceb7`. `AutoCategorizeService`, the sixth
name on the audit's list, is **not** orphaned — `ProductEnrichmentService` calls
it in the queue worker; the audit predates that wiring.

The lesson worth keeping: **an orphaned service is not a free feature.** Four of
these were older, cruder versions of something the platform had already rebuilt
properly, and their presence in the provider list read as latent capability
while being latent risk.

- [ ] `docs/ai-surface-audit.md` and `back-end/src/ai/AI-SERVICES-EXAMPLES.md`
      may still carry usage examples for the deleted five — the audit is
      updated, the examples file was not checked

### Nine capability keys enforced, and the seed learned to retire the rest — 2026-09-07

Six of the twenty AI keys were enforced; **nine are now**. `ai.text.rewrite` and
`ai.text.summarize` arrived with the rich-text editor migration, and
`ai.vision.alt_text` was added to `suggestAttachmentAlt` — the live path it
should always have gated, reserved per image *before* the vision call, because
for a per-image quota committing afterwards records the spend without ever
preventing it.

**The eleven that remain are not an oversight backlog.** Each is unenforceable
for a nameable reason, and none of them wants a `reserve()` call:

- `ai.image.edit` / `remove_background` / `upscale` / `ai.vision.analyze` all run
  inside an enhance run that already books `ai.image.generate`. A second key
  double-books one provider call — the exact bug `tool-registry.ts` documents.
- `ai.search.semantic` and `ai.recommendation.generate` sit on a **public,
  unauthenticated, once-per-page-view** path. Exhausting the quota would take a
  shop's search down for its own customers, and any stranger could exhaust a
  competitor's by loading their storefront. That is a griefing vector, not a
  limit — and recommendations is now pure SQL with no AI spend to meter.
- `ai.embedding.generate` is driven by `triggerEmbedding`, which needs
  `MANAGE_ALL_SHOPS` and sweeps the platform. Not a shop's consumption.
- `ai.catalog.generate_attributes` is free on every plan by an explicit
  decision. A key advertising a limit on a deliberately free feature is a false
  promise.
- `generate_description` is redundant with `ai.text.generate`;
  `generate_products` and `generate_variants` do not exist.

**And removing a key turned out to be two steps, with the second missing.**
`seed-plans.ts` upserted only keys the registry still defines and never touched
the rest — so deleting one would leave its `features` row `is_active: true`,
still in the admin plan editor, still holding `PlanEntitlement` rows, no longer
documented in code. The same "sold but enforced nowhere" failure from the
opposite direction. The seed now deactivates any row whose key has left the
registry, and **deactivates rather than deletes** because `PlanEntitlement`
cascades on `Feature` delete and a hard delete would silently drop an admin's
configured limits. `EntitlementsService` and `featureCatalog()` already filter
on `is_active`, so retirement lands on the next seed run with no migration.

- [ ] **Retiring the eleven is a pricing decision and has not been taken.** The
      mechanism is ready; the per-key verdicts are in `docs/ai-surface-audit.md`
- [ ] Nothing tests the seed's retirement branch — it is a script, and the
      assertion would need a seeded database
- [ ] If the eleven go, the plan editor loses eleven rows admins may have
      configured. Worth a one-off report of which plans currently set a
      non-default value on any of them before pulling the trigger

### Moderation reached the text strangers write, and alt-text started billing — 2026-09-07

Two of the smaller items from the AI report, both the same shape: a control that
existed and was pointed at nothing.

**`ContentModerationService` had two callers and both were us.** Image
generation and the vendor agent's own replies — places where the text came from
the platform. Reviews and product questions, which are where a *stranger's*
words land on a merchant's storefront under the merchant's name, went straight
to the database. `UgcModerationService` wraps the check for those call sites,
and it exists rather than each service calling `moderateText` because its three
rules are the feature:

- **Fails open in every direction.** Outage, exhausted budget, rate limit,
  unparseable answer, `degraded` verdict — all publish. Refusing a legitimate
  customer's review because our billing is down is an immediate harm to the
  merchant whose product they liked; one bad review living for an hour is the
  status quo this improves on.
- **Refuses `block` only, never `flag_for_review`.** Neither table carries a
  moderation status column, so there is nowhere to hold a flagged row and no
  screen that would show it. Turning "somebody should look at this" into a hard
  rejection with no appeal is not what the verdict means.
- **Keeps the regex layer**, where every existing caller skips it. There a URL
  is a dashboard link we handed a merchant; here a URL, phone number or email
  inside a stranger's review of somebody else's product is exactly the spam
  signal the scan was written for. Same service, opposite setting, and the
  reason is who is typing.

Ordered after the ownership and duplicate rules (a rejected duplicate costs no
model call) and before the write (a refusal leaves no row).

**And `ai.vision.alt_text` is enforced.** `suggestAttachmentAlt` was the live
path the key should always have gated — defined in the matrix, priced on every
tier including FREE, read by nothing. Reserved per image *before* the vision
call: for a per-image quota, committing afterwards records the spend without
ever preventing it, so a shop could exceed its allowance by as many images as it
cared to request. Released on every throw.

- [ ] `flag_for_review` is published and logged only. The queue that would hold
      it needs a `moderation_status` column on `Review` and `Question` plus a
      screen — until then the verdict has two outcomes, not three
- [ ] `feedbacks` and `abusive-reports` are the other two UGC surfaces and are
      still unmoderated; `DirectMessage` on the customer inbox is a third
- [ ] Moderation costs 3 cents a call and reviews are now on that path. No
      per-shop quota gates it — only the platform budget, which fails open, so
      a review flood is absorbed rather than refused
- [ ] `AltTextService` reads `OPENROUTER_API_KEY` from env directly instead of
      resolving through `ChatModelService`, so it ignores the admin's provider
      choice the same way the Tiptap route used to. It needs a vision-capable
      model, which `ChatModelService` does not build yet
- [ ] Nothing tells a vendor how much of their monthly alt-text allowance is
      left until the reservation refuses

### The rich-text editor's AI moved off a frontend Groq key — 2026-09-07

`apps/vendor/src/app/api/ai/editor/route.ts` called Groq directly with a
`GROQ_API_KEY` from the *frontend's* environment. It worked, and it sat outside
every control the rest of the platform's AI runs through: no session check (the
route was reachable by anyone who could load the dashboard's origin), no plan
quota, no per-user rate limit, no platform daily budget, no output moderation,
nothing written to `usage_events` — so the spend never appeared on the admin's
cost screen — and a credential in a frontend env rather than the encrypted
`integration_configs` row. It also ignored the provider an admin picks at
`/integrations/ai-chat`: switching the platform to OpenRouter left the editor on
Groq, silently, which is the same class of failure as the Groq model retirement
that made the model id configuration in the first place.

The route is deleted and `aiEditorTransform` replaces it. **Its seven buttons
bill four capability keys, three of which were dead** — `ai.text.rewrite`
(improve / extend / simplify), `ai.text.summarize` (shorten),
`ai.text.translate` (both translations), `ai.text.generate` (the free-text
prompt, the only action that writes from nothing). Splitting them rather than
collapsing onto one key is what makes the plan matrix real: `ai.text.rewrite` is
`false` on FREE, so Improve is simply absent there while Translate still works.

Billed per character against an `estimated: true` quota, so the reservation is
taken from the input before the model runs (with headroom — an EXTEND
legitimately returns more than it was given) and committed at the response's
real length. Every failure path releases: no provider, nothing usable back, a
rate limit, a blocked output. A shop is never charged for an outage. The HTML
sanitiser moved server-side with it; on the client it was the only thing between
a provider's response and the dashboard's own origin.

One shape worth knowing: **`runAiEditorAction` keeps its signature**. Its callers
are upstream Tiptap scaffold on the eslint exemption list, so the Apollo client
arrives through `shared/lib/auth/apollo-bridge.ts` — a second consumer of the
bridge `clearApolloCache` already used — rather than as a new argument that the
next Tiptap sync would overwrite.

- [ ] Fourteen AI capability keys were dead; this enforces three, leaving
      eleven. The remaining decision is unchanged: enforce or delete from the
      matrix
- [ ] The editor sends the whole document on every action even when a selection
      exists — the server bills from the selection, but the document still rides
      the request and counts against the 24k input cap
- [ ] `ai.text.rewrite` being `false` on FREE means Improve/Extend/Simplify fail
      there with a plan error the AI menu shows as a generic failure. The menu
      should hide or disable them from the shop's entitlements instead
- [ ] No usage surface for the vendor: a shop cannot see how much of its monthly
      character allowance the editor has spent
- [ ] `GROQ_API_KEY` / `GROQ_MODEL` can come out of the vendor app's deployment
      env — nothing reads them any more


### The storefront assistant could not find a laptop — 2026-09-04

`search_products` ran `findAllStorefront`, which matches the customer's whole
phrase as a **substring of a product title**. A shop selling a *MacBook Air M3*
told people it had no laptops; every multi-word phrase found nothing; and
English failed twice over because the JSON comparison was case-sensitive. The
panel's product row was empty for the same reason — no results, no cards — which
is what the merchant actually reported.

Three layers fixed it. `CustomerCatalogSearchService` runs the storefront's own
hybrid ranker (`SearchPipelineService`, which the assistant was the only surface
not using) **in parallel** with a new weighted keyword search over name, brand,
`ai_keywords`, `ai_tags`, tags and the taxonomy category — merged semantic-first,
because the semantic path throws when its Python sidecar is unreachable and
sequential would mean the exact match is never reached. Both return ids only;
`findManyStorefrontByIds` re-applies the public `where`. And `shop_also_sells`
hands the model up to 40 real product names when a search comes back thin,
because on a catalogue with no keywords, no category and no embeddings nothing
in the database connects "laptop" to "MacBook" — only the model does.

Three latent bugs surfaced on the way: prices were formatted with a `currency`
field that does not exist on a public product (so every price shipped as a bare
number), `description` was passed to a helper that returns `undefined` for
multilang JSON (so the model had never seen one), and only the *last* search's
products survived a turn (so "put an outfit together" showed one card).

The panel's cards are now real product cards — catalogue cents, `ProductPrice`,
`stockState`, quick add — in a titled, pageable row, and the turn streams over a
new SSE route. `OptionalJwtGuard` and `ShopHeaderGuard` had to be made
transport-agnostic first: both read the request through the GraphQL context
helper, which on a REST route yields Express's `next` and kills the guard on
`undefined.headers`. The vendor agent's own SSE controller sits behind the same
two.

- [ ] Re-point the orphaned `system_category_id`s: 7 of 10 seeded products reference a taxonomy row that a re-seed replaced, so the category arm of every search matches nothing.
- [ ] Make `AutoCategorizeService` able to reach a specific category. It prompts with `take: 50, orderBy: level asc` out of 5,595 rows, so the model only ever sees top-level names and can never match "Laptops". Needs embedding-based matching, not a bigger `take` — which is why the enrichment worker writes keywords and audience but deliberately does not write `system_category_id`.
- [ ] Stand up `product_embeddings` and the `pgvector` / `pg_trgm` extensions locally, plus a populated `search_vector`. Without them the semantic ranker cannot run at all in development and only the keyword half is ever exercised.
- [ ] Let the model title the product row itself. `searched_for` is honest but reads as a term list ("jacket · shorts"); the reference writes a sentence ("Spanish travel outfits").
- [ ] Token-stream the reply text. Blocked on the two output tripwires, which can only judge a finished reply — it needs a streaming-safe check, not just a transport change.
- [ ] Fix `findAllStorefront`'s own `search` the same way. The storefront's search box still matches a phrase as a case-sensitive substring; only the assistant was moved off it.
- [ ] Feedback on an assistant reply, and persistence across a reload — both still unbuilt.


### Sidekick chat retired, its tools redistributed — 2026-09-04

`src/chat/` was the largest tool surface in the repo — 78 tools — and nothing in
the three apps called it. The GraphQL operations were still live, so any
authenticated caller could reach it with a hand-written query, including eight
admin tools that moved money (`withdrawal_manager`, `refund_approval`) behind a
role check alone: no plan gate, no approval interrupt, no UI. That was the
sharpest finding in [docs/ai-surface-audit.md](docs/ai-surface-audit.md), and
this closes it.

The module is deleted and four operations are gone from the schema
(`sendMessage`, `conversations`, `conversation`, `deleteConversation`). Three
live pieces moved out first rather than dying with it: `chat/proactive/` →
`src/proactive/` (it feeds the `insights` query and the dashboard's
`InsightsCard`), `language-detector.ts` → `common/helpers/` (five importers,
including `vendor-agent.service.ts`), and `tool-defaults.ts` →
`common/constants/` (`products.service.ts` reads `LOW_STOCK_THRESHOLD`).
`src/conversations/` is untouched — that is customer↔vendor messaging, not
Sidekick.

Of the 78: sixteen deleted rather than ported (eight admin tools with no home,
eight duplicates the vendor agent already had), one obsolete (`chat_analytics`
measured the assistant being deleted), and the rest **rewritten** into the
LangChain tool shape — ~34 to the vendor agent, 16 to the customer bot. Two bug
classes were fixed rather than carried: the originals returned pre-formatted
bilingual markdown (the tool result *was* the reply in Sidekick; here the model
composes, so two languages are no longer hard-coded), and several filtered on
`ctx.shopId ? {shop_id} : {}` — shop scope applied only when it happened to be
present, which reads the whole marketplace in a context that has none. The
flash-sale browser had no shop filter at all and listed every shop's promotions
through one merchant's assistant.

Three new plan groups carry the absorbed tools — `orders` (reads only; nothing
changes an order's state), `marketing` (proposals; nothing sends), and
`ai_content`, which is the one group whose tools each spend a second LLM call.
That last one is why **three previously dead capability keys are now enforced**:
`ai.text.generate`, `ai.text.seo` and `ai.text.translate` were defined in the
plan matrix, priced per tier, shown in the admin editor, and read by no code.

On the customer side the account tools are gated on *channel*, not a flag.
`customer-bot.channel-policy.ts` builds them only when the surface is the
storefront panel **and** a `userId` resolved from a JWT is present. A
phone-derived `userId` is real — the processor resolves one so the cart it fills
has an owner — but it identifies a handset, not a person: good enough to decide
whose cart to write to, not good enough to read a purchase history to.

- [ ] Apply `prisma/migrations/manual/2026-09-04-drop-sidekick-tables.sql` against each environment. **It destroys data and is not run automatically** — back up the six tables first if any of that history is worth keeping
- [ ] LangGraph checkpoint rows written by the deleted chat graph are orphaned in the shared `checkpoints`/`checkpoint_blobs`/`checkpoint_writes` tables. The vendor agent namespaces its threads `vendor:<id>` so nothing collides, but the old rows are dead weight — a one-off delete of non-`vendor:` thread ids would clear them
- [ ] Enforce the remaining 14 AI capability keys, or delete them from the plan matrix — a plan configured against a limit no code reads is worse than no limit
- [ ] `ai.vision.alt_text` has a live code path (`attachments.resolver.ts`) that does not check its key
- [ ] `ai.image.edit` / `remove_background` / `upscale` all fold into `ai.image.generate`; either meter them apart or collapse the keys
- [ ] Decide on the six orphaned AI services (`AutoCategorizeService`, `ChurnPredictionService`, `SmartCouponService`, `AutoFaqService`, `SalesForecastService`, `DynamicPricingService`) — wire or delete
- [ ] `get_orders` returns `customer_contact` only for a single named order; confirm that is the line we want before any list tool grows a contact field
- [ ] The dashboard prompt is at 25.9k chars against a 26k ceiling. The next addition needs a cut: dropping the prose read list is the honest one, since tool `description`s already carry it
- [ ] No admin AI surface exists. If one is ever built, the deleted admin tools are in git history at `1934615:back-end/src/chat/tools/admin/` — but they need a plan gate and an approval interrupt before they come back


### The warehouse question, asked by the tool instead of the prompt — 2026-09-04

Reported from Telegram: "طلبت منه ينشئ منتج وحدد كمية، راح عطول وأنشأ من غير ما
يسألني وين الكمية هاي موجودة". The rule from the entry below was there and was
correct — it was just written as prose, and prose is a request. The small, fast
models a chat channel runs on skipped the extra `list_inventory_locations` read
and went straight to `create_product`, and nothing downstream could tell that
apart from a vendor who had chosen the default: the tool omits `place_stock_at`
for both, so the stock was seeded at the default warehouse and the card said
nothing about it.

So the check moved to where a model cannot decline to run it.
`tools/lib/location-choice.ts` asks the database itself, and `create_product`
returns `{ok: true, needs_location: true, count, locations, hint}` instead of a
`navigate_to_form` when a quantity above zero arrives with no `location_id` on a
shop with more than one active location. `ok: true` because nothing failed —
`ok: false` renders the dashboard's red "Operation failed" card for what is a
question — and the missing `navigate_to_form` is what makes it safe: `findFormIntent`
sees nothing, so no confirmation card is staged on any channel and the turn
cannot be committed. Zero quantity and single-warehouse shops are untouched, and
an answered turn goes straight through.

The dashboard renders the warehouse list the vendor is choosing from rather than
a bare "Tool: create_product" row: the renderer matches `needs_location` on the
result *shape*, the way it already does for `navigate_to_form`, and reuses
`InventoryLocationsCard`. That needed `actionHasCard` to match the same shape —
it was keyed on tool name alone, and `create_product` is a leaf action there,
so the card was wired up and unreachable. `humanize-tool` says "Asked which
warehouse" instead of "Drafted the product form", which would name a card that
is not on screen, and the follow-up chips become the warehouse names, capped at
four, so tapping one is the answer — "Publish it" would have described a
product that does not exist. The prompt still carries the rule on both paths,
now saying it is enforced; the dashboard addition was trimmed to keep the
24,000-character ceiling.

- [ ] `set_inventory` still resolves an omitted `location_id` to the default silently — the same prompt-only rule that just failed for `create_product`. The same guard inside the tool would ask *after* the vendor approved the gate's card, so the question has to be raised before the approval interrupt instead
- [ ] The chat channels get the question as model-composed text; Telegram has buttons for a confirmation card but nothing renders `needs_location.locations` as a warehouse picker

### The assistant could not see the shop's warehouses — 2026-09-03

Multi-location has been on the write side for a while — `set_inventory` takes a
`location_id`, `transfer_inventory` moves between two — but nothing let the
agent *read* the locations. So it could neither offer a choice nor turn "مخزن
جدة" into an id, and a quantity given while creating a product went to the
shop's default location with nobody told. That is stock counted somewhere the
vendor never picked, found on the same day the Telegram bot learned to create
products at all.

`list_inventory_locations` is the read that closes it: id, name, city, which one
is the default, whether it fulfils online orders — default first, active only
unless `include_inactive`, soft-deleted rows excluded. An optional `product_id`
adds that product's available and committed quantity at each location, and is
ownership-checked before any level is read, so an id lifted from a message
cannot expose another shop's stock. One tool rather than two (`list_locations` +
`get_levels`) deliberately: every schema is sent on every request and a chat
turn is a token budget. It is `catalog_read` with no entitlement and sits on
`CHAT_READ_ONLY`, so WhatsApp and Telegram get it with the dashboard.

The rule around it is one prompt bullet and one optional field. A quantity has
to land somewhere: with one location the agent says nothing, with more than one
it asks which warehouse in one short question and passes the id as
`create_product`'s `location_id` — validated against this shop's own locations
inside the tool, so a wrong id is a question the model can still fix in the same
turn rather than a failure at commit. `ProductsService.create` still seeds the
opening stock at the default, exactly as the dashboard form does; the chat
confirmation layer moves it afterwards through `InventoryService.transfer`, so
the ledger records the move instead of the quantity appearing where nobody put
it, and it does nothing when the pick *is* the default. The card names the
warehouse only when there is a quantity and a location was chosen. A failed
transfer is swallowed with a warning naming the shop, the product and the
location: the product exists by then and the vendor has been told so, and
reporting a create that happened as a failure is the worse answer.

- [ ] A swallowed transfer leaves the opening stock at the default with only a `logger.warn` saying so. Nothing tells the vendor, and nothing retries; a follow-up message on the thread would cost one line
- [ ] **Orders on the assistant** — `search_orders`, `get_order`, `update_order_status`, `fulfill_order`. The reads are what a vendor actually asks a phone ("did order 1042 ship"), and the two writes need the same confirmation card the product writes use
- [ ] **Customers, reviews and questions** — the remaining read surface: who bought what, what was left on a product, what is unanswered. All three exist as services with no tool in front of them

### The assistant panel, rebuilt around the turn that failed — 2026-09-03

The owner's report was "the UI/UX and the AI's reply style in the vendor web
are no good, and it keeps throwing errors". One screenshot carried four separate
defects, and each turned out to be a different layer.

**The reply was markdown the renderer could not draw.** The assistant answered
an "add a product" request with a numbered checklist of every field it wanted,
including a literal `**تصنيف المنتج**`. `WORK_LOG_STYLE` only forbade headings
and tables, so bold and `1.` lists were permitted, and the bubble rendered
`whitespace-pre-wrap`, so the vendor read the asterisks. Two halves to the fix:
the WEB prompt now names an allowed subset instead of a blanket ban, and
`lib/light-markdown.tsx` renders it — bold, inline code, simple lists; headings
and table pipes stripped to their text; **links never rendered**, because an
assistant-authored href is a phishing surface. No parser dependency and no
`dangerouslySetInnerHTML`: every leaf goes through React as a string. Chat
channels stay plain — Telegram prints the symbols.

**The checklist itself was a prompt gap.** The rule that would have prevented it
("ask for exactly the missing piece") lived only in `REPLY-STYLE.md`, which the
model never receives. The WEB prompt gained a `## Creating a product` workflow —
a name alone is enough to call `create_product` — and a closing `## Before you
send` block, because the rules the model was breaking sat at positions 15-16 of
16, ~20k characters in, and the prompt ended on a generic tone paragraph.
`create_product`'s own description, which ended "…inspect every field", read as
a checklist to complete; it now leads with "Call as soon as you have a product
name."

**The category card was a substring search with no ranking.** "clothing"
returned Erotic Clothing (`mature/erotic/`) and Clothing Display Racks
(`business-and-industrial/retail/`) beside the level-1 Clothing, in taxonomy
order, each labelled with a truncated slug path, with nothing marking the answer
and no way to pick one. It now scores (exact > prefix > whole-word > contains >
path-only, minus depth, with those two roots demoted but still reachable) and
returns `best_match` plus display-name breadcrumbs. And the taxonomy is
English-only — `system_category_translations` has zero rows and the seed never
writes it — so "ملابس" matched nothing and the model burned a second call
re-querying in English. That is the two "Suggested categories" rows in the
screenshot. `tools/lib/category-aliases.ts` maps the words a vendor actually
types to the exact English taxonomy name, and each row is now pickable, sending
a `[category:ID]` marker back so the agent skips the lookup entirely.

**The error was three failures wearing one sentence.** The provider chain was
402 "Insufficient credits" → an admin switching to a `:free` model → "Upstream
error from Nvidia: Service temporarily overloaded", and every one of them
reached the vendor as "صار خطأ غير متوقع. حاول بعد شوي." with no retry.
`classifyProviderError` now names the fault, the SSE `error` event carries
`{code, message, retryable, retry_after_s?}`, and the client renders a **Try
again** button or "the team has been notified" accordingly. `PROVIDER_DAILY_QUOTA`
is split from `PROVIDER_RATE_LIMITED` on evidence from a parallel session: a
spent free-model allowance is a 429 that no retry clears before tomorrow, and it
cost two live turns 172s and 188s of silence. The model call also had no retry
of its own while the tool dispatcher and the summarizer both had one, and both
chat clients were built without `maxRetries`/`timeout`, so LangChain's default
six attempts is what made a three-tool turn take 168 seconds. A failed turn is
no longer persisted as an ordinary assistant reply either — `AssistantPart`
gained `{kind:'error'}`, so the narration and tool rows that preceded the
failure survive a reload, and the model is never told it said "an unexpected
error occurred".

**And the transcript moved on its own.** The panel ran `scrollTop =
scrollHeight` in an effect keyed on every streamed token, so a vendor who
scrolled up to read a card was yanked back hundreds of times a turn and any
selection was scrolled away; the page derived stick-to-bottom from `scroll`
events that its own smooth `scrollIntoView` fired. Both now render into one
`Transcript` over `@repo/ui`'s new `MessageScroller`: following only while the
reader is at the live edge, released by wheel/touch/keyboard/scrollbar and never
by the stream; the vendor's own message anchors near the top with a peek of the
previous turn so the reply grows into the room below it; a reopened thread lands
on its last turn behind `data-pending-scroll` instead of sweeping the history;
and a jump-to-latest control on both surfaces. The panel had none of this, and
no retry control at all.

Also fixed: the panel and the shared view formatted every amount as `USD` (and
the `/ai` route passed `"USD"` too), the To-dos card was `bg-white` in dark mode,
`generate_product_image`'s card was unreachable from the work log, and a failed
row kept its present-tense "Matching the category…" label under a red triangle.

- [ ] **The share payload carries no currency**, so `shared-conversation-view` falls back to the platform default. Add the shop's currency to `publicVendorAgentConversationByToken` and thread it through.
- [ ] **The AI feature's copy is still inline `locale === "ar" ? … : …` ternaries**, not next-intl — `humanize-tool.ts`'s whole descriptor table plus every card. Only `approval-card` uses `useTranslations`. Several labels exist in English only ("Slug", "SKU", "Manual"/"Automated", raw order-status keys).
- [ ] **Repeated identical read calls are folded in the renderer, not prevented.** `tools.node.ts` still dispatches the same lookup twice; memoising write-free calls per turn would fix the latency and every channel, not just the dashboard's rows.
- [ ] Six cards still bypass `ResultCardShell`, and `formatMoney` is redefined in six of them with `toLocaleString(undefined, …)`, so digits follow the browser locale rather than the app's. Three cards (`product-created`, `product-updated`, `collection-created`) have no importers at all.
- [ ] The streaming turn still remounts as a fresh `MessageBubble` on commit, so expanded tool cards collapse and a selection inside the streamed reply is lost at the moment the turn finishes. Allocating the assistant message id at the start of `runStream` and replacing the row in place would fix it.
- [ ] `packages/ui` has three pre-existing failures in `tags-selector.render.test.tsx` at HEAD, unrelated to this work — `defaultValue` renders one chip too many.

### Switching AI_CHAT to Groq silently killed every vendor-agent turn — 2026-09-02

Found by the first Telegram vendor turn, but not caused by it. `build.ts` and
`summarizer.ts` sent OpenRouter's cost-accounting opt-in, `usage: {include:
true}`, on every request, with a comment saying the model "only ever talks to
the OpenRouter baseURL". An admin switched AI_CHAT to Groq on 2026-09-01 at
13:18; Groq's OpenAI-compatible endpoint rejects the unknown property with
`400 property 'usage' is unsupported`, and from that moment every agent turn
on every channel — dashboard, WhatsApp, Telegram — failed in ~800ms. The DB
shows it: the last successful WEB assistant message is 07:05 that morning.
Nobody ran a dashboard turn for a day, so the WhatsApp bot's "unavailable"
apology was the only symptom, and it looked like a model hiccup.

The fix is `providerExtensions(provider)` in `summarizer.ts`: the kwarg is sent
only when the registry slug is `openrouter`, `LlmEndpointConfig` gained an
optional `provider`, and `prepareRun` passes the one it already had. The
default direction is the decision — an unknown provider gets *no* extension,
because losing cost attribution is a bookkeeping gap and sending an unsupported
property is a dead channel.

- [ ] The integrations console's AI_CHAT **Send test** proves the model exists; it does not run an *agent* turn. A one-tool smoke turn on save would have caught this in the console instead of a day later on a phone
- [ ] `UsageTracker` now records zero cost on Groq (no `usage.cost` in the response). Decide whether to price Groq tokens from a rate table or accept "free" as the honest reading of a provider that does not report a charge
- [ ] Sentry receives `vendor_agent_error` per turn but nothing rolls up "every turn has failed for N hours". A rate alert on that event would have paged before a vendor noticed

### Telegram as the second messaging channel — spec written 2026-09-02

The plan is `docs/future-features/telegram-channel.md` and the task list is
`docs/future-features/telegram-channel.todo.md` (phases, operator steps, open
decisions). It and it settles the topology the
WhatsApp channel already implies: **one platform-owned bot every vendor
messages** (the analogue of `platform_assistant`) and **one bot per shop for its
own customers** (the analogue of `shop_<id>`). A vendor never creates a bot; a
merchant creates their shop's from BotFather and pastes the token.

Telegram removes half of what makes WhatsApp expensive — no Evolution server, no
Baileys session, no QR, no reconcile against a provider that owns the status, no
24-hour window, and inline keyboards that actually work rather than
`sendButtons` succeeding and being silently dropped. It costs nothing per
message.

**Phase 5 shipped before 3 and 4, by the owner's call: the vendor assistant first.** It depends on neither — it uses the platform bot and its own `TelegramLink` table, and runs `VendorAgentService.chat()` with `channel: TELEGRAM`, which the phase-0 allow-list maps to the same read-only set as WhatsApp. The one architectural correction on the way: the first draft ran the agent inline from the transport module, which would have dragged `AuthModule` into it and held Telegram's socket for a whole model call; it now produces onto `telegram-vendor-inbound` by name, exactly as the WhatsApp pair does.

**Phase 3 shipped 2026-09-03: the shop's own customer bot.** A merchant pastes a BotFather token; `getMe` runs before anything is stored, the row is sealed against its own id, and `setWebhook` runs last so Telegram is never pointed at a slug the receiver cannot resolve. A refused webhook keeps the row with Telegram's own words in `last_error` rather than "not connected". Customer messages are filed in the shared inbox as `tg:<chat_id>` threads and answered from the dashboard through the shop's token; the webhook follows the shop's lifecycle through a new `shop.activated` event, which WhatsApp deliberately ignores. The dashboard card has no save bar and no `touched` set, because the server never returns the token in any form.

**Parity, 2026-09-03: WhatsApp and Telegram do the same things.** The write half of phase 7 landed for both channels at once, as `vendor-agent/chat-actions/` — a turn that ends in a change produces a card describing the exact service input, the input is parked in Redis under a short key, and the answer commits it through the same service method the dashboard form posts to. What differs per channel is one line each: Telegram renders the card with Confirm/Cancel buttons and reads a `callback_query`; WhatsApp appends "Reply 1 to confirm, or 2 to cancel" and reads the next message. The gated bulk and inventory tools reuse the graph's own approval interrupt (`chat()` gained `approvals: 'park'`), so the card quotes a server-computed count rather than the model's estimate.

**Phase 4 shipped 2026-09-04: the shop's bot answers.** It had been storing customer messages since phase 3 and saying nothing back — the processor filed the message, read `ai_enabled`, and logged "answering is phase 4". The audit that started it found most of the phase already built: the assistant switch was on the card, `syncShopTelegramWebhook` existed, and `TelegramTypingService` was written and registered with no consumer. What was missing was the turn itself, and one thing the todo had wrong: it claimed coalescing "works as-is", and the shared services do — they all take an identity — but the **producer** enqueued with no mark and no delay, so the channel had no burst collection at all.

**Phase 6 shipped 2026-09-04: the known customer, then notifications.** The analysis picked "bind through the claim link" and rejected `request_contact` (a number is not authentication). What the analysis did not see is that the WhatsApp link cannot simply be reused: it carries a number and *mints an account from it*, so a Telegram link — carrying nothing to mint from — cannot sign anybody in. It binds somebody who already has. The token proves which **thread**, their session proves **who**, and neither alone binds anything, which is what stops a forwarded link handing a conversation away. So `phone_e164` became nullable, `conversation_id` joined it, and each redemption path refuses the other's claim with the same sentence an expired token gets. Then order notifications on `TELEGRAM`, where the destination cannot be derived from the order at all — a bot may not message anybody who has not pressed Start, so a guest checkout is unreachable by construction and **nothing falls back to email**, because no promise was ever made.

**Two live bugs on 2026-09-04, and the first is the instructive one.** The vendor bot answered and the shop bot did not, because the status check was copied from the WhatsApp processor with its string intact: `WhatsAppInstance.status` is `connected`, `ShopTelegramBot.status` is `active`. Every message was stored and none was ever answered — and **the spec agreed**, because its fixture used the WhatsApp word too, which is a value the column cannot hold. The second: pasting a token already connected to another shop hit the unique index on `bot_id` and came back as an opaque 500, so a merchant re-using one bot across two shops was told only "could not connect".

Three things carry the real work, and none of them is Telegram. **The tool
policy is written as a channel-level deny-list**: `decideChannelAccess` starts
`if (channel !== WHATSAPP) return ALLOWED`, so adding `TELEGRAM` to
`VendorAgentChannel` hands the bot every write tool — including the ones that
pause on an approval interrupt with no card to show — with no test failing and
no warning. **The customer bot resolved identity from a phone number** that
Telegram does not have, which broke the known-customer cart, `get_my_account`
and both address tools — closed in phase 6 below, though not quite as proposed. And **a vendor handset enrols off the WhatsApp QR scan**, which has no
Telegram equivalent, so pairing becomes a one-time deep-link token minted inside
an authenticated dashboard session.

- [ ] **Nothing registers the platform bot's webhook from the console row.** `setWebhook` is called only by `ShopTelegramBotService` (per-shop bots) and by `scripts/telegram-webhook.ts`, which reads `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CALLBACK_ORIGIN` from the environment by design. A platform bot configured only in `/integrations/telegram` therefore receives nothing until somebody runs the script with the same token in `.env.development`. Either register on `saveIntegration` for `TELEGRAM` (the row already carries `webhook_base_url`) or say so on the screen.
- [ ] The customer bot has its own coalescer (`CustomerBotCoalescer`, marker-based because the inbox already stores every message) — two mechanisms for one idea; worth folding into one once the customer assistant lands on Telegram
- [ ] A card is answered on the channel it was shown on. A vendor who gets a Telegram card and then writes on WhatsApp finds nothing there — the pointer is per account, not per channel, so the second channel abandons the first one's card. Decide whether that is right before both bots are in daily use
- [~] Generalise `shopWhatsAppThreads` to `shopInboxThreads` with a channel filter; inbox shows both channels with a badge — both channels are listed with `channel` on each row since 2026-09-03; the rename, the filter and the badge remain
- [ ] **Decision (money):** Groq's free tier caps gpt-oss-120b at 8000 tokens/minute and a Telegram vendor turn is ~8.1k (prompt ≈ 6.2k + 13 tool schemas + summary) — upgrade Groq to Dev tier, re-enable the OpenRouter row, or both; trimming the prompt per channel helps but the history grows back into the cap — later the same day the chat prompt became a read-only subset (~1.8k tokens vs ~6.2k; see `vendor-agent.prompt.spec.ts`), so a Telegram turn fits the cap with room for history; the tier still decides dashboard turns and long threads
- [ ] After a chat-created product the thread learns of it through an assistant line; a structured tool-event would let the model reference the new id ("add it to Summer Sale") without a search
- [ ] **Two status vocabularies, one codebase.** `ShopTelegramBot.status` is `active|disconnected` and `WhatsAppInstance.status` is `connected|…`; a comparison copied between the two processors shipped a bot that answered nothing, and a fixture using the wrong word kept the suite green. A shared predicate (`isBotLive(row)`) or one vocabulary would make the class of bug unrepresentable
- [ ] **A chat notification template cannot be edited from the dashboard.** `NotificationTemplate` is keyed per channel and `renderChatForShop` reads the row for the channel it was asked about, but the editor only ever writes `EMAIL` rows — so WhatsApp and Telegram both silently use the shared default catalog and a merchant has no way to reword either. Predates Telegram; Telegram inherited it

### The customer bot lost its menu and leaked its reasoning — 2026-09-01

Reported from a real thread, and it turned out to be three faults stacked.

**The worst one was a leak.** A customer sent "كيف الحال" three times, and the
third reply was the model's own reasoning, verbatim, on the merchant's own
number: *"Okay, the user keeps asking … According to the rules, I must reply in
Arabic and only use the tools. I've already used get_shop_info…"*. That is the
system prompt and the tool inventory handed to anyone who knows a shop's public
number. `detectSuspiciousOutput` did not catch it and could not — it looks for
credential *shapes*, and there is no secret in that paragraph; the harm is that
it is not a reply. The turn loop reads "no tool calls" as "done answering",
which is right for every well-behaved turn and wrong for a model that narrates
instead of acting. `detectReplyLeak` is the second tripwire: it names one of its
own tools (derived from the bound tools, so a new one is covered for free), a
phrase about its own rules, or an entirely non-Arabic reply to an Arabic
customer. The language check runs **one way only** — a correct English reply can
carry an Arabic product name, so the mirror rule would fire on a good answer.

**The second was that nothing ever looked up.** Three identical messages, three
replies. `alreadyAnswered` suppresses a repeat only when the shop's side already
answered the identical text — narrow on purpose, because a customer repeating
themselves *because* nobody answered must still get an answer. Its own test
caught a real bug in the normaliser: it stripped the ASCII `?` but not the
Arabic `؟` (U+061F), which is the one an Arabic keyboard emits — so it failed on
exactly the messages it was written for.

**The third was tone, and it cost the most code.** A greeting got
`Welcome to {shop}. Reply with a number:` over a four-item list. It read like a
phone tree, and on this channel the customer thinks they are talking to the
business, so tone *is* the product. `customer-bot.copy.ts` and
`customer-bot.menu.ts` are both gone — every sentence the bot says is now the
model's, from a system prompt that carries the voice (match their language and
dialect, greet someone who greets you, no numbered menus, never repeat yourself)
alongside the three rules that are safety and not style: answer only from the
tools, never claim to see an order, never discuss what the shop earns.

**What survived the deletion is the part worth remembering.** Option 4 was not
text, it was a feature — pause the assistant, raise the event, put the thread in
front of the merchant. Deleting the menu naively would have deleted the only way
a customer reaches a person. It became `request_shop_owner`, a tool, which is
strictly better: a model recognises "بدي أحكي مع صاحب المتجر" and "my order
never arrived" as the same request where a digit only recognised `4`. The tool
records; the **processor** pauses and emits, next to where both already lived.
`customer-bot.lang.ts` keeps language detection, which is mechanical rather than
copy and runs on messages that never reach a model.

- [ ] **Every message now costs a model call**, where a greeting and a menu tap
  were free. Bounded by the per-number throttle and `ai.agent.customer`, but the
  per-shop bill will move — worth watching before the channel has volume.
- [ ] `detectReplyLeak` fires an error log and sends nothing. A merchant has no
  way to see that their assistant refused to answer; the inbox shows the
  customer's message with no reply and no reason.
- [ ] The narration guard is phrase-based for English only. A model narrating in
  Arabic would pass everything except the tool-name check.

### Hardening the customer bot: sanitizer, metering, and channel separation — 2026-08-29

Three follow-ups from the WhatsApp plan, taken in order of risk rather than size.

**The sanitizer was missing, and the plan named it twice** — once as a phase-5
task and once as a permanent review criterion for every PR on this path. The
customer bot shipped without it. That prompt is reachable by **anyone who knows
a shop's public number**, which makes it the widest untrusted input surface in
the product, and the customer's text was going in raw.

`sanitizeForPrompt` now covers the message, **the replayed history**, and the
shop name. History matters as much as the newest message: an injection parked in
message three is no less live for having been stored politely — storage keeps it
verbatim, because the merchant's inbox is the record, but replaying it into a
prompt makes it input again. On the way out `detectSuspiciousOutput` withholds a
reply that looks like it carries a credential; that one would leave on the
**merchant's own number**, to a stranger, in the merchant's name.

**Metering: `ai.agent.customer`**, QUOTA / request / MONTH, reserved *before*
the model runs and committed after — booking afterwards counts the spend without
preventing it, and this is the one agent surface a stranger can drive. Separate
from `ai.agent.chat` deliberately: that one is spent by somebody signed in who
stops when they stop typing, and a shared ceiling would let a busy Saturday of
customer questions eat the merchant's own assistant quota. `MONTH` because
customer traffic is spiky in a way a vendor's own use is not, and a daily cap a
normal Saturday breaches gets raised until it means nothing. Off on FREE. A shop
out of quota is answered by **silence** — the message is already in their inbox,
and "we have run out of AI credit" is not a thing to say in a merchant's name to
their customer.

**Channel separation, from a note during the work:** a vendor's WhatsApp threads
were appearing in the dashboard's Sidekick list, mixed with browser
conversations. That sidebar is things you can open, rename, pin and share; a
WhatsApp thread is none of those. `listForVendor`, `listArchivedForVendor` and
the auto-archive sweep are now all filtered to `channel: WEB`. **The sweep
especially** — it is a soft delete that exists to keep that list short, so
running it on a thread nobody can see buys nothing and silently costs the vendor
their context on a channel where they cannot tell it happened. A merchant who
asks something once a week is exactly who that would have hit.

The plan file `docs/future-features/whatsapp-evolution-api.todo.md` was also
reconciled with reality — it still described phases 5 and 7 as unstarted while
most of both had shipped, which is worse than being incomplete.

- [ ] `channels.whatsapp` (channel volume including notifications) still not
  added — what was fixed is unbounded model spend, not message volume. Two
  different ceilings.
- [x] Shadow user still not built and the decision is still open at the top of
  the plan file. Needed before a WhatsApp customer can be tied to an order.
  (Decided 2026-09-25: no shadow user. An account is created when the customer
  opens the claim link or registers by name in the chat, from the sender's own
  number and marked proven — see `back-end/docs/features/cart-claim.md`.)

### The customer bot's untrusted-input path, and the two channels pulled apart — 2026-08-29

Two gaps closed after re-reading `docs/future-features/whatsapp-evolution-api.todo.md`
against what had actually shipped — the plan listed both, and one of them is a
**permanent review criterion** on that file, which makes missing it worse.

**`ai-sanitizer` was not applied to the customer bot at all.** That prompt is
reachable by anyone who knows a shop's public number — the widest untrusted
input surface in the product — and the customer's text went into it raw. Now the
message, **the replayed history** and the shop name all pass `sanitizeForPrompt`.
History matters as much as the newest message: an injection parked in message
three is no less live for having been stored politely, and storage deliberately
keeps it verbatim because the merchant's inbox is the record. On the way out,
`detectSuspiciousOutput` withholds a reply shaped like a credential — that reply
would leave on the **merchant's own number**, to a stranger, in their name.

**And the two channels were sharing the dashboard's conversation list.** A
vendor's WhatsApp thread with the assistant was appearing in the Sidekick
sidebar beside their browser chats. That sidebar is things they can open,
rename, pin and share; a WhatsApp thread is none of those. Worse, the
**auto-archive sweep** was eligible to soft-delete one — and since the sweep
exists purely to keep that list short, running it on a thread nobody can see
bought nothing and cost the vendor their context, silently, on a channel where
they could not tell it had happened. A merchant who asks something once a week
was exactly who it would hit. All three surfaces are now `channel: WEB`.

The plan file was also **reconciled with reality**: it still described phases 5,
7 and 8 as untouched while most of them had shipped, and it recorded neither
deviation — no shadow user (the identity lives on the inbox row instead, and
that decision is still open at the top of the file), and the channel columns
landing on `DirectConversation` rather than `Conversation`. A plan that says
unbuilt things are built is worse than one that is merely behind.

- [ ] **No metering on the customer bot — the largest remaining risk.**
  `channels.whatsapp` and `ai.agent.customer` do not exist, and no reply writes
  a `UsageEvent` with `cost_cents`. The vendor agent reserves against
  `ai.agent.chat`; this one calls the model with nothing counting it, on a
  number strangers can reach.
- [ ] No per-number flood guard on the public number. The vendor bot has a
  4-second cooldown; the one open to the public has none.
- [ ] The escalation does not notify the merchant — the bot goes quiet for 24
  hours and nothing tells them a customer asked for a person.

### A numbered menu for the customer bot — after WhatsApp's own controls failed — 2026-08-29

Asked whether we could do JAWWAL PAY-style interactive menus. **Tested both
formats against the live session rather than answering from the docs, and both
fail on this transport:**

- `sendList` (the bottom sheet every bank bot uses) — Baileys refuses to build
  it: `TypeError: this.isZero is not a function`. The `listMessage` template is
  deprecated. Failed identically on two different instances, so not incidental.
- `sendButtons` — **worse, because it succeeds.** The API returns 200, the
  message is delivered, Evolution stores it as `viewOnceMessage` wrapping a
  `nativeFlowMessage`… and it arrives on the handset as plain text with the
  buttons silently dropped. Confirmed on a real phone.

That second one is the important finding: a green log and a delivered message
for a control that does not exist on screen. Building navigation on it without
looking at a handset would have shipped a feature that works in every log we
keep and for none of our customers. Those controls are gated to the official
Cloud API with a verified business; a QR-linked session is neither, and getting
there means Meta verification, a registered number, pre-approved templates, a
24-hour window and per-conversation pricing — a channel rewrite, not a feature.

So: **a numbered text menu**, which renders identically everywhere and buys the
two things the buttons were wanted for. Navigation now costs **no model call** —
a bare numeral is a lookup, and paying a model to recognise "3" is slower and
less reliable than reading it — and "talk to the shop" is an explicit choice
rather than something an agent has to infer. The bare-numeral rule is lifted
from `VendorBotRouterService.handleShopPick`, which learned it first: `3` is a
choice, `3 قطع بكم؟` is a question that happens to start with a digit.

**Option 4 required a column to not be a lie.** `ai_paused_until` on
`DirectConversation` — a deadline rather than a flag, because nothing in the
dashboard can clear a boolean yet and a permanent pause would strand the thread
the first time a customer pressed it and no merchant noticed. Checked *before*
the menu parser, so somebody who asked for a person is not pulled back in by
typing a number.

The menu shows once, on first contact, and `wantsMenu` matches whole greetings
only — "مرحبا، بدي أعرف سعر الآيفون" gets the price, not a list. 9 tests, most of
them on the parser, because that is the half that fails quietly.

**Two bugs found by using it, both in the same place.** Pressing "1" on an
Arabic conversation answered in **English**: the language was detected from the
one message, and `"1"` has no Arabic in it, so "no Arabic found" was read as
"English". `detectLang` now has a third answer — `null`, meaning *this message
carries no language* — and the caller asks the thread instead: the most recent
thing the **customer** wrote that had letters in it. The assistant's own replies
are excluded, or one English answer would pin the thread to English for good.

And writing that test surfaced a worse one. `٠-٩` — the Arabic-Indic digits an
Arabic keyboard actually produces — sit **inside** the `؀-ۿ` block, so a
bare `٢` read as Arabic prose; and `\d` matches neither that range nor the
Persian/Urdu `۰-۹`, so `parseMenuChoice('٢')` returned null. **The menu was
unusable for exactly the customers it is written in Arabic for**: they read "رد
برقم", typed ٢, and their choice went to the model as a free-text question. Both
ranges are normalised now, and a digit carries no language in any script.

- [ ] The menu's options 1 and 2 both land on "what are you looking for?" and
  then hand the next message to the model. Fine, but 1 could list a few actual
  products instead of asking — it has the tool already.
- [ ] Nothing un-pauses a thread early. When the inbox UI lands, a merchant
  replying should clear `ai_paused_until` rather than waiting out the 24 hours.
- [ ] Reconsider if the platform ever moves to the official Cloud API: real
  list messages would replace this, and the menu module is where that swap
  would happen.

### The customer bot — a shop's own assistant on a shop's own number — 2026-08-29

`ai_enabled` had been a switch with nothing behind it: `WhatsAppInboundService`
returned early for shop instances, so a merchant could turn the customer
assistant on and watch it do nothing. It now answers.

**It is a separate runtime from the vendor agent, and that is the security
design rather than tidiness.** The vendor agent answers *as the owner* — its
tools take a `userId`, and `get_shop_stats` / `get_yearly_sales` /
`get_top_products` are a shop's revenue. Here the person writing is a stranger
whose only identifier is a phone number. So `CustomerBotService` has its own two
tools, its own prompt, no checkpointer and no writes, and both tools run through
`ProductsService.findAllStorefront` — the same path an anonymous browser gets,
PUBLISH + active only, with no `cost_per_item_cents` to return. **The boundary
is which code path exists, not what the prompt says**: an instruction smuggled
into a customer message has nothing to reach even if it is obeyed perfectly.

**There is no order tool, by decision.** A phone number is not authentication —
the same reasoning `VendorBotLinkService` was built on — and what it would unlock
is somebody's address and purchase history. Order questions get one fixed
handoff sentence and the merchant answers.

**Storing is unconditional; answering is not.** The processor files the message
into the shop's inbox before it looks at `ai_enabled`, which is what makes the
settings card's promise literally true rather than approximately: a merchant who
declines the assistant still gets every message. And the flag is read in the
**worker** rather than captured at enqueue, so switching it off catches messages
already in flight instead of answering a few more in their name.

The inbox learned three columns to hold a customer with no account
(`2026-08-28-whatsapp-customer-inbox.sql`, applied locally): `channel` and
`channel_identity` on `DirectConversation`, and on `DirectMessage` a **nullable**
`user_id` (`SetNull`, so removing a staff account cannot take the shop's record
of a conversation) plus `sender` — `CUSTOMER` / `AI` / `VENDOR`. That last one
is not derivable from `user_id`: a vendor's own reply and their assistant's both
leave the shop with a null user here, and a merchant has to be able to see what
was said in their name. `DirectMessageEntry.user_id` went nullable with it, which
would otherwise have thrown on the first WhatsApp thread anyone opened.

`check:di` earned its keep again: `nest build` was green while the graph did not
resolve, because `WhatsAppModule` registered the vendor queue and not the
customer one.

- [ ] **Render the three voices in the vendor dashboard.** The data is there and
  nothing displays it — the inbox has no channel badge and no visual difference
  between a customer, the AI and the merchant. This is the half of the original
  brief (screens 11 and 13) that is still not built.
- [ ] No plan entitlement of its own. Every other agent surface reserves against
  a capability; this one calls the model with nothing metering it, so a busy
  shop's customer traffic is unbounded spend. `ai.agent.customer` was named in
  the Station 4 plan and does not exist.
- [ ] No per-number flood guard. The vendor bot has a 4-second cooldown; a
  shop's public number has none, and it is the one that strangers can reach.
- [ ] Media is ignored rather than acknowledged — a customer who sends a photo
  of a product gets silence from the bot until the merchant reads the thread.
- [ ] Real-time incoming-message updates in the dashboard still need a publisher;
  the connection half is done, the message half is not.

### The vendor assistant enrols off the shop's QR — no pairing code — 2026-08-28

Two changes, and the first is why the second was worth making.

**The inbound receiver rejected every platform delivery, silently.**
`WhatsAppInboundService.verify()` looked the webhook secret up in
`shopWhatsAppInstance` alone, and the assistant's session is deliberately a
*separate* model (`PlatformWhatsAppInstance` — different lifecycles: a shop's
is torn down on suspension, this one outlives every shop). So
`instance_name: 'platform_assistant'` found no row and every delivery was
refused. The dispatch fork in `handle()` had never been reachable. It is the
worst shape of bug to diagnose from outside: the session reads `Connected`, the
webhook is correctly registered on Evolution with `MESSAGES_UPSERT` enabled,
and the only symptom is an assistant that never answers — which looks like
anything except an authentication failure. `secretRowFor()` now forks on the
instance name, exactly where `handle()`, `onConnectionUpdate` and `onQrCode`
already did. Six tests, including one that pins the two tables apart in both
directions; there had been no spec for the service at all, only its parsers.

**Then the six-digit pairing code was removed entirely.** It carried the
account proof to the handset proof over a channel the vendor had to operate by
hand — read the digits off the dashboard, open WhatsApp, send them to a second
number — and the shop's own QR scan already carries both at one moment: the
scan happens inside an authenticated session behind `ShopOwnershipGuard` (the
account), and the number is reported by the provider rather than typed (the
handset). `WhatsAppInstanceService.reconcile` now emits
`whatsapp.instance.shop_connected` when a session goes live **and** the provider
has named the handset, and `VendorBotPairingListener` binds it to the shop's
**owner** — derived from the shop, not from a caller, because a reconcile can
run with no request behind it and an account that depended on *when* a
connection was noticed would be a bug waiting. `autoLink` is idempotent, pins
the shop it paired, will not drag a deliberately switched assistant back, and
refuses to move a handset verified against another account (a shared business
line keeps its first binding rather than breaking a working assistant).

An unknown number now gets **one fixed sentence** instead of silence — the same
one for every stranger, naming what the line is for and revealing nothing about
whether the sender is known. Never the model: the number is printed on every
vendor's settings screen, so an agent answering strangers would be an open LLM
endpoint on a public phone line. Silence was right for security and wrong for
the one person it stranded — a merchant writing from a phone that is not the
one they scanned with.

Gone with it: `startVendorBotLink`, `VendorBotLinkService.start`/`redeem` and
their digest helpers, `VendorBotPairingCode(Response)`, the pairing panel, and
every string about codes. **And the `/settings/vendor-bot` route with them** —
it existed to hold the pairing flow, so once enrolment moved into the QR scan it
had nothing left to do; what remained (which phone, which store, unlink) is
three facts and a button, and they now sit on the WhatsApp screen's assistant
card beside the number they are about. `features/vendor-bot/` survives as
operations and types only, kept separate because they are account-scoped and
carry no `X-SHOP` meaning. `verified_at` stays — set at creation now, but the
partial unique index on `phone_e164` is defined over it, and dropping it would
let two accounts claim one handset.

- [ ] Run `prisma/migrations/manual/2026-08-28-vendor-bot-drop-pairing-code.sql`
  — drops the dead `code_hash` / `code_expires_at` columns. Destructive, so it
  is written and deliberately not run. The columns are already gone from
  `schema.prisma`, which means a `prisma db push` would drop them too; run the
  SQL against the intended database rather than letting push decide.
- [ ] **No backfill for shops already connected.** Enrolment fires on the
  *transition* into `connected`, and `reconcile` early-returns when nothing
  changed — so a shop that was already live when this shipped has no link until
  it reconnects. One disconnect + rescan fixes each; a script would be better if
  this reaches more than a handful of shops.
- [ ] Revisit whether a shared business line should reach the assistant at all.
  The enrolled handset is now whichever phone scanned the shop's QR, so staff
  answering customer chats on that phone can also ask for sales figures
  (read-only). The old code flow let an owner nominate a different phone; this
  does not.

### The vendor assistant on WhatsApp — one platform number, not one per shop — 2026-08-28

The customer channel and the vendor channel turned out to want **opposite routing keys**, and building the second one made that explicit. On a shop's own instance the shop is known before the sender is, and the sender is one of its customers. On the assistant's number the instance identifies nobody: the sender's phone resolves an *account*, and which of that account's shops they mean is a second question again. One number for every vendor, rather than an AI bolted onto each shop's session.

The agent needed almost nothing. `VendorAgentConversation` was already keyed `(user_id, shop_id)` and `VendorAgentService.chat()` already took `{userId, shopId, message}` — the whole delta is a `channel` argument. What had to be built was the transport and the identity underneath it.

**Identity is an act, not a match.** Resolving an inbound number against `User.phone` would have been one query and no UI, and it is exactly the design avoided: a phone number is not authentication, carriers reassign them, SIM swap takes them, and what it unlocks here is a shop's catalogue and its revenue. So a binding needs two independent proofs and neither implies the other — the dashboard session that minted a hashed, expiring, single-use code, and a message carrying it sent *from the handset*. There is no mutation anywhere that accepts a phone number, and there must not be: one would let a signed-in vendor bind a phone they do not hold.

**Read-only on the channel, and that is a runtime fact rather than caution.** Ten write tools never touch the database at all — they return a `navigate_to_form` intent and the vendor presses Save on the real form, which over WhatsApp resolves to a reply pointing at a screen nobody is looking at, reporting success for a change that never happened. Five more pause on an approval interrupt expecting a card with a server-computed blast radius on it, and `chat()` auto-declines an interrupt nobody answers — so they would fail *after* the model announced them. The allow-list is 12 read tools, filtered before the model is shown them, with a gate behind it and a default of denial for anything unclassified.

**Three things were found while building, none of them in the plan.** `onQrCode` dropped the platform's pairing code entirely — it looked up a shop for an instance that has none, so the admin's scan screen would have shown one stale frame forever; the assistant's stream now rides the same SSE machinery under a sentinel key. The adapter cache was about to be duplicated, which is not a tidiness problem but a delayed correctness one: an admin repoints Evolution, one cache notices and the other serves the old base URL until something unrelated evicts it. And `WhatsAppModule` sits deliberately outside the auth graph while this needs the whole agent, so the two are joined by a **queue name and a type-only import** — a producer class either way and the module graph stops resolving.

- [ ] Carry the vendor's original question across the shop-picking round trip. Today a multi-shop vendor's first message is spent choosing, and they retype it. Needs the text parked somewhere with a short TTL.
- [ ] Writes on the channel: a text-shaped confirmation and a real commit path for the tools that currently return `navigate_to_form`.
- [ ] Arabic replies are the agent's own `detectLanguage`; the router copy is hand-written in `vendor-bot.copy.ts`. Revisit if a third language lands.
- [ ] `linked_vendors` on the admin card counts every verified handset; no way yet to see *which*, or to revoke one from the console.
- [ ] Human escalation from the assistant into `conversations/`.
- [ ] Meter assistant turns separately from dashboard turns — both reserve against `ai.agent.chat`, so a vendor's phone usage silently eats their in-app allowance.

### The text LLM became an admin setting — provider AND model, chosen in the console — 2026-08-27

The Sidekick chat had been answering "صار خطأ غير متوقع" for every message. Not a bug in this codebase: **Groq retired `llama-3.3-70b-versatile` and `llama-3.1-8b-instant`**, and both were written out as string literals at eighteen call sites across thirteen files. All eighteen began answering `404 model_not_found`; `AgentService` catches that and substitutes a friendly sentence, so the entire AI surface — chat, categorization, moderation, coupons, FAQ, sentiment, intent, product extraction — degraded silently with nothing on any screen saying why. The key was fine the whole time (verified: valid, 14 models, not one of them a Llama chat model).

Replaced with `src/ai/openrouter-chat.ts` — the single place a chat model is constructed, on the same OpenRouter + `ChatOpenAI` seam `AltTextService`, `EnhanceVisionService`, `ImageModerationService` and `AISegmentBuilderService` already used. `@langchain/groq` uninstalled; `GROQ_API_KEY` gates replaced by `hasChatModel(config)`. **The model is now an environment variable** (`OPENROUTER_MODEL` / `OPENROUTER_FAST_MODEL`), which is the actual lesson: a hosted model is not a constant, and the next retirement should be a `.env` line rather than a thirteen-file sweep.

Two things were fixed on the way past. `IntentClassifierService` built three "primary/fallback" models that, behind one gateway, all resolved to the **identical client** — so its retry re-ran the same model and could only fail the same way; the second tier is now the capable model. And `createChatAgent` lost `apiKey`/`fallbackApiKey`/`fallbackBaseUrl`: those existed because the fallback was a second *provider*, and behind one gateway it is a sibling model on the same account.

Defaults are `:free` ids verified against this account for **tool calling and Arabic** (`nvidia/nemotron-3-super-120b-a12b:free`, `nvidia/nemotron-3.5-lightning:free`) — because the configured OpenRouter key has never purchased credits, so `openai/gpt-4o-mini` answers `402 Insufficient credits`.

**Superseded the same day, by request: Groq is back, and the choice moved into the admin console.** Removing a provider to escape a broken model was treating the symptom — the real defect was that *which vendor* and *which model* were compile-time facts at all. `IntegrationType.AI_CHAT` now holds both, with two provider specs (`openrouter`, `groq`) behind one `ChatModelService` that resolves per call and caches per profile on the credential revision. An admin switches vendor in a dropdown and the next message uses it: no deploy, no `.env` edit. `@langchain/groq` is a dependency again, pinned.

Three consequences worth knowing. **Availability became async** — it is a database row now, so the synchronous `available` getters and constructor key-checks that used to gate LLM features could only ever have described the *environment*; `ContentModerationService`'s boot warning is an `OnModuleInit` hook for the same reason. **The three services that build their own client** (`vendor-agent` streams over raw `fetch`; the two segment services want per-call token budgets) read `ChatModelService.credentials()` rather than `ConfigService` — a platform where switching provider moves most LLM traffic and silently leaves the rest behind is worse than one that never switched. And **`AI_CHAT` is the one AI type with a real test send**: `verify` proves the key, the test proves the *model*, and the model is precisely the half that broke.

- [ ] **Buy OpenRouter credit, then set the model to a paid id in the console** (`/integrations/ai-chat`), or switch the provider to Groq. OpenRouter's published policy caps a never-purchased account at ~50 free-model requests/day; this AI surface will exhaust that. Arabic quality on `openai/gpt-4o-mini` is also clearly better than on the free defaults.
- [ ] **`OPENROUTER_VISION_MODEL` is still the paid `openai/gpt-4o-mini`**, so `alt-text`, `enhance-vision` and `image-moderation` return 402 today. Either buy credit (fixes it with no code change) or pick a free vision model.
- [ ] **Reasoning-mode free models break every tight-budget caller on OpenRouter.** Probed 2026-09-03: `nvidia/nemotron-3-super-120b-a12b:free` and `nemotron-3.5-lightning:free` think before answering and the thinking counts against `max_tokens`, so with the `maxTokens: 10–300` the classifiers pass (`intent-classifier`, `review-sentiment`, `content-moderation`, `auto-categorize`, `intent-chain`) they return `finish_reason: length` and the *content* is the reasoning narrative — the same shape as the customer-bot leak. `reasoning: { enabled: false }` makes the same model answer `negative` in 2 tokens, but `minimax/minimax-m2.7:free` answers 400 "Reasoning is mandatory" to that flag. Add it to `ChatModelService.model()`'s OpenRouter branch as a per-row option, not unconditionally.
- [ ] **`:free` ids are a shared pool and were upstream-rate-limited (429) for the whole probe** — `google/gemma-4-31b-it:free`, `gemma-4-26b-a4b-it:free`, `z-ai/glm-5.2:free` — and `minimax/minimax-m2.7:free` mixed Chinese into an Arabic reply. `invokeChatWithRetry`'s single retry cannot ride out an hour-long limit. Buy the one-time $10 credit (raises the free cap from 50 to 1000 requests/day and unlocks paid ids) and move the capable tier to a paid id; keep `:free` for the fast tier at most.
- [ ] **`OPENROUTER_API_KEY` cannot leave `.env` yet.** `alt-text`, `enhance-vision` and `image-moderation` read it (with `OPENROUTER_BASE_URL` / `_SITE_URL` / `_APP_NAME`) straight from `ConfigService` and never consult the `AI_CHAT` row. Everything else the console owns left `.env` on 2026-09-03: `GROQ_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_FAST_MODEL`, the Mailtrap SMTP fallback, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CALLBACK_ORIGIN`. Route the three through `ChatModelService.credentials()` — keeping `OPENROUTER_VISION_MODEL` as the model override, since the row's id need not see images — and the key goes with them.
- [ ] **`ai_request_logs` does not exist in the local database**, and `logAiRequest` writes to it inside a silent `try/catch` — so every AI error is discarded and this outage had to be diagnosed by replaying the mutation by hand. Add the manual migration.

### AI product video — feature removed 2026-08-17

Withdrawn at the owner's request. `back-end/src/ai/video/`, both vendor surfaces (the product form's **Generate video** panel and the AI Studio's video mode), the `AiVideoGeneration` model with its two enums, the `ai.video.generate` entitlement, the `video` billing unit, the `VIDEO_GEN` queue, the `AI_VIDEO_*` error codes and the `video_motion`/`video_scene`/`video_pace` lookups are all gone. `AttachmentsService.fetchRemoteVideo` went with it — the generation ingest was its only caller.

**Manual video was deliberately kept.** `products.video`, the `VideoStrip` on the media manager, the mp4/webm upload allow-list and the media library's video facet are untouched — a vendor can still attach a clip they made themselves. The two labels that survived moved from the `aiVideo` namespace to `productVideo`.

- [ ] **Run the drop migration on every database.** `npx prisma db execute --file prisma/migrations/manual/2026-08-17-drop-ai-video-generations.sql`. Until then the schema and the database disagree: `ai_video_generations` plus the `VideoGenMode` / `VideoGenStatus` types are orphaned. Destructive — it discards generation history. Attachments already ingested are not touched, so any clip staged onto a product keeps working.
- [ ] **Purge `ai.video.generate` rows from live plan entitlements.** The capability is out of `FEATURE_REGISTRY`, but any `plan_entitlements` row seeded from it is still in the database and now references a key nothing resolves.

### Sidekick form-handoff URLs pointed at /dashboard — fixed 2026-08-10

Every `navigate_to_form` intent built `/dashboard/<shopSlug>/...`, but the vendor app's authed segment is `/store`, so "Open form now" always landed on a 404. Fixed in the five `vendor-agent/tools/*` files; `create-product.tool.spec.ts` now pins the URL.

- [~] Attachment URLs are stored absolute, so a row uploaded locally (`http://localhost:3000/uploads/...`) is a dead image on the live server. `.env.development` sets `STORAGE_DRIVER="local"` and wins over `.env`'s `bunnycdn`, so local uploads never reach the CDN. **Code half done 2026-08-13; the two decisions are still yours.** The write is no longer silent — `StorageFactory` logs an `error` at boot when local storage is paired with a remote `DATABASE_URL`, and when `bunnycdn` has an empty pull zone (which interpolates to a hostless `https:///…`). It warns rather than refuses: local files with a local database is the ordinary dev setup, and only you know whether a given remote `DATABASE_URL` is shared or a scratch copy. The repair for rows already written is **`npm run rebase:urls -- --from http://localhost:3000/uploads --to https://<pull-zone>`** — dry run by default, `--apply` to write, one transaction over the `attachments` rows plus all 27 reference columns. It moves no bytes, so the objects must be uploaded under the new base first. Still open: (a) whether dev writes to Bunny, (b) running the rebase against each real database. *No read-time URL resolution* — that is T3-7 (reference by id); the URL is copied into ~27 columns, so making `attachments.url` computed would leave every copy stale.
- [~] A live BunnyCDN storage key is committed in `back-end/.env.example` — **placeholder written 2026-08-11**, rotation at Bunny still open. See [docs/go-live-checklist.md](docs/go-live-checklist.md) step 2.

### Image and video generation were broken by an advisory-lock bug — fixed 2026-08-16

`reserveMonthlyQuota` took its `pg_advisory_xact_lock` with `$queryRaw` in both `ImageGenService` and `VideoGenService`. The function returns `void`, which the Prisma pg driver adapter cannot deserialize, so **every** run failed the whole transaction with `P2010` and reached the vendor as a bare `DATABASE_ERROR`. `ai_image_generations` was empty on the live database while `ai_usage` recorded 17 billed image calls across three days — the platform paid for vision and moderation on work no row ever recorded. Both now use `$executeRaw`, matching the coupon, refund and inventory-transfer locks, which were always correct. Verified against the live database: lock, count and insert all complete.

- [ ] **Nothing tested the lock against a real database.** `video-gen.service.spec.ts` asserted `$queryRaw` was called against a Prisma mock that returns `[]` for anything, so the suite was green for a path that could never work. The spec now pins `$executeRaw`, but the general gap stands: a mocked Prisma cannot catch a driver-level deserialization failure. An integration test against a scratch Postgres would.
- [ ] **`MonthlyUsageEntry` is imported and unused in `image-gen.service.ts:70`**, which fails `npm run lint` (an error, not a warning). Pre-existing, from the video feature commit — unrelated to the lock fix, left alone deliberately.
- [ ] Review the two `hashtextextended` locks in `coupons/engines/usage.engine.ts` and `refunds.service.ts` for the same class of mistake if the adapter ever changes; they are correct today only because they already use `$executeRaw`.

### Replicate moved into the integrations console — `AI_MEDIA` (2026-08-16)

`REPLICATE_API_TOKEN` / `REPLICATE_WEBHOOK_SECRET` / `REPLICATE_WEBHOOK_URL` were environment-only and read once in each strategy's constructor, so rotating the token was a redeploy and "which account is this billed to" had no answer in the console. They are now one `AI_MEDIA` integration — one row for both the image and video pipelines, because one Replicate account bills both — resolved per call through `AiMediaCredentialsService`, with the env vars kept as the fallback. `isEnabled()` is async on both provider interfaces as a result. New: `ai/ai-media-credentials.service.ts`, `ai/replicate-session.ts`, the `replicate` spec in `provider-registry.ts`, and `supportsTestSend` (AI media has no test send — its cheapest call is billable).

An **off switch** ships with it: `AI_MEDIA` has a second provider, `off`, with no fields. Enabling it stops image and video generation platform-wide and is the only thing that can — disabling the Replicate row returns the platform to its `REPLICATE_API_TOKEN` fallback and keeps generating. The console renders it as a switch and hides it from the transport picker.

- [ ] **The off switch stops new runs, not runs already in flight.** With it on, `verifyWebhook` rejects every delivery and the reconcile sweep cannot poll, so predictions started moments earlier are swept to FAILED and their spend is not recovered. Acceptable for a kill switch and worth naming: if a graceful variant is ever wanted, it needs the sweep to keep polling with the last-known credentials.
- [ ] Vendors see `FEATURE_NOT_AVAILABLE` / `AI_IMAGE_NOT_CONFIGURED` when it is off — "not configured" rather than "turned off". A distinct error code would read better but costs new i18n keys on both apps; left as-is deliberately.
- [ ] **Apply `prisma/migrations/manual/2026-08-16-integration-type-ai-media.sql`** to every database. `db push` in the Render build handles it (adding an enum label is additive), so this is only for databases patched by hand.
- [ ] **Save the Replicate credentials in Admin → Integrations → AI image & video, then remove the three env vars.** Until the row exists the platform keeps using `.env`, which is correct but means the console still shows source `ENVIRONMENT`. Note the token is on the 2026-08-09 rotation list below — rotate at Replicate and paste the new one straight into the console rather than back into Render.
- [ ] **`ImageProviderRegistry.resolve()` / `VideoProviderRegistry.resolve()` still default to `REPLICATE`**, and every call site passes it explicitly. Harmless while Replicate is the only strategy, but a second provider enabled in the console would not be picked up — the registries need to read `AiMediaCredentialsService.activeType()` at that point. `PROVIDER_TYPES` in `ai-media-credentials.service.ts` already maps all four `ImageProviderType` slugs, so only the registries and their call sites are left.
- [ ] Adding a second generation vendor (OpenAI, Fal, Stability) is a `ProviderSpec` in `provider-registry.ts` plus a strategy under `ai/image/strategies/` and `ai/video/strategies/`. The console needs no change — it renders from `integrationProviders`. Only one provider can be enabled per type, so image and video would move together.
- [ ] `back-end/src/integrations/integrations.resolver.spec.ts` asserts on source text with `\n` literals, which fails on any checkout with `core.autocrlf=true` (every Windows dev box). Pre-existing, unrelated to this change; normalize the read or the assertion.

### AI image — code-level audit findings (2026-07-20)

An external review of `docs/features/api/ai-image.md` scored the feature 9.3/10 reading docs only. A code-level sweep (7 defect lenses, each finding refuted from 3 angles before being kept) returned 29 surviving findings. Every miss sits in the gap between doc and code — including a code comment at `image-gen.service.ts:493` describing a true-up the next line does not perform. Nothing below is fixed yet; ordered by severity.

**P0 — critical**

- [~] **REPO-WIDE cross-tenant IDOR — audited 2026-07-21, Tier 1 + Tier 2 FIXED, Tier 3 open.** Not an `ai/image` bug: **62 resolvers use `ShopHeaderGuard`, only 9 used `ShopOwnershipGuard`** (8 of them analytics/attribution). Root cause is a decorator pair that reads like a scope but isn't — `PermissionsGuard` matches with `.some()` and `DEFAULT_ROLE_PERMISSIONS.vendor` grants `manage_own_shop`, so `@RequirePermissions(MANAGE_OWN_SHOP, MANAGE_ALL_SHOPS)` admits **every vendor**, and nothing binds "own" to the shop in `X-SHOP`. **Scoping by `shop_id` is not a mitigation** — `ShopHeaderGuard` derives `shop_id` from the attacker's own header. The three services that get it right (`withdrawals`, `balance-ledger`, `orders`) resolve owned shop ids from `user.id` and let the header only *narrow* within that set.
  - **Fixed (Tier 1 — guard-level):** `webhooks` (7 ops — worst finding: register your own URL on a victim shop and receive every future order/customer payload, with the HMAC secret returned so deliveries validate), `contacts` reads (**had no `PermissionsGuard` at all** — any authenticated account, including a plain customer, could dump a shop's CRM), `customer-segments` reads (**`OptionalJwtGuard` — unauthenticated**), `settings.upsertSetting`, `suppliers` (5), `purchase-orders` (8 — competitor COGS/margin via `unit_cost_cents`), `tax-classes` (5).
  - **Fixed (service-level — guards alone could not close these):** `draft-orders.getDrafts` assigned the ownership filter then unconditionally overwrote it with the header (`where.shop_id = shopId`) — now intersects. `customer-segments.recomputePredictedSpendTiers` / `reconcileCustomerContacts` honoured an `@Args('shopId')` that bypassed shop context entirely — vendors may now only name their own shop. `tax-classes` update/setDefault/delete and `inventory` locations/levels/history took bare ids that addressed **any** shop — all now resolve the id inside the shop first. The four stock mutations (adjust/setAvailable/editStock/transfer) assert the location belongs to the shop; transfer checks **both** ends.
  - **Tier 3 CLOSED 2026-08-12.** `coupons` (5 ops), `inventory-transfers` (15), `digital-files` (2), `attachments` (5), `flash-sales` (3) all carry `ShopOwnershipGuard` now. **The sweep that closed them found four more modules with no ownership check at all**, none of them in this list: `vendor-agent` (14 ops — worst of the set: driving the agent against a victim shop creates products, sets inventory and spends their AI quota), `notifications` (10 — rewrite another shop's customer email templates and sender), `staff-notifications` (5 — subscribe yourself to a victim's new-order mail) and `store-notices.createStoreNotice`. All closed. Also closed alongside: `attachments` had **no `PermissionsGuard` at all**, so any signed-in account could browse any shop's media library, and `suggestAttachmentAlt` was an SSRF primitive (client-supplied `url` → bare `fetch()`).
  - **Fixed 2026-07-26 — `attachment(id)`.** It had only `JwtAuthGuard` and no shop filter, so any signed-in vendor could read any shop's file by id. Now `JwtAuthGuard, ShopHeaderGuard, RequireShopGuard` with the lookup filtered on `shop_id`, so a foreign id is a 404. Raised in priority because the vendor Files editor became a route (`/content/files/:fileId`), which puts the id in the address bar where it can be edited by hand.
  - **Fixed 2026-07-26 — SSRF on `POST /attachments/from-url`.** `fetchRemoteImage` was a bare `fetch(url)`: no scheme check, no private/loopback/link-local rejection, redirects followed blind, no timeout, the 15 MB cap applied *after* `arrayBuffer()` had already buffered the body, and the format taken from the remote's own `Content-Type` (defaulting a missing one to `image/png`). The request leaves from inside our network, so `http://169.254.169.254/` and `http://10.x:6379/` were reachable from there and the response came back as an "image". Now `remote-image.guard.ts`: http/https only, every resolved address vetted per redirect hop (max 3), 15 s timeout, `Content-Length` pre-check, and format by magic bytes — which also refuses remote SVG (stored XSS from our own CDN path). 43 unit tests. Pre-existing, not introduced here; fixed alongside the studio because that promotes URL import from a buried dialog to a first-class affordance.
  - **Unverified, needs a direct read:** `refunds` and `shipping` — both have `owner_id` references in the service, so they may already be safe by the correct pattern.
- [~] **Per-operation ownership triage — the GLOBAL-row half closed for 7 of 12 services, 2026-08-12.** The triage found something sharper than a missing guard: 24 sites across 12 services used `if (existing.shop?.owner_id && owner_id !== userId)`, which **skips the owner check entirely when the row is platform-global** (`shop_id` null — and 11 of the 12 tables have nullable `shop_id`, including `Product`). Any vendor could rewrite or delete global tags, taxes, shipping zones, pages-adjacent content. **Fixed in `tags`, `taxes`, `attributes`, `authors`, `manufacturers`, `shipping` (4 sites incl. zones), `contacts`** — all now run `assertShopScopedMutation` (global = admin-only, vendor must own, admin passes; the old conditional also wrongly refused admins on vendor rows). Pinned by a global-row test pair in `tags.service.spec.ts`; `banners`/`menus`/`pages` were already migrated. **ALL 24 sites closed as of the same day** — the second pass finished `products` (3: `update`/`delete`/`duplicate` — strict, not role-aware, since every caller is a vendor path carrying only a user id and admins were already refused there), `products/relations` (2), `flash-sales` (2 — dead branch, the query pins `shop_id`, unified anyway) and `webhooks` (1 — dead, NOT NULL column). `grep 'owner_id && ' src/**/*.service.ts` returns **zero**. The original per-operation guard triage for the ~24 mixed resolvers (which reads get `describeGuardChain` + `publicOps`) remains open.
  Original item: **Per-operation ownership triage for the ~24 mixed resolvers (from the 2026-08-12 sweep).** These use `ShopHeaderGuard` without `ShopOwnershipGuard` and, unlike the nine already handled, mix storefront reads with vendor writes on the same resolver: `products`, `storefront-products`, `collections`, `orders`, `draft-orders`, `cart`, `checkout`, `questions`, `feedbacks`, `pages`, `menus`, `banners`, `tags`, `taxes`, `shipping`, `refunds`, `refund-policies`, `returns`, `attributes`, `authors`, `manufacturers`, `delivery-times`, `terms-conditions`, `conversations`, `chat`, `notify-logs`, `plans`, `ai`, `languages`, `lookups`, `faqs`. **`reviews` triaged 2026-08-17** alongside the vendor reviews screen: the two new vendor queries carry the full chain, the five existing ops are named in `reviews.resolver.spec.ts`'s `publicOps` with a written reason each (two storefront reads, two customer-owned writes scoped by `user_id`, one `manage_all_shops` platform op), and the walker now fails on any sixth operation added without one. **Do not sweep in bulk** — adding the guard to a genuine public read takes the storefront down. Each needs the same triage the nine got: is this operation vendor-owned, customer-owned (resolve from `user` in the service, as `withdrawals`/`balance`/`orders` already do), or public? Then add `describeGuardChain` from `src/common/testing/guard-chain.ts` with an explicit `publicOps` list, which is what stops the next operation from being added unguarded.

**P3 — low**

- [~] **Three ops omit `RequireShopGuard`** — **half fixed 2026-07-21.** The guard is now on all eight ops, so a *vendor* with no `X-SHOP` gets `MISSING_SHOP_HEADER` instead of an opaque `INTERNAL_SERVER_ERROR`. **The super_admin case remains open and is unchanged:** both `RequireShopGuard` and `ShopOwnershipGuard` bypass for `super_admin`, so a super_admin calling any of these without `X-SHOP` still reaches the service with `shopContext = null` and null-dereferences on `shop.id`. Fails closed (throws before any Prisma call), so no tenancy leak — this is error quality for an internal role, not a security hole. The durable fix is still `ShopContextData | null` params with explicit handling across the resolver + service signatures, which is why it was not bundled into the guard change.
- [ ] **Negative `limit` bypasses the 60-row cap.** `image-gen.service.ts:295` is `Math.min(take ?? 30, 60)` — upper bound only, on a bare `@Args` scalar the global pipe skips. `limit: -100000` returns the shop's whole history from the oldest end. `clampLimit` (`pagination.helper.ts:8`) does it correctly and is used by three siblings.
- [ ] **`cancel()` treats only SUCCEEDED/FAILED as terminal** (`:306`), so a vendor can re-stamp a `MODERATED_OUT` safety verdict to CANCELED. No real consequence (both are cap-excluded, `error` text survives) but `applyPrediction:387` lists all four states. Fix by inverting to a guarded `updateMany` on QUEUED/RUNNING, closing a read-then-write race in the same edit.
- [ ] **"Replace original" round-trips a multi-MB image through the browser** (`files-image-editor.tsx:78-86`) to accomplish a server-side copy between two attachment ids the backend already holds. It also passes the *original's* filename, so `replace()` computes `ext` from `.jpg` even when flux-2-pro returned WebP/PNG → a `.jpg` path serving `Content-Type: image/png`.
- [ ] **Review-oriented regexes hard-block legitimate prompts** containing a URL, email, or 10+ digit run (`content-moderation.service.ts:137-155`). The verdict's own `action` is `flag_for_review`, but `image-gen.service.ts:184` reads only `is_safe` and rejects outright.
- [~] **Missing test files** — **`image-gen.resolver.spec.ts` added 2026-07-21** (guard-chain prototype walk, 26 tests); **`image-gen.processor.spec.ts` added 2026-08-04** (8 tests over the reconcile sweep — the only code in the module that writes a terminal status without a provider saying so, so the assertions are about what it *refuses* to fail: a row the provider reports finished is settled, not burned; the fail-out is guarded on RUNNING so a webhook landing mid-sweep cannot be stamped over; one bad row does not abort the batch). Still missing: `image-gen.controller.spec.ts`. `applyPrediction`'s tests still have no partial-ingest case and no assertion on `budget.trackCall`.

**Doc corrections (the reason the doc-only score was meaningless)**

- [ ] **`back-end/docs/features/ai-image.md` is 422 lines against a ~110-line house limit.** It was already ~4x over before the 2026-08-04 work and that work added to it. Almost all of the excess is the `## Notes` section, which has become the module's decision log — genuinely useful, and in the wrong file. Split the rationale out (an `ai-image-decisions.md`, or fold each note into the `api/` reference where the contract it explains lives) and cut the overview back to the template shape. Do not simply delete the notes; several are the only written record of why a path is shaped the way it is.

- [ ] `docs/features/ai-image.md:150-152` claims the ledger "trues-up" cost on success; it adds on top of the reservation.
- [ ] `docs/features/api/ai-image.md:234` documents `limit` as "≤ 60" with no lower bound in code.
- [ ] Stale comments to correct in the same pass: `image-gen.service.ts:493` ("true-up"), `ai-budget.service.ts:25-28` (names a call site that does not exist), `image-gen.controller.ts:22` ("the poll fallback covers a genuinely dropped webhook" — it does not in webhook mode), `schema.prisma:2906-2908` (claims the unique index gives "the same guarantee the Stripe `ProcessedWebhookEvent` table gives"; Stripe claims a lock row *before* side effects, this path does not).

**Reviewer suggestions worth building (only after the above)**

- [ ] `thumbnail` on `EnhanceStyleEntry` — the one field the "presets API" suggestion names that genuinely doesn't exist, and a real gap for style cards that are text-only. Do not add `category`; categorising four styles is premature.
- [ ] Prefill the prompt textarea client-side from form state (`ai-image-panel.tsx:68` starts with `useState("")`) as an *editable suggestion* — one file, no schema, and fresher than a DB read because unsaved edits aren't persisted. The vendor stays the author, so moderation stays meaningful. This is the real gap the "Analyze Product" suggestion gestures at.
- [ ] Persist the terminal disposition the vendor already gives you — `files-image-editor.tsx:77/:115` already has Replace / Keep both / Discard. Replace = positive, Discard = negative, zero added UI, joined against the `params.enhance` tuple already on every row. Worth doing now only because outcome telemetry can't be backfilled; build no "learning" machinery until there's a consumer.
- [ ] Advisory (never blocking) drift score — one vision call, nullable score on `AiImageResult`, surfaced in the compare UI as "check the logo carefully". No new status. (Narrower framing of the "Output-image moderation" item below.)
- [~] **Model view (`on_model`) — code shipped 2026-07-21, still gated; THE EVAL IS THE REMAINING WORK.** The shot exists (`enhance-shots.ts`, `SAUDI_MODEL_BLOCK` + `MODEL_PRODUCT_RELATION_BLOCK` in `enhance-blocks.ts`, 3:4 forced, `preservesFrame: false`, `requiresHuman: true`) behind `AI_IMAGE_ON_MODEL_ENABLED`, which must read exactly `"true"`. Decisions taken: the model is **generated, never uploaded** (no human reference image on this pipeline, so no real likeness crosses the provider); gender and crop are **inferred from the product**, not selected, on the same reasoning as the lifestyle scene; the model is Saudi/Gulf by default, pinned modest and fully covered.
  - **Do not turn the flag on before running the eval.** 15–20 representative catalog images, count how many keep the label legible and the geometry intact; below ~70%, delete the shot rather than ship it. Nothing about writing the code answered this — it is a measurement, and it has not been made.
  - Risk (2) from the original entry is **unresolved by design**: a sofa or a 500g tub still has no natural model shot, and risk (3) still stands — no safe category gate exists, so the tile is offered for every product or none. The prompt asks the model to infer the crop, which is a mitigation, not a gate.
  - Risk (1) is now covered by tests rather than by hope: product identity stays unconditional in every composition (`enhance-blocks.spec.ts`), and `enhance-shots.spec.ts` pins that the shot re-shoots without licence to redesign.
  - **Output-image moderation is now a live gap, not a latent one.** The prompt's coverage clause shapes the request; nothing inspects the returned bytes. A vendor pointing this at a swimwear listing is mitigated, not stopped. See the output-moderation item below — it is the real precondition for taking the flag off.

**Rejected after verification — do not build.** Vendor-editable or DB-stored presets: `enhance()` skips moderation via `trustedPrompt: true` *solely because* the prompt is a compile-time constant, moderation fails open anyway, and the worst-case composed prompt already measures 1940 of 2000 chars — an over-long preset would silently lose the closing identity clause. A server-side product analyzer feeding product fields into the prompt: same invariant, plus `productId` is never ownership-validated (`image-gen.service.ts:244`), which would turn a harmless mislabel into a disclosure oracle via the echoed `prompt` field. **Amended 2026-07-22:** the second objection is specific to reading *product DB fields* through an unvalidated `productId` and does not reach an analyzer that reads **the uploaded image itself** — the vendor already owns those bytes and there is no id to confuse. The first objection stands for any analyzer, which is why the planned vision stage emits closed-vocabulary enums the server maps onto compile-time fragments, never prose. See the LLM art director item below. Making `productId` required per mode: the media library has no product context and the id is `undefined` during product creation because of the save bar. A `regenerate(variation)` mutation: regenerate already ships on both surfaces (no `seed` is ever sent, so every re-run is a fresh draw) and the fixed composition order has no legal slot for a variation clause. `rateAiImageResult`: `selected` is currently write-only — no `where: { selected }` exists anywhere — so add the read path before adding a second signal.

### Sidekick — LangGraph migration (2026-07-21)

Shipped: the runtime moved from a hand-rolled tool-calling loop to a LangGraph `StateGraph` checkpointed to Postgres. `agent/tool-calling-agent.ts` and `agent/streaming-agent.ts` are deleted; `graph/` replaces them. See `back-end/docs/features/vendor-agent.md`.

Open follow-ups:

- [ ] **No mid-tool progress channel.** Tools run serially inside the `tools` node and the model can only emit text *between* LLM turns, so slow work (image generation, CSV import, bulk updates) shows a spinner with no progress. Fix belongs in the card (poll like `generate_product_image` does), not the prompt — needs a per-tool progress contract.
- [ ] **Compaction runs on the full agent model.** `makeSummarizer` reuses `OPENROUTER_MODEL`; compaction is a cheap, well-specified task that a smaller model would serve fine. It is isolated behind the factory so switching is a one-line wiring change — do it if the cost shows up.
- [ ] **Approval gating is a flat list, not blast-radius-aware.** `GATED_TOOLS` gates all five tools unconditionally, including single-SKU `set_inventory`. Deliberate (conditional gates train reflexive approval), but worth revisiting with usage data — the risk is approval fatigue on the prompts that matter.
- [ ] **Abandoning an approval costs an LLM turn.** A new message on a parked conversation resumes-and-declines to settle it, which runs one model turn to produce the acknowledgement. Correct but not free; a cheaper settle path would skip the model.

### AI image generation — open follow-ups

Feature shipped 2026-07-17 (Replicate provider seam, FLUX.2 Pro, one-click Enhance, Enhance Studio styles + shots, editor-hosted compare). Docs: `back-end/docs/features/ai-image.md` + `api/ai-image.md`.

> **Ranked improvement roadmap: `docs/future-features/ai-studio-improvement-plan.md` (2026-07-26).** 32 proposals in four waves with impact/effort/risk scores, an execution order with explicit dependencies, seven decisions awaiting the vendor's call, and a table of what was ruled out and why. Every `file:line` in it was verified against the tree, not copied from docs. The items below remain the authoritative backlog; the plan sequences them and adds what they miss.

#### Wave 1 of the AI Studio plan — shipped 2026-07-27

All eight items from `docs/future-features/ai-studio-improvement-plan.md` wave 1. 2796 backend tests + 140 vendor `features/files` tests green; `apps/vendor` typecheck clean.

- [ ] **`AuthService › login (edge cases)` flakes on the full backend suite — diagnosed, not fixed.** Two tests (`user has no password (social-auth user)`, `user account is inactive`) intermittently fail with `Exceeded timeout of 5000 ms`; both pass alone, and the auth suite is 67/67 on its own. Observed roughly one run in two on 2026-07-29. **Cause:** those are the only two tests that reach the login **timing-equalization** branch (`auth.service.ts:175-193`), which defends against user enumeration by doing real bcrypt work when the identifier does not resolve — `bcrypt.hash('__dummy_password__', 12)` on first use plus a cost-12 `compare`. Cost 12 is ~100–250ms idle, but the rest of the suite is elsewhere overridden to **4 rounds** precisely because 12 is slow, and this path cannot be: the whole point is that it costs what a real login costs. Under 192 suites saturating the cores it crosses Jest's 5s default. **Not touched here** — it is security-sensitive code and unrelated to the AI Studio work that surfaced it. The fix is a longer timeout on that describe block, or making the dummy-hash cost injectable so tests can run it at 4 like everything else; do **not** lower the production cost.
- [ ] **`apps/vendor` typecheck sits at the V8 heap limit — and it is not only typecheck.** `npm run typecheck` OOMs (`FATAL ERROR: MarkCompactCollector: young object promotion failed`, exit 134) about half the time on an unchanged tree. **8192 is not enough either** — it was believed to be, and on 2026-07-28 it OOMed on the same tree that `--max-old-space-size=12288` typechecks clean in one pass. Two things made that hard to see: the failure is intermittent, and piping tsc into `head` reports `head`'s exit code, so a run that died still printed `EXIT: 0`. Use `> file 2>&1; echo $?` when the exit code matters. **Vitest inherits the same pressure:** on 2026-07-28 a run chained straight after `tsc` in one shell reported `314 passed / 1 error` — one whole test file's worth of tests missing, with no failing assertion, i.e. a worker that died rather than a regression. Three consecutive runs of the same tree afterwards were 342/342. That failure mode is the dangerous kind: it reads as a *smaller green suite* rather than as red. Raise the heap in the `typecheck` script and stop chaining the two in one shell; until then, a run reporting fewer tests than the last one must be re-run before it is believed.

#### Wave 3 of the AI Studio plan — #16 + #17 shipped 2026-07-30; #19 + #20 + #22 + #23 + #25 shipped 2026-08-04

**Wave 3 is now one item from done: only #24 (output-image moderation) remains.** #18 (SSE) was rejected by the user's own call — the 60-tick cap bounds the damage and #16 already fixed the real problem — and #21 is deferred *into* the entitlements work rather than built narrowly here (see the attribution item above).

**2891 backend tests / 193 suites green** (2026-08-04, full run, no auth flake); `schema:check` current — the SDL did not move, which is the point: none of this changed a contract. Migration `2026-08-04-ai-image-result-soft-delete.sql` written, **not yet applied to any database**.

#### Wave 2 of the AI Studio plan — COMPLETE. #9 + #22 shipped 2026-07-27, #13 + #11 + #14 shipped 2026-07-28, #12 + #15 shipped 2026-07-29. Only #10 (Arabic text on the image) remains, deferred by the user.

2848 backend tests + 366 vendor tests green; `apps/vendor` typecheck clean; `schema:check` current. (The backend suite has a pre-existing auth flake under full-suite load — diagnosed above, not caused by this work.)

> **Correctness and security findings for this feature live in "AI image — code-level audit findings (2026-07-20)" under Now / In progress.** That section supersedes the reaper half of the version-pinning item, the quota-counter item, and the output-moderation item below; it also blocks the `REPLICATE_WEBHOOK_URL` item, which arms a stranding bug the moment it is set.

- [~] **LLM art director for the social post — Stage 1 of 4 shipped 2026-07-22.** The vendor asked for the design to be chosen by an LLM that analyses the image, "مع الأخذ بالاعتبار الخيارات اللي بختارها اليوزر". Root cause of the sameness they reported: `SOCIAL_DESIGN_BLOCK` hardcodes exactly one archetype ("two or three large flat blocks of colour and one strong geometric shape or sweeping arc"), so every post is a semicircle over two colour fields regardless of product — the template failure the block's own docblock warns about. Plan in scratchpad `ai-art-director-plan-ar.md`. Remaining stages:
  - **Stage 4 — metering + docs.** Add `'vision'` to the `AiFeature` union (`ai-rate-limiter.service.ts:8-14`) and to `FEATURE_COST_CENTS` (`ai-budget.service.ts:19-30`) — **price the vision call before fixing the constant**. Note `reserveCost` books before the call with no automatic refund on provider failure, so settle via `trueUpCost`. Same change closes the standing gap that `alt-text.service.ts` has **no rate limit, no budget and no moderation** (`attachments.resolver.ts:81-93` guards with `JwtAuthGuard` only), so any logged-in user can burn OpenRouter credit by repetition.
  - **Why "the LLM chooses, it does not write" is load-bearing, not caution.** The enhance path has *no moderation call site at all*: `trustedPrompt` appears exactly twice in the backend (`image-gen.service.ts:375` declaration, `:407` check) and **no caller ever passes it** — `runShots` never calls `generate()`, so `moderateText` is unreachable from `enhanceImageShots`. The guarantee rests entirely on the DTO's `@IsIn` allow-lists, with no runtime assertion at the skip point. The LLM's input is a vendor-uploaded image, i.e. an indirect prompt-injection vector; constraining output to enums caps the blast radius at "wrong design archetype" instead of "arbitrary prompt to a moderation-free provider call". Char budget is the second reason: worst case is already 2493/2800 and `sanitizeForPrompt` truncates **silently** from the tail, which is the closing identity guarantee — free-form LLM text would eat "do not redesign the product" with nothing failing.
- [ ] **Arabic text on a social post needs a composited overlay, not the diffusion model.** The withdrawn headline was Latin-only because FLUX.2 Pro emits disconnected pseudo-glyphs for cursive RTL script — a hard model limit, so no prompt fixes it. For an Arabic-first vendor base this is the real gap. The fix is compositing text server-side after generation with `sharp` (already a dep) over the clean colour panel the shot already leaves in the upper third: pick font + size + colour, render RTL-shaped text, overlay. That also makes the text editable after the fact, needs no moderation round-trip on the image path, and imposes no length cap. Pairs naturally with the deterministic-canvas item below — same `sharp` post-processing stage.
- [ ] **Decide the style catalogue: formats, not categories.** A review proposed growing 4 styles to ~12 by adding `Flat Lay`, `Cosmetic`, `Food`, `Tech`, `Fashion`, `Furniture`, `Outdoor`, `Minimal`, `Social Ad`. Recommendation: add the ones that are genuinely distinct *photographic formats* — **Minimal** (negative-space composition), **Social Ad** (bolder crop for a feed), possibly **Outdoor** (natural-light environment) — and skip the category-named ones (`Cosmetic`/`Food`/`Tech`/`Fashion`/`Furniture`). The model already sees the product, and `lifestyle` now asks it to infer the setting; a category style would override what the model can see with what the vendor picked from a dropdown, which is strictly worse for a vendor whose product straddles two categories. **`Flat Lay` needs a decision first:** a top-down shot requires *changing* the camera angle, which `IDENTITY_BLOCK` forbids verbatim — it would need a documented per-style exemption from the identity guarantee, not just a new scene string. Each accepted style is a one-object change plus two lookup.json keys (en + ar); the vendor dialog picks them up with no frontend change.
- [~] **Enhance Studio follow-ups (halai-parity) — "Extra shots" Phase 1 shipped, rest open.** Verified in the tree 2026-07-21 (113 backend ai/image tests green, vendor typecheck clean): shot registry (`enhance-shots.ts`) with the identity invariant split into product vs frame (`enhance-blocks.ts`), the `enhanceImageShots` mutation with `requestId` idempotency and a whole-batch cap/budget pre-flight, and the panel's **Outputs** checkbox grid fed by `enhanceStyles.shots` + `monthly_usage`. Two shots ship: `enhance` and `social` (4:5). Plan: `docs/future-features/extra-shots.md` — mark its **Status** line, which still reads "Not yet implemented (plan only)".
  - **Correction (2026-07-21):** that "verified" line did not hold — the run was broken at the GraphQL boundary. `AiImageGeneration.shot` existed in Postgres and Prisma and was written by `runShots`, but was never added to the `AiImageGenerationEntry` ObjectType and was dropped by `mapGeneration`, so `EnhanceImageShots` failed validation with `Cannot query field "shot"`. Neither check caught it: the service spec asserted only what was *written* to `prisma.create`, and the vendor typecheck passed because codegen had been run against the same stale schema. Fixed: field + mapper line, `schema.gql` regenerated, vendor codegen re-run, and the spec now asserts the mapper's returned rows (verified failing without the fix). Lesson: a field added to Prisma needs the ObjectType, the mapper, and a *read-side* assertion — the write-side test is not coverage.
  - **Still open:** `model` view (Phase 2, gated on the eval below — do not write the prompt first), a Standard/Pro-HD quality tier (maps to EDIT model choice — pair with the identity-preserving-model evaluation below), batch enhance from multi-select (backend takes one attachment per call today), and a draggable light-direction control instead of the 6-button grid.
  - **Review surface reworked into a free canvas (2026-07-21).** The results strip (wipe slider on top, thumbnail row below) is gone; `enhance-canvas.tsx` renders the source image as a node with each shot branching off it on a curved arrow, with pan / zoom-at-cursor / node drag / arrow-key nudge / fit. Nodes appear as pending placeholders on dashed arrows the moment the run starts, so the graph builds as the run progresses. Geometry is pure and unit-tested in `lib/enhance-graph.ts` (28 tests); the compare wipe survives as an overlay opened from the enhanced original's node. The graph axis is treated as **content** — never mirrored, viewport pinned `dir="ltr"` — per the rule in `docs/features/files.md`.
  - **Open on the canvas:** no node-position persistence across runs, no minimap, and no way to re-run from the canvas (the vendor still uses the rail CTA after Done).
- [~] **Localize the files feature (en/ar) — AI Studio half DONE 2026-07-21, browse half open.** New `aiStudio` namespace (71 keys, en/ar at parity) now covers the five files that make up the AI Studio flow: `enhance-studio-controls.tsx`, `enhance-compare.tsx`, `enhance-canvas.tsx`, `files-image-editor.tsx`, `lib/use-enhance-file.ts`. The backend's Arabic style/shot/occasion catalogue no longer renders inside English chrome. Counts use ICU plurals, so Arabic gets its dual and few forms (`صورتان`, `3 صور`) that the old `count === 1 ? "" : "s"` could not express. Vendor typecheck clean, 196 tests green.
  - **Still English (the browse surface, 12 components):** `files-page.tsx`, `files-list-view.tsx`, `files-toolbar.tsx`, `files-header.tsx`, `file-detail-sheet.tsx`, `file-row-actions.tsx`, `file-tile.tsx`, `files-bulk-bar.tsx`, `files-empty.tsx`, `files-grid.tsx`, `upload-from-url-dialog.tsx`, `file-preview.tsx`. Needs its own `files` namespace; no blockers, just unwritten.
  - **Out of scope and separately English:** the shared `products/components/form/ui/image-editor.tsx` chrome that hosts AI Studio — the workspace switch itself is labelled `"Edit"` / `"AI Studio"`, plus ~20 tool titles and aria-labels. It belongs to the products feature and is used by the product form too, so localizing it is its own change.
- [ ] **Backend AI-image error messages are hardcoded English template literals, not i18n.** `image-gen.service.ts:936` builds the monthly-cap sentence as `` `This shop has used ${used}/${cap} AI images this month.` `` — no `lookup.json` key, so an Arabic vendor gets an English rejection. The frontend now maps the *codes* to local copy (`shared/lib/ai-image-errors.ts` → `aiImage.errors`) and deliberately stops echoing `messages[0]`, which costs the `used/cap` numbers in the toast; the Enhance Studio rail still shows the real remaining count from `enhanceStyles.monthly_usage`. Fixing it server-side means i18n keys with `{used}`/`{cap}` params, after which the frontend can go back to preferring the server wording.

- [ ] **Deterministic square canvas for product images (the right home for composition).** Composition asks — centre the product, ~70% of the width, equal margins, 1:1, 2000×2000 — must NOT go in the diffusion prompt: a model cannot re-frame without re-rendering the subject, which is exactly the drift above. Do it deterministically after generation with `sharp` (already a dep, used by `thumbnail.service.ts`): background-remove → trim to the alpha bounding box → pad onto a square canvas at a target occupancy. That also gives a uniform product grid across the whole catalogue, which the prompt can never guarantee. Note the prompt currently leaves `aspectRatio` unset on purpose so flux-2-pro stays on `match_input_image` (forcing a ratio drops output to 1 MP).
- [ ] **Evaluate an identity-preserving edit model.** flux-2-pro is a generalist and still drifts on fine product detail (grain, stitching, curves) even with a background-only prompt. `google/nano-banana` (Gemini 2.5 Flash Image) and `qwen/qwen-image-edit` on Replicate are built for edit-with-identity-preservation. Adding one is a `model-registry.ts` entry (`model`, `modes`, `costCentsPerImage`, `maxCount`, `label`, `buildInput`) plus a `model-registry.spec` case; changing the `EDIT` default also moves the per-image cost the budget/ledger charges, so price it first.
- [ ] **Real-time SSE progress.** Progress is polling-only (`aiImageGeneration`). Optionally emit a `notify-logs` row per state change to reuse the SSE bell (needs new `notifications.json` i18n keys + entity linking).
- [ ] **Community-model version pinning + stuck-RUNNING sweep.** `background-remover`/`real-esrgan` use the `model` param (no pinned version); add `AI_IMAGE_MODEL_VERSION_*` overrides. Add the retention sweep that flips long-stuck `RUNNING` generations to `FAILED` (the processor's poll path times out, but a lost-webhook job with no poll has no reaper yet) and the unselected-`ai-generated` attachment cleanup.
- [ ] **REPLICATE_WEBHOOK_URL in prod.** Local dev leaves it empty (poll fallback). Set it to the public API base in prod so completion arrives via webhook, not polling.
- [ ] **Vercel + the AI-panel prod-build blocker.** `apps/vendor` production build is red on a pre-existing break in `src/features/ai/components/ai-chat-panel.tsx` (imports `MESH_HALO_COLORS`/`MESH_HALO_MASK` that `composer-halo.ts` never exported, renders an unimported `<MeshGradient>`). Half-finished mesh-gradient halo, broken since `af48df5`. Must be finished or reverted before `apps/vendor` can build for prod (and before the Vercel root-dir switch matters).

## Storefront

### Every shop URL 404'd, then the seeded shop 500'd — fixed 2026-08-23

Reported as "probably a database migration problem". Neither half was.

**The 404.** `/demo-electronics`, `/ahmed-electronics` and every other slug
returned the app-level `not-found.tsx` while `/` returned 200. The route files
were fine and the API answered both `StorefrontShopShell` and `SHOP_BY_SLUG`
correctly on curl. The dev server's own route manifest was the tell:
`.next/dev/server/app-paths-manifest.json` held exactly two entries, `/page` and
`/_not-found/page` — the whole `[shopSlug]` subtree was missing from it, so Next
matched no route and fell through. A corrupt Turbopack `.next/dev` state, fixed
by deleting `.next` and restarting. Worth recognising by shape: a 404 whose body
is `app/not-found.tsx` rather than `ShopShell`'s closed-shop screen means *no
route matched*, which is a build-state question, never a data one.

**The 500 underneath it.** With routing restored, `demo-electronics` threw
`shop?.address?.trim is not a function` from `shopPlace` in `shop-footer.tsx`,
while `ahmed-electronics` rendered. `Shop.address` is a **`JSON` scalar**, not a
string — the seeded shop carries `{ city, state, country }` and the other carries
null, and optional chaining hid the bug for every shop whose address was null.
Codegen types a `JSON` scalar loosely, so `typecheck` never objected. Now
normalised through `addressText()`, which narrows `unknown` and handles the blob,
the plain string and neither, following the same city/country precedence as the
caller. Three render tests pin the shapes (20 pass in that file).

- [ ] **The seeded `Shop.address` blob and `settings.location` hold the same
  place in two schemas.** `shopPlace` now reads both and prefers `location`, but
  nothing keeps them in sync and no other screen reads `address` at all. Decide
  which one is the real field.
- [ ] **No other `JSON` scalar in this app is narrowed on read.** `address` was
  found by a crash; `settings`, `socials` and the address blobs under
  `features/addresses` are the same kind of loosely-typed field.

## Admin console

### `users.column.*` was missing from both locales — fixed 2026-08-23

`/users` logged `MISSING_MESSAGE: Could not resolve users.column.email` and
rendered raw key paths for its table headers. The whole `users.column` block was
absent from `en.json` *and* `ar.json` while `UsersTable` asked for six keys under
it (`name`, `email`, `phone`, `role`, `status`, `created`). Added to both, styled
after `shops.column`, with the Arabic reusing the wording already in
`users.form`. A sweep of every single-namespace file in the app against both
message bundles reports no other missing key.

- [ ] **Nothing fails a build on a missing message.** next-intl logs and renders
  the key path, so this shipped and was only found by reading the console. The
  sweep used here is ~30 lines and could be a test.

## Platform & infrastructure

### `manage_integrations` back-filled on the local database — 2026-08-23

`check:drift` reported `role_permissions[admin]` and `[super_admin]` missing
`manage_integrations`, plus three users whose `permissions` array was short of
what their role grants. `npm run sync:permissions` added the two role rows and
back-filled one vendor, one admin and one super_admin. Drift is clean now
(schema, permissions and entitlements all OK). Permissions are baked into the
JWT at login, so the three accounts pick the claim up on their next sign-in.

- [ ] **The three back-filled accounts have not re-logged in yet**, so they still
  carry the old claims and will get `INSUFFICIENT_PERMISSIONS` on the
  integrations screen until they do.

### `.env.development` blanked keys the app cannot boot without — fixed 2026-08-23

Found while moving the API into a container, but it was never a container
problem: `npm run start:dev` failed the same way on the host. `.env.development`
set eighteen keys to `""` that `.env` fills with working local values — and
ConfigModule merges most-specific-first, where **an empty string still counts as
defined**. So the blanks won, and `.env` was unreachable for all eighteen.

For most of them that is the intended "feature off in dev" (Mailtrap, BunnyCDN,
the `SEED_*` passwords, which fall back to documented dev defaults). For nine it
is fatal, because the client is constructed while Nest builds the injector and
throws on a blank key: `AiModule`'s HttpModule factory, `StripeService`, and
LangChain's `ChatGroq` inside `StoreAiAdvisorTool`. The app never opened a port,
and the error named an environment variable that was sitting in `.env` the whole
time. Those nine are commented out now rather than set to `""`, with the
mechanism written at the top of the file.

- [ ] **`.env.example` still documents the blanks as the way to disable a
  provider.** For the nine keys above that advice produces an app that will not
  start; the file should say which ones need a placeholder or a comment instead.
- [ ] **Nothing catches this class of bug.** A boot-time check that lists keys
  defined-but-empty in a more specific env file while a less specific one has a
  value would have named all eighteen in one line, instead of one crash per
  restart.

### The API runs as a container — 2026-08-23

Postgres and Redis had been on Docker for a while — two `docker run` containers,
`zaydak-postgres` and `zaydak-redis`, with no compose file between them — while
the API itself only ever ran natively through `npm run start:dev`. All three are
one stack now: `back-end/Dockerfile` (four stages; the `runtime` one carries
compiled JavaScript and no devDependencies) and a root `docker-compose.yml` that
owns them with `restart: unless-stopped`, so the stack comes back with Docker
Desktop after a reboot. The two data volumes are declared `external` against the
pre-existing `zaydak-pgdata` / `zaydak-redisdata`, so nothing written before the
move was lost and `docker compose down -v` cannot take the local database with it.

Three traps the container has to clear that the host never hits.
`.env.development` is bind-mounted rather than copied — Nest's own ConfigModule
parses it, so no credential is baked into a layer (`.dockerignore` excludes
`.env*`) — and compose overrides only `DATABASE_URL` and the `REDIS_*` variables,
because `localhost` inside a container is the container. `NODE_ENV` must stay
`development`, or ConfigModule looks for `.env.production`, ignores the mount and
boots with an empty config. And `/app/src` has to exist: `autoSchemaFile` is
`process.cwd()/src/schema.gql`, written on every boot, so without the directory
the write throws ENOENT before a port ever opens. Documented in
[docs/local-docker-stack.md](docs/local-docker-stack.md).

- [ ] **No watch mode.** The image ships compiled JavaScript, so every source
  change needs `docker compose up -d --build api`. A `dev` target with the source
  bind-mounted was deliberately skipped — Nest's watcher over a Windows bind mount
  needs polling and is slower than the native run it would replace. `npm run
  start:dev` stays the tool for active editing.
- [ ] **`scripts/dev-local.ps1` still starts the API natively**, so there are two
  bring-ups that do not know about each other. A switch that uses the container
  instead would make it one.
- [ ] **Nothing builds this image in CI.** The Dockerfile can drift against
  `package.json` (a new asset in `nest-cli.json`, a moved entrypoint) and nobody
  finds out until the next `docker compose build`.
- [ ] **Local-dev only.** Render still builds from source with `rootDir: back-end`
  and its own build command; if the Dockerfile ever becomes the deploy artifact,
  `render.yaml` and `back-end/docs/10_deployment/` have to change with it.
- [ ] **WhatsApp is unconfigured in this local database, by both paths.**
  `integration_configs` is empty (nothing was ever saved through the console),
  and the env fallback is inert: `envFallback` in `provider-registry.ts` returns
  null unless `EVOLUTION_API_URL` *and* `EVOLUTION_API_KEY` are both set, and the
  key is set in neither env file. Compose supplies the URL
  (`http://host.docker.internal:8081`, verified answering HTTP 200 from inside the
  container); the key still has to come from the running `evolution_api`
  container's `AUTHENTICATION_API_KEY`.
- [ ] **A Server URL saved through the console will be host-relative and will
  fail from the container.** `http://localhost:8081` resolves to the API container
  itself — confirmed, it answers connection refused — so it has to be written as
  `http://host.docker.internal:8081`. Nothing in the console warns about this, and
  the failure reads as a bad credential rather than a bad address.
- [ ] **`DeploymentSafetyService` reports the local Docker stack as a production
  misconfiguration.** `LOCAL_DB_HOSTS` is `localhost / 127.0.0.1 / ::1 / 0.0.0.0`,
  so a compose service name (`postgres`) is read as "remote" and every boot logs
  `DEV_MODE_AGAINST_REMOTE_DB` at CRITICAL plus four dependent warnings. Nothing
  is actually wrong, which is the problem — a CRITICAL that is always there is one
  nobody reads. It also means `DEPLOYMENT_SAFETY_ENFORCE=1` cannot be turned on
  against this stack: the findings become fatal and the API refuses to boot. Wants
  an explicit signal ("this DB is on a private container network") rather than
  widening the hostname set, which would weaken the production check.
- [ ] **`StripeService` throws from its constructor on a blank `STRIPE_API_KEY`.**
  Its sibling `BillingService` reads the same key and stores `null` instead, with
  a comment saying exactly why — "the whole app failing to boot" is the outcome it
  is avoiding. `StripeService` should follow it; today a deployment with no Stripe
  key cannot start at all.

### Sign-in returning "Too Many Requests" — fixed 2026-08-17

`GqlThrottlerGuard` wrapped its `super.canActivate()` in a blanket `catch` that reported *every* throw as a 429 — so an unreachable Redis, or a GraphQL context with no `res` for the `X-RateLimit-*` headers, locked every account out of signing in under a message blaming the caller. Only a real limit breach is a 429 now; anything else is logged at `error` and fails open, matching `TokenRevocationService`. The per-IP limits were also sized for one person when an IP is a whole CGNAT or office (login was 5/min, 15/15 min, and a *successful* login spent from the same counter) and are now 20/min and 100/15 min, with the per-account `locked_until` and the per-identifier OTP caps left as the real brute-force defense. Rejections carry `retry_after_seconds=<n>` in `extensions.detail` and the vendor toast says the actual wait. `npm run unthrottle` (`back-end/scripts/clear-throttle.ts`) clears the counters — all of them, or `--ip <addr>` for one caller.

- [ ] **Which of the two causes was hitting production is unconfirmed.** The fix covers both, but nothing has been read back from the deployed Redis to say whether callers were genuinely over the limit or the guard was mistranslating an outage. `npm run unthrottle -- --list` against production answers it, and a `Throttler storage unavailable` line in the logs would settle it for good.
- [ ] **The admin console has no rate-limit toast at all** — `apps/admin/src/shared/apollo/links.ts` only `console.error`s, so a throttled admin sees a dead button. The vendor's `describeRetryAfter` is the piece to reuse.
- [ ] **`RATE_LIMIT_EXCEEDED` is a dead error code** — nothing in `src/` throws it, though it sits in both i18n bundles and the frontends' `RATE_LIMIT_CODES`. Delete it, or start using it for the AI rate limiter that has its own quota story.

### Render deploy failed on the AI-video table drop — fixed 2026-08-17

`ac4d1ed` removed the video module, so `schema.prisma` no longer had `AiVideoGeneration` while the database still had `ai_video_generations` with 8 rows. `prisma db push` refuses to drop a non-empty table and the build carries no `--accept-data-loss`, so the deploy died on `db:deploy`. **That is the designed behaviour, not a bug** — `prisma.config.ts` and T2-10 both say destructive changes are meant to fail the build for attention.

Fixed by applying the already-committed `prisma/migrations/manual/2026-08-17-drop-ai-video-generations.sql` by hand; its header now records that it ran, against which database, and what it destroyed. Verified before dropping: no inbound FKs, both enums used only by that table, and all 4 produced clips still live in `attachments` with none staged onto a product. After: table and enums gone, 4 video attachments intact, the 4 LangGraph `checkpoint*` tables untouched (they are `tables.external`), 155 tables in `public`, `db push` reports in sync and `sync:permissions` runs clean — the whole Render build chain passes.

- [ ] **Local `.env` points at the same Neon database Render deploys against** (`ep-broad-heart-ay62yk2t`/`neondb`). So local development reads and writes production data, and this drop was applied to both at once because they are one database. Worth a separate dev branch (Neon branching is cheap) before something less reversible than 8 orphaned rows.
- [ ] **`ENABLE_DEBUG_OTP=true` and `ENABLE_DEBUG_MAGIC_LINK=true` are set against that shared database.** On a database serving production that is a real auth exposure, not a convenience.
- [ ] **Rotate the credentials pasted into the assistant transcript on 2026-08-17**: the Neon password, `JWT_SECRET`, `APP_SECRET`, `SECRETS_ENCRYPTION_KEY` (it decrypts every row in `integration_configs`, so rotating it means re-entering those secrets), `AI_SERVICE_KEY`, Stripe secret + webhook secret, BunnyCDN, Groq, OpenRouter, Upstash Redis, Mailtrap.
- [ ] **The next destructive schema change will fail the deploy the same way.** T2-10 (adopt `prisma migrate`) is the actual fix; until then, the runbook step is "apply the manual SQL first, then deploy".

### Deployment — database schema never applied (2026-08-09)

The Render deploy has never created the database. `render.yaml`'s build ran `prisma generate` (client types only) and nothing that touches `DATABASE_URL`, so the Neon instance was empty, `SchemaDriftService` aborted bootstrap on 150 missing tables, and Render reported "No open ports detected". Confirmed against the live Neon instance: 4 tables, all of them LangGraph's (`checkpoints`, `checkpoint_blobs`, `checkpoint_writes`, `checkpoint_migrations`) — no Prisma table, no business data.

- [ ] **Run the one-time production seed.** `db push` creates tables, not rows. Until `npm run seed`, `seed:taxonomy` and `seed:plans` run against the prod `DATABASE_URL`, `role_permissions` is empty and every plan entitlement is missing — and a missing entitlement denies, so every metered capability is silently off for every shop. Verify with `npm run check:drift`.
- [ ] **Adopt a real `prisma migrate` history.** The root fragility: there is no migration history at all, only `db push` plus 60+ hand-written patches in `prisma/migrations/manual/` with no record of which were applied where. Baseline it (`npm run db:baseline` → `migrations/0000_baseline/migration.sql`, then `prisma migrate resolve --applied` on each existing database) and switch the build to `prisma migrate deploy`. Until then, destructive changes are a manual step that fails the build to get attention.
- [ ] Add `npm run check:drift` to CI against a scratch database, so a schema/permission/entitlement gap fails the PR rather than the deploy. Add `npm run check:di` alongside it — it needs no database at all and catches the module-wiring failures that otherwise surface as "No open ports detected".
- [~] **Rotate the Neon password committed in `back-end/.env.example`.** Lines 3 and 12 carried a real `neondb_owner` connection string for `ep-super-butterfly-aqksxtdy`; the file's own comment said it was shared in chat. **Both are placeholders as of 2026-08-11.** It is in git history, so rotating in Neon is still the only real fix — removing the line is not.
- [ ] Reconcile which Neon project is production. `.env.example` documents `ep-super-butterfly-aqksxtdy` (us-east-1); Render is pointed at `ep-broad-heart-ay62yk2t` (us-east-2), which is the empty one. `render.yaml` also pins `region: virginia` "to co-locate with the Neon us-east-1 database" — that comment no longer matches the instance in use.

### Email integration rejected on Render — a blocked port, not a bad key (2026-08-09)

`saveIntegration(type: EMAIL, provider: "resend", enable: true)` answered `INTEGRATION_VERIFICATION_FAILED` against the deployed API. The key was never sent: Render blocks all outbound traffic to ports 25, 465 and 587 on **free** web services (`render.yaml` sets `plan: free`), and a blocked port times out instead of refusing, so `verifySmtp`'s 10s connect budget expired and the failure was reported as the provider rejecting the credentials.

- [ ] **The stored `from` is `osama.jawanh@gmail.com`, which Resend will reject on the first real send.** `verify()` only proves AUTH; the sender domain is checked at send time and `gmail.com` cannot be verified as a Resend sending domain. Either verify a real domain in Resend and use an address on it, or use `onboarding@resend.dev` for testing. Confirm with the console's Send test button, which is the only check that exercises the sender.
- [ ] Consider whether `plan: free` is right for the API at all — port 25 stays blocked even on paid instances, and the free plan also spins down when idle. If email ever needs a provider without an alternative port, this becomes a plan decision rather than a code one.

### Sentry moved into the integrations console (2026-08-10)

`SENTRY_DSN` was environment-only, so pointing the platform at a different Sentry project meant a Render variable change and a redeploy. It is now `MONITORING` in `/integrations`, alongside SMS and email.

- [ ] **Apply the enum migration on the live database.** `prisma/migrations/manual/2026-08-10-integration-type-monitoring.sql`. `db push` in the Render build handles it (adding an enum label is additive), so this is only for databases patched by hand.
- [ ] Consider whether the vendor app's browser-side Sentry, if one is ever added, should read the same row. Today this covers the API process only.
- [ ] `sentry.helper.ts` builds the envelope by hand rather than through a second `NodeClient`. Fine for one test event; if anything else ever needs to send to a non-installed DSN, revisit.

### Integrations console — admin-managed provider credentials (built 2026-08-09)

Changeable third-party credentials (SMS, email; storage/payment declared, not built) moved out of `.env` and into an **admin-only** Settings > Integrations screen, so adding or swapping Twilio / Resend / SendGrid / SMTP is a form submit rather than a redeploy. The boundary: `.env` keeps what the process needs to boot or is infrastructure (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `APP_SECRET`, the encryption key itself); the console holds the rest. **Platform-wide, so no `shop_id`** — `apps/admin` already sends no `X-SHOP`, which matches.

Credentials never reach the browser: the form POSTs plaintext to NestJS over HTTPS, NestJS encrypts before the DB, decrypts only when calling the provider, and reads are masked. Nothing goes in a `NEXT_PUBLIC_*` var — those ship to the client regardless of who is signed in.

Docs: `back-end/docs/features/integrations.md` + `api/integrations.md`.

Open follow-ups:

- [ ] **Apply the migration and grant the permission on each environment.** `npx prisma db execute --file prisma/migrations/manual/2026-08-09-integration-configs.sql` (the partial index is the part `db push` cannot produce), then `npm run sync:permissions` — and admins must **re-login**, since `manage_integrations` is baked into the JWT.
- [ ] **Set `SECRETS_ENCRYPTION_KEY` in Render before anyone uses the console.** It currently falls back to `APP_SECRET`, which is one of the values due for rotation above — rotating it would make every stored credential unreadable. Setting a dedicated key first decouples the two.
- [ ] **STORAGE and PAYMENT have no provider specs.** Both are in the Prisma enum and neither is offered by the console (`SUPPORTED_TYPES` gates it), so the tabs simply do not appear. Bunny/S3 is the obvious next one; PAYMENT should wait for the per-shop payment-provider phase, since that config is shop-scoped and this table is not.
- [ ] **Save-time verification is a live third-party call inside a mutation.** Bounded at 10s, which is the right ceiling for an admin pressing a button, but it does mean a provider outage can make saving *anything* slow. If that ever bites, the fix is to verify asynchronously and gate only `enable` on the result.

## Design system, UI & monorepo

### `BoardingPass` — the ticket card, built to a reference, 2026-09-07

The user brought a boarding-pass design and asked for it as a shared component,
faithful to the image. `packages/ui/src/components/boarding-pass.tsx`: striped
header slab, a white body of hairline-divided rows (brand, carrier, route,
passenger, details), a tear line with a bite out of each edge, barcode stub.
Every piece of content is a slot, so it reads no store and takes strings already
localized, and the rows mirror on their own in Arabic — the type is logically
aligned and the two ends of the route row are a `justify-between`.

Three decisions worth keeping: the notches are **cut** with two mask layers
composited `intersect`, not painted in the page colour, so the card works on any
ground — the price is that a mask clips `box-shadow`, so the card cannot have
one. The tear is **one number** (`STUB_H`) driving the notch centres, the dashed
line and the stub height from the bottom, so three elements cannot drift apart
as content above them grows. And the bars are **derived** from the booking
reference by FNV-1a rather than randomised, because `Math.random()` there is a
render-body impurity that would hand the server and the client different bars.
The palette is fixed rather than tokenized, the same call `AuthShell` makes: the
storefront re-skins `--card` to warm paper, which would quietly stop this being
this ticket.

A 51-agent adversarial review (6 dimensions, every finding refuted from 3
lenses) raised 15 findings and only 1 cleared a 2/3 majority — but several
rejections rested on "content-dependent", which for a slot-driven component is
the failure mode rather than a defence. Four were worth fixing and are fixed:
the **carrier band is now conditional** (it rendered as an empty strip with an
orphaned roundel at the minimal prop set — precisely the shape a non-airline
pass has); the **route codes and times take `min-w-0 truncate`**, so a value
longer than three letters ellipses instead of being clipped off the card edge;
`passengerName` moved from `leading-none` to `leading-tight`, because a name
that wrapped had its two lines all but touching; and the duration pill's plane
is now `rtl:-scale-x-100` — sitting between the two codes it reads as the
direction of travel, so unmirrored it flew from the destination back to the
origin in Arabic. The roundel's copy is deliberately left alone: that one is a
mark, not a heading.

The review also caught three assertions that could not fail. The tear was one
`toContain` satisfiable by either notch, so the two could drift apart with the
suite green; nothing pinned the `-webkit-mask-*` triplet, whose deletion makes
the notches *vanish* rather than degrade; and the determinism test compared
`barcodeBars` against itself, which a module-level cache would satisfy just as
well. All three are real now, the last against a recorded golden value.

- [ ] **Not looked at in a browser.** Verified by `typecheck`, `lint` and
  `boarding-pass.render.test.tsx` (8 passing; the three `tags-selector`
  failures are pre-existing). The stripe angle in particular is a read of the
  reference image — `stripeAngle="135deg"` mirrors the bands if it leans the
  wrong way — and the notch mask is CSS jsdom cannot draw.
- [ ] **The muted type fails WCAG AA, by design.** Measured: the 30px times at
  `TIME #b4b8c6` on white are **1.98:1**, and the 11px labels at
  `MUTED #a2a6b4` are **2.43:1** — against a 4.5:1 normal-text and 3:1
  large-text bar. That is faithful to the reference, which is what was asked
  for, so it is recorded rather than changed. Darkening `MUTED` to about
  `#6b7280` and `TIME` to about `#8b90a0` would clear AA while staying grey;
  the call is the user's.
- [~] No product consumer yet. It ships as a `@repo/ui` primitive with a README
  section; the only thing rendering one is the dev-only playground at
  `apps/vendor/src/app/boarding-pass/` (`http://localhost:3001/boarding-pass`,
  outside `proxy.ts`'s matcher, 404 in production via `assertDevOnly`). Its
  three controls exist to close the two boxes above: a 45°/135° stripe toggle,
  a ground switch whose mesh option is the only way to see a *painted* notch
  fail, and an LTR/RTL toggle.

### The post-purchase confirmation is a popup carrying the order pass — 2026-09-07

The user asked for the ticket card to land after a purchase, "بتصميم ابداعي
ومميز", and then for it as a popup rather than inline. Checkout already
redirects to `/{shop}/account/orders/{id}?placed=1`
(`checkout-page.tsx:327`); `order-detail.tsx` read that into `justPlaced` and
turned on a plain green banner. The banner is gone.

Shipped: `order-placed-dialog.tsx` (the popup) and `order-pass.tsx` (the
order-to-`BoardingPass` mapping), both in
`apps/storefront/src/features/orders/components/`. `BoardingPass` is
**wrapped**, not forked or generalised — the app-local wrapper is what
`@repo/ui`'s one rule asks for, so everything about orders, money, locales and
the shop lives in the storefront and the card stays store-free.

The mapping refuses the metaphor exactly where an order has no data. The route
row is the parcel's real journey — the shop it leaves, the city it arrives in —
which is why the form fits at all. The **carrier band is left empty** so the
component drops it: an order has no airline and inventing one would be cosplay.
**Both stops omit `time`**, so that row drops too — an order has no departure
clock, a date is too long for a 30px slot and an ETA is a phrase; the date moves
to the detail band and the estimate to the 9px pill. The origin truncating is
safe because the shop's name is already the pass's brand line.

Two things the design panel got right and are worth keeping. **The popup never
claims the order is paid** — a card order that succeeds is redirected by Stripe
and never reaches `?placed=1`, so the ordinary caller is cash-on-delivery, and
the copy follows `financial_status` rather than the fact a redirect happened.
And `showPass` **gates on the status too**: `?placed=1` is a link like any
other, so a shared or bookmarked one over a cancelled order suppresses the
popup rather than congratulating someone on an order that was refunded.

The ground is the footer's ink rather than a new dark surface: the pass carries
a fixed palette, and on the app's warm paper it read as a stray swatch. The
tracking number prints above the pass in every state — the stub is
`aria-hidden`, so the bars must never be the only place it lives — and a test
caught exactly that regression when the number was folded into a paid-only
sentence. Dismissing sets a local flag *and* `router.replace`s the parameter
away, so a reload does not reopen it.

`order-placed-dialog.render.test.tsx` (5 tests) pins the two claims it must
never make and the nullable half of a real order (`delivery`, `customer` and
`addresses` are all nullable). 15 tests green in the feature, `typecheck` and
`lint` clean, `orders.md` updated.

Two `@repo/ui` slots came out of this: `durationIcon` (a parcel instead of the
plane) and an optional `BoardingPassStop.time`.

**Second pass, after seeing it on screen.** Three things were wrong and the
screenshot showed all three. The route row printed the shop beside the city in
two 30px slots sized for three-letter airport codes, so both truncated —
"Ahmed Elect…" next to "Riy…" — and the shop was already the brand line above,
so it was the same information twice and neither half readable. `from` is now
**optional** in `@repo/ui`: with one endpoint the row is its full width, and a
place name fits where a code did. The dialog led with a 2xl headline over a
subtitle over an order number over the card — four stacked blocks, three
repeating the fourth; title and description are `sr-only` now, the ground is
transparent so the card sits on the overlay, and the only chrome left is "view
order" and the one fact the card cannot carry (whether money still has to
change hands). The tracking number moved *onto* the card as `stubCaption`, the
way a ticket prints the number under its own barcode.

- [ ] **Still not verified in a browser by me.** The second pass was made from
  a screenshot; the transparent-ground version has not been seen at 375px.
- [ ] The design panel's spec went further than what shipped — a product-photo
  plate where the route row is, a Pay-now recovery for the deliberate
  failed-card fall-through at `checkout-page.tsx:317-327`, and a copy-to-
  clipboard on the order number. Worth mining; none of it is built.
- [ ] `CREATE_ORDER` selects a strict subset of `ORDER_DETAIL`, so the
  `cache-and-network` read is an incomplete cache hit and the customer sees the
  loading branch on every purchase before the popup can open. The headline
  needs only `useShop()`, which is already preloaded — it could paint first.

### `Button` is flat — the press-depth is gone, 2026-09-06

The user asked for the 3D off the button, system-wide. `Button` now paints a
face, a border and a focus ring and nothing beneath it: the ledge `box-shadow`,
the `--btn-sheen-*` top highlight and the `translate` travel are all removed,
along with the `press: js|css` variant and the whole `usePressDepth` hook
(`packages/ui/src/hooks/use-press-depth.ts`, deleted — it had no other
consumer). The API did not move, so all ~190 call sites keep their variants,
sizes and focus ring and only lose the depth.

The tokens went with it rather than being left zeroed, in both theme files:
`--btn-ledge-solid` / `--btn-ledge-soft` / `--btn-sheen-solid` /
`--btn-sheen-soft` and the sampled spring (`--duration-press`, `--ease-press`,
plus the `prefers-reduced-motion` override that only existed to shorten it) are
out of `tokens.css`, and the storefront's warm re-tunings of the same names are
out of its `globals.css`. The one call site that set its own ledge — the
storefront's `QuickAddButton` pill, with `--shop-photo-pill-ledge` — is a plain
white pill now, and that token is deleted too.

- [ ] **Not looked at in a browser.** Verified by `typecheck`, `lint` and the
  `@repo/ui` suite (the three `tags-selector` failures are pre-existing and
  unrelated). Whether the flat face reads well on the dense surfaces —
  toolbars, table rows, dialog footers — is a judgement call nobody has made
  on screen yet.

### `next/image` no longer takes a route down over an unlisted image host — 2026-09-06

An imported product whose photo still lived on `burst.shopifycdn.com` blanked
`/store/[shopSlug]/products/**` with "Failed to load products". Nothing was wrong
with the query: `next/image`'s default loader **throws** on a host missing from
`images.remotePatterns`, and in the App Router a throw during render is caught by
the nearest `error.tsx`, so one thumbnail in the inventory list read as the whole
screen failing to load.

A catalogue URL is not ours to choose — the Shopify CSV importer stores whatever
`Image Src` the file carried — so the allowlist can never be complete. Both apps
now have `shared/components/app-image.tsx`: `next/image` with `unoptimized`
derived from the src, so a listed host keeps the optimizer and an unlisted one is
fetched by the browser instead of throwing. Every call site imports `Image` from
there (32 files), and `no-restricted-imports` on `next/image` in each app's
`eslint.config.mjs` keeps the next one from slipping back. `canOptimize` mirrors
`remotePatterns` and has to: `/_next/image` checks that list server-side, so a
host allowed in one and not the other is a 400 and a broken tile.

The first attempt was `images.loader: "custom"`, which is wrong in a way worth
recording: **configuring a custom loader turns the built-in `/_next/image`
endpoint off entirely** (it 404s), so routing known hosts to it from inside the
loader broke every image that already worked.

- [ ] Re-host imported images onto our own CDN at import time — the durable fix.
      The importer copies the merchant's old URL verbatim, so the catalogue is
      full of links that rot when their old store goes away, and none of them
      are optimized or resized.
- [ ] Admin console has no `images` config and one `next/image` call site; give
      it the same wrapper if it ever renders shop-supplied imagery.
- [ ] Several call sites dropped to a raw `<img>` for this exact reason
      (`products-columns`, `media-library-picker`, `brand-image-field`,
      `carrier-selection-card`, the storefront's carrier logos). They can go back
      to `Image` now.

### `DitherField` in `@repo/ui`, first used on the storefront footer slab — shipped 2026-08-19

`@paper-design/shaders-react` was already a dependency of `packages/ui` (for
`ai-chat-input`'s mesh-gradient halo) but its `Dithering` shader was unused.
`components/dither-field.tsx` wraps it into something that can go on a page:
the WebGL context mounts only once the host scrolls into view and is released
when it leaves, `colorFront` accepts a `var(--token)`, the field layers over the
host's own background so no-WebGL degrades to the plain surface, and
`prefers-reduced-motion` freezes it.

Two sharp edges are handled because neither surfaces as an error. The shader
parses only `#hex`/`rgb()`/`hsl()` and turns everything else — including every
`oklch()` token in `tokens.css` — into **opaque black**, so colours are
substituted from `:root` and normalised through a 2D canvas first. And
`ShaderMount` throws out of an un-awaited async call, so a browser with no
WebGL2 lands on `window` as an unhandled rejection that Next's dev overlay
reports as a page error; `useShaderFailure` claims that one message and leaves
every other rejection alone.

First use: the storefront footer slab, in `--shop-footer-accent` at 0.14,
fading out before the reach band. It is the app's one generative texture and it
is a halftone because the slab is one flat near-black across the full page
width — where an eight-bit gradient bands and a two-colour dither cannot.

`useOnScreen` moved from `components/camera-angle-visibility.ts` to
`hooks/use-on-screen.ts`; it was always generic, and it is now shared.

- [ ] Visual pass in a real browser — the shader has not been seen rendering
      (no local API; the storefront needs a mock GraphQL server to boot). Tune
      `shape` / `size` / `scale` / `opacity` against the live slab.
- [ ] Consider a second home for it: `HomeHero`'s `NoCoverPanel` is the other
      composed-rather-than-photographed surface in the app.
- [ ] **Coupon ticket retuned from a screenshot, not from the browser
      (2026-08-19).** Compared against a reference ticket, the stub's texture
      read as blocky patchwork rather than grain: `size={2}` is coarse at a
      ~60px-tall element and `scale={0.5}` repeated the warp several times
      across 400px, so the halftone resolved into solid regions with hard
      edges. Now `size={1}` / `scale={3}` / `opacity={0.26}`. Still unverified
      in a real browser — same blocker as the slab above.

### Boneyard skeletons (`boneyard-js`) — all `/analytics/*` screens converted 2026-08-17, capture not yet run

Skeletons whose shape is measured from the real rendered DOM instead of hand-approximated. `npm run bones` drives headless Chromium over the running dev server, measures every `<Bones name="...">` at four breakpoints, and writes `src/bones/*.bones.json` + `registry.ts` (committed — production never launches a browser). Wrapper is `shared/components/bones.tsx`, kept deliberately distinct from `@repo/ui`'s `Skeleton`. Config in `apps/vendor/boneyard.config.json` — 23 bone names, cross-checked against the code as an exact two-way match.

**No manual skeleton remains on any analytics screen.** `ListSkeleton` was deleted from `analytics/card-states.tsx` and `@repo/ui`'s `Skeleton` is no longer imported by `analytics`, `customer-analytics`, `inventory-analytics`, `attribution`, `reports` or `targets`. `<Bones>` deliberately takes **no `fallback`** — that was the point of the change. Typecheck, lint (0 errors), 431 tests and `next build` all green.

- [ ] **Run the first capture — no longer a release blocker, and now gated on data rather than setup.** Runtime measurement plus the `sessionStorage` mirror covers the first paint of every load after the first in a tab, so the screens work today; the committed capture is the only thing that covers a brand-new tab's first paint and the only thing responsive across all four breakpoints. Needs `npm run bones:setup` (downloads Chromium), the dev server + back-end up, `BONEYARD_ACCESS_TOKEN`/`BONEYARD_REFRESH_TOKEN` from a real browser login — and, per the blocker below, **a shop with orders in it**. The slug is no longer a blocker (repointed at `ahmed-electronics`).
- [ ] **Runtime capture is single-breakpoint.** It measures at whatever bucket the viewport is in and caches under that key, so resizing across a breakpoint measures again rather than interpolating — fine, but it means a session that never visits mobile has no mobile bones. Only the committed capture covers all four widths up front.
- [ ] **BLOCKER — the database has no orders at all, so no shop can be captured usefully.** Queried 2026-08-17: **every** shop has 0 orders and 0 completed orders. The best candidate, `ahmed-electronics`, has 5 products and nothing else; the rest have 0 products and are mostly unapproved. The `demo-store` slug both configs shipped with **does not exist**, so the capture would have followed a redirect and captured the wrong page — the vendor config is now repointed at `ahmed-electronics` (23 routes) so the URLs at least resolve. But bones are measured from real query results, so today every revenue/series/cohort/attribution card would capture its **empty state**. **Seed orders first** (this is the same missing production seed as the deployment section below) — until then the capture is worse than no capture, and runtime measurement is doing the real work.
- [ ] **The same emptiness means the admin `/analytics` screen currently renders all zeros**, so it cannot be judged by eye either. Not a bug in the screen.
- [ ] **`analytics-kpi-figure` is captured on three routes; last visit wins.** It is shared by all 20 `MetricCard` call sites across `/analytics`, `/analytics/customers` and `/analytics/inventory`. Exact today (all three render the same figure span), but if one page's KPI typography diverges the shared name silently becomes wrong for the other two.
- [ ] **The RTL mirror is unverified by eye.** boneyard has no notion of writing direction — it positions bones with `left: <x>%` from a capture taken in English. `globals.css` mirrors the overlay with `[dir="rtl"] [data-boneyard-overlay] > * { transform: scaleX(-1) }`, which is right in principle (bones are text-free rects) but has never been seen against an Arabic dashboard.
- [ ] **The two recharts captures are the least predictable.** They rely on `snapshotConfig={{ leafTags: ["svg"] }}` to keep the chart one block instead of tracing its `<path>` internals. Verify by eye on first capture; if the surface still fragments, `excludeSelectors: ["svg *"]` is the next lever.
- [ ] **Nothing guards staleness.** A `<Bones>` whose wrapped component was relaid out keeps serving the old shape silently. A CI check that recaptures and diffs would need a browser + a seeded logged-in shop in CI — currently absent. This is the main cost of the approach and it now applies to seven screens.
- [ ] **The rest of the app still hand-rolls skeletons** (~70 call sites outside `/analytics/*`: `returns-list`, `draft-orders-list`, `balance-view`, the product form cards, the picker dialogs). Converting each one adds a capture route, so the config grows toward "capture most of the dashboard". Decide whether that is wanted before extending further.
- [ ] **The admin capture has never run either** — same prerequisites as the vendor one, plus its own login session, and `/analytics` is its only route. Not blocking since runtime measurement covers it after first render; the capture is what covers first paint.
- [ ] **Admin's other 11 call sites still use `DataTableSkeletonRows`** (`/users`, `/shops`, `/withdrawals`, `/commissions`, plans, subscribers, otp-logs). Left alone deliberately — they are not analytics screens and the rule was scoped to those.
- [ ] **`playwright` now rides along in the vendor dependency tree** — it is a hard (not optional) dependency of `boneyard-js`, so `npm install` pulls it for every contributor even though only the capture step uses it. Browser binaries are still opt-in via `bones:setup`.

### Monorepo — Turborepo migration (2026-07-10)

Migration itself shipped 2026-07-10 (`vendor/` → `apps/vendor/`, root workspaces + `turbo.json`, `packages/typescript-config` + `packages/eslint-config`; `back-end/` deliberately not a workspace member). Open items:

- [ ] **Manual step — Vercel:** change the project's **Root Directory** from `vendor` to `apps/vendor`. Nothing deploys correctly until this is done.
- [ ] Archive or delete the now-redundant `osama-gawanah/vendor` GitHub repo so the two copies can't drift.
- [ ] Optional: enable Turborepo Remote Caching (`npx turbo login && npx turbo link`) to share build caches with Vercel/CI.

### Monorepo — packages/ui + apps/admin (2026-07-10)

### Light-direction trackball — polish pass done 2026-07-26, residue below

Shipped in `packages/ui/src/components/camera-angle-*`: the orbit ring rebuilt as a shader-driven tube (depth thickness, dashes away from the emitter, a lit band travelling with it, hover and drag-start flash), a `behindGlobe` GLSL twin of the TypeScript occlusion test, hand-shaded globe wire with a real terminator, the light's sheen on the glass, a landing spot on the globe surface, an animated beam, a history-based motion smear, ripple + settle bounce, drag crosshair, half-degree camera parallax, and cursor/hover feedback. Timing moved to `camera-angle-motion.ts` and hit-testing to `camera-angle-geometry.ts`, both renderer-free and unit-tested so the WebGL scene and the 2D fallback cannot drift. Two bugs fixed on the way: `ArrowUp`/`ArrowDown` moved the light the opposite way from the chevrons of the same name, and inertia was being integrated by three components at once (applied twice a frame, decayed three times at two rates) — now one `OrbitDriver`.

- [ ] **The shaders have never been compiled on a GPU in CI.** Six programs are cross-checked statically (every GLSL uniform is supplied, every varying is written) and the geometry is unit-tested, but jsdom has no WebGL and the repo has no browser automation, so a syntax error in a shader would first show up as a black widget in a browser. Either add one Playwright smoke test that mounts the widget and asserts a non-blank canvas, or run the six programs through a GLSL validator in CI.
- [ ] **`react-hooks/immutability` still flags `OrbitDriver`** (3 errors). It is the frame callback writing the shared refs, which is the pattern react-three-fiber is built on; the rest of the component's uniform mutations were moved behind material refs and the file went from 14 errors to 3. Revisit if the rule grows an escape hatch for `useFrame`.
- [ ] The `role="application"` host carries `aria-valuetext`, which that role does not support (`jsx-a11y` warning, pre-existing). Decide between a real `slider`-shaped role pair and a live region.
- [ ] Ring hover re-reads the host's bounding box at most every 250 ms during a hover. A scroll that moves the widget without producing a pointer event can leave the hit test stale for that long. A `ResizeObserver` plus a scroll listener would be exact; the throttle was chosen over a forced layout per pointer move.

- [ ] Arabic woff2 files (1.2 MB, 15 faces) are now **duplicated** in `apps/vendor/public/fonts` and `apps/admin/public/fonts`. Move to a shared assets package copied at build time if a third app appears.

### Pixel scroll transition — shipped 2026-07-29

`packages/ui/src/components/pixel-scroll-transition.tsx` plus a renderer-free `pixel-scroll-transition-grid.ts` (thresholds, patterns, easing, progress), 55 tests. Sticky and inline modes, six directions, six patterns, `scrollContainerRef`, theme-token colours repainted through a `<html>` MutationObserver.

- [ ] **The canvas painting has never run in a browser under test.** The grid maths is unit-tested and the page is SSR-verified, but jsdom has no 2D context, so a mistake in the draw loop would first appear as a blank canvas. Same gap as the trackball shaders above — one Playwright smoke test asserting a non-blank canvas would close both.

### Auth screens — split-shell redesign 2026-08-06

`AuthShell` + `FloatingPaths` in `packages/ui`, consumed by both `apps/vendor/src/app/(auth)/layout.tsx` and `apps/admin/src/app/(auth)/layout.tsx`. Dark decorative aside (brand, pull quote, animated stroke field) beside the light form column, dropped below `lg`. The panel is dark because it carries the `dark` class, which re-declares the palette variables on that subtree rather than hardcoding a colour — so the strokes, quote, and brand all resolve against the dark tokens. "Home" link and locale switcher pinned to the top of the form column; theme-tinted radial washes behind it. Page content is start-aligned and the identifier/email field is icon-prefixed via `InputGroup`. `heroTitle`/`heroSubtitle` were replaced by `layout.{home,quote,quoteAuthor}` in all four message catalogs.

- [ ] **Never seen in a browser.** Verified by `typecheck` and a production build of both apps only. RTL in particular is unverified — the frame relies on logical properties (`border-e`, `end-0`, `inset-x-*`) and `rtl:rotate-180` on the back chevron to mirror.
- [~] **No test coverage for `AuthShell` / `FloatingPaths`** — `auth-shell.render.test.tsx` (slots, chips, canvas a11y) and `pixel-field.render.test.tsx` added 2026-08-11 with the pixel redesign. `FloatingPaths` itself remains untested and is now unused (see the 2026-08-11 section below).
- [ ] The reference design carried Google/Apple/GitHub buttons; **they were left out because the back-end has no OAuth**. Add them with the provider work, not before.

### Entry screens — pixel ember wall redesign, 2026-08-11

All vendor entry screens now share one identity, unified per the user's direction on the Shopify pattern: **a white card centered on a full-bleed black ground** (`#0a0a0a`), the ground a living `PixelField` canvas (the ambient, time-driven sibling of `PixelScrollTransition`, reusing its threshold grid) with ember accents (`#eb5e28`/`#00A699`/`#FFB400`) and pointer sparks. `AuthShell` = brand + mono eyebrow + display headline + quote above the card, product-truth chips below; optional `progress` (step row) and `wide` slots carry the signup wizard, so `/register` and `/verify-otp` wear the *same* shell as `/login` — `SignupGround`/`SignupShell`/`SignupPanelShell`/`SignupRail` are deleted. One form vocabulary too: `@repo/ui/components/auth-form` (`AuthInput`/`AuthSubmit`/`AuthOtpGroup`/`AuthOtpSlot` at the signup `h-14 rounded-xl` scale over the ordinary `Field` plumbing) replaced both the dashboard-scale login inputs and the signup's private `SignupField` vocabulary (deleted, with `pane-header.tsx`). `AuthHeading` opens every card with an ember cell + mono flow eyebrow. The ground keeps light tokens for the card (`color-scheme: light`); top bar/brand rows are `dark` subtrees with explicit cream resting colour. Reduced motion freezes everything; RTL drops eyebrow tracking. Docs: `apps/vendor/docs/features/auth.md`, `signup.md`, `packages/ui/README.md`.

- [ ] **Never seen end-to-end in a browser since the final unification.** The user has eyeballed `/login` and `/register` mid-iteration; the OTP panes, RTL, and reduced-motion still deserve a pass.
- [~] **Kept, deliberately (2026-08-12).** Unlike `FloatingPaths` this is *reachable*: a documented, tested optional flag (~25 lines, inert by default) on a component that is very much alive. That is an unused feature, not rot — and whether the auth wall should carry a brand mark is a design decision, not a cleanup one. Left for you to call.
- [ ] The wall repaints ~4k cells at 30fps on one canvas. Fine on anything recent; if a low-end report ever lands, raise `pixelSize`/`FRAME_MS` or pause on `document.hidden` explicitly.

## Roadmaps

Multi-phase programmes with a locked design. Each is a body of work, not a
task — pull items out of them into an area above when they get scheduled.

### Road to 90+ (Shopify parity) — from the 2026-06-28 re-audit (62/100)

Every item below is a critical/high gap the full re-audit found, grouped by priority. Tags show the domain + its current re-audit score (the lever). To push the OVERALL above 90, the P0 bugs must go AND the lowest domains (Content 31, Analytics 31, API 41, Shipping/Tax 42) need to climb to ~85+. Full detail: `docs/shopify-parity-reaudit-2026-06-28.md`.

#### P2 — front-end surfacing gap (2026-06-30; biggest parity lever)

- [ ] Surface back-end domains that have NO vendor UI: ~~analytics dashboard~~ (DONE 2026-06-30), ~~draft-order builder~~ (**was already built** — `orders/drafts/` routes + `components/drafts/`; the audit listing it as missing was wrong), ~~fulfillment~~ + ~~refund-create flow~~ + ~~returns/RMA queue~~ (DONE 2026-07-13, see below). **Still absent:** disputes, withdrawals/balance/payouts, shipping-zones + tax-classes editors (settings placeholders), flash sales, CMS (`/content` 404), staff accounts, reviews/Q&A moderation. Remove or build the 4 remaining dead nav links (`app-sidebar.tsx`: `/marketing` `/content` `/markets` `/customers/companies`).
- [ ] Server-side pagination/search on orders + customers (both cap at 50 rows, paginate client-side: `orders-table.tsx:33`, `customers-table.tsx:42`).
- [ ] Per-shop currency (hardcoded SAR in `shared/lib/format.ts:23`); finish Arabic i18n (~7% adoption); add front-end tests (~1% today).

#### P1 — Missing operational pillars (the biggest score levers)

- [ ] Order editing pipeline (stage line changes, recompute totals/tax in cents, capture/refund the delta). (Orders 58)
- [ ] Vendor Returns/Refunds UI (queue, approve/reject with per-line restock toggles, refund breakdown, policy editor). (Returns 54)
- [ ] Staff accounts — `ShopMembership` (shop_id, user_id, permissions[], invited_by, status) + invite/accept/revoke; move permissions off the global Role to per-membership; central `ShopAccessGuard` (membership, not ownership); 2FA/TOTP + recovery codes (mandatory-eligible for owners) + `permissions_version` claim to invalidate live tokens on role change. (Auth 61)
- [ ] Analytics dashboard FOLLOW-UPS — full gap analysis + roadmap in `docs/shopify-parity-analytics-2026-06-30.md` (overall analytics parity ~34/100; sales slice ~80). Tier 1 (cheap, no infra): COGS/profit via `Product.cost_per_item_cents`, CSV export, custom date range + BFCM/quarter presets, per-shop currency, **Targets** (model+gauge+pacing), auto-refresh. Tier 2: schedule the `proactive-ai` insight engine + inbox (M5), customizable dashboard + sections, Reports engine v1 + weekly email. Tier 3 (structural): storefront **session pipeline** — the prerequisite for sessions/conversion/funnel/device/geo/referrer/cohort/sell-through/Live View; ~half of Shopify's overview is out of reach until it lands. (Analytics)
- [ ] Customer record — promote email (unique-per-shop)/first_name/last_name/language/address to first-class columns (off the opaque JSON); expose total_spent/orders_count/last_order_at/predicted_tier + order timeline on the customer page. (Customers 58)

#### P2 — Enterprise & financial integrity

- [ ] Stripe Connect — vendor onboarding (Express/Standard), destination charges/transfers on completion, real payouts on withdrawal approval, per-vendor fund segregation. (Payments 58)
- [ ] Multi-location at checkout/fulfillment — make per-location `InventoryLevel.available` the storefront/reservation source of truth (today multi-location is admin-only); + merchant reorder-point/safety-stock columns + low-stock view/alert. (Inventory 88)
- [ ] Merchant-defined namespaced metafields (per-shop, typed, optional variant-level) parallel to category attributes. (Products 90)
- [ ] App/extension platform — `OAuthApp` + `AppInstallation` + `AccessScope`, authorization-code flow issuing scoped tokens, scope enforcement in the guard chain; async bulk-operations API + cursor pagination; versioned Admin API. (API 41)

#### P2 — Content / storefront / SEO

- [ ] Storefront ownership decision — either own it (Theme/Section/Template + ThemeSettings + draft/publish/preview) or formally retire the orphaned NestJS content path (the live storefront is a separate Laravel `/api/v2`). (Content 31)
- [ ] URL Redirects engine — `UrlRedirect` (shop_id, path, target, 301/302) + storefront lookup + bulk CSV + auto-create on handle change. (Content 31)
- [ ] Page draft/published + scheduling + template_suffix + SEO meta; filter unpublished from public reads. (Content 31)
- [ ] sitemap.xml + editable robots.txt + canonical URLs + JSON-LD structured data (per shop). (Content 31)

#### P3 — Marketing, AI & quality

- [ ] Campaign/broadcast engine — `Campaign` (audience=segmentId, channel email/SMS, template, schedule) over the BullMQ EMAIL queue, honoring consent. (Marketing 61)
- [ ] Newsletter signup operation — a public, shop-scoped mutation that records an email against a shop. The storefront footer already has the field and falls back to composing a `mailto:` because nothing exists to call; `subscribeStockNotification` is product-scoped and is not it. (Marketing 61)
- [ ] Marketing automation/Flow engine — `Automation` (trigger, conditions on segments/events, ordered actions) subscribing to existing domain events. (Marketing 61)
- [ ] Loyalty earn/redeem program (points-per-currency earn rules credited on order completion + checkout redemption). (Marketing 61)
- [ ] Referral program — per-user codes + `referred_by` capture at signup/checkout + auto-credited `ReferralEarning` on first qualifying order. (Marketing 61)
- [ ] Activate the proactive AI insight engine — schedule `analyzeAllShops`, expose `getInsights/markRead/dismiss`, render an insights inbox on `/ai` (built but never runs). (AI 82)
- [ ] AI spend ledger — route the vendor agent + Tiptap editor through one cents-accurate `AiBudgetService`; add AI image background-removal + expose SEO/marketing copy generators in the product form. (AI 82)
- [ ] Frontend tests — RTL coverage for the contextual save bar (dirty/save/discard/shake), data-table (filter/paginate/sort), order/product forms, bulk editor; gate PRs on a coverage threshold (only 4 tests today). (Admin UX 78)
- [ ] Finish Arabic i18n — extract all hardcoded admin strings into per-feature namespaces (~30% covered today) + CI lint blocking raw JSX text. (Admin UX 78)
- [ ] Orders index — server-side pagination/filtering/search (currently loads only 50 rows, filters client-side). (Admin UX 78)
- [ ] Collections — product ordering/sort modes (MANUAL/BEST_SELLING/ALPHA/PRICE/CREATED) + draft/published state + rule-engine unit tests (zero coverage today). (Collections 72)
- [ ] Cart — express/wallet checkout (Apple/Google Pay, automatic_payment_methods, off-session saved-card charging); implement the documented abandoned-cart cadence. (Cart 71)
- [ ] B2B (if in scope) — Company/CompanyLocation/CompanyContact + PriceList/Catalog + PaymentTerms; else formally mark out-of-scope so it stops counting against parity. (Customers 58)

### Analytics Platform — roadmap (blueprint 2026-06-30)

Full architecture: **`docs/analytics-platform-blueprint-2026-06-30.md`** (decided, from a 20-agent design workflow + adversarial hardening). Phase-1 build spec: **`docs/analytics-platform-phase-1-spec-2026-06-30.md`** (file-level, ready to build).

**Decided store:** PostgreSQL stays the single store — no ClickHouse/Timescale until the Phase-3 event stream measurably breaches Postgres p95 (named escalation trigger). Rollups = incremental UPSERT, watermark-driven, additive-cents-only, shadow-diffed before flip.

- **Phase 1** (no new infra, all from existing tables): profit engine (frozen COGS + gateway fees + net profit/margin), report-builder v1 (safe dimension×measure×filter), per-shop currency + timezone, CSV export + custom date range, Targets. → the headline differentiators (Net Profit beats Shopify) ship first.
- **Phase 2** (Postgres only): `SalesDailyRollup` + 1-min refresher (fast dashboards at scale), customer engine (LTV/RFM/cohorts), inventory engine (sell-through/days-of-supply/dead-stock), `OrderAttribution` last-touch + `AdSpend` (CAC/ROAS), AI Insights resolver (schedule the built-but-dormant `chat/proactive` detectors), Live View order/revenue half (SSE + Redis pub/sub).
  - **STATUS 2026-07-07:** customer engine, inventory engine, and `OrderAttribution`+`AdSpend` already SHIPPED (see their feature docs). **AI Insights resolver DONE 2026-07-07** (surface + tz-gated schedule + currency fix — see Done). **Remaining P2: `SalesDailyRollup`+refresher, and Live View order/revenue half.** Deferred within insights: explanatory detectors (`refund_spike`/`margin_erosion`/`conversion_drop`/`attribution_win`) + `explanation`/`see_why` deep-links + `dedup_hash`.
- **Phase 3** (structural, new infra, gated on instrumenting the separate storefront): event pipeline → sessions/conversion/funnels, live visitors, multi-touch attribution.
- **Phase 4:** multi-touch (`TouchPoint`), FX, anomaly/forecasting, and the *only* point to re-evaluate a columnar store.

#### Deferred follow-ups (from Block E)

- [ ] Shop-timezone day boundaries for the analytics date filter: presets AND the new custom calendar range snap to browser-local midnight, while the back-end buckets the series in the shop's IANA timezone — a picked day range can show an extra/missing edge day on the chart when the two zones differ. Needs the shop tz exposed to the vendor FE and used in `rangeForPreset`/`rangeForCustom`.
- [ ] X-SHOP-aware Apollo cache keying: queries with no variables (e.g. `AnalyticsTargets`) normalize under one ROOT_QUERY key across shops, so switching shops briefly flashes the previous shop's cached data under cache-and-network. Fix globally (typePolicies keyed by active shop, or cache eviction on shop switch) — repo-wide pattern, not targets-specific.
- [ ] Per-bucket `NET_PROFIT` pacing line (bucket COGS + fees by tz day/month like the report-builder DAY dim) so net-profit targets get a cumulative curve, not just a gauge.
- [ ] `Target.filter_json` scoping (product/collection/category) — needs line-level measures, not order-level aggregates, to stay money-correct.
- [ ] `anchor`/past-period targets in the FE (backend already accepts `anchor`); the form currently targets the current period only.

**Docs:** update analytics/report-builder/targets overview + `api/*` docs; vendor feature docs; bump Last updated.

### Analytics platform — Marketing Attribution engine (designed 2026-06-30, hardened from design review)

Designed (not built): UTM/source capture + first/last-touch attribution + revenue-by-source + CAC/ROAS. **Decision (overrides the earlier draft): attribution is a standalone `OrderAttribution` entity (1:1 with Order), NOT columns on `Order`** — so the P2 jump to multi-touch is just a new `TouchPoint` table, with zero migration churn on the hot `orders` table. This is the canonical attribution design the platform blueprint adopts.

**Status (2026-07-02): AE-P1a + AE-P1b + AE-P1c + docs SHIPPED & green** (backend 2174 tests, `npm run build` exit 0, schema regenerated; FE codegen/typecheck/build green). Report page (`/analytics/attribution`) with CAC/ROAS + ad-spend manager (`/analytics/attribution/ad-spend`) live. Deviations: `average_basket` returned as integer `units` (FE derives basket = units/orders) to stay integer-only; `model` accepts LAST_TOUCH **and** FIRST_TOUCH (both are column choices); CAC denominator = distinct new customers; ad spend joined by (channel|source|campaign), never by day; MEDIUM grouping has no spend equivalent (CAC/ROAS null). **Remaining: AE-P2 (event pipeline / multi-touch / connector imports). `conversion_rate_bps` stays null until then.**

- [ ] AE-P2 (needs event pipeline) — when the Session/Visit model lands, derive attribution from the session (stop trusting client-sent UTMs) and add a `TouchPoint` (1:N per order) table; multi-touch models (LINEAR / POSITION_BASED / TIME_DECAY) compute `OrderAttribution` from touch-points — the `model` enum + `attributionReport(model:)` arg already exist, so no breaking change. Connector imports (Meta/Google Ads) populate `AdSpend` via BullMQ cron with `source_kind='connector'` + the real `ad_account/campaign_id/adset_id/ad_id`.

### Payment provider abstraction — Stripe Connect (planned, design locked 2026-07-15)

Full design in [`docs/future-features/payment-providers-stripe-connect.md`](docs/future-features/payment-providers-stripe-connect.md). Migrate from the current single-platform-Stripe "marketplace of record" to a per-shop **provider abstraction (Strategy Pattern)** with **Stripe Connect first** (per-shop connected accounts, destination charges + `application_fee`). Decisions locked: provider abstraction · Stripe Connect first · commission via `application_fee` · extensible to local gateways later. ⚠️ Validate Stripe Connect SAR availability in KSA before Phase 2.

- [ ] **Phase 1 — Foundation (no behavior change):** `PaymentProvider` model + enums + `Order` provenance columns (migration); `src/common/crypto` (AES-256-GCM); `src/payments/` module + strategy interface + registry + `PlatformStripeStrategy` (identical to today); route `createPaymentLink` through the registry.
- [ ] **Phase 2 — Onboarding:** `StripeConnectStrategy` Account Links onboarding + `getAccountStatus`; connect webhook (`account.updated`) at `/webhooks/stripe/connect`; **vendor Payment Settings UI + return routes**.
- [ ] **Phase 3 — Destination charges + `application_fee`:** single-shop `createCheckout` with `transfer_data.destination` + fee helper (reuses `applyBps`); stamp provenance; `payment_intent.succeeded` webhook.
- [ ] **Phase 4 — Payouts/Refunds/Disputes under Connect:** refund with `reverse_transfer`+`refund_application_fee`; branch `RefundsService`/`DisputesService`; **multi-shop separate charges + transfers** with strict idempotency.
- [ ] **Phase 6 — Additional providers:** MyFatoorah/Moyasar/Tap/HyperPay/Tabby/Tamara strategies with encrypted `config`; **API-key provider form (save bar)**; optionally wire the tiered `commissions` table.

### Entitlements platform — plans, capabilities & metered quotas (planned, design locked 2026-08-04)

Full design in [`docs/future-features/plans-and-entitlements.md`](docs/future-features/plans-and-entitlements.md). No `Plan`/`Subscription` exists today — instead four hardcoded env caps applied identically to every shop, two separate per-shop quota implementations (`image-gen.service.ts` `assertMonthlyCap` + `vendor-agent/quota.service.ts`), plus a plan-blind `MAX_SHOTS_PER_RUN` and per-model `maxCount`. Built as a **general engine, not an AI-plans feature**: every module (AI, catalog, storage, staff, analytics) registers capabilities in one catalog and calls one service, so a new capability is a registry entry + a seed row, never a change to the plan machinery.

Decisions locked: **one capability key per operation** (`ai.image.generate`, `ai.text.translate`, `catalog.products`) with `kind` = BOOLEAN/LIMIT/QUOTA · **`billing_unit`** per capability (image/character/product/request/document/byte/seat) · **hybrid value — the enforced scalar stays a `limit_value` column, `config` JSON holds only the knobs the engine does not compare numerically** (`maxBatch`, `providers`, `hd`, `languages`); pushing the quota into JSON makes the atomic SQL untyped and fail-open on a typo · **config shapes declared in a typed code registry** (`feature-registry.ts`, zod), served to the admin so the entitlement matrix form is generated, never hardcoded per capability · `reserve`/**`commit`**/`release` so estimated units (characters, tokens) settle on actuals · `UsageCounter` in **Postgres, not Redis** · boolean gating in `FeatureGuard`, quota gating in the service · missing entitlement row = deny, guarded by a CI drift check · **plans assigned by an admin, Stripe billing deferred to Phase 6** · downgrade freezes the capability read-only, never blocks, never deletes. A shop with no subscription resolves to a seeded `FREE` plan carrying today's env numbers, so enforcement day is a no-op for existing shops.

- [~] **Phase 4 — Breadth (started 2026-08-06).** Wired: `catalog.products`, `catalog.collections`, `discounts.coupons` as LIMIT gates on their `create()` paths, and `catalog.import_export` as a `@RequireFeature` + `FeatureGuard` gate on both CSV mutations (**that one was removed on 2026-09-06** — CSV is not sold separately; see the products-CSV entry under Vendor dashboard). Each LIMIT gate asks `planLimit` first and **skips the count entirely when the answer is null (unseeded database) or the limit is unlimited** — a `count()` is only paid for when there is a ceiling to compare against, and refusing every create because the seed has not run would take the whole catalog down. ⚠️ **A `BOOLEAN` gate can only go on a resolver whose chain already resolves X-SHOP**, since `FeatureGuard` reads `req.shopContext`: the CSV mutations do, which is why they were gateable; `bulkUpdateProductsStatus`/`bulkUpdatePrice`/`bulkUpdateTags` are owner-scoped with no `ShopHeaderGuard`, so gating them means changing their contract to require the header — deliberately not done here. Note the agent path for both bulk ops and CSV is **already gated** through phase 3e's `TOOL_REGISTRY`.
- [~] **Phase 4 — more capabilities wired (2026-08-06).** `inventory.transfers` on the 8 mutations that create or advance a transfer, and `analytics.reports` as a **class-level** `@RequireFeature` on the analytics resolver. Two guard changes made that possible, both worth keeping: (1) `FeatureGuard` now reads the decorator via `getAllAndOverride([handler, class])`, so a resolver whose every operation belongs to one capability declares it once and a method decorator still wins; (2) **platform staff bypass the guard when no shop is in scope** — `super_admin` may omit X-SHOP by design and `ShopOwnershipGuard` already returns early for both admin roles, so denying them would have broken every platform-wide screen the moment its resolver gained a `@RequireFeature`. With X-SHOP present the shop's plan applies regardless of role. ⚠️ **`delete`, `cancel` and `comment` on transfers were deliberately left OPEN**, as were all the read queries: a plan that excludes transfers must not strand the shop's existing data behind a paywall. Only creation and advancement are gated.
- [ ] **Phase 4 — remaining.** (`storage.files` **done 2026-08-06** — gated in `AttachmentsService.upload`, incoming file rounded UP to a whole megabyte so many sub-MB files cannot inch past the ceiling; the stored total is `SUM(attachments.size)` converted at the same seam. Shipped with it: a **`storageUsage` query** giving the vendor the breakdown behind the number — total vs ceiling, by `context`, by MIME family, and the biggest files — because refusing an upload with "out of space" and nothing else leaves them no way to act. It is deliberately **not** gated on `storage.files`: a shop at its ceiling is exactly the one that needs it. 12 tests cover the arithmetic, incl. zero-total not rendering as NaN and the top-N bound so a 50k-attachment shop never loads rows it will not show.) Left: `catalog.bulk_operations` (**needs a decision**: `bulkUpdatePrice`/`bulkUpdateTags`/`bulkUpdateProductsStatus` are owner-scoped via `@CurrentUser()` with no `ShopHeaderGuard`, so gating them means adding `RequireShopGuard` and making X-SHOP mandatory on those mutations — a contract change; the agent path is already gated via `TOOL_REGISTRY`) · `staff.accounts` (**blocked**: needs the `ShopMembership` model, which does not exist) · `ai.text.*` / `ai.catalog.*` / `ai.vision.*` (**blocked**: those services are not built — `src/ai/` has content/vision/embedding pieces but no translate/rewrite/summarize/seo surface to gate).

- [ ] **Overage billing** — optional `overage_allowed` / `overage_price_cents` on `PlanEntitlement`, so a shop past its quota can pay per unit instead of being refused. Needs a metered Stripe price alongside the flat subscription; deliberately out of phase 6.

## Backlog — unscheduled

Items surfaced while setting up the docs - verify and prioritize:

- [ ] **Remove the dead code found by the 2026-08-14 sweep — full list in [docs/dead-code-audit.md](docs/dead-code-audit.md).** 44 unreachable files (~3,314 lines), 24 declared-but-never-executed GraphQL documents, 140 unreferenced exports in live files, 11 unused dependencies, 2 caller-less `@deprecated` methods, 3 unused i18n namespaces. Biggest single cluster is the chat vendor-CRUD path — `chat/handlers/vendor-{create,update,delete}.handler.ts` + `product-crud-state.service.ts` + `tools/tool-middleware.service.ts` (~783 lines), none of it in any module's `providers`; `VendorIntentHandler` is the live path. Do **not** remove the admin row-selection kit (`shared/lib/selection.ts`, `DataTableSelectionBar/SelectHead/SelectCell`) or the inventory/segments bulk mutations — those are the pre-built halves of the open bulk-selection items above. Verify `@as-integrations/express5` is not an Apollo peer before dropping it.
- [ ] **Backfill `plans.stripe_product_id` on any deployment with existing subscriptions.** Products are created lazily on first checkout or plan change, so a plan nobody has touched since the change still has a null. Harmless — the next call fills it — but a seed/migration pass would make the column true everywhere at once.
- [ ] **Add a real migration for the entitlements billing columns.** `plans.stripe_product_id`, `shop_subscriptions.pending_plan_id` / `pending_change_at`, and `shops.trial_used_at` were applied with `prisma db execute` (the shadow-DB workaround); they need to reach `prisma/migrations/manual/` like the 2026-08-04 entitlements SQL did.
- [~] **Backfill `shops.trial_used_at` for shops that already spent a trial.** No longer blocks anything: eligibility is now owner-scoped and **derived** from `shop_subscriptions.trial_ends_at`, so shops that trialled before the column existed are already refused a second trial without any backfill. Still worth one pass if the per-shop column is ever wanted as an accurate record in its own right — it is currently null for every shop that trialled before 2026-08-08.
- [ ] **Consider paginating `myInvoices`.** It reads one Stripe page (default 24, max 100) with no cursor. Fine for a shop's first years; a long-lived subscriber will eventually want "older invoices".
- [ ] **Live end-to-end check of the trial-ending path.** Stripe's side is proven (`trial_end: "now"` turns a 0 proration into the full 4,999) and the service is unit-tested against it, but the two have not been exercised together on a real trialing subscription — the test shop's trial ended during earlier verification. Worth one run on a fresh trial before this reaches production.
- [ ] **Document local Stripe setup in the runbook.** Webhooks never reach `localhost` on their own — `stripe listen --forward-to localhost:3000/webhooks/stripe` must be running beside the dev server or every checkout completes at Stripe and leaves the shop on FREE. Belongs in `back-end/docs/12_runbook/`.
- [ ] **Finish the money-boundary unification: product prices + analytics aggregates → integer cents.** The 2026-07-13 cutover unified every *vendor-money* path (withdrawals/balance/commissions/wallets/shipping/referrals/invoice) to integer cents/bps, but deliberately stopped short of two large surfaces still on `Float`: **product prices** (`price`, `sale_price`, `min_price`, `max_price` on the product/public-product/AI-recommendation types) and **analytics aggregates** (`MonthlySale.total`, `avgTotalSpent`, `medianTotalSpent`, `total_sales`, `revenue_total`, etc.). Prices are stored as `*_cents` in the DB already (Phase-3 cutover), so the pattern is identical — but the product-price surface is **coupled to the live Laravel storefront** (`ZaydakShop` hits `/api/v2`), so flipping the GraphQL type risks a production storefront and needs a coordinated storefront change or a compat window. Analytics floats are lower-risk (read-only, internal) and could go first. Do NOT bundle with a vendor-only change.

## Ideas / Maybe

- [ ] (add ideas here)

## Done — closed out

Entries with nothing left open, kept for the record — they are how the decisions
behind the current code were made.

### Clicking away from the category picker keeps the level you drilled to — 2026-09-06

The taxonomy picker drills on a row with children and selects on a leaf, which
leaves a merchant who decides level 1 is specific enough holding a category the
form has not been told about. The only way to say it was the "Use <name>" row at
the top of the drilled-in level, and the natural gesture — click away, the field
looks chosen — wrote nothing and left the product uncategorised.

An outside press now commits the trail's last node. Escape still cancels, a
search in progress cancels (the trail is left standing under a query, so the
level it names is not what is on screen), and nothing is written until the
merchant has actually navigated — the panel opens pre-drilled to the chosen
node's parent on an edit, so without that last guard opening it for a look and
clicking away would rewrite the choice as its own parent. No server change: any
node is a valid `system_category_id` and metafields resolve from the ancestor
chain, so a level-1 pick is a smaller schema rather than an invalid one.

- [x] The root list is the one level with no "Use <name>" row — `current` is

      Decided 2026-09-08: no. The root is the tree, not a category -- a top-level node is committed by drilling into it or by picking it out of search, exactly like every other parent.
  null there — so the 21 top-level categories can only be committed by drilling
  in first or by picking them out of search. Decide whether the roots get one.

### Renaming the store handle threw "Store reset while query was in flight" — 2026-09-05

Confirming a new handle on `Settings > Domains` renamed the shop and then put an
Apollo invariant on the screen, attributed to `store/layout.tsx` rather than to
the pane that caused it. The pane set the active slug and then refetched
`GET_MY_SHOPS`; `ShopCacheBoundary` watches that slug and answers it with
`clearStore()`, which cancels every fetch still in the link chain by rejecting
it with error 91. So the clear killed the refetch the same handler had just
started — and because `GET_MY_SHOPS` is a live `useSuspenseQuery` in
`DashboardShell`, the rejection was thrown during render, above the pane's own
`catch`.

The refetch now runs first and is awaited, so nothing is in flight when the
boundary clears. `myShops` is guarded by `JwtAuthGuard` alone and reads no
`X-SHOP`, so running it under the old handle is exact, and its result is on
screen before the store is emptied behind it. It carries its own `catch`: the
rename has already committed by that point, so a failed list refresh must not
raise an error toast or strand the vendor on a route that no longer exists.

- [x] The same race is still reachable from the header's store switcher —

      Done 2026-09-08: a counting link tracks in-flight operations, useSwitchShop waits for idle (capped, and skipped when nothing is in flight) before writing the store, and the boundary turns a cancel into a re-render rather than an error page.
  `clearStore()` rejects whatever the screen being left had in flight. Nothing
  reproduces it yet, but the boundary has no defence against it.

### "Add product" opens a kind picker, like the coupon type dialog — 2026-08-25

"Add product" was a bare link to `/products/new`, which meant every product —
a download, a service, a t-shirt with four sizes — started on the same physical
simple-product form and the merchant had to undo the parts that did not apply.
It now opens `CreateProductDialog`, the same shape as `CreateCouponDialog`:
four rows (simple / with options / digital / service), each pushing
`/products/new?kind=` and prefetching that route on hover. The create route
parses the param and `productFormDefaults(kind)` seeds from it — `DIGITAL` and
`SERVICE` drop `requires_shipping` and `track_quantity`, `DIGITAL` also sets
`is_digital`.

The one kind that is *not* seeded is `VARIABLE`: the type is derived from
committed option axes by `useVariantOptions.syncFormVariations`, and the server
rejects a VARIABLE product with no variations, so declaring it up front would
let a merchant save something invalid. That choice passes `startWithAxis`
instead, opening the form on one blank option axis; the type flips itself once
the axis is committed. The products empty state got the same dialog — its
"Add product" button previously did nothing at all.

- [x] The empty state and header now render two `CreateProductDialog`
      instances; if a third call site appears, lift the trigger into a shared
      `AddProductButton` rather than repeating the trigger markup.

      Done 2026-09-08: lifted into AddProductButton, which both call sites render.
- [x] `?kind=` is dropped the moment the merchant edits anything — a reload of
      the create form re-seeds from the URL and discards their draft. Worth a
      `sessionStorage` draft the way `signup-wizard` does it.

      Done 2026-09-08: a sessionStorage draft keyed by shop, restored after hydration with the written-out disable the signup wizard uses. A corrupt or hand-edited entry reads as absent.
- [x] The dialog is hardcoded English, matching `ProductsHeader` and
      `CreateCouponDialog`. Both need moving to next-intl together.

      Done 2026-09-08: both, plus the coupon dialog -- a new coupons namespace, and PRODUCT_KIND_META and COUPON_TYPE_META lost their English strings so the metadata is order and icon only.

### Signup frame + code sign-in screen — shipped 2026-08-11, follow-ups below

`/register` now fills exactly one viewport on desktop: a pane taller than the card scrolls inside the card instead of the whole page sliding, the rail spreads down the full height beside a wide card with the form a narrow measure centred in it, and below `lg` the rail becomes a horizontal stepper above the card with the small print and the way out on the ground. `/verify-otp` moved out of the `(auth)` group onto the same ground through the new `SignupPanelShell` — white card beside a plum panel — so the signup card's "sign in with a code" no longer hands the vendor to a second design language. Docs: `apps/vendor/docs/features/signup.md`, `apps/vendor/docs/features/auth.md`.

- [x] `FieldSeparator`'s label pill is `bg-card`, but the `AuthShell` card it sits on is a hardcoded `bg-white`. They agree only in the light theme — with `.dark` on `<html>` the "Or" becomes a dark box on a white card. Either tokenize the card or make the entry screens' separator explicitly white.

      Done 2026-09-08: neither of the two options -- the auth card is a .light island instead. The dark variant stops at it and the light palette re-declares on it, so every token-styled control on the card stays light under a dark <html>, not only this pill.

### Press-depth — folded into `Button` 2026-08-04, removed 2026-09-06

Reversing the same-day revert below, `Button` is the press-depth control again and the standalone `PressDepth` component is gone. What is different this time:

- The 2026-07-31 attempt died because the `default` face is `--primary` (`#202223`) and a ledge mixed *darker* than it was invisible. The ledge is now an explicit per-theme token (`--btn-ledge-solid` lightens under the near-black light-mode primary and darkens under the near-white dark-mode one), backed by `--btn-sheen-*`, the top highlight that fades on the way down — on a near-black face the sheen, not the ledge, is what sells the press.
- The ledge is a `box-shadow` on a single DOM node, so `render`/refs/native props still work and nothing on the page shifted. Travel uses the independent `translate` property so existing `active:scale-95` call sites compose instead of being clobbered.
- `size` sets `--btn-rise`, `variant` sets `--btn-depth` from it — two variables, so a flat variant and a size can never fight. `ghost` and `link` stay flat by design.
- `usePressDepth` moved back to `src/hooks/use-press-depth.ts` and its render-phase ref write is fixed (now in an effect). `--duration-press` / `--ease-press` are back in `tokens.css` as a `linear()` curve sampled from the spring.

- [x] **Press-depth has no test coverage.** Moot — the press was removed 2026-09-06, and a flat button needs none.

  Original:  The 24 tests deleted in the revert were never replaced. The window-level pointer tracking (drag off / drag back / `pointercancel` / tab hidden) and the `enabled: false` path for `ghost`/`link` are the parts worth covering.
- [x] **Never seen in a browser beyond the login screen.** Moot — removed 2026-09-06.

  Original:  Verified by production build and by eye on `/login`; the dense surfaces (products/orders tables, toolbars, dialogs) have not been looked at. Same gap as the trackball shaders and the pixel canvas above; one Playwright screenshot pass would close all three.
- [x] **`buttonVariants` string consumers press via `:active`, not the hook.** Fixed by removal — the `press` variant is gone and `calendar` takes the plain class string.

  Original:  `calendar`'s nav buttons get the `press: "css"` fallback, so they stay latched if the pointer is dragged off. Harmless today; worth knowing if another consumer appears.
- [x] **`linear()` easing has no fallback.** Moot — `--duration-press` / `--ease-press` are deleted.

  Original:  Chrome 113+ / Safari 17.2+ / Firefox 112+ only; older browsers drop the declaration and fall back to `ease`. Acceptable, not verified.

### Checkout knows fulfillment feasibility (Phase 3) — shipped 2026-08-21

`checkout.verify()` now runs the allocation engine over the lines that survive
the catalogue checks, and `CheckoutVerifyEntry` carries a `fulfillment` block:
`feasible`, `location_count`, `requires_split`. Anything the engine cannot place
joins `unavailable_products` with the new reason `unfulfillable_online`, so the
storefront renders it through machinery it already has.

The point is the distinction the old check could not make. `product.quantity` is
a SUM of `available` across the shop's online-fulfilling locations, so four
units spread one-per-location satisfy a request for four **and are still
unshippable** once `MAX_SPLITS` applies. Availability is now fulfillment
feasibility, not a stock total.

Two deliberate exemptions. Untracked and oversell lines are never shown to the
engine — a vendor who ticked `continue_selling_when_out_of_stock` has said the
order may be taken with an empty shelf, and letting the engine veto that would
silently revoke it. And the response exposes **no location ids or names**:
`verifyCheckout` is `OptionalJwtGuard` and reachable anonymously, so warehouse
topology stays server-side.

3961 tests / 237 suites green (6 new checkout cases), zero new lint or typecheck
errors, `schema:check` and `check:di` clean, all three apps re-codegen'd and
typechecking.

### Shipping charged on digital-only orders — fixed 2026-08-22

Seen on live: a cart holding one digital course quotes `subtotal 199`,
`discount 0`, `total 399`. The missing 200 is a shipping fee charged on an order
with nothing to ship.

`computeShippingFeeCents` (`shipping/shipping-fee.helper.ts`) returns
`amount_cents` unconditionally for a `fixed` rule — it is never asked whether
anything on the order actually ships. Both call sites build their shop entry for
every shop regardless: in `checkout.service.ts` and in `orders.service.ts` the
`requires_shipping === false` check `continue`s only *after* the subtotal has
been recorded, so it skips the weight tally and nothing else. Quote and charge
agree, because both are wrong in the same way.

The storefront makes it invisible rather than causing it: `cartNeedsShipping`
correctly hides the shipping row for a digital cart, so the fee lands in the
total with no line explaining it. That part is right — the row should not be
shown for an order with nothing to ship.

**Confirmed against live data before fixing.** `UI Design Course` is
`product_type = DIGITAL`, `is_digital = true`, `requires_shipping = TRUE`, and
the shop holds a `fixed` rule of `amount_cents = 20000` — SAR 200, exactly the
gap in the screenshot.

Fixed with `lineShips` / `anyLineShips` beside `computeShippingFeeCents`, shared
by both call sites for the same reason the fee formula is shared. **The
predicate keys on `product_type === 'DIGITAL'`, not on `is_digital`** — the
schema says explicitly that a digital product can still be physical (boxed
software), so keying on `is_digital` would stop charging for a real parcel.
Absent `requires_shipping` reads as `true`, matching the column default; the
first version read it as falsy and five existing fee tests caught it
immediately.

A digital-only order now quotes `shipping_fee_cents: 0` with
`shipping_available: true` — there is nothing to ship, which is not the same as
"we cannot ship there", and reporting it as unavailable would block the
purchase.

One existing test had encoded the bug: it held a single `requires_shipping:
false` item yet expected a `weight_based` base fee, with a comment describing a
second item its fixture never had. Rewritten as the mixed order it claimed to be.

---

# Closed out — moved from TODO.md on 2026-09-14

152 completed items, lifted out of the active backlog so it holds only
open work. The prose is kept rather than deleted because most of these say *why*
the code looks the way it does — several record a premise that turned out to be
false, which is the kind of thing that gets rediscovered expensively.

Grouped by the area and the entry they sat under.

## Vendor dashboard

### The onboarding tiles are the buttons now (2026-09-14)

The dashboard home's five setup cards each ended in an outline CTA that
repeated the heading above it, and four of the five were inert — only "Add
product" was wired to anything. The buttons are gone: the title carries the
real `<a>`/`<button>` and `after:absolute after:inset-0` stretches its hit
area over the whole card, so a tile is one click target, one tab stop and one
accessible name. Payments, design, name and domain now go to their settings
routes; the product tile drives `CreateProductDialog` in controlled mode, so
it still lands on the kind picker rather than the bare form. The artwork is
`pointer-events-none` because a Z-translated illustration paints above the
stretched pseudo-element no matter what the z-index says.

The same pass swapped the hand-drawn brand marks for the real assets —
`public/payment-{visa,mastercard,paypal}.svg` fill their mini cards edge to
edge, and `public/name-tag-sticker.png` replaced the CSS name tag.

- [x] `home.tasks.*.cta` is unused in `en.json`/`ar.json` — dropped.
      Deleted the `home.tasks.*.cta` strings from the vendor's en/ar
      catalogues. The dashboard home's onboarding tiles used to end in an
      outline CTA button; the tile title became the link and the buttons went
      away, but the six button labels stayed behind in both message files.
      Nothing read them — `dashboard-home.tsx` resolves only `.badge`,
      `.title` and `.desc` — so they were twelve lines of dead copy that a
      translator would keep maintaining. Note the backlog said five tiles;
      there are six groups, and all six carried a `cta`.
- [x] "Choose your store design" now points at the theme editor.
      The dashboard home's "Choose your store design" tile sent new merchants
      to brand settings, with a comment explaining that the app shipped no
      theme picker to send them to. It ships one now — `features/theme-editor`
      plus the `/online-store/{themes,editor}` routes — so the tile goes to
      the themes screen, which is what its "Choose theme" copy promised all
      along, and the same route the sidebar's Online Store group uses. The
      comment describing the old state is gone; a comment about a state that
      stopped being true is worse than no comment. The tile has no completion
      predicate to revisit — no OnboardCard renders a done state, the only
      per-tile flag is `hasBadge`, which customDomain alone uses.

### A domain whose DNS cannot be read still gets its records (2026-09-14)

Found by connecting a real domain bought sixteen minutes earlier. The setup
screen printed "We could not read the DNS … check that the domain is
registered" and stopped there — no records, no instructions — while the same
domain in Shopify showed the full table and named GoDaddy. The reading was
correct: all three `.xyz` registry servers, both public resolvers, and
`ns35.domaincontrol.com` itself returned NXDOMAIN, because a registration is
unreadable for its first hour or so while the registry publishes the
delegation. Shopify was not reading DNS at all — it had the nameservers from
the registrar, which RDAP returns for a domain public DNS cannot resolve.

The dead-end was ours and it was a choice, not a limitation: `required` comes
from `platformRoutingRecords`, a pure function of the hostname, so what the
domain needs was known the whole time. `DomainDnsDiffService.compare` now emits
every required record as an `ADD` with a null `current_value` instead of
returning an empty diff, `satisfied` is held false by the unreadability itself
rather than by the absence of edits, and the pane renders the note *above*
`DnsDiffSections` rather than instead of it. The proxied case still empties the
diff, for the opposite reason — there DNS answers, and the answer is not the
merchant's.

- [x] **Name the DNS provider from the registrar when DNS cannot answer (`BE`)**
      **RDAP fallback when a zone will not resolve.** A domain connected
      sixteen minutes after being bought NXDOMAINs at all three registry
      servers, both public resolvers and the registrar's own nameserver,
      because the registration is unreadable for its first hour while the
      registry publishes the delegation. `DnsProviderDetectorService` is pure
      string matching over a nameserver list, and `DnsInspectorService` hands
      it `[]` for an unreadable zone — so the one moment a merchant most needs
      to be told "open GoDaddy" was the moment we named nobody, while Shopify
      showed the full record table and named the registrar. It was not reading
      DNS: it had the nameservers from the registrar, which RDAP returns for a
      domain public DNS cannot resolve. `RdapLookupService` now reads
      `nameservers[].ldhName` from `rdap.org/domain/<apex>` behind a
      four-second `AbortSignal.timeout`, gated in `configuration()` on the
      live nameserver list being empty so the ordinary path makes no outbound
      call. Every failure — timeout, non-200, an unexpected body — returns
      `[]`, which is the `UNKNOWN` the screen showed before, so rdap.org being
      down is no regression. It is injected `@Optional()` so the existing
      service spec keeps compiling and stays offline.

### Domains screen rebuilt to the reference design (2026-09-13)

- [x] **"Buy new domain" is a dialog of registrar links, not a purchase (`VEN` · `BE`)**
      Shipped, and the entry was stale. `buy-domain-dialog.tsx` lists Cloudflare
      Registrar, GoDaddy and Namecheap as plain outbound links and hands back to
      the connect dialog through an `onConnect` prop; `domains-pane.tsx` wires it
      as the header's primary action. Its own docblock states the reason — the
      platform does not sell domains, so the button opens this rather than a
      checkout. A real purchase flow still needs a registrar API and a billing
      decision, and that is not what this item asked for.
- [x] **The platform subdomain has no detail page and primacy cannot be handed back to it (`VEN` · `BE`)**
      Both halves shipped. `clearPrimaryShopDomain` takes **no argument** — the
      address it promotes has no row to name, and clearing every custom
      `is_primary` is the same end state, since "no primary row" has always
      meant "the platform address is the shop's address". Idempotent, and
      deliberately not a not-found when nothing was primary: the caller asserts
      an end state, so refusing because it was already true would fail a retry
      after a timeout. No status check either, unlike promotion — demoting a
      domain that stopped serving is exactly what a merchant wants to do about
      it.
      `PLATFORM_DOMAIN_ID` gives the address a URL without giving it a row, and
      `PlatformDomainPane` is a separate screen rather than a branch inside
      `DomainDetailPane`: that one is six hundred lines about DNS the merchant
      has to edit, and nobody points `<slug>.<root>` anywhere, so every record
      table and Verify button on it would be an empty box. Its status pill reads
      the *storefront* rather than DNS, and says why in words.
      The row's `id` now gates **deletion alone**, which is the one thing a
      missing row genuinely rules out.
- [x] **"Help set up domain" and "Learn more" close the overlay to reach the assistant (`VEN`)**
      Closed 2026-09-14. The panel opens **over** the settings overlay now, so
      neither action has to shut the screen it is offering help with.
      The scoping note was right that this is not a z-index bump, and that is
      the whole point: the panel was `absolute inset-y-0 end-0 z-20` inside the
      dashboard's content column and the overlay is `fixed … z-40` above it —
      an absolute child cannot paint over a fixed element mounted outside its
      column whatever number it carries. On a `settings/**` path the panel now
      switches to `fixed end-0 bottom-0 top-(--header-height) z-45`, the same
      band the overlay uses so nothing moves visually, and everywhere else its
      classes are untouched — being in flow beside the content is the point of
      it there.
      The trigger is read off the pathname rather than a flag the shell raises
      on mount: a flag written in an effect lands one commit late, which would
      flash the panel underneath the sheet on every navigation into settings.
      The overlay's Escape handler took a third bail so one press no longer
      closes the panel and the screen behind it together, and `learnMore()` in
      `domains-pane.tsx` lost its `router.push` — the same bug `help()` had,
      on the other button.
- [x] **"Domain is live" has no per-resolver grid (`BE` · `VEN`)**
      `DnsSnapshot.propagation` is populated and exposed as
      `ShopDomainConfiguration.propagation`, and `ResolverGrid` draws a row per
      resolver under the live step — open without a click while propagation is
      what is being waited on, folded otherwise. Two distinctions are the whole
      value of it: silence is `agrees: null` and never `false`, because the
      advice for a timeout ("nothing to do") is the opposite of the advice for a
      conflict ("wait"); and agreement is **corroboration** rather than a
      comparison against a chosen reference, so two resolvers that disagree are
      both uncorroborated instead of the first being named the winner on no
      evidence.
      *(The "alias is a reading, not a choice" item that used to sit here is
      the same gap as "Shopify's primary/alias/redirect triple" under
      Storefront, and both need the one `clearPrimaryShopDomain` mutation; it
      is tracked there once.)*
      *(The "no re-check for an ACTIVE domain" item that used to sit here is
      the same one filed under Storefront → Primary domain redirects; it is
      tracked there once, not twice.)*

## Storefront

### The header wears the hero, then puts its ground back on — 2026-09-14

The notch bar has two skins again. Transparent slabs and white ink on the shop
home above the fold, the solid notch everywhere else and on the home route from
the first scroll. The skin is five CSS lines: `NotchNav` stamps
`data-notch-floating` and `globals.css` re-declares the five `--shop-notch-*`
tokens under it, which reaches the slab fill, the fillet wings, the hairline,
the sliding pill and every control's ink at once — the reason that bar was
built on tokens in the first place. `ShopShell` now skips the 4rem reservation
on that one route so the photograph starts at the top edge, which reinstates
the exception `useShopChrome` used to manage; both halves read one shared
`isShopHome(pathname, base)` so they cannot disagree.

- [x] The floating skin assumed the hero was dark enough for white ink.
      Moot as of 2026-09-14: the skin is gone. `data-notch-floating` appears
      nowhere in `apps/storefront/src`, so there is no transparent variant left
      to become unreadable over a bright cover.
- [x] The skin swap has no test because there is no skin swap. `isShopHome`
      is gone from the whole app, along with `shop/lib/home-route.ts` and
      `shared/lib/use-scrolled.ts`; `notch-nav.tsx` carries only
      `data-notch-outline`. Removed by `98e6a59b` (the Zaydak nav pass), which
      is also why the hero no longer reserves 4rem for a floating bar.
- [x] The kicker chip crowding the centre slab on a short viewport is moot:
      `HomeHero` has no kicker. `grep kicker` over the component returns
      nothing, and the hero is now a single centred name over a full-bleed
      photograph.

### The shop home leads with a full-height cover — 2026-09-14

- [x] The coverless fallback is **one stock photo shared by every shop that
      The coverless hero fallback is no longer one photograph shared by every
      shop. It is still one file in `public/` — that part is deliberate, since
      it is the LCP image on every storefront that has not set a cover and
      serving it from our own origin is the whole reason it is bundled — but
      it is now dressed per shop from the slug: one of six dark directional
      colour grades painted under the scrim, and one of five crop centres fed
      to `object-position`. Thirty openings out of a single download. Before
      this, every shop's first day looked like every other shop's first day,
      which is a visible repeat the moment the directory holds more than a
      handful of stores. Grading alone was tried first and was not enough on
      its own: it recolours the picture but leaves the composition identical,
      and the composition is what a shopper recognises after seeing two
      storefronts in one session. The crop is what makes them read as
      different photographs. Both picks come off different digits of one
      FNV-1a hash of the slug, so they vary independently, and both are a pure
      function of the slug because this is server-rendered and then hydrated —
      anything random or time-based would be a hydration mismatch on the
      largest paint on the page. The obvious alternative, deriving the
      backdrop from the shop's own brand, is closed and should not be retried
      without a schema change: `SHOP_BY_SLUG` selects `logo` and `cover_image`
      but no brand colour, the colours reach the page only as CSS from
      `brandThemeCss`, and a shop that published none falls through to the
      platform teal — so keying on the accent would give every new shop the
      same opening again, which is the bug. The logo is in the query but is
      not usable either: its ink is unknown, and a dark mark needs a lighter
      scrim, which is exactly the readability failure the manufactured
      contrast exists to prevent. A shop's own cover is never graded or
      re-cropped. That crop and that exposure are the vendor's choices, and
      changing them is us editing their picture.
- [x] A render test pins the hero's two paths (cover present vs. fallback).
      Pinned the shop home hero with a render test. `home-hero.tsx` is the LCP
      element on every storefront and quietly serves two data shapes through
      one treatment: the shop's own `cover_image`, and the bundled
      `HERO_FALLBACK` in `public/` for a shop that has not uploaded one.
      Nothing covered either. The no-cover path is what a shop looks like on
      its first day and is invisible in a screenshot of the other, so a
      fallback that stopped rendering would have left an empty black band on
      exactly the shops nobody screenshots. The test also pins the accessible
      name: the photograph is deliberately `alt=""` (it is the ground, not
      information), so the shop name reaches a screen reader through the
      `<h1>` alone — an overlay restructured into something that is not a
      heading would look unchanged and announce nothing. Six cases: cover src,
      `/`-rooted fallback, exactly one `<img>` on either path (the fallback
      substitutes for the cover rather than sitting under it), decorative alt,
      the name as a level-1 heading, and the slug standing in before the shop
      query resolves. `useShop` and `next/image` are stubbed the way
      `shop-footer` and `product-gallery` already stub them; no component
      change was needed.

### Zaydak homepage finish — rail, story, values — 2026-09-13

Product rails, section headings, the shop story panel and the values row now
use the Day 1 type scale (`text-shop-title` / `text-shop-body`) and the
Sand/Charcoal/Teal tokens. Scroll/RTL rail logic, GraphQL, `hasStory()` gating
and the four platform-true value notes are unchanged.

- [x] Homepage empty/skeleton and the catalogue browse surfaces still wait
      for the Day 4 identity pass.

### Zaydak storefront identity — teal palette, Tajawal, Arabic copy — 2026-09-12

Light-mode tokens now use the delivered logo palette (Sand ground, Charcoal
ink, Teal as the one commerce accent). Arabic swaps to Tajawal via
`next/font/google` under `html[lang="ar"]`; vendor and admin keep Thmanyah
from `@repo/fonts` on purpose. Homepage / header / footer copy is written for
an Arabic shopper, and root metadata is locale-aware (`Zaydak` / `زايدك`).
The four high-visibility components were restyled in place — same props, same
GraphQL, same interactions.

- [x] Storefront dark mode is deleted, not retuned.
      Decided 2026-09-14 and done. Nothing could reach it: no `next-themes`, no
      `prefers-color-scheme`, nothing putting the class on `<html>`, and
      `toaster.tsx` hardcodes `theme="light"`. 67 lines of `.dark` tokens went,
      with the eight inert `dark:` utilities across six components.
      **Two corrections to what this entry used to claim**, both found on the way
      in. The palette was *not* still the warm-paper set — somebody had already
      retuned it to the Deep Teal / Sand reading of the logo package, leaving
      only four strays. And the feature was not CSS-only; it had tendrils in
      components. So what was deleted was recent, on-brand work, and it is worth
      reading out of git history before anyone rewrites it.
      The `dark` variant itself stays in `@repo/ui`'s `tokens.css` — it is
      shared, and both consoles genuinely use it.
- [x] The directory `/` cloud-shader hero and its hardcoded sky copy were
      The marketplace directory hero at `/` is on the Zaydak identity. It was
      the last surface still wearing the Aceternity demo it arrived as —
      English fintech copy, a blue sky, two dead `href="#"` buttons and a
      screenshot of somebody else's dashboard pulled from
      `assets.aceternity.com` — which made the first page a visitor sees on
      the apex the only one the storefront identity pass had missed. The sky
      is now the palette's own, the type is the Day 1 scale on the
      `--shop-photo-*` family (a shader sky is a picture, so its type is
      coloured against the picture and not against whichever ground the page
      has), the copy is real and translated under the `landing` namespace, and
      the one action is a live anchor to the `#shops` list below. The sky
      colours are literal hexes rather than tokens on purpose: `CloudShader`'s
      `parseHex` reads `#hex` and a bare `rgb()` list and silently returns a
      near-white guess for anything else, so an `oklch()` or `color-mix()`
      token would have painted the wrong sky with nothing to report it.
      `packages/ui`'s `DitherField` solves that with a resolver; growing one
      for a single call site was not worth it, and the trade is that a re-tune
      of the tokens does not reach these three values.
- [x] `@repo/fonts` is now dead in **all three** apps, not just this one —
      vendor and admin moved to Tajawal on 2026-09-13 and dropped the
      `fonts.css` import, so nothing anywhere renders a Thmanyah face.
      Swept: three `sync-fonts` scripts with their `predev`/`prebuild` hooks,
      the turbo task and both `dependsOn` entries, and the dependency in three
      `package.json`s, lockfile moved. `packages/fonts` stays — it holds the
      licence PDFs, and the faces are paid for.
      **There was more of it than the entry knew.** `.gitignore` claimed the 15
      faces live "ONCE" in `packages/fonts/assets`, and that was untrue the
      whole time: gitignore does not untrack a file that is already tracked, so
      admin and storefront each went on carrying a committed 1.2MB copy after
      the pattern was added. Both untracked now, and the storefront's deleted
      outright — nothing there regenerates or references them. The pattern
      stays as a guard against a stray copy being committed again, with a
      comment that describes what it does rather than what it was assumed to.
- [x] Deep Teal `#032B2B` is in use, so the note is spent.
      `cloud-shader-hero.tsx` paints it as the top of the directory hero. The
      `.dark` block that also used it is gone (below).

### Primary domain redirects — the serve-or-redirect engine (2026-09-13)

`is_primary` used to decide only which address canonical URLs were built from,
so a shop with a promoted custom domain went on serving a full second copy of
itself at its platform subdomain. Now one back-end method,
`ShopDomainsService.resolveDomainRequest(hostname)`, turns any address a shop
answers at into a verdict — whose shop, what part the address plays
(`PLATFORM` / `PRIMARY` / `ALIAS`), serve or redirect — and the storefront proxy
executes it with a 308, path and query intact. The role is **derived**, so there
is nothing to migrate and nothing that can drift from the row.

Tenant resolution stayed pure: `resolveTenant` still reads the shop out of the
host string, and only the redirect decision is looked up, only in the proxy.
The RSC tree never asks.

A `REDIRECT` verdict is **never cached**, anywhere. At most one domain is
primary at a time, so a consistent read cannot point two hostnames at each
other; every possible loop came from two stale answers disagreeing across
instances. Shortening a TTL would have made that rarer, and "rare" is the wrong
property for the one failure here that shows the visitor a blank page.

The adversarial review raised 30 findings and confirmed 14. The one that
mattered most was not in the new code: **a custom domain only ever resolved at
`/`.** `resolveTenant` falls back to reading the shop out of the first path
segment, so the verdict gate — inherited unchanged from the lookup this replaced
— skipped every path except the home page. `nike.com/products/mug` was served as
a shop called `products` (404) and `nike.com/beta/checkout` as somebody else's
storefront. Latent since custom domains shipped, and the redirect engine would
have turned it into an outage by pointing all traffic at the broken address.

**A merchant's domain also had to become a CORS origin.** `CORS_ORIGINS` holds
hosts under a domain the platform controls; `nike.com` arrives by a form
submission, so the only static entry covering it would be "any domain at all".
`main.ts` now checks the static list first and falls through to
`ShopDomainsService.isTrustedOrigin` — `https:`, no port, and a hostname that
resolves through the same verdict path as everything else, so one invalidation
covers both. It fails closed. Without it a custom domain rendered every page
(server-side, no `Origin` sent) and failed every browser call — cart, checkout,
account, sign-in — with no status code and nothing in the server log.

A post-merge evaluation (30 findings, 9 confirmed) caught one bug in this work:
**the live Verify path never invalidated the verdict cache.** The invalidation
had been put on `ShopDomainsService.verify()`, which has the same job and no
caller — the resolver goes through `configuration({persist: true})`. So the one
mutation that flips a domain to ACTIVE was the only write that left the cache
stale: the merchant fixed their DNS, pressed Verify, and their hostname went on
resolving to "no shop here" for the rest of the TTL, with CORS refusing its own
browser calls. Fixed in `persistState`, which is the write.

- [x] **`ShopDomainsService.verify()` is dead code (`BE`)**
      Deleted, along with its tests. Two methods that must agree about a side
      effect is the shape that produced the invalidation bug, so correcting the
      one nobody ran was never the fix. The behaviour it asserted moved onto
      `configuration({persist: true})`, which is the write the resolver runs —
      including the tenant-isolation case, which had been pinned on the dead
      method.
- [x] **`ShopDomainStatus.FAILED` is never written (`BE` · `VEN`)**
      `sweepStalledDomains` writes it, on the same nightly job as the active
      sweep: a `VERIFYING` row carrying a `last_error` that has not been known
      good for 14 days. Each condition rules out a case that must not be
      caught — `PENDING` is a task not started rather than one that failed, and
      the clock is read from `verified_at ?? created_at` rather than
      `updated_at`, because this sweep *writes* `updated_at` and would
      otherwise reset its own clock every night.
      Two consequences worth knowing. `verified_at` stopped being cleared on a
      failed check: it used to be a second copy of "is this serving right now",
      which `status` already answers, and clearing it erased the only thing that
      tells a domain mid-setup from one that worked for a year and broke last
      night. And `FAILED` is **not terminal** despite the name — `persistState`
      writes whatever the provider says and never reads the old status, so
      fixing the DNS and pressing Verify is the whole recovery path.
- [x] **An ACTIVE domain has no manual re-check (`VEN`)**
      The button is on screen for every status now, and its wording moves with
      it: "I updated DNS records" while the row is not yet ACTIVE, "Check again"
      once it is. The claim mattered as much as the gate — "I updated DNS
      records" is a statement about something the merchant just did, and on a
      domain they have not touched in months it is a question they cannot
      answer.
- [x] **Warnings are hidden inside the collapsed instructions panel (`VEN`)**
      **Already fixed, and the entry was stale.** The panel is `DomainSteps`
      rather than `DomainChecklist`, the warnings render in both the
      instructions and the report, and the done step initialises
      `defaultOpen: hasWarnings` — so a warning is never folded away on the
      pass where it is the only thing to read.
- [x] **"Redirects to X" is asserted from `!is_primary` alone (`VEN`)**
      **Already fixed, and the entry was stale.** `domainTypeOf` reads the whole
      list and requires a row that is `CUSTOM`, primary *and* ACTIVE before it
      says "redirects"; otherwise the address serves alongside the primary. Two
      render tests pin both directions.
- [x] **The proxy warning names a value the screen does not show (`VEN`)**
      The sentence states the value outright instead of gesturing at a table
      that is empty by design. `proxyWarningParams` puts the host's required
      routing record into `params.required_value` and into the message, and
      `dns-warnings.ts` is now actually called — it had been written with no
      caller at all.
- [x] **A failed configuration query renders an empty card (`VEN`)**
      **Already fixed, and the entry was stale.** The pane reads `error` and
      renders a message with a Try-again that refetches; "explains a failed
      reading and offers to try again" pins it.
- [x] **The vendor app re-derives the platform address from its own env (`VEN`)**
      The server's own platform row is the authority everywhere on the screen —
      the banner, every View link, the change-handle card, its illustration and
      the handle preview inside the dialog all read the apex through
      `platformRootFrom`. The row's *presence* answers whether host mode is on
      (the back-end omits it when it has no apex) and its hostname answers at
      what address, so there is nothing left to guess.
      `NEXT_PUBLIC_ROOT_DOMAIN` survives only as the placeholder before the list
      answers.
- [x] **`VercelDomainProvider` fetches values it never reads (`BE`)**
      It reads them now, in both shapes Vercel returns, falling back to the
      shared `platform-dns-targets.ts` when it answers neither. **Worse than
      staleness, as it turned out:** the misconfigured branch returned only the
      ownership challenge, `DomainDnsDiffService` treats the provider's records
      as the whole requirement, and an empty requirement has nothing to add or
      change — so `dns_configured` reported *satisfied* for a zone pointing
      nowhere and the setup screen offered no instructions at all.
- [x] **`CACHE_MANAGER` is not Redis (`BE` · `INFRA`)**
      `RedisModule` passes cache-manager v5's singular `store:` option;
      `@nestjs/cache-manager` v3 reads `stores:` and silently falls back to an
      in-memory store. So every cache in the repo — lookups, cities,
      permissions, user-metrics and now domain verdicts — is per-process, and
      invalidation only clears the instance that handled the mutation. The fix
      is `stores: [new Keyv({ store: new KeyvRedis(url) })]` via `@keyv/redis`,
      replacing `cache-manager-ioredis-yet`. Held back deliberately: it changes
      caching for four other features and touches the Redis boot path that has
      already taken production down once.
      **Confirmed against the installed library on 2026-09-14, not inferred.**
      `@nestjs/cache-manager@3.1.0`'s
      `dist/cache.providers.js:41-55` reads `options.stores` and nothing else;
      with it undefined the else-branch calls `createCache({ttl, refreshThreshold,
      nonBlocking})` — no store, so the memory default. Consumers are exactly
      four services plus the constants file.
      **A second cost nobody had noticed, now fixed:** `await redisStore(...)`
      *ran*. `cache-manager-ioredis-yet/dist/index.js:114` constructs an ioredis
      client eagerly (`buildRedisOptions` sets no `lazyConnect`), the resulting
      store was then discarded, and because `stores` is undefined the module's
      own `onModuleDestroy` returns *before* disconnecting anything. Every boot
      therefore opened a Redis connection that nothing read and nothing closed —
      in the one module whose comments count connections down from 61 to 24.
      The dead option is removed and the factory is now a plain
      `CacheModule.register({ ttl })`. That change is **behaviour-preserving** —
      the cache was already memory before and after — which is why it was safe
      to do without a Redis to test against, and it is deliberately *not* the
      deferred change.
      **Closed 2026-09-14 — the cache is on Redis, verified against a real
      server.** `CacheModule.registerAsync` now builds
      `stores: [new Keyv({ store: new KeyvRedis(url), namespace: 'cache' })]`;
      `@keyv/redis` and `keyv` are direct dependencies and
      `buildRedisUrl(config)` derives the connection from the same options
      everything else uses, so the cache cannot end up pointed at a different
      server than BullMQ. `@keyv/redis` is built on `@redis/client`, not
      ioredis, so it cannot share `REDIS_CLIENT` and opens one connection of its
      own — the price of the cache being real. An `error` listener is attached
      because an unhandled `error` on a Keyv store is an unhandled exception,
      and Redis blinking must degrade the cache rather than kill the process.
      **Two things only a real Redis could have shown, both of which would have
      made the fix worse than the bug:**
      - un-namespaced, `KeyvRedis`'s iterator walks the **entire keyspace** —
        a probe returned twenty BullMQ `*:stalled-check` keys — so
        `invalidateCache` would SCAN all of Redis on every language change, one
        loose predicate away from deleting queue state;
      - and it **strips the first `:` segment** from every key
        (`lookups:en:global` arrives as `en:global`) while the in-memory store
        yields the whole key, so the prefix filter would have matched in tests
        and matched nothing in production — the invalidation bug fixed hours
        earlier, reintroduced through a different store.
      `namespace: 'cache'` fixes both: scoped iteration, and the same full
      logical key from either store. `redis.module.spec.ts` pins the contract —
      `stores` plural, an `iterator()` and no `keys()`, whole keys out — plus
      the uncomfortable one: a store-less cache still answers `get`/`set`
      perfectly, which is why the original defect was invisible for so long.
- [x] **`LookupsService.invalidateCache()` was a no-op (`T3` · `BE · lookups`)**
      Found 2026-09-14 while correcting the docs that claimed it cleared Redis.
      It guarded on `typeof store.keys === 'function'` and returned quietly
      otherwise — and `cache.stores[0]` is a `Keyv`, which has **no `keys()`**
      (verified by running `createCache()` and printing the store: ctor `Keyv`,
      `typeof store.keys` `undefined`). So the branch never ran. A shop that
      added or removed a language went on being served the old `lookups:` payload
      for the rest of the 1-hour TTL, with nothing logged and nothing failing.
      Now it walks `store.iterator()` — which Keyv does expose, and which
      `@keyv/redis` implements over SCAN, so it keeps working if the cache is
      ever pointed at Redis. Keys are collected before any delete (deleting
      mid-walk mutates the map being iterated), only `lookups:`/`cities:`
      prefixes are touched, and a store with neither capability now warns rather
      than returning in silence.
      **The test is the more interesting half.** It passed the whole time,
      because the cache mock handed `stores[0]` a `keys()` that the real store
      has never had — a mock asserting against a shape that does not exist, the
      same class of defect as the Prisma fixtures fixed on 2026-09-13. The mock
      now exposes `iterator()` and no `keys()`, which alone turns the old
      implementation red, and three tests pin the branches: iterator-based
      invalidation, other features' keys left alone, and the warn-not-silence
      path.
- [x] **`src/schema.gql` is stale (`BE`)**
      Regenerated. It needed no database and no boot — `npm run schema:generate`
      builds it from resolver metadata alone and has existed the whole time;
      what actually blocked it was that **`nest build` did not compile**, which
      is why the file could not be written. `domainRequest`, `ShopDomainRole`,
      `ShopDomainAction` and `role` are in, along with the new
      `ShopDnsWarning` / `ShopDnsPropagation` types.
- [x] **Canonical tags and sitemaps still name the platform subdomain (`STORE` · `SEO`)**
      **Already fixed, and the entry was stale.** `shared/lib/shop-hostname.ts`
      resolves a shop's primary hostname through `domainRequest` and exposes
      `canonicalShopBase(slug)`, which the shop layout, the product, catalogue
      and policy pages and *both* sitemaps already use — with tests. The read
      path stayed pure; only the write path looks anything up, and every failure
      returns null, which means "use the address `shopUrlBase` already built".
      Unlike the proxy's verdict cache a redirect target **is** cached here, and
      deliberately: there a stale answer is a `Location` header and two
      instances disagreeing can loop, while here it is a canonical tag naming
      the address the shop used five minutes ago — which is exactly what every
      page emitted before this existed.
- [x] **An unknown host serving a deep path still reads the shop from the URL (`STORE`)**
      **Already fixed, and the entry was stale.** `hostServesPathTenants` gates
      the path fallback to hosts that are demonstrably ours — the apex and
      anything under it, development and health-check hosts, and everything when
      no apex is configured at all — and `resolveTenant` returns `NO_TENANT`
      otherwise. `proxy.ts` applies the same gate, and "an unknown host names no
      shop" covers it.
- [x] **`STOREFRONT_ROOT_DOMAIN` unset lets a merchant connect a platform address (`BE`)**
      The refusal falls back to the hostname of `STOREFRONT_URL`, which the API
      already has to know for every link it emits. `rootDomain` keeps meaning
      exactly what it meant — the switch that turns host mode off and makes
      `list()` omit the platform row — and a separate `reservedRootDomain`
      answers the narrower question of what a merchant may not claim. Applied
      only when `STOREFRONT_URL` is genuinely set, so development, where it
      defaults to `localhost:3003`, still allows `anything.localhost`.
- [x] **Path mode never redirects — settled, not deferred (`STORE` · `SEO`)**
      **The apex never redirects, and that is the decision.** `zaydak.com/acme/…`
      keeps serving 200 because it is the marketplace's own browsing surface,
      and bouncing it would send every click in the shop directory off the
      marketplace. The canonical tag is what collapses it with the shop's own
      address for crawlers. Host mode is the opposite and does redirect: once a
      merchant promotes a custom domain, `acme.zaydak.com` and every alias 308
      to it, path and query intact. Recorded in the root `CLAUDE.md`. The
      www/apex pairing is a *different* question and stays open below.

### Custom domains — the four silent failures (2026-09-12)

- [x] **Warnings carry no severity (`BE` · `VEN`)**
      `warnings: [String]` renders every entry as the same amber box, so a CAA
      hard block and a "you may have the orange cloud on" caution look alike.
      A structured `{code, severity, message}` would also make them
      translatable — they are English prose from the server today.
- [x] **Cloudflare ranges are hardcoded (`BE` · `INFRA`)**
      Closed 2026-09-14. `ProxyRangeRefresherService` re-reads the three
      providers whose lists a machine can read — Cloudflare, Fastly, CloudFront
      — weekly on the existing `DOMAIN_SWEEP` queue through `registerScheduler`.
      Azure Front Door, Sucuri and Imperva are deliberately not fetched: their
      URLs are an HTML download page, a knowledge-base article and a
      credentialed endpoint. They keep `manuallyTranscribed: true` and are named
      under `uncovered` on every run, because a refresher reporting a bare
      success over a half-covered table is the same failure the floors exist to
      catch.
      Two floors: an absolute minimum, and a refusal of any list under half the
      size of the one it replaces — the second is what matters once a real list
      (much bigger than our transcription) is installed and half a parse would
      sail past the first.
      The find worth keeping: Cloudflare splits its list across `/ips-v4` and
      `/ips-v6`, so fetching `sourceUrl` alone would have installed fifteen IPv4
      entries, cleared the floor on them, and **deleted the seven IPv6 ranges** —
      a refresher retiring the addresses it exists to keep current.
      Not verified against live responses: outbound network is blocked here, so
      each parser is written to the documented format and fails closed on a
      shape it does not recognise. An install also lives in one process's
      memory, so a restart reverts to the shipped table — safe, since stale
      under-reports, and the reason the etag idea is not implemented.
- [x] **Only Cloudflare's proxy is detected (`BE`)**
      Fastly, CloudFront, Azure Front Door, Imperva, Sucuri and Bunny intercept
      the same way and publish ranges; Akamai does not. The table in
      `proxy-ranges.ts` takes one row each.
- [x] **A wildcard record pointing at us is undetected (`BE`)**
      Shopify documents it as a failure state. Detectable by resolving an
      unlikely label under the zone and seeing whether it answers.
- [x] **Shopify's primary/alias/redirect triple vs our `is_primary` boolean (`BE` · `VEN`)**
      Settled, and the three types are named without a second stored flag.
      `ShopDomainRole` (`PLATFORM` / `PRIMARY` / `ALIAS`) is **derived** from
      `is_primary` plus which address is the platform's, so there is nothing to
      migrate and nothing that can drift from the row; the dashboard's
      `domainTypeOf` reads the same three off the whole list, requiring a row
      that is `CUSTOM`, primary *and* ACTIVE before it says "redirects".
      What was missing was not a name but a **choice**: an alias was a reading
      and never a decision, because there was no way down from primary.
      `clearPrimaryShopDomain` is that way down, so the type dialog's
      `redirect` option is live for a primary custom domain instead of
      permanently disabled behind "make another domain primary first".

### Custom domains — DNS inspection and diff (2026-09-12)

- [x] **Domain target and type in the UI (`VEN`)**
      `DomainTargetCard` on `/settings/domains/[domainId]` (2026-09-13): "Target:
      Online Store / Type: Primary domain" or "Redirects to example.com", with
      Change opening the promotion confirm.
- [x] **Re-check domains that were active and stopped resolving (`BE`)**
      `sweepActiveDomains` runs nightly at 04:50 on its own `domain-sweep`
      queue, re-asking the provider about `ACTIVE` rows least-recently-checked
      first. **Two strikes before demoting**, and `last_error` is the strike: a
      healthy ACTIVE row carries `null`, so an ACTIVE row *with* an error is
      one whose previous check already failed — a resolver blip on a single
      nightly run must not take a working storefront off its own address.
      `is_primary` is left alone, because `primaryHostname` already requires
      ACTIVE, so links revert on their own and come back when the domain does.

### Custom merchant domains (2026-09-12)

- [x] **Redirect policy for a promoted primary domain (`STORE` · `SEO`)**
      Answered by the serve-or-redirect engine above: `nike.zaydak.com` **does**
      308 to `nike.com` once it is primary, and so does every alias.
      `proxy.ts` executes a `REDIRECT` verdict with the path and query intact.
- [x] **Admin visibility for custom domains (`ADM`)**
      `/shops/[shopId]/domains`, read-only. The back-end half is
      `adminShopDomains(shop_id)`, a separate resolver rather than an argument
      on `shopDomains`: every merchant operation is scoped by `X-SHOP` and takes
      no shop argument, which is exactly what makes it impossible to reach
      another shop's domains, and an optional `shop_id` would have put an
      overridable scope on the one surface whose safety comes from not having
      one. Gated on `manage_all_shops` **alone** — `PermissionsGuard` matches
      with `.some()`. Read-only on purpose: the DNS is in the merchant's
      registrar, and an admin moving where somebody else's shop answers would
      leave nothing on the merchant's screen to say why.
- [x] **Re-check domains that were active and stopped resolving (`BE`)**
      Shipped as the nightly `sweep-active-domains` job — see the same item
      under *DNS inspection and diff* above for the two-strike rule. A poller
      over `PENDING` rows was deliberately still not built.
- [x] **Surface `DOMAIN_*` codes in the i18n error catalogue (`BE`)**
      Not the intended contract — a gap, and a user-visible one. `formatError`
      renders `t(error_code, lang) || formattedError.message`, and `t` echoes the
      key back when it has no entry, so the fallback is dead code: all four
      missing codes reached merchants as the literal string
      `DOMAIN_ALREADY_CONNECTED`. See *Every error code now has a sentence*
      under Back-end & API.

### Multi-tenant domains — platform subdomains (2026-09-11)

- [x] **Decide the path-URL redirect policy (`STORE` · `SEO`)**
      Decided and documented: the apex keeps serving 200 and names the shop's
      own address in its canonical tag. See *Path mode never redirects* above.
- [x] **Custom merchant domains — Phase 2 (`STORE` · `BE` · `INFRA`)**
      Every part of this shipped and is verified in the tree (2026-09-13):
      the `ShopDomain` model, hostname→shop resolution with a cache and
      invalidation on every write that could change a verdict,
      `DomainProvider` with `ManualDomainProvider` as the default and
      `VercelDomainProvider` opt-in, the Settings → Domains verification UX,
      and the dynamic CORS allowlist — `main.ts` checks the static list first
      and falls through to `ShopDomainsService.isTrustedOrigin`, which fails
      closed. See the four entries above for what each part cost.
- [x] **Admin visibility for shop domains (`ADM`)**
      Closed by `/shops/[shopId]/domains` — see *Custom merchant domains* above.
      The detail route was the answer rather than a list column, because a shop
      holds several addresses with independent statuses.

## Admin console

### The money-units note in `CLAUDE.md` said the opposite of the code (2026-09-14)

`CLAUDE.md` told every reader that "money crosses the GraphQL boundary in
**major units**, not the integer storage", and named two fields as proof:
`WithdrawalEntry.amount` = `fromCents(cents)` and `CommissionEntry.commission` =
`bps / 100`. Neither field exists. `src/schema.gql` has
`WithdrawalEntry { amount_cents: Int! }` and
`CommissionEntry { commission_bps: Int!, min_balance_cents: Int!, max_balance_cents: Int }`
— integer cents and basis points, exactly what the database stores. The 2026-09-12
cents migration renamed both and the note was never updated, so the instruction
file has been telling agents and new joiners to expect a conversion the API stopped
doing. `apps/admin/src/shared/lib/format.ts` carried the same stale sentence in its
own header docblock.

The code had drifted in the direction the stale note implied. The analytics screen
was converted to named formatters and `CLAUDE.md` says plainly that "nothing divides
by 100 inline" — but the commissions screen divided by 100 in four places:
`commissions-table.tsx` rendering the rate, and three field seeds in
`commission-form-dialog.tsx`. Those are now `formatBps` for display and
`centsToMajor` / `bpsToPercent` for the form boundary, all in `format.ts` beside
`formatAmountCents`. The form pair is named rather than inlined for one specific
reason: its inverse on submit is `Math.round(values.commission * 100)`, and a
greppable name is what ties the two halves of that round trip together.

---

- [x] `apps/admin/src/features/plans/validations.ts` defined its own `fromCents`.
      Folded into `centsToMajor` 2026-09-14. The two had **not** drifted —
      both bodies were `cents / 100`, character for character — but that is
      luck rather than design, and `format.ts`'s own header says the scaling
      happens there and nowhere else. The five plans screens and the test read
      `centsToMajor` from `@/shared/lib/format` now; `toCents` stays in the
      plans module beside the zod refine that justifies its rounding.
      Three smaller shapes of the same thing came out of it:
- [x] `hasAtMostTwoDecimals` is no longer duplicated.
      It lived verbatim in both `features/plans/validations.ts` and
      `features/commissions/validations.ts`; it now lives once in
      `shared/lib/format.ts` beside `centsToMajor`, `toCents` and `bpsOf`, and
      both modules re-export it so their existing importers are untouched. A
      rule kept in four files is four rules waiting to diverge — and one of
      them already had (see the epsilon item below).
- [x] The commissions mutation goes through named converters.
      `Math.round(values.x * 100)` inline at three call sites became `toCents` /
      `bpsOf` from `@/shared/lib/format`, so the write boundary is greppable on
      both sides rather than only on the plans one.
- [x] The admin's `toCents` now rounds the way the server does.
      It was a bare `Math.round(major * 100)` against the back-end's nudge by
      `ROUNDING_EPSILON`, so `1.005` gave 100 here and 101 there — its float
      product is `100.49999999999999`. Unreachable through a form, because
      `hasAtMostTwoDecimals` rejects a third decimal first, but two answers to
      one money question should not stand on a guard somewhere else. Six tests
      pin the epsilon case, the negative, the non-finite input and the fact
      that the guard rejects it before any of it runs.

## Back-end & API

### DNS diff compares a name as a set, not as rows (2026-09-14)

- [x] **`routingSignature` reports a settled zone as mid-propagation (`BE`)**
      Deduped `routingSignature` in `dns-inspector.service.ts`: the signature
      two resolver readings are compared by is now a set, not a list. A public
      DNS answer is a set of resolved values, so one resolver answering [a,b]
      and another [a,a,b] have read the same routing — joined with the repeat
      they produced different signatures, both rows scored uncorroborated, and
      `agreement` came out PARTIAL on a settled zone. PARTIAL tells the
      merchant to wait for a propagation that already finished. The backlog
      predicted this would move three pinned inspector specs; it moved none.
      No existing spec fed a duplicate value to a resolver, so nothing was
      pinning the bug: the two agreement specs assert identical and genuinely
      disjoint answers (the second is now also the guard against an over-eager
      dedupe collapsing distinct values), and the IPv6 one pins
      canonicalisation, which is orthogonal. One new spec covers the case.
- [x] **`key()` normalises names less than `same()` normalises values (`BE`)**
      Made `key()` normalise a record name exactly as `compareKey` normalises
      a value — trimmed, single trailing dot stripped, lowercased — via a new
      `normaliseName` helper in `domain-dns-diff.service.ts`. A trailing dot
      is just how DNS writes an absolute name, so `www.` and `www` are one
      name; lowercasing alone put them in two slots, and a provider spelling a
      required record absolutely would have met an empty slot and emitted an
      ADD for a record the zone already holds. The helper is used by every
      name comparison in the file, not by `key()` alone: `aliasedNames`, the
      slot loop's chain-derived-address guard and `addCrossTypeConflicts` all
      compare names too, and normalising in one place would only have moved
      the mismatch one function along — in the zone-carries-the-dot direction
      it would have turned a correct CNAME into a cross-type conflict REMOVE.
      Specs cover both directions. No existing diff spec moved; none of them
      use a dotted or uppercase name.
- [x] **Retire the dead `sameIp` in `lib/ip-address.ts` (`BE`)** — it is not dead.
      Checked 2026-09-14 and the premise is wrong: `manual-domain.provider.ts:3`
      imports it and `:201` is its live caller, inside the A-record check that
      decides whether a merchant's domain points at us. `compareKey` superseded
      it in the *diff* service, not everywhere.
      Recorded as closed rather than deleted so nobody re-opens it on the same
      false premise. (Found by deleting it and watching `tsc` fail — a grep
      truncated at five lines had shown only the spec.)
- [x] **Nothing in CI regenerates or verifies the three apps' committed codegen (`INFRA`)**
      CI now regenerates the three apps' GraphQL codegen output and fails if
      the committed files moved. `ci.yml` gated `schema.gql` but nothing
      downstream of it: a forgotten `npm run codegen` shipped generated types
      describing an older schema, and every check stayed green because `tsc`
      was comparing the app against those very types — the query failed only
      at runtime, the same failure shape `schema:check` was added for. The new
      step sits in the existing `frontend` job (reusing its install and npm
      cache, no extra job) and runs `npx turbo run codegen` then `git diff
      --exit-code` over the three `src/shared/api/generated` directories, with
      `git add -N` first so a newly emitted file counts as drift too. It reads
      `back-end/src/schema.gql` off disk, so it needs no database and no
      running API; that the file it reads is itself current stays the back-end
      job's `schema:check`, and the two run in parallel — both must pass, so
      together they gate the whole chain from decorator to generated type.
- [x] **`dns_diff[].reason` is returned and never rendered (`VEN`)**
      The DNS setup screen now shows the back-end's per-record reason.
      `dns_diff[].reason` was computed on every configuration read and every
      Verify — a sentence explaining why each record has to change — and was
      in the query's selection set, but nothing rendered it, so "Remove these
      existing records" asked a merchant to delete rows from their own live
      zone with no explanation on the page. `DnsDiffTable` now prints one
      sentence under every ADD/UPDATE/REMOVE row. Where a translated sentence
      already exists (the two whole-set notes on a multi-value row) that one
      still wins, because the server's English says the same thing there
      almost word for word and dropping ours would regress Arabic — the same
      precedence `DnsIssueList` uses for a warning's `code` over its
      `message`. Verified records get no note: their reasons only restate the
      heading and the tick. No new message keys.
- [x] **Have a native speaker read `settings.domains.dns.replacesWholeSet` in `ar.json` (`VEN`)**
      Rewrote the Arabic for the DNS "whole set" notes on the domain setup
      screen. Both strings had been translated word for word from the English
      and neither survived the trip: `replacesWholeSet` said the name "يجيب"
      (answers/brings) more than one value, which is an English idiom Arabic
      does not use for a DNS record and reads as Gulf colloquial for "brings",
      and both it and `requiresWholeSet` used "ينتهي إلى" for "end up
      holding", which means "leads to" and loses the holding entirely. They
      now use يحتوي/يقتصر and a shared "دون غيرها" for the and-nothing-else
      clause, matching the تشير إلى / تطابق القيم wording the rest of
      settings.domains already uses. Nothing asserts Arabic wording —
      nextIntlMock translates against en.json only — so this class of string
      is only ever caught by reading it.

### Money-path audit — 28 confirmed defects (2026-09-14)

- [x] **Wallet rows were labelled `USD` (`T3` · `BE · wallets`)**
      `wallets.service.ts` hardcoded `currency: 'USD'` at both creation sites,
      overriding the model's `@default("SAR")` on every wallet the service has
      ever made — on a platform that trades in SAR alone, whose `Wallet` comment
      reads "1 point = 1 SAR". Nothing on the spend path reads the column, so no
      money moved wrongly; the label was wrong on every row. Both overrides are
      gone. **Existing rows still say USD** and want a backfill.
- [x] **A coupon from another shop could be spent at checkout (`T1` · `SEC` · `BE · orders`)**
      `createOrder` loaded coupons by id from `input.coupon_id` / `input.coupons`
      — client-chosen values — with **no `shop_id` predicate**, and then handed
      the engine `coupon.shop_id ?? …` as the evaluation scope. A coupon
      therefore validated against *its own* shop and passed, so a shopper with
      another merchant's coupon id could spend that merchant's promotion on this
      order. Now a coupon bound to a shop is skipped unless the order actually
      buys from that shop, using the line-level `shop_id`s already in scope;
      platform-wide coupons (`shop_id: null`) are deliberately untouched.
- [x] **Withdrawal approval has no lock, no status precondition and no balance re-check (`T0` · `BE · withdrawals`)**
      Fixed 2026-09-14, following `bank-transfers.service.ts` exactly:
      `withSerializableRetry` + `$transaction(..., { isolationLevel: Serializable })`,
      a `SELECT … FOR UPDATE` on the withdrawal row, and **`oldStatus` derived
      from a re-read inside that lock** instead of from the pre-transaction read.
      That one move closes both races without any new refusal: the second of two
      concurrent approvals blocks on the lock, re-reads `approved`, and its
      `oldStatus !== APPROVED` guard is false, so the debit cannot run twice; the
      reversal branch closes identically.
      A conflict throw on the no-op transition was written and then **removed** —
      `approved → approved` is a documented idempotent case with a test
      (*"announces nothing when the status did not actually change"*), and both
      money branches already decline it, so refusing would have broken a
      contract to re-solve a solved problem.
      Approval now also re-reads the balance under the same lock that debits it.
      The only other check lives in `create()`, and a request can sit PENDING for
      days while refunds move the balance underneath it — which is how a shop got
      paid money it no longer had, with nothing at the database level to stop
      `current_balance_cents` going negative.
      Two tests pin the new behaviour, and the spec's `$queryRaw` mock now
      defaults to `[]`: it had been returning `undefined`, a shape the real
      client never produces — the same unfaithful-mock theme as the Prisma
      fixtures and the Keyv store.
- [x] **`updateOrder` double-credits the vendor balance (`T0` · `BE · orders`)**
      Closed 2026-09-14. The status write is a **compare-and-set** — the status
      read before the call is part of the `updateMany` predicate — and the
      credit runs inside that same transaction, so `count === 1` is the proof
      that the pre-state really was what the credit branch assumes. Of two
      racing COMPLETED transitions exactly one credits.
      The fix is deliberately *not* the house `withSerializableRetry` +
      `SELECT … FOR UPDATE` template, and that was the reviewed decision: a
      lost update on one row with a known expected value is the textbook CAS,
      Postgres re-evaluates the predicate against the freshly committed row
      after blocking on the first writer's row lock, so it holds at Read
      Committed with no 40001 churn and no second copy of the transition table
      to drift from the first.
      `count === 0` now separates two cases that used to be one: the row
      already in the requested status is an **idempotent replay** and succeeds
      moving no money, anything else is `invalid_transition`. Everything with a
      side effect — the fulfillment hook, `order.status.changed` /
      `order.completed`, the webhook — is gated on the write having landed,
      which closed the duplicate-fulfilment and duplicate-event holes for free.
- [x] **The order path writes the balance and its ledger row outside a transaction (`T1` · `BE · orders`)**
      Closed 2026-09-14. `updateVendorBalance` takes the transaction client as
      its **first and required** argument. It used to be a trailing optional one
      defaulting to `this.prisma`, and three of the four call sites passed
      nothing — so the `balance.update` and the `balanceLedger.record`
      describing it were two independent statements, with a comment above them
      asserting an atomicity the code did not have. A required parameter is the
      only version of that rule `tsc` can enforce, and it is what stops the next
      call site quietly reopening the hole.
      The ledger's `running_balance_cents` is now read back from the write
      itself (`select: { current_balance_cents: true }`, the shape
      `withdrawals.service.ts` already used) instead of reconstructed as
      `snapshot + delta`. That drift was the worst available shape: the
      projection stayed correct while the statement silently disagreed with it,
      so nothing looked broken.
- [x] **Refund clawbacks run on orders that were never credited (`T0` · `BE · orders`)**
      Closed 2026-09-14, and the fix is one idea rather than four patches: **a
      clawback may only take back what this order's own ledger says it moved.**
      `balance_transactions` already carried `source_type`/`source_id` and an
      index on the pair, written by every money path and read by none — summing
      this order's rows for this shop gives the exact remaining headroom, net of
      earlier partial refunds for free.
      That closes the three siblings at once. A refund on an order that never
      reached COMPLETED now moves **nothing** (headroom 0) instead of taking
      the money out of earnings on other orders; a merchant-direct commission
      reversal is bounded by the commission actually charged, so it can no
      longer mint withdrawable balance from an order that was never billed; and
      a second deduct for the same sale — an admin flipping COMPLETED →
      REFUNDED and *then* approving the pending refund — finds the headroom
      already spent.
      The old never-negative clamp was the tell: it measured against the shop's
      **whole spendable balance**, so on the exact case its own comment
      described it succeeded and was wrong. Clamping at zero hid the negative;
      it never stopped the wrong deduction.
      The zero-total multi-shop bug went with it: the shares are now
      `distributeRemainder` over the child totals, which yields zeros for a
      zero weight-sum rather than falling back to the **full** refund amount
      once per child.
- [x] **The refund ceiling is re-checked where the money leaves (`T1` · `BE · refunds`)**
      Closed 2026-09-14. Approval now locks the **order** row and re-reads the
      already-APPROVED total under it before anything is paid. The creation
      guard aggregates over sibling rows and an aggregate takes no predicate
      lock, so the comment claiming it serialised concurrent approvals was
      simply false at READ COMMITTED — two concurrent creates could leave a set
      of PENDING refunds that jointly exceeded the order, and approval
      re-checked nothing, so that set was then paid out one refund at a time
      with no concurrency required at approval at all.
      Three decisions worth keeping. The order lock is taken **after** the
      refund lock, matching `createRefund` (order alone) and
      `cancelOrderAtomically` (orders → wallets), so no cycle exists. It **fails
      closed**: an order that cannot be read refuses rather than falling through
      to an implicit ceiling — the first draft gated the check on `if (order)`
      so that two specs stubbing nothing stayed green, which is a money guard
      designed around mocks. And it is deliberately **not** wrapped in
      `withSerializableRetry`, unlike the withdrawals path it otherwise mirrors:
      this body writes audit rows through `this.prisma` rather than `tx`, so a
      replayed 40001 appends duplicates that survive the rollback. The row lock
      alone is sufficient once it is held.
      The check counts APPROVED siblings only, where creation counts everything
      non-REJECTED. The two answer different questions: creation asks whether
      the outstanding claims fit, approval asks whether the money does.
- [x] **The wallet/card refund split is bounded, and the wallet has a floor (`T2` · `BE · refunds` · `BE · wallets`)**
      Closed 2026-09-14 — both halves of the rounding entry below.
      The split moved **inside** the order lock; a figure deciding how much real
      money leaves the gateway had been read outside it. It is now the
      cumulative wallet share at the running refunded total minus its value at
      the previous one, because rounding each partial independently let the
      shares sum past `wallet_applied_cents` and credit the customer store
      credit they never spent.
      `WalletsService.refundToWallet` now returns `min(amount,
      points_used_cents)` and moves **both** columns by that clamped figure.
      `points_used_cents` is a bare `Int @default(0)` with no CHECK, so the
      unfloored decrement drove it negative — and the wallet is read through
      `total = available + used`, so a negative `used` reads as credit the
      customer never earned. Clamping only the decrement would have minted
      credit instead of returning it, which is why both columns move together
      and the method reports what it applied rather than what was asked for.
      It had **no tests at all**; it has three now.
- [x] **A failed approval can strand a return in RECEIVED (`T3` · `BE · returns`)**
      A refund approval that refuses no longer strands the return.
      `ReturnsService.updateReturnStatus` commits the return as RECEIVED with
      `refund_id` stamped and approves the refund afterwards, outside that
      transaction — and since the approval learned to re-check the order's
      refund ceiling under the order lock and throw OVER_REFUND, that throw
      left the return RECEIVED with a PENDING refund. The old guard (`status
      !== received && !refund_id`) then sent every retry into the plain `else`
      branch, which re-wrote `status: received` over itself and never looked
      at the refund again, so there was no in-app way to approve it at all.
      The path is now re-drivable: a `received` call on a return that already
      carries a `refund_id` loads that refund and re-attempts the approval
      when it is still PENDING. Only PENDING — an APPROVED refund has already
      moved the money and has its own idempotent gateway retry, and a REJECTED
      one is a decision, not a failure. The approval was deliberately NOT
      folded into the return's transaction:
      `RefundsService.updateRefundStatus` owns its own transaction and ends in
      a Stripe call, so doing that would hold the `returns` row lock open
      across a network round trip.
- [x] **A commission rate above 100% debited the vendor on a completed sale (`T1` · `BE · orders` · `BE · commissions`)**
      Closed 2026-09-14. Found by the adversarial review of the commission
      design, not by the design itself. `applyBps` is a bare
      `floor(cents * bps / 10000)` with no range check, and the money path took
      `netBps = 10_000 - admin_commission_bps` raw — so a rate over 10000 bps
      made `netBps` negative and the `add` branch credited a **negative** figure
      on a COMPLETED order. It was reachable rather than theoretical:
      `CreateCommissionInput.commission_bps` carried `@Min(0)` and no upper
      bound, and `balances.admin_commission_bps` is a bare `Int` with no CHECK.
      Fixed at both ends — `@Max(10_000)` on the create and update DTOs, and a
      `Math.min(10_000, Math.max(0, …))` clamp in `updateVendorBalance`, because
      validation cannot reach a row a migration or a console wrote. The negative
      mirror is closed by the same clamp: a negative rate would have credited
      more than the order was worth. Two tests pin both ends.
- [x] **A coupon code is not unique per shop (`T2` · `BE · coupons`)** — already handled.
      The premise is right (`@@unique([shop_id, code, language])`) and the check
      this asked for came back clean: `cart-coupon.orchestrator.ts` resolves a
      code with a single-row read, not a `findMany` it then iterates, so the
      live apply-coupon path cannot double-apply a language variant. Filed
      because a *proposed* shared-pricing loader would have done exactly that;
      the warning belongs with that design, which now carries it.
- [x] **Multi-shop orders charge the header shop's tax to every shop (`T1` · `BE · orders`)**
      Closed 2026-09-14, in two halves.
      **The rate half was fixed.** The per-line fallback read `?? fallbackBps`,
      the X-SHOP shop's own `tax_bps`, for every line, while the child split
      re-resolved each shop's — so `sum(children.total_cents)` stopped equalling
      `parent.total_cents`. Each line now resolves its own shop's rate from a
      map read once for the whole order, which also removed the per-child
      `shop.findUnique` that ran inside the Serializable transaction. A parity
      spec pins it and was confirmed red before the fix (3000 against the
      expected 2000 — exactly a 15% shop's rate applied to a 5% shop's line).
      The review found a second, larger break the design had missed and it went
      with it: the `totalDiscountCents` clamp sat *after* the parent's per-line
      tax loop while the children read the clamped value, so stacked coupons
      summing past the subtotal made the parent tax a bigger discount share
      than was applied — reachable on **single-shop** traffic, where it is a
      straight tax under-charge. The clamp moved to where the discount becomes
      final.
      **The regime half is refused rather than fixed**, which the owner chose.
      `createOrder` now rejects a basket whose shops disagree on currency,
      `prices_include_tax` or `tax_calculation` (`MIXED_SHOP_TAX_REGIME`). The
      parent resolves one regime from the X-SHOP shop and applies it to every
      line, and representing two would mean computing the parent FROM the
      children — a different order model. Nothing upstream can assemble such a
      cart anyway: `verifyCheckout` refuses cross-shop lines as `wrong_shop`,
      the carrier branch throws, draft orders are single-shop. So this is
      unguarded input, not a half-built feature, and the guard says so.
      A cart genuinely spanning many vendors stays a real feature for later —
      parent pricing, child orders, shipping, tax, coupons, refunds and payouts
      designed together — not a patch to this path.
- [x] **`updateVendorBalance`'s never-negative clamp is defeatable (`T2` · `BE · balance`)**
      Closed 2026-09-14 by deleting the clamp rather than hardening it — see the
      refund-clawback entry above. Two things were wrong with it and only one
      was the race: it read the balance unlocked (so two concurrent deducts both
      clamped against the same figure and the sum still went negative), and its
      basis was the shop-wide balance rather than this order's, which is the
      defect the clamp was hiding. The `balances` row is now locked
      `FOR UPDATE` in the same statement that reads it, and the headroom makes a
      negative balance impossible by construction instead of by clamp.
      Left open deliberately: `current_balance_cents` still has no CHECK
      constraint, and a partial unique index on `(shop_id, source_id)` for
      `sale`/`commission` rows would make credit-once a database guarantee that
      survives a future call site forgetting all of this. Both are filed below.
- [x] **`bulkUpdatePrice` has three defects (`T2` · `BE · products`)**
      All three fixed 2026-09-14, and the first two were **proven against the
      local Postgres before and after** rather than reasoned about:
      - `GREATEST(ROUND(NULL * …)::int, 0)` returns **`0`**, because `GREATEST`
        ignores NULLs — so any bulk adjustment silently marked a product with no
        price as free. `price_cents` is `Int?`. The `sale_price_cents` column in
        the same statement was already guarded with exactly the `CASE WHEN …
        IS NULL` this needed.
      - `price_cents * (10000 + delta)` is int4 × int4, and Postgres computes it
        as int4: `200000 * 11500` raised `ERROR: integer out of range` and
        **aborted the whole batch**. A `::numeric` cast on the left promotes the
        expression; the trailing `ROUND(...)::int` keeps the stored type.
      - `min_price_cents` / `max_price_cents` are both indexed and drive price
        sort and the price filter, and neither moved. Now they follow the price
        for `SIMPLE` products only — on a `VARIABLE` product they are derived
        from the variation prices, which this statement does not touch.
      Verified on four rows in a real transaction: NULL stayed NULL, 200000 →
      230000 with no error, a simple product's min/max tracked its price, and a
      variable product's min/max (1000/9000) were left alone while its own price
      moved.
- [x] **Rounding residue in refunds and commission (`T3` · `BE · orders`)**
      **Closed 2026-09-14 — every half of it.** `applyBps` floors, so
      `sum(floor(Rᵢ·k))` is strictly less than `floor(sum(Rᵢ)·k)` the moment a
      share is not a whole cent — 10000 cents at 1000 bps credits 9000, but
      refunds of 3333/3333/3334 floored individually clawed back 8998 and
      stranded 2 cents in the shop's withdrawable balance forever. Each deduct
      is now the credit function evaluated at the **running** refunded total
      minus its value at the previous one. Telescoping is an identity for any
      `F`, so the partials sum back to the credit exactly, at any rate, through
      the proration step, with no stored-reversal state to read back. A spec
      runs the 3333/3333/3334 case and asserts −9000.
      The multi-shop share half went with it: `distributeRemainder` replaced the
      independent per-child `Math.round` that could overshoot the refund by a
      cent.
      **Both remaining halves closed the same day** — see the wallet/card entry
      above. That leaves only the cross-shop attribution below.
      **Found while fixing this, filed rather than folded in:** the refund
      aggregate ignores `Refund.shop_id`, so on a multi-shop order a refund
      raised entirely for Shop A's line items still claws a proportional share
      from Shop B. That is whole cents, not a residue, and it wants
      `RefundLineItem` to drive the attribution instead of the child totals.
- [x] **A refund for one shop's lines claws back from every shop on the order (`T2` · `BE · orders` · `BE · refunds`)**
      Closed 2026-09-14 by refusing the call, which the owner chose over
      building attribution first.
      `createRefund` now rejects a refund raised against a multi-shop **parent**
      order with `REFUND_PARENT_ORDER`. The parent carries no shop and no lines
      — both live on the children — so a refund there names no shop, and the
      clawback had no choice but to prorate across every child by order total:
      a customer returning one item from shop A debited shop B, in whole cents.
      Neither discriminator could have rescued it. `Refund.shop_id` is copied
      off the order, so it is non-null exactly where nothing needs
      disambiguating and null exactly where the split matters; and the
      line-item path throws on a parent, so `RefundLineItem` rows cannot exist
      on a multi-shop order at all.
      The refusal is checked before the ownership check, because it is a
      statement about the order rather than about the caller — an admin doing
      this is as wrong as a customer doing it. It breaks an API that succeeds
      today, but no shipped UI takes that path: the vendor dialog already posts
      a child order id with `lines`.
      Attribution (accepting `lines` on a parent, then crediting the right
      child) was deliberately NOT built first: on today's data it would be
      inert, because neither discriminator is ever populated on the orders that
      would need one.
- [x] **`balances.current_balance_cents` has no database-level floor (`T3` · `BE · balance`)** — and must not get one.
      Closed 2026-09-14 as **wrong, not as done**. A `CHECK (current_balance_cents
      >= 0)` would reject writes on two paths that are *supposed* to go negative:
      a merchant-direct order books the platform's commission as a negative
      movement (the shop owes us, it has not earned), and a dispute can hold more
      than the spendable pool. The invariant that actually matters is the one now
      enforced in code — a clawback may take back no more than what this order's
      own ledger rows say it credited — and it is bounded per order, which a
      column-wide CHECK cannot express.
- [x] **The order-edit audit note hardcodes "SAR" and scales inline (`T4` · `BE · orders`)**
      Closed 2026-09-14. The note now reads the order's own ISO-4217 snapshot
      and renders through one named formatter. It is the only human-readable
      record of what an edit did to the money, so a dispute over an AED order
      was argued from a line that said SAR — and the two totals were rendered
      by bare division, so 3950 printed as `39.5` beside a `+11.50` on the
      same line.
      `formatMoneyCents(cents, currency)` is new in `money.helper.ts`, which
      had no renderer at all. It had **four** callers waiting for it before it
      existed — `notification-dispatch.listener`, `notify-log.listener`,
      `email.processor` and `staff-notifications.listener` each open-coded the
      identical `${fromCents(c).toFixed(2)} ${currency}` — so the correct
      rendering was already established four times over and this was the one
      copy that used neither. All four now call the helper.
      The carrier COD-limit message went with it: it scaled inline and named
      **no currency at all**, on a checkout-blocking error a shopper reads.
      The fixture told the same story as the code — `mockOrder` carried no
      `currency`, though the column is non-nullable in the schema, so the test
      passed against a shape Prisma cannot produce. It carries one now.

### The platform charges no commission, and the screen that looks like it sets one does not (2026-09-14)

- [x] **The commission rate card was readable without a token (`T0` · `SEC` · `BE · commissions`)**
      Found 2026-09-14 by the adversarial review of the commission design — not
      by the design, and not by any test. Both reads on `CommissionsResolver`
      carried `OptionalJwtGuard`, which authenticates a request that brings a
      token and lets one through that does not, and `CommissionsService.findAll`
      narrows by `shop_id` only when the caller supplies one. So an
      argument-less anonymous request returned the whole table — every tier, and
      every **shop-scoped negotiated rate beside the `shop_id` it belongs to**.
      That is a commercial term between the platform and one merchant, readable
      by anyone who knew the field name. `commission(id)` was the same.
      Both are now `JwtAuthGuard + PermissionsGuard` on `manage_all_shops`
      alone, matching the three mutations that were already gated in the same
      file — the inconsistency inside one resolver is what made it easy to miss.
      Nothing breaks: the only consumer in the monorepo is
      `apps/admin/src/features/commissions/api.ts`, already an authenticated
      admin holding that permission.
      `commissions.resolver.spec.ts` is new and pins the guard metadata on all
      five operations, plus one test asserting the resolver has no *sixth*
      handler — a query added later without guards would otherwise be invisible
      to a per-name list.
- [x] **Stacked coupons compound — SEQUENTIAL, decided and shipped 2026-09-14**
      The owner settled it: the cart was right and the order path moved onto it.
      100 SAR with two 10% coupons is 81, not 80. `SEQUENTIAL` is the schema's
      own default, it is the number the customer sees before paying, and it is
      the direction that does **not** increase what we take — PARALLEL would
      have meant every multi-coupon basket had been showing a better price than
      it would charge.
      Three pieces, and the order they had to land in is the story:
      **A deterministic order first.** `compareCouponPrecedence` is now the one
      rule the cart and `createOrder` both sort by. That already mattered before
      any stacking — the conflict gate accumulates accepted candidates as it
      iterates, so which of two mutually-exclusive coupons survived was decided
      by the order Postgres returned the rows in. Sequential pricing then makes
      it load-bearing, because A-then-B is a different total from B-then-A.
      **The arithmetic extracted, not copied.** The defect was literally 'the
      cart has a running-price fold and the order does not', so writing the fold
      a second time would have reproduced the cause. It lives once in
      `sequential-stacking.helper.ts`; each caller keeps its own bookkeeping,
      which genuinely differs, and shares only the part that must not.
      **The per-line split made exact.** This is the half the first design
      missed, and without it the totals would have matched the cart while the
      tax and the per-vendor share still would not. Both tax loops split the
      order discount pro-rata across the ORIGINAL line values; a 50% coupon
      scoped to one line of a two-line basket took it all off that line, while
      the pro-rata split spread it across both. They now read the exact
      `per_line_cents` the engine already computed — its docblock says callers
      should never recompute — with a pro-rata residual for what the coupons do
      not explain (a manual discount, or the clamp biting).
      Pinned by a test that computes from the prices it is handed rather than
      returning a constant, and confirmed **red** before the fix: 2000 against
      the expected 1900, which is exactly 80 against 81.

### The back-end did not compile, and nothing said so (2026-09-13)

`npm run build` failed on three type errors in `dns-inspector.service.ts`, and
had been failing. `DnsSnapshot` declared `propagation` and `wildcard` as
required fields, `inspect()` returned neither, and `RESOLVERS` had been widened
from `string[][]` to `ResolverSpec[]` without its one caller being updated — a
layer written and never wired up. `dns/dns-warnings.ts` was the other half of
the same unfinished change: 380 lines implementing severity, stable codes, the
wildcard verdict and the proxy's `required_value`, with **zero callers**.

The gap was not that nothing gated `tsc`. `check:di` and `schema:check` both run
`nest build`, so CI *was* failing — but as "check:di failed", which reads as a
module-wiring problem and sends the next person to the graph rather than to a
type error three files away. `npm run typecheck` now exists and runs as its own
named step, first, so the message matches the fault. It also explains a symptom
filed separately as its own puzzle: `src/schema.gql` was stale and could not be
regenerated, because `schema:generate` builds `dist/` first.

Finishing the wiring closed six backlog items at once — the propagation grid,
warning severity, the wildcard detector, the proxied merchant's missing required
value, the stale schema, and the source half of the `tsc` gate.

- [x] **The warning codes have no message catalogue (`BE` · `VEN` · `UI`)**
      All eight, in both languages, under `settings.domains.dnsIssues`, with
      each code's `params` spread in as the ICU values. `DnsIssueList` checks
      `t.has()` **first** and falls back to the server's `message`, in that
      order and never the other way round — `t()` renders a missing key *as the
      key*, so an unguarded lookup would put the literal string
      `DNS_CAA_BLOCKED` in front of a merchant, which is worse than an English
      sentence they can act on. The `t()` call is additionally wrapped, because
      a placeholder the server stops sending would otherwise throw and take the
      page down over one sentence. Two tests pin both directions.

### Every error code now has a sentence, in both languages (2026-09-12)

Four `ErrorCode` values had no entry in `src/i18n/{en,ar}/common.json`, and the
consequence was worse than a missing translation. `formatError` renders
`t(error_code, lang) || formattedError.message` — and `t` **echoes the key back**
when it has no entry, which is never falsy. So the fallback is dead code: a code
missing from the catalogue does not degrade to the English sentence the service
passed to `AppException`, it reaches the client as the literal string
`DOMAIN_ALREADY_CONNECTED`. That is what a merchant saw on the connect form.

`SHOP_HANDLE_RESERVED` and the three `DOMAIN_*` codes are in both catalogues now,
and `error-codes.i18n.spec.ts` holds the contract: every `ErrorCode` has an `en`
and an `ar` entry, none renders as its own name, and none carries an
unsubstituted `{placeholder}` — `formatError` passes no params, so
`SHOP_HANDLE_RESERVED` could not keep the handle its English literal interpolated.

The e2e typecheck was settled in the same pass. `back-end/test/` now has its own
`tsconfig.json` compiling as **CommonJS**, which is what ts-jest actually runs:
under the root config's `nodenext` a dynamic `import()` inside a CJS file is
resolved in ESM mode and demands a `.js` suffix the runtime loader would then
fail on. 217 → 210 `tsc` errors, and the test project is clean.

- [x] **Nothing gates back-end `tsc` (`T4` · `BE` · `CI`)**  
      Closed 2026-09-13. The CI step is now `npm run typecheck:all` — the root
      tsconfig, so `src/**` *including* every unit spec — where it used to be
      `npm run typecheck` (`tsconfig.build.json`, which excludes `**/*spec.ts`).
      The narrow gate was the only one available while the specs carried errors
      of their own: **222** of them, not the 216 this entry claimed, because the
      count was taken before the Prisma client moved again.
      It had been running all along as a side effect of `nest build` inside
      `check:di` and `schema:check`, which is why the gap was easy to miss and
      why a type error was reported as "check:di failed" — a message that reads
      as a wiring problem and sends the next person to the module graph.
      All 222 were in `src/**/*.spec.ts` and **none in production code**, which
      is what made this safe to fix in one pass: 39 files, one agent each, and
      the fixes were overwhelmingly one shared fixture per file rather than a
      patch per call site — `shops.service.spec.ts` alone held 89 errors that
      came down to a single `Shop` literal missing 11 columns the client had
      added. 6169 tests stayed green, and the net count of `expect`, `it`,
      `describe`, `toBe`, `toEqual` and `toHaveBeenCalled` was unchanged in
      every direction, which is the check that matters: the failure mode here
      is not a broken test but a quietly weakened one. `as any` came **down** by
      one on net; the six casts added are all `as unknown as PrismaClient[…]`
      on mock method signatures, where the real type is a `Prisma__XClient`
      thenable that cannot be constructed in a mock.
      Still ungated: **`back-end/test/`**, the e2e suite. Both tsconfigs exclude
      it and it compiles as CommonJS under its own, so nothing typechecks it.
- [x] **`back-end/test/` (e2e) is typechecked by nothing (`T4` · `BE` · `CI`)**
      Closed 2026-09-14. `npm run typecheck:e2e`
      (`tsc --noEmit -p test/tsconfig.json`) exists and runs as its own CI step
      beside `typecheck:all`.
      It needed its own invocation rather than a wider `include`, because the
      two trees disagree about modules: ts-jest compiles `test/` to CommonJS,
      and under the root config's `nodenext` a dynamic `import()` in a CJS file
      resolves in ESM mode and demands a `.js` suffix the runtime would then
      fail to load. Two module systems, two tsc runs.
      The measurement this entry was waiting on came back **0 errors** — the
      config had been correct since it was written and only ever lacked a
      caller, so unlike the unit specs there was nothing to fix first.
- [x] **Vendor agent shows credits copy for a spent daily quota (`T3` · `BE`)**
      Closed 2026-09-14. `AGENT_ERROR_KEY` now points `PROVIDER_DAILY_QUOTA` at
      `AGENT_ERROR_PROVIDER_DAILY_QUOTA`, and the mirrored `COPY_KEY` in
      `classify-provider-error.spec.ts` with it.
      The mapping carried its own instruction — "Point this at
      `AGENT_ERROR_PROVIDER_DAILY_QUOTA` the day one is written" — and that copy
      had since been written in both `en` and `ar`, so the comment was describing
      a state that had stopped being true. The distinction is the only thing a
      vendor reads the sentence to settle: an exhausted daily allowance is back
      tomorrow, a spent credit balance is not back until someone tops it up.
      Found by a subagent fixing the spec's `Record` exhaustiveness error, which
      is the interesting part — the type error was a missing key, and the stale
      mapping was only visible from inside it.

### Abandoned carts are found by activity, not by a column nothing wrote (2026-09-12)

- [x] **Point `CartClaimService` at the shared storefront-URL helper (`T5` · `BE · cart`)**  
      The private `storefrontBase()` is gone and the service no longer injects
      `ConfigService`. What stayed is the warning: the shared helper degrades
      silently to the storefront's dev port, which is correct locally and dead in
      production.
- [x] **Recovery links do not use a shop's own domain (`T4` · `BE · cart` · `BE · shop-domains`)**  
      `EmailProcessor` resolves `ShopDomainsService.primaryHostname` and builds the
      link with `shopStorefrontUrl`. The shape to remember: on a shop's own host
      the slug is **not** a path segment — the storefront proxy re-inserts it — so
      emitting it would give `/acme/acme/cart` and 404. `primaryHostname` answers
      `null` for almost every shop, which is the ordinary state, not a failure.
- [x] **No purge job for expired carts (`T4` · `BE · cart`)**  
      `purge-expired-carts`, nightly at 03:45 on the existing cart queue. **Two
      predicates, and the second is the safety**: `expires_at` is stamped once at
      creation and never pushed forward, so a shopper still adding items three
      weeks later has a formally expired cart — a row is only purged once it has
      also been idle for `CART_PURGE_GRACE_DAYS`. Deliberately no status and no
      `user_id` filter: **guest** carts are the rows that accumulate, because the
      abandonment detector skips them on purpose. `stock_reservations` carries
      `cart_id` with no foreign key, so its rows are released and deleted here or
      they outlive the cart as unreachable garbage.

### Subscription windows now close themselves (2026-09-12)

- [x] **Alert when the sweep's Stripe leg finds drift (`T3` · `BE · plans` · `INFRA`)**  
      `STRIPE_SUBSCRIPTION_DRIFT`, `warn`, deduped per shop. Four reasons —
      `adopted_unknown_subscription`, `row_refreshed`, `closed_without_remote`,
      `duplicate_remote_subscription` — and `row_refreshed` names *which* columns
      moved, because the field is what says which event went missing: a
      `current_period_end` that jumped forward is a lost renewal. A reconcile that
      changes nothing stays silent, so the channel keeps meaning something.

## AI & Integrations

### Store import — "AI Store Migration" (2026-09-14)

- [x] **P0 — guard rails first (`BE · store-import` · `SEC`)**
      `catalog.store_import` plan key, `IntegrationType.SCRAPING`, all three
      tables (job, identity map, media) in one migration, `assertPublicHttpUrl` on
      `source_url`, the ownership attestation and its `AuditLog` row. Before the
      first outbound request.

### The chat panel's mentions moved into the text (2026-09-13)

- [x] **Wire the textarea to the picker with combobox semantics (`T3` · `VEN` · `UI`)**  
      `inline-mention-aria.ts` gives the textarea `role="combobox"`,
      `aria-autocomplete="list"` and `aria-expanded` always, with `aria-controls`
      and `aria-activedescendant` only while the picker is open; options carry
      unique ids and `aria-selected`, both listbox levels have accessible names,
      and a polite live region announces a resolved reference — which matters
      because the chip it used to announce is gone and a reference now reads as
      ordinary words.
      Review found one regression this introduced, now fixed and pinned: the
      picker reaches `(category set, empty query)` **two** ways — the vendor
      typing `@coupon`, and the caret merely landing inside an already-resolved
      `@SALE20` — and the Backspace-steps-back rule belongs only to the first.
      In the second the "@" is ordinary text written earlier, so the rule ate the
      first Backspace after clicking into a token. `openedOn` tells them apart.
      *(Superseded description below.)*  
      The picker renders `role="listbox"` / `role="option"` and the textarea does not
      carry `role="combobox"`, `aria-expanded`, `aria-controls` or
      `aria-activedescendant`, so a screen reader is never told the list opened. This
      is inherited from the chip picker rather than introduced here — `mention-dropdown.tsx`
      never had them either — but the inline model makes it matter more, because the
      chip it used to announce (icon plus a labelled remove button) is gone and a
      resolved reference now reads as ordinary words.
- [x] **Strip the tags out of conversation titles (`T4` · `BE`)**  
      `agent/conversation-title.ts` strips the trailing `[Referenced: …]` block and
      normalises inline tokens to their display text, collapses whitespace, and only
      then truncates to 60. The boundary could not be the reference implementation's
      `\w` — JavaScript's is ASCII-only, so it splits `@هودي` out of `@هوديات`.
      **Still open elsewhere:** `vendor-agent-chat.tsx`'s export path derives a second
      title by slicing the raw message, so the tags stripped from the sidebar still
      reach the downloaded Markdown's H1. Tracked under Vendor dashboard.

### One AI spend ledger (2026-09-12)

Two ledgers already existed — `AiBudgetService` for platform spend against
`AI_DAILY_BUDGET_USD`, and per-shop `usage_events` behind the admin cost screen —
and of the three consumers only image generation used both. The other two were
half-wired in *opposite* directions: the vendor agent measured a real per-turn
cost and committed it to the shop's ledger while staying completely invisible to
the platform cap, and the Tiptap assistant did the reverse, booking a flat 50c it
never trued up and passing no `cost_cents` at all, so every editor row on the
admin cost screen read as free.

Both now reserve-then-settle. Two decisions are worth keeping in mind because
they are not obvious:

**A budget refusal gates the turn** rather than merely recording it, following the
image path. `reserveTurn` was reordered so the shop's entitlement is reserved
first and *released* when the platform budget refuses — otherwise a platform-wide
cap would also eat a shop's monthly allowance.

**A reported cost of zero is not trued up.** `cost_cents === 0` means both "free"
and "this provider does not report a price" (Groq). Trueing it up would refund the
conservative reservation and put agent spend back at zero on exactly the providers
that cannot be measured, so a priceless turn keeps its flat reservation.

Also fixed along the way: `settleTurn`'s `if (!handle) return` skipped settlement
entirely on an unseeded database, and `releaseTurn` never settled — so a failed
turn refunded the shop's request while the provider had still been paid.

- [x] **A budget refusal reuses `QUOTA_EXCEEDED` on the SSE stream (`T4` · `VEN` · `BE · ai`)**  
      Code and card shipped together, and it turned out to be three refusals rather
      than two. `classifyRefusal` reads `extensions.validation_errors[].code` —
      **not** `error_code`, which every one of these sets to `VALIDATION_ERROR`, and
      that mismatch was already live: `vendor-bot`'s `failureCopy` compared the
      wrong field, so a merchant out of allowance on WhatsApp was told the assistant
      was temporarily unavailable and to try again shortly. The stream now sends
      `QUOTA_EXCEEDED` (the shop's plan, with a **View plan** link),
      `PLATFORM_BUDGET_EXCEEDED` (ours, and it deliberately drops the exception's
      message, which names our spend against our cap) and `RATE_LIMITED` (clears
      within the hour, so no button and a sentence saying so). An unknown code still
      falls back, so an older back-end stays a supported caller.
- [x] **No per-user rate limit on the vendor agent (`T4` · `BE · vendor-agent`)**  
      `reserveTurn` calls `rateLimiter.enforce(userId, 'chat')` **instead of**
      `budget.reserveCost('chat')` — `enforce` does the Redis per-user bucket and
      calls `reserveCost` itself, so calling both would book every turn twice. The
      60/hour, 500/day defaults were already written down in `FALLBACKS.chat` and
      are overridable by `AI_RATE_LIMIT_CHAT_HOUR` / `_DAY`.
- [x] **Three AI surfaces are still outside the budget entirely (`T4` · `BE · ai`)**  
      All three now reserve-then-settle. The storefront panel was the worst of them:
      it passed **no** `UsageTracker` at all, so its spend reached no ledger
      anywhere. `AiContentService` is flat with no true-up — the `fast` model is
      Groq, which reports no price — and every generation books separately, because
      one agent turn can call several of them.
- [x] **The storefront assistant's shop reservation fails open on a spent quota (`T4` · `BE · storefront-assistant`)**  
      The two are now told apart by the **shape of the throw** rather than by its
      wording: an `AppException` is the entitlements service's own refusal and
      returns `'exhausted'` — the value that was in the return type with no path
      producing it — which the caller turns into `TOO_MANY_REQUESTS`. Anything else
      is the check itself breaking and still fails open with a `warn`, because a shop
      must not lose its assistant because Redis blinked. String-matching the message
      would have been the fragile version; the exception type is the contract.
      One code for all three ceilings is deliberate: the reader is a shopper, and
      which of the shop's meters ran out is not theirs to act on. The feature doc
      said the exact opposite of this and has been corrected.
- [x] **`AiContentService` books the shop's meter too (`T4` · `BE · ai`)**  
      It now takes an optional caller and books the shop entitlement and the
      per-user bucket alongside the platform cap. It does **not** double-book:
      `enforce` calls `reserveCost` itself, so the two are strictly exclusive —
      the same rule `reserveTurn` follows.
      Review caught two billing bugs in the first cut, both now fixed and pinned:
      a flat 1200-**character** estimate was reserved for every key, but
      `ai.text.seo` bills per **request** with limits of 100/500/2000 — so it did
      not over-charge SEO, it *refused* it outright on BASIC and GROW while real
      usage was zero. Quantity now follows the capability's own `billingUnit`, on
      both the reserve and the commit. And `translate_product_content`, gated on
      `ai.text.translate`, was billing `ai.text.generate` because the capability
      was hardcoded — gate and bill now name the same key.
      **Still open:** the anonymous assistants have no per-user limit, since
      `enforce(null, …)` keys every customer on the planet to one `anon` bucket.

## Design system & UI

### Tajawal restored after a merge half-reverted it (`UI` · `VEN` · `ADM` · `SF`) — 2026-09-14

Merge `123ff2a5` took the pre-Tajawal side of the entry below, and took half
of it: `globals.css` went back to IBM Plex with the `@repo/fonts` import, while
the layouts kept the `Tajawal({...})` call and lost the `import` that defines
it. That is a `ReferenceError: Tajawal is not defined` thrown from module
evaluation of the root layout — every route in the vendor dashboard down, and
nothing for a reviewer to see in a diff that looked like a font swap.

All three apps are back on the intended setup: `Tajawal` imported from
`next/font/google`, `tajawal.variable` on `<html>`, `html[lang="ar"]` reading
`var(--font-tajawal)`. Weights 300/400/500/700 — Tajawal has no 600, so CSS
matching resolves `font-semibold` up to the real bold rather than synthesising
one. The sweep the merge undid is restored with it: the dead turbo
`sync-fonts` task, the `.gitignore` comment, and the four docs naming IBM Plex.

- [x] Nothing pins the three declarations together
      **Root layout font declarations are pinned per app.** All three apps
      declare Tajawal with `next/font/google` and hang the generated class on
      `<html>`, and the block is copied verbatim into each — which is how a
      merge once reverted one app's `const tajawal = ...` while leaving the
      JSX that read it, throwing a ReferenceError from module evaluation of
      the root layout. Every route was down and the diff read as a font swap.
      There is now one `layout.render.test.tsx` per app
      (`apps/{vendor,admin,storefront}/src/app/__tests__/`) holding the three
      copies together. The layouts are async Server Components that cannot go
      through `render()` here — `next/font/google` ships an empty file outside
      the Next build, and the import graph reaches `server-only` and the
      Apollo RSC client, neither of which resolves under vitest — so each test
      imports the module (which is what catches the ReferenceError), awaits
      the default export as the function it is, and asserts the Tajawal class
      is on the returned `<html>` element plus that `Tajawal()` was called
      with `--font-tajawal` and the four real weights. Only the
      build-time-only modules are stubbed; the declaration itself runs.

### Segmented filter bar shared by nine list screens (2026-09-13)

- [x] The vendor list screens are bilingual (2026-09-13). `FILTER_FIELDS`
      became `<feature>FilterFields(t, operators)` on all four screens — a
      function rather than a constant because a module evaluated at import time
      has no locale. The option constants were taken together with the status
      badges, as the entry said they had to be: both resolve the *same* message
      key, so the menu and the row it filters to cannot say two different
      things. Verified bilingual by counting keys on both sides —
      `filterBar` 17/17, `orders.orderStatus` 8/8, `orders.paymentStatus` 12/12,
      `coupons.kinds` 5/5, `collections.type` 2/2, `customers.status` 2/2, with
      no `en` key missing from `ar`. That check matters more than it looks:
      `t()` echoes an unknown key back, so a missing entry would have reached
      the merchant as the literal string `orders.filter.payment_status`.
- [x] One control, not two (2026-09-13). `FilterBar` gained a `clear` slot —
      `{onClear, label?, active?}` — and the screen owns all three parts of the
      button the bar then draws: what it does, what it says, and when it is
      worth offering. The screens pass their own `onReset`, so the single
      button empties the chips *and* the search box the bar cannot see. Omit
      the slot and the bar still clears its own chips, which stays right for a
      screen whose chips are the whole filter state.
- [x] The customers screen's dead Subscription chip is gone (2026-09-13).
      `contacts` takes no subscription argument and the table does no
      client-side filtering, so the control could only ever lie about what the
      list was showing. Removed rather than left in place; giving it a real
      server argument is tracked under Back-end & API if it is ever wanted.
- [x] `filterBar.isAnyOf` is kept, and the question is settled (2026-09-13).
      It has no consumer in `apps/admin` — every field there maps to a
      single-valued server argument — but it is not admin-only chrome: the
      vendor's coupons screen uses it for all three of its fields, which are
      genuinely list-valued (`order_status=a,b`). So it stays in the shared
      component and the admin wrappers simply never ask for it.
- [x] All four vendor toolbars have a render test (2026-09-13). Coupons,
      collections and customers gained one alongside orders, each pinning the
      three things a lib-level test cannot reach: the free-text search the bar
      does not own, the **add-then-pick flow** (a chip carries no values the
      instant it is added, which is what a derived `value` array would drop),
      and the screen's Reset emptying the chips and the search together. They
      resolve every string from the real `messages/en.json` rather than a stub
      that echoes its key, so a message that was never written fails the test
      instead of rendering as a raw key on the merchant's screen — which is
      how the stale `next-intl` mock in the orders test was found.

### RTL: the source-level half of the audit is done (2026-09-12)

- [x] **App-level RTL misses outside the primitives (`T3-20` · `VEN` · `UI`)**  
      Five files. The two `rtl:` reverse classes were not merely redundant but
      **wrong**: Tailwind v4 compiles `space-x-*` to `margin-inline-*` and `divide-x`
      to `border-inline-*-width` already, so an `rtl:` reverse variant flips a
      direction that has already flipped.
- [x] **Inline-side popover geometry is backwards under RTL (`T3-20` · `UI`)**  
      Fixed rather than left dormant, because the fix turned out to be exact:
      `tw-animate-css` already ships `slide-in-from-start`/`-end` as `:dir()`
      utilities, so the physical `left`/`right` pair was simply inverted. The tooltip
      arrow moved to `-start-1`/`-end-1`. `data-[side=left|right]` stays physical on
      purpose — there the *caller* picked a physical side.
- [x] **`DialogContent`'s close label is still hardcoded English (`T5` · `UI`)**  
      `DialogContent` and `DialogFooter` both take `closeLabel` now, same contract as
      `SheetContent`: it defaults to English so an unlocalized console reads sensibly,
      and a bilingual screen passes its own string rather than opting out of the
      button and hand-rolling one.

## Done — recent closures

- [x] **Money crosses the API as integer cents (`BE` · `ADM` · `VEN`):** Eleven `Float` money fields on the GraphQL boundary became `Int` cents with no database work — the storage side had already migrated. The renames are deliberately breaking and carry **no deprecated aliases**: an alias would let a missed call site keep reading a field that is now 100× off, silently. The sharpest find was not a type but an accumulation — `vendor-agent.resolver.ts` ran `daily[idx].revenue += order.paid_total_cents / 100` inside a 14-slot loop and `segment-insights.service.ts` divided per row before averaging, which is the drift `money.helper.ts` exists to prevent. Both now sum in integers and round once. One convention is deliberately **not** cents and is documented in both vendor-agent docs so nobody "fixes" it: the five AI **tool** payloads convert to major units at the tool boundary, because a tool result is read by the LLM, which has no formatter. Closed out 2026-09-12 by its last two follow-ups — `todays_revenue_cents` now cuts "today" at the shop's local midnight on both the rollup and the fallback path (it used to cut at the API *server's* midnight, a property of where the process happens to run), and the e2e typecheck got its own CommonJS `tsconfig`.
- [x] **Deduplicate Arabic font assets (`T5-11` · `VEN` · `ADM` · `STORE`):** The backlog understated it twice. It was **three** apps carrying the identical 15-face Thmanyah set, not two (md5-verified across all three, and the three `@font-face` blocks `diff` clean) — and `apps/vendor/public/fonts` was **23MB, not 1.2MB**, because it also carried 15 unreferenced OTF sources, a committed `__MACOSX` AppleDouble tree, 10 `.DS_Store` files and an 18MB Arabic specimen PDF, all tracked by git and all served publicly under `/fonts/`. Now one copy lives in `packages/fonts` and a `sync-fonts` turbo task (`outputs: ["public/fonts/**"]`, run from each app's `predev`/`prebuild`) copies it into each app's `public/`, which is gitignored — because a package's `public/` is never served and Next resolves `/fonts/...` only against the app's own. Every existing URL is untouched. **Two honest caveats:** a fresh clone has no fonts until a dev or build run happens once, and `git rm` on the 18MB PDF does not shrink the clone — history still carries it.
- [x] **Extract shared settings rail layout (`T5-12` · `UI`):** **The entry asked for the wrong extraction.** The two files called `SettingsShell` share a name, one Escape-key trick and almost nothing else; what is genuinely shared is the rail *card* — its nav-entry `className` strings are character-for-character identical, as are the filter box and empty state. So `SettingsRail` in `@repo/ui` is the card, not the shell, and it is navigation-agnostic by construction: items are `{id, label, icon?, active?}` and a `renderItem` render-prop hands back the computed face, so admin returns a `Link` (each integration type is already a URL) and the vendor returns a `button` (its sections are panes in local state). That difference was load-bearing and had to survive. Admin's rail went 105 → 60 lines, the vendor shell 269 → 236, and the component has 9 render tests. Note there is no third call site — the storefront's `/account` is four flat routes with no nav column.
- [x] **Repo-wide lint and tests are green (`INFRA` · `VEN` · `UI`):** `npx turbo run lint` went from **28 errors to 0** across all four workspaces, and the two long-standing red test files went green. Sixteen of the eighteen storefront errors were three copies of one idiom in `checkout-page.tsx` — a `prevXRef` read *and* written inside a `useMemo` to stabilise an identity — converted to compare-and-set during render with the comparison helpers the file already defined. Three of the fixes were bugs rather than lint noise: `package-form-dialog.tsx` re-seeded and wiped the merchant's typed input whenever the packages query refetched under the open dialog; `reviews-screen.tsx`'s effect would overwrite a toolbar pick; and `order-edit-dialog.tsx` turned out to be **entirely hardcoded English** with no `orders` i18n namespace existing at all. Both failing test clusters had the same root cause and neither was a component bug — `store-picker`'s helper was a bare `queryAllByRole("link")` that caught `StoreFrame`'s brand anchor, and `TagsSelector`'s `chips()` selector matched selected *and* unselected tags. **Note:** run `npx turbo run lint --continue`; without `--continue` turbo halts at the first failing task and reports 2 errors when there are 28.
- [x] **Analytics daily rollup refresher (`T3-22` · `BE · analytics`):** **Was already built** — `SalesDailyRollup`/`SalesRollupState`, the 1-minute BullMQ scheduler and the 30-second Redis snapshot all shipped and were wired into the dashboard read path; the entry was stale. Closed by adding what was genuinely missing: specs for the branches that carry risk (stale-checkpoint fallback to a live scan, day rollover, timezone change forcing a reconcile, Redis throwing without failing the call, `safeInteger` overflow, delete-then-reinsert idempotency) and the missing rows in `analytics.md` / `api/analytics.md`, including that `analytics` may now lag up to ~90s. The service itself was treated as read-only — no test surfaced a defect in it.
- [x] **Attachment MIME-type and extension sanitization (`T2-23` · `BE · attachments`):** **Was already built** — there is no `.bin` fallback anywhere in production source, all three write paths sniff magic bytes first and validate the *resolved* type, and the existing-files repair shipped as `npm run repair:attachment-mime`. Closed by adding the one missing piece, a `--report` mode that compares each row's `mime_type` against its stored extension **from the database alone** — the existing dry run downloads the bytes and needs a live CDN key, which is exactly what a sizing diagnostic must not require — plus the doc rows the repair never got. The production run is tracked separately under Platform & infrastructure.
- [x] **Multi-source studio image generation (`T4-16` · `BE · ai/image` · `VEN`):** **Was already built and tested** — `referenceAttachmentIds[]` with `MAX_REFERENCE_IMAGES = 8`, `flux-2-pro` declaring `maxReferenceImages: 8` and emitting `input_images`, every id resolved shop-scoped, and the vendor multi-reference rail with `MAX_EXTRA_REFERENCES = 7` (seven, because the subject takes slot one). `model-registry.spec.ts` pins the array shape, the cap, subject-first ordering and the text→image omission. The remaining acceptance criterion — that it "preserves consistency" — is a subjective judgement only live paid runs can make.
- [x] **Deterministic square canvas generation (`T4-18` · `BE · ai/image`):** Built, 11/11 tests green — alpha bounding-box trim, 85%-occupancy fit, 2000×2000 pad with odd remainders sent to bottom/right so two near-identical subjects land identically, flattened to white, JPEG 4:4:4. **The entry was misdescribed:** background removal is *not* and cannot be a `sharp` operation — a threshold/alpha trim only works on a near-uniform seamless and eats holes out of any light-coloured product. It is a version-pinned Replicate call (`851-labs/background-remover`, ~2c/image). Doing it locally would mean a segmentation model plus 40–80MB of weights.
- [x] **System and message notification producers (`T4-12` · `BE · notify-logs`):** **Was already built** — both producers shipped in `da39c334` with tests. `onDirectMessageSent` resolves recipients from the saved thread rather than the caller's payload, excludes the author and inactive users and respects `Participant.notify`; `onPlatformAnnouncementPosted` re-checks scope, creator role, deletion and expiry, then cursor-pages active non-admin owners of public shops in batches of 100. Every value of the `NotifyType` enum now has at least one producer. The anonymous contact form the entry's wording implied is genuinely missing and is tracked as its own item above.
- [x] **Multi-currency display switcher (`T4-37` · `VEN` · `BE · analytics`):** Built dynamic currency conversion engine (`currency-presets.ts` & `use-currency.tsx`) covering 10 major global and GCC presets with fixed reference scaling, localStorage persistence, and SSR hydration safety; integrated `CurrencySwitcher` (dropdown & compact variants) into Account menu, Notch mobile drawer, and ShopFooter; formatted converted prices in `ProductPrice` with base currency hints; enforced base store currency checkout integrity in `CheckoutPage` and `OrderSummary` with approximate conversion callouts (11 currency tests + 4 switcher render tests + 54 storefront test suites passing).
- [x] **Multi-location inventory allocation and low-stock view (`T4-28` · `BE · inventory` · `VEN`):** Enforced online-fulfilling location level `InventoryLevel.available` in cart stock validation (`addItem`/`updateItem`) and nightly reconciler drift job; added `InventoryStockStatus` filtering, safety stock, low-stock threshold calculations, and global count metrics to GraphQL API; enhanced Vendor Dashboard inventory items table with status tabs (All, Low Stock, Out of Stock) and status indicator badges (37 backend tests + 130 cart tests + 126 vendor test suites passing).
- [x] **Granular per-user permissions editor (`T3-23` · `ADM` · `BE · users`):** Extended `CreateUserInput` and `AdminUpdateUserInput` with granular permission overrides, enforced `assertMayAssignPermissions` preventing non-super-admins from granting system role management privileges, implemented session invalidation and dropped-permission audit logging in `UsersService`, synchronized GraphQL SDL (`schema.gql`), and built the Admin Console interactive checklist editor (`UserFormDialog`) with role-default synchronization, privilege gates, bilingual translations, and full test suites (42 backend unit tests + 39 admin tests passing).
- [x] **Moderation and report management screens (`T4-10` · `ADM`):** Built dedicated platform moderation and governance dashboard at `/moderation` with tabbed views covering seller onboarding applications (`becameSellerRequests` with approve/reject mutations, confirmation dialogs, and toast notifications), store/product/review abusive reports (`abusiveReports` with entity filters), and security audit anomalies (`auditAnomalies` with lookback window metrics cards, activity rate spikes, and sensitive operation streams), integrated into `AppSidebar` and `proxy.ts`, backed by unit and render tests (7/7 moderation tests passing).
- [x] **Direct media replacement workflow (`T4-25` · `VEN` · `BE · attachments`):** Replaced browser round-trips with direct server-side `replaceAttachmentFromExisting` GraphQL mutation, retaining media metadata while updating URLs, cleaning up old storage objects, updating relational and JSON references across the database, and updating the vendor image editor (`FilesImageEditor`) with unit and render test suites (12/12 backend + 4/4 vendor tests passing).
- [x] **OTP logs filtering and export (`T5-14` · `ADM`):** Built comprehensive OTP administration view in `/otp-logs` with date-range filtering, delivery error reason grouping (`otpDeliveryErrorGroups`), and full CSV export streamable up to 25,000 records, backed by unit and render tests (6/6 admin render tests passing).
- [x] **Bulk table actions for shops and users (`T4-5` · `ADM`):** Integrated multi-row selection (`DataTableSelectionBar`) for bulk account activation, suspension, restoration, and deletion across shops and users tables using batch GraphQL mutations.
- [x] **Operator password reset action (`T4-6` · `ADM` · `BE · users`):** Added operator password reset trigger sending one-time reset code to user's registered email or phone on their behalf, respecting security throttling and permission guards.
- [x] **Platform-wide usage and billing dashboard (`T4-9` · `ADM`):** Implemented marketplace resource consumption views (`ProviderCostCard` and `TopShopsCostCard`) covering `usageSummary`, `usageTopShops`, and AI spend across 7, 30, and 90-day timeframes.
- [x] **Public shop directory filtering hardening (`T2-15` · `BE · shops`):** Enforced dual `is_approved: true` and `is_active: true` checks across public directory listings and single-shop slug lookups, with comprehensive unit test coverage.
- [x] **Token revocation and session invalidation (`T2-17` · `BE · auth` · `BE · users`):** Enforced Redis timestamp watermark check in `JwtAuthGuard` and `OptionalJwtAuthGuard` to immediately invalidate active JWTs upon account suspension or password reset.
- [x] **Super-admin shop scope null safety (`T4-26` · `BE · ai/image` · `BE · platform`):** Hardened AI image resolvers and `ShopHeaderGuard` to safely handle operations requested by super admins without requiring an explicit shop context.
- [x] **Review and tune moderation regex rules (`T4-23` · `BE · ai/moderation`):** Tuned moderation regex patterns in `ContentModerationService` to eliminate false-positive rejections on legitimate prompts containing domain URLs, email addresses, or phone numbers.
- [x] **Accessible ARIA roles on custom interactive controls (`T5-3` · `UI`):** Removed unsupported `aria-valuetext` on `role="application"` in `CameraAngleController` and added accessible `role="status"` live region (`aria-live="polite"`) for assistive technologies to meet WCAG standards (23/23 tests passing).
- [x] **Order editing pipeline UI (`T3-8` · `VEN` · `BE · orders`):** Full end-to-end order adjustment workflow: backend `editOrder` GraphQL mutation with strict ownership verification, terminal status gating (cancelled/refunded/fulfilled), line quantity adjustments bounded by `fulfilled_quantity`, catalog product additions (`DraftProductPicker`), automatic integer-cents financial delta and tax recalculations, atomic inventory synchronization (`ORDER_EDIT`), and vendor UI `OrderEditDialog` with live preview and audit logs (161 backend tests + 5/5 vendor render tests passing).
- [x] **Frontend test coverage on core vendor forms (`T3-6` · `VEN`):** Added comprehensive render test suites covering Contextual Save Bar (`contextual-save-bar.render.test.tsx`), Product Edit Form (`product-form.render.test.tsx`), Variant Matrix (`variants-table.render.test.tsx`), and RTL layout rendering (`product-form-rtl.render.test.tsx`) with 100% pass rate (19/19 tests passing).
- [x] **Strict phone and email validation in customer address book (`T4-49` · `VEN`):** Enforced E.164 phone formatting and verified email patterns across guest checkout, customer address book, and registration with localized validation messages (AR/EN), Arabic-Indic numeral normalization, recipient phone support in saved addresses, and 100% test coverage (51/51 storefront test files, 490/490 tests passing).
- [x] **Storefront SEO metadata, canonical URLs & per-shop sitemap (`T4-32` · `BE · content` · `VEN`):** Implemented dynamic canonical URL generation across storefront pages, rich snippet Schema.org Product JSON-LD structured data with price/availability/images, per-shop dynamic sitemap XML endpoint (`/[shopSlug]/sitemap.xml`), and unit test coverage.
- [x] **Customer order timeline and tracking view (`T3-11` · `VEN` · `BE · orders`):** Built interactive, responsive `OrderTimeline` tracking component with full lifecycle milestones (Placed, Payment, Processing, Shipped, Delivered, Cancelled/Refunded), rich shipment tracking cards with one-click tracking copy, carrier direct link, carrier badge, and comprehensive unit tests (48/48 storefront test files, 465/465 tests passing).
- [x] **Merchant policy pages (`T3-13` · `VEN` · `BE · content`):** Complete end-to-end merchant policies architecture: backend GraphQL `ShopPolicies` schema & input, Vendor Dashboard `PoliciesPane` with template generators and deep merge settings save, Storefront dynamic policy reader routes (`/[shopSlug]/policies/[policyType]`), dynamic footer gating, and unit tests (29/29 shop-footer tests passing).
- [x] **Complete Arabic localization in Vendor Dashboard & Files (`T3-5` · `VEN`):** Added complete Arabic and English localized strings across the entire Files browse and manage surface (`file-detail-sheet`, `upload-from-url-dialog`, `files-page`, `file-tile`, `file-row-actions`, and toolbar), with 100% typecheck and 120/120 test suites (1,174 tests) passing.
- [x] **Storefront newsletter subscription operation (`T4-48`):** Implemented dedicated `subscribeNewsletter` GraphQL mutation, provisioned contact with subscribed tag and email status, wired `NewsletterPanel` with Apollo mutation and fallback, unit-tested (18/18 back-end + 27/27 frontend tests passing).
- [x] **Platform direct-payment alignment & balance removal:** Deleted vendor balance and withdrawal requests page (`/store/[shopSlug]/balance`), purged platform payout request UI from sidebar, and aligned platform architecture to direct vendor transactions (bank transfers / merchant accounts) without platform escrow.
- [x] **Server-side pagination and search on Orders and Customers (`T3-3`):** Converted client-capped tables into server-side paginated tables with dynamic search, GraphQL fragment reuse, and count indicators.
- [x] **Leave-guard history popstate integration (`T4-47`):** Trapped browser Back/Forward navigation with sentinel history states in `useLeaveGuard` and `useLeaveGuardStore` (38 unit tests passing).
- [x] **Vendor Returns and Refunds queue (`T3-9`):** Full RMA workflow with status transitions, restocking adjustments, and automatic refund processing at `/orders/returns`.
- [x] **Vendor sidebar navigation cleanup (`T3-2`):** Pruned dead 404 links (/marketing, /markets, /customers/companies); verified reviews moderation.
- [x] **Per-shop currency formatting (`T3-4`):** Dynamic shop currency support in `useActiveShopStore`, `useShopCurrency`, and `formatMoney`/`formatMoneyCents` with local persistence.
- [x] **Live store link availability check (`T4-11`):** Real-time debounced slug availability query (`isShopSlugAvailable` / `vendorSignupSlugAvailable`) with visual feedback in onboarding and GraphQL fragments.
- [x] **Storefront checkout revamp:** Address selection, dynamic shipping calculations, and multi-method payment support.
- [x] **Bank transfer payment flow:** Direct transfer order placement, receipt upload handling, and merchant verification.
- [x] **Guest shopping continuity:** Seamless cart merging (`adoptGuestCart`) and client-side wishlist persistence on user sign-in.
- [x] **BoardingPass component:** Order confirmation ticket card with customizable brand props and unit test coverage.
- [x] **Carrier quotes & OTO integration:** Dynamic carrier quotes at checkout, merchant-specific OTO credentials, and pickup scheduling.
- [x] **WhatsApp chat integration:** Customer bot and merchant inbox flows built on Evolution API.
- [x] **Product catalog CSV tools:** Product import/export services with inventory auto-allocation script.
- [x] **Cross-tenant IDOR security sweep:** Ownership guards applied across coupons, digital files, transfers, and media attachments.
- [x] **Token revocation system:** Instant session invalidation via Redis timestamp watermark in `JwtAuthGuard`.
- [x] **Integration secret rotation:** Backward-compatible decryption fallback with `SECRETS_ENCRYPTION_KEY_PREVIOUS`.
- [x] **Frontend lint zero-tolerance:** All lint errors resolved across vendor, admin, and UI packages.
- [x] **Comprehensive CI pipeline:** Automated GitHub Actions running typecheck, lint, DI check, and schema drift tests.
