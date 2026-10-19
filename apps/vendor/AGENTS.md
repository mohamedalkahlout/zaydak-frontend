<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Editing UX: contextual save bar — NO auto-save (MANDATORY)

**Never fire a create/update mutation on every keystroke / `onChange` / `onBlur`.** Editing screens must STAGE changes locally and persist them only when the user explicitly clicks **Save** in the global **contextual save bar**.

The save bar lives in the navbar (`SiteHeader`): while there are unsaved changes, the **search input transforms into an "unsaved changes" bar** with **Save** / **Discard** buttons. It is driven by the global store `useUnsavedBarStore` (`@/shared/stores/unsaved-bar`).

Since the monorepo split, the bar's markup is the presentational `UnsavedBar` in `@repo/ui/components/unsaved-bar` (props only, no store); `@/shared/components/site-header.tsx` is the wrapper that subscribes to `useUnsavedBarStore` and feeds it. **How you wire a screen does not change** — you still drive the store exactly as below.

How to wire an editing screen:

1. **Stage on change, don't save.** Keep edits in local state (react-hook-form `isDirty`, a zustand editor store, or a plain `draft` object). Inline editors stage into that draft on **`onChange` — every keystroke — not on blur**, so the save bar appears the instant the user changes anything (Shopify behavior). They do **not** call a mutation. For popover editors, stage live as the user types; the popover's own "Done" just closes it and "Cancel" reverts the staged change.
1b. **Dirty must be value-based.** Compute "dirty" by comparing the staged value to the *server* value, not by key-presence — so typing then reverting a field (or re-typing the original) collapses the bar. Send only the changed keys on Save.
2. **Register the bar while dirty.** In an effect:
   ```ts
   const show = useUnsavedBarStore((s) => s.show)
   const hide = useUnsavedBarStore((s) => s.hide)
   const setError = useUnsavedBarStore((s) => s.setError)
   useEffect(() => {
     if (!dirty) { hide(); return }
     show({ label: "Unsaved changes", saving, onSave, onDiscard })
   }, [dirty, saving /* + draft so onSave closes over the latest */])
   useEffect(() => () => hide(), [hide])   // tear down on unmount
   ```
3. **Save once.** `onSave` fires a single mutation with the whole staged patch. On success clear the draft (→ bar hides) + refetch; on failure call `setError(message)` (the bar turns red and shakes). `onDiscard` reverts the draft to server state.
4. **Show staged values.** Inline editors display the *server value overlaid with the staged change* so the pending edit is visible before saving.
5. **Guard the exit while dirty.** A staged edit must not be dropped by a rail link, the header menu or a reload without a word. Arm the shared guard with the same `dirty` that drives the bar:
   ```ts
   useLeaveGuard({
     when: dirty,
     allow: (path) => /* true for URLs this form stays mounted on */ false,
     onLeave: () => { reset(); setError(null); hide() },   // leave the screen clean
   })
   ```
   `useLeaveGuard` (`@/shared/hooks/use-leave-guard`) cancels same-origin link clicks and parks them in `useLeaveGuardStore`; `LeaveGuardDialog` (mounted once in `DashboardShell`) asks, and re-issues the navigation after `onLeave`. Code that navigates with `router.push` rather than a link must call `navigateGuarded(href, () => router.push(href))` itself — a push is invisible to the click listener. Reload and close-tab get the browser's `beforeunload` prompt; browser Back/Forward is not covered. First adopter: `features/settings/components/general-form-provider.tsx`.

**Reference implementations:** `features/collections/components/editor/collection-editor.tsx` + `use-collection-editor.ts` (one screen for create and edit: create keeps the bar available from the start, edit is dirty-gated and sends only the keys whose `dirtyFields` moved), `features/products/components/form/product-form-layout.tsx` + `use-product-submit.ts`, and the transfers feature — `transfer-detail-page.tsx` (inline detail edits staged in **react-hook-form**: `defaultValues` = server snapshot, `isDirty` drives the bar, `reset()` = Discard/post-save resync) and `transfer-form.tsx` (the create/edit page registers the **same global bar** — always available in create mode, dirty-gated in edit mode — instead of a local in-page bar). The localized bar label goes in the feature's i18n namespace (e.g. `transfers.unsavedChanges`); the Save/Discard/Saving button text is global (`header.*`).

## Translations: every string through next-intl (MANDATORY)

The dashboard runs in English and Arabic, and **no string a merchant can read is written in a component**: JSX text, `placeholder`/`title`/`aria-label`/`alt`, toasts, dialog copy, column headers, empty states, option labels in `lib/*.ts`, zod messages and page metadata all come from `useTranslations` (client) or `getTranslations` (server). A hand-rolled `isAr ? "…" : "…"` is not a translation either — both texts belong in the catalogues. Keep an `isAr` only where it drives layout, `dir` or formatting.

**Where messages live.** `src/shared/messages/en/<namespace>.json` and `src/shared/messages/ar/<namespace>.json`, one file per top-level namespace, assembled by `src/shared/messages/{en,ar}/index.ts`. A new namespace is a new file in **both** folders and a new line at the end of **both** index lists. `import en from "@/shared/messages/en"` is the whole English catalogue (the test helpers use it). `messages-parity.test.ts` fails on any key present on one side only, on a different key order, on an empty message, and on a namespace file that its `index.ts` does not import — that last one type-checks and lints and is missing at runtime.

**Patterns.**

- Interpolate with ICU (`"Delete {name}?"`), never by joining translated fragments. Counts use ICU plurals, and the Arabic side writes all six forms (`zero`, `one`, `two`, `few`, `many`, `other`) — "دقيقتين" is a form, not "2 دقائق".
- **zod messages are fixed when the schema is built**, so a schema constant with English literals stays English whatever renders the error. Build it from a translator: `export const tagSchema = (t: Translate) => z.object(...)`, typed with `Translate` from `@/shared/i18n/translator`, and `zodResolver(tagSchema(useTranslations("tags.validation")))` in the component. Schema tests pass `enTranslator("tags.validation")` from `@/shared/test/next-intl`. A check written with no message of its own (`.positive()`, `.min(0)`) gets zod's built-in wording, which `ZodLocale` (`@/shared/i18n/zod-locale`, mounted in the root layout) switches to Arabic with the dashboard; a message the schema passes always wins.
- **Country names** come from `regionName(code, locale)` (`@/shared/lib/country-name`, CLDR via `Intl.DisplayNames`), never from a list of English names. It says "Palestine" / "فلسطين" (CLDR's short form, for PS only). The bundled `@/shared/geo` table's Arabic column has machine-translation errors, patched at display in `geoLabel` (`AR_NAME_OVERRIDES`).
- **Don't import `next-intl` statically in `src/shared/test/next-intl.ts`.** That module is what `vi.mock("next-intl", …)` factories import, so the import resolves to the mock being built and the worker deadlocks, dying ~2 minutes later with "Worker exited unexpectedly". It takes `createTranslator` from `use-intl/core` for that reason.
- **Outside React** (the Apollo error link, `forceLogout`, a promise callback that raises a toast) there is no component to call a hook from: use `translatorFor(namespace)` from `@/shared/i18n/outside-react`. It reads `<html lang>` — the language the page was rendered in — and loads the catalogue only when it is called, which is always on an error path. `requestErrors.*` holds the link's toasts.
- `app/global-error.tsx` replaces the root layout and so has no provider; it mounts its own with only `errorPages`, and reads the `locale` cookie through `useSyncExternalStore` with an English server snapshot.
- Brand names stay as written: `Sidekick` in both languages, `زايدك` for Zaydak in Arabic.
- Tests: there is no global next-intl provider, so a component that calls `useTranslations` needs `vi.mock("next-intl", async () => (await import("@/shared/test/next-intl")).nextIntlMock())` — the real English catalogue, not a key echo.
