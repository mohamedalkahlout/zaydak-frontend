import { defineConfig } from "vitest/config"

/**
 * The render tests (`autoscale-input.render.test.tsx`) mount real components, so
 * the whole package runs under jsdom. The pure-logic suites are cheap enough
 * that splitting environments is not worth it.
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    globals: true,
  },
})
