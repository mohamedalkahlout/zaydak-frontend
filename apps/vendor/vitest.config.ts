import { defineConfig } from "vitest/config"
import { resolve } from "path"

/**
 * Vitest setup for the vendor app.
 *
 * - Native Vite tsconfig-paths replaces the `vite-tsconfig-paths` plugin
 *   (Vite 6+ supports this directly; the plugin is now redundant).
 * - Default to `jsdom` so the React-hook tests (`use-query-history`,
 *   `use-editor-state`) can render. Pure-logic suites are fine with it
 *   too — the import cost is small.
 *
 * Run with `npx vitest run` or `npm test`.
 *
 * Test layout convention:
 *   - Pure-logic helpers live in `src/features/<feature>/lib/`
 *   - Tests sit next to them: `src/features/<feature>/lib/__tests__/foo.test.ts`
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    globals: true,
  },
})
