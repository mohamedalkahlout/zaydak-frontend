# 99 - Glossary

Plain definitions of terms used across the frontend.

| Term | Meaning |
|------|---------|
| Shop slug | The URL-safe id of the current shop (`/store/[shopSlug]`). It also becomes the `X-SHOP` header sent to the back-end. |
| Contextual save bar | The global header bar with Save / Discard that appears whenever a form has unsaved changes. |
| unsaved-bar store | The Zustand store (`src/shared/stores/unsaved-bar.ts`) that controls the save bar. |
| Staged / dirty (value-based) | Edits are held locally; "dirty" means the staged value differs from the server value, so reverting clears it. |
| Feature module | A self-contained folder under `src/features/` with its own API, components, and validation. |
| Codegen | The step that turns the back-end GraphQL schema into TypeScript types under `src/shared/api/generated/`. |
| Apollo link | A piece of middleware in the GraphQL client chain (adds token, shop header, language, or handles errors). |
| Collection (MANUAL / AUTOMATED) | A product group that is either hand-picked or filled by rules (mirrors the back-end). |
| Segment | A customer group defined by rules, used for targeting and insights. |
| next-intl | The library that provides English/Arabic translations and text direction. |
| App Router | The Next.js routing model where folders under `src/app/` become URLs. |

## Main code files

- `src/shared/stores/` - shop, auth, and save-bar state.
- `src/features/` - feature modules.
- `src/shared/api/generated/` - codegen output.
- `../AGENTS.md` - the save-bar rules in full.
