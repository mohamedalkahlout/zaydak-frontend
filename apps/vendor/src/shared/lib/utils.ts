/**
 * `cn` now lives in `@repo/ui` so the shared components and the apps that use
 * them agree on one implementation. This re-export keeps the `@/shared/lib/utils`
 * path working for the ~119 files that import it, and keeps the `utils` alias in
 * `components.json` valid so the shadcn CLI still writes correct imports.
 */
export { cn } from "@repo/ui/lib/utils"
