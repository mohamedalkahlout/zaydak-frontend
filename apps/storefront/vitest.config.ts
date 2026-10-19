import { defineConfig } from "vitest/config"
import { resolve } from "path"

/**
 * Vitest setup for the customer storefront. Mirrors `apps/admin/vitest.config.ts`.
 *
 * `jsdom` is the default environment so the browser-only helpers (cookies, the
 * anonymous cart session id) can touch `document` and `localStorage`.
 *
 * Test layout convention: tests sit next to the code they cover, in a sibling
 * `__tests__/` directory.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@repo/ui": resolve(__dirname, "../../packages/ui/src"),
      // `server-only` is a guard whose whole implementation is a throw on
      // import, so any module beginning `import "server-only"` cannot be loaded
      // here at all — which had quietly made every one of them untestable,
      // including the hostname resolution the proxy runs ahead of every
      // request. See the stub for the rest.
      "server-only": resolve(__dirname, "./src/test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    globals: true,
  },
})
