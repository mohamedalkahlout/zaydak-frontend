# vendor — the shop-owner dashboard

Next.js 16 (App Router) + React 19 + Apollo Client 4 + Zustand + zod. It is the only frontend today: shop owners manage products, orders, inventory, customers, analytics, and settings here. All data comes from the NestJS API in `back-end/` over GraphQL.

This is an npm workspace inside the Zaydak Turborepo. It is named `vendor`, so any Turborepo task can be scoped with `--filter=vendor`.

## Getting started

Install from the **repo root** — this app has no lockfile of its own:

```bash
cd ../..        # repo root
npm install
```

Then generate the GraphQL types (reads `../../back-end/src/schema.gql`, so no running server is needed) and start the dev server on port **3001**:

```bash
npm run codegen
npm run dev
```

Copy `.env.example` to `.env.local` first. `NEXT_PUBLIC_GRAPHQL_URL` must point at the back-end (default `http://localhost:3000/graphql`).

## Scripts

| Script | What it does |
|--------|--------------|
| `npm run dev` | Dev server on http://localhost:3001 |
| `npm run build` | Production build |
| `npm run codegen` | Regenerate `src/shared/api/generated/` from the back-end schema |
| `npm test` | Vitest |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (config from `@repo/eslint-config/next`) |

From the repo root you can run any of these across the whole monorepo, e.g. `npx turbo run build --filter=vendor`.

## Layout

- `src/app/` — App Router routes.
- `src/features/<name>/` — one folder per feature (components, hooks, validations, lib).
- `src/shared/` — cross-feature code: `api` (Apollo + generated types), `components`, `hooks`, `i18n`, `lib`, `stores`, `styles`, `types`.

## Read before writing code

- [AGENTS.md](AGENTS.md) — the **mandatory contextual save bar** rule: editing screens stage changes locally and never auto-save.
- [docs/](docs/) — numbered onboarding sections plus a per-feature doc for every folder in `src/features/`.

## Deployment

Vercel, configured by `vercel.json`. The Vercel project's **Root Directory** must be `apps/vendor`. See [docs/10_deployment/](docs/10_deployment/).
