# Frontend Documentation (Next.js vendor dashboard)

Start here. Read the numbered sections in order — together they explain the whole frontend in under an hour.

## Onboarding sections (read top to bottom)

| Section | What it covers |
|---------|----------------|
| [00_project_map](00_project_map/) | What lives in which folder |
| [01_system_overview](01_system_overview/) | The whole frontend in one diagram |
| [02_build_startup](02_build_startup/) | How the app builds and renders |
| [03_entrypoints](03_entrypoints/) | The routes/screens a user can open |
| [04_core_flows](04_core_flows/) | Editing (save bar), data fetching, auth |
| [05_data_and_state](05_data_and_state/) | Apollo cache, Zustand stores, cookies |
| [06_external_integrations](06_external_integrations/) | The GraphQL backend and key libraries |
| [07_background_jobs](07_background_jobs/) | Server route handlers (no real jobs) |
| [08_security_and_safety](08_security_and_safety/) | Tokens, route protection, validation |
| [09_testing](09_testing/) | Vitest setup and how to run tests |
| [10_deployment](10_deployment/) | How the frontend ships |
| [11_observability](11_observability/) | What logging/error visibility exists today |
| [12_runbook](12_runbook/) | Run, build, and fix common problems |
| [99_glossary](99_glossary/) | Plain definitions of project-specific terms |

## Must-read references

- `../AGENTS.md` - the **mandatory** contextual save-bar editing pattern. Read it before
  touching any edit screen.
- `../PRODUCTS.md`, `../COLLECTIONS.md` - feature reference docs.

## Quick facts

- Stack: Next.js 16 (App Router) + React 19 + Apollo Client 4 + Zustand + react-hook-form + zod + next-intl.
- GraphQL types are generated from the back-end schema by codegen (`npm run codegen`).
- Start dev: `npm run dev` (port 3001). Tests: `npm test`.
