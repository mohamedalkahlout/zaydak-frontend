import { defineConfig } from "vitest/config"
import { resolve } from "path"

/**
 * Vitest setup for the admin console. Mirrors `apps/vendor/vitest.config.ts`.
 *
 * `jsdom` is the default environment so the browser-only helpers (`cookies`,
 * `cooldown`) can touch `document` and `localStorage`.
 *
 * Test layout convention: tests sit next to the code they cover, in a
 * sibling `__tests__/` directory.
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
