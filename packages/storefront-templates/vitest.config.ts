import { defineConfig } from "vitest/config"

/** Template tests moved with the presentation. jsdom covers the frame renders. */
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    globals: true,
  },
})
